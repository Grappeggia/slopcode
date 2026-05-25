import { addDefaultParsers } from "@opentui/core"
import parsers from "../../../parsers-config.ts"

let ready = false

export function ensureDefaultParsers() {
  if (ready) return
  addDefaultParsers(parsers.parsers)
  ready = true
}
