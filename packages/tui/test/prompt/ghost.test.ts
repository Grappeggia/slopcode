import { describe, expect, test } from "bun:test"
import { createGhostLifecycle, ghostAccept, ghostEligible, ghostLayout, ghostRemainder } from "../../src/prompt/ghost"

describe("prompt ghost helpers", () => {
  test("only allows a focused plain prefix with the cursor at the end", () => {
    const base = {
      enabled: true,
      prefix: "write focused tests",
      min: 12,
      mode: "normal" as const,
      focused: true,
      cursor: 19,
      popover: false,
      parts: 0,
    }

    expect(ghostEligible(base)).toBe(true)
    expect(ghostEligible({ ...base, cursor: 18 })).toBe(false)
    expect(ghostEligible({ ...base, focused: false })).toBe(false)
    expect(ghostEligible({ ...base, popover: true })).toBe(false)
    expect(ghostEligible({ ...base, parts: 1 })).toBe(false)
    expect(ghostEligible({ ...base, mode: "shell" })).toBe(false)
  })

  test("accepts without changing the source until explicitly applied", () => {
    const prefix = "write focused "
    const ghost = "tests"

    expect(ghostRemainder(prefix, prefix + ghost)).toBe(ghost)
    expect(prefix).toBe("write focused ")
    expect(ghostAccept(prefix, ghost)).toBe("write focused tests")
  })

  test("lays out wrapped ghost text from the live cursor", () => {
    expect(ghostLayout({ ghost: "abcdefghijk", row: 1, col: 7, width: 10, rows: 6 })).toEqual([
      { top: 1, left: 7, text: "abc" },
      { top: 2, left: 0, text: "defghijk" },
    ])
  })
})

describe("prompt ghost lifecycle", () => {
  test("aborts replaced and cleared requests and rejects stale responses", () => {
    const lifecycle = createGhostLifecycle()
    const first = lifecycle.begin()
    const second = lifecycle.begin()

    expect(first.signal.aborted).toBe(true)
    expect(lifecycle.current(first.generation)).toBe(false)
    expect(lifecycle.current(second.generation)).toBe(true)

    lifecycle.clear()
    expect(second.signal.aborted).toBe(true)
    expect(lifecycle.current(second.generation)).toBe(false)
  })
})
