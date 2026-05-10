import type { PromptRef } from "../component/prompt"
import { removePromptSlash } from "../component/prompt/slash"

export function dismissPromptSlash(prompt?: PromptRef) {
  if (!prompt) return false
  const next = removePromptSlash(prompt.current, prompt.current.input.length)
  if (!next) return false
  prompt.set(next.prompt)
  return true
}
