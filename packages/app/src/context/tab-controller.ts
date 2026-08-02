import { legacySessionHref, sessionHref } from "@/utils/session-route"
import { nextTabAfterClose, pruneClosedTabs, pushClosedTab, takeClosedTab, type ClosedTab } from "./closed-tabs"
import type { ServerConnection } from "./server"
import type { Tab } from "./tabs"

type Location = { pathname: string; search: string }

export function createTabController(input: {
  activeServer: () => ServerConnection.Key
  servers: () => ServerConnection.Key[]
  location: () => Location
}) {
  const active = (tab: Tab) => {
    const location = input.location()
    if (tab.type === "draft") {
      return location.pathname === "/new-session" && new URLSearchParams(location.search).get("draftId") === tab.draftID
    }
    if (location.pathname === sessionHref(tab.server, tab.dirBase64, tab.sessionId)) return true
    return (
      input.activeServer() === tab.server && location.pathname === legacySessionHref(atob(tab.dirBase64), tab.sessionId)
    )
  }

  const remove = (tabs: Tab[], index: number, selected?: boolean) => ({
    tab: tabs[index],
    tabs: tabs.filter((_, current) => current !== index),
    next: nextTabAfterClose(tabs, index, selected ?? (!!tabs[index] && active(tabs[index]))),
  })

  const close = (tabs: Tab[], closed: ClosedTab[], index: number, selected?: boolean) => {
    const result = remove(tabs, index, selected)
    return {
      ...result,
      closed: result.tab?.type === "session" ? pushClosedTab(closed, result.tab, index) : closed,
    }
  }

  const reopen = (tabs: Tab[], closed: ClosedTab[]) => {
    const servers = new Set(input.servers())
    const result = takeClosedTab(pruneClosedTabs(closed, servers), tabs, servers)
    if (!result.entry) return { entry: undefined, closed: result.stack, tabs }
    const index = Math.min(result.entry.index, tabs.length)
    return {
      entry: result.entry,
      closed: result.stack,
      tabs: [...tabs.slice(0, index), result.entry.tab, ...tabs.slice(index)],
    }
  }

  return { close, remove, reopen }
}
