import { test, expect, describe, afterEach } from "bun:test"
import { McpAuth } from "../../src/mcp/auth"
import { McpOAuthCallback } from "../../src/mcp/oauth-callback"
import { parseRedirectUri } from "../../src/mcp/oauth-provider"

describe("parseRedirectUri", () => {
  test("returns defaults when no URI provided", () => {
    const result = parseRedirectUri()
    expect(result.port).toBe(19876)
    expect(result.path).toBe("/mcp/oauth/callback")
  })

  test("parses port and path from URI", () => {
    const result = parseRedirectUri("http://127.0.0.1:8080/oauth/callback")
    expect(result.port).toBe(8080)
    expect(result.path).toBe("/oauth/callback")
  })

  test("rejects invalid and non-web redirect URIs without reflecting them", () => {
    for (const value of ["not-a-valid-url", "file:///tmp/private-callback", "http://127.0.0.1/callback#fragment"]) {
      expect(() => parseRedirectUri(value)).toThrow("HTTP(S)")
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
    await Promise.all([
      McpOAuthCallback.ensureRunning("http://127.0.0.1:18000/callback/a"),
      McpOAuthCallback.ensureRunning("http://127.0.0.1:18001/callback/b"),
    ])
    const first = McpOAuthCallback.waitForCallback("port-state-a", "port-key-a").then(
      (code) => code,
      () => undefined,
    )
    const second = McpOAuthCallback.waitForCallback("port-state-b", "port-key-b").then(
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
    await McpOAuthCallback.ensureRunning("http://127.0.0.1:18000/error-callback")
    const callback = McpOAuthCallback.waitForCallback("error-state", "error-key").catch((error: Error) => error)
    const response = await fetch(
      "http://127.0.0.1:18000/error-callback?error=access_denied&error_description=private-client-secret&state=error-state",
    )
    const body = await response.text()
    const error = await callback

    expect(body).not.toContain("private-client-secret")
    expect(error).toBeInstanceOf(Error)
    expect(String(error)).not.toContain("private-client-secret")
  })
})

describe("McpOAuthCallback pending flow isolation", () => {
  afterEach(async () => {
    await McpOAuthCallback.stop()
  })

  test("cancels by composite URL identity without cancelling a same-name flow", async () => {
    const identity = { instance: "/projects/shared", name: "same-name" }
    const keyA = McpAuth.key(identity, "https://a.example.com/mcp")
    const keyB = McpAuth.key(identity, "https://b.example.com/mcp")
    const first = McpOAuthCallback.waitForCallback("state-a", keyA).then(
      (code) => ({ code }),
      (error: Error) => ({ error }),
    )
    const second = McpOAuthCallback.waitForCallback("state-b", keyB).then(
      (code) => ({ code }),
      (error: Error) => ({ error }),
    )

    McpOAuthCallback.cancelPending(keyB)
    const cancelled = await second
    expect("error" in cancelled ? cancelled.error.message : undefined).toBe("Authorization cancelled")

    let settled = false
    void first.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    McpOAuthCallback.cancelPending(keyA)
    const remaining = await first
    expect("error" in remaining ? remaining.error.message : undefined).toBe("Authorization cancelled")
  })

  test("separates reverse cancellation for different instances of the same URL", async () => {
    const url = "https://example.com/mcp"
    const keyA = McpAuth.key({ instance: "/projects/a", name: "same-name" }, url)
    const keyB = McpAuth.key({ instance: "/projects/b", name: "same-name" }, url)
    const first = McpOAuthCallback.waitForCallback("instance-state-a", keyA).then(
      (code) => ({ code }),
      (error: Error) => ({ error }),
    )
    const second = McpOAuthCallback.waitForCallback("instance-state-b", keyB).then(
      (code) => ({ code }),
      (error: Error) => ({ error }),
    )

    McpOAuthCallback.cancelPending(keyA)
    const cancelled = await first
    expect("error" in cancelled ? cancelled.error.message : undefined).toBe("Authorization cancelled")

    McpOAuthCallback.cancelPending(keyB)
    const remaining = await second
    expect("error" in remaining ? remaining.error.message : undefined).toBe("Authorization cancelled")
  })

  test("rejects a duplicate pending state without replacing its original flow", async () => {
    const keyA = McpAuth.key({ instance: "/projects/a", name: "same-name" }, "https://a.example.com/mcp")
    const keyB = McpAuth.key({ instance: "/projects/b", name: "same-name" }, "https://b.example.com/mcp")
    const first = McpOAuthCallback.waitForCallback("duplicate-state", keyA).then(
      (code) => ({ code }),
      (error: Error) => ({ error }),
    )

    await expect(McpOAuthCallback.waitForCallback("duplicate-state", keyB)).rejects.toThrow("already pending")
    McpOAuthCallback.cancelPending(keyA)
    const cancelled = await first
    expect("error" in cancelled ? cancelled.error.message : undefined).toBe("Authorization cancelled")
  })
})
