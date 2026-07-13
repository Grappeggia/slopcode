import { describe, expect, test } from "bun:test"
import { ConfigMCP } from "@slopcode-ai/core/config/mcp"
import { MCP } from "@slopcode-ai/core/mcp"
import { MCPClient } from "@slopcode-ai/core/mcp/client"
import { MCPOAuthProvider } from "@slopcode-ai/core/mcp/oauth-provider"
import { MCPOAuthStore } from "@slopcode-ai/core/mcp/oauth-store"
import { MCPOAuth } from "@slopcode-ai/core/mcp/oauth"
import { MCPOAuthCallback } from "@slopcode-ai/core/mcp/oauth-callback"
import { auth } from "@modelcontextprotocol/sdk/client/auth.js"
import { Context, Effect, Exit, Fiber, Layer, Schema, Scope } from "effect"
import { it } from "./lib/effect"
import { tmpdir } from "./fixture/tmpdir"

describe("MCP OAuth protocol boundary", () => {
  test("validates remote OAuth config without reflecting unsafe input", () => {
    const decode = Schema.decodeUnknownSync(ConfigMCP.Remote)
    expect(decode({ type: "remote", url: "https://example.com/mcp" }).oauth).toBeUndefined()
    expect(decode({ type: "remote", url: "https://example.com/mcp", oauth: false }).oauth).toBe(false)
    for (const oauth of [
      { client_id: "" },
      { client_secret: "secret" },
      { callback_port: 0 },
      { redirect_uri: "file:///private" },
      { callback_port: 19876, redirect_uri: "https://client.example/callback" },
      { callback_port: 19876, redirect_uri: "http://127.0.0.1/callback" },
      { callback_port: 19876, redirect_uri: "http://127.0.0.1:19877/callback" },
    ])
      expect(() => decode({ type: "remote", url: "https://example.com/mcp", oauth })).toThrow()
  })

  it.live("returns redirect conflicts through the typed failure channel", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.scoped(
          Effect.gen(function* () {
            const store = MCPOAuthStore.make({ data: tmp.path })
            const context = yield* Layer.build(
              MCPOAuth.layer.pipe(
                Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                Layer.provide(MCPOAuthCallback.layer),
              ),
            )
            const exit = yield* Effect.exit(
              Context.get(context, MCPOAuth.Service).begin({
                target: { directory: tmp.path, name: "conflict", endpoint: "https://example.com/mcp" },
                config: { callback_port: 19876, redirect_uri: "https://client.example/callback" },
              }),
            )
            expect(exit._tag).toBe("Failure")
            if (exit._tag === "Failure") expect(String(exit.cause)).toContain("invalid-redirect")
          }),
        ),
      ),
    ),
  )

  test("overlays generated transport headers and strips OAuth configured authorization", () => {
    expect(
      Object.fromEntries(
        MCPClient.headers(
          { Authorization: "Bearer generated", Accept: "text/event-stream", "Mcp-Session-Id": "session" },
          { Authorization: "Bearer configured", Accept: "bad", "X-Custom": "yes" },
          true,
        ),
      ),
    ).toEqual({
      accept: "text/event-stream",
      authorization: "Bearer generated",
      "mcp-session-id": "session",
      "x-custom": "yes",
    })
  })

  it.live("uses SDK discovery, PKCE exchange, cache, and refresh against a real protocol fixture", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.acquireRelease(Effect.sync(protocol), (fixture) => Effect.sync(() => fixture.stop())).pipe(
          Effect.flatMap((fixture) =>
            Effect.gen(function* () {
              const store = MCPOAuthStore.make({ data: tmp.path })
              const target = { directory: tmp.path, name: "protocol", endpoint: `${fixture.url}/mcp` }
              yield* store.update(target, () => ({
                attempts: {
                  mcp_auth_protocol: {
                    state: "exact-state",
                    mode: "manual",
                    redirect: "http://127.0.0.1:19876/callback",
                    created: 1,
                    expires: Date.now() + 60_000,
                    phase: "initializing",
                  },
                },
              }))
              let authorization: URL | undefined
              const provider = MCPOAuthProvider.make({
                store,
                target,
                attemptID: "mcp_auth_protocol",
                state: "exact-state",
                redirectUrl: "http://127.0.0.1:19876/callback",
                config: { client_id: "static-client", scope: "fallback-scope" },
                onRedirect: async (url) => {
                  authorization = url
                },
              })
              expect(yield* Effect.promise(() => auth(provider, { serverUrl: target.endpoint }))).toBe("REDIRECT")
              expect(authorization?.searchParams.get("state")).toBe("exact-state")
              expect(authorization?.searchParams.get("code_challenge_method")).toBe("S256")
              expect(authorization?.searchParams.get("scope")).toBe("resource-scope")
              fixture.challenge = authorization!.searchParams.get("code_challenge")!

              expect(
                yield* Effect.promise(() =>
                  auth(provider, { serverUrl: target.endpoint, authorizationCode: "authorization-code" }),
                ),
              ).toBe("AUTHORIZED")
              expect((yield* store.get(target)).tokens).toMatchObject({
                access_token: "access-one",
                refresh_token: "refresh-one",
                scope: "resource-scope",
              })
              expect(yield* Effect.promise(() => auth(provider, { serverUrl: target.endpoint }))).toBe("AUTHORIZED")
              expect((yield* store.get(target)).tokens).toMatchObject({
                access_token: "access-two",
                refresh_token: "refresh-one",
                scope: "resource-scope",
              })
              expect(fixture.discovery).toBe(1)
              expect(fixture.grants).toEqual(["authorization_code", "refresh_token"])
            }),
          ),
        ),
      ),
    ),
  )

  it.live("exposes manual begin, status, single-use completion, cancellation, and removal", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.acquireRelease(Effect.sync(protocol), (fixture) => Effect.sync(() => fixture.stop())).pipe(
          Effect.flatMap((fixture) =>
            Effect.scoped(
              Effect.gen(function* () {
                const store = MCPOAuthStore.make({ data: tmp.path })
                const context = yield* Layer.build(
                  MCPOAuth.layer.pipe(
                    Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                    Layer.provide(MCPOAuthCallback.layer),
                  ),
                )
                const oauth = Context.get(context, MCPOAuth.Service)
                const target = { directory: tmp.path, name: "controls", endpoint: `${fixture.url}/mcp` }
                const config = {
                  client_id: "static-client",
                  scope: "fallback-scope",
                  redirect_uri: "https://client.example/callback",
                }
                const started = yield* oauth.begin({ target, config, mode: "auto" })
                expect(started.status).toBe("authorizing")
                if (started.status !== "authorizing") throw new Error("authorization did not start")
                expect(started.mode).toBe("manual")
                const url = new URL(started.authorizationUrl)
                expect((yield* store.findAttempt(started.attemptID))?.attempt).toMatchObject({
                  phase: "pending",
                  verifier: expect.any(String),
                  authorization: started.authorizationUrl,
                })
                fixture.challenge = url.searchParams.get("code_challenge")!
                expect(yield* oauth.status(target)).toMatchObject({
                  status: "authorizing",
                  attempts: [{ attemptID: started.attemptID }],
                })
                expect(
                  yield* oauth.complete({
                    target,
                    config,
                    attemptID: started.attemptID,
                    code: "authorization-code",
                    state: url.searchParams.get("state")!,
                  }),
                ).toEqual({ status: "credential-ready" })
                expect(yield* oauth.status(target)).toEqual({ status: "credential-ready" })
                expect(yield* oauth.begin({ target, config, mode: "manual" })).toEqual({ status: "connected" })
                expect(
                  yield* oauth
                    .complete({
                      target,
                      config,
                      attemptID: started.attemptID,
                      code: "authorization-code",
                      state: url.searchParams.get("state")!,
                    })
                    .pipe(Effect.flip),
                ).toMatchObject({ code: "attempt-used" })
                yield* oauth.remove(target)
                expect(yield* oauth.status(target)).toEqual({ status: "auth-required" })
                const cancelled = yield* oauth.begin({ target, config, mode: "manual" })
                if (cancelled.status !== "authorizing") throw new Error("authorization did not restart")
                yield* oauth.cancel(cancelled.attemptID)
                expect(yield* oauth.status(target)).toEqual({ status: "auth-required" })
              }),
            ),
          ),
        ),
      ),
    ),
  )

  it.live("terminalizes initializing attempts without rehydrating a callback", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.scoped(
          Effect.gen(function* () {
            const store = MCPOAuthStore.make({ data: tmp.path })
            const target = { directory: tmp.path, name: "initializing", endpoint: "https://example.com/mcp" }
            yield* store.update(target, () => ({
              compatibility: MCPOAuthProvider.compatibility(
                target.endpoint,
                { client_id: "static" },
                "http://127.0.0.1:19876/mcp/oauth/callback",
              ),
              attempts: {
                initializing: {
                  state: "not-returned",
                  mode: "auto",
                  redirect: "http://127.0.0.1:19876/mcp/oauth/callback",
                  created: 1,
                  expires: Date.now() + 60_000,
                  phase: "initializing",
                },
              },
            }))
            const context = yield* Layer.build(
              MCPOAuth.layer.pipe(
                Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                Layer.provide(MCPOAuthCallback.layer),
              ),
            )
            yield* Context.get(context, MCPOAuth.Service).recover({ target, config: { client_id: "static" } })
            expect((yield* store.findAttempt("initializing"))?.attempt).toEqual({
              mode: "auto",
              redirect: "http://127.0.0.1:19876/mcp/oauth/callback",
              created: 1,
              expires: expect.any(Number),
              phase: "failed",
              error: "discovery",
            })
          }),
        ),
      ),
    ),
  )

  it.live("scrubs an attempt interrupted during initialization", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const started = Promise.withResolvers<void>()
            const server = Bun.serve({
              hostname: "127.0.0.1",
              port: 0,
              fetch: async () => {
                started.resolve()
                return new Promise<Response>(() => {})
              },
            })
            return { server, started: started.promise }
          }),
          (fixture) => Effect.sync(() => fixture.server.stop(true)),
        ).pipe(
          Effect.flatMap((fixture) =>
            Effect.scoped(
              Effect.gen(function* () {
                const store = MCPOAuthStore.make({ data: tmp.path })
                const target = { directory: tmp.path, name: "interrupt-init", endpoint: `${fixture.server.url}mcp` }
                const context = yield* Layer.build(
                  MCPOAuth.layer.pipe(
                    Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                    Layer.provide(MCPOAuthCallback.layer),
                  ),
                )
                const fiber = yield* Context.get(context, MCPOAuth.Service)
                  .begin({
                    target,
                    config: { client_id: "static", redirect_uri: "https://client.example/callback" },
                  })
                  .pipe(Effect.forkChild)
                yield* Effect.promise(() => fixture.started)
                yield* Fiber.interrupt(fiber)
                expect(Object.values((yield* store.get(target)).attempts ?? {})).toEqual([
                  expect.objectContaining({ phase: "failed", error: "discovery" }),
                ])
                expect(Object.values((yield* store.get(target)).attempts ?? {})[0]).not.toHaveProperty("state")
                expect(Object.values((yield* store.get(target)).attempts ?? {})[0]).not.toHaveProperty("verifier")
              }),
            ),
          ),
        ),
      ),
    ),
  )

  it.live("dynamically registers and replaces an expired client secret", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.acquireRelease(Effect.sync(protocol), (fixture) => Effect.sync(() => fixture.stop())).pipe(
          Effect.flatMap((fixture) =>
            Effect.gen(function* () {
              const store = MCPOAuthStore.make({ data: tmp.path })
              const target = { directory: tmp.path, name: "dynamic", endpoint: `${fixture.url}/mcp` }
              yield* store.update(target, () => ({
                client: { client_id: "expired", client_secret: "old", client_secret_expires_at: 1 },
                attempts: {
                  mcp_auth_dynamic: {
                    state: "dynamic-state",
                    mode: "manual",
                    redirect: "https://client.example/callback",
                    created: 1,
                    expires: Date.now() + 60_000,
                    phase: "initializing",
                  },
                },
              }))
              let redirected = false
              const provider = MCPOAuthProvider.make({
                store,
                target,
                attemptID: "mcp_auth_dynamic",
                state: "dynamic-state",
                redirectUrl: "https://client.example/callback",
                config: {},
                now: () => 2,
                onRedirect: async () => {
                  redirected = true
                },
              })
              expect(yield* Effect.promise(() => auth(provider, { serverUrl: target.endpoint }))).toBe("REDIRECT")
              expect(redirected).toBe(true)
              expect(fixture.registrations).toBe(1)
              expect((yield* store.get(target)).client?.client_id).toBe("registered-1")
            }),
          ),
        ),
      ),
    ),
  )

  it.live("falls back from OAuth metadata to OIDC discovery", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            let oidc = 0
            const server = Bun.serve({
              hostname: "127.0.0.1",
              port: 0,
              fetch: (request) => {
                const url = new URL(request.url)
                if (url.pathname === "/.well-known/oauth-protected-resource/mcp")
                  return Response.json({ resource: `${url.origin}/mcp`, authorization_servers: [url.origin] })
                if (url.pathname === "/.well-known/oauth-authorization-server")
                  return new Response("missing", { status: 404 })
                if (url.pathname === "/.well-known/openid-configuration") {
                  oidc++
                  return Response.json({
                    issuer: url.origin,
                    authorization_endpoint: `${url.origin}/authorize`,
                    token_endpoint: `${url.origin}/token`,
                    jwks_uri: `${url.origin}/jwks`,
                    response_types_supported: ["code"],
                    subject_types_supported: ["public"],
                    id_token_signing_alg_values_supported: ["RS256"],
                    code_challenge_methods_supported: ["S256"],
                  })
                }
                return new Response("missing", { status: 404 })
              },
            })
            return { server, oidc: () => oidc }
          }),
          (fixture) => Effect.sync(() => fixture.server.stop(true)),
        ).pipe(
          Effect.flatMap((fixture) =>
            Effect.gen(function* () {
              const store = MCPOAuthStore.make({ data: tmp.path })
              const target = { directory: tmp.path, name: "oidc", endpoint: `${fixture.server.url}mcp` }
              yield* store.update(target, () => ({
                attempts: {
                  mcp_auth_oidc: {
                    state: "oidc-state",
                    mode: "manual",
                    redirect: "https://client.example/callback",
                    created: 1,
                    expires: Date.now() + 60_000,
                    phase: "initializing",
                  },
                },
              }))
              const provider = MCPOAuthProvider.make({
                store,
                target,
                attemptID: "mcp_auth_oidc",
                state: "oidc-state",
                redirectUrl: "https://client.example/callback",
                config: { client_id: "static" },
                onRedirect: async () => {},
              })
              expect(yield* Effect.promise(() => auth(provider, { serverUrl: target.endpoint }))).toBe("REDIRECT")
              expect(fixture.oidc()).toBe(1)
              expect((yield* store.get(target)).discovery?.authorizationServerMetadata).toMatchObject({
                jwks_uri: `${fixture.server.url}jwks`,
              })
            }),
          ),
        ),
      ),
    ),
  )

  it.live("cancels incompatible attempts and all owned manual attempts on shutdown", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.acquireRelease(Effect.sync(protocol), (fixture) => Effect.sync(() => fixture.stop())).pipe(
          Effect.flatMap((fixture) =>
            Effect.gen(function* () {
              const store = MCPOAuthStore.make({ data: tmp.path })
              const target = { directory: tmp.path, name: "lifecycle", endpoint: `${fixture.url}/mcp` }
              let first = ""
              let second = ""
              yield* Effect.scoped(
                Effect.gen(function* () {
                  const context = yield* Layer.build(
                    MCPOAuth.layer.pipe(
                      Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                      Layer.provide(MCPOAuthCallback.layer),
                    ),
                  )
                  const oauth = Context.get(context, MCPOAuth.Service)
                  const one = yield* oauth.begin({
                    target,
                    config: { client_id: "static-client", scope: "one", redirect_uri: "https://client.example/one" },
                    mode: "manual",
                  })
                  if (one.status !== "authorizing") throw new Error("first authorization did not start")
                  first = one.attemptID
                  const two = yield* oauth.begin({
                    target,
                    config: { client_id: "static-client", scope: "two", redirect_uri: "https://client.example/two" },
                    mode: "manual",
                  })
                  if (two.status !== "authorizing") throw new Error("second authorization did not start")
                  second = two.attemptID
                  expect((yield* store.findAttempt(first))?.attempt.phase).toBe("cancelled")
                }),
              )
              expect((yield* store.findAttempt(second))?.attempt.phase).toBe("cancelled")
              expect((yield* store.findAttempt(second))?.attempt.state).toBeUndefined()
            }),
          ),
        ),
      ),
    ),
  )

  it.live("awaits OAuth cancellation before callback port reuse", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.acquireRelease(Effect.sync(protocol), (fixture) => Effect.sync(() => fixture.stop())).pipe(
          Effect.flatMap((fixture) =>
            Effect.scoped(
              Effect.gen(function* () {
                const reserve = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
                const port = reserve.port
                reserve.stop(true)
                const store = MCPOAuthStore.make({ data: tmp.path })
                const context = yield* Layer.build(
                  MCPOAuth.layer.pipe(
                    Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                    Layer.provide(MCPOAuthCallback.layer),
                  ),
                )
                const started = yield* Context.get(context, MCPOAuth.Service).begin({
                  target: { directory: tmp.path, name: "reuse", endpoint: `${fixture.url}/mcp` },
                  config: { client_id: "static-client", callback_port: port },
                })
                if (started.status !== "authorizing") throw new Error("authorization did not start")
                yield* Context.get(context, MCPOAuth.Service).cancel(started.attemptID)
                const reused = Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response() })
                expect(reused.port).toBe(port)
                reused.stop(true)
              }),
            ),
          ),
        ),
      ),
    ),
  )

  it.live("releases the callback port after a failed automatic exchange", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.acquireRelease(Effect.sync(protocol), (fixture) => Effect.sync(() => fixture.stop())).pipe(
          Effect.flatMap((fixture) =>
            Effect.scoped(
              Effect.gen(function* () {
                const reserve = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
                const port = reserve.port
                reserve.stop(true)
                fixture.failToken = true
                const store = MCPOAuthStore.make({ data: tmp.path })
                const context = yield* Layer.build(
                  MCPOAuth.layer.pipe(
                    Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                    Layer.provide(MCPOAuthCallback.layer),
                  ),
                )
                const oauth = Context.get(context, MCPOAuth.Service)
                const changes: Array<{ status: "failed"; code: string }> = []
                const events: Array<{ type: string; data: unknown }> = []
                yield* oauth.onChange((target, status) => {
                  changes.push(status)
                  events.push({ type: MCP.Event.AuthChanged.type, data: { server: target.name, status } })
                })
                const started = yield* oauth.begin({
                  target: { directory: tmp.path, name: "failed-auto", endpoint: `${fixture.url}/mcp` },
                  config: { client_id: "static-client", callback_port: port },
                })
                if (started.status !== "authorizing") throw new Error("authorization did not start")
                const authorization = new URL(started.authorizationUrl)
                fixture.challenge = authorization.searchParams.get("code_challenge")!
                expect(
                  (yield* Effect.promise(() =>
                    fetch(
                      `http://127.0.0.1:${port}/mcp/oauth/callback?state=${authorization.searchParams.get("state")}&code=bad`,
                    ),
                  )).status,
                ).toBe(400)
                yield* Effect.sleep("20 millis")
                expect((yield* store.findAttempt(started.attemptID))?.attempt).toMatchObject({
                  phase: "failed",
                  error: "exchange",
                })
                expect(changes).toEqual([{ status: "failed", code: "exchange" }])
                expect(events).toEqual([
                  {
                    type: "mcp.auth.changed",
                    data: { server: "failed-auto", status: { status: "failed", code: "exchange" } },
                  },
                ])
                expect(JSON.stringify(events)).not.toContain("bad")
                expect(JSON.stringify(events)).not.toContain("authorize")
                yield* oauth.status({ directory: tmp.path, name: "failed-auto", endpoint: `${fixture.url}/mcp` })
                expect(changes).toHaveLength(1)
                const reused = Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response() })
                expect(reused.port).toBe(port)
                reused.stop(true)
              }),
            ),
          ),
        ),
      ),
    ),
  )

  it.live("releases a recovered callback registration after exchange failure", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.acquireRelease(Effect.sync(protocol), (fixture) => Effect.sync(() => fixture.stop())).pipe(
          Effect.flatMap((fixture) =>
            Effect.scoped(
              Effect.gen(function* () {
                const reserve = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
                const port = reserve.port
                reserve.stop(true)
                fixture.failToken = true
                const target = { directory: tmp.path, name: "recovered-failure", endpoint: `${fixture.url}/mcp` }
                const store = MCPOAuthStore.make({ data: tmp.path })
                yield* store.update(target, () => ({
                  compatibility: MCPOAuthProvider.compatibility(
                    target.endpoint,
                    { client_id: "static-client" },
                    `http://127.0.0.1:${port}/mcp/oauth/callback`,
                  ),
                  attempts: {
                    recovered: {
                      state: "recovered-state",
                      verifier: "recovered-verifier",
                      authorization: `${fixture.url}/authorize`,
                      mode: "auto",
                      redirect: `http://127.0.0.1:${port}/mcp/oauth/callback`,
                      created: 1,
                      expires: Date.now() + 60_000,
                      phase: "pending",
                    },
                  },
                }))
                const context = yield* Layer.build(
                  MCPOAuth.layer.pipe(
                    Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                    Layer.provide(MCPOAuthCallback.layer),
                  ),
                )
                const oauth = Context.get(context, MCPOAuth.Service)
                const changes: Array<{ status: "failed"; code: string }> = []
                yield* oauth.onChange((_target, status) => changes.push(status))
                yield* oauth.recover({ target, config: { client_id: "static-client", callback_port: port } })
                expect(
                  (yield* Effect.promise(() =>
                    fetch(`http://127.0.0.1:${port}/mcp/oauth/callback?state=recovered-state&code=bad`),
                  )).status,
                ).toBe(400)
                yield* Effect.sleep("20 millis")
                expect((yield* store.findAttempt("recovered"))?.attempt).toMatchObject({
                  phase: "failed",
                  error: "exchange",
                })
                expect(changes).toEqual([{ status: "failed", code: "exchange" }])
                const reused = Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response() })
                expect(reused.port).toBe(port)
                reused.stop(true)
              }),
            ),
          ),
        ),
      ),
    ),
  )

  it.live("rejects incompatible recovery before listener or exchange setup", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.acquireRelease(Effect.sync(protocol), (fixture) => Effect.sync(() => fixture.stop())).pipe(
          Effect.flatMap((fixture) =>
            Effect.scoped(
              Effect.gen(function* () {
                const reserve = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
                const port = reserve.port
                reserve.stop(true)
                const target = { directory: tmp.path, name: "changed", endpoint: `${fixture.url}/mcp` }
                const redirect = `http://127.0.0.1:${port}/mcp/oauth/callback`
                const store = MCPOAuthStore.make({ data: tmp.path })
                yield* store.update(target, () => ({
                  compatibility: MCPOAuthProvider.compatibility(
                    target.endpoint,
                    { client_id: "old", scope: "old" },
                    redirect,
                  ),
                  attempts: {
                    changed: {
                      state: "private-state",
                      verifier: "private-verifier",
                      authorization: `${fixture.url}/authorize`,
                      mode: "auto",
                      redirect,
                      created: 1,
                      expires: Date.now() + 60_000,
                      phase: "pending",
                    },
                  },
                }))
                const context = yield* Layer.build(
                  MCPOAuth.layer.pipe(
                    Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                    Layer.provide(MCPOAuthCallback.layer),
                  ),
                )
                yield* Context.get(context, MCPOAuth.Service).recover({
                  target,
                  config: { client_id: "new", scope: "new" },
                })
                expect((yield* store.findAttempt("changed"))?.attempt.phase).toBe("cancelled")
                expect(JSON.stringify(yield* store.get(target))).not.toContain("private")
                expect(fixture.grants).toHaveLength(0)
                const reused = Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response() })
                expect(reused.port).toBe(port)
                reused.stop(true)
              }),
            ),
          ),
        ),
      ),
    ),
  )

  it.live("closes every atomically cancelled sibling without touching another target", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.acquireRelease(Effect.sync(protocol), (fixture) => Effect.sync(() => fixture.stop())).pipe(
          Effect.flatMap((fixture) =>
            Effect.scoped(
              Effect.gen(function* () {
                const reserve = () => {
                  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
                  const port = server.port
                  server.stop(true)
                  return port
                }
                const port = reserve()
                const otherPort = reserve()
                const store = MCPOAuthStore.make({ data: tmp.path })
                const service = () =>
                  MCPOAuth.layerWith({ maxAge: 2_000, observeInterval: 10 }).pipe(
                    Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                    Layer.provide(MCPOAuthCallback.layer),
                  )
                const firstService = Context.get(yield* Layer.build(service()), MCPOAuth.Service)
                const secondService = Context.get(yield* Layer.build(service()), MCPOAuth.Service)
                const target = { directory: tmp.path, name: "siblings", endpoint: `${fixture.url}/mcp` }
                const config = { client_id: "static-client", callback_port: port }
                const first = yield* firstService.begin({ target, config })
                const second = yield* secondService.begin({ target, config })
                const otherTarget = { directory: tmp.path, name: "unrelated", endpoint: `${fixture.url}/mcp` }
                const other = yield* firstService.begin({
                  target: otherTarget,
                  config: { ...config, callback_port: otherPort },
                })
                if (first.status !== "authorizing" || second.status !== "authorizing" || other.status !== "authorizing")
                  throw new Error("authorization did not start")
                const authorization = new URL(second.authorizationUrl)
                fixture.challenge = authorization.searchParams.get("code_challenge")!
                expect(
                  (yield* Effect.promise(() =>
                    fetch(
                      `http://127.0.0.1:${port}/mcp/oauth/callback?state=${authorization.searchParams.get("state")}&code=authorization-code`,
                    ),
                  )).status,
                ).toBe(200)
                expect((yield* store.findAttempt(second.attemptID))?.attempt.phase).toBe("complete")
                expect((yield* store.findAttempt(first.attemptID))?.attempt.phase).toBe("cancelled")
                expect((yield* store.findAttempt(other.attemptID))?.attempt.phase).toBe("pending")
                const reused = yield* Effect.promise(async () => {
                  for (const deadline = Date.now() + 1000; ; ) {
                    try {
                      return Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response() })
                    } catch (error) {
                      if (Date.now() >= deadline) throw error
                      await Bun.sleep(10)
                    }
                  }
                })
                expect(reused.port).toBe(port)
                reused.stop(true)
                expect(
                  yield* Effect.promise(() =>
                    fetch(
                      `http://127.0.0.1:${port}/mcp/oauth/callback?state=${new URL(first.authorizationUrl).searchParams.get("state")}&code=replay`,
                    ).then(
                      () => false,
                      () => true,
                    ),
                  ),
                ).toBe(true)
                yield* Effect.sleep("2100 millis")
                expect((yield* store.findAttempt(first.attemptID))?.attempt.phase).toBe("cancelled")
                expect((yield* store.findAttempt(other.attemptID))?.attempt.phase).toBe("expired")
              }),
            ),
          ),
        ),
      ),
    ),
  )

  it.live("expires a recovered automatic attempt without status activity", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.scoped(
          Effect.gen(function* () {
            const reserve = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
            const port = reserve.port
            reserve.stop(true)
            const target = { directory: tmp.path, name: "timer", endpoint: "https://example.com/mcp" }
            const store = MCPOAuthStore.make({ data: tmp.path })
            yield* store.update(target, () => ({
              compatibility: MCPOAuthProvider.compatibility(
                target.endpoint,
                { client_id: "static" },
                `http://127.0.0.1:${port}/mcp/oauth/callback`,
              ),
              attempts: {
                timer: {
                  state: "timer-state",
                  verifier: "timer-verifier",
                  authorization: "https://auth.example/authorize",
                  mode: "auto",
                  redirect: `http://127.0.0.1:${port}/mcp/oauth/callback`,
                  created: Date.now(),
                  expires: Date.now() + 80,
                  phase: "pending",
                },
              },
            }))
            const context = yield* Layer.build(
              MCPOAuth.layer.pipe(
                Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                Layer.provide(MCPOAuthCallback.layer),
              ),
            )
            const oauth = Context.get(context, MCPOAuth.Service)
            const changes: Array<{ status: "failed"; code: string }> = []
            yield* oauth.onChange((_target, status) => changes.push(status))
            yield* oauth.recover({ target, config: { client_id: "static", callback_port: port } })
            yield* Effect.sleep("150 millis")
            expect((yield* store.findAttempt("timer"))?.attempt).toMatchObject({
              phase: "expired",
              error: "attempt-expired",
            })
            expect(changes).toEqual([{ status: "failed", code: "attempt-expired" }])
            expect(JSON.stringify(yield* store.get(target))).not.toContain("timer-state")
            const reused = Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response() })
            expect(reused.port).toBe(port)
            reused.stop(true)
          }),
        ),
      ),
    ),
  )

  it.live("expires a fresh automatic attempt without callback activity", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.acquireRelease(Effect.sync(protocol), (fixture) => Effect.sync(() => fixture.stop())).pipe(
          Effect.flatMap((fixture) =>
            Effect.scoped(
              Effect.gen(function* () {
                const reserve = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
                const port = reserve.port
                reserve.stop(true)
                const target = { directory: tmp.path, name: "fresh-timer", endpoint: `${fixture.url}/mcp` }
                const store = MCPOAuthStore.make({ data: tmp.path })
                const context = yield* Layer.build(
                  MCPOAuth.layerWith({ maxAge: 1_000 }).pipe(
                    Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                    Layer.provide(MCPOAuthCallback.layer),
                  ),
                )
                const oauth = Context.get(context, MCPOAuth.Service)
                const changes: Array<{ status: "failed"; code: string }> = []
                yield* oauth.onChange((_target, status) => changes.push(status))
                const started = yield* oauth.begin({
                  target,
                  config: { client_id: "static-client", callback_port: port },
                })
                if (started.status !== "authorizing") throw new Error("authorization did not start")
                yield* Effect.sleep("1200 millis")
                expect((yield* store.findAttempt(started.attemptID))?.attempt).toMatchObject({
                  phase: "expired",
                  error: "attempt-expired",
                })
                expect(changes).toEqual([{ status: "failed", code: "attempt-expired" }])
                const reused = Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response() })
                expect(reused.port).toBe(port)
                reused.stop(true)
              }),
            ),
          ),
        ),
      ),
    ),
  )

  it.live("aborts a callback exchange and releases its port on Location shutdown", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.acquireRelease(Effect.sync(protocol), (fixture) => Effect.sync(() => fixture.stop())).pipe(
          Effect.flatMap((fixture) =>
            Effect.gen(function* () {
              const reserve = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
              const port = reserve.port
              reserve.stop(true)
              fixture.hangToken = true
              const store = MCPOAuthStore.make({ data: tmp.path })
              const target = { directory: tmp.path, name: "shutdown-exchange", endpoint: `${fixture.url}/mcp` }
              const scope = yield* Scope.make()
              const context = yield* Layer.buildWithScope(
                MCPOAuth.layer.pipe(
                  Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                  Layer.provide(MCPOAuthCallback.layer),
                ),
                scope,
              )
              const started = yield* Context.get(context, MCPOAuth.Service).begin({
                target,
                config: { client_id: "static-client", callback_port: port },
              })
              if (started.status !== "authorizing") throw new Error("authorization did not start")
              const authorization = new URL(started.authorizationUrl)
              fixture.challenge = authorization.searchParams.get("code_challenge")!
              const callback = fetch(
                `http://127.0.0.1:${port}/mcp/oauth/callback?state=${authorization.searchParams.get("state")}&code=hang`,
              )
              yield* Effect.promise(() => fixture.tokenStarted)
              yield* Scope.close(scope, Exit.void)
              expect((yield* Effect.promise(() => callback)).status).toBe(400)
              expect((yield* store.findAttempt(started.attemptID))?.attempt).toMatchObject({
                phase: "failed",
                error: "exchange",
              })
              const reused = Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response() })
              expect(reused.port).toBe(port)
              reused.stop(true)
            }),
          ),
        ),
      ),
    ),
  )

  it.live("aborts active callback exchange before remove reset and stop complete", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.forEach(
          ["remove", "reset", "stop"] as const,
          (action, index) =>
            Effect.acquireRelease(Effect.sync(protocol), (fixture) => Effect.sync(() => fixture.stop())).pipe(
              Effect.flatMap((fixture) =>
                Effect.scoped(
                  Effect.gen(function* () {
                    const reserve = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
                    const port = reserve.port
                    reserve.stop(true)
                    fixture.hangToken = true
                    const store = MCPOAuthStore.make({ data: tmp.path })
                    const target = { directory: tmp.path, name: `teardown-${index}`, endpoint: `${fixture.url}/mcp` }
                    const context = yield* Layer.build(
                      MCPOAuth.layer.pipe(
                        Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                        Layer.provide(MCPOAuthCallback.layer),
                      ),
                    )
                    const oauth = Context.get(context, MCPOAuth.Service)
                    const started = yield* oauth.begin({
                      target,
                      config: { client_id: "static-client", callback_port: port },
                    })
                    if (started.status !== "authorizing") throw new Error("authorization did not start")
                    const authorization = new URL(started.authorizationUrl)
                    fixture.challenge = authorization.searchParams.get("code_challenge")!
                    const callback = fetch(
                      `http://127.0.0.1:${port}/mcp/oauth/callback?state=${authorization.searchParams.get("state")}&code=hang`,
                    )
                    yield* Effect.promise(() => fixture.tokenStarted)
                    yield* oauth[action](target)
                    expect((yield* Effect.promise(() => callback)).status).toBe(400)
                    if (action !== "remove")
                      expect((yield* store.findAttempt(started.attemptID))?.attempt).toMatchObject({
                        phase: "failed",
                        error: "exchange",
                      })
                    const reused = Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response() })
                    expect(reused.port).toBe(port)
                    reused.stop(true)
                  }),
                ),
              ),
            ),
          { discard: true },
        ),
      ),
    ),
  )

  it.live("returns expired failure on the first status call and emits one safe change", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.scoped(
          Effect.gen(function* () {
            const store = MCPOAuthStore.make({ data: tmp.path })
            const target = { directory: tmp.path, name: "expired", endpoint: "https://example.com/mcp" }
            yield* store.update(target, () => ({
              attempts: {
                expired: {
                  state: "secret-state",
                  verifier: "secret-verifier",
                  authorization: "https://auth.example/authorize?secret=value",
                  mode: "manual",
                  redirect: "https://client.example/callback",
                  created: 1,
                  expires: 2,
                  phase: "pending",
                },
              },
            }))
            const context = yield* Layer.build(
              MCPOAuth.layer.pipe(
                Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
                Layer.provide(MCPOAuthCallback.layer),
              ),
            )
            const oauth = Context.get(context, MCPOAuth.Service)
            const changes: MCPOAuthStore.Target[] = []
            yield* oauth.onChange((value) => changes.push(value))
            expect(yield* oauth.status(target)).toEqual({ status: "failed", code: "attempt-expired" })
            expect(changes).toEqual([target])
            expect(JSON.stringify(yield* store.get(target))).not.toContain("secret")
            expect(yield* oauth.status(target)).toEqual({ status: "failed", code: "attempt-expired" })
            expect(changes).toHaveLength(1)
          }),
        ),
      ),
    ),
  )

  it.live("issues exactly one SDK token request for cross-process sibling completions", () =>
    Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
      Effect.flatMap((tmp) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            let tokens = 0
            const server = Bun.serve({
              hostname: "127.0.0.1",
              port: 0,
              fetch: (request) => {
                const url = new URL(request.url)
                if (url.pathname === "/.well-known/oauth-protected-resource/mcp")
                  return Response.json({ resource: `${url.origin}/mcp`, authorization_servers: [url.origin] })
                if (url.pathname === "/.well-known/oauth-authorization-server")
                  return Response.json({
                    issuer: url.origin,
                    authorization_endpoint: `${url.origin}/authorize`,
                    token_endpoint: `${url.origin}/token`,
                    response_types_supported: ["code"],
                    code_challenge_methods_supported: ["S256"],
                  })
                if (url.pathname === "/token") {
                  tokens++
                  return Response.json({ access_token: "winner", token_type: "Bearer" })
                }
                return new Response("missing", { status: 404 })
              },
            })
            return { server, tokens: () => tokens }
          }),
          (fixture) => Effect.sync(() => fixture.server.stop(true)),
        ).pipe(
          Effect.flatMap((fixture) =>
            Effect.gen(function* () {
              const endpoint = `${fixture.server.url}mcp`
              const store = MCPOAuthStore.make({ data: tmp.path })
              const attempt = (id: string): MCPOAuthStore.Attempt => ({
                state: `${id}-state`,
                verifier: `${id}-verifier`,
                mode: "manual",
                redirect: "https://client.example/callback",
                authorization: "https://auth.example/authorize",
                created: Date.now(),
                expires: Date.now() + 60_000,
                phase: "pending",
              })
              yield* store.update({ directory: "/workspace", name: "process", endpoint }, () => ({
                attempts: { one: attempt("one"), two: attempt("two") },
              }))
              const worker = `${import.meta.dir}/fixture/mcp-oauth-complete-worker.ts`
              const results = yield* Effect.promise(() =>
                Promise.all(
                  ["one", "two"].map(async (id) => {
                    const child = Bun.spawn(["bun", worker, tmp.path, endpoint, id, `${id}-state`, `${id}-code`], {
                      cwd: `${import.meta.dir}/..`,
                      stdout: "pipe",
                    })
                    const output = await new Response(child.stdout).text()
                    expect(await child.exited).toBe(0)
                    return output
                  }),
                ),
              )
              expect(results.toSorted()).toEqual(["lost", "won"])
              expect(fixture.tokens()).toBe(1)
            }),
          ),
        ),
      ),
    ),
  )
})

