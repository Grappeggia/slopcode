export * as MCP from "./mcp"

import path from "node:path"
import Ajv, { type ValidateFunction } from "ajv"
import { isDeepStrictEqual } from "node:util"
import { Context, Deferred, Effect, Exit, Layer, Schema, Scope, Semaphore } from "effect"
import { Config } from "./config"
import { ConfigMCP } from "./config/mcp"
import { EventV2 } from "./event"
import { Location } from "./location"
import { MCPClient, type Connection, type Tool as MCPTool } from "./mcp/client"
import { PermissionV2 } from "./permission"
import { PluginV2 } from "./plugin"
import { Tool } from "./tool/tool"
import { Tools } from "./tool/tools"

const DEFAULT_TIMEOUT = 30_000
const MAX_PAGES = 1_000

const Connected = Schema.Struct({
  status: Schema.Literal("connected"),
  transport: Schema.Literals(["local", "remote", "sse"]),
})
const Failed = Schema.Struct({ status: Schema.Literal("failed"), error: Schema.String })
export const Status = Schema.Union([
  Schema.Struct({ status: Schema.Literal("connecting") }),
  Schema.Struct({ status: Schema.Literal("disabled") }),
  Schema.Struct({ status: Schema.Literal("disconnected") }),
  Connected,
  Failed,
])
export type Status = typeof Status.Type

export class DiscoveryError extends Schema.TaggedErrorClass<DiscoveryError>()("MCP.DiscoveryError", {
  server: Schema.String,
  message: Schema.String,
}) {}

export const Event = {
  StatusChanged: EventV2.define({
    type: "mcp.status.changed",
    schema: { server: Schema.String, status: Status },
  }),
  DiscoveryFailed: EventV2.define({
    type: "mcp.discovery.failed",
    schema: { server: Schema.String, message: Schema.String },
  }),
}

