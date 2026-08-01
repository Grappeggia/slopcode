import { listAdapters } from "@/control-plane/adapters"
import { Workspace } from "@/control-plane/workspace"
import * as InstanceState from "@/effect/instance-state"
import { Vcs } from "@/project/vcs"
import {
  RemotePairingCreateInput,
  RemotePairingCreatePayload,
  RemotePairingRecord,
  RemoteWorkspaceSelectInput,
  RemoteWorkspaceSsh,
  RemoteWorkspaceSshInput,
  RemoteWorkspaceTargetInput,
  RemoteWorkspaceTargetPayload,
} from "../../../../../../../protocol/src/remote"
import { Service as RemotePairingService } from "../remote-pairing"
import { Cause, Effect, Schema } from "effect"
import { HttpServerRequest } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { notFound } from "../errors"
import { ApiVcsApplyError } from "../groups/instance"
import {
  ApiWorkspaceCreateError,
  ApiWorkspaceRemoteSelectError,
  ApiWorkspaceRemoteSshValidationError,
  ApiWorkspaceRemoteTargetError,
  ApiWorkspaceRemoteTargetUnauthorizedError,
  ApiWorkspaceWarpError,
  CreatePayload,
  RemoteSupervisorTokenHeader,
  WarpPayload,
} from "../groups/workspace"

