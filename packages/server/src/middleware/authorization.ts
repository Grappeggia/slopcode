import { ServerAuth } from "../auth"
import { UnauthorizedError } from "../errors"
import { Effect, Encoding, Layer, Redacted } from "effect"
import { HttpEffect, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApiMiddleware } from "effect/unstable/httpapi"
import { hasPtyConnectTicketURL } from "../groups/pty"

const AUTH_TOKEN_QUERY = "auth_token"
const WWW_AUTHENTICATE = 'Basic realm="Secure Area"'
const REMOTE_TARGET_CAPABILITY_HEADER = "x-slopcode-remote-capability"

export class Authorization extends HttpApiMiddleware.Service<Authorization>()("@slopcode/HttpApiAuthorization", {
  error: UnauthorizedError,
}) {}

function emptyCredential() {
  return { username: "", password: Redacted.make("") }
}

function decodeCredential(input: string) {
  return Effect.fromResult(Encoding.decodeBase64String(input)).pipe(
    Effect.match({
      onFailure: emptyCredential,
      onSuccess: (header) => {
        const separator = header.indexOf(":")
        if (separator === -1) return emptyCredential()
        return { username: header.slice(0, separator), password: Redacted.make(header.slice(separator + 1)) }
      },
    }),
  )
}

function credentialFromRequest(request: HttpServerRequest.HttpServerRequest) {
  const url = new URL(request.url, "http://localhost")
  const token = url.searchParams.get(AUTH_TOKEN_QUERY)
  if (token) return decodeCredential(token)
  const match = /^Basic\s+(.+)$/i.exec(request.headers.authorization ?? "")
  if (match) return decodeCredential(match[1])
  const capability = request.headers[REMOTE_TARGET_CAPABILITY_HEADER]
  if (capability && capability.length <= 1024 && !/[\r\n]/.test(capability)) {
    return Effect.succeed({ username: "slopcode", password: Redacted.make(capability) })
  }
  return Effect.succeed(emptyCredential())
}

function ticketMayBypassAuth(url: URL, request: HttpServerRequest.HttpServerRequest) {
  if (!hasPtyConnectTicketURL(url)) return false
  // A workspace target keeps its routing identity in process env, but that is
  // not a client-supplied workspace selector. The PTY handler still consumes
  // the ticket against its exact PTY/directory/workspace scope.
  if (
    url.searchParams.get("workspace") ||
    url.searchParams.get("location[workspace]") ||
    request.headers["x-slopcode-workspace"]
  ) {
    return false
  }
  return true
}

export const authorizationLayer = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const config = yield* ServerAuth.Config
    if (!ServerAuth.required(config)) return Authorization.of((effect) => effect)
    return Authorization.of((effect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        if (ticketMayBypassAuth(new URL(request.url, "http://localhost"), request)) return yield* effect
        const credential = yield* credentialFromRequest(request)
        if (ServerAuth.authorized(credential, config)) return yield* effect
        yield* HttpEffect.appendPreResponseHandler((_request, response) =>
          Effect.succeed(HttpServerResponse.setHeader(response, "www-authenticate", WWW_AUTHENTICATE)),
        )
        return yield* new UnauthorizedError({ message: "Authentication required" })
      }),
    )
  }),
)
