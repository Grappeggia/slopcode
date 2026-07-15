import type { SessionTabStatus } from "../context/session-tabs-state"

export type SessionStripTab = {
  id: string
  title: string
  status: SessionTabStatus
}

export type SessionStripLayout = {
  tabs: SessionStripTab[]
  hidden: number
  before: number
  after: number
  prev?: string
  next?: string
  used: number
}

const ACTIVE = "* "
const CLOSE = " ×"
const ELLIPSIS = "…"
const MAX_TITLE = 30
const MIN_TITLE = 4
const SEP = "│"

const markers: Record<SessionTabStatus, string> = {
  working: "●",
  retrying: "↻",
  waiting: "?",
  ready: "◆",
  idle: "○",
  disconnected: "!",
  unknown: "·",
}

function width(text: string) {
  return Bun.stringWidth(text)
}

function cut(text: string, cap: number) {
  if (width(text) <= cap) return text
  const segments = Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    (item) => item.segment,
  )
  const suffix = width(ELLIPSIS)
  const result = segments.reduce(
    (out, item) => {
      const size = width(item)
      if (out.done || out.width + size + suffix > cap) return { ...out, done: true }
      return { text: out.text + item, width: out.width + size, done: false }
    },
    { text: "", width: 0, done: false },
  )
  return result.text + ELLIPSIS
}

export function sessionStripTabLabel(tab: SessionStripTab, active: boolean) {
  return `${markers[tab.status]} ${active ? ACTIVE : ""}${tab.title}`
}

function tabWidth(tab: SessionStripTab, active: boolean) {
  return width(sessionStripTabLabel(tab, active) + CLOSE + SEP)
}

type Fit = SessionStripLayout & { cap: number }

function measure(
  tabs: SessionStripTab[],
  start: number,
  end: number,
  active: string | undefined,
  total: number,
): Fit | undefined {
  const before = start
  const after = tabs.length - end - 1
  const hidden = before + after
  const controls =
    (before > 0 ? width("<" + SEP) : width(SEP)) +
    (hidden > 0 ? width(`+${hidden}`) : 0) +
    (after > 0 ? width(SEP + ">") : 0)

  for (let cap = MAX_TITLE; cap >= MIN_TITLE; cap--) {
    const visible = tabs.slice(start, end + 1).map((tab) => ({ ...tab, title: cut(tab.title, cap) }))
    const used = controls + visible.reduce((sum, tab) => sum + tabWidth(tab, tab.id === active), 0)
    if (used > total) continue
    return {
      tabs: visible,
      hidden,
      before,
      after,
      prev: before > 0 ? tabs[start - 1]?.id : undefined,
      next: after > 0 ? tabs[end + 1]?.id : undefined,
      used,
      cap,
    }
  }
  return undefined
}

function balance(layout: Fit, active: number) {
  return Math.abs(layout.before * 2 + layout.tabs.length - 1 - active * 2)
}

function better(next: Fit, best: Fit, active?: number) {
  if (next.tabs.length !== best.tabs.length) return next.tabs.length > best.tabs.length
  if (active !== undefined && balance(next, active) !== balance(best, active)) {
    return balance(next, active) < balance(best, active)
  }
  if (next.cap !== best.cap) return next.cap > best.cap
  if (next.before !== best.before) return next.before < best.before
  return next.used < best.used
}

export function layoutSessionStrip(
  tabs: SessionStripTab[],
  input: { active?: string; width: number },
): SessionStripLayout {
  if (tabs.length === 0 || input.width <= 0) {
    return { tabs: [], hidden: tabs.length, before: 0, after: 0, used: 0 }
  }

  const active = tabs.findIndex((tab) => tab.id === input.active)
  const fits = (
    active === -1
      ? tabs.map((_, end) => measure(tabs, 0, end, input.active, input.width))
      : Array.from({ length: active + 1 }, (_, start) =>
          Array.from({ length: tabs.length - active }, (_, offset) =>
            measure(tabs, start, active + offset, input.active, input.width),
          ),
        ).flat()
  ).filter((item): item is Fit => item !== undefined)

  if (fits.length === 0) {
    return {
      tabs: [],
      hidden: tabs.length,
      before: 0,
      after: tabs.length,
      next: tabs[0]?.id,
      used: width(`+${tabs.length}`),
    }
  }

  const best = fits.reduce((current, next) =>
    better(next, current, active === -1 ? undefined : active) ? next : current,
  )
  return {
    tabs: best.tabs,
    hidden: best.hidden,
    before: best.before,
    after: best.after,
    prev: best.prev,
    next: best.next,
    used: best.used,
  }
}

export const SessionStripText = { CLOSE, SEP }
