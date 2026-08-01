import { describe, expect, test } from "bun:test"
import { ServerConnection } from "@/context/server"
import {
  canonicalSessionRoute,
  legacySessionHref,
  legacySessionRedirect,
  legacySessionServer,
  requireServerKey,
  serverRouteKey,
  sessionHref,
} from "./session-route"

describe("session routes", () => {
  test("builds and decodes a server-keyed session route with its directory segment", () => {
    const server = ServerConnection.Key.make("https://example.com:4096")
    const href = sessionHref(server, "L1VzZXJzL2V4YW1wbGUvcHJvamVjdA", "session-1")

    expect(href).toBe("/server/aHR0cHM6Ly9leGFtcGxlLmNvbTo0MDk2/L1VzZXJzL2V4YW1wbGUvcHJvamVjdA/session/session-1")
    expect(requireServerKey(href.split("/")[2])).toBe(server)
  })

  test("declares the directory param required by existing session consumers", () => {
    expect(canonicalSessionRoute).toBe("/server/:serverKey/:dir/session/:id")
  })

  test("redirects compatibility server routes into the directory-aware canonical route", () => {
    const server = ServerConnection.Key.make("https://example.com:4096")

    expect(legacySessionRedirect(server, "/Users/example/project", "session-1")).toBe(
      "/server/aHR0cHM6Ly9leGFtcGxlLmNvbTo0MDk2/L1VzZXJzL2V4YW1wbGUvcHJvamVjdA/session/session-1",
    )
  })

  test("rejects malformed server route segments", () => {
    expect(serverRouteKey("not-base64")).toBeUndefined()
    expect(() => requireServerKey("not-base64")).toThrow("Invalid server route")
  })

  test("uses the unique persisted server for a legacy session route", () => {
    expect(
      legacySessionServer(
        [{ type: "session", server: ServerConnection.Key.make("server-b"), sessionId: "session-1" }],
        "session-1",
        ServerConnection.Key.make("server-a"),
      ),
    ).toBe(ServerConnection.Key.make("server-b"))
  })

  test("prefers the active server when a legacy session ID is ambiguous", () => {
    expect(
      legacySessionServer(
        [
          { type: "session", server: ServerConnection.Key.make("server-a"), sessionId: "session-1" },
          { type: "session", server: ServerConnection.Key.make("server-b"), sessionId: "session-1" },
        ],
        "session-1",
        ServerConnection.Key.make("server-b"),
      ),
    ).toBe(ServerConnection.Key.make("server-b"))
  })

  test("builds the legacy directory-keyed route", () => {
    expect(legacySessionHref("/Users/example/project", "session-1")).toBe(
      "/L1VzZXJzL2V4YW1wbGUvcHJvamVjdA/session/session-1",
    )
  })
})
