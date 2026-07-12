export * as MCP from "./mcp"

import path from "node:path"
import Ajv, { type ValidateFunction } from "ajv"
import { isDeepStrictEqual } from "node:util"
import { Context, DateTime, Deferred, Effect, Exit, Layer, Schema, Scope, Semaphore } from "effect"
import { Config } from "./config"
import { ConfigMCP } from "./config/mcp"
import { EventV2 } from "./event"
import { Location } from "./location"
import {
  MCPClient,
  type Connection,
  type Prompt as MCPPrompt,
  type Resource as MCPResource,
  type Tool as MCPTool,
} from "./mcp/client"
import { MCPOAuth } from "./mcp/oauth"
import { MCPOAuthCallback } from "./mcp/oauth-callback"
import { MCPOAuthStore } from "./mcp/oauth-store"
import { Global } from "./global"
import { PermissionV2 } from "./permission"
import { PluginV2 } from "./plugin"
import { SessionEvent } from "./session/event"
import { SessionV2 } from "./session"
import { FileAttachment, Prompt } from "./session/prompt"
import { SessionInput } from "./session/input"
import { SessionMessage } from "./session/message"
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
export type AuthStatus = MCPOAuth.AuthStatus
export type BeginAuthResult = MCPOAuth.BeginResult
export type AttemptID = MCPOAuth.AttemptID

export class AuthNotFoundError extends Schema.TaggedErrorClass<AuthNotFoundError>()("MCP.AuthNotFoundError", {
  server: Schema.String,
}) {}

export class DiscoveryError extends Schema.TaggedErrorClass<DiscoveryError>()("MCP.DiscoveryError", {
  server: Schema.String,
  message: Schema.String,
}) {}

export class RequestError extends Schema.TaggedErrorClass<RequestError>()("MCP.RequestError", {
  server: Schema.String,
  item: Schema.String,
  operation: Schema.Literals(["prompts/get", "resources/read"]),
  message: Schema.String,
}) {}

export class ContentError extends Schema.TaggedErrorClass<ContentError>()("MCP.ContentError", {
  server: Schema.String,
  item: Schema.String,
  message: Schema.String,
}) {}

export interface PromptEntry extends MCPPrompt {
  readonly name: string
  readonly rawName: string
  readonly server: string
}

export interface ResourceEntry extends MCPResource {
  readonly name: string
  readonly rawName: string
  readonly server: string
}

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
  readonly reload: () => Effect.Effect<void>
  readonly prompts: () => Effect.Effect<ReadonlyArray<PromptEntry>>
  readonly resources: () => Effect.Effect<ReadonlyArray<ResourceEntry>>
  readonly getPrompt: (input: {
    readonly name: string
    readonly arguments?: Readonly<Record<string, string>>
  }) => Effect.Effect<Prompt, RequestError | ContentError>
  readonly readResource: (name: string) => Effect.Effect<Prompt, RequestError | ContentError>
  readonly authStatus: (name: string) => Effect.Effect<AuthStatus, AuthNotFoundError | MCPOAuth.AuthError>
  readonly beginAuth: (input: {
    readonly name: string
    readonly mode?: "auto" | "manual"
  }) => Effect.Effect<BeginAuthResult, AuthNotFoundError | MCPOAuth.AuthError>
  readonly completeAuth: (input: {
    readonly attemptID: AttemptID
    readonly code: string
    readonly state: string
  }) => Effect.Effect<AuthStatus, AuthNotFoundError | MCPOAuth.AuthError>
  readonly cancelAuth: (attemptID: AttemptID) => Effect.Effect<void, MCPOAuth.AuthError>
  readonly removeAuth: (name: string) => Effect.Effect<void, AuthNotFoundError | MCPOAuth.AuthError>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/MCP") {}

type Server = {
  readonly name: string
  config: typeof ConfigMCP.Server.Type
  timeout: number
  readonly slot: object
  readonly lock: ReturnType<typeof Semaphore.makeUnsafe>
  status: Status
  pending?: Connection
  client?: Connection
  registration?: Scope.Closeable
  names: ReadonlySet<string>
  definitions: ReadonlyArray<MCPTool>
  prompts: ReadonlyArray<PromptEntry>
  resources: ReadonlyArray<ResourceEntry>
}

type Prepared = {
  readonly client: Connection
  readonly definitions: ReadonlyArray<MCPTool>
  readonly prompts: ReadonlyArray<PromptEntry>
  readonly resources: ReadonlyArray<ResourceEntry>
  readonly errors: ReadonlyArray<unknown>
  readonly config: typeof ConfigMCP.Server.Type
  readonly timeout: number
  readonly closed: () => boolean
}

