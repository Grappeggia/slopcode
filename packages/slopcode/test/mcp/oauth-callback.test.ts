import { test, expect, describe, afterEach } from "bun:test"
import { createServer } from "node:http"
import { McpAuth } from "../../src/mcp/auth"
import { McpOAuthCallback } from "../../src/mcp/oauth-callback"
import { parseRedirectUri } from "../../src/mcp/oauth-provider"

async function waitForClosed(port: number) {
  const deadline = Date.now() + 2_000
  while (await McpOAuthCallback.isPortInUse(port, "127.0.0.1")) {
    if (Date.now() > deadline) throw new Error("callback listener did not stop")
    await Bun.sleep(10)
  }
}

describe("parseRedirectUri", () => {
  test("returns defaults when no URI provided", () => {
    const result = parseRedirectUri()
    expect(result.port).toBe(19876)
    expect(result.path).toBe("/mcp/oauth/callback")
  })

  test("parses loopback host, port, and path from URI", () => {
    const result = parseRedirectUri("http://127.0.0.1:8080/oauth/callback")
    expect(result.host).toBe("127.0.0.1")
    expect(result.port).toBe(8080)
    expect(result.path).toBe("/oauth/callback")
  })

  test("rejects unsupported schemes, hosts, credentials, and fragments without reflecting them", () => {
    for (const value of [
      "not-a-valid-url",
      "file:///tmp/private-callback",
      "https://127.0.0.1/callback",
      "http://example.com/callback",
      "http://0.0.0.0/callback",
      "http://user:secret@127.0.0.1/callback",
      "http://127.0.0.1/callback#fragment",
    ]) {
      expect(() => parseRedirectUri(value)).toThrow("loopback HTTP")
      try {
        parseRedirectUri(value)
      } catch (error) {
        expect(String(error)).not.toContain(value)
      }
    }
  })
})

describe("McpOAuthCallback.ensureRunning", () => {
  afterEach(async () => {
    await McpOAuthCallback.stop()
  })

  test("starts server with custom redirectUri port and path", async () => {
    await McpOAuthCallback.ensureRunning("http://127.0.0.1:18000/custom/callback")
    expect(McpOAuthCallback.isRunning()).toBe(true)
  })

  test("coalesces concurrent starts for the same callback endpoint", async () => {
    await Promise.all(
      Array.from({ length: 8 }, () => McpOAuthCallback.ensureRunning("http://127.0.0.1:18000/custom/callback")),
    )
    expect(McpOAuthCallback.isRunning()).toBe(true)
  })

  test("serves concurrent callback endpoints on different ports", async () => {
    const endpoints = await Promise.all([
      McpOAuthCallback.ensureRunning("http://127.0.0.1:18000/callback/a"),
      McpOAuthCallback.ensureRunning("http://127.0.0.1:18001/callback/b"),
    ])
    const first = McpOAuthCallback.waitForCallback("port-state-a", "port-key-a", endpoints[0]).then(
      (code) => code,
      () => undefined,
    )
    const second = McpOAuthCallback.waitForCallback("port-state-b", "port-key-b", endpoints[1]).then(
      (code) => code,
      () => undefined,
    )

    const responses = await Promise.all([
      fetch("http://127.0.0.1:18000/callback/a?code=code-a&state=port-state-a"),
      fetch("http://127.0.0.1:18001/callback/b?code=code-b&state=port-state-b"),
    ])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(await Promise.all([first, second])).toEqual(["code-a", "code-b"])
  })

  test("does not reflect provider error details into responses or failures", async () => {
    const endpoint = await McpOAuthCallback.ensureRunning("http://127.0.0.1:18000/error-callback")
    const callback = McpOAuthCallback.waitForCallback("error-state", "error-key", endpoint).catch(
      (error: Error) => error,
    )
    const response = await fetch(
      "http://127.0.0.1:18000/error-callback?error=access_denied&error_description=private-client-secret&state=error-state",
    )
    const body = await response.text()
    const error = await callback

    expect(body).not.toContain("private-client-secret")
    expect(error).toBeInstanceOf(Error)
    expect(String(error)).not.toContain("private-client-secret")
    await waitForClosed(18000)
    expect(McpOAuthCallback.isRunning()).toBe(false)
  })

  test("fails when another process owns the callback address", async () => {
    const occupied = createServer((_req, res) => res.end("occupied"))
    await new Promise<void>((resolve) => occupied.listen(0, "127.0.0.1", resolve))
    const address = occupied.address()
    if (!address || typeof address === "string") throw new Error("missing occupied port")
    try {
      await expect(McpOAuthCallback.ensureRunning(`http://127.0.0.1:${address.port}/callback`)).rejects.toThrow(
        "unavailable",
      )
      expect(McpOAuthCallback.isRunning()).toBe(false)
    } finally {
      await new Promise<void>((resolve) => occupied.close(() => resolve()))
    }
  })

  test("keeps the listener until its final pending state completes", async () => {
    const endpoint = await McpOAuthCallback.ensureRunning("http://127.0.0.1:18000/shared-callback")
    const first = McpOAuthCallback.waitForCallback("listener-state-a", "listener-key", endpoint)
    const second = McpOAuthCallback.waitForCallback("listener-state-b", "listener-key", endpoint)

    await fetch("http://127.0.0.1:18000/shared-callback?code=code-a&state=listener-state-a")
    expect(await first).toBe("code-a")
    expect(await McpOAuthCallback.isPortInUse(18000, "127.0.0.1")).toBe(true)

    await fetch("http://127.0.0.1:18000/shared-callback?code=code-b&state=listener-state-b")
    expect(await second).toBe("code-b")
    await waitForClosed(18000)
    expect(McpOAuthCallback.isRunning()).toBe(false)
  })

  test("stops the listener when its final pending state times out", async () => {
    const endpoint = await McpOAuthCallback.ensureRunning("http://127.0.0.1:18000/timeout-callback")
    await expect(McpOAuthCallback.waitForCallback("timeout-state", "timeout-key", endpoint, 10)).rejects.toThrow(
      "timeout",
    )
    await waitForClosed(18000)
    expect(McpOAuthCallback.isRunning()).toBe(false)
  })
})

