import { WorkspaceV2 } from "@slopcode-ai/core/workspace"
import type { Target } from "@/control-plane/types"
import { Workspace } from "@/control-plane/workspace"
import { WorkspaceAdapterRuntime } from "@/control-plane/workspace-adapter-runtime"
import { Service as RemotePairingService } from "../remote-pairing"
import type { PairingScope } from "../remote-pairing"
import { Project } from "@/project/project"
import { Session } from "@/session/session"
import { HttpApiProxy } from "./proxy"
import * as Fence from "@/server/shared/fence"
import { getWorkspaceRouteSessionID, isLocalWorkspaceRoute, workspaceProxyURL } from "@/server/shared/workspace-routing"
import { NotFoundError } from "@/storage/storage"
import { Flag } from "@slopcode-ai/core/flag/flag"
import { Context, Effect, Layer, Option, Schema } from "effect"
import { HttpClient, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApiMiddleware } from "effect/unstable/httpapi"
import * as Socket from "effect/unstable/socket/Socket"
import { InvalidRequestError } from "../errors"

// Query fields this middleware reads from the URL. Spread into every
// endpoint query schema in groups that apply WorkspaceRoutingMiddleware,
// otherwise HttpApi rejects requests carrying these params with 400.
// HttpApiMiddleware in effect-smol cannot declare query params today —
// remove this once upstream supports middleware-declared query schemas.
export const WorkspaceRoutingQueryFields = {
  directory: Schema.optional(Schema.String),
  workspace: Schema.optional(Schema.String),
}

export const WorkspaceRoutingQuery = Schema.Struct(WorkspaceRoutingQueryFields)

type RemoteTarget = Extract<Target, { type: "remote" }>

type RequestPlan =
  | { readonly _tag: "Response"; readonly response: HttpServerResponse.HttpServerResponse }
  | { readonly _tag: "InvalidWorkspace" }
  | { readonly _tag: "MissingWorkspace"; readonly workspaceID: WorkspaceV2.ID }
  | { readonly _tag: "Local"; readonly directory: string; readonly workspaceID?: WorkspaceV2.ID }
  | {
      readonly _tag: "Remote"
      readonly request: HttpServerRequest.HttpServerRequest
      readonly workspaceID: WorkspaceV2.ID
      readonly target: RemoteTarget
      readonly url: URL
      readonly sync: boolean
    }
const InvalidWorkspaceID = Symbol("InvalidWorkspaceID")

export class WorkspaceRouteContext extends Context.Service<
  WorkspaceRouteContext,
  {
    readonly directory: string
    readonly workspaceID?: WorkspaceV2.ID
  }
>()("@slopcode/ExperimentalHttpApiWorkspaceRouteContext") {}

export class WorkspaceRoutingMiddleware extends HttpApiMiddleware.Service<
  WorkspaceRoutingMiddleware,
  {
    provides: WorkspaceRouteContext
    requires: Session.Service
  }
>()("@slopcode/ExperimentalHttpApiWorkspaceRouting") {}

function requestURL(request: HttpServerRequest.HttpServerRequest): URL {
  return new URL(request.url, "http://localhost")
}

function configuredWorkspaceID(): WorkspaceV2.ID | undefined {
  return Flag.SLOPCODE_WORKSPACE_ID ? parseWorkspaceID(Flag.SLOPCODE_WORKSPACE_ID) : undefined
}

function selectedWorkspaceID(url: URL, sessionWorkspaceID?: WorkspaceV2.ID): WorkspaceV2.ID | undefined {
  const workspaceParam = url.searchParams.get("workspace")
  return sessionWorkspaceID ?? (workspaceParam ? parseWorkspaceID(workspaceParam) : undefined)
}

function selectedV2WorkspaceID(
  url: URL,
  sessionWorkspaceID?: WorkspaceV2.ID,
): WorkspaceV2.ID | typeof InvalidWorkspaceID | undefined {
  if (sessionWorkspaceID) return sessionWorkspaceID
  const workspaceParam = url.searchParams.get("workspace")
  if (!workspaceParam) return undefined
  return parseWorkspaceID(workspaceParam) ?? InvalidWorkspaceID
}

function parseWorkspaceID(value: string): WorkspaceV2.ID | undefined {
  if (value.startsWith("ws_")) return value as WorkspaceV2.ID
  const workspaceID = Schema.decodeUnknownOption(WorkspaceV2.ID)(value)
  if (Option.isNone(workspaceID)) return undefined
  return workspaceID.value
}

