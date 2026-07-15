import type { EditorTraits } from "@opentui/core"

export type PromptMode = "normal" | "shell"

export interface PromptTraitsInput {
  mode: PromptMode
  autocompleteVisible: boolean
  ghostVisible?: boolean
}

export type PromptTraits = EditorTraits & {
  owner: "slopcode"
  role: "prompt"
}

/** The managed textarea keymap owns `suspend`; these traits only describe capture and status. */
export function computePromptTraits(input: PromptTraitsInput): PromptTraits {
  const capture =
    input.mode === "normal"
      ? input.autocompleteVisible
        ? (["escape", "navigate", "submit", "tab"] as const)
        : input.ghostVisible
          ? (["escape", "tab"] as const)
          : (["tab"] as const)
      : undefined
  return {
    capture,
    status: input.mode === "shell" ? "SHELL" : undefined,
    owner: "slopcode",
    role: "prompt",
  }
}
