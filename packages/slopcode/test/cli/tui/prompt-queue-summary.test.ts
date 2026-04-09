import { describe, expect, test } from "bun:test"
import { describePromptQueue } from "../../../src/cli/cmd/tui/component/prompt/queue"

describe("prompt queue summary", () => {
  test("keeps summaries at or below 250 chars", () => {
    const text = "a".repeat(250)
    const value = describePromptQueue({ text })

    expect(value.summary).toBe(text)
  })

  test("truncates summaries longer than 250 chars", () => {
    const value = describePromptQueue({ text: "a".repeat(300) })

    expect(value.summary).toBe("a".repeat(247) + "...")
  })

  test("normalizes whitespace before truncating", () => {
    const value = describePromptQueue({ text: "  hello\n\nworld\t  " })

    expect(value.summary).toBe("hello world")
  })

  test("falls back to file detail when text is blank", () => {
    const value = describePromptQueue({ text: "   ", files: 2 })

    expect(value).toEqual({
      summary: "2 files",
      detail: undefined,
    })
  })
})
