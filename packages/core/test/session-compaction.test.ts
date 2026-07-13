import { expect, test } from "bun:test"
import { SessionCompaction } from "@slopcode-ai/core/session/compaction"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { DateTime } from "effect"

test("compaction describes tool media without embedding base64", () => {
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
  const serialized = SessionCompaction.serializeToolContent([
    { type: "text", text: "Image read successfully" },
    {
      type: "file",
      uri: `data:image/png;base64,${base64}`,
      mime: "image/png",
      name: "pixel.png",
    },
  ])

  expect(serialized).toBe("Image read successfully\n[Attached image/png: pixel.png]")
  expect(serialized).not.toContain(base64)
})

test("manual compaction adds a custom instruction to the shared summary prompt", () => {
  const prompt = SessionCompaction.buildPrompt({
    context: ["[User]: Keep this history"],
    instruction: "Emphasize unresolved test failures",
  })

  expect(prompt).toContain("Additional summary instruction")
  expect(prompt).toContain("Emphasize unresolved test failures")
  expect(prompt).toContain("[User]: Keep this history")
})

test("compaction preserves structured success and failure semantics", () => {
  const time = DateTime.makeUnsafe(0)
  const model = { id: ModelV2.ID.make("test"), providerID: ProviderV2.ID.make("test") }
  const success = new SessionMessage.Assistant({
    id: SessionMessage.ID.make("msg_structured_success"),
    type: "assistant",
    agent: "build",
    model,
    content: [],
    structured: { answer: 42 },
    time: { created: time, completed: time },
  })
  const failure = new SessionMessage.Assistant({
    id: SessionMessage.ID.make("msg_structured_failure"),
    type: "assistant",
    agent: "build",
    model,
    content: [],
    structuredError: {
      reason: "invalid-json",
      attempts: 3,
      retryCount: 2,
      exhausted: true,
      message: "Structured output attempts were exhausted",
    },
    time: { created: time, completed: time },
  })

  expect(SessionCompaction.serializeMessage(success)).toBe('[Assistant structured]: {"answer":42}')
  expect(SessionCompaction.serializeMessage(failure)).toBe(
    "[Assistant structured error]: Structured output attempts were exhausted",
  )
})
