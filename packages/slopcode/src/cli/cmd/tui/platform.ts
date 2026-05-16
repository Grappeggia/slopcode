import { UI } from "@/cli/ui"

export function native(input = { platform: process.platform, override: process.env.SLOPCODE_ANDROID_TUI }) {
  if (input.platform !== "android") return true
  return input.override === "1"
}

export function guard() {
  if (native()) return false
  UI.error(
    "Native Termux TUI is blocked because Bun for Android disables bun:ffi, which OpenTUI requires. Use `slopcode run` or `slopcode serve`, or run SlopCode in proot-distro for the interactive TUI.",
  )
  return true
}
