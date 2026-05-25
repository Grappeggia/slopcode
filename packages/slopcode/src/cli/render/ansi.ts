import { TextAttributes, getBaseAttributes, getTreeSitterClient, treeSitterToStyledText } from "@opentui/core"
import { ensureDefaultParsers } from "./parsers"
import { createCliSyntaxTheme, createSyntaxStyle } from "./syntax"
import type { RichSegment } from "./types"

ensureDefaultParsers()

const syntax = createSyntaxStyle(createCliSyntaxTheme())

export async function renderSegmentsToAnsi(segments: RichSegment[]) {
  const result = [] as string[]
  for (const segment of segments) {
    if (segment.kind !== "code" || segment.filetype === "text") {
      result.push(segment.text)
      continue
    }

    const rendered = await highlight(segment.text, segment.filetype)
    result.push(rendered)
  }
  return result.join("\n")
}

async function highlight(text: string, filetype: string) {
  try {
    const styled = await treeSitterToStyledText(text, filetype, syntax, getTreeSitterClient())
    return styled.chunks.map(chunk).join("")
  } catch {
    return text
  }
}

function chunk(value: {
  text: string
  fg?: { toInts(): [number, number, number, number] }
  bg?: { toInts(): [number, number, number, number] }
  attributes?: number
}) {
  const base = getBaseAttributes(value.attributes ?? 0)
  const codes = [] as string[]

  if (value.fg) {
    const [r, g, b] = value.fg.toInts()
    codes.push(`38;2;${r};${g};${b}`)
  }
  if (value.bg) {
    const [r, g, b] = value.bg.toInts()
    codes.push(`48;2;${r};${g};${b}`)
  }
  if (base & TextAttributes.BOLD) codes.push("1")
  if (base & TextAttributes.DIM) codes.push("2")
  if (base & TextAttributes.ITALIC) codes.push("3")
  if (base & TextAttributes.UNDERLINE) codes.push("4")
  if (base & TextAttributes.BLINK) codes.push("5")
  if (base & TextAttributes.STRIKETHROUGH) codes.push("9")
  if (codes.length === 0) return value.text
  return `\u001b[${codes.join(";")}m${value.text}\u001b[0m`
}
