import { describe, expect, test } from "bun:test"
import { ConfigMCP } from "@slopcode-ai/core/config/mcp"
import { MCPClient } from "@slopcode-ai/core/mcp/client"
import { MCPOAuthProvider } from "@slopcode-ai/core/mcp/oauth-provider"
import { MCPOAuthStore } from "@slopcode-ai/core/mcp/oauth-store"
import { MCPOAuth } from "@slopcode-ai/core/mcp/oauth"
import { MCPOAuthCallback } from "@slopcode-ai/core/mcp/oauth-callback"
import { auth } from "@modelcontextprotocol/sdk/client/auth.js"
import { Context, Effect, Layer, Schema } from "effect"
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
    ])
      expect(() => decode({ type: "remote", url: "https://example.com/mcp", oauth })).toThrow()
  })

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
                ).toEqual({ status: "connected" })
                expect(yield* oauth.status(target)).toEqual({ status: "connected" })
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
})

function protocol() {
  const grants: string[] = []
  const fixture = {
    challenge: "",
    discovery: 0,
    grants,
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
          response_types_supported: ["code"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none"],
        })
      if (url.pathname === "/token") {
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
