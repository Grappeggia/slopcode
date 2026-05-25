import { describe, expect, test } from "bun:test"
import { formatKeybind, matchKeybind, parseKeybind } from "./command"

describe("command keybind helpers", () => {
  test("parseKeybind handles aliases and multiple combos", () => {
    const keybinds = parseKeybind("control+option+k, mod+shift+comma")

    expect(keybinds).toHaveLength(2)
    expect(keybinds[0]).toEqual({
      key: "k",
      ctrl: true,
      meta: false,
      shift: false,
      alt: true,
    })
    expect(keybinds[1]?.shift).toBe(true)
    expect(keybinds[1]?.key).toBe("comma")
    expect(Boolean(keybinds[1]?.ctrl || keybinds[1]?.meta)).toBe(true)
  })

  test("parseKeybind treats none and empty as disabled", () => {
    expect(parseKeybind("none")).toEqual([])
    expect(parseKeybind("")).toEqual([])
  })

  test("matchKeybind normalizes punctuation keys", () => {
    const keybinds = parseKeybind("ctrl+comma, shift+plus, meta+space")

    expect(matchKeybind(keybinds, new KeyboardEvent("keydown", { key: ",", ctrlKey: true }))).toBe(true)
    expect(matchKeybind(keybinds, new KeyboardEvent("keydown", { key: "+", shiftKey: true }))).toBe(true)
    expect(matchKeybind(keybinds, new KeyboardEvent("keydown", { key: " ", metaKey: true }))).toBe(true)
    expect(matchKeybind(keybinds, new KeyboardEvent("keydown", { key: ",", ctrlKey: true, altKey: true }))).toBe(false)
  })

  test("matchKeybind normalizes shifted bracket keys", () => {
    // Browsers report Shift+[ as '{' and Shift+] as '}' - test with explicit ctrl and meta
    const prevCtrl = parseKeybind("ctrl+shift+[")
    const nextCtrl = parseKeybind("ctrl+shift+]")
    const prevMeta = parseKeybind("meta+shift+[")
    const nextMeta = parseKeybind("meta+shift+]")
    expect(matchKeybind(prevCtrl, new KeyboardEvent("keydown", { key: "{", ctrlKey: true, shiftKey: true }))).toBe(true)
    expect(matchKeybind(nextCtrl, new KeyboardEvent("keydown", { key: "}", ctrlKey: true, shiftKey: true }))).toBe(true)
    expect(matchKeybind(prevMeta, new KeyboardEvent("keydown", { key: "{", metaKey: true, shiftKey: true }))).toBe(true)
    expect(matchKeybind(nextMeta, new KeyboardEvent("keydown", { key: "}", metaKey: true, shiftKey: true }))).toBe(true)
    // Unshifted brackets should not match
    expect(matchKeybind(prevCtrl, new KeyboardEvent("keydown", { key: "[", ctrlKey: true, shiftKey: false }))).toBe(
      false,
    )
  })

  test("formatKeybind returns human readable output", () => {
    const display = formatKeybind("ctrl+alt+arrowup")

    expect(display).toContain("↑")
    expect(display.includes("Ctrl") || display.includes("⌃")).toBe(true)
    expect(display.includes("Alt") || display.includes("⌥")).toBe(true)
    expect(formatKeybind("none")).toBe("")
  })
})
