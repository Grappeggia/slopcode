import { Location } from "@slopcode-ai/core/location"
import { PermissionV2 } from "@slopcode-ai/core/permission"
import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { Effect } from "effect"
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi"
import { Api } from "../api"
import { PermissionNotFoundError } from "../errors"
import { response } from "../groups/location"

function missingRequest(id: PermissionV2.ID) {
  return new PermissionNotFoundError({ requestID: id, message: `Permission request not found: ${id}` })
}

export const PermissionHandler = HttpApiBuilder.group(Api, "server.permission", (handlers) =>
  Effect.gen(function* () {
    return handlers
      .handle(
        "permission.request.list",
        Effect.fn(function* () {
          return yield* response((yield* PermissionV2.Service).list())
        }),
      )
      .handle(
        "session.permission.list",
        Effect.fn(function* (ctx) {
          const permission = yield* PermissionV2.Service
          return { data: yield* permission.forSession(ctx.params.sessionID) }
        }),
      )
      .handle(
        "session.permission.reply",
        Effect.fn(function* (ctx) {
          const permission = yield* PermissionV2.Service
          const request = yield* permission.get(ctx.params.requestID)
          if (!request || request.sessionID !== ctx.params.sessionID) return yield* missingRequest(ctx.params.requestID)
          yield* permission
            .reply({ requestID: ctx.params.requestID, reply: ctx.payload.reply, message: ctx.payload.message })
            .pipe(Effect.catchTag("PermissionV2.NotFoundError", () => missingRequest(ctx.params.requestID)))
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle(
        "permission.saved.list",
        Effect.fn(function* (ctx) {
          const location = yield* Location.Service
          const saved = yield* PermissionSaved.Service
          if (ctx.query.scope === "global") return { data: yield* saved.list({ scope: "global" }) }
          const projectID = ctx.query.projectID ?? location.project.id
          if (projectID !== location.project.id && projectID !== ProjectV2.ID.global) return { data: [] }
          return { data: yield* saved.list({ scope: "project", projectID }) }
        }),
      )
      .handle(
        "permission.saved.remove",
        Effect.fn(function* (ctx) {
          const location = yield* Location.Service
          const saved = yield* PermissionSaved.Service
          if (ctx.query.scope === "global") yield* saved.remove({ id: ctx.params.id, scope: "global" })
          else {
            const projectID = ctx.query.projectID ?? location.project.id
            if (projectID === location.project.id || projectID === ProjectV2.ID.global)
              yield* saved.remove({ id: ctx.params.id, scope: "project", projectID })
          }
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle(
        "permission.saved.clear",
        Effect.fn(function* (ctx) {
          const location = yield* Location.Service
          const saved = yield* PermissionSaved.Service
          if (ctx.payload.scope === "global") return { data: yield* saved.clear({ scope: "global" }) }
          const projectID = ctx.payload.projectID ?? location.project.id
          if (projectID !== location.project.id && projectID !== ProjectV2.ID.global) return { data: 0 }
          return { data: yield* saved.clear({ scope: "project", projectID }) }
        }),
      )
      .handle(
        "session.permission.saved.list",
        Effect.fn(function* (ctx) {
          return {
            data: yield* (yield* PermissionSaved.Service).list({ scope: "session", sessionID: ctx.params.sessionID }),
          }
        }),
      )
      .handle(
        "session.permission.saved.remove",
        Effect.fn(function* (ctx) {
          yield* (yield* PermissionSaved.Service).remove({
            id: ctx.params.id,
            scope: "session",
            sessionID: ctx.params.sessionID,
          })
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle(
        "session.permission.saved.clear",
        Effect.fn(function* (ctx) {
          return {
            data: yield* (yield* PermissionSaved.Service).clear({
              scope: "session",
              sessionID: ctx.params.sessionID,
            }),
          }
        }),
      )
  }),
)
