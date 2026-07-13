export * as ShellCommand from "./shell"

import { Duration, Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { Config } from "./config"
import { AppProcess } from "./process"

export const DEFAULT_TIMEOUT_MS = 2 * 60 * 1_000
export const MAX_TIMEOUT_MS = 10 * 60 * 1_000
export const MAX_CAPTURE_BYTES = 1024 * 1024

export type Result = {
  readonly command: string
  readonly cwd: string
  readonly exitCode?: number
  readonly output: string
  readonly truncated: boolean
  readonly stdoutTruncated?: boolean
  readonly stderrTruncated?: boolean
  readonly timedOut?: boolean
}

export const defaultShell = () => (process.platform === "win32" ? (process.env.COMSPEC ?? "cmd.exe") : "/bin/sh")
export const select = (entries: readonly Config.Entry[]) => Config.latest(entries, "shell") ?? defaultShell()

export const compactOutput = (stdout: string, stderr: string) => {
  const output = stdout && stderr ? `${stdout}\n\nstderr:\n${stderr}` : stderr ? `stderr:\n${stderr}` : stdout
  return output || "(no output)"
}

export const captureNotice = (stdout: boolean, stderr: boolean) => {
  if (stdout && stderr) return "[stdout and stderr capture truncated at the in-memory safety limit]"
  if (stdout) return "[stdout capture truncated at the in-memory safety limit]"
  if (stderr) return "[stderr capture truncated at the in-memory safety limit]"
  return undefined
}

export const isTimeout = (error: AppProcess.AppProcessError) =>
  error.cause instanceof Error && error.cause.message === "Timed out"

export const run = Effect.fn("ShellCommand.run")(function* (
  input: { readonly command: string; readonly cwd: string; readonly timeout?: number },
  beforeSpawn: Effect.Effect<void> = Effect.void,
  launch?: AppProcess.Launch,
) {
  const config = yield* Config.Service
  const appProcess = yield* AppProcess.Service
  const shell = select(yield* config.entries())
  const command = ChildProcess.make(input.command, [], {
    cwd: input.cwd,
    shell,
    stdin: "ignore",
    detached: process.platform !== "win32",
    forceKillAfter: Duration.seconds(3),
  })
  const timeout = input.timeout ?? DEFAULT_TIMEOUT_MS
  const result = yield* beforeSpawn.pipe(
    Effect.andThen(
      appProcess.run(command, {
        timeout: Duration.millis(timeout),
        maxOutputBytes: MAX_CAPTURE_BYTES,
        maxErrorBytes: MAX_CAPTURE_BYTES,
        ...(launch ? { launch } : {}),
      }),
    ),
    Effect.catchTag("AppProcessError", (error) => (isTimeout(error) ? Effect.succeed(undefined) : Effect.fail(error))),
  )
  if (!result)
    return {
      command: input.command,
      cwd: input.cwd,
      output: `Command exceeded timeout of ${timeout} ms. Retry with a larger timeout if the command is expected to take longer.`,
      truncated: false,
      timedOut: true,
    } satisfies Result

  const output = compactOutput(result.stdout.toString("utf8"), result.stderr.toString("utf8"))
  const notice = captureNotice(result.stdoutTruncated, result.stderrTruncated)
  return {
    command: input.command,
    cwd: input.cwd,
    exitCode: result.exitCode,
    output: notice ? `${output}\n\n${notice}` : output,
    truncated: result.stdoutTruncated || result.stderrTruncated,
    ...(result.stdoutTruncated ? { stdoutTruncated: true } : {}),
    ...(result.stderrTruncated ? { stderrTruncated: true } : {}),
  } satisfies Result
})