function protocol() {
  const grants: string[] = []
  const token = Promise.withResolvers<void>()
  const fixture = {
    challenge: "",
    discovery: 0,
    grants,
    registrations: 0,
    failToken: false,
    hangToken: false,
    tokenStarted: token.promise,
    url: "",
    stop: () => {},
  }
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      const url = new URL(request.url)
      const origin = url.origin
      if (url.pathname === "/.well-known/oauth-protected-resource/mcp") {
        fixture.discovery++
        return Response.json({
          resource: `${origin}/mcp`,
          authorization_servers: [origin],
          scopes_supported: ["resource-scope"],
        })
      }
      if (url.pathname === "/.well-known/oauth-authorization-server")
        return Response.json({
          issuer: origin,
          authorization_endpoint: `${origin}/authorize`,
          token_endpoint: `${origin}/token`,
          registration_endpoint: `${origin}/register`,
          response_types_supported: ["code"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none"],
        })
      if (url.pathname === "/register") {
        fixture.registrations++
        const metadata = await request.json()
        return Response.json({
          ...metadata,
          client_id: `registered-${fixture.registrations}`,
          client_secret_expires_at: 0,
        })
      }
      if (url.pathname === "/token") {
        if (fixture.hangToken) {
          token.resolve()
          return new Promise<Response>(() => {})
        }
        if (fixture.failToken) return Response.json({ error: "invalid_grant" }, { status: 400 })
        const form = await request.formData()
        const grant = String(form.get("grant_type"))
        grants.push(grant)
        if (grant === "authorization_code") {
          const verifier = String(form.get("code_verifier"))
          const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
          const challenge = Buffer.from(digest).toString("base64url")
          if (challenge !== fixture.challenge || form.get("code") !== "authorization-code")
            return Response.json({ error: "invalid_grant" }, { status: 400 })
          return Response.json({
            access_token: "access-one",
            refresh_token: "refresh-one",
            token_type: "Bearer",
            expires_in: 1,
            scope: "resource-scope",
          })
        }
        return Response.json({ access_token: "access-two", token_type: "Bearer" })
      }
      return new Response("not found", { status: 404 })
    },
  })
  fixture.url = server.url.origin.replace(/\/$/, "")
  fixture.stop = () => server.stop(true)
  return fixture
}
