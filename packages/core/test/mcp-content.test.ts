import { describe, expect } from "bun:test"
import { MCP } from "@slopcode-ai/core/mcp"
import { MCPClient } from "@slopcode-ai/core/mcp/client"
import { Effect } from "effect"
import { it } from "./lib/effect"

describe("MCP content", () => {
  it.effect("normalizes role-delimited prompt text and shared resource content", () =>
    Effect.gen(function* () {
      const image = Buffer.from("image").toString("base64")
      const prompt = yield* MCP.normalizePrompt("server", "prompt", {
        messages: [
          { role: "user", content: { type: "text", text: "" } },
          {
            role: "assistant",
            content: { type: "resource", resource: { uri: "https://example.test/a.txt", text: "answer" } },
          },
          { role: "user", content: { type: "image", data: image, mimeType: "image/png" } },
        ],
      })
      expect(prompt.text).toBe("[user]\n\n\n---\n[assistant]\nanswer\n\n---\n[user]\n")
      expect(prompt.files).toEqual([
        { uri: `data:image/png;base64,${image}`, mime: "image/png", name: undefined },
      ])

      expect(
        yield* MCP.normalizeResources("server", "resource", {
          contents: [
            { uri: "file:///a.txt", text: "text/plain content", mimeType: "text/plain" },
            {
              uri: "https://example.test/data.bin",
              blob: Buffer.from("blob").toString("base64"),
              mimeType: "application/octet-stream",
            },
          ],
        }),
      ).toEqual({
        text: "text/plain content",
        files: [
          {
            uri: `data:application/octet-stream;base64,${Buffer.from("blob").toString("base64")}`,
            mime: "application/octet-stream",
            name: "data.bin",
          },
        ],
      })
    }),
  )

  it.effect("fails closed on unsafe resource and prompt shapes", () =>
    Effect.gen(function* () {
      const invalid = [
        { contents: [{ uri: "relative", text: "x" }] },
        { contents: [{ uri: "javascript:alert(1)", text: "x" }] },
        { contents: [{ uri: "file:///x", blob: "***", mimeType: "application/octet-stream" }] },
        { contents: [{ uri: "file:///x", blob: "eA==", mimeType: "bad" }] },
        { contents: [{ uri: "file:///x", text: "x", blob: "eA==", mimeType: "text/plain" }] },
      ]
      for (const value of invalid) {
        const failure = yield* MCP.normalizeResources("server", "resource", value).pipe(Effect.flip)
        expect(failure).toBeInstanceOf(MCP.ContentError)
        expect(JSON.stringify(failure)).not.toContain("alert(1)")
      }
      const image = yield* MCP.normalizePrompt("server", "prompt", {
        messages: [{ role: "user", content: { type: "image", data: "eA==", mimeType: "text/plain" } }],
      }).pipe(Effect.flip)
      expect(image).toBeInstanceOf(MCP.ContentError)
    }),
  )

  it.effect("gates all client content operations and handlers by capability", () =>
    Effect.sync(() => {
      let calls = 0
      const client = MCPClient.make({
        capabilities: {},
        list: () => Promise.resolve({ tools: [] }),
        call: () => Promise.resolve({ content: [] }),
        listPrompts: () => (calls++, Promise.resolve({ prompts: [] })),
        getPrompt: () => (calls++, Promise.resolve({ messages: [] })),
        listResources: () => (calls++, Promise.resolve({ resources: [] })),
        readResource: () => (calls++, Promise.resolve({ contents: [] })),
        promptsChanged: () => calls++,
        resourcesChanged: () => calls++,
        close: () => Promise.resolve(),
      })
      expect(() => client.listPrompts(undefined, 1)).toThrow()
      expect(() => client.getPrompt({ name: "x" }, { signal: new AbortController().signal, timeout: 1 })).toThrow()
      expect(() => client.listResources(undefined, 1)).toThrow()
      expect(() => client.readResource({ uri: "file:///x" }, { signal: new AbortController().signal, timeout: 1 })).toThrow()
      client.promptsChanged(() => {})
      client.resourcesChanged(() => {})
      expect(calls).toBe(0)
    }),
  )
})
