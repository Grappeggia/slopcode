import { describe, expect, test } from "bun:test"
import { active, metadata, settings } from "../../src/prompt/memory"

describe("prompt memory helpers", () => {
  test("parses persisted memory settings", () => {
    expect(settings({ status: "enabled" })).toEqual({ status: "enabled" })
    expect(settings({ status: "disabled" })).toEqual({ status: "disabled" })
    expect(settings({ status: "weird" })).toBeUndefined()
    expect(settings(null)).toBeUndefined()
  })

  test("resolves active state from metadata before config", () => {
    expect(active(undefined, { enabled: true })).toBe(true)
    expect(active({ memory: { status: "enabled" } }, { enabled: false })).toBe(true)
    expect(active({ memory: { status: "disabled" } }, { enabled: true })).toBe(false)
    expect(active(undefined, undefined)).toBe(false)
  })

  test("preserves unrelated metadata when setting and clearing memory", () => {
    expect(metadata({ branch: "dev" }, { status: "enabled" })).toEqual({
      branch: "dev",
      memory: { status: "enabled" },
    })
    expect(metadata({ branch: "dev", memory: { status: "enabled" } }, undefined)).toEqual({ branch: "dev" })
  })
})
