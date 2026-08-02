import { HttpServerRequest } from "effect/unstable/http"
import { Effect, Schema } from "effect"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { RemoteSupervisorTokenHeader } from "../groups/workspace"
import { RootHttpApi } from "../api"
import { RemoteWorkspaceTargetPayload } from "../../../../../../../protocol/src/remote"
import { Service as RemotePairingService } from "../remote-pairing"

function authorized(request: HttpServerRequest.HttpServerRequest) {
  const token = process.env.SLOPCODE_REMOTE_SUPERVISOR_TOKEN
  return !!token && request.headers[RemoteSupervisorTokenHeader] === token
}

export const remoteSupervisorHandlers = HttpApiBuilder.group(RootHttpApi, "remote-supervisor", (handlers) =>
  Effect.gen(function* () {
    const pairings = yield* RemotePairingService

    const list = Effect.fn("RemoteSupervisorHttpApi.list")(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      if (!authorized(request)) return yield* new HttpApiError.Forbidden({})
      return yield* pairings.supervisorPairings()
    })

    const target = Effect.fn("RemoteSupervisorHttpApi.target")(function* (ctx: {
      payload: typeof RemoteWorkspaceTargetPayload.Type
    }) {
      const request = yield* HttpServerRequest.HttpServerRequest
      if (!authorized(request)) return yield* new HttpApiError.Forbidden({})
      const payload = yield* Schema.decodeUnknownEffect(RemoteWorkspaceTargetPayload)(ctx.payload).pipe(
        Effect.mapError(() => new HttpApiError.BadRequest({})),
      )
      yield* pairings.registerSupervisorTarget(payload).pipe(
        Effect.mapError(() => new HttpApiError.BadRequest({})),
      )
    })

    return handlers.handle("pairings", list).handle("target", target)
  }),
)
