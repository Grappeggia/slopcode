import {
  DiffRenderable,
  type LineSign,
  type OnHighlightCallback,
  type SimpleHighlight,
  type SyntaxStyle,
} from "@opentui/core"
import { diffWordsWithSpace } from "diff"

const done = Symbol.for("slopcode.diff.color")
const callbacks = Symbol("callbacks")
const add = "slopcode.diff.plus"
const del = "slopcode.diff.minus"
const addEmphasis = "slopcode.diff.plus.emphasis"
const delEmphasis = "slopcode.diff.minus.emphasis"
const ctx = "slopcode.diff.context"

type Side = "left" | "right"
type View = "split" | "unified"
type Style = Parameters<SyntaxStyle["registerStyle"]>[1]
type Kind = "add" | "context" | "empty" | "remove"
type Row = { end: number; kind: Kind; start: number; text: string }

type Gutter = {
  getLineSigns(): Map<number, LineSign>
}

type Code = {
  content: string
  onHighlight: OnHighlightCallback | undefined
}

type Diff = {
  view: View
  buildSplitView(): void
  buildUnifiedView(): void
  leftCodeRenderable: Code | null
  rightCodeRenderable: Code | null
  leftSide: Gutter | null
  rightSide: Gutter | null
  [callbacks]?: Partial<Record<Side, OnHighlightCallback>>
}

type Root = typeof globalThis & {
  [done]?: boolean
}

function ensure(syntax: SyntaxStyle, name: string, style: Style, fallback?: string) {
  if (syntax.getStyle(name)) return name
  const base = fallback ? (syntax.getStyle(fallback) ?? {}) : {}
  syntax.registerStyle(name, { ...base, ...style })
  return name
}

function token(syntax: SyntaxStyle, kind: Exclude<Kind, "empty">, emphasis = false) {
  if (kind === "context") return ensure(syntax, ctx, { dim: true })
  if (kind === "add") {
    if (emphasis) return ensure(syntax, addEmphasis, { bg: undefined, bold: true }, add)
    return ensure(syntax, add, { bg: undefined }, "diff.plus")
  }
  if (emphasis) return ensure(syntax, delEmphasis, { bg: undefined, bold: true }, del)
  return ensure(syntax, del, { bg: undefined }, "diff.minus")
}

function kind(sign: LineSign | undefined, text: string): Kind {
  const mark = sign?.after?.trim()
  if (mark === "+") return "add"
  if (mark === "-") return "remove"
  if (text.length === 0) return "empty"
  return "context"
}

function rows(content: string, signs: Map<number, LineSign>) {
  const out: Row[] = []
  let start = 0

  content.split("\n").forEach((text, i) => {
    const end = start + text.length
    out.push({ end, kind: kind(signs.get(i), text), start, text })
    start = end + 1
  })

  return out
}

function pair(left: Row, right: Row, syntax: SyntaxStyle) {
  const out = { left: [] as SimpleHighlight[], right: [] as SimpleHighlight[] }
  if (left.text.length === 0 || right.text.length === 0 || left.text === right.text) return out

  let old = left.start
  let next = right.start

  diffWordsWithSpace(left.text, right.text).forEach((part) => {
    const size = part.value.length
    if (size === 0) return

    if (part.removed) {
      out.left.push([old, old + size, token(syntax, "remove", true)])
      old += size
      return
    }

    if (part.added) {
      out.right.push([next, next + size, token(syntax, "add", true)])
      next += size
      return
    }

    old += size
    next += size
  })

  return out
}

function line(signs: Map<number, LineSign>, content: string, syntax: SyntaxStyle) {
  return rows(content, signs).flatMap((row) => {
    if (row.kind === "empty" || row.text.length === 0) return []
    return [[row.start, row.end, token(syntax, row.kind)]] satisfies SimpleHighlight[]
  })
}

export function highlights(content: string, signs: Map<number, LineSign>, syntax: SyntaxStyle): SimpleHighlight[] {
  return line(signs, content, syntax)
}

export function unifiedEmphasis(content: string, signs: Map<number, LineSign>, syntax: SyntaxStyle): SimpleHighlight[] {
  const out: SimpleHighlight[] = []
  const all = rows(content, signs)
  let i = 0

  while (i < all.length) {
    if (all[i]?.kind !== "remove") {
      i += 1
      continue
    }

    const removed: Row[] = []
    while (all[i]?.kind === "remove") {
      removed.push(all[i]!)
      i += 1
    }

    const added: Row[] = []
    while (all[i]?.kind === "add") {
      added.push(all[i]!)
      i += 1
    }

    removed.slice(0, added.length).forEach((row, j) => {
      const diff = pair(row, added[j]!, syntax)
      out.push(...diff.left, ...diff.right)
    })
  }

  return out
}

export function splitEmphasis(
  side: Side,
  content: string,
  signs: Map<number, LineSign>,
  otherContent: string,
  otherSigns: Map<number, LineSign>,
  syntax: SyntaxStyle,
): SimpleHighlight[] {
  const current = rows(content, signs)
  const other = rows(otherContent, otherSigns)
  const out: SimpleHighlight[] = []
  const size = Math.min(current.length, other.length)

  Array.from({ length: size }).forEach((_, i) => {
    const left = side === "left" ? current[i]! : other[i]!
    const right = side === "left" ? other[i]! : current[i]!
    if (left.kind !== "remove" || right.kind !== "add") return

    const diff = pair(left, right, syntax)
    out.push(...(side === "left" ? diff.left : diff.right))
  })

  return out
}

function signs(diff: Diff, side: Side) {
  return (
    (side === "left" ? diff.leftSide?.getLineSigns() : diff.rightSide?.getLineSigns()) ?? new Map<number, LineSign>()
  )
}

function callback(diff: Diff, side: Side) {
  const cache = diff[callbacks] ?? {}
  const current = cache[side]
  if (current) return current

  const next: OnHighlightCallback = (input, ctx) => {
    const currentSigns = signs(diff, side)
    const lineHighlights = highlights(ctx.content, currentSigns, ctx.syntaxStyle)
    if (diff.view === "unified")
      return input.concat(lineHighlights, unifiedEmphasis(ctx.content, currentSigns, ctx.syntaxStyle))

    const other = side === "left" ? (diff.rightCodeRenderable?.content ?? "") : (diff.leftCodeRenderable?.content ?? "")
    const otherSigns = signs(diff, side === "left" ? "right" : "left")
    return input.concat(
      lineHighlights,
      splitEmphasis(side, ctx.content, currentSigns, other, otherSigns, ctx.syntaxStyle),
    )
  }

  diff[callbacks] = { ...cache, [side]: next }
  return next
}

function apply(diff: Diff) {
  if (diff.leftCodeRenderable) diff.leftCodeRenderable.onHighlight = callback(diff, "left")
  if (diff.rightCodeRenderable) diff.rightCodeRenderable.onHighlight = callback(diff, "right")
}

function patch(name: View extends infer _ ? "buildSplitView" | "buildUnifiedView" : never) {
  const proto = DiffRenderable.prototype as unknown as Diff
  const base = proto[name]

  proto[name] = function (this: Diff) {
    base.call(this)
    apply(this)
  } as Diff[typeof name]
}

export function installDiffColor() {
  const root = globalThis as Root
  if (root[done]) return

  patch("buildUnifiedView")
  patch("buildSplitView")
  root[done] = true
}

installDiffColor()
