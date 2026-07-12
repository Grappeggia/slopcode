import { describe, expect } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { MCPOAuthStore } from "@slopcode-ai/core/mcp/oauth-store"
import { WorkspaceV2 } from "@slopcode-ai/core/workspace"
import { Effect } from "effect"
import { it } from "./lib/effect"
import { tmpdir } from "./fixture/tmpdir"

describe("MCP OAuth store", () => {
  it.live("normalizes endpoints and isolates exact Location identities", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          expect(MCPOAuthStore.normalizeEndpoint("HTTPS://Example.COM:443/mcp?tenant=a")).toBe(
            "https://example.com/mcp?tenant=a",
          )
          for (const value of ["not a url", "file:///private", "https://user:secret@example.com/mcp", "https://example.com/#secret"])
            expect(() => MCPOAuthStore.normalizeEndpoint(value)).toThrow("MCP OAuth endpoint is invalid")

          const store = MCPOAuthStore.make({ data: tmp.path })
          const base = { directory: "/workspace", name: "server", endpoint: "https://example.com/mcp" }
          const scoped = { ...base, workspaceID: WorkspaceV2.ID.make("wrk_one") }
          yield* store.update(base, (entry) => ({ ...entry, tokens: { access_token: "base", token_type: "Bearer" } }))
          yield* store.update(scoped, (entry) => ({ ...entry, tokens: { access_token: "scoped", token_type: "Bearer" } }))
          expect((yield* store.get(base)).tokens?.access_token).toBe("base")
          expect((yield* store.get(scoped)).tokens?.access_token).toBe("scoped")
          expect((yield* store.get({ ...base, endpoint: "https://example.com/mcp/" })).tokens).toBeUndefined()

          const dir = path.join(tmp.path, "mcp-oauth")
          expect((yield* Effect.promise(() => fs.stat(dir))).mode & 0o777).toBe(0o700)
          expect((yield* Effect.promise(() => fs.stat(path.join(dir, "store.json")))).mode & 0o777).toBe(0o600)
        }),
      ),
    ),
  )

  it.live("preserves refresh material and implements SDK invalidation scopes", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const store = MCPOAuthStore.make({ data: tmp.path })
          const target = { directory: "/workspace", name: "server", endpoint: "https://example.com/mcp" }
          yield* store.update(target, () => ({
            tokens: {
              access_token: "old",
              token_type: "Bearer",
              refresh_token: "refresh",
              scope: "read",
              expires_at: 100,
            },
            client: { client_id: "dynamic", redirect_uris: ["http://127.0.0.1:19876/callback"] },
            discovery: { authorizationServerUrl: "https://auth.example.com/" },
            attempts: { attempt: { state: "state", verifier: "verifier" } },
          }))
          yield* store.saveTokens(target, { access_token: "new", token_type: "Bearer" }, 200)
          expect((yield* store.get(target)).tokens).toEqual({
            access_token: "new",
            token_type: "Bearer",
            refresh_token: "refresh",
            scope: "read",
          })
          yield* store.invalidate(target, "all", "attempt")
          expect(yield* store.get(target)).toEqual({ attempts: {} })
        }),
      ),
    ),
  )
})
