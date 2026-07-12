import { describe, expect } from "bun:test"
import { MCPOAuthProvider } from "@slopcode-ai/core/mcp/oauth-provider"
import { MCPOAuthStore } from "@slopcode-ai/core/mcp/oauth-store"
import { Effect } from "effect"
import { it } from "./lib/effect"
import { tmpdir } from "./fixture/tmpdir"

describe("MCP OAuth provider", () => {
  it.live("keeps attempt transients isolated and gives static clients precedence", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const store = MCPOAuthStore.make({ data: tmp.path })
          const target = { directory: "/workspace", name: "server", endpoint: "https://example.com/mcp" }
          yield* store.update(target, () => ({
            client: { client_id: "dynamic", redirect_uris: ["http://127.0.0.1:19876/callback"] },
            attempts: Object.fromEntries(
              ["mcp_auth_first", "mcp_auth_second"].map((attemptID) => [
                attemptID,
                {
                  state: attemptID,
                  mode: "manual",
                  redirect: "http://127.0.0.1:19876/callback",
                  created: 1,
                  expires: 2,
                  phase: "pending",
                },
              ]),
            ),
          }))
          const first = MCPOAuthProvider.make({
            store,
            target,
            attemptID: "mcp_auth_first",
            state: "state-one",
            redirectUrl: "http://127.0.0.1:19876/callback",
            config: { client_id: "static", client_secret: " secret ", scope: "read" },
            onRedirect: () => Promise.resolve(),
          })
          const second = MCPOAuthProvider.make({
            store,
            target,
            attemptID: "mcp_auth_second",
            state: "state-two",
            redirectUrl: "http://127.0.0.1:19876/callback",
            config: {},
            onRedirect: () => Promise.resolve(),
          })
          expect(yield* Effect.promise(() => Promise.resolve(first.clientInformation()))).toEqual({
            client_id: "static",
            client_secret: " secret ",
          })
          yield* Effect.promise(() => first.saveCodeVerifier("verifier-one"))
          yield* Effect.promise(() => second.saveCodeVerifier("verifier-two"))
          expect(yield* Effect.promise(() => first.codeVerifier())).toBe("verifier-one")
          expect(yield* Effect.promise(() => second.codeVerifier())).toBe("verifier-two")
          expect(yield* Effect.promise(() => Promise.resolve(first.state!()))).toBe("state-one")
          expect(first.clientMetadata.scope).toBe("read")
        }),
      ),
    ),
  )

  it.live("builds a strictly read-only connect provider", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const store = MCPOAuthStore.make({ data: tmp.path })
          const target = { directory: "/workspace", name: "connect", endpoint: "https://example.com/mcp" }
          yield* store.update(target, () => ({
            compatibility: "a".repeat(64),
            tokens: { access_token: "access", token_type: "Bearer" },
            client: { client_id: "client", redirect_uris: ["https://client.example/callback"] },
            discovery: { authorizationServerUrl: "https://auth.example/" },
          }))
          const file = `${tmp.path}/mcp-oauth/store.json`
          const before = yield* Effect.promise(() => Bun.file(file).bytes())
          const provider = MCPOAuthProvider.connect({
            entry: yield* store.get(target),
            config: {},
            compatibility: "a".repeat(64),
          })
          expect(provider.redirectUrl).toBeUndefined()
          expect(provider.saveClientInformation).toBeUndefined()
          expect(provider.saveDiscoveryState).toBeUndefined()
          yield* Effect.promise(() => Promise.resolve(provider.saveTokens({ access_token: "replacement", token_type: "Bearer" })))
          yield* Effect.promise(() => Promise.resolve(provider.invalidateCredentials?.("all")))
          expect(yield* Effect.promise(() => Bun.file(file).bytes())).toEqual(before)
          expect(yield* Effect.promise(() => provider.redirectToAuthorization(new URL("https://auth.example/authorize")).then(() => false, () => true))).toBe(true)
        }),
      ),
    ),
  )
})
