import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { describe, expect, test } from "bun:test"
import { mkdir } from "node:fs/promises"
import Http from "node:http"
import path from "node:path"
import { registerAdapter } from "../../src/control-plane/adapters"
import type { WorkspaceAdapter } from "../../src/control-plane/types"
import { Workspace } from "../../src/control-plane/workspace"
import { WorkspaceV2 } from "@slopcode-ai/core/workspace"
import { Database } from "@slopcode-ai/core/database/database"
import { Ripgrep } from "@slopcode-ai/core/ripgrep"
import { InstanceBootstrap } from "../../src/project/bootstrap"
import { InstanceStore } from "../../src/project/instance-store"
import { Project } from "../../src/project/project"
import { Session } from "../../src/session/session"
import { serverWorkspaceRoutingLayer } from "../../src/server/routes/instance/httpapi/middleware/server-workspace-routing"
import { defaultLayer as remotePairingLayer } from "../../src/server/routes/instance/httpapi/remote-pairing"
import { HEADER as FenceHeader } from "../../src/server/shared/fence"
import { provideInstance, tmpdirScoped } from "../fixture/fixture"
import { workspaceLayerWithRuntimeFlags } from "../fixture/workspace"
import { Context, Effect, Layer, Option, Queue, Ref, Schema, Stream } from "effect"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http"
import * as Socket from "effect/unstable/socket/Socket"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { RouteLocationContext, RouteLocationMiddleware } from "@slopcode-ai/server/middleware/route-location"
import { RemoteTargetCapabilityHeader } from "../../../protocol/src/remote"

const workspaceLayer = workspaceLayerWithRuntimeFlags({ experimentalWorkspaces: true })

const liveLayer = Layer.mergeAll(
  NodeHttpServer.layerTest,
  NodeServices.layer,
  Database.defaultLayer,
  InstanceStore.defaultLayer.pipe(Layer.provide(InstanceBootstrap.defaultLayer)),
  Project.defaultLayer,
  Session.defaultLayer,
  workspaceLayer,
  Socket.layerWebSocketConstructorGlobal,
).pipe(Layer.provide(Ripgrep.defaultLayer))

const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.runPromise(effect.pipe(Effect.scoped, Effect.provide(liveLayer)) as Effect.Effect<A, E, never>)

type ProxiedRequest = {
  url: string
  method: string
  headers: Record<string, string>
  body: string
}

type TestHandler<E, R> = (
  request: HttpServerRequest.HttpServerRequest,
) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>

const serverWorkspaceRoutingTestLayer = serverWorkspaceRoutingLayer.pipe(
  Layer.provide([Socket.layerWebSocketConstructorGlobal, FetchHttpClient.layer]),
  Layer.provide(remotePairingLayer),
)

const serverUrl = HttpServer.HttpServer.use((server) => Effect.succeed(HttpServer.formatAddress(server.address)))

const requestURL = (request: { readonly url: string }) => new URL(request.url, "http://localhost")

const listenAdditionalServer = <E, R>(handler: TestHandler<E, R>) =>
  Effect.gen(function* () {
    const context = yield* Layer.build(
      NodeHttpServer.layer(Http.createServer, { host: "127.0.0.1", port: 0 }).pipe(
        Layer.provideMerge(NodeServices.layer),
      ),
    )
    const server = Context.get(context, HttpServer.HttpServer)
    yield* server.serve(HttpServerRequest.HttpServerRequest.use(handler))
    return HttpServer.formatAddress(server.address)
  })

const localAdapter = (directory: string): WorkspaceAdapter => ({
  name: "Local Test",
  description: "Create a local test workspace",
  configure: (info) => ({ ...info, name: "local-test", directory }),
  create: async () => {
    await mkdir(directory, { recursive: true })
  },
  async remove() {},
  target: () => ({ type: "local" as const, directory }),
})

const remoteAdapter = (directory: string, url: string, headers?: HeadersInit): WorkspaceAdapter => ({
  name: "Remote Test",
  description: "Create a remote test workspace",
  configure: (info) => ({ ...info, name: "remote-test", directory }),
  create: async () => {
    await mkdir(directory, { recursive: true })
  },
  async remove() {},
  target: () => ({ type: "remote" as const, url, headers }),
})

