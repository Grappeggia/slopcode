import { describe, expect, test } from "bun:test"
import type { ServerConnection } from "./server"
import { tabKey } from "./tab-key"
import {
  createRecentTabMemory,
  homeToggle,
  moveTabKey,
  moveTabKeyBy,
  pruneRecentTabs,
  recentTab,
  rememberRecentTab,
  reorderTabs,
  replaceRecentTab,
} from "./tab-state"
import type { SessionTab, Tab } from "./tabs"

const server = "local\nhttp://localhost:4096" as ServerConnection.Key

function session(sessionId: string): SessionTab {
  return { type: "session", server, sessionId, dirBase64: "L3RtcA" }
}

describe("tab ordering", () => {
  test("reorders the same tabs without changing their identities", () => {
    const tabs = [session("a"), session("b"), session("c")]
    const next = reorderTabs(tabs, [tabKey(tabs[2]), tabKey(tabs[0]), tabKey(tabs[1])], tabKey)

    expect(next).toEqual([tabs[2], tabs[0], tabs[1]])
    expect(next[1]).toBe(tabs[0])
  })

  test("rejects incomplete, duplicate, and stale orders", () => {
    const tabs = [session("a"), session("b")]

    expect(reorderTabs(tabs, [tabKey(tabs[0])], tabKey)).toBe(tabs)
    expect(reorderTabs(tabs, [tabKey(tabs[0]), tabKey(tabs[0])], tabKey)).toBe(tabs)
    expect(reorderTabs(tabs, [tabKey(tabs[0]), "missing"], tabKey)).toBe(tabs)
  })

  test("moves a dragged key to the dropped key position", () => {
    expect(moveTabKey(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"])
    expect(moveTabKey(["a", "b", "c"], "missing", "c")).toEqual(["a", "b", "c"])
  })

  test("moves a focused tab one position for keyboard reordering", () => {
    expect(moveTabKeyBy(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"])
    expect(moveTabKeyBy(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"])
    expect(moveTabKeyBy(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"])
  })
})

describe("recent tab memory", () => {
  test("deduplicates, removes stale entries, and stays bounded", () => {
    const tabs = Array.from({ length: 30 }, (_, index) => session(`${index}`))
    const open = new Set(tabs.map(tabKey))
    const recent = tabs.reduce<string[]>((keys, tab) => rememberRecentTab(keys, tabKey(tab), open), [])

    expect(recent).toHaveLength(25)
    expect(recent[0]).toBe(tabKey(tabs[29]))
    expect(rememberRecentTab(recent, tabKey(tabs[29]), open)).toEqual(recent)
    expect(pruneRecentTabs(["stale", recent[0], recent[0], ...recent.slice(1)], open)).toEqual(recent)
  })

  test("finds the newest open tab and replaces a promoted draft key", () => {
    const draft: Tab = { type: "draft", draftID: "draft", server, directory: "/tmp" }
    const promoted = session("promoted")
    const other = session("other")
    const open = new Set([tabKey(promoted), tabKey(other)])
    const keys = replaceRecentTab([tabKey(draft), tabKey(other)], tabKey(draft), tabKey(promoted), open)

    expect(keys).toEqual([tabKey(promoted), tabKey(other)])
    expect(recentTab([other, promoted], keys, tabKey)).toBe(promoted)
  })

  test("toggles Home back to the newest open tab and remembers the current tab when entering", () => {
    const first = session("first")
    const latest = session("latest")

    expect(homeToggle([first, latest], [tabKey(latest), tabKey(first)], true, undefined, tabKey)).toEqual({
      tab: latest,
    })
    expect(homeToggle([first, latest], [], false, first, tabKey)).toEqual({ home: true, remember: first })
  })

  test("merges pre-hydration activity into persisted recent history", () => {
    let stored = ["persisted", "older"]
    const memory = createRecentTabMemory(
      () => stored,
      (keys) => (stored = keys),
      true,
    )

    memory.update((keys) => ["current", ...keys.filter((key) => key !== "current")])
    expect(memory.keys()).toEqual(["current"])
    memory.hydrate()

    expect(stored).toEqual(["current", "persisted", "older"])
    expect(memory.keys()).toEqual(stored)
  })
})
