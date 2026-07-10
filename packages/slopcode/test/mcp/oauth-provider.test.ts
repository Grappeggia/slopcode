import { test, expect, describe } from "bun:test"
import path from "node:path"
import { Effect, Layer } from "effect"
import { EffectFlock } from "@slopcode-ai/core/util/effect-flock"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { Global } from "@slopcode-ai/core/global"
import { McpOAuthProvider, OAUTH_CALLBACK_PORT, OAUTH_CALLBACK_PATH } from "../../src/mcp/oauth-provider"
import { McpAuth } from "../../src/mcp/auth"
import { tmpdir } from "../fixture/fixture"

// Stub auth — only synchronous getters are exercised in these tests
const stubAuth = {} as McpAuth.Interface
const identity = { instance: "/projects/provider", name: "test-server" }

const makeProvider = (config: ConstructorParameters<typeof McpOAuthProvider>[2]) =>
  new McpOAuthProvider(identity, "https://mcp.example.com/mcp", config, { onRedirect: async () => {} }, stubAuth)

function authLayer(root: string) {
  const fs = FSUtil.defaultLayer
  const global = Global.layerWith({ data: root, state: path.join(root, "state") })
  const flock = EffectFlock.layer.pipe(Layer.provide(Layer.mergeAll(fs, global)))
  return Layer.fresh(McpAuth.layer.pipe(Layer.provide(flock), Layer.provide(Layer.mergeAll(fs, global))))
}

function authService(root: string) {
  return McpAuth.Service.use((auth) => Effect.succeed(auth)).pipe(Effect.provide(authLayer(root)))
}

describe("McpOAuthProvider.redirectUrl", () => {
  test("defaults to 127.0.0.1:19876/mcp/oauth/callback", () => {
    const provider = makeProvider({})
    expect(provider.redirectUrl).toBe(`http://127.0.0.1:${OAUTH_CALLBACK_PORT}${OAUTH_CALLBACK_PATH}`)
  })

  test("uses callbackPort when set", () => {
    const provider = makeProvider({ callbackPort: 6620 })
    expect(provider.redirectUrl).toBe(`http://127.0.0.1:6620${OAUTH_CALLBACK_PATH}`)
  })

  test("redirectUri takes precedence over callbackPort", () => {
    const provider = makeProvider({
      callbackPort: 6620,
      redirectUri: "http://127.0.0.1:9999/custom/callback",
    })
    expect(provider.redirectUrl).toBe("http://127.0.0.1:9999/custom/callback")
  })

  test("uses explicit redirectUri when set without callbackPort", () => {
    const provider = makeProvider({ redirectUri: "http://127.0.0.1:8080/oauth/callback" })
    expect(provider.redirectUrl).toBe("http://127.0.0.1:8080/oauth/callback")
  })
})

describe("McpOAuthProvider.clientMetadata", () => {
  test("includes redirect_uris from redirectUrl", () => {
    const provider = makeProvider({ callbackPort: 6620 })
    expect(provider.clientMetadata.redirect_uris).toEqual([`http://127.0.0.1:6620${OAUTH_CALLBACK_PATH}`])
  })

  test("includes scope when set in config", () => {
    const provider = makeProvider({ scope: "openid offline_access" })
    expect(provider.clientMetadata.scope).toBe("openid offline_access")
  })

  test("omits scope when not set in config", () => {
    const provider = makeProvider({})
    expect(provider.clientMetadata.scope).toBeUndefined()
  })

  test("sets token_endpoint_auth_method to client_secret_post when clientSecret provided", () => {
    const provider = makeProvider({ clientSecret: "secret" })
    expect(provider.clientMetadata.token_endpoint_auth_method).toBe("client_secret_post")
  })

  test("sets token_endpoint_auth_method to none when no clientSecret", () => {
    const provider = makeProvider({})
    expect(provider.clientMetadata.token_endpoint_auth_method).toBe("none")
  })
})

describe("McpOAuthProvider credential isolation", () => {
  test("preserves configured static client credentials", async () => {
    const provider = makeProvider({ clientId: "configured-client", clientSecret: "configured-secret" })
    expect(await provider.clientInformation()).toEqual({
      client_id: "configured-client",
      client_secret: "configured-secret",
    })
  })

  test("does not expose one URL's tokens, client secret, verifier, or state to another", async () => {
    await using tmp = await tmpdir()
    const auth = await Effect.runPromise(authService(tmp.path))
    const first = new McpOAuthProvider(identity, "https://a.example.com/mcp", {}, { onRedirect: async () => {} }, auth)
    const second = new McpOAuthProvider(identity, "https://b.example.com/mcp", {}, { onRedirect: async () => {} }, auth)

    await first.saveClientInformation({
      client_id: "client-a",
      client_secret: "secret-a",
      redirect_uris: [first.redirectUrl],
    })
    await first.saveTokens({ access_token: "access-a", token_type: "Bearer", refresh_token: "refresh-a" })
    await first.saveCodeVerifier("verifier-a")
    await first.saveState("state-a")

    expect(await second.clientInformation()).toBeUndefined()
    expect(await second.tokens()).toBeUndefined()
    await expect(second.codeVerifier()).rejects.toThrow("No code verifier")
    const stateB = await second.state()
    expect(stateB).not.toBe("state-a")

    await second.saveClientInformation({
      client_id: "client-b",
      client_secret: "secret-b",
      redirect_uris: [second.redirectUrl],
    })
    await second.saveTokens({ access_token: "access-b", token_type: "Bearer", refresh_token: "refresh-b" })
    await second.saveCodeVerifier("verifier-b")

    expect(await first.clientInformation()).toEqual({ client_id: "client-a", client_secret: "secret-a" })
    expect(await first.tokens()).toMatchObject({ access_token: "access-a", refresh_token: "refresh-a" })
    expect(await first.codeVerifier()).toBe("verifier-a")
    expect(await first.state()).toBe("state-a")
    expect(await second.clientInformation()).toEqual({ client_id: "client-b", client_secret: "secret-b" })
    expect(await second.tokens()).toMatchObject({ access_token: "access-b", refresh_token: "refresh-b" })
    expect(await second.codeVerifier()).toBe("verifier-b")
    expect(await second.state()).toBe(stateB)
  })

  test("refreshes one URL without dropping its refresh token or changing another URL", async () => {
    await using tmp = await tmpdir()
    const auth = await Effect.runPromise(authService(tmp.path))
    const first = new McpOAuthProvider(identity, "https://a.example.com/mcp", {}, { onRedirect: async () => {} }, auth)
    const second = new McpOAuthProvider(identity, "https://b.example.com/mcp", {}, { onRedirect: async () => {} }, auth)

    await first.saveTokens({ access_token: "old-a", token_type: "Bearer", refresh_token: "refresh-a", expires_in: 1 })
    await second.saveTokens({ access_token: "access-b", token_type: "Bearer", refresh_token: "refresh-b" })
    await first.saveTokens({ access_token: "new-a", token_type: "Bearer", expires_in: 3600 })

    expect(await first.tokens()).toMatchObject({ access_token: "new-a", refresh_token: "refresh-a" })
    expect(await second.tokens()).toMatchObject({ access_token: "access-b", refresh_token: "refresh-b" })
    expect(await Effect.runPromise(auth.isTokenExpired(identity, "https://a.example.com/mcp"))).toBe(false)
  })
})
