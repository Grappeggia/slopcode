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
  if (status.strategy === "sidecar" && status.sidecar) {
    return run({
      path: status.sidecar,
      url: input.url,
      args: input.args,
      config: input.config,
      directory: input.directory,
      viewID: input.viewID,
      headers: input.headers,
    }).then(
      () => true,
      (error) => {
        UI.println(UI.Style.TEXT_WARNING_BOLD + "Android sidecar TUI failed: " + UI.Style.TEXT_NORMAL + text(error))
        return false
      },
    )
  }
  return false
}

export { probe, sidecar, wanted } from "./probe"
export { decode, encode, message, VERSION, type HostMessage } from "./protocol"
