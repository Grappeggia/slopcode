import { AppProcess } from "@slopcode-ai/core/process"
import { InstanceRef } from "@/effect/instance-ref"
import { Effect, Duration } from "effect"
import { opendir, lstat, realpath } from "node:fs/promises"
import path from "node:path"
import { ChildProcess } from "effect/unstable/process"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import {
  CODEX_TIMEOUT,
  MAX_CODEX_OUTPUT_BYTES,
  MAX_REMOTE_ENTRIES,
  MAX_REMOTE_ENTRY_NAME_LENGTH,
  MAX_REMOTE_PATH_LENGTH,
  RemoteAgentConfig,
  RemoteAgentPrompt,
  RemoteBrowseResult,
  RemoteRuntimeApi,
} from "../groups/remote-runtime"
import { ApiNotFoundError, ForbiddenError, InvalidRequestError, ServiceUnavailableError } from "../errors"

const CODEX_EXECUTABLE = "codex"
const CODEX_FORCE_KILL_AFTER = Duration.seconds(2)
const ENTRY_TYPE_RANK = {
  directory: 0,
  file: 1,
  symlink: 2,
  other: 3,
} as const

type Entry = (typeof RemoteBrowseResult.Type.entries)[number]
type Config = typeof RemoteAgentConfig.Type

type FilesystemError = {
  readonly code?: string
}

function isFilesystemError(error: unknown): error is FilesystemError {
  return typeof error === "object" && error !== null && ("code" in error ? typeof error.code === "string" : true)
}

function filesystemError(error: unknown, message: string) {
  if (isFilesystemError(error) && error.code === "ENOENT")
    return new ApiNotFoundError({ name: "NotFoundError", data: { message } })
  if (isFilesystemError(error) && (error.code === "EACCES" || error.code === "EPERM" || error.code === "ELOOP")) {
    return new ForbiddenError({ message })
  }
  return new ServiceUnavailableError({ message })
}

function isWithin(root: string, candidate: string) {
  const relative = path.posix.relative(root, candidate)
  return relative === "" || (!relative.startsWith("..") && !path.posix.isAbsolute(relative))
}

function compareEntries(left: Entry, right: Entry) {
  const rank = ENTRY_TYPE_RANK[left.type] - ENTRY_TYPE_RANK[right.type]
  if (rank !== 0) return rank
  if (left.name < right.name) return -1
  if (left.name > right.name) return 1
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0
}

function boundedOutput(stdout: Uint8Array, stderr: Uint8Array) {
  const output = Buffer.concat([stdout, stderr]).subarray(0, MAX_CODEX_OUTPUT_BYTES)
  return output.toString("utf8")
}

function codexArguments(prompt: string, config?: Config) {
  const args = ["exec"]
  if (config?.model) args.push("--model", config.model)
  if (config?.profile) args.push("--profile", config.profile)
  if (config?.sandbox) args.push("--sandbox", config.sandbox)
  if (config?.approval) args.push("--ask-for-approval", config.approval)
  args.push("--", prompt)
  return args
}

function timedOut(error: AppProcess.AppProcessError) {
  return error.message.includes("Timed out") || String(error.cause ?? "").includes("Timed out")
}

export const buildCodexArguments = codexArguments

export const runCodexPrompt = Effect.fn("RemoteRuntime.codexPrompt")(function* (input: {
  readonly directory: string
  readonly prompt: string
  readonly config?: Config
}) {
  const process = yield* AppProcess.Service
  const command = ChildProcess.make(CODEX_EXECUTABLE, codexArguments(input.prompt, input.config), {
    cwd: input.directory,
    extendEnv: true,
    stdin: "ignore",
    forceKillAfter: CODEX_FORCE_KILL_AFTER,
  })
  return yield* process
    .run(command, {
      timeout: CODEX_TIMEOUT,
      maxOutputBytes: MAX_CODEX_OUTPUT_BYTES,
      maxErrorBytes: MAX_CODEX_OUTPUT_BYTES,
    })
    .pipe(
      Effect.map((result) => ({
        output: boundedOutput(result.stdout, result.stderr),
        status: result.exitCode === 0 ? ("completed" as const) : ("failed" as const),
        exitCode: result.exitCode,
      })),
      Effect.catchTag("AppProcessError", (error) =>
        Effect.succeed({
          output: boundedOutput(Buffer.from(error.stderr ?? ""), Buffer.alloc(0)),
          status: timedOut(error) ? ("timed_out" as const) : ("failed" as const),
          ...(error.exitCode === undefined ? {} : { exitCode: error.exitCode }),
        }),
      ),
    )
})

