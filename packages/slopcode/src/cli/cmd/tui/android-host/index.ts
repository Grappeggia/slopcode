import { UI } from "@/cli/ui"
import type { TuiConfig } from "@/config/tui"
import type { Args } from "../context/args"
import { probe } from "./probe"
import { run } from "./sidecar"

function text(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

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
    return import("../app")
      .then((app) => app.tui(input))
      .then(
        () => true,
        (error) => {
          UI.println(UI.Style.TEXT_WARNING_BOLD + "Android shared TUI failed: " + UI.Style.TEXT_NORMAL + text(error))
          return false
        },
      )
  }
  if (status.strategy === "sidecar" && status.sidecar) {
    await run({
      path: status.sidecar,
      text: [
        "SlopCode Android host sidecar",
        "",
        "The Termux sidecar IPC renderer is packaged and reachable.",
        "Default Android startup now tries the shared OpenTUI app before falling back.",
        "Set SLOPCODE_ANDROID_HOST=portable to force the portable fallback.",
      ].join("\n"),
    })
    return true
  }
  return false
}

export { probe, sidecar, wanted } from "./probe"
export { decode, encode, message, VERSION, type HostMessage } from "./protocol"
