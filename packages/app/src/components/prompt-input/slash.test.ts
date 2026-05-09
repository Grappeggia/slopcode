import { describe, expect, test } from "bun:test"
import type { Prompt } from "@/context/prompt"
import { promotePromptSlash, removePromptSlash } from "./slash"

const text = (prompt: Prompt) => prompt.filter((part) => part.type !== "image").map((part) => part.content).join("")

describe("prompt input slash", () => {
  test("removes inline builtin slash commands without deleting the draft", () => {
    const result = removePromptSlash(
      [{ type: "text", content: "Explain auth /model flow", start: 0, end: 24 }],
      "Explain auth /model".length,
    )

    if (!result) throw new Error("expected prompt update")
    expect(result.cursor).toBe(13)
    expect(text(result.prompt)).toBe("Explain auth flow")
  })

  test("shifts file parts when removing a builtin slash command", () => {
    const result = removePromptSlash(
      [
        { type: "text", content: "Use /model ", start: 0, end: 11 },
        {
          type: "file",
          path: "src/app.ts",
          content: "@src/app.ts",
          start: 11,
          end: 22,
        },
      ],
      "Use /model".length,
    )

    if (!result) throw new Error("expected prompt update")
    expect(text(result.prompt)).toBe("Use @src/app.ts")
    expect(result.prompt[0]).toMatchObject({ type: "text", content: "Use ", start: 0, end: 4 })
    expect(result.prompt[1]).toMatchObject({ type: "file", start: 4, end: 15 })
  })

  test("promotes custom slash commands to the front while preserving attachments", () => {
    const result = promotePromptSlash(
      [
        { type: "text", content: "Review ", start: 0, end: 7 },
        {
          type: "file",
          path: "src/app.ts",
          content: "@src/app.ts",
          start: 7,
          end: 18,
        },
        { type: "text", content: " /shipit", start: 18, end: 26 },
      ],
      26,
      "shipit",
    )

    if (!result) throw new Error("expected prompt update")
    expect(text(result.prompt)).toBe("/shipit Review @src/app.ts ")
    expect(result.cursor).toBe(27)
    expect(result.prompt[1]).toMatchObject({ type: "file", start: 15, end: 26 })
  })
})
