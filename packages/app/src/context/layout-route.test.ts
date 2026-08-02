import { expect, test } from "bun:test"
import { base64Encode } from "@slopcode-ai/core/util/encode"
import { currentRoute, routeWithServer } from "./layout-route"
import type { ServerConnection } from "./server"

test("parses canonical and legacy session routes for titlebar state", () => {
  const server = "local\nhttp://localhost:4096"
  const dir = "/tmp/project"
  const encoded = base64Encode(dir)

  expect(currentRoute(`/server/${base64Encode(server)}/${encoded}/session/session-1`, "")).toEqual({
    type: "session",
    server: server as ServerConnection.Key,
    dir,
    dirBase64: encoded,
    sessionId: "session-1",
  })
  expect(currentRoute(`/${encoded}/session/session-1`, "")).toEqual({
    type: "session",
    dir,
    dirBase64: encoded,
    sessionId: "session-1",
  })
})

test("keeps Home and draft routes distinct from session routes", () => {
  expect(currentRoute("/", "")).toEqual({ type: "home" })
  expect(currentRoute("/new-session", "?draftId=draft-1")).toEqual({ type: "draft", draftID: "draft-1" })
  expect(currentRoute("/server/invalid/invalid/session/session-1", "")).toEqual({ type: "home" })
})

test("preserves a canonical route server and only fills legacy routes from active state", () => {
  const canonical = "local\nhttp://canonical.test" as ServerConnection.Key
  const active = "local\nhttp://active.test" as ServerConnection.Key
  const route = {
    type: "session" as const,
    server: canonical,
    dir: "/tmp",
    dirBase64: base64Encode("/tmp"),
    sessionId: "session-1",
  }

  expect(routeWithServer(route, active)).toBe(route)
  const legacy = routeWithServer({ ...route, server: undefined }, active)
  expect(legacy.type === "session" ? legacy.server : undefined).toBe(active)
})
