import type { AutocompleteOption } from "./autocomplete"

export type AutocompleteLine = {
  text: string
  tone: "title" | "description"
}

function hard(input: string, width: number) {
  let end = 0
  let size = 0
  let index = 0
  for (const char of input) {
    const next = size + Bun.stringWidth(char)
    if (next > width) break
    size = next
    index += char.length
    end = index
  }
  return input.slice(0, end)
}

function split(input: string, width: number) {
  let end = 0
  let word = 0
  let size = 0
  let index = 0
  for (const char of input) {
    const next = size + Bun.stringWidth(char)
    if (next > width) break
    size = next
    index += char.length
    end = index
    if (/\s/.test(char)) word = index
  }
  if (!end) {
    return {
      head: "",
      tail: input.trimStart(),
    }
  }
  const cut = word > 0 ? word : end
  return {
    head: input.slice(0, cut).trimEnd(),
    tail: input.slice(cut).trimStart(),
  }
}

function clip(input: string, width: number) {
  const text = input.trim()
  if (!text) return ""
  if (Bun.stringWidth(text) <= width) return text
  if (width <= 1) return "…"
  return hard(text, width - 1).trimEnd() + "…"
}

function wrap(input: string, width: number, limit: number) {
  const text = input.replace(/\s+/g, " ").trim()
  if (!text) return []
  const lines: string[] = []
  let rest = text
  while (rest && lines.length < limit) {
    if (Bun.stringWidth(rest) <= width) {
      lines.push(rest)
      rest = ""
      break
    }
    const next = split(rest, width)
    if (!next.head) break
    lines.push(next.head)
    rest = next.tail
  }
  if (rest) {
    const last = lines.pop() ?? ""
    lines.push(clip(`${last} ${rest}`.trim(), width))
  }
  return lines
}

export function autocompleteSingleWidth(option: Pick<AutocompleteOption, "display" | "description">) {
  return Bun.stringWidth(option.display) + Bun.stringWidth(option.description ?? "")
}

export function autocompleteLines(
  option: Pick<AutocompleteOption, "display" | "description">,
  width: number,
): AutocompleteLine[] {
  const limit = Math.max(6, Math.floor(width))
  const lines: AutocompleteLine[] = []
  for (const text of wrap(option.display, limit, 2)) {
    lines.push({
      text,
      tone: "title",
    })
  }
  if (option.description) {
    for (const text of wrap(option.description, limit, 2)) {
      lines.push({
        text,
        tone: "description",
      })
    }
  }
  return lines.length > 0
    ? lines
    : [
        {
          text: "",
          tone: "title",
        },
      ]
}

export function autocompleteLineHeights(input: AutocompleteLine[][]) {
  return input.map((item) => Math.max(1, item.length))
}

export function autocompleteLineOffsets(heights: number[]) {
  let total = 0
  return heights.map((item) => {
    const start = total
    total += item
    return start
  })
}
