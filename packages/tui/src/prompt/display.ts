import { Grapheme } from "@slopcode-ai/core/util/grapheme"

export function promptOffsetWidth(value: string) {
  let width = 0
  for (const segment of Grapheme.split(value)) {
    // Textarea offsets count newlines as one position; Bun.stringWidth counts them as zero.
    width += segment === "\n" ? 1 : Bun.stringWidth(segment)
  }
  return width
}

function displayOffsetIndex(value: string, offset: number) {
  if (offset <= 0) return 0

  let width = 0
  let index = 0
  for (const segment of Grapheme.split(value)) {
    const next = width + promptOffsetWidth(segment)
    if (next > offset) return index
    width = next
    index += segment.length
  }

  return value.length
}

export function displaySlice(value: string, start = 0, end = promptOffsetWidth(value)) {
  return value.slice(displayOffsetIndex(value, start), displayOffsetIndex(value, end))
}

export function displayCharAt(value: string, offset: number) {
  let width = 0
  for (const segment of Grapheme.split(value)) {
    const next = width + promptOffsetWidth(segment)
    if (offset === width || offset < next) return segment
    width = next
  }
  return undefined
}

export function mentionTriggerIndex(value: string, offset = promptOffsetWidth(value)) {
  const text = displaySlice(value, 0, offset)
  const index = text.lastIndexOf("@")
  if (index === -1) return undefined

  const before = index === 0 ? undefined : text[index - 1]
  const query = text.slice(index)
  if ((before === undefined || /\s/.test(before)) && !/\s/.test(query)) {
    return promptOffsetWidth(text.slice(0, index))
  }
  return undefined
}
