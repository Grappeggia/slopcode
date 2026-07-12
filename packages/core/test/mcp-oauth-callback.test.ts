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
              receive: () => Promise.resolve(true),
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

  it.live("shares listeners across callback services and unregisters only after durable acceptance", () =>
    Effect.acquireRelease(
      Effect.promise(() => Promise.all([MCPOAuthCallback.make(), MCPOAuthCallback.make()])),
      (callbacks) => Effect.promise(() => Promise.all(callbacks.map((callback) => callback.close())).then(() => undefined)),
    ).pipe(
      Effect.flatMap(([first, second]) =>
        Effect.gen(function* () {
          const listener = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
          const port = listener.port
          listener.stop(true)
          let claims = 0
          const one = yield* Effect.promise(() =>
            first.register({
              redirect: `http://127.0.0.1:${port}/one`,
              state: "state-one",
              receive: async () => ++claims > 1,
            }),
          )
          const two = yield* Effect.promise(() =>
            second.register({
              redirect: `http://127.0.0.1:${port}/two`,
              state: "state-two",
              receive: async () => true,
            }),
          )
          expect((yield* Effect.promise(() => fetch(`http://127.0.0.1:${port}/one?state=state-one&code=code`))).status).toBe(400)
          expect((yield* Effect.promise(() => fetch(`http://127.0.0.1:${port}/one?state=state-one&code=code`))).status).toBe(200)
          yield* Effect.promise(() => first.close())
          expect((yield* Effect.promise(() => fetch(`http://127.0.0.1:${port}/two?state=state-two&error=denied`))).status).toBe(400)
          yield* Effect.promise(() => Promise.all([one.close(), two.close()]).then(() => undefined))
        }),
      ),
    ),
  )

  it.live("rejects duplicate parameters, occupied ports, and keeps IPv4 and IPv6 ownership distinct", () =>
    Effect.acquireRelease(
      Effect.promise(() => MCPOAuthCallback.make()),
      (callbacks) => Effect.promise(() => callbacks.close()),
    ).pipe(
      Effect.flatMap((callbacks) =>
        Effect.gen(function* () {
          const occupied = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
          const unavailable = callbacks.register({
            redirect: `http://127.0.0.1:${occupied.port}/callback`,
            state: "occupied",
            receive: async () => true,
          })
          expect(yield* Effect.promise(() => unavailable.then(() => false, () => true))).toBe(true)
          occupied.stop(true)

          const reserve = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
          const port = reserve.port
          reserve.stop(true)
          const registration = yield* Effect.promise(() => callbacks.register({
            redirect: `http://127.0.0.1:${port}/callback`,
            state: "duplicates",
            receive: async () => true,
          }))
          expect((yield* Effect.promise(() => fetch(`http://127.0.0.1:${port}/callback?state=duplicates&state=duplicates&code=code`))).status).toBe(400)
          expect((yield* Effect.promise(() => fetch(`http://127.0.0.1:${port}/callback?state=duplicates&code=one&code=two`))).status).toBe(400)
          yield* Effect.promise(() => registration.close())

          if (process.platform !== "linux") return
          const ipv6 = Bun.serve({ hostname: "::1", port: 0, fetch: () => new Response() })
          const ipv6Port = ipv6.port
          ipv6.stop(true)
          const six = yield* Effect.promise(() => callbacks.register({
            redirect: `http://[::1]:${ipv6Port}/callback`,
            state: "ipv6-state",
            receive: async () => true,
          }))
          expect((yield* Effect.promise(() => fetch(`http://[::1]:${ipv6Port}/callback?state=ipv6-state&code=code`))).status).toBe(200)
          yield* Effect.promise(() => six.close())
        }),
      ),
    ),
  )

  it.live("settles listener close before the callback port is reused", () =>
    Effect.acquireRelease(
      Effect.promise(() => MCPOAuthCallback.make()),
      (callbacks) => Effect.promise(() => callbacks.close()),
    ).pipe(
      Effect.flatMap((callbacks) =>
        Effect.gen(function* () {
          const reserve = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
          const port = reserve.port
          reserve.stop(true)
          const registered = yield* Effect.promise(() => callbacks.register({
            redirect: `http://127.0.0.1:${port}/callback`,
            state: "close-state",
            receive: async () => true,
          }))
          yield* Effect.promise(() => registered.close())
          const reused = Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response() })
          expect(reused.port).toBe(port)
          reused.stop(true)
        }),
      ),
    ),
  )
})
