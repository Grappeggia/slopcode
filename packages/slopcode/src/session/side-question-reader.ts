import { descriptorPath } from "@slopcode-ai/core/file-mutation-platform"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { waitForAbort } from "@slopcode-ai/core/process"
import { PermissionV1 } from "@slopcode-ai/core/v1/permission"
import { EffectBridge } from "@/effect/bridge"
import { InstanceState } from "@/effect/instance-state"
import { Permission } from "@/permission"
import { readResource } from "@/tool/read-resource"
import { jsonSchema, tool, type Tool, type ToolExecutionOptions } from "ai"
import { Context, Effect, Semaphore } from "effect"
import * as Scope from "effect/Scope"
import { constants } from "fs"
import fs, { type FileHandle } from "fs/promises"
import path from "path"

export const MAX_FILES = 5
export const MAX_CALLS = 12
export const MAX_BYTES = 128 * 1024
export const MAX_LINES = 4_000
export const MAX_READ_LINES = 1_000
export const MAX_FILE_BYTES = 2 * 1024 * 1024
const MAX_LINE_BYTES = 8 * 1024
const UNAVAILABLE = "Side read is unavailable"

export type Input = {
  path: string
  reference?: string
  offset?: number
  limit?: number
}

export type Read = {
  callID: string
  path: string
  reference?: string
  offset: number
  limit: number
  lines: number
  bytes: number
  files: number
}

export type Usage = {
  calls: number
  files: number
  lines: number
  bytes: number
}

export type Result = {
  title: string
  output: string
  metadata: { sideRead: Read }
}

export interface Reader {
  readonly tool: Tool<Input, Result>
  readonly tools: Record<string, Tool>
  readonly usage: () => Usage
  readonly consume: (callID: string, input: unknown, value: unknown) => Result | undefined
  readonly consumeError: (callID: string, input: unknown) => string | undefined
}

export interface HooksInterface {
  readonly beforeRead: (callID: string) => Effect.Effect<void>
  readonly pinned?: (input: { callID: string; fd: number; identity: string }) => Effect.Effect<void>
  readonly released?: (input: { callID: string; fd: number; identity: string }) => Effect.Effect<void>
}

export class ReaderHooks extends Context.Service<ReaderHooks, HooksInterface>()("@slopcode/SideQuestionReader/Hooks") {}

const media = new Set([
  "application/pdf",
  "application/zip",
  "application/gzip",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/x-tar",
])

function positive(value: number | undefined, fallback: number, name: string) {
  const result = value ?? fallback
  if (!Number.isSafeInteger(result) || result < 1) throw new Error(`${name} must be a positive integer`)
  return result
}

function take(text: string, limit: number) {
  if (Buffer.byteLength(text) <= limit) return text
  let low = 0
  let high = text.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (Buffer.byteLength(text.slice(0, middle)) <= limit) low = middle
    else high = middle - 1
  }
  return text.slice(0, low)
}

function error(value: unknown, fallback: string) {
  return value instanceof Error ? value : new Error(fallback)
}

function matches(left: Input, right: unknown) {
  if (!right || typeof right !== "object") return false
  const value = right as Record<string, unknown>
  return (
    left.path === value.path &&
    left.reference === value.reference &&
    left.offset === value.offset &&
    left.limit === value.limit &&
    Object.keys(value).every((key) => key === "path" || key === "reference" || key === "offset" || key === "limit")
  )
}

function serialized(input: Omit<Read, "bytes">, lines: string[], resource: string): Result {
  let size = 0
  while (true) {
    const result: Result = {
      title: resource,
      output: [
        `<path>${resource}</path>`,
        "<type>file</type>",
        "<content>",
        lines.map((line, index) => `${input.offset + index}: ${line}`).join("\n"),
        "</content>",
      ].join("\n"),
      metadata: { sideRead: { ...input, bytes: size } },
    }
    const next = Buffer.byteLength(JSON.stringify(result))
    if (next === size) return result
    size = next
  }
}

