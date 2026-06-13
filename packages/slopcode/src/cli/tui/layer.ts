import { run as runTui, type TuiInput } from "@slopcode-ai/tui"
import { Global } from "@slopcode-ai/core/global"
import { Effect } from "effect"

export function run(input: TuiInput) {
  return runTui(input).pipe(Effect.provide(Global.defaultLayer))
}
