import { UI } from "@/cli/ui"
import type { TuiConfig } from "@/config/tui"
import type { Args } from "../context/args"
import { probe } from "./probe"
import { run } from "./sidecar"

export async function androidHostTui(input: {
  url: string
  args: Args
  config: TuiConfig.Info
  directory?: string
  viewID?: string
  headers?: RequestInit["headers"]
  onExit?: () => Promise<void>
}) {
  const status = await probe({
    platform: process.platform,
    host: process.env.SLOPCODE_ANDROID_HOST,
    tui: process.env.SLOPCODE_ANDROID_TUI,
  })
  if (!status.enabled) return false
  if (!status.available) {
    UI.println(UI.Style.TEXT_WARNING_BOLD + "Android host unavailable: " + UI.Style.TEXT_NORMAL + status.reason)
    return false
  }
  if (status.strategy === "opentui") {
    const { tui } = await import("../app")
    await tui(input)
    return true
  }
  if (status.strategy === "sidecar" && status.sidecar) {
    await run({
      path: status.sidecar,
      text: [
        "SlopCode Android host spike",
        "",
        "The Termux sidecar IPC renderer is packaged and reachable.",
        "Set SLOPCODE_ANDROID_HOST=1 after the OpenTUI Android backend is available to run the full app.tsx tree.",
        "Portable TUI remains the default fallback.",
      ].join("\n"),
    })
    return true
  }
  return false
}

export { probe, sidecar, wanted } from "./probe"
export { decode, encode, message, VERSION, type HostMessage } from "./protocol"
