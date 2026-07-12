import { describe, expect, test } from "bun:test"
import { ConfigMCP } from "@slopcode-ai/core/config/mcp"
import { MCPClient } from "@slopcode-ai/core/mcp/client"
import { Schema } from "effect"

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
})
