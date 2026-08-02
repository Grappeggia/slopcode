import { describe, expect, test } from "bun:test"
import { createFocusDebugAction } from "./focus-debug"

describe("renderer focus debug gate", () => {
  const action = async (_enabled: boolean) => undefined

  test("does not expose the action without explicit development opt-in", () => {
    expect(createFocusDebugAction(false, false, action)).toBeUndefined()
    expect(createFocusDebugAction(false, true, action)).toBeUndefined()
    expect(createFocusDebugAction(true, false, action)).toBeUndefined()
  })

  test("exposes only the constrained action in opted-in development", () => {
    expect(createFocusDebugAction(true, true, action)).toBe(action)
  })
})
