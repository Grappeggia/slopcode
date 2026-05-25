import { expect, test } from "bun:test"
import { RGBA, SyntaxStyle } from "@opentui/core"
import { highlights, splitEmphasis, unifiedEmphasis } from "./diff-color"

function syntax() {
  return SyntaxStyle.fromStyles({
    "diff.minus": { fg: RGBA.fromInts(255, 0, 0) },
    "diff.plus": { fg: RGBA.fromInts(0, 255, 0) },
  })
}

test("highlights colors changed lines and dims context", () => {
  const style = syntax()
  const signs = new Map([
    [1, { after: " +" }],
    [2, { after: " -" }],
  ])

  expect(highlights("keep\nadd\nremove", signs, style)).toEqual([
    [0, 4, "slopcode.diff.context"],
    [5, 8, "slopcode.diff.plus"],
    [9, 15, "slopcode.diff.minus"],
  ])
  expect(style.getStyle("slopcode.diff.context")?.dim).toBe(true)
  style.destroy()
})

test("unifiedEmphasis focuses modified spans", () => {
  const style = syntax()
  const signs = new Map([
    [0, { after: " -" }],
    [1, { after: " +" }],
  ])

  expect(unifiedEmphasis("old value\nnew value", signs, style)).toEqual([
    [0, 3, "slopcode.diff.minus.emphasis"],
    [10, 13, "slopcode.diff.plus.emphasis"],
  ])
  expect(style.getStyle("slopcode.diff.plus.emphasis")?.bold).toBe(true)
  expect(style.getStyle("slopcode.diff.minus.emphasis")?.bold).toBe(true)
  style.destroy()
})

test("splitEmphasis pairs opposite sides by row", () => {
  const style = syntax()
  const left = new Map([[0, { after: " -" }]])
  const right = new Map([[0, { after: " +" }]])

  expect(splitEmphasis("left", "old value", left, "new value", right, style)).toEqual([
    [0, 3, "slopcode.diff.minus.emphasis"],
  ])
  expect(splitEmphasis("right", "new value", right, "old value", left, style)).toEqual([
    [0, 3, "slopcode.diff.plus.emphasis"],
  ])
  style.destroy()
})
