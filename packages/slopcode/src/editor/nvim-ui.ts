type Cell = {
  text: string
  hl: number
}

type Grid = {
  width: number
  height: number
  rows: Cell[][]
}

export namespace NvimUI {
  export type Style = {
    fg?: string
    bg?: string
    bold?: boolean
    italic?: boolean
    underline?: boolean
    strikethrough?: boolean
    reverse?: boolean
  }

  export type Segment = Style & {
    text: string
  }

  export type Snapshot = {
    width: number
    height: number
    rows: Segment[][]
  }

  const blank = (): Cell => ({ text: " ", hl: 0 })

  const hex = (value?: number) => {
    if (typeof value !== "number") return undefined
    return "#" + value.toString(16).padStart(6, "0")
  }

  const clone = (width: number) => Array.from({ length: width }, blank)

  const style = (input?: Record<string, unknown>) => {
    const fg = typeof input?.foreground === "number" ? hex(input.foreground) : undefined
    const bg = typeof input?.background === "number" ? hex(input.background) : undefined
    const reverse = input?.reverse === true
    return {
      fg: reverse ? bg : fg,
      bg: reverse ? fg : bg,
      bold: input?.bold === true,
      italic: input?.italic === true,
      underline: input?.underline === true || input?.undercurl === true,
      strikethrough: input?.strikethrough === true,
      reverse,
    } satisfies Style
  }

  const equal = (a: Style, b: Style) => {
    return (
      a.fg === b.fg &&
      a.bg === b.bg &&
      a.bold === b.bold &&
      a.italic === b.italic &&
      a.underline === b.underline &&
      a.strikethrough === b.strikethrough &&
      a.reverse === b.reverse
    )
  }

  const invert = (input: Style, fg?: string, bg?: string) => {
    return {
      ...input,
      fg: input.bg ?? fg,
      bg: input.fg ?? bg,
    } satisfies Style
  }

  const rows = (width: number, height: number) => Array.from({ length: height }, () => clone(width))

