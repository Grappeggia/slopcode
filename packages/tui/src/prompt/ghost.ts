import { Grapheme } from "@slopcode-ai/core/util/grapheme"
import { promptOffsetWidth } from "./display"

export type GhostInput = {
  enabled: boolean
  prefix: string
  min: number
  mode: "normal" | "shell"
  focused: boolean
  cursor: number
  popover: boolean
  parts: number
}

export function ghostEligible(input: GhostInput) {
  return (
    input.enabled &&
    input.mode === "normal" &&
    input.focused &&
    !input.popover &&
    input.parts === 0 &&
    input.cursor === promptOffsetWidth(input.prefix) &&
    input.prefix.trim().length >= input.min
  )
}

export function ghostRemainder(prefix: string, completion: string) {
  if (!completion.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())) return completion
  return completion.slice(prefix.length)
}

export function ghostAccept(prefix: string, ghost: string) {
  return prefix + ghost
}

export function ghostLayout(input: { ghost: string; row: number; col: number; width: number; rows: number }) {
  const result: { top: number; left: number; text: string }[] = []
  const chars = Grapheme.split(input.ghost)
  let top = input.row
  let left = input.col

  while (chars.length > 0 && top < input.rows) {
    const width = input.width - left
    if (width <= 0) {
      top += 1
      left = 0
      continue
    }

    const chunk: string[] = []
    while (chars.length > 0 && Bun.stringWidth(chunk.join("") + chars[0]) <= width) chunk.push(chars.shift()!)
    if (chunk.length === 0) {
      top += 1
      left = 0
      continue
    }
    result.push({ top, left, text: chunk.join("") })
    top += 1
    left = 0
  }
  return result
}

export function createGhostLifecycle() {
  let generation = 0
  let ctrl: AbortController | undefined

  return {
    begin() {
      ctrl?.abort()
      ctrl = new AbortController()
      generation += 1
      return { generation, signal: ctrl.signal }
    },
    clear() {
      ctrl?.abort()
      ctrl = undefined
      generation += 1
    },
    current(value: number) {
      return value === generation && !ctrl?.signal.aborted
    },
  }
}
