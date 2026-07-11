export * as PluginTool from "./tool"

import Ajv from "ajv"
import { DateTime, Effect, JsonSchema, Layer, Scope } from "effect"
import { Buffer } from "node:buffer"
import path from "node:path"
import { pathToFileURL } from "node:url"
import z from "zod"
import { Config } from "../config"
import { EventV2 } from "../event"
import { FSUtil } from "../fs-util"
import { Location } from "../location"
import { Npm } from "../npm"
import { PermissionV2 } from "../permission"
import { SessionEvent } from "../session/event"
import { Tool } from "../tool/tool"
import { Tools } from "../tool/tools"
import { PluginV2 } from "../plugin"

type Json = JsonSchema.JsonSchema

export type Attachment = {
  readonly type: "file"
  readonly mime: string
  readonly url: string
  readonly filename?: string
}

export type Result =
  | string
  | {
      readonly title?: string
      readonly output: string
      readonly metadata?: Record<string, unknown>
      readonly attachments?: ReadonlyArray<Attachment>
    }

export type Context = {
  readonly sessionID: string
  readonly messageID: string
  readonly callID: string
  readonly agent: string
  readonly directory: string
  readonly worktree: string
  readonly abort: AbortSignal
  readonly metadata: (input: { readonly title?: string; readonly metadata?: Record<string, unknown> }) => void
  readonly ask: (input: {
    readonly permission: string
    readonly patterns: string[]
    readonly always: string[]
    readonly metadata: Record<string, unknown>
  }) => Promise<void>
}

type ZodField = z.ZodType

export type Definition = {
  readonly description: string
  readonly args?: Readonly<Record<string, ZodField | Json>>
  execute(args: Record<string, unknown>, context: Context): Promise<Result>
}

export const LoadError = Tool.RegistrationError
export type LoadError = Tool.RegistrationError

type Normalized = {
  readonly string: boolean
  readonly title?: string
  readonly output: string
  readonly metadata: Record<string, unknown>
  readonly attachments: ReadonlyArray<Tool.Content>
}

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const plugin = yield* PluginV2.Service
    const tools = yield* Tools.Service
    const permission = yield* PermissionV2.Service
    const location = yield* Location.Service
    const events = yield* EventV2.Service

    yield* PluginV2.attachTools(
      plugin,
      Effect.fn("PluginTool.register")(function* (id, definitions, slot) {
        const entries = yield* boundary(String(id), "read plugin tool map", () => Object.entries(definitions))
        const adapted = yield* Effect.forEach(entries, ([name, definition]) =>
          adapt({ name, definition, plugin, permission, location, events }).pipe(
            Effect.map((tool) => [name, tool] as const),
          ),
        )
        const registered = yield* boundary(String(id), "construct plugin tool map", () => Object.fromEntries(adapted))
        yield* tools
          .register(registered, { slot })
          .pipe(Effect.mapError((error) => new LoadError({ name: error.name, message: error.message })))
      }),
    )
  }),
)