  export function create() {
    const hl = new Map<number, Style>()
    const grids = new Map<number, Grid>()
    let cursor = { grid: 1, row: 0, col: 0 }
    let colors = { fg: "#ffffff", bg: "#000000" }
    let mode = "normal"
    let flushed = false

    const ensure = (id: number, width: number, height: number) => {
      const hit = grids.get(id)
      if (hit && hit.width === width && hit.height === height) return hit
      const next = { width, height, rows: rows(width, height) }
      grids.set(id, next)
      return next
    }

    const current = () => grids.get(cursor.grid) ?? grids.get(1) ?? Array.from(grids.values())[0]

    const applyResize = (item: unknown[]) => {
      const [id, width, height] = item
      if (typeof id !== "number" || typeof width !== "number" || typeof height !== "number") return
      ensure(id, width, height)
      flushed = true
    }

    const applyClear = (item: unknown[]) => {
      const [id] = item
      if (typeof id !== "number") return
      const grid = grids.get(id)
      if (!grid) return
      grid.rows = rows(grid.width, grid.height)
      flushed = true
    }

    const applyLine = (item: unknown[]) => {
      const [id, row, col, cells] = item
      if (typeof id !== "number" || typeof row !== "number" || typeof col !== "number" || !Array.isArray(cells)) return
      const grid = grids.get(id)
      if (!grid) return
      const line = grid.rows[row]
      if (!line) return
      let x = col
      let currentHl = 0
      for (const cell of cells) {
        if (!Array.isArray(cell)) continue
        const text = typeof cell[0] === "string" ? cell[0] : " "
        if (typeof cell[1] === "number") currentHl = cell[1]
        const repeat = typeof cell[2] === "number" && cell[2] > 0 ? cell[2] : 1
        for (let i = 0; i < repeat; i++) {
          if (x >= line.length) break
          line[x] = { text, hl: currentHl }
          x += 1
        }
      }
      flushed = true
    }

    const applyScroll = (item: unknown[]) => {
      const [id, top, bot, left, right, rows, cols] = item
      if (
        typeof id !== "number" ||
        typeof top !== "number" ||
        typeof bot !== "number" ||
        typeof left !== "number" ||
        typeof right !== "number" ||
        typeof rows !== "number" ||
        typeof cols !== "number"
      )
        return
      const grid = grids.get(id)
      if (!grid) return
      if (cols !== 0) return
      const next = grid.rows.map((line) => [...line])
      const fill = () => Array.from({ length: Math.max(0, right - left) }, blank)
      if (rows > 0) {
        for (let y = top; y < bot - rows; y++) {
          next[y]!.splice(left, right - left, ...grid.rows[y + rows]!.slice(left, right))
        }
        for (let y = bot - rows; y < bot; y++) {
          next[y]!.splice(left, right - left, ...fill())
        }
      }
      if (rows < 0) {
        const size = Math.abs(rows)
        for (let y = bot - 1; y >= top + size; y--) {
          next[y]!.splice(left, right - left, ...grid.rows[y - size]!.slice(left, right))
        }
        for (let y = top; y < top + size; y++) {
          next[y]!.splice(left, right - left, ...fill())
        }
      }
      grid.rows = next
      flushed = true
    }

    const applyCursor = (item: unknown[]) => {
      const [grid, row, col] = item
      if (typeof grid !== "number" || typeof row !== "number" || typeof col !== "number") return
      cursor = { grid, row, col }
      flushed = true
    }

    const applyHighlight = (item: unknown[]) => {
      const [id, rgb] = item
      if (typeof id !== "number" || typeof rgb !== "object" || !rgb) return
      hl.set(id, style(rgb as Record<string, unknown>))
      flushed = true
    }

    const applyDefaultColors = (item: unknown[]) => {
      const [fg, bg] = item
      colors = {
        fg: typeof fg === "number" ? (hex(fg) ?? colors.fg) : colors.fg,
        bg: typeof bg === "number" ? (hex(bg) ?? colors.bg) : colors.bg,
      }
      flushed = true
    }

    const applyMode = (item: unknown[]) => {
      const [name] = item
      if (typeof name !== "string") return
      mode = name
      flushed = true
    }

    const apply = (name: string, item: unknown[]) => {
      if (name === "grid_resize") return applyResize(item)
      if (name === "grid_clear") return applyClear(item)
      if (name === "grid_line") return applyLine(item)
      if (name === "grid_scroll") return applyScroll(item)
      if (name === "grid_cursor_goto") return applyCursor(item)
      if (name === "hl_attr_define") return applyHighlight(item)
      if (name === "default_colors_set") return applyDefaultColors(item)
      if (name === "mode_change") return applyMode(item)
      if (name === "flush") flushed = true
    }

    return {
      redraw(events: unknown[]) {
        let flush = false
        for (const event of events) {
          if (!Array.isArray(event) || typeof event[0] !== "string") continue
          const name = event[0]
          for (const item of event.slice(1)) {
            apply(name, Array.isArray(item) ? item : [item])
            if (name === "flush") flush = true
          }
        }
        return flush || flushed
      },
      mode() {
        return mode
      },
      snapshot() {
        const grid = current()
        if (!grid) {
          return {
            width: 0,
            height: 0,
            rows: [],
          } satisfies Snapshot
        }
        const rows = grid.rows.map((line, row) => {
          const out: Segment[] = []
          let text = ""
          let prev: Style | undefined
          const push = () => {
            if (!text || !prev) return
            out.push({ text, ...prev })
            text = ""
          }
          for (let col = 0; col < grid.width; col++) {
            const item = line[col] ?? blank()
            const next =
              col === cursor.col && row === cursor.row
                ? invert(hl.get(item.hl) ?? {}, colors.fg, colors.bg)
                : (hl.get(item.hl) ?? {})
            if (!prev || !equal(prev, next)) {
              push()
              prev = next
            }
            text += item.text || " "
          }
          push()
          return out.length > 0 ? out : [{ text: "" }]
        })
        flushed = false
        return {
          width: grid.width,
          height: grid.height,
          rows,
        } satisfies Snapshot
      },
    }
  }
}
