import { base64Encode } from "@slopcode-ai/core/util/encode"
import type { ServerConnection } from "@/context/server"
import type { SessionTab, Tab } from "@/context/tabs"
import { tabKey } from "@/context/tab-key"

export type HomeSessionOpenOptions = { background?: boolean }

export function shouldOpenSessionInBackground(input: {
  button: number
  mac: boolean
  meta: boolean
  ctrl: boolean
  shift: boolean
  alt: boolean
}) {
  if (input.button === 1) return true
  if (input.button !== 0) return false
  if (input.shift || input.alt) return false
  if (input.mac) return input.meta && !input.ctrl
  return input.ctrl && !input.meta
}

export function openHomeSession(input: {
  session: { id: string; directory: string }
  server: ServerConnection.Key
  directory: string
  options?: HomeSessionOpenOptions
  tabs: {
    store: Tab[]
    addSessionTab: (tab: Omit<SessionTab, "type">) => void
    select: (tab: Tab) => void
  }
  projects: {
    open: (directory: string) => void
    touch: (directory: string) => void
  }
}) {
  const tab: SessionTab = {
    type: "session",
    server: input.server,
    dirBase64: base64Encode(input.session.directory),
    sessionId: input.session.id,
  }

  input.projects.open(input.directory)
  if (!input.tabs.store.some((item) => tabKey(item) === tabKey(tab))) input.tabs.addSessionTab(tab)
  if (input.options?.background) return tab

  input.projects.touch(input.directory)
  input.tabs.select(tab)
  return tab
}