const baseLayer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const location = yield* Location.Service
    const clients = yield* MCPClient.Service
    const tools = yield* Tools.Service
    const plugin = yield* PluginV2.Service
    const permission = yield* PermissionV2.Service
    const events = yield* EventV2.Service
    const oauth = yield* MCPOAuth.Service
    const oauthStore = yield* MCPOAuthStore.Service
    const scope = yield* Scope.Scope
    const ready = yield* Deferred.make<void>()
    const effective = Effect.fnUntraced(function* () {
      const documents = (yield* config.entries()).filter((entry): entry is Config.Document => entry.type === "document")
      const timeout = documents.reduce((value, entry) => entry.info.mcp?.timeout ?? value, DEFAULT_TIMEOUT)
      const servers = new Map<string, typeof ConfigMCP.Server.Type>()
      documents.forEach((entry) =>
        Object.entries(entry.info.mcp?.servers ?? {}).forEach(([name, server]) => servers.set(name, server)),
      )
      return { timeout, servers }
    })
    const initial = yield* effective()
    const configured = initial.servers
    const servers = new Map<string, Server>(
      [...configured].map(([name, server]) => [
        name,
        {
          name,
          config: server,
          timeout: server.timeout ?? initial.timeout,
          slot: {},
          lock: Semaphore.makeUnsafe(1),
          status: server.disabled ? ({ status: "disabled" } as const) : ({ status: "disconnected" } as const),
          names: new Set(),
          definitions: [],
          prompts: [],
          resources: [],
        },
      ]),
    )
    const registrations = Semaphore.makeUnsafe(1)
    const operations = Semaphore.makeUnsafe(1)
    const authTarget = (server: Server) => {
      if (server.config.type !== "remote" || server.config.oauth === false) return
      return {
        directory: location.directory,
        workspaceID: location.workspaceID,
        name: server.name,
        endpoint: MCPOAuthStore.normalizeEndpoint(server.config.url),
      }
    }

    // Empty lifetime anchors reserve config order even while a server is disabled,
    // disconnected, unavailable, or replacing its current discovered tools.
    const anchor = (server: Server) =>
      tools.register({}, { slot: server.slot }).pipe(Scope.provide(scope), Effect.orDie)
    yield* Effect.forEach(servers.values(), anchor, { discard: true })

    const publish = (server: Server, status: Status) =>
      Effect.sync(() => {
        server.status = status
      }).pipe(Effect.andThen(events.publish(Event.StatusChanged, { server: server.name, status })), Effect.ignore)

    const failure = (
      server: Server,
      cause: unknown,
      discovery = false,
      candidate: typeof ConfigMCP.Server.Type = server.config,
    ) => {
      const error = redact(redact(message(cause), candidate), server.config)
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

    const discoveryFailure = (
      server: Server,
      cause: unknown,
      candidate: typeof ConfigMCP.Server.Type = server.config,
    ) => {
      const error = redact(redact(message(cause), candidate), server.config)
      return events
        .publish(Event.DiscoveryFailed, { server: server.name, message: error })
        .pipe(
          Effect.ignore,
          Effect.andThen(
            Effect.logWarning("MCP discovery failed", { server: server.name, type: server.config.type, error }),
          ),
        )
    }

    const hide = Effect.fnUntraced(function* (server: Server) {
      const registration = server.registration
      server.registration = undefined
      server.names = new Set()
      server.definitions = []
      server.prompts = []
      server.resources = []
      if (registration) yield* Scope.close(registration, Exit.void).pipe(Effect.ignore)
    })

    const close = (server: Server): Effect.Effect<void> =>
      Effect.uninterruptible(
        Effect.gen(function* () {
          yield* hide(server)
          const pending = server.pending
          const client = server.client
          server.pending = undefined
          server.client = undefined
          if (pending && pending !== client) yield* Effect.promise(() => pending.close()).pipe(Effect.ignore)
          if (client) yield* Effect.promise(() => client.close()).pipe(Effect.ignore)
        }),
      )

    const install = Effect.fnUntraced(function* (
      server: Server,
      client: Connection,
      definitions: ReadonlyArray<MCPTool>,
      valid: () => boolean = () => true,
    ) {
      const adapted = yield* adapt(server, client, definitions, plugin, permission, events)
      if (!valid()) return yield* Effect.fail(new Error("MCP replacement closed before tool registration"))
      return yield* registrations.withPermits(1)(
        Effect.gen(function* () {
          for (const name of Object.keys(adapted))
            if ([...servers.values()].some((current) => current !== server && current.names.has(name)))
              return yield* Effect.fail(new Error(`MCP tool name collision: ${name}`))
          const next = yield* Scope.fork(scope)
          let visible = false
          yield* tools.register(adapted, { slot: server.slot, visible: () => visible }).pipe(
            Scope.provide(next),
            Effect.onError(() => Scope.close(next, Exit.void)),
          )
          if (!valid()) {
            yield* Scope.close(next, Exit.void).pipe(Effect.ignore)
            return yield* Effect.fail(new Error("MCP replacement closed during tool registration"))
          }
          return {
            scope: next,
            publish: () => {
              const previous = server.registration
              visible = true
              server.registration = next
              server.names = new Set(Object.keys(adapted))
              return previous
            },
          }
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
        const discovered = yield* discoverAll(server, client).pipe(
          Effect.mapError(
            (cause) => new DiscoveryError({ server: server.name, message: redact(message(cause), server.config) }),
          ),
        )
        yield* validateCatalogs(
          [...servers.values()].map((current) =>
            current === server
              ? { server, prompts: discovered.prompts, resources: discovered.resources }
              : { server: current, prompts: current.prompts, resources: current.resources },
          ),
        ).pipe(
          Effect.mapError(
            (cause) => new DiscoveryError({ server: server.name, message: redact(message(cause), server.config) }),
          ),
        )
        const staged = yield* install(server, client, discovered.definitions).pipe(
          Effect.mapError(
            (cause) => new DiscoveryError({ server: server.name, message: redact(message(cause), server.config) }),
          ),
        )
        const previous = staged.publish()
        server.definitions = discovered.definitions
        server.prompts = discovered.prompts
        server.resources = discovered.resources
        if (previous) yield* Scope.close(previous, Exit.void).pipe(Effect.ignore)
      })

    const refresh = (server: Server) => operations.withPermits(1)(server.lock.withPermits(1)(refreshUnlocked(server)))

    const refreshContent = (server: Server, client: Connection, kind: "prompts" | "resources") =>
      operations.withPermits(1)(
        server.lock.withPermits(1)(
          Effect.gen(function* () {
            if (server.client !== client) return
            const items =
              kind === "prompts" ? yield* discoverPrompts(server, client) : yield* discoverResources(server, client)
            if (server.client !== client) return
            yield* validateCatalogs(
              [...servers.values()].map((current) => ({
                server: current,
                prompts:
                  current === server && kind === "prompts" ? (items as ReadonlyArray<PromptEntry>) : current.prompts,
                resources:
                  current === server && kind === "resources"
                    ? (items as ReadonlyArray<ResourceEntry>)
                    : current.resources,
              })),
            )
            if (server.client !== client) return
            if (kind === "prompts") server.prompts = items as ReadonlyArray<PromptEntry>
            if (kind === "resources") server.resources = items as ReadonlyArray<ResourceEntry>
          }).pipe(
            Effect.mapError(
              (cause) => new DiscoveryError({ server: server.name, message: redact(message(cause), server.config) }),
            ),
          ),
        ),
      )

    const disconnected = (server: Server, client: Connection) =>
      operations.withPermits(1)(
        server.lock.withPermits(1)(
          Effect.gen(function* () {
            if (server.pending !== client && server.client !== client) return
            yield* close(server)
            yield* failure(server, "Connection closed")
          }),
        ),
      )

    const prepare = Effect.fnUntraced(function* (
      server: Server,
      target: { readonly config: typeof ConfigMCP.Server.Type; readonly timeout: number } = {
        config: server.config,
        timeout: server.timeout,
      },
    ) {
      if (target.config.disabled) {
        yield* publish(server, { status: "disabled" })
        return undefined
      }
      yield* publish(server, { status: "connecting" })
      const client = yield* clients
        .connect({
          name: server.name,
          directory: location.directory,
          workspaceID: location.workspaceID,
          timeout: target.timeout,
          config: target.config,
        })
        .pipe(
          Effect.tapError((cause) =>
            server.client
              ? discoveryFailure(server, cause, target.config)
              : failure(server, cause, false, target.config),
          ),
          Effect.option,
        )
      if (client._tag === "None") {
        if (server.client) yield* publish(server, { status: "connected", transport: server.client.transport })
        return undefined
      }
      let closed = false
      client.value.closed(() => {
        closed = true
        Effect.runFork(disconnected(server, client.value))
      })
      server.pending = client.value
      const discovered = yield* Effect.exit(discoverInitial(server, client.value, target.timeout))
      if (Exit.isSuccess(discovered)) {
        if (!closed) {
          yield* Effect.forEach(discovered.value.errors, (cause) => discoveryFailure(server, cause, target.config), {
            discard: true,
          })
          return { client: client.value, ...discovered.value, ...target, closed: () => closed }
        }
        yield* close(server)
        yield* failure(server, "Connection closed")
        return undefined
      }
      server.pending = undefined
      yield* Effect.promise(() => client.value.close()).pipe(Effect.ignore)
      if (server.client) {
        yield* discoveryFailure(server, discovered.cause, target.config)
        yield* publish(server, { status: "connected", transport: server.client.transport })
      }
      if (!server.client) yield* failure(server, discovered.cause, true)
      return undefined
    })

    const activate = Effect.fnUntraced(function* (server: Server, prepared: Prepared) {
      const client = prepared.client
      const previous = server.client
      if (server.pending !== client || prepared.closed()) {
        yield* Effect.promise(() => client.close()).pipe(Effect.ignore)
        server.pending = undefined
        if (previous) yield* publish(server, { status: "connected", transport: previous.transport })
        if (!previous) yield* failure(server, "Connection closed")
        return
      }
      const result = yield* Effect.exit(
        install(server, client, prepared.definitions, () => server.pending === client && !prepared.closed()),
      )
      if (Exit.isFailure(result)) {
        yield* Effect.promise(() => client.close()).pipe(Effect.ignore)
        server.pending = undefined
        if (previous) yield* publish(server, { status: "connected", transport: previous.transport })
        if (!previous) yield* failure(server, result.cause, true)
        return
      }
      if (prepared.closed()) {
        if (Exit.isSuccess(result)) yield* Scope.close(result.value.scope, Exit.void).pipe(Effect.ignore)
        yield* Effect.promise(() => client.close()).pipe(Effect.ignore)
        server.pending = undefined
        if (previous) yield* publish(server, { status: "connected", transport: previous.transport })
        if (!previous) yield* failure(server, "Connection closed")
        return
      }
      // Publish the owning client and all content snapshots without yielding so
      // readers can never observe entries backed by an unavailable client.
      const registration = result.value.publish()
      server.client = client
      server.pending = undefined
      server.config = prepared.config
      server.timeout = prepared.timeout
      server.definitions = prepared.definitions
      server.prompts = prepared.prompts
      server.resources = prepared.resources
      if (registration) yield* Scope.close(registration, Exit.void).pipe(Effect.ignore)
      if (previous && previous !== client) yield* Effect.promise(() => previous.close()).pipe(Effect.ignore)
      if (hasTools(client.capabilities))
        client.changed(() =>
          Effect.runPromise(refresh(server).pipe(Effect.catch((cause) => discoveryFailure(server, cause)))),
        )
      if (hasPrompts(client.capabilities))
        client.promptsChanged(() =>
          Effect.runPromise(
            refreshContent(server, client, "prompts").pipe(Effect.catch((cause) => discoveryFailure(server, cause))),
          ),
        )
      if (hasResources(client.capabilities))
        client.resourcesChanged(() =>
          Effect.runPromise(
            refreshContent(server, client, "resources").pipe(Effect.catch((cause) => discoveryFailure(server, cause))),
          ),
        )
      yield* publish(server, { status: "connected", transport: client.transport })
    })

    const open = Effect.fnUntraced(function* (server: Server) {
      const prepared = yield* prepare(server)
      if (prepared) yield* activate(server, prepared)
    })

    const connectOne = (server: Server) => server.lock.withPermits(1)(close(server).pipe(Effect.andThen(open(server))))

    const activateBatch = Effect.fnUntraced(function* (
      ordered: ReadonlyArray<Server>,
      discovered: ReadonlyArray<Prepared | undefined>,
      unchanged: ReadonlyArray<Server> = [],
    ) {
      const owners = new Map<string, Set<Server>>()
      discovered.forEach((prepared, index) =>
        prepared?.definitions.forEach((definition) => {
          const name = canonical(ordered[index]!.name, definition.name)
          owners.set(name, new Set([...(owners.get(name) ?? []), ordered[index]!]))
        }),
      )
      const collisions = new Map<Server, string>()
      owners.forEach((candidates, name) => {
        if (candidates.size > 1 || unchanged.some((server) => server.names.has(name)))
          candidates.forEach((server) => collisions.set(server, name))
      })
      const catalogs = [
        ...unchanged.map((server) => ({ server, prompts: server.prompts, resources: server.resources })),
        ...ordered.flatMap((server, index) => {
          const prepared = discovered[index]
          return prepared ? [{ server, prompts: prepared.prompts, resources: prepared.resources }] : []
        }),
      ]
      const promptCatalog = yield* Effect.exit(validateCatalog(catalogs, "prompts"))
      const resourceCatalog = yield* Effect.exit(validateCatalog(catalogs, "resources"))
      if (Exit.isFailure(promptCatalog))
        yield* Effect.forEach(ordered, (server) => discoveryFailure(server, promptCatalog.cause), { discard: true })
      if (Exit.isFailure(resourceCatalog))
        yield* Effect.forEach(ordered, (server) => discoveryFailure(server, resourceCatalog.cause), { discard: true })
      yield* Effect.forEach(
        ordered,
        (server, index) =>
          server.lock.withPermits(1)(
            Effect.gen(function* () {
              const collision = collisions.get(server)
              const found = discovered[index]
              const catalogCollision = Exit.isFailure(promptCatalog) || Exit.isFailure(resourceCatalog)
              if (found && server.client && (catalogCollision || found.errors.length > 0)) {
                yield* Effect.promise(() => found.client.close()).pipe(Effect.ignore)
                server.pending = undefined
                yield* publish(server, { status: "connected", transport: server.client.transport })
                return
              }
              const prepared = found
                ? {
                    ...found,
                    prompts: Exit.isSuccess(promptCatalog) ? found.prompts : server.prompts,
                    resources: Exit.isSuccess(resourceCatalog) ? found.resources : server.resources,
                  }
                : undefined
              if (collision) {
                yield* Effect.promise(() => found?.client.close() ?? Promise.resolve()).pipe(Effect.ignore)
                server.pending = undefined
                if (server.client) {
                  yield* publish(server, { status: "connected", transport: server.client.transport })
                  return
                }
                yield* failure(
                  server,
                  collision.startsWith("MCP ") ? collision : `MCP tool name collision: ${collision}`,
                  true,
                )
                return
              }
              if (prepared) yield* activate(server, prepared)
            }),
          ),
        { discard: true },
      )
    })

    const connectAll = Effect.fnUntraced(function* () {
      const ordered = [...servers.values()]
      const discovered = yield* Effect.forEach(
        ordered,
        (server) => server.lock.withPermits(1)(close(server).pipe(Effect.andThen(prepare(server)))),
        { concurrency: "unbounded" },
      )
      yield* activateBatch(ordered, discovered)
    })

    const service = Service.of({
      ready: () => Deferred.await(ready),
      status: Effect.fn("MCP.status")(function* () {
        return Object.fromEntries([...servers].map(([name, server]) => [name, server.status]))
      }),
      prompts: Effect.fn("MCP.prompts")(function* () {
        return [...servers.values()].flatMap((server) => server.prompts)
      }),
      resources: Effect.fn("MCP.resources")(function* () {
        return [...servers.values()].flatMap((server) => server.resources)
      }),
      getPrompt: Effect.fn("MCP.getPrompt")(function* (input) {
        const found = [...servers.values()]
          .flatMap((server) => server.prompts.map((entry) => ({ server, entry })))
          .find(({ entry }) => entry.name === input.name)
        if (!found)
          return yield* new RequestError({
            server: owner(input.name),
            item: input.name,
            operation: "prompts/get",
            message: "MCP prompt is not available",
          })
        const result = yield* remote(found.server, found.entry.name, "prompts/get", (signal) =>
          found.server.client!.getPrompt(
            { name: found.entry.rawName, arguments: input.arguments },
            { signal, timeout: found.server.timeout },
          ),
        )
        return yield* normalizePrompt(found.server.name, found.entry.name, result)
      }),
      readResource: Effect.fn("MCP.readResource")(function* (name) {
        const found = [...servers.values()]
          .flatMap((server) => server.resources.map((entry) => ({ server, entry })))
          .find(({ entry }) => entry.name === name)
        if (!found)
          return yield* new RequestError({
            server: owner(name),
            item: name,
            operation: "resources/read",
            message: "MCP resource is not available",
          })
        const result = yield* remote(found.server, found.entry.name, "resources/read", (signal) =>
          found.server.client!.readResource({ uri: found.entry.uri }, { signal, timeout: found.server.timeout }),
        )
        return yield* normalizeResources(found.server.name, found.entry.name, result)
      }),
      authStatus: Effect.fn("MCP.authStatus")(function* (name: string) {
        const server = servers.get(name)
        if (!server) return yield* new AuthNotFoundError({ server: name })
        const target = authTarget(server)
        if (!target) return { status: "not-applicable" }
        if (server.client) return { status: "connected" }
        return yield* oauth.status(target)
      }),
      beginAuth: Effect.fn("MCP.beginAuth")(function* (input) {
        const server = servers.get(input.name)
        if (!server) return yield* new AuthNotFoundError({ server: input.name })
        const target = authTarget(server)
        if (!target || server.config.type !== "remote")
          return yield* new MCPOAuth.AuthError({
            code: "not-applicable",
            server: input.name,
            message: "MCP OAuth not-applicable",
          })
        if (server.client) return { status: "connected" }
        const result = yield* oauth.begin({
          target,
          config: typeof server.config.oauth === "object" ? server.config.oauth : {},
          mode: input.mode,
        })
        if (result.status === "connected") yield* operations.withPermits(1)(connectOne(server))
        return result
      }),
      completeAuth: Effect.fn("MCP.completeAuth")(function* (input) {
        const found = yield* oauthStore.findAttempt(input.attemptID).pipe(
          Effect.mapError(
            () =>
              new MCPOAuth.AuthError({
                code: "store",
                attemptID: input.attemptID,
                message: "MCP OAuth store",
              }),
          ),
        )
        if (!found)
          return yield* new MCPOAuth.AuthError({
            code: "attempt-invalid",
            attemptID: input.attemptID,
            message: "MCP OAuth attempt-invalid",
          })
        const server = servers.get(found.target.name)
        if (!server) return yield* new AuthNotFoundError({ server: found.target.name })
        const target = authTarget(server)
        if (!target || JSON.stringify(target) !== JSON.stringify(found.target) || server.config.type !== "remote")
          return yield* new MCPOAuth.AuthError({
            code: "attempt-invalid",
            attemptID: input.attemptID,
            message: "MCP OAuth attempt-invalid",
          })
        const result = yield* oauth.complete({
          ...input,
          target,
          config: typeof server.config.oauth === "object" ? server.config.oauth : {},
        })
        if (result.status === "connected") yield* operations.withPermits(1)(connectOne(server))
        return server.client ? ({ status: "connected" } as const) : result
      }),
      cancelAuth: Effect.fn("MCP.cancelAuth")((attemptID) => oauth.cancel(attemptID)),
      removeAuth: Effect.fn("MCP.removeAuth")(function* (name: string) {
        const server = servers.get(name)
        if (!server) return yield* new AuthNotFoundError({ server: name })
        const target = authTarget(server)
        if (!target)
          return yield* new MCPOAuth.AuthError({
            code: "not-applicable",
            server: name,
            message: "MCP OAuth not-applicable",
          })
        yield* operations.withPermits(1)(
          server.lock.withPermits(1)(close(server).pipe(Effect.andThen(publish(server, { status: "disconnected" })))),
        )
        yield* oauth.remove(target)
      }),
      connect: Effect.fn("MCP.connect")(function* (name?: string) {
        yield* operations.withPermits(1)(
          name === undefined ? connectAll() : servers.has(name) ? connectOne(servers.get(name)!) : Effect.void,
        )
      }),
      disconnect: Effect.fn("MCP.disconnect")(function* (name: string) {
        const server = servers.get(name)
        if (!server) return
        yield* operations.withPermits(1)(
          server.lock.withPermits(1)(close(server).pipe(Effect.andThen(publish(server, { status: "disconnected" })))),
        )
      }),
      reconnect: Effect.fn("MCP.reconnect")(function* (name: string) {
        const server = servers.get(name)
        if (server) yield* operations.withPermits(1)(connectOne(server))
      }),
      refresh: Effect.fn("MCP.refresh")(function* (name: string) {
        const server = servers.get(name)
        if (!server) return yield* new DiscoveryError({ server: name, message: `Unknown MCP server: ${name}` })
        yield* refresh(server).pipe(Effect.tapError((cause) => discoveryFailure(server, cause)))
      }),
      reload: Effect.fn("MCP.reload")(function* () {
        yield* operations.withPermits(1)(
          Effect.gen(function* () {
            const next = yield* effective()
            const changed: Array<{
              readonly server: Server
              readonly config: typeof ConfigMCP.Server.Type
              readonly timeout: number
            }> = []
            const removed = [...servers.values()].filter((server) => !next.servers.has(server.name))
            const replaced = [...next.servers].flatMap(([name, config]) => {
              const server = servers.get(name)
              if (
                !server ||
                (isDeepStrictEqual(server.config, config) && server.timeout === (config.timeout ?? next.timeout))
              )
                return []
              return [server]
            })
            yield* Effect.forEach(removed, (server) => server.lock.withPermits(1)(close(server)), {
              concurrency: "unbounded",
              discard: true,
            })
            removed.forEach((server) => servers.delete(server.name))
            for (const [name, config] of next.servers) {
              const existing = servers.get(name)
              if (
                existing &&
                isDeepStrictEqual(existing.config, config) &&
                existing.timeout === (config.timeout ?? next.timeout)
              )
                continue
              if (existing) {
                changed.push({ server: existing, config, timeout: config.timeout ?? next.timeout })
                continue
              }
              const server: Server = {
                name,
                config,
                timeout: config.timeout ?? next.timeout,
                slot: {},
                lock: Semaphore.makeUnsafe(1),
                status: config.disabled ? { status: "disabled" } : { status: "disconnected" },
                names: new Set(),
                definitions: [],
                prompts: [],
                resources: [],
              }
              servers.set(name, server)
              yield* anchor(server)
              changed.push({ server, config, timeout: config.timeout ?? next.timeout })
            }
            const disabled = changed.filter((target) => target.config.disabled)
            const cleanup = yield* Effect.forEach(
              disabled,
              (target) =>
                target.server.lock.withPermits(1)(
                  Effect.gen(function* () {
                    yield* hide(target.server)
                    const pending = target.server.pending
                    const client = target.server.client
                    target.server.pending = undefined
                    target.server.client = undefined
                    target.server.config = target.config
                    target.server.timeout = target.timeout
                    yield* publish(target.server, { status: "disabled" })
                    return [pending, client] as const
                  }),
                ),
              { concurrency: "unbounded" },
            )
            const result = yield* Effect.all(
              {
                discovered: Effect.forEach(
                  changed.filter((target) => !target.config.disabled),
                  (target) => target.server.lock.withPermits(1)(prepare(target.server, target)),
                  { concurrency: "unbounded" },
                ),
                cleanup: Effect.forEach(
                  cleanup,
                  ([pending, client]) =>
                    Effect.uninterruptible(
                      Effect.gen(function* () {
                        if (pending && pending !== client)
                          yield* Effect.promise(() => pending.close()).pipe(Effect.ignore)
                        if (client) yield* Effect.promise(() => client.close()).pipe(Effect.ignore)
                      }),
                    ),
                  { concurrency: "unbounded", discard: true },
                ),
              },
              { concurrency: "unbounded" },
            )
            const discovered = result.discovered
            const ordered = changed.filter((target) => !target.config.disabled).map((target) => target.server)
            yield* activateBatch(
              ordered,
              discovered,
              [...servers.values()].filter((server) => !ordered.includes(server)),
            )
          }),
        )
      }),
    })

    yield* Effect.addFinalizer(() =>
      operations.withPermits(1)(
        Effect.forEach(servers.values(), (server) => server.lock.withPermits(1)(close(server)), {
          concurrency: "unbounded",
          discard: true,
        }),
      ),
    )
    yield* service.connect().pipe(Effect.ensuring(Deferred.succeed(ready, undefined)), Effect.forkScoped)
    return service
  }),
)

const oauthLayer = MCPOAuth.layer.pipe(
  Layer.provide(MCPOAuthCallback.layer),
  Layer.provide(MCPOAuthStore.layer.pipe(Layer.provide(Global.defaultLayer))),
)

export const layer = baseLayer.pipe(
  Layer.provide(oauthLayer),
  Layer.provide(MCPOAuthStore.layer.pipe(Layer.provide(Global.defaultLayer))),
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

function discoverAll(server: Server, client: Connection) {
  const prompts = hasPrompts(client.capabilities) ? discoverPrompts(server, client) : Effect.succeed([])
  const resources = hasResources(client.capabilities) ? discoverResources(server, client) : Effect.succeed([])
  return Effect.all(
    {
      definitions: hasTools(client.capabilities) ? discover(client, server.timeout) : Effect.succeed([]),
      prompts,
      resources,
    },
    { concurrency: "unbounded" },
  )
}

function discoverInitial(server: Server, client: Connection, timeout: number) {
  const prompts = hasPrompts(client.capabilities)
    ? discoverPrompts(server, client, timeout).pipe(Effect.exit)
    : Effect.succeed(Exit.succeed([] as ReadonlyArray<PromptEntry>))
  const resources = hasResources(client.capabilities)
    ? discoverResources(server, client, timeout).pipe(Effect.exit)
    : Effect.succeed(Exit.succeed([] as ReadonlyArray<ResourceEntry>))
  return Effect.all(
    {
      definitions: hasTools(client.capabilities) ? discover(client, timeout) : Effect.succeed([]),
      prompts,
      resources,
    },
    { concurrency: "unbounded" },
  ).pipe(
    Effect.map((result) => ({
      definitions: result.definitions,
      prompts: Exit.isSuccess(result.prompts) ? result.prompts.value : [],
      resources: Exit.isSuccess(result.resources) ? result.resources.value : [],
      errors: [result.prompts, result.resources].flatMap((exit) => (Exit.isFailure(exit) ? [exit.cause] : [])),
    })),
  )
}

function discoverPrompts(server: Server, client: Connection, timeout = server.timeout) {
  return paginate(
    "prompts/list",
    (cursor, signal) => client.listPrompts(cursor, { signal, timeout }),
    (page) => page.prompts,
  ).pipe(Effect.flatMap((items) => catalog(server.name, items, "prompt")))
}

function discoverResources(server: Server, client: Connection, timeout = server.timeout) {
  return paginate(
    "resources/list",
    (cursor, signal) => client.listResources(cursor, { signal, timeout }),
    (page) => page.resources,
  ).pipe(Effect.flatMap((items) => catalog(server.name, items, "resource")))
}

function paginate<A, P extends { readonly nextCursor?: string }>(
  label: string,
  list: (cursor: string | undefined, signal: AbortSignal) => Promise<P>,
  items: (page: P) => ReadonlyArray<A>,
) {
  return interrupt<A[]>(async (signal) => {
    const result: A[] = []
    const cursors = new Set<string>()
    let cursor: string | undefined
    for (let index = 0; index < MAX_PAGES; index++) {
      const page = await list(cursor, signal)
      result.push(...items(page))
      if (page.nextCursor === undefined) return result
      if (cursors.has(page.nextCursor)) throw new Error(`MCP ${label} returned repeated cursor: ${page.nextCursor}`)
      cursors.add(page.nextCursor)
      cursor = page.nextCursor
    }
    throw new Error(`MCP ${label} exceeded ${MAX_PAGES} pages`)
  })
}

function catalog<T extends MCPPrompt | MCPResource>(
  server: string,
  items: ReadonlyArray<T>,
  kind: "prompt" | "resource",
) {
  return Effect.try({
    try: () => {
      const raw = new Set<string>()
      const names = new Set<string>()
      return items.map((item) => {
        if (raw.has(item.name)) throw new Error(`MCP ${kind} duplicate raw name on ${server}: ${item.name}`)
        raw.add(item.name)
        const name = contentCanonical(server, item.name)
        if (names.has(name)) throw new Error(`MCP ${kind} name collision: ${name}`)
        names.add(name)
        return { ...item, name, rawName: item.name, server }
      })
    },
    catch: (cause) => cause,
  })
}

function validateCatalogs(
  entries: ReadonlyArray<{
    readonly server: Server
    readonly prompts: ReadonlyArray<PromptEntry>
    readonly resources: ReadonlyArray<ResourceEntry>
  }>,
) {
  return Effect.all([validateCatalog(entries, "prompts"), validateCatalog(entries, "resources")], { discard: true })
}

function validateCatalog(
  entries: ReadonlyArray<{
    readonly server: Server
    readonly prompts: ReadonlyArray<PromptEntry>
    readonly resources: ReadonlyArray<ResourceEntry>
  }>,
  kind: "prompts" | "resources",
) {
  return Effect.try({
    try: () => {
      const names = new Map<string, string>()
      for (const entry of entries)
        for (const item of entry[kind]) {
          const previous = names.get(item.name)
          if (previous && previous !== entry.server.name)
            throw new Error(`MCP ${kind === "prompts" ? "prompt" : "resource"} name collision: ${item.name}`)
          names.set(item.name, entry.server.name)
        }
    },
    catch: (cause) => cause,
  })
}

function adapt(
  server: Server,
  client: Connection,
  definitions: ReadonlyArray<MCPTool>,
  plugin: PluginV2.Interface,
  permission: PermissionV2.Interface,
  events: EventV2.Interface,
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
          return [name, tool(name, definition, server, client, validator, plugin, permission, events)] as const
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
  client: Connection,
  validator: ValidateFunction,
  plugin: PluginV2.Interface,
  permission: PermissionV2.Interface,
  events: EventV2.Interface,
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
        const result = yield* invoke(
          (signal) =>
            client.call(
              { name: definition.name, arguments: decoded },
              { signal, timeout: server.timeout, resetTimeoutOnProgress: true },
            ),
          (cause) => new Tool.Failure({ message: `MCP tool failed: ${redact(message(cause), server.config)}` }),
        )
        const normalized = yield* normalize(result)
        const afterInput = hookOutput(normalized)
        const after = yield* plugin.trigger(
          "tool.execute.after",
          { tool: name, sessionID: context.sessionID, callID: context.toolCallID, args: decoded },
          afterInput,
        )
        const contentChanged =
          after.output !== afterInput.output || !isDeepStrictEqual(after.attachments, afterInput.attachments)
        const final =
          isDeepStrictEqual(afterOutput(after), afterInput) && !contentChanged
            ? normalized
            : yield* normalizeHook(after, normalized, contentChanged)
        if (after.title !== undefined && typeof after.title !== "string") return yield* invalid("hook title")
        if (after.title)
          yield* events.publish(SessionEvent.Tool.Progress, {
            timestamp: DateTime.nowUnsafe(),
            sessionID: context.sessionID,
            assistantMessageID: context.assistantMessageID,
            callID: context.toolCallID,
            structured: final.metadata ?? {},
            content: [{ type: "text", text: after.title }],
          })
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
        ...(value.metadata === undefined ? {} : { _meta: value.metadata }),
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
  if (value.type === "image") {
    if (typeof value.mimeType !== "string" || !value.mimeType.startsWith("image/")) return invalid("image MIME")
    return file(value.data, value.mimeType, undefined, "image")
  }
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
      ...(value.metadata === undefined ? {} : { _meta: value.metadata }),
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

function normalizeHook(
  value: PluginV2.HookOutput<"tool.execute.after">,
  original: Normalized,
  contentChanged: boolean,
): Effect.Effect<Normalized, Tool.Failure> {
  if (typeof value.output !== "string" || (value.metadata !== undefined && !record(value.metadata)))
    return invalid("hook output")
  const metadata = value.metadata
  const structured =
    metadata && Object.hasOwn(metadata, "structuredContent") ? metadata.structuredContent : original.structured
  const reserved = metadata && ["structuredContent", "_meta", "isError"].some((key) => Object.hasOwn(metadata, key))
  const extra = metadata
    ? Object.fromEntries(
        Object.entries(metadata).filter(([key]) => !["structuredContent", "_meta", "isError"].includes(key)),
      )
    : {}
  const base = metadata && Object.hasOwn(metadata, "_meta") ? metadata._meta : original.metadata
  const meta = !metadata
    ? original.metadata
    : !reserved
      ? metadata
      : Object.keys(extra).length === 0
        ? base
        : { ...(record(base) ? base : {}), ...extra }
  if (structured !== undefined && !record(structured)) return invalid("hook structuredContent")
  if (meta !== undefined && !record(meta)) return invalid("hook metadata")
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
      structured,
      metadata: meta as Record<string, unknown> | undefined,
      isError: original.isError,
      content: contentChanged
        ? [...(value.output ? [{ type: "text" as const, text: value.output }] : []), ...files]
        : original.content,
    })),
  )
}

