import { describe, expect, test } from "bun:test"
import { stat } from "node:fs/promises"
import path from "node:path"
import { Effect, Layer } from "effect"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { Global } from "@slopcode-ai/core/global"
import { EffectFlock } from "@slopcode-ai/core/util/effect-flock"
import { McpAuth } from "../../src/mcp/auth"
import { tmpdir } from "../fixture/fixture"

const alpha = { instance: "/projects/alpha", name: "shared" }
const beta = { instance: "/projects/beta", name: "shared" }
const urlA = "https://a.example.com/mcp"
const urlB = "https://b.example.com/mcp"

function layer(root: string) {
  const fs = FSUtil.defaultLayer
  const global = Global.layerWith({ data: root, state: path.join(root, "state") })
  const flock = EffectFlock.layer.pipe(Layer.provide(Layer.mergeAll(fs, global)))
  return Layer.fresh(McpAuth.layer.pipe(Layer.provide(flock), Layer.provide(Layer.mergeAll(fs, global))))
}

function service(root: string) {
  return McpAuth.Service.use((auth) => Effect.succeed(auth)).pipe(Effect.provide(layer(root)))
}

describe("McpAuth credential isolation", () => {
  test("keeps same-name URL credentials and OAuth flow fields isolated", async () => {
    await using tmp = await tmpdir()
    const auth = await Effect.runPromise(service(tmp.path))

    await Effect.runPromise(
      Effect.all([
        auth.updateTokens(alpha, urlA, { accessToken: "access-a", refreshToken: "refresh-a" }),
        auth.updateClientInfo(alpha, urlA, { clientId: "client-a", clientSecret: "client-secret-a" }),
        auth.updateCodeVerifier(alpha, urlA, "verifier-a"),
        auth.updateOAuthState(alpha, urlA, "state-a"),
      ]),
    )

    await Effect.runPromise(
      auth.updateClientInfo(alpha, urlB, { clientId: "client-b", clientSecret: "client-secret-b" }),
    )
    const registered = await Effect.runPromise(auth.get(alpha, urlB))
    expect(registered).toEqual({ clientInfo: { clientId: "client-b", clientSecret: "client-secret-b" } })

    await Effect.runPromise(
      Effect.all([
        auth.updateTokens(alpha, urlB, { accessToken: "access-b", refreshToken: "refresh-b" }),
        auth.updateCodeVerifier(alpha, urlB, "verifier-b"),
        auth.updateOAuthState(alpha, urlB, "state-b"),
      ]),
    )

    expect(await Effect.runPromise(auth.get(alpha, urlA))).toEqual({
      tokens: { accessToken: "access-a", refreshToken: "refresh-a" },
      clientInfo: { clientId: "client-a", clientSecret: "client-secret-a" },
      codeVerifier: "verifier-a",
      oauthState: "state-a",
    })
    expect(await Effect.runPromise(auth.get(alpha, urlB))).toEqual({
      tokens: { accessToken: "access-b", refreshToken: "refresh-b" },
      clientInfo: { clientId: "client-b", clientSecret: "client-secret-b" },
      codeVerifier: "verifier-b",
      oauthState: "state-b",
    })
  })

  test("isolates the same name and URL across project instances", async () => {
    await using tmp = await tmpdir()
    const auth = await Effect.runPromise(service(tmp.path))

    await Effect.runPromise(
      Effect.all([
        auth.updateTokens(alpha, urlA, { accessToken: "alpha-access" }),
        auth.updateTokens(beta, urlA, { accessToken: "beta-access" }),
        auth.updateOAuthState(alpha, urlA, "alpha-state"),
        auth.updateOAuthState(beta, urlA, "beta-state"),
      ]),
    )

    expect((await Effect.runPromise(auth.get(alpha, urlA)))?.tokens?.accessToken).toBe("alpha-access")
    expect((await Effect.runPromise(auth.get(alpha, urlA)))?.oauthState).toBe("alpha-state")
    expect((await Effect.runPromise(auth.get(beta, urlA)))?.tokens?.accessToken).toBe("beta-access")
    expect((await Effect.runPromise(auth.get(beta, urlA)))?.oauthState).toBe("beta-state")
  })

  test("serializes concurrent interleaved URL updates across service instances", async () => {
    await using tmp = await tmpdir()
    const first = await Effect.runPromise(service(tmp.path))
    const second = await Effect.runPromise(service(tmp.path))

    await Effect.runPromise(
      Effect.all(
        [
          first.updateTokens(alpha, urlA, { accessToken: "access-a" }),
          second.updateClientInfo(alpha, urlA, { clientId: "client-a" }),
          second.updateTokens(alpha, urlB, { accessToken: "access-b" }),
          first.updateClientInfo(alpha, urlB, { clientId: "client-b" }),
          first.updateCodeVerifier(beta, urlA, "verifier-beta"),
          second.updateOAuthState(beta, urlA, "state-beta"),
        ],
        { concurrency: "unbounded" },
      ),
    )

    expect(await Effect.runPromise(first.get(alpha, urlA))).toEqual({
      tokens: { accessToken: "access-a" },
      clientInfo: { clientId: "client-a" },
    })
    expect(await Effect.runPromise(first.get(alpha, urlB))).toEqual({
      tokens: { accessToken: "access-b" },
      clientInfo: { clientId: "client-b" },
    })
    expect(await Effect.runPromise(first.get(beta, urlA))).toEqual({
      codeVerifier: "verifier-beta",
      oauthState: "state-beta",
    })
    const raw = await Bun.file(path.join(tmp.path, "mcp-auth.json")).text()
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  test("removes only the requested identity and URL", async () => {
    await using tmp = await tmpdir()
    const auth = await Effect.runPromise(service(tmp.path))

    await Effect.runPromise(
      Effect.all([
        auth.updateTokens(alpha, urlA, { accessToken: "access-a" }),
        auth.updateTokens(alpha, urlB, { accessToken: "access-b" }),
        auth.updateTokens(beta, urlA, { accessToken: "access-beta" }),
      ]),
    )
    await Effect.runPromise(auth.remove(alpha, urlA))

    expect(await Effect.runPromise(auth.get(alpha, urlA))).toBeUndefined()
    expect((await Effect.runPromise(auth.get(alpha, urlB)))?.tokens?.accessToken).toBe("access-b")
    expect((await Effect.runPromise(auth.get(beta, urlA)))?.tokens?.accessToken).toBe("access-beta")
  })

  test("checks token expiry only for the requested identity and URL", async () => {
    await using tmp = await tmpdir()
    const auth = await Effect.runPromise(service(tmp.path))

    await Effect.runPromise(
      Effect.all([
        auth.updateTokens(alpha, urlA, { accessToken: "expired", expiresAt: 0 }),
        auth.updateTokens(alpha, urlB, { accessToken: "unbounded" }),
      ]),
    )

    expect(await Effect.runPromise(auth.isTokenExpired(alpha, urlA))).toBe(true)
    expect(await Effect.runPromise(auth.isTokenExpired(alpha, urlB))).toBe(false)
    expect(await Effect.runPromise(auth.isTokenExpired(beta, urlA))).toBeNull()
  })
})

describe("McpAuth server URL identity", () => {
  test("normalizes scheme, host, default ports, fragments, and the origin root slash", async () => {
    await using tmp = await tmpdir()
    const auth = await Effect.runPromise(service(tmp.path))

    await Effect.runPromise(
      auth.updateTokens(alpha, "HTTPS://A.Example.COM:443/mcp#ignored", { accessToken: "normalized" }),
    )

    expect((await Effect.runPromise(auth.get(alpha, "https://a.example.com/mcp")))?.tokens?.accessToken).toBe(
      "normalized",
    )
    expect(McpAuth.normalizeServerUrl("http://A.Example.COM:80")).toBe("http://a.example.com/")
  })

  test("keeps distinct paths and query endpoints separate", async () => {
    await using tmp = await tmpdir()
    const auth = await Effect.runPromise(service(tmp.path))

    await Effect.runPromise(
      Effect.all([
        auth.updateTokens(alpha, "https://example.com/mcp?tenant=a", { accessToken: "tenant-a" }),
        auth.updateTokens(alpha, "https://example.com/mcp?tenant=b", { accessToken: "tenant-b" }),
        auth.updateTokens(alpha, "https://example.com/mcp", { accessToken: "no-slash" }),
        auth.updateTokens(alpha, "https://example.com/mcp/", { accessToken: "slash" }),
        auth.updateTokens(alpha, "https://example.com/other", { accessToken: "other-path" }),
      ]),
    )

    expect((await Effect.runPromise(auth.get(alpha, "https://example.com/mcp?tenant=a")))?.tokens?.accessToken).toBe(
      "tenant-a",
    )
    expect((await Effect.runPromise(auth.get(alpha, "https://example.com/mcp?tenant=b")))?.tokens?.accessToken).toBe(
      "tenant-b",
    )
    expect((await Effect.runPromise(auth.get(alpha, "https://example.com/mcp")))?.tokens?.accessToken).toBe("no-slash")
    expect((await Effect.runPromise(auth.get(alpha, "https://example.com/mcp/")))?.tokens?.accessToken).toBe("slash")
    expect((await Effect.runPromise(auth.get(alpha, "https://example.com/other")))?.tokens?.accessToken).toBe(
      "other-path",
    )
  })

  test("rejects invalid and non-web OAuth server URLs without reflecting input", () => {
    for (const value of ["not a URL", "file:///tmp/private-token", "ssh://secret@example.com/mcp"]) {
      expect(() => McpAuth.normalizeServerUrl(value)).toThrow("HTTP(S)")
      try {
        McpAuth.normalizeServerUrl(value)
      } catch (error) {
        expect(String(error)).not.toContain(value)
      }
    }
  })
})

describe("McpAuth legacy persistence", () => {
  test("migrates exact-URL credentials once and leaves unscoped flow data inert", async () => {
    await using tmp = await tmpdir()
    const file = path.join(tmp.path, "mcp-auth.json")
    await Bun.write(
      file,
      JSON.stringify({
        shared: {
          serverUrl: "HTTPS://A.Example.COM:443/mcp#fragment",
          tokens: { accessToken: "legacy-access", refreshToken: "legacy-refresh" },
          clientInfo: { clientId: "legacy-client", clientSecret: "legacy-client-secret" },
          codeVerifier: "legacy-verifier",
          oauthState: "legacy-state",
        },
        missing_url: { tokens: { accessToken: "orphan-access" } },
        invalid_url: { serverUrl: "file:///tmp/mcp", tokens: { accessToken: "invalid-access" } },
      }),
    )

    const auth = await Effect.runPromise(service(tmp.path))
    expect(await Effect.runPromise(auth.get(alpha, urlB))).toBeUndefined()
    expect(await Effect.runPromise(auth.get({ ...alpha, name: "missing_url" }, urlA))).toBeUndefined()
    expect(await Effect.runPromise(auth.get({ ...alpha, name: "invalid_url" }, urlA))).toBeUndefined()

    expect(await Effect.runPromise(auth.get(alpha, urlA))).toEqual({
      tokens: { accessToken: "legacy-access", refreshToken: "legacy-refresh" },
      clientInfo: { clientId: "legacy-client", clientSecret: "legacy-client-secret" },
    })
    expect(await Effect.runPromise(auth.get(beta, urlA))).toBeUndefined()

    const raw = await Bun.file(file).text()
    const data = JSON.parse(raw) as {
      version: number
      entries: Record<string, { identity: typeof alpha; servers: Record<string, unknown> }>
      recoverable?: Record<string, unknown>
    }
    expect(data.version).toBe(2)
    expect(Object.values(data.entries)).toEqual([
      { identity: alpha, servers: { [urlA]: expect.objectContaining({ tokens: expect.any(Object) }) } },
    ])
    expect(data.recoverable).toHaveProperty("missing_url")
    expect(data.recoverable).toHaveProperty("invalid_url")
    expect(raw.match(/legacy-access/g)).toHaveLength(1)
    expect(raw.match(/legacy-client-secret/g)).toHaveLength(1)
    expect(raw.match(/legacy-verifier/g)).toHaveLength(1)
    expect(raw.match(/legacy-state/g)).toHaveLength(1)
    if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600)

    await Effect.runPromise(auth.remove(alpha, urlA))
    const removed = await Bun.file(file).text()
    expect(removed).not.toContain("legacy-access")
    expect(removed).not.toContain("legacy-client-secret")
    expect(removed).not.toContain("legacy-verifier")
    expect(removed).not.toContain("legacy-state")
    expect(removed).toContain("orphan-access")
    expect(removed).toContain("invalid-access")
  })
})
