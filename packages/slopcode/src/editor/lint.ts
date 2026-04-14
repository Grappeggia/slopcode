import { parse, printParseErrorCode, type ParseError } from "jsonc-parser"
import * as path from "node:path"
import type { Diagnostic } from "./types"

const js = new Set([".js", ".jsx", ".mjs", ".cjs"])
const ts = new Set([".ts", ".tsx", ".mts", ".cts", ".mtsx", ".ctsx"])
const json = new Set([".json", ".jsonc"])

const point = (text: string, offset: number) => {
  const head = text.slice(0, Math.max(0, offset))
  const lines = head.split("\n")
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  }
}

const syntax = (file: string, text: string) => {
  const ext = path.extname(file).toLowerCase()
  if (!js.has(ext) && !ts.has(ext)) return [] as Diagnostic[]
  const loader = ext.includes("x") ? (ts.has(ext) ? "tsx" : "jsx") : ts.has(ext) ? "ts" : "js"
  try {
    new Bun.Transpiler({ loader }).transformSync(text)
    return [] as Diagnostic[]
  } catch (error) {
    const issue = error as {
      errors?: unknown[]
      line?: number
      column?: number
      originalLine?: number
      originalColumn?: number
      message?: string
    }
    const line = Number(issue.originalLine ?? issue.line ?? 1)
    const column = Number(issue.originalColumn ?? issue.column ?? 1)
    return [
      {
        line,
        column,
        severity: "error",
        message: issue.message ?? "Parse error",
      } satisfies Diagnostic,
    ]
  }
}

const structured = (file: string, text: string) => {
  const ext = path.extname(file).toLowerCase()
  if (!json.has(ext)) return [] as Diagnostic[]
  const errors: ParseError[] = []
  parse(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  })
  return errors.map((item) => {
    const hit = point(text, item.offset)
    return {
      line: hit.line,
      column: hit.column,
      severity: "error",
      message: printParseErrorCode(item.error),
    } satisfies Diagnostic
  })
}

const simple = (text: string) => {
  return text
    .split("\n")
    .flatMap((line, i) => {
      const out: Diagnostic[] = []
      if (/^(<{7}|={7}|>{7})/.test(line)) {
        out.push({
          line: i + 1,
          column: 1,
          severity: "error",
          message: "Unresolved merge conflict marker",
        })
      }
      if (/[ \t]+$/.test(line)) {
        out.push({
          line: i + 1,
          column: Math.max(1, line.length),
          severity: "warning",
          message: "Trailing whitespace",
        })
      }
      return out
    })
    .slice(0, 20)
}

export function lint(file: string, text: string) {
  return [...syntax(file, text), ...structured(file, text), ...simple(text)]
}
