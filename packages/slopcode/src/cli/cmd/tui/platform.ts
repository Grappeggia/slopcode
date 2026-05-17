import { UI } from "@/cli/ui"
import fs from "fs"
import path from "path"

export function native(input = { platform: process.platform, override: process.env.SLOPCODE_ANDROID_TUI }) {
  if (input.platform !== "android") return true
  return input.override === "1"
}

export function android(input = { platform: process.platform, override: process.env.SLOPCODE_ANDROID_TUI }) {
  return input.platform === "android" && input.override !== "1"
}

export function client(root = process.env.SLOPCODE_ANDROID_ROOT) {
  const file = root && path.join(root, "bin", "slopcode-termux")
  if (file && fs.existsSync(file)) return file
}

export function guard() {
  if (native()) return false
  UI.error(
    "Native Termux TUI is blocked because Bun for Android disables bun:ffi, which OpenTUI requires. SlopCode should start the bundled Termux client instead; reinstall with npm install -g slopcode@latest if this message persists.",
  )
  return true
}
