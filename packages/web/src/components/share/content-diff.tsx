import { diffWordsWithSpace, parsePatch } from "diff"
import { For, Suspense, createMemo, createResource } from "solid-js"
import { bundledLanguages, codeToTokens } from "shiki"
import styles from "./content-diff.module.css"

type DiffPart = {
  emphasis?: boolean
  text: string
}

type DiffRow = {
  left: DiffPart[]
  right: DiffPart[]
  type: "added" | "removed" | "unchanged" | "modified"
}

type DiffBlock = {
  type: "removed" | "added" | "unchanged"
  lines: DiffPart[][]
}

type Token = Awaited<ReturnType<typeof codeToTokens>>["tokens"][number][number]
type Tone = "added" | "removed" | "context" | undefined

interface Props {
  diff: string
  lang?: string
}

function merge(parts: DiffPart[]) {
  return parts.reduce<DiffPart[]>((acc, part) => {
    const last = acc.at(-1)
    if (!last || last.emphasis !== part.emphasis) {
      acc.push({ ...part })
      return acc
    }

    last.text += part.text
    return acc
  }, [])
}

function text(parts: DiffPart[]) {
  return parts.map((part) => part.text).join("")
}

function pair(left: string, right: string) {
  const out = { left: [] as DiffPart[], right: [] as DiffPart[] }

  diffWordsWithSpace(left, right).forEach((part) => {
    if (part.removed) {
      out.left.push({ emphasis: true, text: part.value })
      return
    }

    if (part.added) {
      out.right.push({ emphasis: true, text: part.value })
      return
    }

    out.left.push({ text: part.value })
    out.right.push({ text: part.value })
  })

  return {
    left: merge(out.left),
    right: merge(out.right),
  }
}

function tone(type: DiffRow["type"], side: "left" | "right"): Tone {
  if (type === "unchanged") return "context"
  if (type === "modified") return side === "left" ? "removed" : "added"
  if (type === "removed" && side === "left") return "removed"
  if (type === "added" && side === "right") return "added"
}

function emphasis(parts: DiffPart[]) {
  const out: { end: number; start: number }[] = []
  let start = 0

  parts.forEach((part) => {
    const end = start + part.text.length
    if (part.emphasis && end > start) out.push({ end, start })
    start = end
  })

  return out
}

function style(token: Token) {
  const out: Record<string, string> = { ...(token.htmlStyle ?? {}) }
  const font = token.fontStyle ?? 0

  if (token.color && !out.color) out.color = token.color
  if (token.bgColor && !out["background-color"]) out["background-color"] = token.bgColor
  if (font & 1) out["font-style"] = "italic"
  if (font & 2) out["font-weight"] = "700"
  if (font & 4) out["text-decoration"] = "underline"
  if (font & 8)
    out["text-decoration"] = out["text-decoration"] ? `${out["text-decoration"]} line-through` : "line-through"

  return out
}

function split(tokens: Token[], parts: DiffPart[]) {
  const marks = emphasis(parts)
  const out: { emphasis: boolean; style: Record<string, string>; text: string }[] = []

  tokens.forEach((token) => {
    const tokenStart = token.offset
    const tokenEnd = tokenStart + token.content.length
    let cursor = tokenStart

    const push = (start: number, end: number, active: boolean) => {
      if (end <= start) return
      out.push({
        emphasis: active,
        style: style(token),
        text: token.content.slice(start - tokenStart, end - tokenStart),
      })
    }

    marks.forEach((mark) => {
      if (mark.end <= cursor || mark.start >= tokenEnd) return
      if (mark.start > cursor) push(cursor, Math.min(mark.start, tokenEnd), false)
      const start = Math.max(cursor, mark.start)
      const end = Math.min(tokenEnd, mark.end)
      push(start, end, true)
      cursor = end
    })

    if (cursor < tokenEnd) push(cursor, tokenEnd, false)
  })

  return out
}

