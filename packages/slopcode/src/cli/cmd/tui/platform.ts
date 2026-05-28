import { UI } from "@/cli/ui"
import fs from "fs"
import path from "path"

export function native(
  input: {
    platform: string
    override?: string
  } = { platform: process.platform, override: process.env.SLOPCODE_ANDROID_TUI },
) {
  return input.platform !== "android"
}

export function android(
  input: {
    platform: string
    override?: string
  } = { platform: process.platform, override: process.env.SLOPCODE_ANDROID_TUI },
) {
  return input.platform === "android"
}

export function client(root = process.env.SLOPCODE_ANDROID_ROOT) {
  const host = root && path.join(root, "bin", "slopcode-android-host")
  if (host && fs.existsSync(host)) return host
}

export function guard() {
  if (native()) return false
  UI.error(
    "Shared OpenTUI is disabled on Android. SlopCode uses the bundled Rust runtime instead; reinstall with npm install -g slopcode@latest --include=optional if the Android runtime is missing.",
  )
  return true
}