export const discover = Effect.gen(function* () {
  const config = yield* Config.Service
  const fs = yield* FSUtil.Service
  const npm = yield* Npm.Service
  const plugin = yield* PluginV2.Service
  const events = yield* EventV2.Service

  const failed = (source: string, message: string, id?: PluginV2.ID) =>
    events.publish(PluginV2.Event.Failed, { id, source, message }).pipe(
      Effect.tap(() => Effect.logError("failed to load plugin tool", { source, message })),
      Effect.asVoid,
    )

  for (const directory of (yield* config.entries()).filter(
    (entry): entry is Config.Directory => entry.type === "directory",
  )) {
    const matches = (yield* fs
      .glob("{tool,tools}/*.{js,ts}", {
        cwd: directory.path,
        absolute: true,
        include: "file",
        dot: true,
        symlink: true,
      })
      .pipe(Effect.catch((error) => failed(directory.path, String(error)).pipe(Effect.as([] as string[]))))).toSorted()
    if (matches.length === 0) continue
    const installed = yield* npm.install(directory.path).pipe(
      Effect.as(true),
      Effect.catch((error) => failed(directory.path, String(error)).pipe(Effect.as(false))),
    )
    if (!installed) continue

    const found: Array<{
      readonly file: string
      readonly key: string
      readonly name: string
      readonly id: PluginV2.ID
      readonly definition: Definition
    }> = []
    for (const file of matches) {
      const loaded = yield* Effect.tryPromise({
        try: () => import(pathToFileURL(file).href),
        catch: (cause) => loadError(file, "import tool file", cause),
      }).pipe(
        Effect.tapError((error) => failed(file, error.message)),
        Effect.option,
      )
      if (loaded._tag === "None") continue
      const namespace = path.basename(file, path.extname(file))
      const entries = yield* boundary(file, "read tool file exports", () =>
        Object.entries(loaded.value).toSorted(([left], [right]) => left.localeCompare(right)),
      ).pipe(
        Effect.tapError((error) => failed(file, error.message)),
        Effect.option,
      )
      if (entries._tag === "None") continue
      for (const [key, value] of entries.value) {
        const inspected = yield* boundary(file, `inspect tool export ${key}`, () => ({
          candidate: candidate(value),
          definition: isDefinition(value) ? value : undefined,
        })).pipe(
          Effect.tapError((error) => failed(file, error.message)),
          Effect.option,
        )
        if (inspected._tag === "None" || !inspected.value.candidate) continue
        const id = PluginV2.ID.make(`tool:${file}#${key}`)
        if (!inspected.value.definition) {
          yield* failed(file, `Invalid plugin tool export: ${key}`, id)
          continue
        }
        found.push({
          file,
          key,
          name: key === "default" ? namespace : `${namespace}_${key}`,
          id,
          definition: inspected.value.definition,
        })
      }
    }
    const names = Map.groupBy(found, (item) => item.name)
    for (const item of found) {
      if (names.get(item.name)!.length > 1) {
        yield* failed(item.file, `Ambiguous plugin tool name in ${directory.path}: ${item.name}`, item.id)
        continue
      }
      yield* plugin
        .add({ id: item.id, effect: Effect.succeed({ tool: { [item.name]: item.definition } }) })
        .pipe(Effect.catch(() => Effect.void))
    }
  }
})

