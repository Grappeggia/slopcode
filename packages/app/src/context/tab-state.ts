import type { DraftTab, PromptModel, Tab } from "./tabs"

export const RECENT_TAB_LIMIT = 25

export type RecentTabUpdate = (keys: string[]) => string[]

export function createRecentTabMemory(read: () => string[], write: (keys: string[]) => void, pending = false) {
  let hydrated = !pending
  let current: string[] | undefined
  let updates: RecentTabUpdate[] = []

  return {
    keys: () => current ?? read(),
    update(update: RecentTabUpdate) {
      if (!hydrated) {
        updates.push(update)
        current = update(current ?? [])
        return
      }
      current = update(current ?? read())
      write(current)
    },
    hydrate() {
      if (hydrated) return
      const queued = updates
      updates = []
      hydrated = true
      current = queued.reduce((keys, update) => update(keys), read())
      if (queued.length > 0) write(current)
    },
  }
}

export function createDraftTab(
  draftID: string,
  draft: Omit<DraftTab, "type" | "draftID" | "model">,
  model?: PromptModel,
): DraftTab {
  return { type: "draft", draftID, ...draft, model: model ? { ...model } : undefined }
}

export function reorderTabs(tabs: Tab[], keys: string[], key: (tab: Tab) => string) {
  if (keys.length !== tabs.length) return tabs
  const current = new Map(tabs.map((tab) => [key(tab), tab]))
  if (current.size !== tabs.length || new Set(keys).size !== keys.length) return tabs
  const next = keys.map((item) => current.get(item)).filter((tab): tab is Tab => !!tab)
  if (next.length !== tabs.length) return tabs
  return next
}

export function moveTabKey(keys: string[], from: string, to: string) {
  const source = keys.indexOf(from)
  const target = keys.indexOf(to)
  if (source === -1 || target === -1 || source === target) return keys
  const next = [...keys]
  const [item] = next.splice(source, 1)
  if (!item) return keys
  next.splice(target, 0, item)
  return next
}

export function moveTabKeyBy(keys: string[], key: string, offset: -1 | 1) {
  const index = keys.indexOf(key)
  const target = index + offset
  if (index === -1 || target < 0 || target >= keys.length) return keys
  return moveTabKey(keys, key, keys[target]!)
}

export function rememberRecentTab(keys: string[], key: string, open: ReadonlySet<string>, limit = RECENT_TAB_LIMIT) {
  if (!open.has(key)) return pruneRecentTabs(keys, open, limit)
  return [key, ...keys.filter((item) => item !== key && open.has(item))].slice(0, limit)
}

export function pruneRecentTabs(keys: string[], open: ReadonlySet<string>, limit = RECENT_TAB_LIMIT) {
  const seen = new Set<string>()
  return keys
    .filter((key) => {
      if (!open.has(key) || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

export function replaceRecentTab(keys: string[], from: string, to: string, open: ReadonlySet<string>) {
  return rememberRecentTab(
    keys.map((key) => (key === from ? to : key)),
    to,
    open,
  )
}

export function recentTab<T extends Tab>(tabs: T[], keys: string[], key: (tab: T) => string) {
  const byKey = new Map(tabs.map((tab) => [key(tab), tab]))
  return keys.map((item) => byKey.get(item)).find((tab): tab is T => !!tab)
}

export function homeToggle<T extends Tab>(
  tabs: T[],
  keys: string[],
  home: boolean,
  current: T | undefined,
  key: (tab: T) => string,
) {
  if (home) return { tab: recentTab(tabs, keys, key) }
  return { home: true as const, remember: current }
}