export const workspaceHandlers = HttpApiBuilder.group(InstanceHttpApi, "workspace", (handlers) =>
  Effect.gen(function* () {
    const workspace = yield* Workspace.Service
    const pairings = yield* RemotePairingService

    const remoteScope = Effect.fn("WorkspaceHttpApi.remoteScope")(function* () {
      const instance = yield* InstanceState.context
      return { projectID: instance.project.id, directory: instance.directory }
    })

    const adapters = Effect.fn("WorkspaceHttpApi.adapters")(function* () {
      const instance = yield* InstanceState.context
      return yield* Effect.sync(() => listAdapters(instance.project.id))
    })

    const list = Effect.fn("WorkspaceHttpApi.list")(function* () {
      return yield* workspace.list((yield* InstanceState.context).project)
    })

    const create = Effect.fn("WorkspaceHttpApi.create")(function* (ctx: { payload: typeof CreatePayload.Type }) {
      const instance = yield* InstanceState.context
      return yield* workspace
        .create({
          ...ctx.payload,
          extra: ctx.payload.extra ?? null,
          projectID: instance.project.id,
        })
        .pipe(
          Effect.catchCause((cause) => {
            // Plugin throws surface as defects (because EffectBridge.fromPromise uses Effect.promise),
            // bypassing Effect.mapError. Walk the cause to surface the real error to the client.
            const die = cause.reasons.find(Cause.isDieReason)
            const fail = cause.reasons.find(Cause.isFailReason)
            const reason: unknown = die?.defect ?? fail?.error
            const message = reason instanceof Error ? reason.message : "Workspace creation failed"
            return Effect.fail(
              new ApiWorkspaceCreateError({
                name: "WorkspaceCreateError",
                data: { message },
              }),
            )
          }),
        )
    })

    const syncList = Effect.fn("WorkspaceHttpApi.syncList")(function* () {
      yield* workspace.syncList((yield* InstanceState.context).project)
    })

    const status = Effect.fn("WorkspaceHttpApi.status")(function* () {
      const ids = new Set((yield* workspace.list((yield* InstanceState.context).project)).map((item) => item.id))
      return (yield* workspace.status()).filter((item) => ids.has(item.workspaceID))
    })

    const remove = Effect.fn("WorkspaceHttpApi.remove")(function* (ctx: { params: { id: Workspace.Info["id"] } }) {
      return yield* workspace.remove(ctx.params.id)
    })

    const warp = Effect.fn("WorkspaceHttpApi.warp")(function* (ctx: { payload: typeof WarpPayload.Type }) {
      yield* workspace
        .sessionWarp({
          workspaceID: ctx.payload.id,
          sessionID: ctx.payload.sessionID,
          copyChanges: ctx.payload.copyChanges,
        })
        .pipe(
          Effect.mapError((error) => {
            if (error instanceof Workspace.WorkspaceNotFoundError) return notFound(error.message)
            if (error instanceof Vcs.PatchApplyError) {
              return new ApiVcsApplyError({
                name: "VcsApplyError",
                data: {
                  message: error.message,
                  reason: error.reason,
                },
              })
            }
            return new ApiWorkspaceWarpError({
              name: "WorkspaceWarpError",
              data: {
                message: error.message,
              },
            })
          }),
        )
    })

    const remoteHosts = Effect.fn("WorkspaceHttpApi.remoteHosts")(function* () {
      return yield* pairings.hosts(yield* remoteScope())
    })

    const remotePairing = Effect.fn("WorkspaceHttpApi.remotePairing")(function* (ctx: {
      payload: typeof RemotePairingCreatePayload.Type
    }) {
      const payload = yield* Schema.decodeUnknownEffect(RemotePairingCreateInput)(ctx.payload).pipe(
        Effect.mapError(() => new HttpApiError.BadRequest({})),
      )
      return yield* pairings.create(payload, yield* remoteScope())
    })

    const remotePairingRemove = Effect.fn("WorkspaceHttpApi.remotePairingRemove")(function* (ctx) {
      yield* pairings.revoke(ctx.params.pairingID, yield* remoteScope())
    })

    const remoteSshValidate = Effect.fn("WorkspaceHttpApi.remoteSshValidate")(function* (ctx: {
      payload: typeof RemoteWorkspaceSshInput.Type
    }) {
      const payload = yield* Schema.decodeUnknownEffect(RemoteWorkspaceSsh)(ctx.payload).pipe(
        Effect.mapError(() => new HttpApiError.BadRequest({})),
      )
      return yield* pairings.validateSsh(payload, yield* remoteScope()).pipe(
        Effect.mapError(
          (error) =>
            new ApiWorkspaceRemoteSshValidationError({
              name: "WorkspaceRemoteSshValidationError",
              data: { message: error.message },
            }),
        ),
      )
    })

    const remoteSelect = Effect.fn("WorkspaceHttpApi.remoteSelect")(function* (ctx: {
      payload: typeof RemoteWorkspaceSelectInput.Type
    }) {
      return yield* pairings.select(ctx.payload, yield* remoteScope()).pipe(
        Effect.mapError(
          (error) =>
            new ApiWorkspaceRemoteSelectError({
              name: "WorkspaceRemoteSelectError",
              data: { message: error.message },
            }),
        ),
      )
    })

    const remoteTarget = Effect.fn("WorkspaceHttpApi.remoteTarget")(function* (ctx: {
      payload: typeof RemoteWorkspaceTargetPayload.Type
    }) {
      const request = yield* HttpServerRequest.HttpServerRequest
      const token = process.env.SLOPCODE_REMOTE_SUPERVISOR_TOKEN
      if (!token || request.headers[RemoteSupervisorTokenHeader] !== token) {
        return yield* new ApiWorkspaceRemoteTargetUnauthorizedError({
          name: "WorkspaceRemoteTargetUnauthorizedError",
          data: { message: "Missing or invalid remote supervisor token" },
        })
      }
      const payload = yield* Schema.decodeUnknownEffect(RemoteWorkspaceTargetInput)(ctx.payload).pipe(
        Effect.mapError(() => new HttpApiError.BadRequest({})),
      )
      yield* pairings.registerTarget(payload, yield* remoteScope()).pipe(
        Effect.mapError(
          (error) =>
            new ApiWorkspaceRemoteTargetError({
              name: "WorkspaceRemoteTargetError",
              data: { message: error.message },
            }),
        ),
      )
    })

    return handlers
      .handle("adapters", adapters)
      .handle("list", list)
      .handle("create", create)
      .handle("syncList", syncList)
      .handle("status", status)
      .handle("remove", remove)
      .handle("warp", warp)
      .handle("remoteHosts", remoteHosts)
      .handle("remotePairing", remotePairing)
      .handle("remotePairingRemove", remotePairingRemove)
      .handle("remoteSshValidate", remoteSshValidate)
      .handle("remoteSelect", remoteSelect)
      .handle("remoteTarget", remoteTarget)
  }),
)