describe("McpOAuthCallback pending flow isolation", () => {
  afterEach(async () => {
    await McpOAuthCallback.stop()
  })

  test("cancels by composite URL identity without cancelling a same-name flow", async () => {
    const endpoint = await McpOAuthCallback.ensureRunning("http://127.0.0.1:18000/callback")
    const identity = { instance: "/projects/shared", name: "same-name" }
    const keyA = McpAuth.key(identity, "https://a.example.com/mcp")
    const keyB = McpAuth.key(identity, "https://b.example.com/mcp")
    const first = McpOAuthCallback.waitForCallback("state-a", keyA, endpoint).then(
      (code) => ({ code }),
      (error: Error) => ({ error }),
    )
    const second = McpOAuthCallback.waitForCallback("state-b", keyB, endpoint).then(
      (code) => ({ code }),
      (error: Error) => ({ error }),
    )

    McpOAuthCallback.cancelPending("state-b")
    const cancelled = await second
    expect("error" in cancelled ? cancelled.error.message : undefined).toBe("Authorization cancelled")

    let settled = false
    void first.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    McpOAuthCallback.cancelPending("state-a")
    const remaining = await first
    expect("error" in remaining ? remaining.error.message : undefined).toBe("Authorization cancelled")
    await waitForClosed(18000)
    expect(McpOAuthCallback.isRunning()).toBe(false)
  })

  test("separates reverse cancellation for different instances of the same URL", async () => {
    const endpoint = await McpOAuthCallback.ensureRunning("http://127.0.0.1:18000/callback")
    const url = "https://example.com/mcp"
    const keyA = McpAuth.key({ instance: "/projects/a", name: "same-name" }, url)
    const keyB = McpAuth.key({ instance: "/projects/b", name: "same-name" }, url)
    const first = McpOAuthCallback.waitForCallback("instance-state-a", keyA, endpoint).then(
      (code) => ({ code }),
      (error: Error) => ({ error }),
    )
    const second = McpOAuthCallback.waitForCallback("instance-state-b", keyB, endpoint).then(
      (code) => ({ code }),
      (error: Error) => ({ error }),
    )

    McpOAuthCallback.cancelByKey(keyA)
    const cancelled = await first
    expect("error" in cancelled ? cancelled.error.message : undefined).toBe("Authorization cancelled")

    McpOAuthCallback.cancelByKey(keyB)
    const remaining = await second
    expect("error" in remaining ? remaining.error.message : undefined).toBe("Authorization cancelled")
  })

  test("rejects a duplicate pending state without replacing its original flow", async () => {
    const endpoint = await McpOAuthCallback.ensureRunning("http://127.0.0.1:18000/callback")
    const keyA = McpAuth.key({ instance: "/projects/a", name: "same-name" }, "https://a.example.com/mcp")
    const keyB = McpAuth.key({ instance: "/projects/b", name: "same-name" }, "https://b.example.com/mcp")
    const first = McpOAuthCallback.waitForCallback("duplicate-state", keyA, endpoint).then(
      (code) => ({ code }),
      (error: Error) => ({ error }),
    )

    await expect(McpOAuthCallback.waitForCallback("duplicate-state", keyB, endpoint)).rejects.toThrow("already pending")
    McpOAuthCallback.cancelPending("duplicate-state")
    const cancelled = await first
    expect("error" in cancelled ? cancelled.error.message : undefined).toBe("Authorization cancelled")
  })
})
