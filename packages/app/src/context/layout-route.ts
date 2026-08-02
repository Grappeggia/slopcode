import { decode64 } from "@/utils/base64"
import { serverRouteKey } from "@/utils/session-route"
import type { ServerConnection } from "./server"

export type LayoutRoute =
  | { type: "home" }
  | { type: "draft"; draftID: string; server?: ServerConnection.Key }
  | { type: "dir-new-sesssion"; dir: string; dirBase64: string; server?: ServerConnection.Key }
  | { type: "session"; dir: string; dirBase64: string; sessionId: string; server?: ServerConnection.Key }

export const currentRoute = (pathname: string, search: string): LayoutRoute => {
  const parts = pathname.split("/").filter(Boolean)
  if (parts.length === 0) return { type: "home" }

  if (parts[0] === "new-session") {
    const draftID = new URLSearchParams(search).get("draftId")
    if (!draftID) return { type: "home" }
    return { type: "draft", draftID }
  }

  if (parts[0] === "server") {
    const server = serverRouteKey(parts[1])
    const dirBase64 = parts[2]
    const dir = decode64(dirBase64)
    if (!server || !dir || parts[3] !== "session") return { type: "home" }
    const id = parts[4]
    if (id) return { type: "session", server, dir, dirBase64, sessionId: id }
    return { type: "dir-new-sesssion", server, dir, dirBase64 }
  }

  const dirBase64 = parts[0]
  const dir = decode64(dirBase64)
  if (!dir) return { type: "home" }
  if (parts[1] !== "session") return { type: "home" }

  const id = parts[2]
  if (id) return { type: "session", dir, dirBase64, sessionId: id }
  return { type: "dir-new-sesssion", dir, dirBase64 }
}

export function routeWithServer(route: LayoutRoute, server: ServerConnection.Key): LayoutRoute {
  if (route.type === "home" || route.server) return route
  return { ...route, server }
}
