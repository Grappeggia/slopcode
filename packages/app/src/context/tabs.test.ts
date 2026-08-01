import { describe, expect, test } from "bun:test"
import { nextTabAfterClose, pushClosedTab, removeClosedTabs, takeClosedTab, type ClosedTab } from "./closed-tabs"
import { migrateTabs } from "./tab-migration"
import type { SessionTab, Tab } from "./tabs"
import type { ServerConnection } from "./server"

const server = "local\nhttp://localhost:4096" as ServerConnection.Key

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
})