function ContentDiffLine(props: { lang?: string; parts: DiffPart[]; tone: Tone }) {
  const code = createMemo(() => text(props.parts))
  const [tokens] = createResource(
    () => [code(), props.lang],
    async ([value, lang]) => {
      if (!value) return []
      const fileLang = lang && lang in bundledLanguages ? (lang as keyof typeof bundledLanguages) : "text"
      return (
        (
          await codeToTokens(value, {
            lang: fileLang,
            themes: {
              light: "github-light",
              dark: "github-dark",
            },
          })
        ).tokens[0] ?? []
      )
    },
  )
  const pieces = createMemo(() => split(tokens() ?? [], props.parts))

  return (
    <Suspense>
      <div data-slot="code" data-empty={code().length === 0 ? true : undefined}>
        <pre>
          <code>
            <For each={code().length === 0 ? [{ emphasis: false, style: {}, text: "\u00a0" }] : pieces()}>
              {(part) => (
                <span
                  style={part.style}
                  data-emphasis={part.emphasis ? true : undefined}
                  data-emphasis-tone={part.emphasis ? props.tone : undefined}
                >
                  {part.text}
                </span>
              )}
            </For>
          </code>
        </pre>
      </div>
    </Suspense>
  )
}

export function ContentDiff(props: Props) {
  const rows = createMemo(() => {
    const diffRows: DiffRow[] = []

    try {
      const patches = parsePatch(props.diff)

      for (const patch of patches) {
        for (const hunk of patch.hunks) {
          const lines = hunk.lines
          let i = 0

          while (i < lines.length) {
            const line = lines[i]
            const content = line.slice(1)
            const prefix = line[0]

            if (prefix === "-") {
              const removals = [content]
              let j = i + 1

              while (j < lines.length && lines[j][0] === "-") {
                removals.push(lines[j].slice(1))
                j += 1
              }

              const additions: string[] = []
              while (j < lines.length && lines[j][0] === "+") {
                additions.push(lines[j].slice(1))
                j += 1
              }

              Array.from({ length: Math.max(removals.length, additions.length) }).forEach((_, k) => {
                const left = removals[k]
                const right = additions[k]

                if (left !== undefined && right !== undefined) {
                  diffRows.push({ ...pair(left, right), type: "modified" })
                  return
                }

                if (left !== undefined) {
                  diffRows.push({ left: [{ text: left }], right: [], type: "removed" })
                  return
                }

                if (right !== undefined) {
                  diffRows.push({ left: [], right: [{ text: right }], type: "added" })
                }
              })

              i = j
            } else if (prefix === "+") {
              diffRows.push({ left: [], right: [{ text: content }], type: "added" })
              i += 1
            } else if (prefix === " ") {
              diffRows.push({ left: [{ text: content }], right: [{ text: content }], type: "unchanged" })
              i += 1
            } else {
              i += 1
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to parse patch:", error)
      return []
    }

    return diffRows
  })

  const mobileRows = createMemo(() => {
    const blocks: DiffBlock[] = []
    const current = rows()
    let i = 0

    while (i < current.length) {
      const removed: DiffPart[][] = []
      const added: DiffPart[][] = []

      while (
        i < current.length &&
        (current[i].type === "modified" || current[i].type === "removed" || current[i].type === "added")
      ) {
        const row = current[i]
        if (row.type === "removed") removed.push(row.left)
        if (row.type === "added") added.push(row.right)
        if (row.type === "modified") {
          removed.push(row.left)
          added.push(row.right)
        }
        i += 1
      }

      if (removed.length > 0) blocks.push({ type: "removed", lines: removed })
      if (added.length > 0) blocks.push({ type: "added", lines: added })

      if (i < current.length && current[i].type === "unchanged") {
        blocks.push({ type: "unchanged", lines: [current[i].left] })
        i += 1
      }
    }

    return blocks
  })

  return (
    <div class={styles.root}>
      <div data-component="desktop">
        <For each={rows()}>
          {(row) => (
            <div data-component="diff-row" data-type={row.type}>
              <div data-slot="before" data-diff-type={tone(row.type, "left") ?? ""}>
                <ContentDiffLine parts={row.left} tone={tone(row.type, "left")} lang={props.lang} />
              </div>
              <div data-slot="after" data-diff-type={tone(row.type, "right") ?? ""}>
                <ContentDiffLine parts={row.right} tone={tone(row.type, "right")} lang={props.lang} />
              </div>
            </div>
          )}
        </For>
      </div>

      <div data-component="mobile">
        <For each={mobileRows()}>
          {(block) => (
            <div data-component="diff-block" data-type={block.type}>
              <For each={block.lines}>
                {(line) => (
                  <div data-diff-type={block.type === "unchanged" ? "context" : block.type}>
                    <ContentDiffLine
                      parts={line}
                      tone={block.type === "unchanged" ? "context" : block.type}
                      lang={props.lang}
                    />
                  </div>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
