import type { SessionTab, Tab } from "./tabs"

export type ClosedTab = {
  tab: SessionTab
  index: number
}

const CLOSED_TAB_LIMIT = 25

export function pushClosedTab(stack: ClosedTab[], tab: Tab, index: number): ClosedTab[] {
  if (tab.type !== "session") return stack
  return [...stack, { tab: { ...tab }, index }].slice(-CLOSED_TAB_LIMIT)
}

export function takeClosedTab(
  stack: ClosedTab[],
  tabs: Tab[],
  servers?: ReadonlySet<SessionTab["server"]>,
): { entry?: ClosedTab; stack: ClosedTab[] } {
  const remaining = [...stack]
  while (remaining.length) {
    const entry = remaining.pop()
    if (entry && servers && !servers.has(entry.tab.server)) continue
    if (entry && !isOpen(tabs, entry.tab)) return { entry, stack: remaining }
  }
  return { stack: remaining }
}

export function migrateClosedTabs(
  value: unknown,
  fallback: SessionTab["server"],
  servers: ReadonlySet<SessionTab["server"]>,
  preserveUnknown = false,
): ClosedTab[] {
  if (!Array.isArray(value)) return []
  return value.flatMap<ClosedTab>((entry) => {
    if (!entry || typeof entry !== "object" || !("tab" in entry) || !("index" in entry)) return []
    if (!Number.isInteger(entry.index) || entry.index < 0 || !entry.tab || typeof entry.tab !== "object") return []
    const tab = entry.tab
    if (tab.type !== "session" || typeof tab.sessionId !== "string" || typeof tab.dirBase64 !== "string") return []
    if ("server" in tab && typeof tab.server !== "string") return []
    const server = ("server" in tab ? tab.server : fallback) as SessionTab["server"]
    if (!preserveUnknown && !servers.has(server)) return []
    return [{ tab: { type: "session", server, sessionId: tab.sessionId, dirBase64: tab.dirBase64 }, index: entry.index }]
  })
}

export function pruneClosedTabs(stack: ClosedTab[], servers: ReadonlySet<SessionTab["server"]>) {
  return stack.filter((entry) => servers.has(entry.tab.server))
}

export function removeClosedTabs(stack: ClosedTab[], server: SessionTab["server"], sessionIDs: string[]) {
  const removed = new Set(sessionIDs)
  return stack.filter((entry) => entry.tab.server !== server || !removed.has(entry.tab.sessionId))
}

export function nextTabAfterClose(tabs: Tab[], index: number, active: boolean) {
  if (!active) return undefined
  return tabs[index + 1] ?? tabs[index - 1] ?? null
}

function isOpen(tabs: Tab[], tab: SessionTab) {
  return tabs.some(
    (item) =>
      item.type === "session" &&
      item.server === tab.server &&
      item.dirBase64 === tab.dirBase64 &&
      item.sessionId === tab.sessionId,
  )
}
