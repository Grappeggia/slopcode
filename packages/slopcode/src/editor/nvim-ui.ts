type Cell = {
  text: string
  hl: number
}

type Grid = {
  width: number
  height: number
  rows: Cell[][]
}

type Window = {
  row: number
  col: number
  z: number
  hidden: boolean
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

  const content = (input: unknown): string => {
    if (typeof input === "string") return input
    if (!Array.isArray(input)) return ""
    if (typeof input[1] === "string") return String(input[1])
    return input.map(content).join("")
  }

  const label = (input: unknown) => {
    if (!Array.isArray(input)) return ""
    const head = typeof input[0] === "string" ? input[0] : ""
    const menu = typeof input[2] === "string" && input[2] ? ` ${input[2]}` : ""
    return head + menu
  }

  export function create() {
    const hl = new Map<number, Style>()
    const grids = new Map<number, Grid>()
    const windows = new Map<number, Window>()
    let cursor = { grid: 1, row: 0, col: 0 }
    let colors = { fg: "#ffffff", bg: "#000000" }
    let mode = "normal"
    let flushed = false
    let cmdline = ""
    let popup = {
      visible: false,
      row: 0,
      col: 0,
      selected: -1,
      items: [] as string[],
    }
    let messages: string[] = []

    const ensure = (id: number, width: number, height: number) => {
      const hit = grids.get(id)
      if (hit && hit.width === width && hit.height === height) return hit
      const next = { width, height, rows: rows(width, height) }
      if (hit) {
        const h = Math.min(hit.height, height)
        const w = Math.min(hit.width, width)
        for (let row = 0; row < h; row++) {
          for (let col = 0; col < w; col++) {
            next.rows[row]![col] = hit.rows[row]![col] ?? blank()
          }
        }
      }
      grids.set(id, next)
      const prev = windows.get(id)
      windows.set(id, {
        row: prev?.row ?? 0,
        col: prev?.col ?? 0,
        z: prev?.z ?? id,
        hidden: prev?.hidden ?? false,
      })
      return next
    }

    const paint = (grid: Cell[][], row: number, col: number, text: string) => {
      if (!text) return
      Array.from(text).forEach((char, index) => {
        const line = grid[row]
        const cell = line?.[col + index]
        if (!cell) return
        line[col + index] = { text: char, hl: 0 }
      })
    }

    const cursorCell = () => {
      const win = windows.get(cursor.grid) ?? windows.get(1) ?? { row: 0, col: 0 }
      return {
        row: win.row + cursor.row,
        col: win.col + cursor.col,
      }
    }

    const frame = () => {
      const visible = Array.from(grids.entries())
        .map(([id, grid]) => {
          const win = windows.get(id) ?? { row: 0, col: 0, z: id, hidden: false }
          if (win.hidden) return
          return { id, grid, win }
        })
        .filter((item): item is { id: number; grid: Grid; win: Window } => !!item)
      if (visible.length === 0) {
        return {
          width: 0,
          height: 0,
          rows: [] as Cell[][],
        }
      }
      const menuWidth = popup.visible ? Math.max(0, ...popup.items.map((item) => item.length + 2)) : 0
      const menuHeight = popup.visible ? popup.items.length : 0
      const width = Math.max(
        ...visible.map((item) => item.win.col + item.grid.width),
        popup.col + menuWidth,
        cmdline.length,
        ...messages.map((item) => item.length),
      )
      const height = Math.max(...visible.map((item) => item.win.row + item.grid.height), popup.row + menuHeight, 1)
      const next = rows(Math.max(0, width), Math.max(0, height))
      visible
        .sort((a, b) => a.win.z - b.win.z || a.id - b.id)
        .forEach((item) => {
          for (let row = 0; row < item.grid.height; row++) {
            for (let col = 0; col < item.grid.width; col++) {
              const target = next[item.win.row + row]?.[item.win.col + col]
              if (!target) continue
              next[item.win.row + row]![item.win.col + col] = item.grid.rows[row]![col] ?? blank()
            }
          }
        })
      if (popup.visible) {
        popup.items.forEach((item, index) => {
          const prefix = index === popup.selected ? "> " : "  "
          paint(next, popup.row + index, popup.col, prefix + item)
        })
      }
      if (messages.length > 0) {
        const start = Math.max(0, height - messages.length - (cmdline ? 1 : 0))
        messages.forEach((item, index) => {
          paint(next, start + index, 0, item)
        })
      }
      if (cmdline) {
        paint(next, Math.max(0, height - 1), 0, cmdline)
      }
      return {
        width: Math.max(0, width),
        height: Math.max(0, height),
        rows: next,
      }
    }

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
      const [id, top, bot, left, right, step, cols] = item
      if (
        typeof id !== "number" ||
        typeof top !== "number" ||
        typeof bot !== "number" ||
        typeof left !== "number" ||
        typeof right !== "number" ||
        typeof step !== "number" ||
        typeof cols !== "number"
      )
        return
      const grid = grids.get(id)
      if (!grid) return
      if (cols !== 0) return
      const next = grid.rows.map((line) => [...line])
      const fill = () => Array.from({ length: Math.max(0, right - left) }, blank)
      if (step > 0) {
        for (let row = top; row < bot - step; row++) {
          next[row]!.splice(left, right - left, ...grid.rows[row + step]!.slice(left, right))
        }
        for (let row = bot - step; row < bot; row++) {
          next[row]!.splice(left, right - left, ...fill())
        }
      }
      if (step < 0) {
        const size = Math.abs(step)
        for (let row = bot - 1; row >= top + size; row--) {
          next[row]!.splice(left, right - left, ...grid.rows[row - size]!.slice(left, right))
        }
        for (let row = top; row < top + size; row++) {
          next[row]!.splice(left, right - left, ...fill())
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

    const place = (id: number, row: number, col: number, z?: number) => {
      const win = windows.get(id) ?? { row: 0, col: 0, z: id, hidden: false }
      windows.set(id, {
        row,
        col,
        z: z ?? win.z,
        hidden: false,
      })
      flushed = true
    }

    const applyWindow = (item: unknown[]) => {
      const [grid, _win, row, col] = item
      if (typeof grid !== "number" || typeof row !== "number" || typeof col !== "number") return
      place(grid, row, col)
    }

    const applyFloat = (item: unknown[]) => {
      const [grid, _win, _anchor, anchorGrid, anchorRow, anchorCol, _focusable, z] = item
      if (
        typeof grid !== "number" ||
        typeof anchorGrid !== "number" ||
        typeof anchorRow !== "number" ||
        typeof anchorCol !== "number"
      )
        return
      const base = windows.get(anchorGrid) ?? { row: 0, col: 0, z: anchorGrid, hidden: false }
      place(grid, base.row + anchorRow, base.col + anchorCol, typeof z === "number" ? z : 1000 + grid)
    }

    const applyHide = (item: unknown[]) => {
      const [grid] = item
      if (typeof grid !== "number") return
      const win = windows.get(grid)
      if (!win) return
      windows.set(grid, { ...win, hidden: true })
      flushed = true
    }

    const applyDestroy = (item: unknown[]) => {
      const [grid] = item
      if (typeof grid !== "number") return
      grids.delete(grid)
      windows.delete(grid)
      if (cursor.grid === grid) cursor = { grid: 1, row: 0, col: 0 }
      flushed = true
    }

    const applyCmdline = (item: unknown[]) => {
      const [parts, pos, first, prompt] = item
      const head = typeof first === "string" ? first : ""
      const text = Array.isArray(parts) ? parts.map(content).join("") : ""
      const ask = typeof prompt === "string" ? prompt : ""
      cmdline = ask + head + text
      if (typeof pos === "number") {
        cursor = { grid: 1, row: 0, col: pos }
      }
      flushed = true
    }

    const applyCmdlinePos = (item: unknown[]) => {
      const [pos] = item
      if (typeof pos !== "number") return
      cursor = { grid: 1, row: 0, col: pos }
      flushed = true
    }

    const applyPopup = (item: unknown[]) => {
      const [items, selected, row, col] = item
      if (!Array.isArray(items) || typeof selected !== "number" || typeof row !== "number" || typeof col !== "number") return
      popup = {
        visible: true,
        row,
        col,
        selected,
        items: items.map(label).filter(Boolean),
      }
      flushed = true
    }

    const applyPopupSelect = (item: unknown[]) => {
      const [selected] = item
      if (typeof selected !== "number") return
      popup = {
        ...popup,
        selected,
      }
      flushed = true
    }

    const applyMessages = (item: unknown[]) => {
      const [_kind, parts, replace] = item
      const text = Array.isArray(parts) ? parts.map(content).join("") : ""
      if (!text) return
      if (replace === true && messages.length > 0) {
        messages = [...messages.slice(0, -1), text]
      } else {
        messages = [...messages, text].slice(-5)
      }
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
      if (name === "grid_destroy") return applyDestroy(item)
      if (name === "win_pos") return applyWindow(item)
      if (name === "win_float_pos") return applyFloat(item)
      if (name === "win_hide" || name === "win_close") return applyHide(item)
      if (name === "cmdline_show") return applyCmdline(item)
      if (name === "cmdline_pos") return applyCmdlinePos(item)
      if (name === "cmdline_hide") {
        cmdline = ""
        flushed = true
        return
      }
      if (name === "popupmenu_show") return applyPopup(item)
      if (name === "popupmenu_select") return applyPopupSelect(item)
      if (name === "popupmenu_hide") {
        popup = { visible: false, row: 0, col: 0, selected: -1, items: [] }
        flushed = true
        return
      }
      if (name === "msg_show") return applyMessages(item)
      if (name === "msg_clear") {
        messages = []
        flushed = true
        return
      }
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
        const next = frame()
        if (next.width === 0 || next.height === 0) {
          return {
            width: 0,
            height: 0,
            rows: [],
          } satisfies Snapshot
        }
        const mark = cursorCell()
        const rows = next.rows.map((line, row) => {
          const out: Segment[] = []
          let text = ""
          let prev: Style | undefined
          const push = () => {
            if (!text || !prev) return
            out.push({ text, ...prev })
            text = ""
          }
          for (let col = 0; col < next.width; col++) {
            const item = line[col] ?? blank()
            const style =
              col === mark.col && row === mark.row ? invert(hl.get(item.hl) ?? {}, colors.fg, colors.bg) : (hl.get(item.hl) ?? {})
            if (!prev || !equal(prev, style)) {
              push()
              prev = style
            }
            text += item.text || " "
          }
          push()
          return out.length > 0 ? out : [{ text: "" }]
        })
        flushed = false
        return {
          width: next.width,
          height: next.height,
          rows,
        } satisfies Snapshot
      },
    }
  }
}
