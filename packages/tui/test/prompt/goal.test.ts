import { describe, expect, test } from "bun:test"
import { action, goal, message, metadata } from "../../src/prompt/goal"

const existing = { text: "Ship goal mode", status: "active" as const, updatedAt: 10 }

describe("prompt goal helpers", () => {
  test("parses valid persisted goals", () => {
    expect(goal({ text: "Keep focused", status: "paused", updatedAt: 123 })).toEqual({
      text: "Keep focused",
      status: "paused",
      updatedAt: 123,
    })
    expect(goal({ text: "Keep focused", status: "weird" })).toEqual({
      text: "Keep focused",
      status: "active",
      updatedAt: 0,
    })
    expect(goal({ text: "" })).toBeUndefined()
    expect(goal(null)).toBeUndefined()
  })

  test("formats goal messages", () => {
    expect(message(undefined)).toBe("No goal is set.")
    expect(message(existing)).toBe("Active: Ship goal mode")
    expect(message({ ...existing, status: "paused" })).toBe("Paused: Ship goal mode")
  })

  test("preserves unrelated metadata when setting and clearing goals", () => {
    expect(metadata({ branch: "dev" }, existing)).toEqual({ branch: "dev", goal: existing })
    expect(metadata({ branch: "dev", goal: existing }, undefined)).toEqual({ branch: "dev" })
  })

  test("resolves show and status without changing metadata", () => {
    expect(action("", existing)).toEqual({ type: "show", message: "Active: Ship goal mode" })
    expect(action("status", existing)).toEqual({ type: "show", message: "Active: Ship goal mode" })
    expect(action("show", undefined)).toEqual({ type: "show", message: "No goal is set." })
  })

  test("resolves set, pause, resume, and clear actions", () => {
    expect(action("  Finish validation  ", undefined, 20)).toEqual({
      type: "update",
      next: { text: "Finish validation", status: "active", updatedAt: 20 },
      message: "Active: Finish validation",
    })
    expect(action("pause", existing, 21)).toEqual({
      type: "update",
      next: { text: "Ship goal mode", status: "paused", updatedAt: 21 },
      message: "Paused: Ship goal mode",
    })
    expect(action("resume", { ...existing, status: "paused" }, 22)).toEqual({
      type: "update",
      next: { text: "Ship goal mode", status: "active", updatedAt: 22 },
      message: "Active: Ship goal mode",
    })
    expect(action("clear", existing)).toEqual({ type: "update", next: undefined, message: "Goal cleared" })
  })

  test("does not pause or resume missing goals", () => {
    expect(action("pause", undefined)).toEqual({ type: "missing", message: "No goal is set" })
    expect(action("resume", undefined)).toEqual({ type: "missing", message: "No goal is set" })
  })
})