function defaultDirectory(request: HttpServerRequest.HttpServerRequest, url: URL): string {
  return url.searchParams.get("directory") || request.headers["x-slopcode-directory"] || process.cwd()
}

function shouldStayOnControlPlane(request: HttpServerRequest.HttpServerRequest, url: URL): boolean {
  return isLocalWorkspaceRoute(request.method, url.pathname) || url.pathname.startsWith("/console")
}

function resolveWorkspace(
  id: WorkspaceV2.ID | undefined,
  envWorkspaceID: WorkspaceV2.ID | undefined,
): Effect.Effect<Workspace.Info | void, never, Workspace.Service> {
  if (!id || envWorkspaceID) return Effect.void
  return Workspace.Service.use((workspace) => workspace.get(id))
}

function missingWorkspaceResponse(id: WorkspaceV2.ID): HttpServerResponse.HttpServerResponse {
  return HttpServerResponse.text(`Workspace not found: ${id}`, {
    status: 500,
    contentType: "text/plain; charset=utf-8",
  })
}

function resolveTarget(workspace: Workspace.Info): Effect.Effect<Target> {
  return WorkspaceAdapterRuntime.target(workspace)
}

function resolvePairingScope(
  request: HttpServerRequest.HttpServerRequest,
  url: URL,
  workspace: Workspace.Info | void,
  session: Session.Info | undefined,
): Effect.Effect<PairingScope | undefined, never, Project.Service> {
  if (session) return Effect.succeed({ projectID: session.projectID, directory: session.directory })
  if (workspace?.directory) return Effect.succeed({ projectID: workspace.projectID, directory: workspace.directory })
  const directory = defaultDirectory(request, url)
  return Project.Service.use((service) =>
    service.fromDirectory(directory).pipe(
      Effect.map(({ project }) => ({ projectID: project.id, directory })),
      Effect.catch(() => Effect.succeed(undefined)),
      Effect.catchDefect(() => Effect.succeed(undefined)),
    ),
  )
}

function proxyRemote(
  client: HttpClient.HttpClient,
  request: HttpServerRequest.HttpServerRequest,
  workspaceID: WorkspaceV2.ID,
  target: RemoteTarget,
  url: URL,
  sync: boolean,
): Effect.Effect<HttpServerResponse.HttpServerResponse, never, Socket.WebSocketConstructor | Workspace.Service> {
  return Effect.gen(function* () {
    if (sync && !(yield* Workspace.Service.use((svc) => svc.isSyncing(workspaceID)))) {
      return HttpServerResponse.text(`broken sync connection for workspace: ${workspaceID}`, {
        status: 503,
        contentType: "text/plain; charset=utf-8",
      })
    }
    const proxyURL = workspaceProxyURL(target.url, url)
    const headers = request.headers as Record<string, string>
    if (headers["upgrade"]?.toLowerCase() === "websocket") {
      return yield* HttpApiProxy.websocket(request, proxyURL, target.headers)
    }
    const response = yield* HttpApiProxy.http(client, proxyURL, target.headers, request)
    const fence = Fence.parse(new Headers(response.headers))
    if (fence) {
      const syncFailure = yield* Fence.wait(
        workspaceID,
        fence,
        request.source instanceof Request ? request.source.signal : undefined,
      ).pipe(
        Effect.as(undefined),
        Effect.catch((error) => Effect.succeed(HttpServerResponse.text(error.message, { status: 503 }))),
      )
      if (syncFailure) return syncFailure
    }
    return response
  })
}

