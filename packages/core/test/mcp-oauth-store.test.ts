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
          for (const value of [
            "not a url",
            "file:///private",
            "https://user:secret@example.com/mcp",
            "https://example.com/#secret",
          ])
            expect(() => MCPOAuthStore.normalizeEndpoint(value)).toThrow("MCP OAuth endpoint is invalid")

          const store = MCPOAuthStore.make({ data: tmp.path })
          const base = { directory: "/workspace", name: "server", endpoint: "https://example.com/mcp" }
          const scoped = { ...base, workspaceID: WorkspaceV2.ID.make("wrk_one") }
          yield* store.update(base, (entry) => ({ ...entry, tokens: { access_token: "base", token_type: "Bearer" } }))
          yield* store.update(scoped, (entry) => ({
            ...entry,
            tokens: { access_token: "scoped", token_type: "Bearer" },
          }))
          expect((yield* store.get(base)).tokens?.access_token).toBe("base")
          expect((yield* store.get(scoped)).tokens?.access_token).toBe("scoped")
          expect((yield* store.get({ ...base, endpoint: "https://example.com/mcp/" })).tokens).toBeUndefined()
          for (const target of [
            { ...base, directory: "/other" },
            { ...base, name: "other" },
            { ...base, endpoint: "https://example.com/other" },
            { ...base, endpoint: "https://example.com/mcp?tenant=one" },
          ])
            expect((yield* store.get(target)).tokens).toBeUndefined()

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
            attempts: {
              attempt: {
                state: "state",
                verifier: "verifier",
                mode: "manual",
                redirect: "https://client.example/callback",
                created: 1,
                expires: 2,
                phase: "pending",
              },
            },
          }))
          yield* store.saveTokens(target, { access_token: "new", token_type: "Bearer" }, 200)
          expect((yield* store.get(target)).tokens).toEqual({
            access_token: "new",
            token_type: "Bearer",
            refresh_token: "refresh",
            scope: "read",
          })
          yield* store.invalidate(target, "all", "attempt")
          expect(yield* store.get(target)).toEqual({
            attempts: {
              attempt: {
                mode: "manual",
                redirect: "https://client.example/callback",
                created: 1,
                expires: 2,
                phase: "pending",
              },
            },
          })
        }),
      ),
    ),
  )

  it.live("claims only exact V1 version-2 stable material without changing the legacy file", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const legacy = path.join(tmp.path, "mcp-auth.json")
          const endpoint = "https://example.com/mcp"
          const raw = JSON.stringify({
            version: 2,
            entries: {
              '["/workspace","server"]': {
                identity: { instance: "/workspace", name: "server" },
                servers: {
                  [endpoint]: {
                    tokens: { accessToken: "legacy-access", refreshToken: "legacy-refresh" },
                    clientInfo: { clientId: "legacy-client", clientSecret: "legacy-secret" },
                    codeVerifier: "never-claim",
                    oauthState: "never-claim",
                  },
                },
              },
            },
          })
          yield* Effect.promise(() => Bun.write(legacy, raw))
          const store = MCPOAuthStore.make({ data: tmp.path, legacy })
          const entry = yield* store.get({ directory: "/workspace", name: "server", endpoint })
          expect(entry.tokens?.access_token).toBe("legacy-access")
          expect(entry.client?.client_id).toBe("legacy-client")
          expect(entry.attempts).toBeUndefined()
          expect(yield* Effect.promise(() => Bun.file(legacy).text())).toBe(raw)
          expect(
            (yield* store.get({
              directory: "/workspace",
              workspaceID: WorkspaceV2.ID.make("wrk_no_claim"),
              name: "server",
              endpoint,
            })).tokens,
          ).toBeUndefined()
        }),
      ),
    ),
  )

  it.live("atomically claims, cancels, exchanges, and publishes one winning attempt", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const first = MCPOAuthStore.make({ data: tmp.path })
          const second = MCPOAuthStore.make({ data: tmp.path })
          const target = { directory: "/workspace", name: "server", endpoint: "https://example.com/mcp" }
          yield* first.update(target, () => ({
            compatibility: "compatible",
            attempts: {
              winner: {
                state: "winner-state",
                verifier: "winner-verifier",
                mode: "manual",
                redirect: "https://client.example/callback",
                created: 1,
                expires: 100,
                phase: "pending",
              },
              sibling: {
                state: "sibling-state",
                verifier: "sibling-verifier",
                mode: "manual",
                redirect: "https://client.example/callback",
                created: 2,
                expires: 100,
                phase: "pending",
              },
            },
          }))
          const claims = yield* Effect.all(
            [first.claimAttempt("winner", "winner-state", "code", 10), second.claimAttempt("winner", "winner-state", "code", 10)],
            { concurrency: "unbounded" },
          )
          expect(claims.filter((result) => result.status === "claimed")).toHaveLength(1)
          expect(claims.filter((result) => result.status === "used")).toHaveLength(1)
          expect((yield* first.cancelAttempt("winner")).status).toBe("used")
          expect((yield* first.startExchange(target, "winner", "code"))?.phase).toBe("exchanging")
          expect(yield* first.finishExchange(target, "winner", { access_token: "winning", token_type: "Bearer" }, 20)).toBe(true)
          expect(yield* second.finishExchange(target, "winner", { access_token: "late", token_type: "Bearer" }, 21)).toBe(false)
          expect(yield* first.get(target)).toMatchObject({
            tokens: { access_token: "winning" },
            attempts: { winner: { phase: "complete" }, sibling: { phase: "cancelled" } },
          })
          expect((yield* first.get(target)).attempts?.winner.state).toBeUndefined()
          expect((yield* first.get(target)).attempts?.sibling.verifier).toBeUndefined()
        }),
      ),
    ),
  )

  it.live("rejects unknown fields, malformed nested values, and mismatched bucket identities", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const dir = path.join(tmp.path, "mcp-oauth")
          const file = path.join(dir, "store.json")
          const target = { directory: "/workspace", name: "server", endpoint: "https://example.com/mcp" }
          const identity = { directory: target.directory, name: target.name, endpoint: target.endpoint }
          const key = JSON.stringify(Object.values(identity))
          yield* Effect.promise(() => fs.mkdir(dir, { recursive: true }))
          for (const data of [
            { version: 1, buckets: {}, unknown: true },
            { version: 1, buckets: { [key]: { identity, entry: { unknown: true } } } },
            { version: 1, buckets: { wrong: { identity, entry: {} } } },
            { version: 1, buckets: { [key]: { identity, entry: { attempts: { bad: { phase: "pending" } } } } } },
            {
              version: 1,
              buckets: {
                [key]: {
                  identity,
                  entry: { tokens: { access_token: "token", token_type: "Bearer", expires_at: -1 } },
                },
              },
            },
          ]) {
            yield* Effect.promise(() => Bun.write(file, JSON.stringify(data)))
            expect(yield* MCPOAuthStore.make({ data: tmp.path }).get(target).pipe(Effect.flip)).toMatchObject({ code: "invalid" })
          }
        }),
      ),
    ),
  )

  it.live("serializes a winning token commit across spawned processes", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const store = MCPOAuthStore.make({ data: tmp.path })
          const target = { directory: "/workspace", name: "server", endpoint: "https://example.com/mcp" }
          const attempt = (id: string): MCPOAuthStore.Attempt => ({
            state: `${id}-state`,
            verifier: `${id}-verifier`,
            code: `${id}-code`,
            mode: "manual",
            redirect: "https://client.example/callback",
            created: 1,
            expires: 100,
            phase: "exchanging",
          })
          yield* store.update(target, () => ({ attempts: { one: attempt("one"), two: attempt("two") } }))
          const worker = path.join(import.meta.dir, "fixture/mcp-oauth-worker.ts")
          const output = yield* Effect.promise(() =>
            Promise.all(
              [["one", "first"], ["two", "second"]].map(async ([id, token]) => {
                const process = Bun.spawn(["bun", worker, tmp.path, id!, token!], { cwd: path.dirname(import.meta.dir), stdout: "pipe" })
                const text = await new Response(process.stdout).text()
                expect(await process.exited).toBe(0)
                return text
              }),
            ),
          )
          expect(output.toSorted()).toEqual(["lost", "won"])
          expect(["first", "second"]).toContain((yield* store.get(target)).tokens?.access_token)
          expect(Object.values((yield* store.get(target)).attempts ?? {}).map((value) => value.phase).toSorted()).toEqual([
            "cancelled",
            "complete",
          ])
        }),
      ),
    ),
  )

  it.live("rejects symlink and nonregular stores and leaves no temporary files", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const dir = path.join(tmp.path, "mcp-oauth")
          const file = path.join(dir, "store.json")
          const target = { directory: "/workspace", name: "server", endpoint: "https://example.com/mcp" }
          yield* Effect.promise(() => fs.mkdir(dir, { recursive: true }))
          yield* Effect.promise(() => fs.symlink(path.join(tmp.path, "missing"), file))
          expect(yield* MCPOAuthStore.make({ data: tmp.path }).get(target).pipe(Effect.flip)).toMatchObject({ code: "unsafe" })
          yield* Effect.promise(() => fs.rm(file))
          yield* Effect.promise(() => fs.mkdir(file))
          expect(yield* MCPOAuthStore.make({ data: tmp.path }).get(target).pipe(Effect.flip)).toMatchObject({ code: "unsafe" })
          yield* Effect.promise(() => fs.rm(file, { recursive: true }))
          yield* MCPOAuthStore.make({ data: tmp.path }).update(target, () => ({}))
          expect((yield* Effect.promise(() => fs.readdir(dir))).filter((name) => name.endsWith(".tmp"))).toEqual([])
        }),
      ),
    ),
  )

  it.live("ignores malformed or ambiguous legacy buckets without weakening the destination", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const legacy = path.join(tmp.path, "mcp-auth.json")
          yield* Effect.promise(() => Bun.write(legacy, JSON.stringify({
            version: 2,
            entries: {
              wrong: {
                identity: { instance: "/workspace", name: "server" },
                servers: {
                  "https://example.com/mcp": {
                    tokens: { accessToken: "must-not-claim" },
                    unknown: true,
                  },
                },
              },
            },
          })))
          const entry = yield* MCPOAuthStore.make({ data: tmp.path, legacy }).get({
            directory: "/workspace",
            name: "server",
            endpoint: "https://example.com/mcp",
          })
          expect(entry).toEqual({})
          expect(yield* Effect.promise(() => Bun.file(legacy).text())).toContain("must-not-claim")
        }),
      ),
    ),
  )
})
