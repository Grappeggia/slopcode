import { findSlashTrigger, removeSlashTrigger } from "@slopcode-ai/util/slash"
import type { AgentPart, FileAttachmentPart, ImageAttachmentPart, Prompt, TextPart } from "@/context/prompt"

type PositionedPart = TextPart | FileAttachmentPart | AgentPart

const clonePart = (part: Prompt[number]): Prompt[number] => {
  if (part.type === "image") return { ...part }
  if (part.type === "file") return { ...part, selection: part.selection ? { ...part.selection } : undefined }
  return { ...part }
}

const textPart = (content: string): TextPart => ({
  type: "text",
  content,
  start: 0,
  end: 0,
})

const mergeText = (parts: Prompt) => {
  const next: Prompt = []
  for (const part of parts) {
    const current = clonePart(part)
    const prev = next.at(-1)
    if (current.type === "text" && prev?.type === "text") {
      prev.content += current.content
      continue
    }
    next.push(current)
  }
  return next
}

const reindex = (parts: Prompt) => {
  let position = 0
  const next = mergeText(parts).map((part) => {
    if (part.type === "image") return part

    const current = clonePart(part) as PositionedPart
    current.start = position
    current.end = position + current.content.length
    position = current.end
    return current
  })

  if (next.some((part) => part.type !== "image")) return next
  return [textPart(""), ...next]
}

const replaceRange = (prompt: Prompt, start: number, end: number, replacement: string) => {
  const next: Prompt = []
  let inserted = false

  for (const part of prompt) {
    if (part.type === "image") {
      next.push(clonePart(part))
      continue
    }

    if (part.end <= start) {
      next.push(clonePart(part))
      continue
    }

    if (part.start >= end) {
      if (!inserted && replacement) {
        next.push(textPart(replacement))
        inserted = true
      }
      next.push(clonePart(part))
      continue
    }

    if (part.type !== "text") {
      return reindex(prompt.map(clonePart))
    }

    const left = part.content.slice(0, Math.max(0, start - part.start))
    const right = part.content.slice(Math.max(0, end - part.start))
    if (left) next.push(textPart(left))
    if (!inserted && replacement) {
      next.push(textPart(replacement))
      inserted = true
    }
    if (right) next.push(textPart(right))
  }

  if (!inserted && replacement) next.push(textPart(replacement))
  return reindex(next)
}

const promptText = (prompt: Prompt) =>
  prompt
    .filter((part): part is Exclude<Prompt[number], ImageAttachmentPart> => part.type !== "image")
    .map((part) => part.content)
    .join("")

export function removePromptSlash(prompt: Prompt, cursor: number) {
  const trigger = findSlashTrigger(promptText(prompt), cursor)
  if (!trigger) return

  const removed = removeSlashTrigger(promptText(prompt), trigger)
  return {
    cursor: removed.cursor,
    prompt: replaceRange(prompt, removed.start, removed.end, ""),
  }
}

export function promotePromptSlash(prompt: Prompt, cursor: number, command: string) {
  const text = promptText(prompt)
  const trigger = findSlashTrigger(text, cursor)
  if (!trigger) return

  const removed = removeSlashTrigger(text, trigger)
  const base = replaceRange(prompt, removed.start, removed.end, "")
  const body = removed.text.trimStart()
  const trim = removed.text.length - body.length
  const compact = trim ? replaceRange(base, 0, trim, "") : base
  const prefix = `/${command} `

  return {
    cursor: prefix.length + body.length,
    prompt: replaceRange(compact, 0, 0, prefix),
  }
}
