import { bundledLanguages, codeToTokens, type BundledLanguage } from "shiki"
import * as path from "node:path"
import { LANGUAGE_EXTENSIONS } from "@/lsp/language"
import type { Diagnostic, Segment, Style } from "./types"

type Token = Awaited<ReturnType<typeof codeToTokens>>["tokens"][number][number]

export const gutter = (lines: number) => String(Math.max(1, lines)).length + 3

type Input = {
  file: string
  lines: string[]
  row: number
  col: number
  top: number
  left: number
  width: number
  height: number
  diagnostics: Diagnostic[]
}

const palette = {
  cursor_bg: "#3B82F6",
  cursor_fg: "#0B1220",
  gutter: "#6B7280",
  gutter_error: "#EF4444",
  gutter_warning: "#F59E0B",
  text: "#D1D5DB",
}

const alias: Record<string, string> = {
  astro: "astro",
  dockerfile: "docker",
  javascriptreact: "jsx",
  jsonc: "jsonc",
  objective_c: "c",
  objective_cpp: "cpp",
  shellscript: "bash",
  terraform_vars: "terraform",
  typescriptreact: "tsx",
}

const supported = new Set(Object.keys(bundledLanguages))

const style = (token: Token): Style => {
  const out: Style = {}
  const font = token.fontStyle ?? 0
  if (token.color) out.fg = token.color
  if (token.bgColor) out.bg = token.bgColor
  if (font & 1) out.italic = true
  if (font & 2) out.bold = true
  if (font & 4) out.underline = true
  if (font & 8) out.strikethrough = true
  return out
}

const filetype = (file: string) => {
  const ext = path.extname(file).toLowerCase()
  const base = path.basename(file).toLowerCase()
  const raw = LANGUAGE_EXTENSIONS[ext] ?? LANGUAGE_EXTENSIONS[base]
  if (!raw) return "text"
  const key = raw.replace(/[-.]/g, "_")
  const hit = alias[key] ?? raw
  if (supported.has(hit)) return hit as BundledLanguage
  return "text"
}

const plain = (lines: string[]) => {
  return lines.map((line) => [{ text: line, fg: palette.text }] satisfies Segment[])
}

const crop = (parts: Segment[], left: number, width: number) => {
  if (width <= 0) return [] as Segment[]
  let start = 0
  let remaining = width
  return parts.flatMap((part) => {
    const end = start + part.text.length
    if (end <= left || remaining <= 0) {
      start = end
      return []
    }
    const from = Math.max(left - start, 0)
    const to = Math.min(part.text.length, from + remaining)
    start = end
    remaining -= to - from
    if (to <= from) return []
    return [{ ...part, text: part.text.slice(from, to) }]
  })
}

const cursor = (parts: Segment[], col: number) => {
  let start = 0
  const out = parts.flatMap((part) => {
    const end = start + part.text.length
    if (col < start || col >= end) {
      start = end
      return [part]
    }
    const hit = col - start
    start = end
    return [
      part.text.slice(0, hit) ? { ...part, text: part.text.slice(0, hit) } : undefined,
      {
        ...part,
        bg: palette.cursor_bg,
        fg: palette.cursor_fg,
        text: part.text[hit] ?? " ",
      },
      part.text.slice(hit + 1) ? { ...part, text: part.text.slice(hit + 1) } : undefined,
    ].filter((item): item is Segment => !!item)
  })
  if (col >= start) return [...out, { text: " ", bg: palette.cursor_bg, fg: palette.cursor_fg }]
  return out
}

export async function render(input: Input) {
  const total = Math.max(1, input.lines.length)
  const size = gutter(total)
  const body = Math.max(1, input.width - size)
  const visible = input.lines.slice(input.top, input.top + input.height)
  const lang = filetype(input.file)
  const highlighted =
    lang === "text"
      ? plain(visible)
      : await codeToTokens(visible.join("\n"), { lang, theme: "github-dark" })
          .then((result) =>
            result.tokens.map((line) => line.map((token) => ({ ...style(token), text: token.content || " " }) satisfies Segment)),
          )
          .catch(() => plain(visible))
  const marks = new Map(input.diagnostics.map((item) => [item.line - 1, item.severity]))

  return Array.from({ length: input.height }, (_, i) => {
    const line = input.top + i
    const text = highlighted[i] ?? []
    const view = crop(text, input.left, body)
    const bodyRow = line === input.row ? cursor(view, Math.max(0, input.col - input.left)) : view
    const mark = marks.get(line)
    return [
      {
        text: `${String(line + 1).padStart(size - 3, " ")} `,
        fg: palette.gutter,
      },
      {
        text: mark === "error" ? "!" : mark === "warning" ? "~" : " ",
        fg: mark === "error" ? palette.gutter_error : mark === "warning" ? palette.gutter_warning : palette.gutter,
      },
      { text: " ", fg: palette.gutter },
      ...(bodyRow.length > 0 ? bodyRow : [{ text: line === input.row ? " " : "", bg: line === input.row ? palette.cursor_bg : undefined }]),
    ] satisfies Segment[]
  })
}