function adapt(input: {
  readonly name: string
  readonly definition: Definition
  readonly plugin: PluginV2.Interface
  readonly permission: PermissionV2.Interface
  readonly location: Location.Interface
  readonly events: EventV2.Interface
}) {
  return Effect.gen(function* () {
    yield* Tool.validateName(input.name).pipe(
      Effect.mapError((error) => new LoadError({ name: error.name, message: error.message })),
    )
    if (!isDefinition(input.definition))
      return yield* new LoadError({ name: input.name, message: `Invalid plugin tool definition: ${input.name}` })

    const entries = yield* boundary(input.name, "read plugin tool arguments", () =>
      Object.entries(input.definition.args ?? {}),
    )
    const zod = entries.every(([, value]) => isZod(value))
    const legacy = !zod && entries.every(([, value]) => isJson(value))
    if (!zod && !legacy)
      return yield* new LoadError({
        name: input.name,
        message: `Plugin tool arguments must use one schema format: ${input.name}`,
      })

    const object = zod
      ? yield* boundary(input.name, "construct Zod argument object", () =>
          z.object(Object.fromEntries(entries) as z.ZodRawShape),
        )
      : undefined
    const schema = object
      ? yield* boundary(input.name, "generate Zod JSON Schema", () => zodSchema(object))
      : yield* boundary(
          input.name,
          "construct legacy JSON Schema",
          () =>
            ({
              type: "object",
              properties: Object.fromEntries(entries),
              required: entries.map(([name]) => name),
            }) as Json,
        )
    const validator = legacy
      ? yield* Effect.try({
          try: () => new Ajv({ allErrors: true, strict: false }).compile(schema),
          catch: (cause) =>
            new LoadError({
              name: input.name,
              message: `Invalid JSON Schema for plugin tool ${input.name}: ${String(cause)}`,
            }),
        })
      : undefined
    const decode = (value: unknown) => {
      if (object)
        return Effect.promise(() => object.safeParseAsync(value)).pipe(
          Effect.flatMap((result) =>
            result.success
              ? Effect.succeed(result.data as Record<string, unknown>)
              : Effect.fail(new Tool.Failure({ message: `Invalid tool input: ${result.error.message}` })),
          ),
        )
      return validator?.(value)
        ? Effect.succeed(value as Record<string, unknown>)
        : Effect.fail(
            new Tool.Failure({
              message: `Invalid tool input: ${input.name}: ${validator?.errors?.[0]?.message ?? "invalid"}`,
            }),
          )
    }

    return yield* boundary(input.name, "construct canonical tool", () =>
      Tool.dynamic({
        description: input.definition.description,
        inputSchema: schema,
        decodeInput: decode,
        execute: (args, context) =>
          Effect.gen(function* () {
            const before = yield* input.plugin.trigger(
              "tool.execute.before",
              {
                tool: input.name,
                sessionID: context.sessionID,
                callID: context.toolCallID,
              },
              { args },
            )
            const decoded = yield* decode(before.args)
            const controller = new AbortController()
            let progress = Promise.resolve()
            const result = yield* wait(
              () =>
                input.definition
                  .execute(decoded, {
                    sessionID: context.sessionID,
                    messageID: context.assistantMessageID,
                    callID: context.toolCallID,
                    agent: context.agent,
                    directory: input.location.directory,
                    worktree: input.location.project.directory,
                    abort: controller.signal,
                    ask: (request) =>
                      Effect.runPromise(
                        input.permission
                          .assert({
                            action: request.permission,
                            resources: request.patterns,
                            save: request.always,
                            metadata: request.metadata,
                            sessionID: context.sessionID,
                            agent: context.agent,
                            rules: context.permissions,
                            source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
                          })
                          .pipe(
                            Effect.mapError(
                              () => new Tool.Failure({ message: `Permission denied: ${request.permission}` }),
                            ),
                          ),
                        { signal: controller.signal },
                      ),
                    metadata: (update) => {
                      progress = progress.then(() =>
                        Effect.runPromise(
                          input.events.publish(SessionEvent.Tool.Progress, {
                            timestamp: DateTime.nowUnsafe(),
                            sessionID: context.sessionID,
                            assistantMessageID: context.assistantMessageID,
                            callID: context.toolCallID,
                            structured: update.metadata ?? {},
                            content: update.title ? [{ type: "text", text: update.title }] : [],
                          }),
                        ).then(() => undefined),
                      )
                    },
                  })
                  .then(async (value) => {
                    await progress
                    return value
                  }),
              controller,
            )
            const normalized = yield* normalize(result)
            const after = yield* input.plugin.trigger(
              "tool.execute.after",
              { tool: input.name, sessionID: context.sessionID, callID: context.toolCallID, args: decoded },
              {
                title: normalized.title,
                output: normalized.output,
                metadata: normalized.metadata,
                attachments: resultString(result) ? undefined : result.attachments,
              },
            )
            const final = yield* normalize({
              title: after.title,
              output: after.output,
              metadata: after.metadata,
              attachments: after.attachments,
            })
            if (final.title)
              yield* input.events.publish(SessionEvent.Tool.Progress, {
                timestamp: DateTime.nowUnsafe(),
                sessionID: context.sessionID,
                assistantMessageID: context.assistantMessageID,
                callID: context.toolCallID,
                structured: final.metadata,
                content: [{ type: "text", text: final.title }],
              })
            return normalized.string &&
              final.title === undefined &&
              Object.keys(final.metadata).length === 0 &&
              final.attachments.length === 0
              ? { ...final, string: true }
              : final
          }),
        encodeOutput: (value) => Effect.succeed(value.string ? value.output : value.metadata),
        toModelOutput: ({ value }) => [{ type: "text", text: value.output }, ...value.attachments],
      }),
    )
  })
}

function boundary<A>(name: string, action: string, run: () => A): Effect.Effect<A, LoadError> {
  return Effect.try({
    try: run,
    catch: (cause) => loadError(name, action, cause),
  })
}

