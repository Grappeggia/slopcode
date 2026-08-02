import { NodeHttpServer } from "@effect/platform-node"
import { describe, expect } from "bun:test"
import { Effect, Layer, Option, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpRouter } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiError, HttpApiGroup } from "effect/unstable/httpapi"
import { PtyID } from "@slopcode-ai/core/pty/schema"
import { PtyTicket } from "@slopcode-ai/core/pty/ticket"
import { WorkspaceV2 } from "@slopcode-ai/core/workspace"
import { ServerAuth } from "../../src/server/auth"
import {
  Authorization,
  authorizationLayer,
  ptyConnectAuthorizationLayer,
  PtyConnectAuthorization,
  ServerAuthorization,
  serverAuthorizationLayer,
} from "../../src/server/routes/instance/httpapi/middleware/authorization"
import { testEffect } from "../lib/effect"

const Api = HttpApi.make("test-authorization").add(
  HttpApiGroup.make("test")
    .add(
      HttpApiEndpoint.get("probe", "/probe", {
        success: Schema.String,
      }),
      HttpApiEndpoint.get("missing", "/missing", {
        success: Schema.String,
        error: HttpApiError.NotFound,
      }),
    )
    .middleware(Authorization),
)

const ServerApi = HttpApi.make("test-server-authorization").add(
  HttpApiGroup.make("test.v2")
    .add(
      HttpApiEndpoint.get("probe", "/api/probe", {
        success: Schema.String,
      }),
    )
    .middleware(ServerAuthorization),
)

const handlers = HttpApiBuilder.group(Api, "test", (handlers) =>
  handlers
    .handle("probe", () => Effect.succeed("ok"))
    .handle("missing", () => Effect.fail(new HttpApiError.NotFound({}))),
)

const serverHandlers = HttpApiBuilder.group(ServerApi, "test.v2", (handlers) =>
  handlers.handle("probe", () => Effect.succeed("ok")),
)

const apiLayer = HttpRouter.serve(
  HttpApiBuilder.layer(Api).pipe(Layer.provide(handlers), Layer.provide(authorizationLayer)),
  { disableListenLog: true, disableLogger: true },
).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

const v2ApiLayer = HttpRouter.serve(
  HttpApiBuilder.layer(ServerApi).pipe(Layer.provide(serverHandlers), Layer.provide(serverAuthorizationLayer)),
  { disableListenLog: true, disableLogger: true },
).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

const ticketDirectory = "/remote/workspace"
const ticketWorkspaceID = WorkspaceV2.ID.ascending()
const TicketQuery = Schema.Struct({
  ticket: Schema.String,
  workspace: Schema.optional(Schema.String),
})
const TicketApi = HttpApi.make("test-pty-ticket-authorization").add(
  HttpApiGroup.make("serverPty")
    .add(
      HttpApiEndpoint.get("connect", "/api/pty/:ptyID/connect", {
        params: { ptyID: PtyID },
        query: TicketQuery,
        success: Schema.Boolean,
      }),
    )
    .middleware(ServerAuthorization),
  HttpApiGroup.make("experimentalPty")
    .add(
      HttpApiEndpoint.get("connect", "/pty/:ptyID/connect", {
        params: { ptyID: PtyID },
        query: TicketQuery,
        success: Schema.Boolean,
      }),
    )
    .middleware(PtyConnectAuthorization),
)

type TicketContext = {
  readonly params: { readonly ptyID: PtyID }
  readonly query: { readonly ticket: string }
}

const consumeTicket = (ctx: TicketContext) =>
  Effect.gen(function* () {
    const tickets = yield* PtyTicket.Service
    return yield* tickets.consume({
      ticket: ctx.query.ticket,
      ptyID: ctx.params.ptyID,
      directory: ticketDirectory,
      workspaceID: ticketWorkspaceID,
    })
  })

const ticketHandlers = Layer.mergeAll(
  HttpApiBuilder.group(TicketApi, "serverPty", (handlers) => handlers.handle("connect", consumeTicket)),
  HttpApiBuilder.group(TicketApi, "experimentalPty", (handlers) => handlers.handle("connect", consumeTicket)),
)

