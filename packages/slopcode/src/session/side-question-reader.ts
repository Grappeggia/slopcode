import { FSUtil } from "@slopcode-ai/core/fs-util"
import { PermissionV1 } from "@slopcode-ai/core/v1/permission"
import { waitForAbort } from "@slopcode-ai/core/process"
import { Effect, Semaphore } from "effect"
import { jsonSchema, tool, type Tool, type ToolExecutionOptions } from "ai"
import path from "path"
import { EffectBridge } from "@/effect/bridge"
import { InstanceState } from "@/effect/instance-state"
import { Permission } from "@/permission"

export const MAX_FILES = 5
export const MAX_CALLS = 12
export const MAX_BYTES = 128 * 1024
export const MAX_LINES = 4_000
export const MAX_READ_LINES = 1_000
export const MAX_FILE_BYTES = 2 * 1024 * 1024
const MAX_LINE_BYTES = 8 * 1024

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
}

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

export const make = Effect.fn("SideQuestionReader.make")(function* (input: {
  ruleset: PermissionV1.Ruleset
  reference: (name: string) => Effect.Effect<string | undefined, unknown>
}) {
  const fs = yield* FSUtil.Service
  const permission = yield* Permission.Service
  const instance = yield* InstanceState.context
  const bridge = yield* EffectBridge.make()
  const lock = Semaphore.makeUnsafe(1)
  const files = new Set<string>()
  const usage = { calls: 0, lines: 0, bytes: 0 }
  const workspace = instance.worktree === "/" ? instance.directory : instance.worktree
  const root = yield* fs.realPath(workspace).pipe(Effect.mapError(() => new Error("Cannot resolve workspace root")))

  const run = Effect.fn("SideQuestionReader.read")(function* (
    params: Input,
    options: ToolExecutionOptions,
  ): Effect.fn.Return<Result, Error, never> {
    if (typeof params.path !== "string" || !params.path.trim()) return yield* Effect.fail(new Error("path is required"))
    if (path.isAbsolute(params.path)) return yield* Effect.fail(new Error("Read paths must be workspace-relative"))
    const offset = positive(params.offset, 1, "offset")
    const limit = positive(params.limit, MAX_READ_LINES, "limit")
    if (limit > MAX_READ_LINES) return yield* Effect.fail(new Error(`Read limit cannot exceed ${MAX_READ_LINES} lines`))

    const effect = lock.withPermits(1)(
      Effect.gen(function* () {
        if (usage.calls >= MAX_CALLS)
          return yield* Effect.fail(new Error(`Side read call limit reached (${MAX_CALLS})`))
        usage.calls += 1

        const name = params.reference?.trim()
        const selected = name
          ? yield* input
              .reference(name)
              .pipe(Effect.mapError((cause) => (cause instanceof Error ? cause : new Error(String(cause)))))
          : root
        if (name && !selected) return yield* Effect.fail(new Error(`Unknown project reference: ${name}`))
        if (!selected) return yield* Effect.fail(new Error("Cannot resolve read root"))
        const base = yield* fs
          .realPath(selected)
          .pipe(Effect.mapError(() => new Error(`Cannot resolve read root: ${name}`)))
        const requested = path.resolve(base, params.path)
        if (!FSUtil.contains(base, requested))
          return yield* Effect.fail(new Error("Read path escapes its configured root"))
        const canonical = yield* fs
          .realPath(requested)
          .pipe(Effect.mapError(() => new Error(`File not found: ${params.path}`)))
        if (!FSUtil.contains(base, canonical))
          return yield* Effect.fail(new Error("Read path escapes its configured root"))

        const stat = yield* fs
          .stat(canonical)
          .pipe(Effect.mapError(() => new Error(`Cannot stat file: ${params.path}`)))
        if (stat.type !== "File") return yield* Effect.fail(new Error("Side reads only support regular files"))
        if (Number(stat.size) > MAX_FILE_BYTES)
          return yield* Effect.fail(new Error(`Side reads reject files larger than ${MAX_FILE_BYTES} bytes`))

        const resource = name
          ? `${name}:${path.relative(base, canonical).replaceAll("\\", "/")}`
          : path.relative(root, canonical).replaceAll("\\", "/")
        if ((yield* permission.query({ permission: "read", pattern: resource, ruleset: input.ruleset })) !== "allow")
          return yield* Effect.fail(new Error(`Read is not allowed for resource: ${resource}`))

        if (!FSUtil.contains(root, canonical)) {
          const pattern = FSUtil.normalizePathPattern(path.join(path.dirname(canonical), "*"))
          if (
            (yield* permission.query({
              permission: "external_directory",
              pattern,
              ruleset: input.ruleset,
            })) !== "allow"
          )
            return yield* Effect.fail(new Error(`External read is not allowed for resource: ${resource}`))
        }

        if (!files.has(canonical)) {
          if (files.size >= MAX_FILES)
            return yield* Effect.fail(new Error(`Side questions can read at most ${MAX_FILES} unique files`))
          files.add(canonical)
        }
        if (usage.lines >= MAX_LINES)
          return yield* Effect.fail(new Error(`Side read line limit reached (${MAX_LINES})`))
        if (usage.bytes >= MAX_BYTES)
          return yield* Effect.fail(new Error(`Side read byte limit reached (${MAX_BYTES})`))

        const mime = FSUtil.mimeType(canonical)
        if (mime.startsWith("image/") || mime.startsWith("audio/") || mime.startsWith("video/") || media.has(mime))
          return yield* Effect.fail(new Error(`Side reads reject media files: ${resource}`))
        const bytes = yield* fs
          .readFile(canonical)
          .pipe(Effect.mapError(() => new Error(`Cannot read file: ${resource}`)))
        const text = yield* Effect.try({
          try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
          catch: () => new Error(`Side reads reject binary files: ${resource}`),
        })
        if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))
          return yield* Effect.fail(new Error(`Side reads reject binary files: ${resource}`))

        const all = text.split(/\r?\n/)
        if (offset > all.length) return yield* Effect.fail(new Error(`Offset ${offset} is outside ${resource}`))
        const available = Math.min(limit, MAX_LINES - usage.lines)
        const lines: string[] = []
        let size = 0
        for (const line of all.slice(offset - 1, offset - 1 + available)) {
          const remaining = Math.min(MAX_LINE_BYTES, MAX_BYTES - usage.bytes - size)
          if (remaining <= 0) break
          const value = take(line, remaining)
          if (!value && line) break
          lines.push(value)
          size += Buffer.byteLength(value)
        }
        if (lines.length === 0) return yield* Effect.fail(new Error(`Side read byte limit reached (${MAX_BYTES})`))
        usage.lines += lines.length
        usage.bytes += size
        const info: Read = {
          callID: options.toolCallId,
          path: path.relative(base, canonical).replaceAll("\\", "/"),
          ...(name ? { reference: name } : {}),
          offset,
          limit: lines.length,
          lines: lines.length,
          bytes: size,
          files: files.size,
        }
        return {
          title: resource,
          output: [
            `<path>${resource}</path>`,
            "<type>file</type>",
            "<content>",
            lines.map((line, index) => `${offset + index}: ${line}`).join("\n"),
            "</content>",
          ].join("\n"),
          metadata: { sideRead: info },
        }
      }),
    )
    if (!options.abortSignal) return yield* effect
    return yield* effect.pipe(Effect.raceFirst(waitForAbort(options.abortSignal)))
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
  } satisfies Reader
})

export * as SideQuestionReader from "./side-question-reader"
