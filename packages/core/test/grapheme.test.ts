import { describe, expect, test } from "bun:test"
import { Grapheme } from "@slopcode-ai/core/util/grapheme"

describe("Grapheme", () => {
  test("bounds text without splitting surrogate pairs or grapheme clusters", () => {
    expect(Grapheme.take("a😀b", 3)).toBe("a😀")
    expect(Grapheme.takeEnd("a😀b", 3)).toBe("😀b")
    expect(Grapheme.take("e\u0301x", 2)).toBe("e\u0301")
    expect(Grapheme.take("👨‍👩‍👧‍👦x", 10)).toBe("")
  })
})
