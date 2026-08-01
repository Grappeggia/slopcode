import { Config as EffectConfig, Context, Effect, Layer, Scope } from "effect"
import { HttpApiBuilder, OpenApi } from "effect/unstable/httpapi"
import { HttpClient, HttpMiddleware, HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http"
import * as Socket from "effect/unstable/socket/Socket"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import * as Observability from "@slopcode-ai/core/observability"
import { Account } from "@/account/account"
import { Agent } from "@/agent/agent"
import { Auth } from "@/auth"
import { BackgroundJob } from "@/background/job"
import { Command } from "@/command"
import { Config } from "@/config/config"
import { Workspace } from "@/control-plane/workspace"
import { Env } from "@/env"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Format } from "@/format"
import { Git } from "@/git"
import { Installation } from "@/installation"
import { LSP } from "@/lsp/lsp"
import { Memory } from "@/memory/memory"
import { MCP } from "@/mcp"
import { McpAuth } from "@/mcp/auth"
import { Permission } from "@/permission"
import { Plugin } from "@/plugin"
import { InstanceStore } from "@/project/instance-store"
import { Project } from "@/project/project"
import { Vcs } from "@/project/vcs"
import { ProviderAuth } from "@/provider/auth"
import { Provider } from "@/provider/provider"
import { Question } from "@/question"
import { SessionCompaction } from "@/session/compaction"
import { Instruction } from "@/session/instruction"
import { LLM } from "@/session/llm"
import { SessionProcessor } from "@/session/processor"
import { SessionPrompt } from "@/session/prompt"
import { SessionAutocomplete } from "@/session/autocomplete"
import { SessionControl, sessionGraphNode, sessionNode } from "@/session/control"
import { SessionRevert } from "@/session/revert"
import { SessionRunState } from "@/session/run-state"
import { SessionSideQuestion } from "@/session/side-question"
import { Session } from "@/session/session"
import { SessionStatus } from "@/session/status"
import { SessionSummary } from "@/session/summary"
import { Todo } from "@/session/todo"
import { SessionShare } from "@/share/session"
import { ShareNext } from "@/share/share-next"
import { Skill } from "@/skill"
import { Discovery } from "@/skill/discovery"
import { Snapshot } from "@/snapshot"
import { Storage } from "@/storage/storage"
import { ToolRegistry } from "@/tool/registry"
import { Truncate } from "@/tool/truncate"
import { Worktree } from "@/worktree"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { MoveSession } from "@slopcode-ai/core/control-plane/move-session"
import { Database } from "@slopcode-ai/core/database/database"
import { LayerNode } from "@slopcode-ai/core/effect/layer-node"
import { httpClient } from "@slopcode-ai/core/effect/layer-node-platform"
import { EventV2 } from "@slopcode-ai/core/event"
import { ModelsDev } from "@slopcode-ai/core/models-dev"
import { Npm } from "@slopcode-ai/core/npm"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { ProjectCopy } from "@slopcode-ai/core/project/copy"
import { LocationServiceMap, node as locationServiceMapNode, withPluginHost } from "@slopcode-ai/core/location-layer"
import { PluginPackage } from "@slopcode-ai/core/plugin/package"
import { PtyTicket } from "@slopcode-ai/core/pty/ticket"
import { Ripgrep } from "@slopcode-ai/core/ripgrep"
import { SessionProjector } from "@slopcode-ai/core/session/projector"
import { SessionRuntime } from "@slopcode-ai/core/session/runtime"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionControl as CoreSessionControl } from "@slopcode-ai/core/session/control"
import { lazy } from "@/util/lazy"
import { CorsConfig, isAllowedCorsOrigin, type CorsOptions } from "@/server/cors"
import { serveUIEffect } from "@/server/shared/ui"
import { ServerAuth } from "@/server/auth"
import { InstanceHttpApi, RootHttpApi } from "./api"
import { Api } from "@slopcode-ai/server/api"
import { PublicApi } from "./public"
import {
  authorizationLayer,
  authorizationRouterMiddleware,
  ptyConnectAuthorizationLayer,
  serverAuthorizationLayer,
} from "./middleware/authorization"
import { EventApi } from "./groups/event"
import { PtyConnectApi } from "./groups/pty"
import { eventHandlers } from "./handlers/event"
import { configHandlers } from "./handlers/config"
import { controlHandlers } from "./handlers/control"
import { controlPlaneHandlers } from "./handlers/control-plane"
import { experimentalHandlers } from "./handlers/experimental"
import { fileHandlers } from "./handlers/file"
import { globalHandlers } from "./handlers/global"
import { instanceHandlers } from "./handlers/instance"
import { memoryHandlers } from "./handlers/memory"
import { mcpHandlers } from "./handlers/mcp"
import { permissionHandlers } from "./handlers/permission"
import { projectHandlers } from "./handlers/project"
import { projectCopyHandlers } from "./handlers/project-copy"
import { providerHandlers } from "./handlers/provider"
import { ptyConnectHandlers, ptyHandlers } from "./handlers/pty"
import { questionHandlers } from "./handlers/question"
import { sessionHandlers } from "./handlers/session"
import { syncHandlers } from "./handlers/sync"
import { tuiHandlers } from "./handlers/tui"
import { isolatedSessionServices, rawHandlers } from "@slopcode-ai/server/handlers"
import { SessionGraph } from "@slopcode-ai/server/session-graph"
import { schemaErrorLayer as v2SchemaErrorLayer } from "@slopcode-ai/server/middleware/schema-error"
import { workspaceHandlers } from "./handlers/workspace"
import { remoteRuntimeHandlers } from "./handlers/remote-runtime"
import { remoteSupervisorHandlers } from "./handlers/remote-supervisor"
import { defaultLayer as remotePairingLayer } from "./remote-pairing"
import { instanceContextLayer } from "./middleware/instance-context"
import { serverWorkspaceRoutingLayer } from "./middleware/server-workspace-routing"
import { workspaceRoutingLayer } from "./middleware/workspace-routing"
import { disposeMiddleware } from "./lifecycle"
import { memoMap } from "@slopcode-ai/core/effect/memo-map"
import { compressionLayer } from "./middleware/compression"
import { corsVaryFix } from "./middleware/cors-vary"
import { errorLayer } from "./middleware/error"
import { fenceLayer } from "./middleware/fence"
import { schemaErrorLayer } from "./middleware/schema-error"
import { AppProcess } from "@slopcode-ai/core/process"

