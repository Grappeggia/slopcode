import { describe, expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { SSH_SHELL_VISUAL_FIXTURES } from "./ssh-shell-visual"

const root = fileURLToPath(new URL("..", import.meta.url))

describe("SSH shell visual fixture matrix", () => {
  test("covers every supported theme, orientation, large-font, keyboard, and inset state", () => {
    expect(SSH_SHELL_VISUAL_FIXTURES).toHaveLength(8)
    expect(new Set(SSH_SHELL_VISUAL_FIXTURES.map((item) => item.scheme))).toEqual(new Set(["light", "dark"]))
    expect(new Set(SSH_SHELL_VISUAL_FIXTURES.map((item) => item.orientation))).toEqual(new Set(["portrait", "landscape"]))
    expect(SSH_SHELL_VISUAL_FIXTURES.some((item) => item.fontScale >= 1.3 && item.keyboard)).toBeTrue()
    expect(new Set(SSH_SHELL_VISUAL_FIXTURES.map((item) => item.insets))).toEqual(new Set(["system", "gesture"]))
  })

  test("keeps the visual shell self-contained and scrollable inside the dynamic viewport", async () => {
    const css = await Bun.file(`${root}/src/ssh-shell.css`).text()
    expect(css).toContain("--ssh-canvas")
    expect(css).toContain("--ssh-drawer")
    expect(css).toContain("--color-surface-brand-base: var(--surface-brand-base)")
    expect(css).toContain("[data-ssh-theme=\"dark\"]")
    expect(css).toContain("block-size: 100dvh")
    expect(css).toContain("overflow-y: auto")
    expect(css).toContain("keyboard-inset-height")
    expect(css).toContain('form > button[type="submit"]')
    expect(css).toContain("orientation: landscape")
    expect(css).toContain("min-width: 48px")
    expect(css).toContain("min-height: 48px")
  })

  test("synchronizes the selected WebView theme with readable native system bars", async () => {
    const shell = await Bun.file(`${root}/src/ssh-shell.tsx`).text()
    const bridge = await Bun.file(`${root}/src/bridge.ts`).text()
    const activity = await Bun.file(`${root}/app/src/main/java/dev/slopcode/android/MainActivity.kt`).text()
    const native = await Bun.file(`${root}/app/src/main/java/dev/slopcode/android/AndroidBridge.kt`).text()

    expect(shell).toContain("setSystemBars")
    expect(shell).toContain('aria-label={open() ? "Close navigation" : "Open navigation"}')
    expect(bridge).toContain("setSystemBars?(dark: boolean)")
    expect(native).toContain('"setSystemBars"')
    expect(activity).toContain("WindowCompat.setDecorFitsSystemWindows(window, false)")
    expect(activity).toContain("isAppearanceLightStatusBars = !dark")
    expect(activity).toContain("isAppearanceLightNavigationBars = !dark")
  })
})
