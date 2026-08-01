import { RouteLocationContext, RouteLocationMiddleware } from "@slopcode-ai/server/middleware/route-location"
import { WorkspaceV2 } from "@slopcode-ai/core/workspace"
import { Flag } from "@slopcode-ai/core/flag/flag"
import type { Target } from "@/control-plane/types"
import { Workspace } from "@/control-plane/workspace"
import { WorkspaceAdapterRuntime } from "@/control-plane/workspace-adapter-runtime"
import { Service as RemotePairingService } from "../remote-pairing"
import * as Fence from "@/server/shared/fence"
import { getWorkspaceRouteSessionID, workspaceProxyURL } from "@/server/shared/workspace-routing"
import { Session } from "@/session/session"
import { NotFoundError } from "@/storage/storage"
import { Effect, Layer, Option, Schema } from "effect"
import { HttpClient, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import * as Socket from "effect/unstable/socket/Socket"
import { HttpApiProxy } from "./proxy"

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

type SelectedPlan =
  | { readonly _tag: "Selected"; readonly selected: import("../remote-pairing").ResolvedTarget | undefined }
  | { readonly _tag: "Response"; readonly response: HttpServerResponse.HttpServerResponse }

const InvalidWorkspaceID = Symbol("InvalidWorkspaceID")

function requestURL(request: HttpServerRequest.HttpServerRequest): URL {
  return new URL(request.url, "http://localhost")
}

function configuredWorkspaceID(): WorkspaceV2.ID | undefined {
  return Flag.SLOPCODE_WORKSPACE_ID ? parseWorkspaceID(Flag.SLOPCODE_WORKSPACE_ID) : undefined
}

function parseWorkspaceID(value: string): WorkspaceV2.ID | undefined {
  if (value.startsWith("ws_")) return value as WorkspaceV2.ID
  const workspaceID = Schema.decodeUnknownOption(WorkspaceV2.ID)(value)
  if (Option.isNone(workspaceID)) return undefined
  return workspaceID.value
}

function selectedWorkspaceID(
  request: HttpServerRequest.HttpServerRequest,
  url: URL,
  sessionWorkspaceID?: WorkspaceV2.ID,
): WorkspaceV2.ID | typeof InvalidWorkspaceID | undefined {
  if (sessionWorkspaceID) return sessionWorkspaceID
  const workspaceParam =
    url.searchParams.get("workspace") ||
    url.searchParams.get("location[workspace]") ||
    request.headers["x-slopcode-workspace"]
  if (!workspaceParam) return undefined
  return parseWorkspaceID(workspaceParam) ?? InvalidWorkspaceID
}

function selectedDirectory(
  request: HttpServerRequest.HttpServerRequest,
  url: URL,
  sessionDirectory?: string,
): string {
  return (
    sessionDirectory ||
    url.searchParams.get("directory") ||
    url.searchParams.get("location[directory]") ||
    request.headers["x-slopcode-directory"] ||
    process.cwd()
  )
}

function resolveWorkspace(
  id: WorkspaceV2.ID | undefined,
  envWorkspaceID: WorkspaceV2.ID | undefined,
): Effect.Effect<Workspace.Info | void, never, Workspace.Service> {
  if (!id || envWorkspaceID) return Effect.void
  return Workspace.Service.use((workspace) => workspace.get(id))
}

function missingWorkspaceResponse(id: WorkspaceV2.ID) {
  return HttpServerResponse.text(`Workspace not found: ${id}`, {
    status: 500,
    contentType: "text/plain; charset=utf-8",
  })
}

function resolveTarget(workspace: Workspace.Info): Effect.Effect<Target> {
  return WorkspaceAdapterRuntime.target(workspace)
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
    if (headers["upgrade"]?.toLowerCase() === "websocket") return yield* HttpApiProxy.websocket(request, proxyURL)
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
): Effect.Effect<RequestPlan, never, Workspace.Service | RemotePairingService> {
  return Effect.gen(function* () {
    const url = requestURL(request)
    const envWorkspaceID = configuredWorkspaceID()
    const workspaceID = selectedWorkspaceID(request, url, session?.workspaceID)
    if (workspaceID === InvalidWorkspaceID) return { _tag: "InvalidWorkspace" }
    const workspace = yield* resolveWorkspace(workspaceID, envWorkspaceID)

    if (workspace !== undefined && !envWorkspaceID) {
      const target = yield* resolveTarget(workspace)
      if (target.type === "remote") {
        return { _tag: "Remote", request, workspaceID: workspace.id, target, url, sync: true }
      }
      return {
        _tag: "Local",
        directory: session?.directory || target.directory,
        workspaceID: workspace.id,
      }
    }

    if (workspaceID && !envWorkspaceID) {
      const selected: SelectedPlan = yield* RemotePairingService.use((service) => service.target(workspaceID)).pipe(
        Effect.map((selected): SelectedPlan => ({ _tag: "Selected", selected })),
        Effect.catchTag("RemotePairing.TargetUnavailableError", (error) =>
          Effect.succeed<SelectedPlan>({
            _tag: "Response",
            response: HttpServerResponse.text(error.message, { status: 409, contentType: "text/plain; charset=utf-8" }),
          }),
        ),
      )
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
        return {
          _tag: "Local",
          directory: selected.selected.target.directory,
          workspaceID,
        }
      }
      if (workspace === undefined) return { _tag: "MissingWorkspace", workspaceID }
    }

    return {
      _tag: "Local",
      directory: selectedDirectory(request, url, session?.directory),
      workspaceID: envWorkspaceID ?? session?.workspaceID ?? workspaceID,
    }
  })
}

function routeWorkspace<E>(
  client: HttpClient.HttpClient,
  effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E>,
  plan: RequestPlan,
): Effect.Effect<HttpServerResponse.HttpServerResponse, E, Socket.WebSocketConstructor | Workspace.Service> {
  if (plan._tag === "Response") return Effect.succeed(plan.response)
  if (plan._tag === "InvalidWorkspace") {
    return Effect.succeed(HttpServerResponse.text("Invalid workspace query parameter", { status: 400 }))
  }
  if (plan._tag === "MissingWorkspace") return Effect.succeed(missingWorkspaceResponse(plan.workspaceID))
  if (plan._tag === "Remote") return proxyRemote(client, plan.request, plan.workspaceID, plan.target, plan.url, plan.sync)
  return effect.pipe(
    Effect.provideService(
      RouteLocationContext,
      RouteLocationContext.of({
        directory: plan.directory,
        workspaceID: plan.workspaceID,
      }),
    ),
  )
}

function routeHttpApiWorkspace<E>(
  client: HttpClient.HttpClient,
  effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E>,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  E,
  | Session.Service
  | Workspace.Service
  | RemotePairingService
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
    return yield* routeWorkspace(client, effect, yield* planRequest(request, session))
  })
}

export const serverWorkspaceRoutingLayer = Layer.effect(
  RouteLocationMiddleware,
  Effect.gen(function* () {
    const makeWebSocket = yield* Socket.WebSocketConstructor
    const workspace = yield* Workspace.Service
    const session = yield* Session.Service
    const pairings = yield* RemotePairingService
    const client = yield* HttpClient.HttpClient
    return RouteLocationMiddleware.of((effect) =>
      routeHttpApiWorkspace(client, effect).pipe(
        Effect.provideService(Socket.WebSocketConstructor, makeWebSocket),
        Effect.provideService(Workspace.Service, workspace),
        Effect.provideService(Session.Service, session),
        Effect.provideService(RemotePairingService, pairings),
      ),
    )
  }),
)
