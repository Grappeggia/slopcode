import { describe, expect, test } from "bun:test"
import {
  ghostAcceptWord,
  ghostAdvance,
  ghostCursor,
  ghostExtraRows,
  ghostLayout,
  ghostVisible,
  ghostRemainder,
} from "../../../src/cli/cmd/tui/component/prompt/ghost"

describe("prompt ghost", () => {
  test("uses live visual cursor when available", () => {
    const point = ghostCursor(
      {
        visualCursor: {
          visualRow: 0,
          visualCol: 12,
          offset: 42,
        },
      },
      {
        row: 1,
        col: 0,
        offset: 41,
      },
    )

    expect(point).toEqual({
      row: 0,
      col: 12,
      offset: 42,
    })
  })

  test("falls back when input is unavailable", () => {
    const point = ghostCursor(undefined, {
      row: 2,
      col: 3,
      offset: 15,
    })

    expect(point).toEqual({
      row: 2,
      col: 3,
      offset: 15,
    })
  })

  test("falls back when input is destroyed", () => {
    const point = ghostCursor(
      {
        isDestroyed: true,
        visualCursor: {
          visualRow: 0,
          visualCol: 0,
          offset: 0,
        },
      },
      {
        row: 3,
        col: 4,
        offset: 18,
      },
    )

    expect(point).toEqual({
      row: 3,
      col: 4,
      offset: 18,
    })
  })

  test("shows ghost when prompt is active and cursor is at end", () => {
    const visible = ghostVisible({
      ghost: " continuation",
      mode: "normal",
      disabled: false,
      historyMode: false,
      autocompleteVisible: false,
      focused: true,
      cursorOffset: 20,
      inputLength: 20,
    })

    expect(visible).toBe(true)
  })

  test("hides ghost when cursor is not at end", () => {
    const visible = ghostVisible({
      ghost: " continuation",
      mode: "normal",
      disabled: false,
      historyMode: false,
      autocompleteVisible: false,
      focused: true,
      cursorOffset: 19,
      inputLength: 20,
    })

    expect(visible).toBe(false)
  })

  test("hides ghost while autocomplete menu is visible", () => {
    const visible = ghostVisible({
      ghost: " continuation",
      mode: "normal",
      disabled: false,
      historyMode: false,
      autocompleteVisible: true,
      focused: true,
      cursorOffset: 20,
      inputLength: 20,
    })

    expect(visible).toBe(false)
  })

  test("matches case-insensitive prefixes", () => {
    expect(ghostRemainder("heL", "Hello")).toBe("lo")
  })

  test("returns empty remainder for exact case-insensitive matches", () => {
    expect(ghostRemainder("HELLO", "hello")).toBe("")
  })

  test("returns undefined for mismatches", () => {
    expect(ghostRemainder("help", "hello")).toBeUndefined()
  })

  test("returns undefined for empty input", () => {
    expect(ghostRemainder("", "hello")).toBeUndefined()
  })

  test("accepts one ghost word at a time", () => {
    expect(ghostAcceptWord("tests for route")).toEqual({
      accept: "tests",
      remainder: " for route",
    })
  })

  test("advances repeated word accepts without dropping the remainder", () => {
    const first = ghostAdvance("write detailed ", "tests for route")
    expect(first).toEqual({
      accept: "tests",
      ghost: " for route",
      suggestion: "write detailed tests for route",
      text: "write detailed tests",
    })

    const second = ghostAdvance(first!.text, first!.ghost)
    expect(second).toEqual({
      accept: " for",
      ghost: " route",
      suggestion: "write detailed tests for route",
      text: "write detailed tests for",
    })
  })

  test("keeps leading whitespace with the accepted ghost word", () => {
    expect(ghostAcceptWord(" tests for route")).toEqual({
      accept: " tests",
      remainder: " for route",
    })
  })

  test("accepts remaining ghost when only one word is left", () => {
    expect(ghostAcceptWord(" route")).toEqual({
      accept: " route",
      remainder: "",
    })
  })

  test("accepts whitespace-only ghost as the final remainder", () => {
    expect(ghostAcceptWord("   ")).toEqual({
      accept: "   ",
      remainder: "",
    })
  })

  test("wraps the first ghost row to remaining width", () => {
    const lines = ghostLayout({
      ghost: "abcdefghijk",
      row: 1,
      col: 7,
      width: 10,
      rows: 6,
    })

    expect(lines).toEqual([
      {
        top: 1,
        left: 7,
        text: "abc",
      },
      {
        top: 2,
        left: 0,
        text: "defghijk",
      },
    ])
  })

  test("continues wrapped ghost rows from column zero", () => {
    const lines = ghostLayout({
      ghost: "abcdefghijk",
      row: 2,
      col: 3,
      width: 6,
      rows: 6,
    })

    expect(lines).toEqual([
      {
        top: 2,
        left: 3,
        text: "abc",
      },
      {
        top: 3,
        left: 0,
        text: "defghi",
      },
      {
        top: 4,
        left: 0,
        text: "jk",
      },
    ])
  })

  test("clips ghost rows to the visible prompt height", () => {
    const lines = ghostLayout({
      ghost: "abcdefghijklmnop",
      row: 4,
      col: 8,
      width: 10,
      rows: 6,
    })

    expect(lines).toEqual([
      {
        top: 4,
        left: 8,
        text: "ab",
      },
      {
        top: 5,
        left: 0,
        text: "cdefghijkl",
      },
    ])
  })

  test("reports extra rows needed to keep the footer below ghost text", () => {
    const lines = ghostLayout({
      ghost: "abcdefghijklmnop",
      row: 0,
      col: 4,
      width: 8,
      rows: 6,
    })

    expect(ghostExtraRows({ lines, height: 1 })).toBe(2)
    expect(ghostExtraRows({ lines, height: 2 })).toBe(1)
    expect(ghostExtraRows({ lines, height: 3 })).toBe(0)
  })
})
