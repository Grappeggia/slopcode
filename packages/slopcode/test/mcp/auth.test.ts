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

function layer(root: string, fs: Layer.Layer<FSUtil.Service> = FSUtil.defaultLayer) {
  const global = Global.layerWith({ data: root, state: path.join(root, "state") })
  const flock = EffectFlock.layer.pipe(Layer.provide(Layer.mergeAll(fs, global)))
  return Layer.fresh(McpAuth.layer.pipe(Layer.provide(flock), Layer.provide(Layer.mergeAll(fs, global))))
}

function service(root: string, fs?: Layer.Layer<FSUtil.Service>) {
  return McpAuth.Service.use((auth) => Effect.succeed(auth)).pipe(Effect.provide(layer(root, fs)))
}

describe("McpAuth credential isolation", () => {
  test("keeps same-name URL credentials and OAuth flow fields isolated", async () => {
    await using tmp = await tmpdir()
    const auth = await Effect.runPromise(service(tmp.path))

    await Effect.runPromise(
      Effect.all([
        auth.updateTokens(alpha, urlA, { accessToken: "access-a", refreshToken: "refresh-a" }),
        auth.updateClientInfo(alpha, urlA, { clientId: "client-a", clientSecret: "client-secret-a" }),
        auth.startFlow(alpha, urlA, "state-a"),
      ]),
    )
    await Effect.runPromise(auth.updateCodeVerifier(alpha, urlA, "state-a", "verifier-a"))

    await Effect.runPromise(
      auth.updateClientInfo(alpha, urlB, { clientId: "client-b", clientSecret: "client-secret-b" }),
    )
    const registered = await Effect.runPromise(auth.get(alpha, urlB))
    expect(registered).toEqual({ clientInfo: { clientId: "client-b", clientSecret: "client-secret-b" } })

    await Effect.runPromise(
      Effect.all([
        auth.updateTokens(alpha, urlB, { accessToken: "access-b", refreshToken: "refresh-b" }),
        auth.startFlow(alpha, urlB, "state-b"),
      ]),
    )
    await Effect.runPromise(auth.updateCodeVerifier(alpha, urlB, "state-b", "verifier-b"))

    expect(await Effect.runPromise(auth.get(alpha, urlA))).toEqual({
      tokens: { accessToken: "access-a", refreshToken: "refresh-a" },
      clientInfo: { clientId: "client-a", clientSecret: "client-secret-a" },
      flows: { "state-a": { state: "state-a", codeVerifier: "verifier-a" } },
    })
    expect(await Effect.runPromise(auth.get(alpha, urlB))).toEqual({
      tokens: { accessToken: "access-b", refreshToken: "refresh-b" },
      clientInfo: { clientId: "client-b", clientSecret: "client-secret-b" },
      flows: { "state-b": { state: "state-b", codeVerifier: "verifier-b" } },
    })
  })

  test("isolates the same name and URL across project instances", async () => {
    await using tmp = await tmpdir()
    const auth = await Effect.runPromise(service(tmp.path))

    await Effect.runPromise(
      Effect.all([
        auth.updateTokens(alpha, urlA, { accessToken: "alpha-access" }),
        auth.updateTokens(beta, urlA, { accessToken: "beta-access" }),
        auth.startFlow(alpha, urlA, "alpha-state"),
        auth.startFlow(beta, urlA, "beta-state"),
      ]),
    )

    expect((await Effect.runPromise(auth.get(alpha, urlA)))?.tokens?.accessToken).toBe("alpha-access")
    expect((await Effect.runPromise(auth.get(alpha, urlA)))?.flows?.["alpha-state"]?.state).toBe("alpha-state")
    expect((await Effect.runPromise(auth.get(beta, urlA)))?.tokens?.accessToken).toBe("beta-access")
    expect((await Effect.runPromise(auth.get(beta, urlA)))?.flows?.["beta-state"]?.state).toBe("beta-state")
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
          first.startFlow(beta, urlA, "state-beta"),
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
      flows: { "state-beta": { state: "state-beta" } },
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

  test("atomically retains the latest rotated refresh token across concurrent updates", async () => {
    await using tmp = await tmpdir()
    const first = await Effect.runPromise(service(tmp.path))
    const second = await Effect.runPromise(service(tmp.path))

    await Effect.runPromise(first.updateTokens(alpha, urlA, { accessToken: "old", refreshToken: "refresh-old" }))
    await Effect.runPromise(first.updateTokens(alpha, urlA, { accessToken: "rotated", refreshToken: "refresh-new" }))
    await Effect.runPromise(
      Effect.all(
        [
          first.updateTokens(alpha, urlA, { accessToken: "access-a" }),
          second.updateTokens(alpha, urlA, { accessToken: "access-b" }),
        ],
        { concurrency: "unbounded" },
      ),
    )

    expect((await Effect.runPromise(first.get(alpha, urlA)))?.tokens?.refreshToken).toBe("refresh-new")
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

describe("McpAuth persistence integrity", () => {
  test("archives legacy credentials without allowing either project to claim them", async () => {
    for (const order of [
      [alpha, beta],
      [beta, alpha],
    ]) {
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
      expect(await Effect.runPromise(auth.get(order[0], urlA))).toBeUndefined()
      expect(await Effect.runPromise(auth.get(order[1], urlA))).toBeUndefined()
      expect(await Effect.runPromise(auth.get(order[0], urlA))).toBeUndefined()
      expect(await Effect.runPromise(auth.get({ ...alpha, name: "missing_url" }, urlA))).toBeUndefined()
      expect(await Effect.runPromise(auth.get({ ...alpha, name: "invalid_url" }, urlA))).toBeUndefined()

      await Effect.runPromise(auth.remove(order[0], urlA))
      const raw = await Bun.file(file).text()
      const data = JSON.parse(raw) as {
        version: number
        entries: Record<string, unknown>
        legacy?: Record<string, unknown>
        recoverable?: Record<string, unknown>
      }
      expect(data.version).toBe(2)
      expect(data.entries).toEqual({})
      expect(data.legacy).toHaveProperty("shared")
      expect(data.recoverable).toHaveProperty("missing_url")
      expect(data.recoverable).toHaveProperty("invalid_url")
      expect(raw.match(/legacy-access/g)).toHaveLength(1)
      expect(raw.match(/legacy-client-secret/g)).toHaveLength(1)
      expect(raw.match(/legacy-verifier/g)).toHaveLength(1)
      expect(raw.match(/legacy-state/g)).toHaveLength(1)
      expect((await stat(file)).mode & 0o777).toBe(0o600)
    }
  })

  test("fails closed without overwriting corrupt, invalid, or future-version storage", async () => {
    for (const raw of [
      "{",
      JSON.stringify({ version: 2, entries: "invalid" }),
      JSON.stringify({ version: 3, entries: {} }),
    ]) {
      await using tmp = await tmpdir()
      const file = path.join(tmp.path, "mcp-auth.json")
      await Bun.write(file, raw)
      const auth = await Effect.runPromise(service(tmp.path))

      await expect(
        Effect.runPromise(auth.updateTokens(alpha, urlA, { accessToken: "must-not-write" })),
      ).rejects.toBeDefined()
      expect(await Bun.file(file).text()).toBe(raw)
    }
  })

  test("does not treat a transient read failure as empty storage", async () => {
    await using tmp = await tmpdir()
    const file = path.join(tmp.path, "mcp-auth.json")
    const raw = JSON.stringify({ version: 2, entries: {} })
    await Bun.write(file, raw)
    let fail = true
    const fs = Layer.effect(
      FSUtil.Service,
      Effect.gen(function* () {
        const base = yield* FSUtil.Service
        return FSUtil.Service.of({
          ...base,
          readJson: (target) => {
            if (!target.endsWith("mcp-auth.json") || !fail) return base.readJson(target)
            fail = false
            return Effect.fail(
              new FSUtil.FileSystemError({ method: "readJson", cause: new Error("transient read failure") }),
            )
          },
        })
      }),
    ).pipe(Layer.provide(FSUtil.defaultLayer))
    const auth = await Effect.runPromise(service(tmp.path, fs))

    await expect(Effect.runPromise(auth.updateTokens(alpha, urlA, { accessToken: "first" }))).rejects.toBeDefined()
    expect(await Bun.file(file).text()).toBe(raw)
    await Effect.runPromise(auth.updateTokens(alpha, urlA, { accessToken: "second" }))
    expect((await Effect.runPromise(auth.get(alpha, urlA)))?.tokens?.accessToken).toBe("second")
  })
})
