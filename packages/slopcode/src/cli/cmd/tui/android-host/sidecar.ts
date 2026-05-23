import { DaemonAuth } from "@/daemon/auth"
import type { TuiConfig } from "@/config/tui"
import { spawn } from "child_process"
import type { Args } from "../context/args"

export async function run(input: {
  path: string
  url: string
  args: Args
  config: TuiConfig.Info
  directory?: string
  viewID?: string
  headers?: RequestInit["headers"]
}) {
  const headers = new Headers(input.headers)
  const token = headers.get(DaemonAuth.Header) ?? ""
  const child = spawn(
    input.path,
    [
      "--url",
      input.url,
      "--token",
      token,
      ...(input.directory ? ["--cwd", input.directory] : []),
      ...(input.viewID ? ["--view-id", input.viewID] : []),
      ...(input.args.continue ? ["--continue"] : []),
      ...(input.args.sessionID ? ["--session", input.args.sessionID] : []),
      ...(input.args.fork ? ["--fork"] : []),
      ...(input.args.model ? ["--model", input.args.model] : []),
      ...(input.args.agent ? ["--agent", input.args.agent] : []),
      ...(input.args.prompt ? ["--prompt", input.args.prompt] : []),
    ],
    { cwd: input.directory, stdio: "inherit" },
  )
  return new Promise<void>((resolve, reject) => {
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) return resolve()
      reject(new Error(`Android host sidecar exited with ${code ?? "signal"}`))
    })
  })
}
