import { findSlashTrigger, removeSlashTrigger } from "@slopcode-ai/util/slash"
import type { PromptInfo } from "./history-store"

type Part = PromptInfo["parts"][number]

const sourceRange = (part: Part) => {
  if (part.type === "agent" && part.source) {
    return {
      start: part.source.start,
      end: part.source.end,
      set(start: number, end: number) {
        part.source!.start = start
        part.source!.end = end
      },
    }
  }

  if ((part.type === "file" || part.type === "text") && part.source?.text) {
    return {
      start: part.source.text.start,
      end: part.source.text.end,
      set(start: number, end: number) {
        part.source!.text.start = start
        part.source!.text.end = end
      },
    }
  }
}

const shiftParts = (parts: PromptInfo["parts"], delta: number, start = 0) =>
  parts.map((part) => {
    const next = structuredClone(part)
    const range = sourceRange(next)
    if (!range) return next
    if (range.end <= start) return next
    if (range.start < start) return next
    range.set(range.start + delta, range.end + delta)
    return next
  })

export function removePromptSlash(prompt: PromptInfo, cursor: number) {
  const trigger = findSlashTrigger(prompt.input, cursor)
  if (!trigger) return

  const removed = removeSlashTrigger(prompt.input, trigger)
  return {
    cursor: removed.cursor,
    prompt: {
      ...structuredClone(prompt),
      input: removed.text,
      parts: shiftParts(prompt.parts, removed.text.length - prompt.input.length, removed.end),
    } satisfies PromptInfo,
  }
}

export function promotePromptSlash(prompt: PromptInfo, cursor: number, command: string) {
  const removed = removePromptSlash(prompt, cursor)
  if (!removed) return

  const body = removed.prompt.input.trimStart()
  const trim = removed.prompt.input.length - body.length
  const prefix = `/${command} `
  const shifted = shiftParts(removed.prompt.parts, -trim, trim)

  return {
    cursor: prefix.length + body.length,
    prompt: {
      ...removed.prompt,
      input: body ? prefix + body : prefix,
      parts: shiftParts(shifted, prefix.length),
    } satisfies PromptInfo,
  }
}