export const context = Context.makeUnsafe<unknown>(new Map())

const cors = (corsOptions?: CorsOptions) =>
  HttpRouter.middleware(
    HttpMiddleware.cors({
      allowedOrigins: (origin) => isAllowedCorsOrigin(origin, corsOptions),
      maxAge: 86_400,
    }),
    { global: true },
  )

// Route tree:
// - rootApiRoutes: typed /global/* and control routes; auth is declared by RootHttpApi.
// - eventApiRoutes: typed SSE route with instance routing context and its existing API contract.
// - ptyConnectApiRoutes: typed WebSocket upgrade route with ticket-aware auth.
// - instanceApiRoutes: remaining typed instance routes.
// - uiRoute: raw catch-all fallback; auth is router middleware so public static assets can bypass it.
const authOnlyRouterLayer = authorizationRouterMiddleware.layer.pipe(Layer.provide(ServerAuth.Config.defaultLayer))
const httpApiAuthLayer = authorizationLayer.pipe(Layer.provide(ServerAuth.Config.defaultLayer))
const ptyConnectHttpApiAuthLayer = ptyConnectAuthorizationLayer.pipe(Layer.provide(ServerAuth.Config.defaultLayer))
const serverHttpApiAuthLayer = serverAuthorizationLayer.pipe(Layer.provide(ServerAuth.Config.defaultLayer))
const workspaceRoutingLive = workspaceRoutingLayer.pipe(
  Layer.provide(Socket.layerWebSocketConstructorGlobal),
  Layer.provide(remotePairingLayer),
)
const serverWorkspaceRoutingLive = serverWorkspaceRoutingLayer.pipe(
  Layer.provide(Socket.layerWebSocketConstructorGlobal),
  Layer.provide(remotePairingLayer),
)
const rootApiRoutes = HttpApiBuilder.layer(RootHttpApi).pipe(
  Layer.provide([controlHandlers, controlPlaneHandlers, globalHandlers, remoteSupervisorHandlers]),
  Layer.provide(schemaErrorLayer),
  Layer.provide(httpApiAuthLayer),
  Layer.provide(remotePairingLayer),
)
const eventApiRoutes = HttpApiBuilder.layer(EventApi).pipe(
  Layer.provide(eventHandlers),
  Layer.provide([httpApiAuthLayer, workspaceRoutingLive, instanceContextLayer]),
)
const ptyConnectApiRoutes = HttpApiBuilder.layer(PtyConnectApi).pipe(
  Layer.provide(ptyConnectHandlers),
  Layer.provide([ptyConnectHttpApiAuthLayer, workspaceRoutingLive, instanceContextLayer]),
)
const instanceApiRoutes = HttpApiBuilder.layer(InstanceHttpApi).pipe(
  Layer.provide([
    configHandlers,
    experimentalHandlers,
    fileHandlers,
    instanceHandlers,
    memoryHandlers,
    mcpHandlers,
    projectHandlers,
    projectCopyHandlers,
    ptyHandlers,
    questionHandlers,
    permissionHandlers,
    providerHandlers,
    sessionHandlers,
    syncHandlers,
    tuiHandlers,
    workspaceHandlers,
    remoteRuntimeHandlers,
  ]),
  Layer.provide(remotePairingLayer),
)