const eventStreamResponse = () =>
  HttpServerResponse.text('data: {"payload":{"type":"server.connected","properties":{}}}\n\n', {
    contentType: "text/event-stream",
  })

const syncResponse = (request: HttpServerRequest.HttpServerRequest) => {
  const url = requestURL(request)
  if (url.pathname === "/base/global/event") return Effect.succeed(eventStreamResponse())
  if (url.pathname === "/base/sync/history") return HttpServerResponse.json([])
  return undefined
}

const createWorkspace = (input: { projectID: Project.Info["id"]; type: string; adapter: WorkspaceAdapter }) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      registerAdapter(input.projectID, input.type, input.adapter)
      const workspace = yield* Workspace.Service
      return yield* workspace.create({
        type: input.type,
        branch: null,
        extra: null,
        projectID: input.projectID,
      })
    }),
    (info) => Workspace.use.remove(info.id).pipe(Effect.ignore),
  )

const createRemoteWorkspace = (input: {
  dir: string
  projectID: Project.Info["id"]
  type: string
  url: string
  headers?: HeadersInit
}) =>
  createWorkspace({
    projectID: input.projectID,
    type: input.type,
    adapter: remoteAdapter(path.join(input.dir, `.${input.type}`), input.url, input.headers),
  })

const startRemoteWorkspaceHttpServer = <E, R>(
  handler: (request: ProxiedRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) =>
  listenAdditionalServer((request) =>
    Effect.gen(function* () {
      const sync = syncResponse(request)
      if (sync) return yield* sync
      return yield* handler({
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: yield* request.text,
      })
    }),
  )

const listenRemotePtyWebSocket = () =>
  listenAdditionalServer((request) => {
    const sync = syncResponse(request)
    if (sync) return sync
    if (!requestURL(request).pathname.startsWith("/base/api/pty/")) {
      return Effect.succeed(HttpServerResponse.empty({ status: 404 }))
    }
    return echoWebSocket(request)
  })

const echoWebSocket = (request: HttpServerRequest.HttpServerRequest) =>
  Effect.gen(function* () {
    const socket = yield* Effect.orDie(request.upgrade)
    const write = yield* socket.writer
    yield* socket
      .runRaw((message) => write(`echo:${String(message)}`), {
        onOpen: Effect.all(
          [
            write(`protocol:${request.headers["sec-websocket-protocol"] ?? "none"}`),
            write(`capability:${request.headers[RemoteTargetCapabilityHeader] ?? "none"}`),
          ],
          { concurrency: "unbounded", discard: true },
        ).pipe(Effect.catch(() => Effect.void)),
      })
      .pipe(Effect.catch(() => Effect.void))
    return HttpServerResponse.empty()
  })

const RouteQuery = Schema.Struct({
  workspace: Schema.optional(Schema.String),
  directory: Schema.optional(Schema.String),
  location: Schema.optional(
    Schema.Struct({
      directory: Schema.optional(Schema.String),
      workspace: Schema.optional(Schema.String),
    }),
  ),
})

const SocketQuery = Schema.Struct({
  ...RouteQuery.fields,
  cursor: Schema.optional(Schema.String),
  ticket: Schema.optional(Schema.String),
})

const ProbeResult = Schema.Struct({
  local: Schema.Boolean,
  directory: Schema.String,
  workspaceID: Schema.NullOr(Schema.String),
})

const ServerProbeApi = HttpApi.make("server-workspace-routing-probe").add(
  HttpApiGroup.make("probe")
    .add(
      HttpApiEndpoint.get("probe", "/api/probe", {
        query: RouteQuery,
        success: ProbeResult,
      }),
      HttpApiEndpoint.get("event", "/api/event", {
        query: RouteQuery,
        success: Schema.String,
      }),
      HttpApiEndpoint.get("message", "/api/session/:sessionID/message", {
        params: { sessionID: Schema.String },
        query: RouteQuery,
        success: Schema.Struct({ local: Schema.Boolean }),
      }),
      HttpApiEndpoint.get("permission", "/api/session/:sessionID/permission", {
        params: { sessionID: Schema.String },
        query: RouteQuery,
        success: Schema.Struct({ local: Schema.Boolean }),
      }),
      HttpApiEndpoint.get("question", "/api/session/:sessionID/question", {
        params: { sessionID: Schema.String },
        query: RouteQuery,
        success: Schema.Struct({ local: Schema.Boolean }),
      }),
      HttpApiEndpoint.get("pty", "/api/pty/:ptyID/connect", {
        params: { ptyID: Schema.String },
        query: SocketQuery,
        success: Schema.Boolean,
      }),
    )
    .middleware(RouteLocationMiddleware),
)

const routeContextResponse = Effect.gen(function* () {
  const route = yield* Effect.serviceOption(RouteLocationContext)
  return {
    local: true,
    directory: Option.isSome(route) ? route.value.directory : process.cwd(),
    workspaceID: Option.isSome(route) ? (route.value.workspaceID ?? null) : null,
  }
})

const serverProbeHandlers = HttpApiBuilder.group(ServerProbeApi, "probe", (handlers) =>
  handlers
    .handle("probe", () => routeContextResponse)
    .handle("event", () => Effect.succeed("local"))
    .handle("message", () => Effect.succeed({ local: true }))
    .handle("permission", () => Effect.succeed({ local: true }))
    .handle("question", () => Effect.succeed({ local: true }))
    .handle("pty", () => Effect.succeed(false)),
)

const serveServerProbe = HttpApiBuilder.layer(ServerProbeApi).pipe(
  Layer.provide(serverProbeHandlers),
  Layer.provide(serverWorkspaceRoutingTestLayer),
  HttpRouter.serve,
  Layer.build,
)

describe.serial("shared /api workspace routing middleware", () => {
  test.serial("waits for sync fence headers from remote shared /api responses", () =>
    run(
      Effect.gen(function* () {
        const dir = yield* tmpdirScoped({ git: true })
        const project = yield* Project.use.fromDirectory(dir)
        const workspaceID = WorkspaceV2.ID.ascending()
        const type = "remote-v2-fence-target"
        const waited = yield* Ref.make<{ workspaceID: WorkspaceV2.ID; state: Record<string, number> } | undefined>(
          undefined,
        )

        const remoteUrl = yield* startRemoteWorkspaceHttpServer(() =>
          HttpServerResponse.json(
            { proxied: true },
            { status: 202, headers: { [FenceHeader]: JSON.stringify({ aggregate: 3 }) } },
          ),
        )
        registerAdapter(project.project.id, type, remoteAdapter(path.join(dir, `.${type}`), `${remoteUrl}/base`))

        const workspace = Workspace.Service.of({
          create: () => Effect.die("unused"),
          sessionWarp: () => Effect.die("unused"),
          list: () => Effect.die("unused"),
          syncList: () => Effect.die("unused"),
          get: (id) =>
            Effect.succeed(
              id === workspaceID
                ? {
                    id: workspaceID,
                    type,
                    branch: null,
                    name: "remote-v2-fence-target",
                    directory: null,
                    extra: null,
                    projectID: project.project.id,
                    timeUsed: Date.now(),
                  }
                : undefined,
            ),
          remove: () => Effect.die("unused"),
          status: () => Effect.die("unused"),
          isSyncing: () => Effect.succeed(true),
          waitForSync: (id, state) => Ref.set(waited, { workspaceID: id, state }),
          startWorkspaceSyncing: () => Effect.die("unused"),
        })

        yield* HttpApiBuilder.layer(ServerProbeApi).pipe(
          Layer.provide(serverProbeHandlers),
          Layer.provide(serverWorkspaceRoutingTestLayer),
          Layer.provide(Layer.succeed(Workspace.Service, workspace)),
          Layer.provide(Layer.mock(Session.Service)({})),
          HttpRouter.serve,
          Layer.build,
        )

        const response = yield* HttpClient.get(`/api/probe?workspace=${workspaceID}`)

        expect(response.status).toBe(202)
        expect(yield* response.json).toEqual({ proxied: true })
        expect(yield* Ref.get(waited)).toEqual({ workspaceID, state: { aggregate: 3 } })
      }),
    ),
  )

  test.serial("proxies session-owned shared /api message, permission, and question routes", () =>
    run(
      Effect.gen(function* () {
        const dir = yield* tmpdirScoped({ git: true })
        const project = yield* Project.use.fromDirectory(dir)
        const forwarded: ProxiedRequest[] = []
        const remoteUrl = yield* startRemoteWorkspaceHttpServer((request) => {
          forwarded.push(request)
          return HttpServerResponse.json({ proxied: true, path: requestURL(request).pathname })
        })
        const workspace = yield* createRemoteWorkspace({
          dir,
          projectID: project.project.id,
          type: "remote-v2-session-target",
          url: `${remoteUrl}/base`,
          headers: { "x-target-auth": "secret" },
        })
        const session = yield* Session.use.create({ workspaceID: workspace.id }).pipe(provideInstance(dir))

        yield* serveServerProbe

        for (const route of ["message", "permission", "question"]) {
          const response = yield* HttpClientRequest.get(
            `/api/session/${session.id}/${route}?directory=${encodeURIComponent("/ignored")}&location[directory]=${encodeURIComponent("/also-ignored")}`,
          ).pipe(HttpClientRequest.setHeader("x-slopcode-workspace", "internal"), HttpClient.execute)

          expect(response.status).toBe(200)
          expect(yield* response.json).toEqual({
            proxied: true,
            path: `/base/api/session/${session.id}/${route}`,
          })
        }

        for (const request of forwarded) {
          const url = requestURL(request)
          expect(url.searchParams.get("workspace")).toBeNull()
          expect(url.searchParams.get("directory")).toBeNull()
          expect(url.searchParams.get("location[directory]")).toBeNull()
          expect(request.headers["x-target-auth"]).toBe("secret")
          expect(request.headers["x-slopcode-workspace"]).toBeUndefined()
        }
      }),
    ),
  )

  test.serial("proxies shared /api event subscriptions through selected remote workspaces", () =>
    run(
      Effect.gen(function* () {
        const dir = yield* tmpdirScoped({ git: true })
        const project = yield* Project.use.fromDirectory(dir)
        const forwarded: ProxiedRequest[] = []
        const remoteUrl = yield* startRemoteWorkspaceHttpServer((request) => {
          forwarded.push(request)
          if (requestURL(request).pathname === "/base/api/event") return Effect.succeed(eventStreamResponse())
          return Effect.succeed(HttpServerResponse.empty({ status: 404 }))
        })
        const workspace = yield* createRemoteWorkspace({
          dir,
          projectID: project.project.id,
          type: "remote-v2-event-target",
          url: `${remoteUrl}/base`,
        })

        yield* serveServerProbe

        const response = yield* HttpClient.get(`/api/event?workspace=${workspace.id}`)

        expect(response.status).toBe(200)
        expect(response.headers["content-type"]).toContain("text/event-stream")
        const event = Array.from(yield* response.stream.pipe(Stream.take(1), Stream.runCollect))[0]
        expect(new TextDecoder().decode(event)).toContain("server.connected")
        expect(forwarded.some((request) => requestURL(request).pathname === "/base/api/event")).toBe(true)
      }),
    ),
  )

  test.serial("proxies shared /api PTY websocket requests through selected remote workspaces", () =>
    run(
      Effect.gen(function* () {
        const dir = yield* tmpdirScoped({ git: true })
        const project = yield* Project.use.fromDirectory(dir)
        const remoteUrl = yield* listenRemotePtyWebSocket()
        const workspace = yield* createRemoteWorkspace({
          dir,
          projectID: project.project.id,
          type: "remote-v2-pty-target",
          url: `${remoteUrl}/base`,
          headers: { [RemoteTargetCapabilityHeader]: "pty-secret" },
        })

        yield* serveServerProbe

        const socket = yield* Socket.makeWebSocket(
          `${(yield* serverUrl).replace(/^http/, "ws")}/api/pty/pty_remote/connect?workspace=${workspace.id}&cursor=-1`,
          {
            closeCodeIsError: () => false,
            protocols: "chat",
          },
        )
        const messages = yield* Queue.unbounded<string>()
        yield* socket.runRaw((message) => Queue.offer(messages, String(message))).pipe(Effect.forkScoped)
        const write = yield* socket.writer

        expect(yield* Queue.take(messages)).toBe("protocol:chat")
        expect(yield* Queue.take(messages)).toBe("capability:pty-secret")
        yield* write("hello")
        expect(yield* Queue.take(messages)).toBe("echo:hello")
      }),
    ),
  )
})