function invalid(label: string): Effect.Effect<never, Tool.Failure> {
  return Effect.fail(new Tool.Failure({ message: `MCP tool returned invalid ${label}` }))
}

function invoke<A>(run: (signal: AbortSignal) => Promise<A>, failure: (cause: unknown) => Tool.Failure) {
  return Effect.callback<A, Tool.Failure>((resume) => {
    const controller = new AbortController()
    const promise = run(controller.signal)
    promise.then(
      (value) => resume(Effect.succeed(value)),
      (cause) => resume(Effect.fail(failure(cause))),
    )
    return Effect.uninterruptible(
      Effect.promise(async () => {
        controller.abort()
        await promise.catch(() => undefined)
      }),
    )
  })
}

function hasTools(capabilities: Readonly<Record<string, unknown>>) {
  return record(capabilities.tools)
}

function hasPrompts(capabilities: Readonly<Record<string, unknown>>) {
  return record(capabilities.prompts)
}

function hasResources(capabilities: Readonly<Record<string, unknown>>) {
  return record(capabilities.resources)
}

function sanitize(value: string) {
  const clean = value.replace(/[^A-Za-z0-9_-]/g, "_")
  return /^[A-Za-z]/.test(clean) ? clean : `mcp_${clean}`
}

function canonical(server: string, tool: string) {
  return `${sanitize(server)}_${sanitize(tool)}`
}

