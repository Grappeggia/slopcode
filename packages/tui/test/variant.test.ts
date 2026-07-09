import { expect, test } from "bun:test"
import { cycle, list } from "../src/context/variant"

test("exposes the GPT-5.6 catalog effort order and cycles through max to default", () => {
  const model = {
    id: "gpt-5.6",
    variants: {
      none: {},
      low: {},
      medium: {},
      high: {},
      xhigh: {},
      max: {},
    },
  }
  const variants = list(model.variants)

  expect(variants).toEqual(["none", "low", "medium", "high", "xhigh", "max"])
  expect(cycle(variants, "xhigh")).toBe("max")
  expect(cycle(variants, "max")).toBeUndefined()
})
