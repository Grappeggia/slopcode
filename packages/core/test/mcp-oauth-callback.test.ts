import { describe, expect } from "bun:test"
import { MCPOAuthCallback } from "@slopcode-ai/core/mcp/oauth-callback"
import { Effect } from "effect"
import { it } from "./lib/effect"

describe("MCP OAuth callback", () => {
  it.live("binds loopback, accepts one exact callback, and never reflects secrets", () =>
    Effect.acquireRelease(
      Effect.promise(() => MCPOAuthCallback.make()),
      (callbacks) => Effect.promise(() => callbacks.close()),
    ).pipe(
      Effect.flatMap((callbacks) =>
        Effect.gen(function* () {
          const registered = yield* Effect.promise(() =>
            callbacks.register({
              redirect: "http://127.0.0.1:19876/mcp/oauth/callback",
              state: "private-state",
              receive: () => Promise.resolve(),
            }),
          )
          const missing = yield* Effect.promise(() => fetch("http://127.0.0.1:19876/mcp/oauth/callback?code=secret"))
          expect(missing.status).toBe(400)
          expect(yield* Effect.promise(() => missing.text())).not.toContain("secret")
          const response = yield* Effect.promise(() =>
            fetch("http://127.0.0.1:19876/mcp/oauth/callback?state=private-state&code=private-code"),
          )
          expect(response.status).toBe(200)
          expect(yield* Effect.promise(() => response.text())).not.toContain("private")
          const replay = yield* Effect.promise(() =>
            fetch("http://127.0.0.1:19876/mcp/oauth/callback?state=private-state&code=private-code"),
          )
          expect(replay.status).toBe(400)
          yield* Effect.promise(() => registered.close())
        }),
      ),
    ),
  )
})
