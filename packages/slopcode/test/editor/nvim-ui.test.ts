import { describe, expect, test } from "bun:test"
import { NvimUI } from "../../src/editor/nvim-ui"

describe("nvim ui", () => {
  test("renders highlighted rows and cursor snapshots", () => {
    const ui = NvimUI.create()
    ui.redraw([
      ["default_colors_set", [0xffffff, 0x111111, 0, 0, 0]],
      ["hl_attr_define", [1, { foreground: 0xff0000, background: 0x111111, bold: true }, {}, []]],
      ["grid_resize", [1, 4, 2]],
      [
        "grid_line",
        [
          1,
          0,
          0,
          [
            ["a", 1],
            ["b", 1],
            ["c", 1],
            ["d", 1],
          ],
          false,
        ],
      ],
      ["grid_cursor_goto", [1, 0, 1]],
      ["mode_change", ["i", 0]],
      ["flush", []],
    ])

    expect(ui.mode()).toBe("i")
    const snap = ui.snapshot()
    expect(snap.width).toBe(4)
    expect(snap.height).toBe(2)
    expect(snap.rows[0]?.map((item) => item.text).join("")).toBe("abcd")
    expect(snap.rows[0]?.some((item) => item.bg === "#ff0000" || item.fg === "#111111")).toBe(true)
  })

  test("applies grid scroll updates", () => {
    const ui = NvimUI.create()
    ui.redraw([
      ["grid_resize", [1, 3, 3]],
      ["grid_line", [1, 0, 0, [["1"], ["1"], ["1"]], false]],
      ["grid_line", [1, 1, 0, [["2"], ["2"], ["2"]], false]],
      ["grid_line", [1, 2, 0, [["3"], ["3"], ["3"]], false]],
      ["grid_scroll", [1, 0, 3, 0, 3, 1, 0]],
      ["flush", []],
    ])

    const snap = ui.snapshot()
    expect(snap.rows[0]?.map((item) => item.text).join("")).toBe("222")
    expect(snap.rows[1]?.map((item) => item.text).join("")).toBe("333")
  })
})