export interface Interface {
  readonly ready: () => Effect.Effect<void>
  readonly status: () => Effect.Effect<Readonly<Record<string, Status>>>
  readonly connect: (name?: string) => Effect.Effect<void>
  readonly disconnect: (name: string) => Effect.Effect<void>
  readonly reconnect: (name: string) => Effect.Effect<void>
  readonly refresh: (name: string) => Effect.Effect<void, DiscoveryError>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/MCP") {}

type Server = {
  readonly name: string
  readonly config: typeof ConfigMCP.Server.Type
  readonly timeout: number
  readonly slot: object
  readonly lock: ReturnType<typeof Semaphore.makeUnsafe>
  status: Status
  client?: Connection
  registration?: Scope.Closeable
  names: ReadonlySet<string>
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const location = yield* Location.Service
    const clients = yield* MCPClient.Service
    const tools = yield* Tools.Service
    const plugin = yield* PluginV2.Service
    const permission = yield* PermissionV2.Service
    const events = yield* EventV2.Service
    const scope = yield* Scope.Scope
    const ready = yield* Deferred.make<void>()
    const documents = (yield* config.entries()).filter((entry): entry is Config.Document => entry.type === "document")
    const timeout = documents.reduce((value, entry) => entry.info.mcp?.timeout ?? value, DEFAULT_TIMEOUT)
    const configured = new Map<string, typeof ConfigMCP.Server.Type>()
    documents.forEach((entry) =>
      Object.entries(entry.info.mcp?.servers ?? {}).forEach(([name, server]) => configured.set(name, server)),
    )
    const servers = new Map<string, Server>(
      [...configured].map(([name, server]) => [
        name,
        {
          name,
          config: server,
          timeout: server.timeout ?? timeout,
          slot: {},
          lock: Semaphore.makeUnsafe(1),
          status: server.disabled ? ({ status: "disabled" } as const) : ({ status: "disconnected" } as const),
          names: new Set(),
        },
      ]),
    )
    const registrations = Semaphore.makeUnsafe(1)

    // Empty lifetime anchors reserve config order even while a server is disabled,
    // disconnected, unavailable, or replacing its current discovered tools.
    yield* Effect.forEach(servers.values(), (server) => tools.register({}, { slot: server.slot }), {
      discard: true,
    }).pipe(Effect.orDie)

    const publish = (server: Server, status: Status) =>
      Effect.sync(() => {
        server.status = status
      }).pipe(Effect.andThen(events.publish(Event.StatusChanged, { server: server.name, status })), Effect.ignore)

    const failure = (server: Server, cause: unknown, discovery = false) => {
      const error = redact(message(cause), server.config)
      return publish(server, { status: "failed", error }).pipe(
        Effect.andThen(
          discovery
            ? events.publish(Event.DiscoveryFailed, { server: server.name, message: error }).pipe(Effect.ignore)
            : Effect.void,
        ),
        Effect.andThen(
          Effect.logWarning("MCP server unavailable", { server: server.name, type: server.config.type, error }),
        ),
      )
    }

    const discoveryFailure = (server: Server, cause: unknown) => {
      const error = redact(message(cause), server.config)
      return events
        .publish(Event.DiscoveryFailed, { server: server.name, message: error })
        .pipe(
          Effect.ignore,
          Effect.andThen(
            Effect.logWarning("MCP tool discovery failed", { server: server.name, type: server.config.type, error }),
          ),
        )
    }

    const hide = Effect.fnUntraced(function* (server: Server) {
      const registration = server.registration
      server.registration = undefined
      server.names = new Set()
      if (registration) yield* Scope.close(registration, Exit.void).pipe(Effect.ignore)
    })

    const close = Effect.fnUntraced(function* (server: Server) {
      yield* hide(server)
      const client = server.client
      server.client = undefined
      if (client) yield* Effect.promise(() => client.close()).pipe(Effect.ignore)
    })

    const install = Effect.fnUntraced(function* (server: Server, definitions: ReadonlyArray<MCPTool>) {
      const adapted = yield* adapt(server, definitions, plugin, permission)
      yield* registrations.withPermits(1)(
        Effect.gen(function* () {
          for (const name of Object.keys(adapted))
            if ([...servers.values()].some((current) => current !== server && current.names.has(name)))
              return yield* Effect.fail(new Error(`MCP tool name collision: ${name}`))
          const next = yield* Scope.fork(scope)
          yield* tools.register(adapted, { slot: server.slot }).pipe(
            Scope.provide(next),
            Effect.onError(() => Scope.close(next, Exit.void)),
          )
          const previous = server.registration
          server.registration = next
          server.names = new Set(Object.keys(adapted))
          if (previous) yield* Scope.close(previous, Exit.void).pipe(Effect.ignore)
        }),
      )
    })

    const refreshUnlocked = (server: Server) =>
      Effect.gen(function* () {
        const client = server.client
        if (!client)
          return yield* new DiscoveryError({
            server: server.name,
            message: `MCP server is not connected: ${server.name}`,
          })
        const definitions = yield* discover(client, server.timeout).pipe(
          Effect.mapError(
            (cause) => new DiscoveryError({ server: server.name, message: redact(message(cause), server.config) }),
          ),
        )
        yield* install(server, definitions).pipe(
          Effect.mapError(
            (cause) => new DiscoveryError({ server: server.name, message: redact(message(cause), server.config) }),
          ),
        )
      })

    const refresh = (server: Server) => server.lock.withPermits(1)(refreshUnlocked(server))

    const prepare = Effect.fnUntraced(function* (server: Server) {
      if (server.config.disabled) {
        yield* publish(server, { status: "disabled" })
        return undefined
      }
      yield* publish(server, { status: "connecting" })
      const client = yield* clients
        .connect({
          name: server.name,
          directory: location.directory,
          timeout: server.timeout,
          config: server.config,
        })
        .pipe(
          Effect.tapError((cause) => failure(server, cause)),
          Effect.option,
        )
      if (client._tag === "None") return undefined
      server.client = client.value
      client.value.closed(() => {
        if (server.client !== client.value) return
        server.client = undefined
        Effect.runFork(hide(server).pipe(Effect.andThen(failure(server, "Connection closed"))))
      })
      if (!hasTools(client.value.capabilities)) return [] as ReadonlyArray<MCPTool>
      const discovered = yield* Effect.exit(discover(client.value, server.timeout))
      if (Exit.isSuccess(discovered)) return discovered.value
      yield* close(server)
      yield* failure(server, discovered.cause, true)
      return undefined
    })

    const activate = Effect.fnUntraced(function* (server: Server, definitions: ReadonlyArray<MCPTool>) {
      const client = server.client
      if (!client) return
      if (hasTools(client.capabilities)) {
        const result = yield* Effect.exit(install(server, definitions))
        if (Exit.isFailure(result)) {
          yield* close(server)
          yield* failure(server, result.cause, true)
          return
        }
        client.changed(() =>
          Effect.runPromise(refresh(server).pipe(Effect.catch((cause) => discoveryFailure(server, cause)))),
        )
      }
      yield* publish(server, { status: "connected", transport: client.transport })
    })

    const open = Effect.fnUntraced(function* (server: Server) {
      const definitions = yield* prepare(server)
      if (definitions) yield* activate(server, definitions)
    })

    const connectOne = (server: Server) => server.lock.withPermits(1)(close(server).pipe(Effect.andThen(open(server))))

    const service = Service.of({
      ready: () => Deferred.await(ready),
      status: Effect.fn("MCP.status")(function* () {
        return Object.fromEntries([...servers].map(([name, server]) => [name, server.status]))
      }),
      connect: Effect.fn("MCP.connect")(function* (name?: string) {
        if (name !== undefined) {
          const server = servers.get(name)
          if (server) yield* connectOne(server)
          return
        }
        const ordered = [...servers.values()]
        yield* Effect.forEach(ordered, close, { concurrency: "unbounded", discard: true })
        const discovered = yield* Effect.forEach(ordered, prepare, { concurrency: "unbounded" })
        const owners = new Map<string, Set<Server>>()
        discovered.forEach((definitions, index) =>
          definitions?.forEach((definition) => {
            const tool = canonical(ordered[index]!.name, definition.name)
            owners.set(tool, new Set([...(owners.get(tool) ?? []), ordered[index]!]))
          }),
        )
        const collisions = new Map<Server, string>()
        owners.forEach((owners, tool) => {
          if (owners.size > 1) owners.forEach((server) => collisions.set(server, tool))
        })
        yield* Effect.forEach(
          ordered,
          (server, index) => {
            const collision = collisions.get(server)
            if (collision)
              return close(server).pipe(Effect.andThen(failure(server, `MCP tool name collision: ${collision}`, true)))
            const definitions = discovered[index]
            return definitions ? activate(server, definitions) : Effect.void
          },
          { discard: true },
        )
      }),
      disconnect: Effect.fn("MCP.disconnect")(function* (name: string) {
        const server = servers.get(name)
        if (!server) return
        yield* server.lock.withPermits(1)(
          close(server).pipe(Effect.andThen(publish(server, { status: "disconnected" }))),
        )
      }),
      reconnect: Effect.fn("MCP.reconnect")(function* (name: string) {
        const server = servers.get(name)
        if (server) yield* connectOne(server)
      }),
      refresh: Effect.fn("MCP.refresh")(function* (name: string) {
        const server = servers.get(name)
        if (!server) return yield* new DiscoveryError({ server: name, message: `Unknown MCP server: ${name}` })
        yield* refresh(server)
      }),
    })

    yield* Effect.addFinalizer(() =>
      Effect.forEach(servers.values(), close, { concurrency: "unbounded", discard: true }),
    )
    yield* service.connect().pipe(Effect.ensuring(Deferred.succeed(ready, undefined)), Effect.forkScoped)
    return service
  }),
)

