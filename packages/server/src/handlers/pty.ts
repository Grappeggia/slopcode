import { Pty } from "@slopcode-ai/core/pty"
import { PtyTicket } from "@slopcode-ai/core/pty/ticket"
import { Location } from "@slopcode-ai/core/location"
import { Effect, Option, Schema } from "effect"
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi"
import * as Socket from "effect/unstable/socket/Socket"
import { Api } from "../api"
import { ForbiddenError, PtyNotFoundError } from "../errors"
import { response } from "../groups/location"
import { PTY_CONNECT_TICKET_QUERY } from "../groups/pty"

const CursorQuery = Schema.Struct({
  cursor: Schema.optional(Schema.String),
})

function missing(ptyID: string) {
  return new PtyNotFoundError({ ptyID, message: `PTY session not found: ${ptyID}` })
}

const prepareCreate = (input: typeof Pty.CreateInput.Type, directory: string): Pty.PreparedCreate => ({
  command:
    input.command ||
    (process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : process.env.SHELL || "/bin/sh"),
  args: input.args ? [...input.args] : [],
  cwd: directory,
  title: input.title,
  env: Object.fromEntries(
    Object.entries(input.env ? { ...process.env, ...input.env } : process.env).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, value]],
    ),
  ),
})

export const PtyHandler = HttpApiBuilder.group(Api, "server.pty", (handlers) =>
  Effect.gen(function* () {
    const tickets = yield* PtyTicket.Service
    const toFrame = (data: string | Uint8Array | ArrayBuffer) =>
      typeof data === "string" ? data : data instanceof Uint8Array ? data : new Uint8Array(data)
    const toMessage = (data: string | Uint8Array) => (typeof data === "string" ? data : new Uint8Array(data).slice().buffer)

    const pty = Effect.fn("PtyHandler.pty")(function* <A, E>(effect: Effect.Effect<A, E, Pty.Service>) {
      return yield* effect
    })

    return handlers
      .handle("pty.list", () => response(pty(Pty.Service.use((service) => service.list()))))
      .handle(
        "pty.create",
        Effect.fn(function* (ctx) {
          const location = yield* Location.Service
          return yield* response(
            pty(Pty.Service.use((service) => service.create(prepareCreate(ctx.payload, location.directory)))),
          )
        }),
      )
      .handle(
        "pty.get",
        Effect.fn(function* (ctx) {
          return yield* response(pty(Pty.Service.use((service) => service.get(ctx.params.ptyID))).pipe(
            Effect.catchTag("Pty.NotFoundError", () => Effect.fail(missing(ctx.params.ptyID))),
          ))
        }),
      )
      .handle(
        "pty.update",
        Effect.fn(function* (ctx) {
          return yield* response(
            pty(
              Pty.Service.use((service) =>
                service.update(ctx.params.ptyID, {
                  ...ctx.payload,
                  size: ctx.payload.size ? { ...ctx.payload.size } : undefined,
                }),
              ),
            ).pipe(Effect.catchTag("Pty.NotFoundError", () => Effect.fail(missing(ctx.params.ptyID)))),
          )
        }),
      )
      .handle(
        "pty.remove",
        Effect.fn(function* (ctx) {
          yield* pty(Pty.Service.use((service) => service.remove(ctx.params.ptyID))).pipe(
            Effect.catchTag("Pty.NotFoundError", () => Effect.fail(missing(ctx.params.ptyID))),
          )
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle(
        "pty.connectToken",
        Effect.fn(function* (ctx) {
          yield* pty(Pty.Service.use((service) => service.get(ctx.params.ptyID))).pipe(
            Effect.catchTag("Pty.NotFoundError", () => Effect.fail(missing(ctx.params.ptyID))),
          )
          const request = yield* HttpServerRequest.HttpServerRequest
          const location = yield* Location.Service
          if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`)
            return yield* new ForbiddenError({ message: "Invalid PTY connect token request" })
          return yield* response(
            tickets.issue({
              ptyID: ctx.params.ptyID,
              directory: location.directory,
              workspaceID: location.workspaceID,
            }),
          )
        }),
      )
      .handleRaw(
        "pty.connect",
        Effect.fn(function* (ctx) {
          const exists = yield* pty(Pty.Service.use((service) => service.get(ctx.params.ptyID))).pipe(
            Effect.as(true),
            Effect.catchTag("Pty.NotFoundError", () => Effect.succeed(false)),
          )
          if (!exists) return HttpServerResponse.empty({ status: 404 })
          const query = Schema.decodeUnknownOption(CursorQuery)(yield* HttpServerRequest.ParsedSearchParams)
          if (Option.isNone(query)) return HttpServerResponse.empty({ status: 400 })
          const location = yield* Location.Service
          const ticket = new URL(ctx.request.url, "http://localhost").searchParams.get(PTY_CONNECT_TICKET_QUERY)
          if (ticket) {
            const valid = yield* tickets.consume({
              ticket,
              ptyID: ctx.params.ptyID,
              directory: location.directory,
              workspaceID: location.workspaceID,
            })
            if (!valid) return HttpServerResponse.empty({ status: 403 })
          }
          const parsedCursor = query.value.cursor === undefined ? undefined : Number(query.value.cursor)
          const cursor =
            parsedCursor !== undefined && Number.isSafeInteger(parsedCursor) && parsedCursor >= -1
              ? parsedCursor
              : undefined
          const socket = yield* Effect.orDie(ctx.request.upgrade)
          const write = yield* socket.writer
          const handler = yield* pty(Pty.Service.use((service) => service.connect(ctx.params.ptyID, {
            get readyState() {
              return 1
            },
            send(data) {
              Effect.runFork(write(toFrame(data)).pipe(Effect.catch(() => Effect.void)))
            },
            close(code?: number, reason?: string) {
              Effect.runFork(write(new Socket.CloseEvent(code, reason)).pipe(Effect.catch(() => Effect.void)))
            },
          }, cursor))).pipe(
            Effect.catchTag("Pty.NotFoundError", () => Effect.succeed(undefined)),
          )
          if (!handler) return HttpServerResponse.empty()
          yield* socket.runRaw((message) => handler.onMessage(toMessage(message))).pipe(
            Effect.catchReason("SocketError", "SocketCloseError", () => Effect.void),
            Effect.ensuring(Effect.sync(handler.onClose)),
            Effect.orDie,
          )
          return HttpServerResponse.empty()
        }),
      )
  }),
)
