import { describe, expect, test } from "bun:test"
import { render } from "../../src/editor/highlight"

describe("editor highlight", () => {
  test("renders syntax-colored rows with a cursor and diagnostics gutter", async () => {
    const rows = await render({
      file: "test.ts",
      lines: ["const x = 1"],
      row: 0,
      col: 0,
      top: 0,
      left: 0,
      width: 30,
      height: 2,
      diagnostics: [{ line: 1, column: 1, severity: "warning", message: "warn" }],
    })

    expect(rows).toHaveLength(2)
    expect(rows[0]?.map((item) => item.text).join("")).toContain("1 ~")
    expect(rows[0]?.some((item) => item.bg)).toBe(true)
    expect(rows[0]?.some((item) => item.fg && item.fg !== "#D1D5DB")).toBe(true)
  })
})
