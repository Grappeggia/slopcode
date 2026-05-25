import { describe, expect, test } from "bun:test"
import {
  adjacentTab,
  closeSessionTab,
  DRAFT_TAB_ID,
  openDraftTab,
  promoteDraftTab,
  pruneSessionTabs,
  sessionStripVisible,
  sessionTabsSwitchable,
  sessionWaiting,
  shouldArchiveSessionTab,
  tabStatus,
  visitSessionTabs,
} from "../../../src/cli/cmd/tui/context/session-tabs-state"

describe("session tabs", () => {
  test("tracks the first root session without duplication", () => {
    const next = visitSessionTabs({ tabs: [], active: undefined }, { sessionID: "ses_1", source: "switch", root: true })

    expect(next).toEqual({
      tabs: [{ type: "session", id: "ses_1" }],
      active: "ses_1",
    })
  })

  test("appends unseen switched sessions", () => {
    const next = visitSessionTabs(
      { tabs: [{ type: "session", id: "ses_1" }], active: "ses_1" },
      { sessionID: "ses_2", source: "switch", root: true },
    )

    expect(next).toEqual({
      tabs: [
        { type: "session", id: "ses_1" },
        { type: "session", id: "ses_2" },
      ],
      active: "ses_2",
    })
  })

  test("revisiting a session only changes the active tab", () => {
    const next = visitSessionTabs(
      {
        tabs: [
          { type: "session", id: "ses_1" },
          { type: "session", id: "ses_2" },
          { type: "session", id: "ses_3" },
        ],
        active: "ses_3",
      },
      { sessionID: "ses_1", source: "switch", root: true },
    )

    expect(next).toEqual({
      tabs: [
        { type: "session", id: "ses_1" },
        { type: "session", id: "ses_2" },
        { type: "session", id: "ses_3" },
      ],
      active: "ses_1",
    })
  })

  test("new sessions append to the strip with a pending title", () => {
    const next = visitSessionTabs(
      {
        tabs: [
          { type: "session", id: "ses_1" },
          { type: "draft", id: DRAFT_TAB_ID },
          { type: "session", id: "ses_2" },
        ],
        active: DRAFT_TAB_ID,
      },
      { sessionID: "ses_3", source: "new", root: true },
    )

    expect(next).toEqual({
      tabs: [
        { type: "session", id: "ses_1" },
        { type: "draft", id: DRAFT_TAB_ID },
        { type: "session", id: "ses_2" },
        { type: "session", id: "ses_3", pendingTitle: true },
      ],
      active: "ses_3",
    })
  })

  test("forked sessions append to the strip instead of resetting it", () => {
    const next = visitSessionTabs(
      {
        tabs: [
          { type: "session", id: "ses_1" },
          { type: "draft", id: DRAFT_TAB_ID },
          { type: "session", id: "ses_2" },
        ],
        active: "ses_2",
      },
      { sessionID: "ses_3", source: "fork", root: true },
    )

    expect(next).toEqual({
      tabs: [
        { type: "session", id: "ses_1" },
        { type: "draft", id: DRAFT_TAB_ID },
        { type: "session", id: "ses_2" },
        { type: "session", id: "ses_3" },
      ],
      active: "ses_3",
    })
  })

  test("child routes enter the strip as their own tabs", () => {
    const next = visitSessionTabs(
      {
        tabs: [
          { type: "session", id: "ses_1" },
          { type: "session", id: "ses_2" },
        ],
        active: "ses_2",
      },
      { sessionID: "ses_child", source: "child", root: false },
    )

    expect(next).toEqual({
      tabs: [
        { type: "session", id: "ses_1" },
        { type: "session", id: "ses_2" },
        { type: "session", id: "ses_child" },
      ],
      active: "ses_child",
    })
  })

  test("known child sessions can be revisited without duplication", () => {
    const next = visitSessionTabs(
      {
        tabs: [
          { type: "session", id: "ses_1" },
          { type: "session", id: "ses_child" },
        ],
        active: "ses_1",
      },
      { sessionID: "ses_child", source: "switch", root: false },
    )

    expect(next).toEqual({
      tabs: [
        { type: "session", id: "ses_1" },
        { type: "session", id: "ses_child" },
      ],
      active: "ses_child",
    })
  })

  test("unknown sessions are provisionally tracked until sync resolves them", () => {
    const next = visitSessionTabs(
      { tabs: [{ type: "session", id: "ses_1" }], active: "ses_1" },
      { sessionID: "ses_2", source: "switch", root: undefined },
    )

    expect(next).toEqual({
      tabs: [
        { type: "session", id: "ses_1" },
        { type: "session", id: "ses_2" },
      ],
      active: "ses_2",
    })
  })

  test("opens a single reusable draft tab", () => {
    const next = openDraftTab({ tabs: [{ type: "session", id: "ses_1" }], active: "ses_1" })
    const reused = openDraftTab(next)

    expect(next).toEqual({
      tabs: [
        { type: "session", id: "ses_1" },
        { type: "draft", id: DRAFT_TAB_ID },
      ],
      active: DRAFT_TAB_ID,
    })
    expect(reused).toEqual(next)
  })

  test("keeps the strip visible for a single active session route", () => {
    expect(sessionStripVisible({ home: false, draft: false, count: 1 })).toBe(true)
    expect(sessionStripVisible({ home: false, draft: false, count: 0 })).toBe(false)
  })

  test("only shows the home strip when a draft tab exists", () => {
    expect(sessionStripVisible({ home: true, draft: true, count: 1 })).toBe(true)
    expect(sessionStripVisible({ home: true, draft: false, count: 0 })).toBe(false)
  })

  test("only allows tab switching when multiple tabs exist", () => {
    expect(sessionTabsSwitchable(["ses_1"])).toBe(false)
    expect(sessionTabsSwitchable(["ses_1", "ses_2"])).toBe(true)
  })

  test("promotes the draft tab into a real session in place", () => {
    const next = promoteDraftTab(
      {
        tabs: [
          { type: "session", id: "ses_1" },
          { type: "draft", id: DRAFT_TAB_ID },
        ],
        active: DRAFT_TAB_ID,
      },
      { sessionID: "ses_2" },
    )

    expect(next).toEqual({
      tabs: [
        { type: "session", id: "ses_1" },
        { type: "session", id: "ses_2", pendingTitle: true },
      ],
      active: "ses_2",
    })
  })

  test("draft tabs wait for their first prompt while pending titles stay ready", () => {
    expect(tabStatus({ draft: true, working: false, count: 0 })).toBe("waiting")
    expect(tabStatus({ pending: true, working: false, count: 0 })).toBe("ready")
    expect(tabStatus({ pending: false, working: false, count: 1 })).toBe("done")
  })

  test("waiting state wins over ready and done", () => {
    expect(tabStatus({ waiting: true, pending: true, working: false, count: 1 })).toBe("waiting")
  })

  test("working state wins over waiting, ready and done", () => {
    expect(tabStatus({ waiting: true, pending: true, working: true, count: 1 })).toBe("working")
  })

  test("waiting follows pending root and child prompts", () => {
    expect(
      sessionWaiting({
        sessionID: "ses_root",
        sessions: [{ id: "ses_root" }, { id: "ses_child", parentID: "ses_root" }],
        permission: { ses_child: [{}] },
        question: {},
      }),
    ).toBe(true)

    expect(
      sessionWaiting({
        sessionID: "ses_root",
        sessions: [{ id: "ses_root" }, { id: "ses_child", parentID: "ses_root" }],
        permission: {},
        question: { ses_root: [{}] },
      }),
    ).toBe(true)

    expect(
      sessionWaiting({
        sessionID: "ses_root",
        sessions: [{ id: "ses_root" }, { id: "ses_child", parentID: "ses_root" }],
        permission: {},
        question: {},
      }),
    ).toBe(false)
  })

  test("closing an inactive tab preserves the current active tab", () => {
    const next = closeSessionTab(
      {
        tabs: [
          { type: "session", id: "ses_1" },
          { type: "session", id: "ses_2" },
          { type: "session", id: "ses_3" },
        ],
        active: "ses_2",
      },
      "ses_1",
    )

    expect(next).toEqual({
      tabs: [
        { type: "session", id: "ses_2" },
        { type: "session", id: "ses_3" },
      ],
      active: "ses_2",
    })
  })

  test("closing the active tab prefers the tab to the right", () => {
    const next = closeSessionTab(
      {
        tabs: [
          { type: "session", id: "ses_1" },
          { type: "session", id: "ses_2" },
          { type: "session", id: "ses_3" },
        ],
        active: "ses_2",
      },
      "ses_2",
    )

    expect(next).toEqual({
      tabs: [
        { type: "session", id: "ses_1" },
        { type: "session", id: "ses_3" },
      ],
      active: "ses_3",
    })
  })

  test("closing the last tab falls back to the left", () => {
    const next = closeSessionTab(
      {
        tabs: [
          { type: "session", id: "ses_1" },
          { type: "session", id: "ses_2" },
        ],
        active: "ses_2",
      },
      "ses_2",
    )

    expect(next).toEqual({
      tabs: [{ type: "session", id: "ses_1" }],
      active: "ses_1",
    })
  })

  test("closing the draft can activate the next session tab", () => {
    const next = closeSessionTab(
      {
        tabs: [
          { type: "draft", id: DRAFT_TAB_ID },
          { type: "session", id: "ses_1" },
        ],
        active: DRAFT_TAB_ID,
      },
      DRAFT_TAB_ID,
    )

    expect(next).toEqual({
      tabs: [{ type: "session", id: "ses_1" }],
      active: "ses_1",
    })
  })

  test("closing the final tab clears the active tab", () => {
    const next = closeSessionTab(
      {
        tabs: [{ type: "draft", id: DRAFT_TAB_ID }],
        active: DRAFT_TAB_ID,
      },
      DRAFT_TAB_ID,
    )

    expect(next).toEqual({
      tabs: [],
      active: undefined,
    })
  })

  test("closing the last tab in a family should archive it", () => {
    expect(
      shouldArchiveSessionTab({
        state: {
          tabs: [{ type: "session", id: "ses_root" }],
          active: undefined,
        },
        sessionID: "ses_root",
        sessions: [{ id: "ses_root" }, { id: "ses_child", parentID: "ses_root" }],
      }),
    ).toBe(true)
  })

  test("closing a tab with active family siblings keeps it unarchived", () => {
    expect(
      shouldArchiveSessionTab({
        state: {
          tabs: [
            { type: "session", id: "ses_root" },
            { type: "session", id: "ses_child" },
          ],
          active: "ses_root",
        },
        sessionID: "ses_root",
        sessions: [{ id: "ses_root" }, { id: "ses_child", parentID: "ses_root" }],
      }),
    ).toBe(false)
  })

  test("prunes deleted sessions and keeps the current active tab when possible", () => {
    const next = pruneSessionTabs(
      {
        tabs: [
          { type: "session", id: "ses_1" },
          { type: "draft", id: DRAFT_TAB_ID },
          { type: "session", id: "ses_2" },
          { type: "session", id: "ses_3" },
        ],
        active: "ses_2",
      },
      new Set(["ses_2", "ses_3"]),
    )

    expect(next).toEqual({
      tabs: [
        { type: "draft", id: DRAFT_TAB_ID },
        { type: "session", id: "ses_2" },
        { type: "session", id: "ses_3" },
      ],
      active: "ses_2",
    })
  })

  test("pruning falls back to the last remaining tab when active disappears", () => {
    const next = pruneSessionTabs(
      {
        tabs: [
          { type: "session", id: "ses_1" },
          { type: "draft", id: DRAFT_TAB_ID },
          { type: "session", id: "ses_3" },
        ],
        active: "ses_1",
      },
      new Set(["ses_3"]),
    )

    expect(next).toEqual({
      tabs: [
        { type: "draft", id: DRAFT_TAB_ID },
        { type: "session", id: "ses_3" },
      ],
      active: "ses_3",
    })
  })
})

test("adjacentTab wraps forward across visible strip ids", () => {
  expect(adjacentTab(["ses_1", "ses_2", "ses_3"], "ses_3", 1)).toBe("ses_1")
})

test("adjacentTab wraps backward across visible strip ids", () => {
  expect(adjacentTab(["ses_1", "ses_2", "ses_3"], "ses_1", -1)).toBe("ses_3")
})

test("adjacentTab falls back to the first id when active is missing", () => {
  expect(adjacentTab(["ses_1", "ses_2"], undefined, 1)).toBe("ses_1")
})

test("adjacentTab does nothing when the strip is unavailable", () => {
  expect(adjacentTab(["ses_1"], "ses_1", 1)).toBeUndefined()
  expect(adjacentTab([], undefined, -1)).toBeUndefined()
})
