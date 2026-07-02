import { expect, test } from "bun:test"
import { density, isCompact, isDense } from "../../src/util/density"

test("classifies compact terminal sizes", () => {
  expect(density({ width: 100, height: 30 })).toBe("comfortable")
  expect(density({ width: 80, height: 30 })).toBe("compact")
  expect(density({ width: 100, height: 20 })).toBe("compact")
  expect(density({ width: 60, height: 30 })).toBe("dense")
  expect(density({ width: 100, height: 16 })).toBe("dense")
})

test("treats dense as compact", () => {
  expect(isCompact("compact")).toBe(true)
  expect(isCompact("dense")).toBe(true)
  expect(isCompact("comfortable")).toBe(false)
  expect(isDense("dense")).toBe(true)
})
