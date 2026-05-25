import { describe, expect, test } from "bun:test"
import { lint } from "../../src/editor/lint"

describe("editor lint", () => {
  test("reports json syntax errors", () => {
    const result = lint("bad.json", '{"foo": ]')
    expect(result.some((item) => item.severity === "error")).toBe(true)
  })

  test("reports javascript parse errors", () => {
    const result = lint("bad.ts", "const =")
    expect(result.some((item) => item.severity === "error")).toBe(true)
  })

  test("reports simple style warnings", () => {
    const result = lint("foo.txt", "value  \n<<<<<<< HEAD")
    expect(result.some((item) => item.severity === "warning")).toBe(true)
    expect(result.some((item) => item.message.includes("merge conflict"))).toBe(true)
  })
})
