import { describe, expect, test } from "bun:test"
import { migrateClosedTabs, nextTabAfterClose, pushClosedTab, removeClosedTabs, takeClosedTab, type ClosedTab } from "./closed-tabs"
import { migrateTabs } from "./tab-migration"
import type { SessionTab, Tab } from "./tabs"
import type { ServerConnection } from "./server"
import { createTabController } from "./tab-controller"
import { tabHref } from "./tab-route"

const server = "local\nhttp://localhost:4096" as ServerConnection.Key
const remote = "https://remote.example.test" as ServerConnection.Key

function sessionTab(sessionId: string): SessionTab {
  return { type: "session", server, sessionId, dirBase64: "L3RtcA" }
}

describe("tab migration", () => {
  test("drops malformed persisted tabs and migrates legacy tabs", () => {
    expect(
      migrateTabs([null, sessionTab("a"), { type: "session", server, sessionId: "missing-dir" }, "invalid"], server),
    ).toEqual([sessionTab("a")])
    expect(migrateTabs([{ type: "session", sessionId: "a", dirBase64: "L3RtcA" }], server)).toEqual([sessionTab("a")])
  })
})

describe("closed tab stack", () => {
  test("records session tabs with their index and ignores drafts", () => {
    expect(pushClosedTab([], sessionTab("a"), 2)).toEqual([{ tab: sessionTab("a"), index: 2 }])
    const draft: Tab = { type: "draft", draftID: "d1", server, directory: "/tmp" }
    expect(pushClosedTab([], draft, 0)).toEqual([])
  })

  test("caps, reopens, and purges closed session tabs", () => {
    const stack = Array.from({ length: 30 }, (_, index) => index).reduce<ClosedTab[]>(
      (current, index) => pushClosedTab(current, sessionTab(`s${index}`), index),
      [],
    )
    expect(stack).toHaveLength(25)
    expect(stack[0]?.tab.sessionId).toBe("s5")

    const result = takeClosedTab(stack, [sessionTab("s29")])
    expect(result.entry?.tab.sessionId).toBe("s28")
    expect(removeClosedTabs(result.stack, server, ["s6"])).not.toContainEqual({ tab: sessionTab("s6"), index: 6 })
  })

  test("does not navigate when closing a background tab", () => {
    const tabs = [sessionTab("a"), sessionTab("b"), sessionTab("c")]

    expect(nextTabAfterClose(tabs, 1, false)).toBeUndefined()
    expect(nextTabAfterClose(tabs, 1, true)).toEqual(sessionTab("c"))
    expect(nextTabAfterClose([sessionTab("a")], 0, true)).toBeNull()
  })

  test("controller keeps a server-matched legacy route active when another server has the same session path", () => {
    const tabs = [sessionTab("a"), { ...sessionTab("a"), server: remote }]
    const controller = createTabController({
      activeServer: () => server,
      servers: () => [server, remote],
      location: () => ({ pathname: "/L3RtcA/session/a", search: "" }),
    })

    expect(controller.remove(tabs, 1).next).toBeUndefined()
    expect(controller.remove(tabs, 0).next).toEqual(tabs[1])
  })

  test("controller reopens canonical session tabs and discards entries for removed servers", () => {
    const controller = createTabController({
      activeServer: () => server,
      servers: () => [server],
      location: () => ({ pathname: "/", search: "" }),
    })
    const closed: ClosedTab[] = [
      { tab: { ...sessionTab("removed"), server: remote }, index: 0 },
      { tab: sessionTab("open"), index: 0 },
    ]

    expect(migrateClosedTabs(closed, server, new Set([server]))).toEqual([{ tab: sessionTab("open"), index: 0 }])

    const reopened = controller.reopen([], closed)
    expect(reopened.entry?.tab).toEqual(sessionTab("open"))
    expect(reopened.tabs).toEqual([sessionTab("open")])
    expect(reopened.closed).toEqual([])
    expect(tabHref(reopened.entry!.tab)).toContain("/server/")

    const stale = controller.reopen([], [{ tab: { ...sessionTab("removed"), server: remote }, index: 0 }])
    expect(stale.entry).toBeUndefined()
    expect(stale.tabs).toEqual([])
    expect(stale.closed).toEqual([])
  })
})
