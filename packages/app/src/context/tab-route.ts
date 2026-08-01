import { sessionHref } from "@/utils/session-route"
import { decode64 } from "@/utils/base64"
import type { Tab } from "./tabs"

export const draftHref = (draftID: string) => `/new-session?draftId=${encodeURIComponent(draftID)}`

export const tabHref = (tab: Tab) =>
  tab.type === "draft" ? draftHref(tab.draftID) : sessionHref(tab.server, tab.dirBase64, tab.sessionId)

export function decodeSessionTabDirectory(tab: { dirBase64: string }) {
  return decode64(tab.dirBase64)
}
