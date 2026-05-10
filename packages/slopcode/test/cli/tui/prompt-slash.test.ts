import { describe, expect, test } from "bun:test"
import { findSlashTrigger, removeSlashTrigger } from "@slopcode-ai/util/slash"
import { promotePromptSlash, removePromptSlash } from "../../../src/cli/cmd/tui/component/prompt/slash"
import { dismissPromptSlash } from "../../../src/cli/cmd/tui/util/prompt-slash"

describe("prompt slash", () => {
  test("finds inline slash triggers without matching paths", () => {
    const inline = "Explain auth /model"
    expect(findSlashTrigger(inline, inline.length)).toEqual({
      start: 13,
      end: 19,
      query: "model",
      token: "/model",
    })

    expect(findSlashTrigger("Explain auth /tmp/cache", "Explain auth /tmp/cache".length)).toBeUndefined()
    expect(findSlashTrigger("Visit https://slopcode.dev", "Visit https://slopcode.dev".length)).toBeUndefined()
  })

  test("removes inline slash tokens without deleting the draft", () => {
    const text = "Explain auth /model flow"
    const trigger = findSlashTrigger(text, "Explain auth /model".length)
    if (!trigger) throw new Error("expected slash trigger")

    expect(removeSlashTrigger(text, trigger)).toEqual({
      start: 13,
      end: 20,
      text: "Explain auth flow",
      cursor: 13,
    })
  })

  test("shifts prompt parts when removing a builtin slash command", () => {
    const result = removePromptSlash(
      {
        input: "Use /model @src/app.ts",
        parts: [
          {
            type: "file",
            mime: "text/plain",
            filename: "src/app.ts",
            url: "file:///src/app.ts",
            source: {
              type: "file",
              path: "src/app.ts",
              text: {
                start: 11,
                end: 22,
                value: "@src/app.ts",
              },
            },
          },
        ],
        mode: "normal",
      },
      "Use /model".length,
    )

    if (!result) throw new Error("expected prompt update")
    expect(result.cursor).toBe(4)
    expect(result.prompt.input).toBe("Use @src/app.ts")
    const file = result.prompt.parts[0]
    expect(file?.type).toBe("file")
    if (file?.type !== "file" || !file.source) throw new Error("expected file part")
    expect(file.source.text.start).toBe(4)
    expect(file.source.text.end).toBe(15)
  })

  test("promotes custom slash commands to the front while preserving prompt parts", () => {
    const result = promotePromptSlash(
      {
        input: "Review @src/app.ts /shipit",
        parts: [
          {
            type: "file",
            mime: "text/plain",
            filename: "src/app.ts",
            url: "file:///src/app.ts",
            source: {
              type: "file",
              path: "src/app.ts",
              text: {
                start: 7,
                end: 18,
                value: "@src/app.ts",
              },
            },
          },
        ],
        mode: "normal",
      },
      "Review @src/app.ts /shipit".length,
      "shipit",
    )

    if (!result) throw new Error("expected prompt update")
    expect(result.prompt.input).toBe("/shipit Review @src/app.ts ")
    expect(result.cursor).toBe(result.prompt.input.length)
    const file = result.prompt.parts[0]
    expect(file?.type).toBe("file")
    if (file?.type !== "file" || !file.source) throw new Error("expected file part")
    expect(file.source.text.start).toBe(15)
    expect(file.source.text.end).toBe(26)
  })

  test("dismisses slash prompts through a prompt ref", () => {
    let current = {
      input: "/move",
      parts: [],
      mode: "normal" as const,
    }

    const prompt = {
      focused: true,
      get current() {
        return current
      },
      set(next: typeof current) {
        current = next
      },
      reset() {},
      blur() {},
      focus() {},
      attachFile() {
        return false
      },
      submit() {},
    }

    expect(dismissPromptSlash(prompt)).toBe(true)
    expect(current.input).toBe("")
  })
})
