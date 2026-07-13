import { describe, expect } from "bun:test"
import { MCP } from "@slopcode-ai/core/mcp"
import { MCPClient } from "@slopcode-ai/core/mcp/client"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionInput } from "@slopcode-ai/core/session/input"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { Prompt } from "@slopcode-ai/core/session/prompt"
import { DateTime, Effect } from "effect"
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
      expect(prompt.files).toEqual([{ uri: `data:image/png;base64,${image}`, mime: "image/png", name: undefined }])

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

  it.effect("rejects field-presence conflicts, wrong types, noncanonical base64, and unsupported prompt shapes", () =>
    Effect.gen(function* () {
      const resources = [
        { contents: [{}] },
        { contents: [{ uri: "file:///x", text: 1 }] },
        { contents: [{ uri: "file:///x", text: "x", blob: 1 }] },
        { contents: [{ uri: "file:///x", blob: "eA", mimeType: "application/octet-stream" }] },
        { contents: [{ uri: "file:///x", blob: "eA===", mimeType: "application/octet-stream" }] },
        { contents: [{ uri: "file:///x", blob: "eA==", mimeType: 1 }] },
      ]
      for (const value of resources)
        expect(yield* MCP.normalizeResources("server", "resource", value).pipe(Effect.flip)).toBeInstanceOf(
          MCP.ContentError,
        )

      const contents = [
        { type: "text", text: 1 },
        { type: "text", text: "x", data: "eA==" },
        { type: "image", data: "eA==", mimeType: "image/png", text: "x" },
        { type: "image", data: 1, mimeType: "image/png" },
        { type: "resource", resource: { uri: "relative", text: "x" } },
        { type: "resource", resource: { uri: "file:///x", blob: "eA", mimeType: "image/png" } },
        { type: "audio", data: "eA==", mimeType: "audio/wav" },
        { type: "resource_link", uri: "file:///x", name: "x" },
      ]
      for (const content of contents)
        expect(
          yield* MCP.normalizePrompt("server", "prompt", {
            messages: [{ role: "user", content }],
          }).pipe(Effect.flip),
        ).toBeInstanceOf(MCP.ContentError)
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
      expect(() => client.listPrompts(undefined, { signal: new AbortController().signal, timeout: 1 })).toThrow()
      expect(() => client.getPrompt({ name: "x" }, { signal: new AbortController().signal, timeout: 1 })).toThrow()
      expect(() => client.listResources(undefined, { signal: new AbortController().signal, timeout: 1 })).toThrow()
      expect(() =>
        client.readResource({ uri: "file:///x" }, { signal: new AbortController().signal, timeout: 1 }),
      ).toThrow()
      client.promptsChanged(() => {})
      client.resourcesChanged(() => {})
      expect(calls).toBe(0)
    }),
  )

  it.effect("resolves once and forwards ordinary prompt admission options and guard", () =>
    Effect.gen(function* () {
      const calls: unknown[] = []
      const sessionID = SessionV2.ID.make("ses_mcp_content")
      const id = SessionMessage.ID.make("msg_mcp_content")
      const admitted = new SessionInput.Admitted({
        id,
        sessionID,
        prompt: new Prompt({ text: "[user]\nresolved" }),
        delivery: "queue",
        admittedSeq: 1,
        timeCreated: DateTime.makeUnsafe(0),
      })
      const mcp = {
        getPrompt: () => Effect.succeed(admitted.prompt),
      } as unknown as MCP.Interface
      const sessions = {
        prompt: (input: unknown, guard: Effect.Effect<void, string>) =>
          guard.pipe(
            Effect.tap(() => Effect.sync(() => calls.push(input))),
            Effect.as(admitted),
          ),
      } as unknown as SessionV2.Interface
      const guard = Effect.sync(() => calls.push("guard"))

      expect(
        yield* MCP.resolveAndAdmit(
          mcp,
          sessions,
          { name: "server:prompt", arguments: { value: "x" }, sessionID, id, delivery: "queue", resume: false },
          guard,
        ),
      ).toBe(admitted)
      expect(calls).toEqual(["guard", { id, sessionID, prompt: admitted.prompt, delivery: "queue", resume: false }])
    }),
  )
})
