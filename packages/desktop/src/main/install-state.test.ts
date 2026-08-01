import { describe, expect, test } from "bun:test"
import { hasExistingAppState } from "./install-state"

const file = (name: string) => ({ name, isDirectory: () => false })
const directory = (name: string) => ({ name, isDirectory: () => true })

describe("install state", () => {
  test("ignores Electron files from a fresh install", () => {
    expect(hasExistingAppState([file("Local State"), directory("Crashpad")])).toBe(false)
  })

  test("recognizes SlopCode state", () => {
    expect(hasExistingAppState([file("slopcode.settings")])).toBe(true)
    expect(hasExistingAppState([file("slopcode.global.dat")])).toBe(true)
    expect(hasExistingAppState([file("window-state-a.json")])).toBe(true)
    expect(hasExistingAppState([directory("slopcode")])).toBe(true)
  })
})