function discover(client: Connection, timeout: number) {
  return Effect.tryPromise({
    try: async () => {
      const tools: MCPTool[] = []
      const cursors = new Set<string>()
      let cursor: string | undefined
      for (let index = 0; index < MAX_PAGES; index++) {
        const page = await client.list(cursor, timeout).catch((error) => {
          if (!outputSchemaError(error)) throw error
          return client.list(cursor, timeout, true)
        })
        tools.push(...page.tools)
        if (page.nextCursor === undefined) return tools
        if (cursors.has(page.nextCursor)) throw new Error(`MCP tools/list returned repeated cursor: ${page.nextCursor}`)
        cursors.add(page.nextCursor)
        cursor = page.nextCursor
      }
      throw new Error(`MCP tools/list exceeded ${MAX_PAGES} pages`)
    },
    catch: (cause) => cause,
  })
}

function adapt(
  server: Server,
  definitions: ReadonlyArray<MCPTool>,
  plugin: PluginV2.Interface,
  permission: PermissionV2.Interface,
) {
  return Effect.gen(function* () {
    const names = new Set<string>()
    const entries = yield* Effect.forEach(definitions, (definition) =>
      Effect.try({
        try: () => {
          const name = canonical(server.name, definition.name)
          if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) throw new Error(`Invalid canonical MCP tool name: ${name}`)
          if (names.has(name)) throw new Error(`MCP tool name collision: ${name}`)
          names.add(name)
          const validator = new Ajv({ allErrors: true, strict: false }).compile(definition.inputSchema)
          return [name, tool(name, definition, server, validator, plugin, permission)] as const
        },
        catch: (cause) => cause,
      }),
    )
    return Object.fromEntries(entries)
  })
}

