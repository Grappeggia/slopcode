import type { ServerConnection } from "./server"
import type { PromptModel, Tab } from "./tabs"

function model(value: unknown): PromptModel | undefined {
  if (!value || typeof value !== "object") return
  if (!("providerID" in value) || typeof value.providerID !== "string") return
  if (!("modelID" in value) || typeof value.modelID !== "string") return
  const variant = "variant" in value ? value.variant : undefined
  if (variant !== undefined && variant !== null && typeof variant !== "string") return
  return {
    providerID: value.providerID,
    modelID: value.modelID,
    variant,
  }
}

export function migrateTabs(value: unknown, fallback: ServerConnection.Key): Tab[] {
  if (!Array.isArray(value)) return []
  return value.flatMap<Tab>((tab) => {
    if (!tab || typeof tab !== "object") return []
    if ("server" in tab && typeof tab.server !== "string") return []
    const server = ("server" in tab ? tab.server : fallback) as ServerConnection.Key
    if (tab.type === "session" && typeof tab.sessionId === "string" && typeof tab.dirBase64 === "string") {
      return [{ type: "session", server, sessionId: tab.sessionId, dirBase64: tab.dirBase64 }]
    }
    if (
      tab.type === "draft" &&
      typeof tab.draftID === "string" &&
      typeof tab.directory === "string" &&
      (tab.worktree === undefined || typeof tab.worktree === "string")
    ) {
      return [
        {
          type: "draft",
          server,
          draftID: tab.draftID,
          directory: tab.directory,
          worktree: tab.worktree,
          model: "model" in tab ? model(tab.model) : undefined,
        },
      ]
    }
    return []
  })
}