function loadError(name: string, action: string, cause: unknown) {
  return new LoadError({ name, message: `${action} failed for ${name}: ${String(cause)}` })
}

function wait<A>(run: () => Promise<A>, controller: AbortController): Effect.Effect<A, Tool.Failure> {
  return Effect.callback<A, Tool.Failure>((resume, _signal) => {
    let settled = false
    const promise = Promise.resolve().then(run)
    promise.then(
      (value) => {
        settled = true
        resume(Effect.succeed(value))
      },
      (cause) => {
        settled = true
        resume(cause instanceof Tool.Failure ? Effect.fail(cause) : Effect.die(cause))
      },
    )
    return Effect.uninterruptible(
      Effect.promise(async () => {
        controller.abort()
        if (!settled) await promise.catch(() => undefined)
      }),
    )
  })
}

function normalize(result: unknown): Effect.Effect<Normalized, Tool.Failure> {
  if (typeof result === "string") return Effect.succeed({ string: true, output: result, metadata: {}, attachments: [] })
  if (typeof result !== "object" || result === null || !("output" in result) || typeof result.output !== "string")
    return Effect.fail(new Tool.Failure({ message: "Plugin tool returned an invalid result" }))
  const value = result as {
    readonly title?: unknown
    readonly output: string
    readonly metadata?: unknown
    readonly attachments?: unknown
  }
  if (value.title !== undefined && typeof value.title !== "string")
    return Effect.fail(new Tool.Failure({ message: "Plugin tool returned an invalid title" }))
  if (value.metadata !== undefined && !record(value.metadata))
    return Effect.fail(new Tool.Failure({ message: "Plugin tool returned invalid metadata" }))
  if (value.attachments !== undefined && !Array.isArray(value.attachments))
    return Effect.fail(new Tool.Failure({ message: "Plugin tool returned invalid attachments" }))
  const title = typeof value.title === "string" ? value.title : undefined
  const metadata = value.metadata as Record<string, unknown> | undefined
  return Effect.forEach(value.attachments ?? [], attachment).pipe(
    Effect.map((attachments) => ({
      string: false,
      title,
      output: value.output,
      metadata: metadata ?? {},
      attachments,
    })),
  )
}

function attachment(value: unknown): Effect.Effect<Tool.Content, Tool.Failure> {
  if (!record(value) || value.type !== "file" || typeof value.mime !== "string" || typeof value.url !== "string")
    return Effect.fail(new Tool.Failure({ message: "Plugin tool returned an invalid attachment" }))
  if (value.filename !== undefined && typeof value.filename !== "string")
    return Effect.fail(new Tool.Failure({ message: "Plugin tool returned an invalid attachment filename" }))
  if (!/^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/.test(value.mime))
    return Effect.fail(new Tool.Failure({ message: "Plugin tool returned an invalid attachment MIME type" }))
  const match = value.url.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/)
  if (!match || match[1] !== value.mime || match[2]!.length % 4 !== 0)
    return Effect.fail(new Tool.Failure({ message: "Plugin tool returned a malformed attachment data URL" }))
  const data = Buffer.from(match[2]!, "base64").toString("base64")
  if (data !== match[2])
    return Effect.fail(new Tool.Failure({ message: "Plugin tool returned malformed attachment base64" }))
  return Effect.succeed({ type: "file", data, mime: value.mime, name: value.filename })
}

function resultString(value: Result): value is string {
  return typeof value === "string"
}

function isDefinition(value: unknown): value is Definition {
  return (
    record(value) &&
    typeof value.description === "string" &&
    (value.args === undefined || record(value.args)) &&
    typeof value.execute === "function"
  )
}

function candidate(value: unknown) {
  return record(value) && ("args" in value || "description" in value || "execute" in value)
}

function isZod(value: unknown): value is ZodField {
  return typeof value === "object" && value !== null && "_zod" in value
}

function isJson(value: unknown): value is Json {
  return typeof value === "boolean" || record(value)
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function zodSchema(schema: z.ZodType): Json {
  const result = z.toJSONSchema(schema, { io: "input" })
  if (!record(result)) throw new TypeError("Plugin tool Zod schema produced a non-object JSON Schema")
  return result as Json
}
