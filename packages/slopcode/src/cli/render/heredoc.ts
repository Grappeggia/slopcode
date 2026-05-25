import { inferInterpreterLanguage, inferMarkerLanguage, resolveCodeLanguage } from "./language"

export type Heredoc = {
  marker: string
  filetype: string
  stripTabs: boolean
}

const pattern = /<<(-)?\s*(['"]?)([A-Za-z_][A-Za-z0-9_-]*)\2/

export function parseHeredoc(line: string) {
  const match = line.match(pattern)
  if (!match) return
  const marker = match[3]
  if (!marker) return
  const inferred = inferInterpreterLanguage(line) ?? inferMarkerLanguage(marker) ?? "text"
  return {
    marker,
    filetype: resolveCodeLanguage(inferred),
    stripTabs: !!match[1],
  } satisfies Heredoc
}

export function findHeredocEnd(lines: string[], start: number, marker: string) {
  for (let i = start; i < lines.length; i++) {
    if (lines[i] === marker) return i
  }
}
