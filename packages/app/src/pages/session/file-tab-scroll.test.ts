import { describe, expect, test } from "bun:test"
import { nextTabListDivider, nextTabListDividerLeft, nextTabListScrollLeft } from "./file-tab-scroll"

describe("nextTabListScrollLeft", () => {
  test("does not scroll when width shrinks", () => {
    const left = nextTabListScrollLeft({
      prevScrollWidth: 500,
      scrollWidth: 420,
      clientWidth: 300,
      prevContextOpen: false,
      contextOpen: false,
    })

    expect(left).toBeUndefined()
  })

  test("scrolls to start when context tab opens", () => {
    const left = nextTabListScrollLeft({
      prevScrollWidth: 400,
      scrollWidth: 500,
      clientWidth: 320,
      prevContextOpen: false,
      contextOpen: true,
    })

    expect(left).toBe(0)
  })

  test("scrolls to right edge for new file tabs", () => {
    const left = nextTabListScrollLeft({
      prevScrollWidth: 500,
      scrollWidth: 780,
      clientWidth: 300,
      prevContextOpen: true,
      contextOpen: true,
    })

    expect(left).toBe(480)
  })
})

describe("nextTabListDivider", () => {
  test("pins the divider to the left edge for a clipped tab", () => {
    const divider = nextTabListDivider({
      list: { left: 100, right: 420 },
      tabs: [
        { left: 72, right: 168, hovered: true, selected: false },
        { left: 184, right: 280, hovered: false, selected: false },
      ],
    })

    expect(divider?.left).toBe(0)
    expect(divider?.hovered).toBe(true)
    expect(divider?.selected).toBe(false)
  })

  test("jumps the divider to the next tab when the scroll is inside a gap", () => {
    const divider = nextTabListDivider({
      list: { left: 100, right: 420 },
      tabs: [
        { left: 184, right: 280, hovered: false, selected: true },
        { left: 296, right: 392, hovered: false, selected: false },
      ],
    })

    expect(divider?.left).toBe(84)
    expect(divider?.selected).toBe(true)
  })

  test("hides the divider when no tabs are visible", () => {
    const divider = nextTabListDivider({
      list: { left: 100, right: 420 },
      tabs: [],
    })

    expect(divider).toBeUndefined()
  })
})

describe("nextTabListDividerLeft", () => {
  test("returns the divider offset without tab state", () => {
    const left = nextTabListDividerLeft({
      list: { left: 100, right: 420 },
      tabs: [
        { left: 184, right: 280 },
        { left: 296, right: 392 },
      ],
    })

    expect(left).toBe(84)
  })
})
