import { pathToFileURL } from "bun"
import path from "path"
import type { PromptInfo } from "./history"

export function promptFileVirtualText(name: string) {
  return "@" + name
}

export function createPromptFilePart(input: {
  path: string
  directory: string
  lineRange?: {
    startLine: number
    endLine?: number
  }
}) {
  const url = pathToFileURL(path.join(input.directory, input.path))
  const filename =
    input.lineRange === undefined
      ? input.path
      : `${input.path}#${input.lineRange.startLine}${input.lineRange.endLine ? `-${input.lineRange.endLine}` : ""}`

  if (input.lineRange) {
    url.searchParams.set("start", String(input.lineRange.startLine))
    if (input.lineRange.endLine !== undefined) {
      url.searchParams.set("end", String(input.lineRange.endLine))
    }
  }

  return {
    type: "file",
    mime: "text/plain",
    filename,
    url: url.href,
    source: {
      type: "file",
      text: {
        start: 0,
        end: 0,
        value: "",
      },
      path: input.path,
    },
  } satisfies Extract<PromptInfo["parts"][number], { type: "file" }>
}
