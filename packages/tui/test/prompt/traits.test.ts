import { describe, expect, test } from "bun:test"
import { computePromptTraits } from "../../src/prompt/traits"

describe("computePromptTraits", () => {
  test("normal mode without autocomplete only captures tab", () => {
    const traits = computePromptTraits({ mode: "normal", autocompleteVisible: false })
    expect(traits.capture).toEqual(["tab"])
    expect(traits.suspend).toBeUndefined()
    expect(traits.status).toBeUndefined()
  })

  test("normal mode with autocomplete captures navigation keys", () => {
    const traits = computePromptTraits({ mode: "normal", autocompleteVisible: true })
    expect(traits.capture).toEqual(["escape", "navigate", "submit", "tab"])
    expect(traits.suspend).toBeUndefined()
    expect(traits.status).toBeUndefined()
  })

  test("normal mode with ghost text captures dismissal before session escape", () => {
    const traits = computePromptTraits({ mode: "normal", autocompleteVisible: false, ghostVisible: true })

    expect(traits.capture).toEqual(["escape", "tab"])
  })

  test("shell mode disables capture and labels the prompt without suspending", () => {
    const traits = computePromptTraits({ mode: "shell", autocompleteVisible: false })
    expect(traits.capture).toBeUndefined()
    expect(traits.suspend).toBeUndefined()
    expect(traits.status).toBe("SHELL")
  })
})
