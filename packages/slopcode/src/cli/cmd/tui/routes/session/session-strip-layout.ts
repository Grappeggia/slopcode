export type SessionStripStatus = "none" | "working" | "waiting" | "ready" | "done"

export type SessionStripTab = {
  id: string
  title: string
  status?: SessionStripStatus
}

export type SessionStripLayout = {
  tabs: SessionStripTab[]
  hidden: number
  before: number
  after: number
  prev?: string
  next?: string
  underline: string
}

export type SessionStripUnderlineSegment = {
  text: string
  owners: string[]
}

const SEP_GLYPH = "│"
const SEP = SEP_GLYPH
const ACTIVE = "* "
const CLOSE = "X"
const CLOSE_SLOT = ` ${CLOSE}`
const RULE = "─"
const JOINT = "┴"
const PREV = "<"
const NEXT = ">"
const SEP_MARK = 0
const MIN_TITLE = 10
const MAX_TITLE = 40
const ELLIPSIS = "…"

function owners(...ids: Array<string | undefined>) {
  return ids.filter((id): id is string => !!id)
}

type Slice = {
  start: number
  end: number
}

type Fit = Omit<SessionStripLayout, "underline"> & {
  width: number
  cap: number
}

function width(text: string) {
  return Bun.stringWidth(text)
}

function cut(text: string, cap: number) {
  if (cap <= 0) return ""
  if (width(text) <= cap) return text

  const ellipsis = width(ELLIPSIS)
  if (cap <= ellipsis) return ELLIPSIS

  let out = ""
  let used = 0
  for (const char of text) {
    const size = width(char)
    if (used + size + ellipsis > cap) break
    out += char
    used += size
  }
  if (out) return out + ELLIPSIS
  return ELLIPSIS
}

function item(tab: SessionStripTab, active: boolean) {
  return (active ? ACTIVE : "") + tab.title
}

export function sessionStripTabLabel(tab: SessionStripTab, active: boolean) {
  return item(tab, active)
}

export function sessionStripTabClose(hovered: boolean) {
  return hovered ? CLOSE : " "
}

export function sessionStripWidth(total: number, inset: number) {
  return Math.max(0, total - inset * 2)
}

function tabWidth(tab: SessionStripTab, active: boolean) {
  return width(item(tab, active) + CLOSE_SLOT)
}

function measure(
  tabs: SessionStripTab[],
  slice: Slice,
  input: {
    active?: string
    width: number
  },
): Fit | undefined {
  const raw = tabs.slice(slice.start, slice.end + 1)
  const before = slice.start
  const after = tabs.length - slice.end - 1
  const hidden = before + after
  const nav =
    (before > 0 ? width(PREV + SEP) : 0) + (hidden > 0 ? width(`+${hidden}`) : 0) + (after > 0 ? width(SEP + NEXT) : 0)

  for (let cap = MAX_TITLE; cap >= MIN_TITLE; cap--) {
    const visible = raw.map((tab) => ({
      ...tab,
      title: cut(tab.title, cap),
    }))
    const lead = before === 0 && visible.length > 0 ? width(SEP) : 0
    const body =
      lead +
      visible.reduce((sum, tab) => {
        return sum + tabWidth(tab, tab.id === input.active) + width(SEP)
      }, 0)
    const total = body + nav
    if (total > input.width) continue
    return {
      tabs: visible,
      hidden,
      before,
      after,
      prev: before > 0 ? tabs[slice.start - 1]?.id : undefined,
      next: after > 0 ? tabs[slice.end + 1]?.id : undefined,
      width: total,
      cap,
    }
  }
}

function joints(layout: Omit<SessionStripLayout, "underline">, active: string | undefined) {
  const points: number[] = []
  let offset = 0
  if (layout.before === 0 && layout.tabs.length > 0) {
    points.push(SEP_MARK)
    offset += width(SEP)
  }
  if (layout.before > 0) {
    offset += width(PREV)
    points.push(offset + SEP_MARK)
    offset += width(SEP)
  }
  for (const tab of layout.tabs) {
    offset += tabWidth(tab, tab.id === active)
    points.push(offset + SEP_MARK)
    offset += width(SEP)
  }
  if (layout.after > 0) {
    offset += width(`+${layout.hidden}`)
    points.push(offset + SEP_MARK)
  }
  return points
}

