import { describe, expect, test } from "bun:test"
import { interactivePrompt } from "../../src/cli/cmd/run/input"

describe("run input", () => {
  test("returns undefined for an empty interactive prompt", () => {
    expect(interactivePrompt({ message: "" })).toBeUndefined()
  })

  test("passes through normal interactive prompts", () => {
    expect(interactivePrompt({ message: "hello" })).toBe("hello")
  })

  test("turns commands into slash prompts", () => {
    expect(interactivePrompt({ command: "explain", message: "this code" })).toBe("/explain this code")
  })

  test("does not double-prefix slash commands", () => {
    expect(interactivePrompt({ command: "/review", message: "diff" })).toBe("/review diff")
  })
})
