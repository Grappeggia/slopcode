export * as BashTool from "./bash"

import path from "path"
import { ToolFailure } from "@slopcode-ai/llm"
import { Effect, Layer, Schema } from "effect"
import { Config } from "../config"
import { FSUtil } from "../fs-util"
import { LocationMutation } from "../location-mutation"
import { AppProcess } from "../process"
import { PermissionV2 } from "../permission"
import { PositiveInt } from "../schema"
import { ShellParser } from "../shell-parser"
import { ShellCommand } from "../shell"
import { Tool } from "./tool"
import { Tools } from "./tools"

export const name = "bash"
export const DEFAULT_TIMEOUT_MS = ShellCommand.DEFAULT_TIMEOUT_MS
export const MAX_TIMEOUT_MS = ShellCommand.MAX_TIMEOUT_MS
export const MAX_CAPTURE_BYTES = ShellCommand.MAX_CAPTURE_BYTES

export const Input = Schema.Struct({
  command: Schema.String.annotate({ description: "Shell command string to execute" }),
  workdir: Schema.String.pipe(Schema.optional).annotate({
    description: "Working directory. Defaults to the active Location; relative paths resolve from that Location.",
  }),
  timeout: PositiveInt.check(Schema.isLessThanOrEqualTo(MAX_TIMEOUT_MS))
    .pipe(Schema.optional)
    .annotate({
      description: `Timeout in milliseconds. Defaults to ${DEFAULT_TIMEOUT_MS} and may not exceed ${MAX_TIMEOUT_MS}.`,
    }),
  description: Schema.String.pipe(Schema.optional).annotate({
    description: "Concise description of the command's purpose",
  }),
})

const Output = Schema.Struct({
  command: Schema.String,
  cwd: Schema.String,
  exitCode: Schema.Number.pipe(Schema.optional),
  /** Bounded compact equivalent of stdout/stderr: stderr is labeled when present. */
  output: Schema.String,
  truncated: Schema.Boolean,
  stdoutTruncated: Schema.Boolean.pipe(Schema.optional),
  stderrTruncated: Schema.Boolean.pipe(Schema.optional),
  timedOut: Schema.Boolean.pipe(Schema.optional),
  warnings: Schema.Array(Schema.String).pipe(Schema.optional),
})

type Output = typeof Output.Type

const modelOutput = (output: Output) => {
  const warnings = output.warnings?.length
    ? `\n\nWarnings:\n${output.warnings.map((warning) => `- ${warning}`).join("\n")}`
    : ""
  if (output.timedOut) return `${output.output}${warnings}\n\nCommand timed out before completion.`
  return `${output.output}${warnings}\n\nCommand exited with code ${output.exitCode}.`
}

/**
 * Minimal V2 core shell boundary. Keep parity debt visible without pulling the
 * legacy shell runtime into core.
 */
// TODO: Port BashArity reusable command-prefix approvals.
// TODO: Replace token-based command-argument external-directory advisories with parser-based detection.
// TODO: Restore PowerShell and cmd-specific invocation/path handling on Windows.
// TODO: Add plugin shell.env environment augmentation once V2 plugin hooks exist.
// TODO: Add durable/live progress metadata streaming for long-running commands once V2 tool invocation progress context is wired.
// TODO: Persist background job status and define restart recovery before exposing remote observation.
// TODO: Re-add model-facing background launch only with owner-bound get/wait/cancel tools and completion delivery.
// TODO: Add HTTP background-job observation only after durable status, restart recovery, and authorization are defined.
// TODO: Revisit process-group cleanup and platform coverage with shell-specific tests if current AppProcess semantics do not fully cover it.
// TODO: Revisit binary output handling if stdout/stderr decoding is text-only.
// TODO: Stream full shell output into managed storage while retaining only a bounded in-memory preview.

const shellTokens = (command: string) => command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []
const unquote = (value: string) => value.replace(/^(['"])(.*)\1$/, "$2")
const externalCommandDirectories = (command: string, cwd: string) => {
  const directories = new Set<string>()
  for (const token of shellTokens(command)) {
    const value = unquote(token).replace(/[;,|&]+$/, "")
    if (!path.isAbsolute(value)) continue
    const resolved = FSUtil.resolve(value)
    if (FSUtil.contains(cwd, resolved)) continue
    directories.add(FSUtil.resolve(path.dirname(resolved)))
  }
  return [...directories]
}

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const mutation = yield* LocationMutation.Service
    const fs = yield* FSUtil.Service
    const appProcess = yield* AppProcess.Service
    const config = yield* Config.Service
    const permission = yield* PermissionV2.Service

    yield* tools
      .register({
        [name]: Tool.make({
          description: `Execute one shell command string with the host user's filesystem, process, and network authority. The active Location is the default working directory. Relative workdir values resolve from that Location. External workdir values require external_directory approval; best-effort command-argument path warnings are advisory only. Timeout values are milliseconds (default: ${DEFAULT_TIMEOUT_MS}; maximum: ${MAX_TIMEOUT_MS}). Uses the configured shell when set; otherwise uses /bin/sh on POSIX and COMSPEC or cmd.exe on Windows.`,
          input: Input,
          output: Output,
          toModelOutput: ({ output }) => [{ type: "text", text: modelOutput(output) }],
          execute: (input, context) =>
            Effect.gen(function* () {
              const source = {
                type: "tool" as const,
                messageID: context.assistantMessageID,
                callID: context.toolCallID,
              }
              const target = yield* mutation.resolve({ path: input.workdir ?? ".", kind: "directory" })
              const entries = yield* config.entries()
              const shell = ShellCommand.select(entries)
              const resources = yield* Effect.tryPromise({
                try: () => ShellParser.resources(input.command, shell),
                catch: (error) =>
                  new ToolFailure({
                    message: `Unable to safely authorize command for shell ${JSON.stringify(shell)}: ${error instanceof Error ? error.message : String(error)}`,
                  }),
              })
              const external = target.externalDirectory
              if (external)
                yield* permission.assert({
                  ...LocationMutation.externalDirectoryPermission(external),
                  sessionID: context.sessionID,
                  agent: context.agent,
                  source,
                })
              const warnings = externalCommandDirectories(input.command, target.canonical).map(
                (directory) =>
                  `Command argument references external directory ${path.join(directory, "*").replaceAll("\\", "/")}. Bash runs with host-user filesystem, process, and network authority; this scan is advisory only.`,
              )
              yield* permission.assert({
                action: name,
                resources,
                save: resources,
                metadata: {
                  command: input.command,
                  shell,
                  ...(input.description ? { description: input.description } : {}),
                },
                sessionID: context.sessionID,
                agent: context.agent,
                source,
              })

              if ((yield* fs.stat(target.canonical)).type !== "Directory")
                return yield* Effect.fail(new Error(`Working directory is not a directory: ${target.canonical}`))

              const result = yield* ShellCommand.run({
                command: input.command,
                cwd: target.canonical,
                timeout: input.timeout,
              }).pipe(
                Effect.provideService(Config.Service, config),
                Effect.provideService(AppProcess.Service, appProcess),
              )
              return {
                ...result,
                ...(warnings.length ? { warnings } : {}),
              }
            }).pipe(
              Effect.mapError((error) =>
                error instanceof ToolFailure
                  ? error
                  : new ToolFailure({ message: `Unable to execute command: ${input.command}` }),
              ),
            ),
        }),
      })
      .pipe(Effect.orDie)
  }),
)