function contentCanonical(server: string, name: string) {
  return `${sanitize(server)}:${sanitize(name)}`
}

function owner(name: string) {
  return name.includes(":") ? name.slice(0, name.indexOf(":")) : "unknown"
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

function interrupt<A>(run: (signal: AbortSignal) => Promise<A>) {
  return Effect.callback<A, unknown>((resume) => {
    const controller = new AbortController()
    const promise = Promise.resolve().then(() => run(controller.signal))
    promise.then(
      (value) => resume(Effect.succeed(value)),
      (cause) => resume(Effect.fail(cause)),
    )
    return Effect.uninterruptible(
      Effect.promise(async () => {
        controller.abort()
        await promise.catch(() => undefined)
      }),
    )
  })
}

function remote<A>(
  server: Server,
  item: string,
  operation: RequestError["operation"],
  run: (signal: AbortSignal) => Promise<A>,
) {
  if (!server.client)
    return Effect.fail(
      new RequestError({ server: server.name, item, operation, message: "MCP server is not connected" }),
    )
  return interrupt(run).pipe(
    Effect.mapError(
      (cause) =>
        new RequestError({
          server: server.name,
          item,
          operation,
          message: redact(message(cause), server.config),
        }),
    ),
  )
}

const MIME = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/
const SCHEMES = new Set(["file:", "http:", "https:"])

function safe(server: string, item: string, label: string) {
  return new ContentError({ server, item, message: `MCP content returned invalid ${label}` })
}

function uri(server: string, item: string, value: unknown) {
  if (typeof value !== "string") return Effect.fail(safe(server, item, "resource URI"))
  return Effect.try({
    try: () => {
      const parsed = new URL(value)
      if (!SCHEMES.has(parsed.protocol)) throw new Error("unsupported")
      return parsed
    },
    catch: () => safe(server, item, "resource URI"),
  })
}

function mime(server: string, item: string, value: unknown, required = false) {
  if (value === undefined && !required) return Effect.succeed(undefined)
  return typeof value === "string" && MIME.test(value)
    ? Effect.succeed(value)
    : Effect.fail(safe(server, item, "MIME type"))
}

function base64(server: string, item: string, value: unknown) {
  if (
    typeof value !== "string" ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value) ||
    Buffer.from(value, "base64").toString("base64") !== value
  )
    return Effect.fail(safe(server, item, "base64"))
  return Effect.succeed(value)
}