const instanceRoutes = instanceApiRoutes.pipe(
  Layer.provide([httpApiAuthLayer, workspaceRoutingLive, instanceContextLayer, schemaErrorLayer]),
)
const serverRoutes = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(handlers),
  Layer.provide([serverHttpApiAuthLayer, serverWorkspaceRoutingLive, v2SchemaErrorLayer]),
)

// `OpenApi.fromApi` is non-trivial; defer until /doc is actually hit so
// processes that never serve it (CLI, scripts) don't pay at module load.
// `HttpServerResponse.jsonUnsafe` runs JSON.stringify eagerly, so caching
// the response also caches the serialized body — every /doc request reuses
// the same Uint8Array instead of re-stringifying the spec.
const docResponse = lazy(() => HttpServerResponse.jsonUnsafe(OpenApi.fromApi(PublicApi)))

const docRoute = HttpRouter.use((router) => router.add("GET", "/doc", () => Effect.succeed(docResponse()))).pipe(
  Layer.provide(authOnlyRouterLayer),
)

const statusResponse = lazy(() => HttpServerResponse.jsonUnsafe({ healthy: true }))
const statusRoute = HttpRouter.use((router) => router.add("GET", "/status", () => Effect.succeed(statusResponse())))

const uiRoute = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const client = yield* HttpClient.HttpClient
    const flags = yield* RuntimeFlags.Service
    yield* router.add("*", "/*", (request) =>
      serveUIEffect(request, { fs, client, disableEmbeddedWebUi: flags.disableEmbeddedWebUi }),
    )
  }),
).pipe(Layer.provide(authOnlyRouterLayer))

type RouteRequirements =
  | HttpRouter.HttpRouter
  | HttpRouter.Request<"Error", unknown>
  | HttpRouter.Request<"GlobalError", unknown>
  | HttpRouter.Request<"Requires", unknown>
  | HttpRouter.Request<"GlobalRequires", never>

const app = LayerNode.group([
  Npm.node,
  FSUtil.node,
  Database.node,
  Auth.node,
  Account.node,
  Config.node,
  Env.node,
  Git.node,
  Ripgrep.node,
  Storage.node,
  Snapshot.node,
  Plugin.node,
  ModelsDev.node,
  Provider.node,
  ProviderAuth.node,
  Agent.node,
  Skill.node,
  Discovery.node,
  Question.node,
  Permission.node,
  Todo.node,
  Session.node,
  SessionProjector.node,
  SessionStatus.node,
  BackgroundJob.node,
  RuntimeFlags.node,
  EventV2Bridge.node,
  SessionRunState.node,
  SessionProcessor.node,
  SessionCompaction.node,
  SessionRevert.node,
  SessionSummary.node,
  SessionPrompt.node,
  SessionAutocomplete.node,
  SessionControl.node,
  SessionSideQuestion.node,
  Instruction.node,
  LLM.node,
  LSP.node,
  Memory.node,
  MCP.node,
  McpAuth.node,
  Command.node,
  Truncate.node,
  ToolRegistry.node,
  Format.node,
  Project.node,
  Vcs.node,
  Workspace.node,
  Worktree.node,
  Installation.node,
  ShareNext.node,
  SessionShare.node,
  InstanceStore.node,
  httpClient,
  EventV2.node,
  ProjectV2.node,
  ProjectCopy.node,
  PtyTicket.node,
  AppProcess.node,
])

type Method = (...args: readonly unknown[]) => Effect.Effect<unknown, unknown, unknown>

const lazyService = <A extends object>(load: Effect.Effect<A>) =>
  new Proxy(
    {},
    {
      get:
        (_, key) =>
        (...args: readonly unknown[]) =>
          Effect.flatMap(load, (service) => {
            const method = Reflect.get(service, key) as Method | undefined
            if (typeof method !== "function") return Effect.die(`Unknown lazy Session service method: ${String(key)}`)
            return Reflect.apply(method, service, args) as ReturnType<Method>
          }),
    },
  ) as A