function underline(width: number, points: number[]) {
  const set = new Set(points)
  return Array.from({ length: width }, (_, index) => (set.has(index) ? JOINT : RULE)).join("")
}

function result(layout: Fit, active: string | undefined, width: number): SessionStripLayout {
  return {
    tabs: layout.tabs,
    hidden: layout.hidden,
    before: layout.before,
    after: layout.after,
    prev: layout.prev,
    next: layout.next,
    underline: underline(width, joints(layout, active)),
  }
}

function gap(layout: Fit, active: number) {
  return Math.abs(layout.before * 2 + layout.tabs.length - 1 - active * 2)
}

function better(next: Fit, best: Fit, active?: number) {
  if (next.tabs.length !== best.tabs.length) return next.tabs.length > best.tabs.length

  if (active !== undefined) {
    const nextGap = gap(next, active)
    const bestGap = gap(best, active)
    if (nextGap !== bestGap) return nextGap < bestGap
  }

  if (next.cap !== best.cap) return next.cap > best.cap
  if (next.before !== best.before) return next.before < best.before
  return next.width < best.width
}

function empty(tabs: SessionStripTab[], width: number): SessionStripLayout {
  return {
    tabs: [],
    hidden: tabs.length,
    before: 0,
    after: 0,
    prev: undefined,
    next: undefined,
    underline: underline(Math.max(0, width), []),
  }
}

export function layoutSessionStripUnderlineSegments(
  layout: SessionStripLayout,
  input: {
    active?: string
    prevOwner?: string
    nextOwner?: string
  },
): SessionStripUnderlineSegment[] {
  const parts = [
    ...(layout.before > 0
      ? [
          { width: width(PREV), owners: owners(input.prevOwner) },
          { width: width(SEP), owners: owners(input.prevOwner, layout.tabs[0]?.id) },
        ]
      : layout.tabs.length > 0
        ? [{ width: width(SEP), owners: owners(layout.tabs[0]?.id) }]
        : []),
    ...layout.tabs.flatMap((tab, index) => [
      { width: tabWidth(tab, tab.id === input.active), owners: [tab.id] },
      {
        width: width(SEP),
        owners: owners(tab.id, layout.tabs[index + 1]?.id ?? (layout.hidden > 0 ? undefined : input.nextOwner)),
      },
    ]),
    ...(layout.hidden > 0 ? [{ width: width(`+${layout.hidden}`), owners: [] as string[] }] : []),
    ...(layout.after > 0
      ? [
          { width: width(SEP), owners: owners(input.nextOwner) },
          { width: width(NEXT), owners: owners(input.nextOwner) },
        ]
      : []),
  ]
  const full = Array.from(layout.underline)
  const used = parts.reduce((sum, part) => sum + part.width, 0)
  const padded = used < full.length ? [...parts, { width: full.length - used, owners: [] as string[] }] : parts
  let offset = 0
  return padded.flatMap((part) => {
    if (part.width <= 0) return []
    const text = full.slice(offset, offset + part.width).join("")
    offset += part.width
    return [{ text, owners: Array.from(new Set(part.owners)) }]
  })
}

export function layoutSessionStrip(
  tabs: SessionStripTab[],
  input: {
    active?: string
    width: number
  },
): SessionStripLayout {
  if (tabs.length === 0 || input.width <= 0) return empty(tabs, 0)

  const active = tabs.findIndex((tab) => tab.id === input.active)
  if (active === -1) {
    const fits = tabs
      .map((_, end) => measure(tabs, { start: 0, end }, input))
      .filter((layout): layout is Fit => !!layout)
    if (fits.length === 0) return empty(tabs, input.width)
    return result(
      fits.reduce((best, next) => {
        if (better(next, best)) return next
        return best
      }),
      input.active,
      input.width,
    )
  }

  const fits = Array.from({ length: active + 1 }, (_, start) => {
    return Array.from({ length: tabs.length - active }, (_, offset) => {
      return measure(tabs, { start, end: active + offset }, input)
    })
  })
    .flat()
    .filter((layout): layout is Fit => !!layout)
  if (fits.length === 0) return empty(tabs, input.width)
  return result(
    fits.reduce((best, next) => {
      if (better(next, best, active)) return next
      return best
    }),
    input.active,
    input.width,
  )
}

export const SessionStripText = {
  ACTIVE,
  CLOSE,
  PREV,
  NEXT,
  SEP,
}