function resourceContent(server: string, item: string, value: unknown) {
  return Effect.gen(function* () {
    if (!record(value)) return yield* safe(server, item, "resource content")
    const text = Object.hasOwn(value, "text")
    const blob = Object.hasOwn(value, "blob")
    if (text === blob) return yield* safe(server, item, "resource content")
    const allowed = new Set(["uri", "mimeType", "_meta", text ? "text" : "blob"])
    if (Object.keys(value).some((key) => !allowed.has(key))) return yield* safe(server, item, "resource content")
    const parsed = yield* uri(server, item, value.uri)
    const type = yield* mime(server, item, value.mimeType)
    if (text) {
      if (typeof value.text !== "string") return yield* safe(server, item, "resource text")
      return { text: value.text } as const
    }
    if (typeof value.blob !== "string") return yield* safe(server, item, "resource blob")
    const data = yield* base64(server, item, value.blob)
    if (!type) return yield* safe(server, item, "MIME type")
    return {
      file: new FileAttachment({
        uri: `data:${type};base64,${data}`,
        mime: type,
        name: path.basename(decodeURIComponent(parsed.pathname)) || parsed.hostname || undefined,
      }),
    } as const
  })
}

export function normalizeResources(server: string, item: string, value: unknown): Effect.Effect<Prompt, ContentError> {
  if (!record(value) || !Array.isArray(value.contents)) return Effect.fail(safe(server, item, "resource result"))
  return Effect.forEach(value.contents, (content) => resourceContent(server, item, content)).pipe(
    Effect.map(
      (parts) =>
        new Prompt({
          text: parts.flatMap((part) => ("text" in part ? [part.text] : [])).join("\n\n---\n"),
          files: parts.flatMap((part) => ("file" in part && part.file ? [part.file] : [])),
        }),
    ),
  )
}