export function createRoutes(
  corsOptions?: CorsOptions,
  host?: Layer.Layer<PluginPackage.Host>,
  observe?: (locations: Context.Service.Shape<typeof LocationServiceMap>) => void,
  sessionGraphInitialized?: () => void,
  replacements?: {
    provider?: Layer.Layer<Provider.Service>
  },
): Layer.Layer<never, EffectConfig.ConfigError, RouteRequirements> {
  const locations = host ? withPluginHost(host) : LocationServiceMap.layer
  const locationLayer = observe
    ? Layer.effect(
        LocationServiceMap,
        Effect.gen(function* () {
          const service = yield* LocationServiceMap
          yield* Effect.sync(() => observe(service))
          return service
        }),
      ).pipe(Layer.provide(locations))
    : locations
  const services = LayerNode.make(
    Layer.mergeAll(
      Database.defaultLayer,
      EventV2.defaultLayer,
      ProjectV2.defaultLayer,
      SessionRuntime.defaultLayer,
      locationLayer,
    ),
    [],
  )
  const database = LayerNode.make(Layer.effect(Database.Service, Database.Service), [services])
  const events = LayerNode.make(Layer.effect(EventV2.Service, EventV2.Service), [services])
  const projects = LayerNode.make(Layer.effect(ProjectV2.Service, ProjectV2.Service), [services])
  const runtime = LayerNode.make(Layer.effect(SessionRuntime.Service, SessionRuntime.Service), [services])
  const locationMap = LayerNode.make(Layer.effect(LocationServiceMap, LocationServiceMap), [services])
  const graph = Layer.effect(
    SessionGraph.Service,
    Effect.gen(function* () {
      const database = yield* Database.Service
      const events = yield* EventV2.Service
      const projects = yield* ProjectV2.Service
      const runtime = yield* SessionRuntime.Service
      const locations = yield* LocationServiceMap
      const scope = yield* Scope.Scope
      const dependencies = Layer.mergeAll(
        Layer.succeed(Database.Service, database),
        Layer.succeed(EventV2.Service, events),
        Layer.succeed(ProjectV2.Service, projects),
        Layer.succeed(SessionRuntime.Service, runtime),
        Layer.succeed(LocationServiceMap, locations),
      )
      const sessions = isolatedSessionServices.pipe(Layer.provide(dependencies))
      const actual = Layer.mergeAll(
        sessions,
        CoreSessionControl.layer.pipe(
          Layer.provide(sessions),
          Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        ),
      )
      const load = yield* Effect.cached(
        Effect.sync(() => sessionGraphInitialized?.()).pipe(
          Effect.andThen(Layer.buildWithScope(actual, scope).pipe(Effect.provide(Context.empty()))),
        ),
      )
      return SessionGraph.Service.of({
        session: lazyService(Effect.map(load, (context) => Context.get(context, SessionV2.Service))),
        control: lazyService(Effect.map(load, (context) => Context.get(context, CoreSessionControl.Service))),
        runtime,
      })
    }),
  )
  const graphNode = LayerNode.make(graph, [database, events, projects, runtime, locationMap])
  const lazySessionNode = LayerNode.make(
    Layer.effect(
      SessionV2.Service,
      SessionGraph.Service.use((graph) => Effect.succeed(graph.session)),
    ),
    [graphNode],
  )
  return Layer.mergeAll(
    rootApiRoutes,
    eventApiRoutes,
    ptyConnectApiRoutes,
    instanceRoutes,
    serverRoutes,
    docRoute,
    statusRoute,
    uiRoute,
  ).pipe(
    Layer.provide([
      errorLayer,
      compressionLayer,
      corsVaryFix,
      fenceLayer,
      cors(corsOptions),
      MoveSession.defaultLayer,
      HttpServer.layerServices,
    ]),
    Layer.provide(
      LayerNode.buildLayer(app, {
        replacements: [
          LayerNode.replaceWithNode(Database.node, database),
          LayerNode.replaceWithNode(EventV2.node, events),
          LayerNode.replaceWithNode(ProjectV2.node, projects),
          LayerNode.replaceWithNode(SessionRuntime.node, runtime),
          LayerNode.replaceWithNode(locationServiceMapNode, locationMap),
          LayerNode.replaceWithNode(sessionNode, lazySessionNode),
          LayerNode.replaceWithNode(sessionGraphNode, graphNode),
          ...(replacements?.provider ? [LayerNode.replace(Provider.node, replacements.provider)] : []),
        ],
      }),
    ),
    Layer.provide(locationLayer),
    Layer.provide(Layer.succeed(CorsConfig)(corsOptions)),
    Layer.provide(Observability.layer),
  ) as Layer.Layer<never, EffectConfig.ConfigError, RouteRequirements>
}

export const routes = createRoutes()

export function makeWebHandler(
  host?: Layer.Layer<PluginPackage.Host>,
  options?: {
    readonly memoMap?: Layer.MemoMap
    readonly observe?: (locations: Context.Service.Shape<typeof LocationServiceMap>) => void
    readonly sessionGraphInitialized?: () => void
  },
) {
  return HttpRouter.toWebHandler(createRoutes(undefined, host, options?.observe, options?.sessionGraphInitialized), {
    disableLogger: true,
    memoMap: options?.memoMap ?? memoMap,
    middleware: disposeMiddleware,
  })
}

export const webHandler = lazy(() => makeWebHandler())

export * as HttpApiApp from "./server"
