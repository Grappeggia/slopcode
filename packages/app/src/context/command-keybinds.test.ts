import { describe, expect, test } from "bun:test"
import { LAYOUT_KEYBINDS, TITLEBAR_KEYBINDS } from "./command-keybinds"

describe("titlebar command keybinds", () => {
  test("keeps Home and reopen shortcuts distinct from existing layout commands", () => {
    const bindings = [
      TITLEBAR_KEYBINDS.home,
      TITLEBAR_KEYBINDS.reopen,
      LAYOUT_KEYBINDS.sidebar,
      LAYOUT_KEYBINDS.theme,
    ]

    expect(new Set(bindings).size).toBe(bindings.length)
    expect(TITLEBAR_KEYBINDS.home).toBe("mod+b")
    expect(TITLEBAR_KEYBINDS.reopen).toBe("mod+shift+t")
  })
})
