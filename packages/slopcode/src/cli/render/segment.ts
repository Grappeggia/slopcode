import { findHeredocEnd, parseHeredoc } from "./heredoc"
import { resolveCodeLanguage } from "./language"
import type { RenderSegment, RichSegment, RichTextStream } from "./types"

export function segmentRichText(input: string) {
  const text = normalize(input)
  const lines = text.split("\n")
  const segments = [] as RichSegment[]
  const prose = [] as string[]
  let i = 0

  const flush = () => {
    if (!prose.length) return
    pushSegments(segments, segmentPlain(prose.join("\n")))
    prose.length = 0
  }

  while (i < lines.length) {
    const line = lines[i]
    const match = line.match(/^```([^\s`]*)\s*$/)
    if (!match) {
      prose.push(line)
      i++
      continue
    }

    flush()
    const body = [] as string[]
    const language = resolveCodeLanguage(match[1])
    const start = i
    i++

    while (i < lines.length && !/^```\s*$/.test(lines[i]!)) {
      body.push(lines[i]!)
      i++
    }

    if (i >= lines.length) {
      push(segments, {
        kind: "markdown",
        text: lines.slice(start).join("\n"),
      })
      break
    }

    i++
    push(segments, {
      kind: "code",
      filetype: language,
      text: body.join("\n"),
    })
  }

  flush()
  return segments
}

export function updateRichTextStream(state: RichTextStream | undefined, input: string, done = false) {
  const text = normalize(input)
  if (!state) return rebuildRichTextStream(text, done)
  if (!text.startsWith(state.text)) return rebuildRichTextStream(text, done)
  const boundary = done ? text.length : richTextBoundary(text)
  if (boundary < state.boundary) return rebuildRichTextStream(text, done)
  if (boundary === state.boundary) {
    return {
      ...state,
      text,
      tail: buildTail(text, boundary),
    }
  }

  const next = buildSealed(text.slice(state.boundary, boundary), state.next)
  return {
    text,
    boundary,
    sealed: [...state.sealed, ...next],
    tail: buildTail(text, boundary),
    next: state.next + next.length,
  }
}

export function segmentsToMarkdown(segments: RichSegment[]) {
  return segments
    .map((segment) => {
      if (segment.kind === "markdown") return segment.text
      if (segment.kind === "plain") return `\`\`\`text\n${segment.text}\n\`\`\``
      return `\`\`\`${segment.filetype}\n${segment.text}\n\`\`\``
    })
    .filter(Boolean)
    .join("\n\n")
}

function segmentPlain(text: string) {
  const lines = text.split("\n")
  const segments = [] as RichSegment[]
  const prose = [] as string[]
  let i = 0

  const flush = () => {
    if (!prose.length) return
    push(segments, {
      kind: "markdown",
      text: prose.join("\n"),
    })
    prose.length = 0
  }

  while (i < lines.length) {
    if (!isTranscriptStart(lines[i]!)) {
      prose.push(lines[i]!)
      i++
      continue
    }

    flush()
    const result = consumeTranscript(lines, i)
    pushSegments(segments, result.segments)
    i = result.next
  }

  flush()
  return segments
}

function consumeTranscript(lines: string[], start: number) {
  const segments = [] as RichSegment[]
  let i = start

  while (i < lines.length) {
    const line = lines[i]!

    if (line.startsWith("$ ") || line.startsWith("# ")) {
      push(segments, {
        kind: "code",
        filetype: "bash",
        text: line,
      })

      const heredoc = parseHeredoc(line)
      i++
      if (!heredoc) continue

      const end = findHeredocEnd(lines, i, heredoc.marker)
      if (end === undefined) {
        push(segments, {
          kind: "code",
          filetype: heredoc.filetype,
          text: lines
            .slice(i)
            .map((item) => (heredoc.stripTabs ? item.replace(/^\t/, "") : item))
            .join("\n"),
        })
        return { next: lines.length, segments }
      }

      const body = lines
        .slice(i, end)
        .map((item) => (heredoc.stripTabs ? item.replace(/^\t/, "") : item))
        .join("\n")
      if (body) {
        push(segments, {
          kind: "code",
          filetype: heredoc.filetype,
          text: body,
        })
      }
      push(segments, {
        kind: "code",
        filetype: "bash",
        text: lines[end]!,
      })
      i = end + 1
      continue
    }

    if (line === "" && endsTranscript(lines, i)) break

    const output = [] as string[]
    while (i < lines.length) {
      const current = lines[i]!
      if (current.startsWith("$ ") || current.startsWith("# ")) break
      if (current === "" && endsTranscript(lines, i)) break
      output.push(current)
      i++
    }

    if (output.length) {
      push(segments, {
        kind: "plain",
        text: output.join("\n"),
      })
    }
  }

  return { next: i, segments }
}

