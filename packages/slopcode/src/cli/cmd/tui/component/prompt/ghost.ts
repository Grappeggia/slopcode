export type GhostLine = {
  top: number
  left: number
  text: string
}

function take(input: string, width: number) {
  if (width <= 0) {
    return {
      head: "",
      tail: input,
    }
  }

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

  return {
    head: input.slice(0, end),
    tail: input.slice(end),
  }
}

export function ghostCursor(
  input:
    | {
        isDestroyed?: boolean
        visualCursor: {
          visualRow: number
          visualCol: number
          offset: number
        }
      }
    | undefined,
  fallback: {
    row: number
    col: number
    offset: number
  },
) {
  if (!input || input.isDestroyed) return fallback
  const cursor = input.visualCursor
  return {
    row: cursor.visualRow,
    col: cursor.visualCol,
    offset: cursor.offset,
  }
}

export function ghostVisible(input: {
  ghost: string
  mode: "normal" | "shell"
  disabled?: boolean
  historyMode?: boolean
  historyTarget?: "prompt" | "timeline"
  autocompleteVisible: boolean
  focused: boolean
  cursorOffset: number
  inputLength: number
}) {
  if (!input.ghost) return false
  if (input.mode !== "normal") return false
  if (input.disabled) return false
  if (input.historyMode && input.historyTarget === "timeline") return false
  if (input.autocompleteVisible || !input.focused) return false
  if (input.cursorOffset !== input.inputLength) return false
  return true
}

export function ghostRemainder(input: string, suggestion: string) {
  if (!input) return
  const lhs = input.toLocaleLowerCase()
  const rhs = suggestion.toLocaleLowerCase()
  if (!rhs.startsWith(lhs)) return
  return suggestion.slice(input.length)
}

export function ghostLayout(input: { ghost: string; row: number; col: number; width: number; rows: number }) {
  if (!input.ghost) return []
  if (input.width <= 0 || input.rows <= 0) return []
  if (input.row >= input.rows) return []

  const lines: GhostLine[] = []
  let rest = input.ghost
  let row = input.row
  let left = input.col
  while (rest && row < input.rows) {
    const width = left === 0 ? input.width : input.width - left
    if (width <= 0) {
      row += 1
      left = 0
      continue
    }

    const next = take(rest, width)
    if (!next.head) break
    lines.push({
      top: row,
      left,
      text: next.head,
    })
    rest = next.tail
    row += 1
    left = 0
  }
  return lines
}

export function ghostExtraRows(input: { lines: Pick<GhostLine, "top">[]; height: number }) {
  const last = input.lines[input.lines.length - 1]
  if (!last) return 0
  return Math.max(0, last.top + 1 - input.height)
}
