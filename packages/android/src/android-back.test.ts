import { describe, expect, test } from "bun:test"
import { handleAndroidBack } from "./android-back"

describe("Android Back contract", () => {
  test("closes a transient panel before moving through onboarding", () => {
    const calls: string[] = []
    expect(
      handleAndroidBack(() => true, () => {
        calls.push("navigate")
        return true
      }),
    ).toBeTrue()
    expect(calls).toEqual([])
  })

  test("moves up a handled onboarding step and permits the final system exit", () => {
    expect(handleAndroidBack(() => false, () => true)).toBeTrue()
    expect(handleAndroidBack(() => false, () => false)).toBeFalse()
  })
})