const ticketApiLayer = HttpRouter.serve(
  HttpApiBuilder.layer(TicketApi).pipe(
    Layer.provide(ticketHandlers),
    Layer.provide(serverAuthorizationLayer),
    Layer.provide(ptyConnectAuthorizationLayer),
  ),
  { disableListenLog: true, disableLogger: true },
).pipe(Layer.provideMerge(PtyTicket.layer), Layer.provideMerge(NodeHttpServer.layerTest))

const noAuthLayer = ServerAuth.Config.layer({ password: Option.none(), username: "slopcode" })
const secretLayer = ServerAuth.Config.layer({ password: Option.some("secret"), username: "slopcode" })
const kitSecretLayer = ServerAuth.Config.layer({ password: Option.some("secret"), username: "kit" })

const it = testEffect(apiLayer.pipe(Layer.provide(noAuthLayer)))
const itSecret = testEffect(apiLayer.pipe(Layer.provide(secretLayer)))
const itKitSecret = testEffect(apiLayer.pipe(Layer.provide(kitSecretLayer)))
const itV2Secret = testEffect(v2ApiLayer.pipe(Layer.provide(secretLayer)))
const itPtyTicket = testEffect(ticketApiLayer.pipe(Layer.provide(secretLayer)))

const basic = (username: string, password: string) => ServerAuth.header({ username, password }) ?? ""

const token = (username: string, password: string) => Buffer.from(`${username}:${password}`).toString("base64")

const getProbe = (headers?: Record<string, string>) =>
  HttpClientRequest.get("/probe").pipe(
    headers ? HttpClientRequest.setHeaders(headers) : (request) => request,
    HttpClient.execute,
  )

const getTicketConnect = (path: string, ticket: string, workspace?: string) =>
  HttpClient.get(
    `${path}?ticket=${encodeURIComponent(ticket)}${workspace ? `&workspace=${encodeURIComponent(workspace)}` : ""}`,
  )

