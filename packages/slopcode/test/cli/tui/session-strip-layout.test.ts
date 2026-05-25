import { describe, expect, test } from "bun:test"
import {
  layoutSessionStrip,
  layoutSessionStripUnderlineSegments,
  sessionStripWidth,
} from "../../../src/cli/cmd/tui/routes/session/session-strip-layout"

const tabs = [
  { id: "ses_1", title: "One" },
  { id: "ses_2", title: "Two" },
  { id: "ses_3", title: "Three" },
  { id: "ses_4", title: "Four" },
]

const long = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

describe("session strip layout", () => {
  test("shows every tab when there is enough width", () => {
    const result = layoutSessionStrip(tabs, {
      active: "ses_2",
      width: 80,
    })

    expect(result).toMatchObject({
      tabs,
      hidden: 0,
      before: 0,
      after: 0,
      prev: undefined,
      next: undefined,
    })
    expect(Array.from(result.underline)).toHaveLength(80)
  })

  test("exposes hidden navigation targets around the active tab", () => {
    const result = layoutSessionStrip(tabs, {
      active: "ses_3",
      width: 18,
    })

    expect(result.tabs.some((tab) => tab.id === "ses_3")).toBe(true)
    expect(result).toMatchObject({
      hidden: 3,
      before: 2,
      after: 1,
      prev: "ses_2",
      next: "ses_4",
    })
  })

  test("prefers a wider left-anchored window on ties", () => {
    const result = layoutSessionStrip(tabs, {
      active: "ses_2",
      width: 31,
    })

    expect(result).toMatchObject({
      tabs,
      hidden: 0,
      before: 0,
      after: 0,
      prev: undefined,
      next: undefined,
    })
  })

  test("falls back to a prefix when active is missing", () => {
    const result = layoutSessionStrip(tabs, {
      active: "ses_missing",
      width: 29,
    })

    expect(result).toMatchObject({
      tabs,
      hidden: 0,
      before: 0,
      after: 0,
      prev: undefined,
      next: undefined,
    })
  })

  test("returns no tabs when width is zero", () => {
    const result = layoutSessionStrip(tabs, {
      active: "ses_1",
      width: 0,
    })

    expect(result).toEqual({
      tabs: [],
      hidden: 4,
      before: 0,
      after: 0,
      prev: undefined,
      next: undefined,
      underline: "",
    })
  })

  test("keeps the full terminal width when the strip inset is zero", () => {
    expect(sessionStripWidth(80, 0)).toBe(80)
    expect(sessionStripWidth(3, 2)).toBe(0)
  })

  test("caps wide tabs at 40 chars on roomy terminals", () => {
    const result = layoutSessionStrip([{ id: "a", title: long }], {
      active: "a",
      width: 80,
    })

    expect(Bun.stringWidth(result.tabs[0]!.title)).toBe(40)
    expect(result.tabs[0]!.title.endsWith("…")).toBe(true)
  })

  test("shrinks titles before hiding tabs while the screen narrows", () => {
    const wide = layoutSessionStrip(
      [
        { id: "a", title: long },
        { id: "b", title: long },
      ],
      { active: "a", width: 35 },
    )
    const tight = layoutSessionStrip(
      [
        { id: "a", title: long },
        { id: "b", title: long },
      ],
      { active: "a", width: 34 },
    )
    const narrow = layoutSessionStrip(
      [
        { id: "a", title: long },
        { id: "b", title: long },
      ],
      { active: "a", width: 32 },
    )

    expect(wide.tabs.map((tab) => tab.id)).toEqual(["a", "b"])
    expect(tight.tabs.map((tab) => tab.id)).toEqual(["a", "b"])
    expect(narrow.tabs.map((tab) => tab.id)).toEqual(["a", "b"])
    expect(Bun.stringWidth(wide.tabs[0]!.title)).toBe(13)
    expect(Bun.stringWidth(tight.tabs[0]!.title)).toBe(12)
  })

  test("prefers the slice that keeps the active tab centered on ties", () => {
    const result = layoutSessionStrip(
      [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
        { id: "c", title: "C" },
        { id: "d", title: "D" },
        { id: "e", title: "E" },
      ],
      { active: "c", width: 26 },
    )

    expect(result.tabs.map((tab) => tab.id)).toEqual(["a", "b", "c", "d", "e"])
    expect(result.before).toBe(0)
    expect(result.after).toBe(0)
  })

  test("keeps wide glyph titles inside the minimum tab cap", () => {
    const result = layoutSessionStrip([{ id: "a", title: "你好世界你好世界你好世界" }], {
      active: "a",
      width: 18,
    })

    expect(Bun.stringWidth(result.tabs[0]!.title)).toBeLessThanOrEqual(11)
    expect(result.tabs[0]!.title.endsWith("…")).toBe(true)
    expect(result.underline).toHaveLength(18)
  })

  test("handles two-digit hidden counts without overflowing the strip", () => {
    const result = layoutSessionStrip(
      Array.from({ length: 12 }, (_, index) => ({
        id: String.fromCharCode(97 + index),
        title: String.fromCharCode(65 + index),
      })),
      { active: "a", width: 24 },
    )

    expect(result.tabs.map((tab) => tab.id)).toEqual(["a", "b", "c", "d"])
    expect(result.hidden).toBe(8)
    expect(result.next).toBe("e")
    expect(result.underline).toHaveLength(24)
  })

  test("draws joints under tab separators including the closing divider", () => {
    const result = layoutSessionStrip(
      [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
      ],
      { width: 20 },
    )

    expect(result.tabs).toEqual([
      { id: "a", title: "A" },
      { id: "b", title: "B" },
    ])
    expect(result.hidden).toBe(0)
    expect(result.underline).toHaveLength(20)
    expect(Array.from(result.underline).filter((x) => x === "┴")).toHaveLength(3)
    expect(result.underline[0]).toBe("┴")
    expect(result.underline[4]).toBe("┴")
    expect(result.underline[8]).toBe("┴")
  })

  test("keeps joints aligned when the active marker shifts tab text", () => {
    const result = layoutSessionStrip(
      [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
      ],
      { active: "a", width: 22 },
    )

    expect(result.hidden).toBe(0)
    expect(result.underline).toHaveLength(22)
    expect(Array.from(result.underline).filter((x) => x === "┴")).toHaveLength(3)
    expect(result.underline[0]).toBe("┴")
    expect(result.underline[6]).toBe("┴")
    expect(result.underline[10]).toBe("┴")
  })

  test("adds a joint before the next control when tabs overflow", () => {
    const result = layoutSessionStrip(
      [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
        { id: "c", title: "Long" },
      ],
      { width: 17 },
    )

    expect(result).toMatchObject({
      tabs: [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
        { id: "c", title: "Long" },
      ],
      hidden: 0,
      before: 0,
      after: 0,
      prev: undefined,
      next: undefined,
    })
    expect(result.underline).toHaveLength(17)
    expect(Array.from(result.underline).filter((x) => x === "┴")).toHaveLength(4)
    expect(result.underline[0]).toBe("┴")
    expect(result.underline[4]).toBe("┴")
    expect(result.underline[8]).toBe("┴")
    expect(result.underline[15]).toBe("┴")
  })

  test("adds a joint after the previous control when tabs are hidden on the left", () => {
    const result = layoutSessionStrip(
      [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
        { id: "c", title: "C" },
      ],
      { active: "c", width: 14 },
    )

    expect(result).toMatchObject({
      tabs: [
        { id: "b", title: "B" },
        { id: "c", title: "C" },
      ],
      hidden: 1,
      before: 1,
      after: 0,
      prev: "a",
      next: undefined,
    })
    expect(Array.from(result.underline).filter((x) => x === "┴")).toHaveLength(3)
    expect(result.underline[1]).toBe("┴")
    expect(result.underline[5]).toBe("┴")
    expect(result.underline[11]).toBe("┴")
  })

  test("splits underline into hover-aware segments without changing the text", () => {
    const result = layoutSessionStrip(
      [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
      ],
      { active: "a", width: 22 },
    )
    const segments = layoutSessionStripUnderlineSegments(result, {
      active: "a",
      prevOwner: "__prev__",
      nextOwner: "__next__",
    })

    expect(segments.map((segment) => segment.text).join("")).toBe(result.underline)
    expect(segments.map((segment) => segment.owners)).toEqual([["a"], ["a"], ["a", "b"], ["b"], ["b", "__next__"], []])
  })

  test("shares separator ownership with adjacent controls", () => {
    const result = layoutSessionStrip(
      [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
        { id: "c", title: "C" },
      ],
      { active: "b", width: 14 },
    )

    const segments = layoutSessionStripUnderlineSegments(result, {
      active: "b",
      prevOwner: "__prev__",
      nextOwner: "__next__",
    })

    expect(result.tabs.map((tab) => tab.id)).toEqual(["b", "c"])
    expect(segments.map((segment) => segment.owners)).toEqual([
      ["__prev__"],
      ["__prev__", "b"],
      ["b"],
      ["b", "c"],
      ["c"],
      ["c"],
      [],
    ])
  })

  test("adds a leading boundary when the first visible tab is also the first tab", () => {
    const result = layoutSessionStrip(
      [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
      ],
      { width: 20 },
    )

    const segments = layoutSessionStripUnderlineSegments(result, {})

    expect(result.before).toBe(0)
    expect(result.tabs.map((tab) => tab.id)).toEqual(["a", "b"])
    expect(segments[0]?.text).toBe("┴")
    expect(segments[0]?.owners).toEqual(["a"])
  })
})