function planRequest(
  request: HttpServerRequest.HttpServerRequest,
  session?: Session.Info,
): Effect.Effect<RequestPlan, never, Workspace.Service | RemotePairingService | Project.Service> {
  return Effect.gen(function* () {
    const url = requestURL(request)
    const envWorkspaceID = configuredWorkspaceID()
    const workspaceID = url.pathname.startsWith("/api/")
      ? selectedV2WorkspaceID(url, session?.workspaceID)
      : selectedWorkspaceID(url, session?.workspaceID)
    if (workspaceID === InvalidWorkspaceID) return { _tag: "InvalidWorkspace" }
    const workspace = yield* resolveWorkspace(workspaceID, envWorkspaceID)

    if (workspace !== undefined && !envWorkspaceID && !shouldStayOnControlPlane(request, url)) {
      const target = yield* resolveTarget(workspace)
      if (target.type === "remote")
        return { _tag: "Remote", request, workspaceID: workspace.id, target, url, sync: true }
      return { _tag: "Local", directory: target.directory, workspaceID: workspace.id }
    }

    if (workspaceID && !envWorkspaceID && !shouldStayOnControlPlane(request, url)) {
      const scope = yield* resolvePairingScope(request, url, workspace, session)
      const selected = scope
        ? yield* RemotePairingService.use((service) => service.target(workspaceID, scope)).pipe(
            Effect.map((selected) => ({ _tag: "Selected" as const, selected })),
            Effect.catchTag("RemotePairing.TargetUnavailableError", (error) =>
              Effect.succeed({
                _tag: "Response" as const,
                response: HttpServerResponse.text(error.message, {
                  status: 409,
                  contentType: "text/plain; charset=utf-8",
                }),
              }),
            ),
          )
        : { _tag: "Selected" as const, selected: undefined }
      if (selected._tag === "Response") return selected
      if (selected.selected) {
        if (selected.selected.target.type === "remote") {
          return {
            _tag: "Remote",
            request,
            workspaceID,
            target: {
              type: "remote",
              url: selected.selected.target.url,
              headers: selected.selected.target.headers,
            },
            url,
            sync: false,
          }
        }
        return { _tag: "Local", directory: selected.selected.target.directory, workspaceID }
      }
    }

    if (workspaceID && workspace === undefined && !envWorkspaceID) {
      return { _tag: "MissingWorkspace", workspaceID }
    }

    return {
      _tag: "Local",
      directory: session?.directory || defaultDirectory(request, url),
      workspaceID: envWorkspaceID ?? workspaceID,
    }
  })
}

function routeWorkspace<E>(
  client: HttpClient.HttpClient,
  effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, WorkspaceRouteContext>,
  plan: RequestPlan,
): Effect.Effect<HttpServerResponse.HttpServerResponse, E, Socket.WebSocketConstructor | Workspace.Service> {
  if (plan._tag === "Response") return Effect.succeed(plan.response)
  if (plan._tag === "InvalidWorkspace") {
    return Effect.succeed(
      HttpServerResponse.jsonUnsafe(
        new InvalidRequestError({
          message: "Invalid workspace query parameter",
          kind: "Query",
          field: "workspace",
        }),
        { status: 400 },
      ),
    )
  }
  if (plan._tag === "MissingWorkspace") return Effect.succeed(missingWorkspaceResponse(plan.workspaceID))
  if (plan._tag === "Remote")
    return proxyRemote(client, plan.request, plan.workspaceID, plan.target, plan.url, plan.sync)
  return effect.pipe(
    Effect.provideService(
      WorkspaceRouteContext,
      WorkspaceRouteContext.of({ directory: plan.directory, workspaceID: plan.workspaceID }),
    ),
  )
}

function routeHttpApiWorkspace<E>(
  client: HttpClient.HttpClient,
  effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, WorkspaceRouteContext>,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  E,
  | Session.Service
  | Workspace.Service
  | RemotePairingService
  | Project.Service
  | HttpServerRequest.HttpServerRequest
  | Socket.WebSocketConstructor
> {
  return Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const sessionID = getWorkspaceRouteSessionID(requestURL(request))
    const session = sessionID
      ? yield* Session.Service.use((svc) => svc.get(sessionID)).pipe(
          Effect.catchIf(
            (error): error is NotFoundError => NotFoundError.isInstance(error),
            () => Effect.succeed(undefined),
          ),
          Effect.catchDefect(() => Effect.succeed(undefined)),
        )
      : undefined
    const plan = yield* planRequest(request, session)
    return yield* routeWorkspace(client, effect, plan)
  })
}

export const workspaceRoutingLayer = Layer.effect(
  WorkspaceRoutingMiddleware,
  Effect.gen(function* () {
    const makeWebSocket = yield* Socket.WebSocketConstructor
    const workspace = yield* Workspace.Service
    const project = yield* Project.Service
    const pairings = yield* RemotePairingService
    const client = yield* HttpClient.HttpClient
    return WorkspaceRoutingMiddleware.of((effect) =>
      routeHttpApiWorkspace(client, effect).pipe(
        Effect.provideService(Socket.WebSocketConstructor, makeWebSocket),
        Effect.provideService(Workspace.Service, workspace),
        Effect.provideService(Project.Service, project),
        Effect.provideService(RemotePairingService, pairings),
      ),
    )
  }),
)