describe("HttpApi authorization middleware", () => {
  it.live("allows requests when server password is not configured", () =>
    Effect.gen(function* () {
      const response = yield* getProbe()

      expect(response.status).toBe(200)
      expect(yield* response.json).toBe("ok")
    }),
  )

  itSecret.live("requires configured password for basic auth", () =>
    Effect.gen(function* () {
      const [missing, badPassword, good] = yield* Effect.all(
        [
          getProbe(),
          getProbe({ authorization: basic("slopcode", "wrong") }),
          getProbe({ authorization: basic("slopcode", "secret") }),
        ],
        { concurrency: "unbounded" },
      )

      expect(missing.status).toBe(401)
      expect(missing.headers["www-authenticate"] ?? "").toContain("Basic")
      expect(badPassword.status).toBe(401)
      expect(badPassword.headers["www-authenticate"] ?? "").toContain("Basic")
      expect(good.status).toBe(200)
    }),
  )

  itKitSecret.live("respects configured basic auth username", () =>
    Effect.gen(function* () {
      const [defaultUser, configuredUser] = yield* Effect.all(
        [getProbe({ authorization: basic("slopcode", "secret") }), getProbe({ authorization: basic("kit", "secret") })],
        { concurrency: "unbounded" },
      )

      expect(defaultUser.status).toBe(401)
      expect(configuredUser.status).toBe(200)
    }),
  )

  itSecret.live("accepts auth token query credentials", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(`/probe?auth_token=${encodeURIComponent(token("slopcode", "secret"))}`)

      expect(response.status).toBe(200)
    }),
  )

  itSecret.live("accepts an internal remote-target capability", () =>
    Effect.gen(function* () {
      const response = yield* getProbe({ "x-slopcode-remote-capability": "secret" })

      expect(response.status).toBe(200)
    }),
  )

  itSecret.live("prefers auth token query credentials over basic auth", () =>
    Effect.gen(function* () {
      const response = yield* HttpClientRequest.get(
        `/probe?auth_token=${encodeURIComponent(token("slopcode", "secret"))}`,
      ).pipe(HttpClientRequest.setHeader("authorization", basic("slopcode", "wrong")), HttpClient.execute)

      expect(response.status).toBe(200)
    }),
  )

  itSecret.live("preserves handler errors when basic auth succeeds", () =>
    Effect.gen(function* () {
      const response = yield* HttpClientRequest.get("/missing").pipe(
        HttpClientRequest.setHeader("authorization", basic("slopcode", "secret")),
        HttpClient.execute,
      )

      expect(response.status).toBe(404)
    }),
  )

  itSecret.live("preserves handler errors when auth token query succeeds", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(`/missing?auth_token=${encodeURIComponent(token("slopcode", "secret"))}`)

      expect(response.status).toBe(404)
    }),
  )

  itSecret.live("rejects malformed auth token query credentials", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get("/probe?auth_token=not-base64")

      expect(response.status).toBe(401)
    }),
  )

  itV2Secret.live("returns bodyful v2 unauthorized errors", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get("/api/probe")
      const body = yield* response.json

      expect(response.status).toBe(401)
      expect(response.headers["www-authenticate"] ?? "").toContain("Basic")
      expect(body).toEqual({ _tag: "UnauthorizedError", message: "Authentication required" })
    }),
  )

  itV2Secret.live("accepts an internal remote-target capability", () =>
    Effect.gen(function* () {
      const response = yield* HttpClientRequest.get("/api/probe").pipe(
        HttpClientRequest.setHeader("x-slopcode-remote-capability", "secret"),
        HttpClient.execute,
      )

      expect(response.status).toBe(200)
    }),
  )

  itPtyTicket.live("accepts exact one-time tickets for both remote PTY routes", () =>
    Effect.gen(function* () {
      const previousWorkspaceID = process.env.SLOPCODE_WORKSPACE_ID
      process.env.SLOPCODE_WORKSPACE_ID = ticketWorkspaceID
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          if (previousWorkspaceID === undefined) delete process.env.SLOPCODE_WORKSPACE_ID
          else process.env.SLOPCODE_WORKSPACE_ID = previousWorkspaceID
        }),
      )

      const ptyID = PtyID.ascending()
      const issue = (input: PtyTicket.Scope) =>
        Effect.gen(function* () {
          const tickets = yield* PtyTicket.Service
          return yield* tickets.issue(input)
        })

      const check = (path: string) =>
        Effect.gen(function* () {
          const selectorTicket = yield* issue({ ptyID, directory: ticketDirectory, workspaceID: ticketWorkspaceID })
          const selected = yield* getTicketConnect(path, selectorTicket.ticket, ticketWorkspaceID)
          expect(selected.status).toBe(401)

          const wrongPty = yield* issue({
            ptyID: PtyID.ascending(),
            directory: ticketDirectory,
            workspaceID: ticketWorkspaceID,
          })
          const wrongPtyResponse = yield* getTicketConnect(path, wrongPty.ticket)
          expect(wrongPtyResponse.status).toBe(200)
          expect(yield* wrongPtyResponse.json).toBe(false)

          const wrongDirectory = yield* issue({ ptyID, directory: "/other/workspace", workspaceID: ticketWorkspaceID })
          const wrongDirectoryResponse = yield* getTicketConnect(path, wrongDirectory.ticket)
          expect(wrongDirectoryResponse.status).toBe(200)
          expect(yield* wrongDirectoryResponse.json).toBe(false)

          const wrongWorkspace = yield* issue({
            ptyID,
            directory: ticketDirectory,
            workspaceID: WorkspaceV2.ID.ascending(),
          })
          const wrongWorkspaceResponse = yield* getTicketConnect(path, wrongWorkspace.ticket)
          expect(wrongWorkspaceResponse.status).toBe(200)
          expect(yield* wrongWorkspaceResponse.json).toBe(false)

          const exact = yield* issue({ ptyID, directory: ticketDirectory, workspaceID: ticketWorkspaceID })
          const connected = yield* getTicketConnect(path, exact.ticket)
          expect(connected.status).toBe(200)
          expect(yield* connected.json).toBe(true)

          const replay = yield* getTicketConnect(path, exact.ticket)
          expect(replay.status).toBe(200)
          expect(yield* replay.json).toBe(false)
        })

      yield* check(`/api/pty/${ptyID}/connect`)
      yield* check(`/pty/${ptyID}/connect`)
    }),
  )
})
