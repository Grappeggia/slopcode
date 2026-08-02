import type { Tab } from "./tabs"
import { tabHref } from "./tab-route"

export const tabKey = (tab: Tab) => (tab.type === "draft" ? `draft:${tab.draftID}` : `${tab.server}\n${tabHref(tab)}`)