export const make = Effect.fn("SideQuestionReader.make")(function* (input: {
  sessionID?: PermissionV1.Request["sessionID"]
  ruleset: PermissionV1.Ruleset
  reference: (name: string) => Effect.Effect<string | undefined, unknown>
  hooks?: HooksInterface
}) {
  const filesystem = yield* FSUtil.Service
  const permission = yield* Permission.Service
  const instance = yield* InstanceState.context
  const scope = yield* Scope.Scope
  const bridge = yield* EffectBridge.make()
  const lock = Semaphore.makeUnsafe(1)
  const files = new Set<string>()
  const records = new Map<
    string,
    | { status: "running"; input: Input }
    | { status: "success"; input: Input; result: Result }
    | { status: "error"; input: Input; message: string }
  >()
  const usage = { calls: 0, lines: 0, bytes: 0 }
  const workspace = instance.worktree === "/" ? instance.directory : instance.worktree
  const root = yield* filesystem
    .realPath(workspace)
    .pipe(Effect.mapError(() => new Error("Cannot resolve workspace root")))

  const close = (handle: FileHandle) => Effect.promise(() => handle.close()).pipe(Effect.ignore)
  const secure = (canonical: string) =>
    Effect.gen(function* () {
      if (
        (process.platform !== "linux" && process.platform !== "darwin") ||
        !Number.isSafeInteger(constants.O_NOFOLLOW) ||
        constants.O_NOFOLLOW === 0 ||
        !Number.isSafeInteger(constants.O_DIRECTORY) ||
        constants.O_DIRECTORY === 0
      )
        return yield* Effect.fail(new Error(`Secure side reads are not supported on ${process.platform}`))

      const platform = process.platform
      const root = path.parse(canonical).root
      const flags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
      let directory = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () => fs.open(root, flags),
          catch: (cause) => error(cause, "Cannot open read root"),
        }),
        close,
      )
      const parts = canonical.slice(root.length).split(path.sep).filter(Boolean)
      for (const part of parts.slice(0, -1)) {
        directory = yield* Effect.acquireRelease(
          Effect.tryPromise({
            try: () => fs.open(descriptorPath(platform, directory.fd, part), flags),
            catch: (cause) => error(cause, `Cannot securely open ${canonical}`),
          }),
          close,
        )
      }
      const handle = yield* Effect.tryPromise({
        try: () =>
          fs.open(
            descriptorPath(platform, directory.fd, parts.at(-1) ?? ""),
            constants.O_RDONLY | constants.O_NOFOLLOW,
          ),
        catch: (cause) => error(cause, `Cannot securely open ${canonical}`),
      })
      const ownership = { pinned: false }
      yield* Effect.addFinalizer(() => (ownership.pinned ? Effect.void : close(handle)))
      const actual = yield* Effect.tryPromise({
        try: () => fs.realpath(descriptorPath(platform, handle.fd)),
        catch: (cause) => error(cause, `Cannot verify opened file ${canonical}`),
      })
      if (FSUtil.normalizePath(actual) !== FSUtil.normalizePath(canonical))
        return yield* Effect.fail(new Error(`Read target changed while opening: ${canonical}`))
      const stat = yield* Effect.tryPromise({
        try: () => handle.stat({ bigint: true }),
        catch: (cause) => error(cause, `Cannot inspect opened file ${canonical}`),
      })
      return { handle, ownership, stat }
    })

  const run = Effect.fn("SideQuestionReader.read")(function* (
    params: Input,
    options: ToolExecutionOptions,
  ): Effect.fn.Return<Result, Error, never> {
    let reserved = false
    const effect = lock.withPermits(1)(
      Effect.gen(function* () {
        if (usage.calls >= MAX_CALLS)
          return yield* Effect.fail(new Error(`Side read call limit reached (${MAX_CALLS})`))
        usage.calls += 1
        if (records.has(options.toolCallId))
          return yield* Effect.fail(new Error(`Duplicate side read call ID: ${options.toolCallId}`))
        const call = { ...params }
        records.set(options.toolCallId, { status: "running", input: call })
        reserved = true

        if (typeof params.path !== "string" || !params.path.trim())
          return yield* Effect.fail(new Error("path is required"))
        if (path.isAbsolute(params.path)) return yield* Effect.fail(new Error("Read paths must be workspace-relative"))
        const offset = yield* Effect.try({
          try: () => positive(params.offset, 1, "offset"),
          catch: (cause) => error(cause, "Invalid offset"),
        })
        const limit = yield* Effect.try({
          try: () => positive(params.limit, MAX_READ_LINES, "limit"),
          catch: (cause) => error(cause, "Invalid limit"),
        })
        if (limit > MAX_READ_LINES)
          return yield* Effect.fail(new Error(`Read limit cannot exceed ${MAX_READ_LINES} lines`))

        const name = params.reference?.trim()
        const selected = name
          ? yield* input.reference(name).pipe(Effect.mapError(() => new Error(UNAVAILABLE)))
          : workspace
        if (!selected) return yield* Effect.fail(new Error(UNAVAILABLE))
        const lexical = path.resolve(selected)
        const requested = path.resolve(lexical, params.path)
        if (!FSUtil.contains(lexical, requested))
          return yield* Effect.fail(new Error("Read path escapes its configured root"))
        const requestedResource = readResource(instance.worktree, requested)
        if (
          (yield* permission.query({
            permission: "read",
            pattern: requestedResource,
            ruleset: input.ruleset,
            sessionID: input.sessionID,
          })) !== "allow"
        )
          return yield* Effect.fail(new Error(UNAVAILABLE))
        const base = yield* filesystem.realPath(selected).pipe(Effect.mapError(() => new Error(UNAVAILABLE)))
        const canonical = yield* filesystem.realPath(requested).pipe(Effect.mapError(() => new Error(UNAVAILABLE)))
        if (!FSUtil.contains(base, canonical)) return yield* Effect.fail(new Error(UNAVAILABLE))

        const canonicalResource = readResource(instance.worktree, canonical)
        if (
          canonicalResource !== requestedResource &&
          (yield* permission.query({
            permission: "read",
            pattern: canonicalResource,
            ruleset: input.ruleset,
            sessionID: input.sessionID,
          })) !== "allow"
        )
          return yield* Effect.fail(new Error(UNAVAILABLE))

        const resource = name
          ? `${name}:${path.relative(base, canonical).replaceAll("\\", "/")}`
          : path.relative(root, canonical).replaceAll("\\", "/")
        if (!FSUtil.contains(root, canonical)) {
          const pattern = FSUtil.normalizePathPattern(path.join(path.dirname(canonical), "*"))
          if (
            (yield* permission.query({
              permission: "external_directory",
              pattern,
              ruleset: input.ruleset,
              sessionID: input.sessionID,
            })) !== "allow"
          )
            return yield* Effect.fail(new Error(UNAVAILABLE))
        }

        const mime = FSUtil.mimeType(canonical)
        if (mime.startsWith("image/") || mime.startsWith("audio/") || mime.startsWith("video/") || media.has(mime))
          return yield* Effect.fail(new Error(`Side reads reject media files: ${resource}`))

        return yield* Effect.scoped(
          Effect.gen(function* () {
            const opened = yield* secure(canonical)
            if (!opened.stat.isFile()) return yield* Effect.fail(new Error("Side reads only support regular files"))
            if (opened.stat.size > BigInt(MAX_FILE_BYTES))
              return yield* Effect.fail(new Error(`Side reads reject files larger than ${MAX_FILE_BYTES} bytes`))

            const identity = `${opened.stat.dev}:${opened.stat.ino}`
            if (!files.has(identity)) {
              if (files.size >= MAX_FILES)
                return yield* Effect.fail(new Error(`Side questions can read at most ${MAX_FILES} unique files`))
            }
            const descriptor = { callID: options.toolCallId, fd: opened.handle.fd, identity }
            // Transfer ownership atomically from the per-read scope to the request scope.
            yield* Effect.uninterruptible(
              Scope.addFinalizer(
                scope,
                Effect.gen(function* () {
                  yield* close(opened.handle)
                  yield* input.hooks?.released?.(descriptor) ?? Effect.void
                }),
              ).pipe(Effect.tap(() => Effect.sync(() => (opened.ownership.pinned = true)))),
            )
            files.add(identity)
            yield* input.hooks?.pinned?.(descriptor) ?? Effect.void
            if (usage.lines >= MAX_LINES)
              return yield* Effect.fail(new Error(`Side read line limit reached (${MAX_LINES})`))
            if (usage.bytes >= MAX_BYTES)
              return yield* Effect.fail(new Error(`Side read byte limit reached (${MAX_BYTES})`))

            yield* input.hooks?.beforeRead(options.toolCallId) ?? Effect.void
            const bytes = yield* Effect.tryPromise({
              try: async (signal) => {
                const chunks: Buffer[] = []
                for await (const chunk of opened.handle.createReadStream({
                  autoClose: false,
                  start: 0,
                  end: MAX_FILE_BYTES,
                  signal,
                }))
                  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
                return Buffer.concat(chunks)
              },
              catch: (cause) => error(cause, `Cannot read file: ${resource}`),
            })
            if (bytes.length > MAX_FILE_BYTES)
              return yield* Effect.fail(new Error(`Side reads reject files larger than ${MAX_FILE_BYTES} bytes`))
            const text = yield* Effect.try({
              try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
              catch: () => new Error(`Side reads reject binary files: ${resource}`),
            })
            if (
              [...text].some((char) => {
                const code = char.charCodeAt(0)
                return code < 9 || (code > 13 && code < 32)
              })
            )
              return yield* Effect.fail(new Error(`Side reads reject binary files: ${resource}`))

            const all = text.split(/\r?\n/)
            if (offset > all.length) return yield* Effect.fail(new Error(`Offset ${offset} is outside ${resource}`))
            const source = all.slice(offset - 1, offset - 1 + Math.min(limit, MAX_LINES - usage.lines))
            const lines: string[] = []
            const info = (count: number) => ({
              callID: options.toolCallId,
              path: path.relative(base, canonical).replaceAll("\\", "/"),
              ...(name ? { reference: name } : {}),
              offset,
              limit: count,
              lines: count,
              files: files.size,
            })
            const remaining = MAX_BYTES - usage.bytes
            for (const line of source) {
              const value = take(line, MAX_LINE_BYTES)
              const full = [...lines, value]
              if (serialized(info(full.length), full, resource).metadata.sideRead.bytes <= remaining) {
                lines.push(value)
                continue
              }
              let low = 0
              let high = value.length
              while (low < high) {
                const middle = Math.ceil((low + high) / 2)
                const partial = [...lines, value.slice(0, middle)]
                if (serialized(info(partial.length), partial, resource).metadata.sideRead.bytes <= remaining)
                  low = middle
                else high = middle - 1
              }
              const partial = [...lines, value.slice(0, low)]
              if (serialized(info(partial.length), partial, resource).metadata.sideRead.bytes <= remaining)
                lines.push(value.slice(0, low))
              break
            }
            if (lines.length === 0) return yield* Effect.fail(new Error(`Side read byte limit reached (${MAX_BYTES})`))
            const result = serialized(info(lines.length), lines, resource)
            usage.lines += lines.length
            usage.bytes += result.metadata.sideRead.bytes
            records.set(options.toolCallId, { status: "success", input: call, result })
            return result
          }),
        )
      }),
    )
    const tracked = effect.pipe(
      Effect.tapError((failure) =>
        Effect.sync(() => {
          if (reserved)
            records.set(options.toolCallId, { status: "error", input: { ...params }, message: failure.message })
        }),
      ),
    )
    if (!options.abortSignal) return yield* tracked
    return yield* tracked.pipe(Effect.raceFirst(waitForAbort(options.abortSignal)))
  })

  const read = tool<Input, Result>({
    description:
      "Read a regular UTF-8 text file from the workspace or a named configured reference. Paths must be relative. Use offset and limit for bounded chunks.",
    inputSchema: jsonSchema({
      type: "object",
      additionalProperties: false,
      required: ["path"],
      properties: {
        path: { type: "string", description: "Workspace- or reference-relative text file path" },
        reference: { type: "string", description: "Configured project reference name" },
        offset: { type: "integer", minimum: 1, description: "First line to return, one-based" },
        limit: { type: "integer", minimum: 1, maximum: MAX_READ_LINES, description: "Maximum lines to return" },
      },
    }),
    execute: (params, options) => bridge.promise(run(params, options)),
  })

  return {
    tool: read,
    tools: { read },
    usage: () => ({ ...usage, files: files.size }),
    consume: (callID, input, value) => {
      const record = records.get(callID)
      records.delete(callID)
      return record?.status === "success" && matches(record.input, input) && record.result === value
        ? record.result
        : undefined
    },
    consumeError: (callID, input) => {
      const record = records.get(callID)
      records.delete(callID)
      return record?.status === "error" && matches(record.input, input) ? record.message : undefined
    },
  } satisfies Reader
})

export * as SideQuestionReader from "./side-question-reader"
