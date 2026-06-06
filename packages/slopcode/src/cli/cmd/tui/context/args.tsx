import { createSimpleContext } from "./helper"
import type { FilePart } from "@slopcode-ai/sdk/v2"

export interface Args {
  model?: string
  agent?: string
  prompt?: string
  promptParts?: Omit<FilePart, "id" | "messageID" | "sessionID">[]
  continue?: boolean
  sessionID?: string
  fork?: boolean
}

export const { use: useArgs, provider: ArgsProvider } = createSimpleContext({
  name: "Args",
  init: (props: Args) => props,
})
