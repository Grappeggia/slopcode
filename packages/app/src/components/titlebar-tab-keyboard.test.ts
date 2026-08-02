import { expect, test } from "bun:test"
import { handleTabReorder } from "./titlebar-tab-keyboard"

test("maps the accessible tab reorder shortcut and ignores ordinary arrows", () => {
  const moves: number[] = []
  let prevented = 0
  const event = (key: string, altKey = true, shiftKey = true) => ({
    key,
    altKey,
    shiftKey,
    preventDefault: () => prevented++,
  })

  expect(handleTabReorder(event("ArrowLeft"), (offset) => moves.push(offset))).toBe(true)
  expect(handleTabReorder(event("ArrowRight"), (offset) => moves.push(offset))).toBe(true)
  expect(handleTabReorder(event("ArrowRight", false), (offset) => moves.push(offset))).toBe(false)

  expect(moves).toEqual([-1, 1])
  expect(prevented).toBe(2)
})