function richTextBoundary(text: string) {
  const lines = split(text)
  if (!lines.length) return 0
  let cut = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!
    if (line.text === "") {
      cut = line.end
      i++
      continue
    }

    if (isFenceStart(line.text)) {
      const end = findFenceEnd(lines, i + 1)
      if (end === undefined) return line.start
      cut = lines[end]!.end
      i = end + 1
      continue
    }

    if (isTranscriptStart(line.text)) {
      const end = findTranscriptEnd(lines, i)
      if (end === undefined) return line.start
      cut = end.cut
      i = end.next
      continue
    }

    if (isHeading(line.text) && line.closed) {
      cut = line.end
      i++
      continue
    }

    const start = line.start
    i++

    while (i < lines.length) {
      const next = lines[i]!
      if (next.text === "") {
        cut = next.end
        i++
        break
      }
      if (isFenceStart(next.text) || isTranscriptStart(next.text)) {
        cut = next.start
        break
      }
      i++
    }

    if (i >= lines.length) return start
  }

  return cut
}

function endsTranscript(lines: string[], index: number) {
  for (let i = index + 1; i < lines.length; i++) {
    const line = lines[i]!
    if (!line.trim()) continue
    return !line.startsWith("$") && !line.startsWith("#")
  }
  return true
}

function isTranscriptStart(line: string) {
  return line.startsWith("$ ")
}

function isHeading(line: string) {
  return /^#{1,6}\s/.test(line)
}

function isFenceStart(line: string) {
  return /^```([^\s`]*)\s*$/.test(line)
}

function findFenceEnd(lines: Line[], start: number) {
  for (let i = start; i < lines.length; i++) {
    if (/^```\s*$/.test(lines[i]!.text)) return i
  }
}

function findTranscriptEnd(lines: Line[], start: number) {
  const text = lines.map((line) => line.text)
  let i = start

  while (i < lines.length) {
    const line = text[i]!
    if (line.startsWith("$ ") || line.startsWith("# ")) {
      const heredoc = parseHeredoc(line)
      i++
      if (!heredoc) continue
      const end = findHeredocEnd(text, i, heredoc.marker)
      if (end === undefined) return
      i = end + 1
      continue
    }

    if (line === "" && endsTranscript(text, i)) {
      return {
        cut: lines[i]!.start,
        next: i,
      }
    }

    i++
  }
}

function rebuildRichTextStream(text: string, done: boolean) {
  const boundary = done ? text.length : richTextBoundary(text)
  const sealed = buildSealed(text.slice(0, boundary), 0)
  return {
    text,
    boundary,
    sealed,
    tail: buildTail(text, boundary),
    next: sealed.length,
  } satisfies RichTextStream
}

function buildSealed(text: string, start: number) {
  return mark(segmentRichText(text), start, false)
}

function buildTail(text: string, boundary: number) {
  if (boundary >= text.length) return [] as RenderSegment[]
  return mark(segmentRichText(text.slice(boundary)), 0, true, "tail")
}

function mark(segments: RichSegment[], start: number, streaming: boolean, prefix = "seg") {
  return segments.map((segment, index) => ({
    ...segment,
    id: `${prefix}_${start + index}`,
    streaming,
  })) satisfies RenderSegment[]
}

function normalize(input: string) {
  return input.replace(/\r\n?/g, "\n")
}

type Line = {
  text: string
  start: number
  end: number
  closed: boolean
}

function split(text: string) {
  const result = [] as Line[]
  let start = 0

  while (start < text.length) {
    const next = text.indexOf("\n", start)
    if (next === -1) {
      result.push({ text: text.slice(start), start, end: text.length, closed: false })
      return result
    }

    result.push({ text: text.slice(start, next), start, end: next + 1, closed: true })
    start = next + 1
  }

  return result
}

function pushSegments(target: RichSegment[], segments: RichSegment[]) {
  for (const segment of segments) push(target, segment)
}

function push(target: RichSegment[], next: RichSegment) {
  if (!next.text) return
  const prev = target.at(-1)
  if (!prev) {
    target.push(next)
    return
  }
  if (prev.kind !== next.kind) {
    target.push(next)
    return
  }
  if (prev.kind === "code" && next.kind === "code" && prev.filetype !== next.filetype) {
    target.push(next)
    return
  }
  prev.text += `\n${next.text}`
}
