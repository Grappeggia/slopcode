import { describe, expect, test } from "bun:test"
import { assertRendererStoreName, isRendererStoreName } from "./store-name"

describe("renderer store names", () => {
  test("allows every renderer persistence store", () => {
    for (const name of [
      "default.dat",
      "slopcode.global.dat",
      "slopcode.workspace.home.abc123.dat",
      "slopcode.draft.draft-1.abc123.dat",
    ]) {
      expect(isRendererStoreName(name)).toBe(true)
      expect(assertRendererStoreName(name)).toBe(name)
    }
  })

  test("rejects traversal and non-renderer stores", () => {
    for (const name of [
      "../default.dat",
      "slopcode.workspace.foo/../../outside.dat",
      "slopcode.workspace.foo\\outside.dat",
      "slopcode.settings",
      "other.dat",
      "slopcode.workspace..dat",
    ]) {
      expect(isRendererStoreName(name)).toBe(false)
      expect(() => assertRendererStoreName(name)).toThrow("Invalid renderer store name")
    }
  })
})
