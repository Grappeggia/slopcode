import { describe, expect, test } from "bun:test"
import { footerHeightPolicy, footerMenuRows } from "@/cli/cmd/run/footer.height"

describe("run footer height", () => {
  test("preserves preferred heights and reserves transcript rows when possible", () => {
    for (const preferred of [4, 15, 17, 19]) {
      expect(footerHeightPolicy({ terminal: 24, preferred, minimum: Math.min(preferred, 8) })).toBe(preferred)
    }

    const matrix = [
      { terminal: 18, preferred: 17, minimum: 8, expected: 14 },
      { terminal: 12, preferred: 17, minimum: 8, expected: 8 },
      { terminal: 12, preferred: 15, minimum: 10, expected: 10 },
      { terminal: 10, preferred: 17, minimum: 8, expected: 8 },
      { terminal: 7, preferred: 17, minimum: 8, expected: 7 },
    ]

    for (const item of matrix) {
      expect(footerHeightPolicy(item)).toBe(item.expected)
    }
  })

  test("derives panel content rows from the actual footer height", () => {
    expect(footerMenuRows(17, 10)).toBe(10)
    expect(footerMenuRows(14, 10)).toBe(7)
    expect(footerMenuRows(8, 10)).toBe(1)
    expect(footerMenuRows(7, 12)).toBe(1)
  })
})