async function listEntries(root: string, current: string) {
  const entries: Array<Entry> = []
  const directory = await opendir(current)
  for await (const entry of directory) {
    if (entry.name.length > MAX_REMOTE_ENTRY_NAME_LENGTH) continue
    const entryPath = path.posix.join(current, entry.name)
    if (Buffer.byteLength(entryPath) > MAX_REMOTE_PATH_LENGTH) continue
    const target = await realpath(entryPath).catch(() => undefined)
    if (!target || !isWithin(root, target)) continue
    const type = entry.isDirectory()
      ? "directory"
      : entry.isFile()
        ? "file"
        : entry.isSymbolicLink()
          ? "symlink"
          : "other"
    const next = { name: entry.name, path: entryPath, type } satisfies Entry
    entries.push(next)
    entries.sort(compareEntries)
    if (entries.length > MAX_REMOTE_ENTRIES) entries.pop()
  }
  return entries
}

export const browseRemoteFolder = Effect.fn("RemoteRuntime.browse")(function* (input: {
  readonly root: string
  readonly current: string
}) {
  if (!path.posix.isAbsolute(input.current) || input.current.includes("\0")) {
    return yield* new InvalidRequestError({ message: "path must be an absolute POSIX path", field: "path" })
  }
  if (Buffer.byteLength(input.current) > MAX_REMOTE_PATH_LENGTH) {
    return yield* new InvalidRequestError({ message: "path is too long", field: "path" })
  }

  const root = yield* Effect.tryPromise({
    try: () => realpath(input.root),
    catch: (error) => filesystemError(error, "the instance directory is unavailable"),
  })
  const current = yield* Effect.tryPromise({
    try: () => realpath(input.current),
    catch: (error) => filesystemError(error, "the requested folder is unavailable"),
  })
  if (!isWithin(root, current)) return yield* new ForbiddenError({ message: "path is outside the instance directory" })

  const info = yield* Effect.tryPromise({
    try: () => lstat(current),
    catch: (error) => filesystemError(error, "the requested folder is unavailable"),
  })
  if (!info.isDirectory())
    return yield* new ApiNotFoundError({ name: "NotFoundError", data: { message: "folder not found" } })
  if (Buffer.byteLength(root) > MAX_REMOTE_PATH_LENGTH || Buffer.byteLength(current) > MAX_REMOTE_PATH_LENGTH) {
    return yield* new ServiceUnavailableError({ message: "folder path is too long" })
  }

  const entries = yield* Effect.tryPromise({
    try: () => listEntries(root, current),
    catch: (error) => filesystemError(error, "the requested folder is unavailable"),
  })
  const parent = current === root ? undefined : path.posix.dirname(current)
  return {
    root,
    current,
    ...(parent && isWithin(root, parent) ? { parent } : {}),
    entries,
  } satisfies typeof RemoteBrowseResult.Type
})

export const remoteRuntimeHandlers = HttpApiBuilder.group(RemoteRuntimeApi, "remote-runtime", (handlers) =>
  Effect.gen(function* () {
    const browse = Effect.fn("RemoteRuntimeHttpApi.browse")(function* (ctx: { query: { path: string } }) {
      const instance = yield* InstanceRef
      if (!instance) return yield* new ServiceUnavailableError({ message: "instance context unavailable" })
      return yield* browseRemoteFolder({ root: instance.directory, current: ctx.query.path })
    })

    const prompt = Effect.fn("RemoteRuntimeHttpApi.prompt")(function* (ctx: { payload: RemoteAgentPrompt }) {
      const instance = yield* InstanceRef
      if (!instance) return yield* new ServiceUnavailableError({ message: "instance context unavailable" })
      return yield* runCodexPrompt({
        directory: instance.directory,
        prompt: ctx.payload.prompt,
        config: ctx.payload.config,
      })
    })

    return handlers.handle("browse", browse).handle("prompt", prompt)
  }),
)