export function normalizePrompt(server: string, item: string, value: unknown): Effect.Effect<Prompt, ContentError> {
  if (!record(value) || !Array.isArray(value.messages)) return Effect.fail(safe(server, item, "prompt result"))
  return Effect.forEach(value.messages, (message) =>
    Effect.gen(function* () {
      if (!record(message) || (message.role !== "user" && message.role !== "assistant") || !record(message.content))
        return yield* safe(server, item, "prompt message")
      const content = message.content
      if (content.type === "text") {
        if (!shape(content, ["type", "text", "annotations", "_meta"]) || typeof content.text !== "string")
          return yield* safe(server, item, "prompt text")
        return { role: message.role, text: content.text } as const
      }
      if (content.type === "resource") {
        if (!shape(content, ["type", "resource", "annotations", "_meta"]))
          return yield* safe(server, item, "prompt resource")
        const part = yield* resourceContent(server, item, content.resource)
        return { role: message.role, ...part } as const
      }
      if (content.type === "image") {
        if (!shape(content, ["type", "data", "mimeType", "annotations", "_meta"]))
          return yield* safe(server, item, "prompt image")
        const type = yield* mime(server, item, content.mimeType, true)
        if (!type?.startsWith("image/")) return yield* safe(server, item, "image MIME type")
        const data = yield* base64(server, item, content.data)
        return {
          role: message.role,
          file: new FileAttachment({ uri: `data:${type};base64,${data}`, mime: type }),
        } as const
      }
      return yield* safe(server, item, "prompt content")
    }),
  ).pipe(
    Effect.map(
      (parts) =>
        new Prompt({
          text: parts.map((part) => `[${part.role}]\n${"text" in part ? part.text : ""}`).join("\n\n---\n"),
          files: parts.flatMap((part) => ("file" in part && part.file ? [part.file] : [])),
        }),
    ),
  )
}

function shape(value: Record<string, unknown>, allowed: ReadonlyArray<string>) {
  return Object.keys(value).every((key) => allowed.includes(key))
}

export function resolveAndAdmit<E>(
  mcp: Interface,
  sessions: SessionV2.Interface,
  input: {
    readonly name: string
    readonly arguments?: Readonly<Record<string, string>>
    readonly sessionID: SessionV2.ID
    readonly id?: SessionMessage.ID
    readonly delivery?: SessionInput.Delivery
    readonly resume?: boolean
  },
  guard: Effect.Effect<void, E> = Effect.void,
) {
  return mcp.getPrompt({ name: input.name, arguments: input.arguments }).pipe(
    Effect.flatMap((prompt) =>
      sessions.prompt(
        {
          id: input.id,
          sessionID: input.sessionID,
          prompt,
          delivery: input.delivery,
          resume: input.resume,
        },
        guard,
      ),
    ),
  )
}