function tool(
  name: string,
  definition: MCPTool,
  server: Server,
  validator: ValidateFunction,
  plugin: PluginV2.Interface,
  permission: PermissionV2.Interface,
) {
  const decode = (value: unknown) =>
    validator(value)
      ? Effect.succeed(value as Record<string, unknown>)
      : Effect.fail(
          new Tool.Failure({ message: `Invalid tool input: ${name}: ${validator.errors?.[0]?.message ?? "invalid"}` }),
        )
  return Tool.dynamic({
    description: definition.description ?? "",
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
    decodeInput: decode,
    execute: (args, context) =>
      Effect.gen(function* () {
        const before = yield* plugin.trigger(
          "tool.execute.before",
          { tool: name, sessionID: context.sessionID, callID: context.toolCallID },
          { args },
        )
        const decoded = yield* decode(before.args)
        yield* permission
          .assert({
            action: name,
            resources: ["*"],
            sessionID: context.sessionID,
            agent: context.agent,
            rules: context.permissions,
            source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
          })
          .pipe(Effect.mapError(() => new Tool.Failure({ message: `Permission denied: ${name}` })))
        const result = yield* Effect.tryPromise({
          try: (signal) =>
            server.client!.call(
              { name: definition.name, arguments: decoded },
              { signal, timeout: server.timeout, resetTimeoutOnProgress: true },
            ),
          catch: (cause) => new Tool.Failure({ message: `MCP tool failed: ${redact(message(cause), server.config)}` }),
        })
        const normalized = yield* normalize(result)
        const afterInput = hookOutput(normalized)
        const after = yield* plugin.trigger(
          "tool.execute.after",
          { tool: name, sessionID: context.sessionID, callID: context.toolCallID, args: decoded },
          afterInput,
        )
        const final = isDeepStrictEqual(afterOutput(after), afterInput) ? normalized : yield* normalizeHook(after)
        if (final.isError)
          return yield* new Tool.Failure({
            message:
              final.content
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("\n") || "MCP tool failed",
            metadata: final.metadata,
          })
        return final
      }),
    encodeOutput: (value) =>
      Effect.succeed({
        ...(value.structured === undefined ? {} : { structuredContent: value.structured }),
        ...(value.metadata === undefined ? {} : { metadata: value.metadata }),
        ...(value.isError === undefined ? {} : { isError: value.isError }),
      }),
    toModelOutput: ({ value }) => value.content,
  })
}

type Normalized = {
  readonly structured?: unknown
  readonly metadata?: Record<string, unknown>
  readonly isError?: boolean
  readonly content: ReadonlyArray<Tool.Content>
}

function normalize(value: unknown): Effect.Effect<Normalized, Tool.Failure> {
  if (!record(value) || !Array.isArray(value.content))
    return Effect.fail(new Tool.Failure({ message: "MCP tool returned an invalid result" }))
  const structured = value.structuredContent
  const metadata = value._meta
  const isError = value.isError
  if (structured !== undefined && !record(structured))
    return Effect.fail(new Tool.Failure({ message: "MCP tool returned invalid structuredContent" }))
  if (isError !== undefined && typeof isError !== "boolean")
    return Effect.fail(new Tool.Failure({ message: "MCP tool returned invalid isError" }))
  if (metadata !== undefined && !record(metadata))
    return Effect.fail(new Tool.Failure({ message: "MCP tool returned invalid metadata" }))
  return Effect.forEach(value.content, content).pipe(
    Effect.map((parts) => {
      const visible = parts.some((part) => part.type === "text")
        ? parts
        : structured === undefined
          ? parts
          : [{ type: "text" as const, text: stable(structured) }, ...parts]
      return {
        structured,
        metadata: metadata as Record<string, unknown> | undefined,
        isError: isError as boolean | undefined,
        content: visible,
      }
    }),
  )
}

