import { describe, expect, test } from "bun:test"
import {
  DRAFT_TAB_ID,
  adjacentSessionTab,
  closeSessionTab,
  openDraftTab,
  promoteDraftTab,
  refreshSessionTabs,
  sessionFamilyIndex,
  sessionRoot,
  sessionTabStatus,
  visitSessionTab,
} from "../src/context/session-tabs-state"

describe("session tabs", () => {
  test("opens each visited root session once and preserves order", () => {
    const first = visitSessionTab({ tabs: [], active: undefined }, { id: "ses_1", title: "One", workspaceID: "work_1" })
    const second = visitSessionTab(first, { id: "ses_2", title: "Two" })
    const revisited = visitSessionTab(second, { id: "ses_1", title: "One renamed", workspaceID: "work_1" })

    expect(revisited).toEqual({
      tabs: [
        { type: "session", id: "ses_1", title: "One renamed", workspaceID: "work_1" },
        { type: "session", id: "ses_2", title: "Two" },
      ],
      active: "ses_1",
    })
  })

  test("finds the root of a nested session family", () => {
    expect(
      sessionRoot("ses_grandchild", [
        { id: "ses_root" },
        { id: "ses_child", parentID: "ses_root" },
        { id: "ses_grandchild", parentID: "ses_child" },
      ]),
    ).toBe("ses_root")
  })

  test("indexes roots and families once for nested sessions", () => {
    const sessions = [
      { id: "ses_root" },
      { id: "ses_child", parentID: "ses_root" },
      { id: "ses_grandchild", parentID: "ses_child" },
      { id: "ses_other" },
    ]
    const index = sessionFamilyIndex(sessions)

    expect(index.roots).toEqual(
      new Map([
        ["ses_root", "ses_root"],
        ["ses_child", "ses_root"],
        ["ses_grandchild", "ses_root"],
        ["ses_other", "ses_other"],
      ]),
    )
    expect(index.families.get("ses_root")?.map((item) => item.id)).toEqual(["ses_root", "ses_child", "ses_grandchild"])
    expect(index.families.get("ses_other")?.map((item) => item.id)).toEqual(["ses_other"])
  })

  test("opens one reusable draft and promotes it in place", () => {
    const initial = { tabs: [{ type: "session" as const, id: "ses_1", title: "One" }], active: "ses_1" }
    const draft = openDraftTab(initial)
    const reused = openDraftTab(draft)
    const promoted = promoteDraftTab(reused, { id: "ses_2", title: "New Session", workspaceID: "work_2" })

    expect(reused).toEqual({
      tabs: [
        { type: "session", id: "ses_1", title: "One" },
        { type: "draft", id: DRAFT_TAB_ID },
      ],
      active: DRAFT_TAB_ID,
    })
    expect(promoted).toEqual({
      tabs: [
        { type: "session", id: "ses_1", title: "One" },
        {
          type: "session",
          id: "ses_2",
          title: "New Session",
          workspaceID: "work_2",
          pendingTitle: true,
        },
      ],
      active: "ses_2",
    })
  })

  test("closing the active tab prefers right, then left, then home", () => {
    const state = {
      tabs: [
        { type: "session" as const, id: "ses_1", title: "One" },
        { type: "session" as const, id: "ses_2", title: "Two" },
        { type: "session" as const, id: "ses_3", title: "Three" },
      ],
      active: "ses_2",
    }

    expect(closeSessionTab(state, "ses_2").active).toBe("ses_3")
    expect(closeSessionTab({ ...state, active: "ses_3" }, "ses_3").active).toBe("ses_2")
    expect(closeSessionTab({ tabs: [state.tabs[0]], active: "ses_1" }, "ses_1")).toEqual({
      tabs: [],
      active: undefined,
    })
  })

  test("refreshes known descriptors without pruning sessions omitted by workspace sync", () => {
    const state = {
      tabs: [
        {
          type: "session" as const,
          id: "ses_other",
          title: "Other workspace",
          workspaceID: "work_other",
          status: "busy" as const,
        },
        { type: "session" as const, id: "ses_local", title: "Old local title" },
      ],
      active: "ses_local",
    }

    expect(refreshSessionTabs(state, [{ id: "ses_local", title: "Current local title" }])).toEqual({
      tabs: [
        {
          type: "session",
          id: "ses_other",
          title: "Other workspace",
          workspaceID: "work_other",
          status: "busy",
        },
        { type: "session", id: "ses_local", title: "Current local title" },
      ],
      active: "ses_local",
    })
  })

  test("clears cached workspace when a session warps back to local", () => {
    const state = {
      tabs: [
        {
          type: "session" as const,
          id: "ses_1",
          title: "One",
          workspaceID: "work_1",
        },
      ],
      active: "ses_1",
    }

    expect(visitSessionTab(state, { id: "ses_1", title: "One renamed" }).tabs[0]).toEqual({
      type: "session",
      id: "ses_1",
      title: "One renamed",
      workspaceID: "work_1",
    })
    expect(refreshSessionTabs(state, [{ id: "ses_1", title: "One local", workspaceID: undefined }]).tabs[0]).toEqual({
      type: "session",
      id: "ses_1",
      title: "One local",
    })
  })

  test("derives all useful tab states with blocking and connection precedence", () => {
    expect(sessionTabStatus({ known: true, status: "busy" })).toBe("working")
    expect(sessionTabStatus({ known: true, status: "retry" })).toBe("retrying")
    expect(sessionTabStatus({ known: true, status: "busy", waiting: true })).toBe("waiting")
    expect(sessionTabStatus({ known: true, status: "idle" })).toBe("idle")
    expect(sessionTabStatus({ known: false, draft: true })).toBe("ready")
    expect(sessionTabStatus({ known: true, connected: false })).toBe("disconnected")
    expect(sessionTabStatus({ known: false, status: "busy", connected: true })).toBe("working")
    expect(sessionTabStatus({ known: false, status: "idle", connected: true })).toBe("idle")
    expect(sessionTabStatus({ known: false, connected: true })).toBe("unknown")
    expect(sessionTabStatus({ known: false })).toBe("unknown")
  })
})

test("adjacent session navigation wraps in both directions", () => {
  expect(adjacentSessionTab(["ses_1", "ses_2", "ses_3"], "ses_3", 1)).toBe("ses_1")
  expect(adjacentSessionTab(["ses_1", "ses_2", "ses_3"], "ses_1", -1)).toBe("ses_3")
  expect(adjacentSessionTab(["ses_1"], "ses_1", 1)).toBeUndefined()
})
