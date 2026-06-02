import { UI } from "@/cli/ui"
import fs from "fs"
import path from "path"

function bionic() {
  return (
    process.env.SLOPCODE_BIONIC === "1" ||
    process.env.TERMUX_VERSION !== undefined ||
    process.env.PREFIX?.includes("/com.termux/")
  )
}

export function native(
  input: {
    platform: string
    override?: string
  } = { platform: process.platform, override: process.env.SLOPCODE_ANDROID_TUI },
) {
  return !android(input)
}

export function android(
  input: {
    platform: string
    override?: string
  } = { platform: process.platform, override: process.env.SLOPCODE_ANDROID_TUI },
) {
  return input.platform === "android" || (input.platform === process.platform && bionic())
}

export function client(root = process.env.SLOPCODE_ANDROID_ROOT) {
  const host = root && path.join(root, "bin", "slopcode-android-host")
  if (host && fs.existsSync(host)) return host
}

export function guard() {
  if (native()) return false
  UI.error(
    "Shared OpenTUI is disabled on Android. SlopCode uses the bundled Rust runtime instead; reinstall with npm install -g slopcode@latest --include=optional if this message persists.",
  )
  return true
}