function content(value: unknown): Effect.Effect<Tool.Content, Tool.Failure> {
  if (!record(value) || typeof value.type !== "string") return invalid("content")
  if (value.type === "text" && typeof value.text === "string") return Effect.succeed({ type: "text", text: value.text })
  if (value.type === "image") return file(value.data, value.mimeType, undefined, "image")
  if (value.type !== "resource" || !record(value.resource)) return invalid("content")
  const resource = value.resource
  if (typeof resource.uri !== "string") return invalid("resource URI")
  if (typeof resource.text === "string" && resource.blob === undefined)
    return Effect.succeed({ type: "text", text: resource.text })
  if (typeof resource.blob === "string" && resource.text === undefined)
    return file(resource.blob, resource.mimeType, path.basename(resource.uri), "resource")
  return invalid("resource")
}

function file(
  data: unknown,
  mime: unknown,
  name: string | undefined,
  label: string,
): Effect.Effect<Tool.Content, Tool.Failure> {
  if (typeof data !== "string" || typeof mime !== "string" || !/^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/.test(mime))
    return invalid(`${label} file`)
  if (
    data.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(data) ||
    Buffer.from(data, "base64").toString("base64") !== data
  )
    return invalid(`${label} base64`)
  return Effect.succeed({ type: "file", data, mime, name })
}

function hookOutput(value: Normalized): PluginV2.HookOutput<"tool.execute.after"> {
  return {
    output: value.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n"),
    metadata: {
      ...(value.structured === undefined ? {} : { structuredContent: value.structured }),
      ...(value.metadata === undefined ? {} : { metadata: value.metadata }),
      ...(value.isError === undefined ? {} : { isError: value.isError }),
    },
    attachments: value.content
      .filter((part): part is Extract<Tool.Content, { type: "file" }> => part.type === "file")
      .map((part) => ({
        type: "file" as const,
        mime: part.mime,
        url: `data:${part.mime};base64,${part.data}`,
        filename: part.name,
      })),
  }
}

function afterOutput(value: PluginV2.HookOutput<"tool.execute.after">) {
  return { output: value.output, metadata: value.metadata, attachments: value.attachments }
}

function normalizeHook(value: PluginV2.HookOutput<"tool.execute.after">): Effect.Effect<Normalized, Tool.Failure> {
  if (typeof value.output !== "string" || (value.metadata !== undefined && !record(value.metadata)))
    return invalid("hook output")
  return Effect.forEach(value.attachments ?? [], (attachment) => {
    if (!record(attachment) || attachment.type !== "file" || typeof attachment.url !== "string")
      return invalid("hook attachment")
    const match = attachment.url.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/)
    if (!match || match[1] !== attachment.mime) return invalid("hook attachment")
    return file(
      match[2],
      attachment.mime,
      typeof attachment.filename === "string" ? attachment.filename : undefined,
      "hook",
    )
  }).pipe(
    Effect.map((files) => ({
      structured: value.metadata,
      content: [...(value.output ? [{ type: "text" as const, text: value.output }] : []), ...files],
    })),
  )
}

function invalid(label: string): Effect.Effect<never, Tool.Failure> {
  return Effect.fail(new Tool.Failure({ message: `MCP tool returned invalid ${label}` }))
}

function hasTools(capabilities: Readonly<Record<string, unknown>>) {
  return record(capabilities.tools)
}

function sanitize(value: string) {
  const clean = value.replace(/[^A-Za-z0-9_-]/g, "_")
  return /^[A-Za-z]/.test(clean) ? clean : `mcp_${clean}`
}

function canonical(server: string, tool: string) {
  return `${sanitize(server)}_${sanitize(tool)}`
}

function outputSchemaError(value: unknown) {
  return (
    value instanceof Error &&
    /can't resolve reference|resolves to more than one schema|outputSchema|schema.*reference|reference.*schema/i.test(
      value.message,
    )
  )
}

function redact(value: string, config: typeof ConfigMCP.Server.Type) {
  const secrets =
    config.type === "remote" ? Object.values(config.headers ?? {}) : Object.values(config.environment ?? {})
  return secrets.filter(Boolean).reduce((text, secret) => text.replaceAll(secret, "[REDACTED]"), value)
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (record(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`
  return JSON.stringify(value) ?? String(value)
}

function message(value: unknown) {
  if (value instanceof Error) return value.message
  if (typeof value === "object" && value !== null && "message" in value) return String(value.message)
  return String(value)
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
