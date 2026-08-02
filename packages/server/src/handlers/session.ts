import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionControl } from "@slopcode-ai/core/session/control"
import { SessionRuntime } from "@slopcode-ai/core/session/runtime"
import { DateTime, Effect, Option } from "effect"
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi"
import { Api } from "../api"
import { SessionsCursor } from "../groups/session"
import {
  ConflictError,
  InvalidCursorError,
  ServiceUnavailableError,
  SessionNotFoundError,
  UnknownError,
} from "../errors"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { RouteLocationContext } from "../middleware/route-location"

const DefaultSessionsLimit = 50

export const SessionHandler = HttpApiBuilder.group(Api, "server.session", (handlers) =>
  Effect.gen(function* () {
    const session = yield* SessionV2.Service
    const control = yield* SessionControl.Service
    const runtime = yield* SessionRuntime.Service

    const routeLocation = Effect.fn("SessionHandler.routeLocation")(function* () {
      const route = yield* Effect.serviceOption(RouteLocationContext)
      return Option.getOrUndefined(route)
    })

    const runtimeUnavailable = (error: { readonly sessionID: string; readonly actualOwner: "v1" | "v2" }) =>
      new ServiceUnavailableError({
        message:
          error.actualOwner === "v1"
            ? `Session ${error.sessionID} is owned by legacy V1 and must be migrated or assigned to V2 before native control`
            : `Session runtime changed for ${error.sessionID}; retry the request`,
        service: "session.runtime",
      })

    return handlers
      .handle(
        "session.list",
        Effect.fn(function* (ctx) {
          const route = yield* routeLocation()
          const query =
            ctx.query.cursor !== undefined
              ? yield* SessionsCursor.parse(ctx.query.cursor).pipe(
                  Effect.mapError(() => new InvalidCursorError({ message: "Invalid cursor" })),
                )
              : ctx.query
          const filters = route
            ? { directory: route.directory, project: undefined, subpath: undefined, workspaceID: route.workspaceID }
            : "directory" in query
              ? {
                  directory: query.directory,
                  project: undefined,
                  subpath: undefined,
                  workspaceID: query.workspace,
                }
              : "project" in query
                ? {
                    directory: undefined,
                    project: query.project,
                    subpath: query.subpath,
                    workspaceID: query.workspace,
                  }
                : {
                    directory: undefined,
                    project: undefined,
                    subpath: undefined,
                    workspaceID: query.workspace,
                  }
          const sessions = yield* session.list({
            ...query,
            ...filters,
            limit: ctx.query.limit ?? DefaultSessionsLimit,
          })
          const first = sessions[0]
          const last = sessions.at(-1)
          return {
            data: sessions,
            cursor: {
              previous: first
                ? SessionsCursor.make({
                    ...query,
                    anchor: {
                      id: first.id,
                      time: DateTime.toEpochMillis(first.time.created),
                      direction: "previous",
                    },
                  })
                : undefined,
              next: last
                ? SessionsCursor.make({
                    ...query,
                    anchor: {
                      id: last.id,
                      time: DateTime.toEpochMillis(last.time.created),
                      direction: "next",
                    },
                  })
                : undefined,
            },
          }
        }),
      )
      .handle(
        "session.create",
        Effect.fn(function* (ctx) {
          const route = yield* routeLocation()
          return {
            data: yield* session.create({
              id: ctx.payload.id,
              agent: ctx.payload.agent,
              model: ctx.payload.model,
              location: route
                ? {
                    directory: AbsolutePath.make(route.directory),
                    workspaceID: route.workspaceID,
                  }
                : (ctx.payload.location ?? { directory: AbsolutePath.make(process.cwd()) }),
              runtime: "v2",
            }),
          }
        }),
      )
      .handle(
        "session.get",
        Effect.fn(function* (ctx) {
          return {
            data: yield* session.get(ctx.params.sessionID).pipe(
              Effect.catchTag(
                "Session.NotFoundError",
                (error) =>
                  new SessionNotFoundError({
                    sessionID: error.sessionID,
                    message: `Session not found: ${error.sessionID}`,
                  }),
              ),
            ),
          }
        }),
      )
      .handle(
        "session.runtime",
        Effect.fn(function* (ctx) {
          const info = yield* runtime.get(ctx.params.sessionID)
          if (!info)
            return yield* new SessionNotFoundError({
              sessionID: ctx.params.sessionID,
              message: `Session not found: ${ctx.params.sessionID}`,
            })
          return { data: info }
        }),
      )
      .handle(
        "session.prompt",
        Effect.fn(function* (ctx) {
          return {
            data: yield* control
              .prompt({
                sessionID: ctx.params.sessionID,
                id: ctx.payload.id,
                prompt: ctx.payload.prompt,
                delivery: ctx.payload.delivery,
                resume: ctx.payload.resume,
              })
              .pipe(
                Effect.catchTag("Session.NotFoundError", (error) =>
                  Effect.fail(
                    new SessionNotFoundError({
                      sessionID: error.sessionID,
                      message: `Session not found: ${error.sessionID}`,
                    }),
                  ),
                ),
                Effect.catchTag("Session.PromptConflictError", (error) =>
                  Effect.fail(
                    new ConflictError({
                      message: `Prompt message ID conflicts with an existing durable record: ${error.messageID}`,
                      resource: error.messageID,
                    }),
                  ),
                ),
                Effect.catchTag("SessionRuntime.NotFound", (error) =>
                  Effect.fail(
                    new SessionNotFoundError({
                      sessionID: error.sessionID,
                      message: `Session not found: ${error.sessionID}`,
                    }),
                  ),
                ),
                Effect.catchTag("SessionRuntime.Mismatch", (error) => Effect.fail(runtimeUnavailable(error))),
              ),
          }
        }),
      )
      .handle(
        "session.compact",
        Effect.fn(function* (ctx) {
          yield* control.compact({ sessionID: ctx.params.sessionID }).pipe(
            Effect.catchTag("Session.NotFoundError", (error) =>
              Effect.fail(
                new SessionNotFoundError({
                  sessionID: error.sessionID,
                  message: `Session not found: ${error.sessionID}`,
                }),
              ),
            ),
            Effect.catchTag("Session.OperationUnavailableError", (error) =>
              Effect.fail(
                new ServiceUnavailableError({
                  message: `Session ${error.operation} is not available yet`,
                  service: `session.${error.operation}`,
                }),
              ),
            ),
            Effect.catchTag("SessionRuntime.NotFound", (error) =>
              Effect.fail(
                new SessionNotFoundError({
                  sessionID: error.sessionID,
                  message: `Session not found: ${error.sessionID}`,
                }),
              ),
            ),
            Effect.catchTag("SessionRuntime.Mismatch", (error) => Effect.fail(runtimeUnavailable(error))),
          )
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle(
        "session.wait",
        Effect.fn(function* (ctx) {
          yield* control.wait(ctx.params.sessionID).pipe(
            Effect.catchTag("Session.NotFoundError", (error) =>
              Effect.fail(
                new SessionNotFoundError({
                  sessionID: error.sessionID,
                  message: `Session not found: ${error.sessionID}`,
                }),
              ),
            ),
            Effect.catchTag("Session.OperationUnavailableError", (error) =>
              Effect.fail(
                new ServiceUnavailableError({
                  message: `Session ${error.operation} is not available yet`,
                  service: `session.${error.operation}`,
                }),
              ),
            ),
            Effect.catchTag("SessionRuntime.NotFound", (error) =>
              Effect.fail(
                new SessionNotFoundError({
                  sessionID: error.sessionID,
                  message: `Session not found: ${error.sessionID}`,
                }),
              ),
            ),
            Effect.catchTag("SessionRuntime.Mismatch", (error) => Effect.fail(runtimeUnavailable(error))),
          )
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle(
        "session.context",
        Effect.fn(function* (ctx) {
          return {
            data: yield* session.context(ctx.params.sessionID).pipe(
              Effect.catchTag("Session.NotFoundError", (error) =>
                Effect.fail(
                  new SessionNotFoundError({
                    sessionID: error.sessionID,
                    message: `Session not found: ${error.sessionID}`,
                  }),
                ),
              ),
              Effect.catchTag("Session.MessageDecodeError", (error) => {
                const ref = `err_${crypto.randomUUID().slice(0, 8)}`
                return Effect.logError("failed to decode session message").pipe(
                  Effect.annotateLogs({ ref, sessionID: error.sessionID, messageID: error.messageID }),
                  Effect.andThen(
                    Effect.fail(
                      new UnknownError({
                        message: "Unexpected server error. Check server logs for details.",
                        ref,
                      }),
                    ),
                  ),
                )
              }),
            ),
          }
        }),
      )
  }),
)
