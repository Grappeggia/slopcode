import { beforeAll, describe, expect, mock, test } from "bun:test"
import { createRoot } from "solid-js"
import type { Prompt } from "./prompt"
import type { PromptHistoryStoredEntry } from "@/components/prompt-input/history"

let createPromptSessionForTest: typeof import("./prompt").createPromptSessionForTest

beforeAll(async () => {
  mock.module("@solidjs/router", () => ({
    useNavigate: () => () => undefined,
    useParams: () => ({}),
  }))
  mock.module("@slopcode-ai/ui/context", () => ({
    createSimpleContext: () => ({
      use: () => undefined,
      provider: () => undefined,
    }),
  }))

  const mod = await import("./prompt")
  createPromptSessionForTest = mod.createPromptSessionForTest
})

const text = (value: string): Prompt => [{ type: "text", content: value, start: 0, end: value.length }]

const entry = (value: string): PromptHistoryStoredEntry => ({
  prompt: text(value),
  comments: [
    {
      id: `c:${value}`,
      path: "src/a.ts",
      selection: { start: 1, end: 2 },
      comment: `note:${value}`,
      time: 1,
      origin: "review",
      preview: "const a = 1",
    },
  ],
})

describe("prompt session history", () => {
  test("stores normal and shell history separately", () => {
    createRoot((dispose) => {
      const prompt = createPromptSessionForTest()
      prompt.history.set("normal", [entry("alpha")])
      prompt.history.set("shell", [text("pwd")])

      expect(prompt.history.normal()).toEqual([entry("alpha")])
      expect(prompt.history.shell()).toEqual([text("pwd")])

      dispose()
    })
  })

  test("clones history entries before storing them", () => {
    createRoot((dispose) => {
      const prompt = createPromptSessionForTest()
      const normal = [entry("alpha")]

      prompt.history.set("normal", normal)

      const stored = prompt.history.normal()
      expect(stored).not.toBe(normal)

      if (normal[0] && !Array.isArray(normal[0])) {
        normal[0].prompt[0]!.type === "text" && (normal[0].prompt[0].content = "changed")
        normal[0].comments[0]!.comment = "changed"
        normal[0].comments[0]!.selection.start = 9
      }

      const first = stored[0]
      if (!first || Array.isArray(first)) throw new Error("expected stored prompt history entry")

      expect(first.prompt[0]?.type === "text" ? first.prompt[0].content : "").toBe("alpha")
      expect(first.comments[0]?.comment).toBe("note:alpha")
      expect(first.comments[0]?.selection.start).toBe(1)

      dispose()
    })
  })
})
