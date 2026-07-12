export * as MCPOAuth from "./oauth"

import { randomBytes } from "node:crypto"
import { auth } from "@modelcontextprotocol/sdk/client/auth.js"
import { Context, Effect, Layer, Schema } from "effect"
import type { ConfigMCP } from "../config/mcp"
import { MCPOAuthCallback } from "./oauth-callback"
import { MCPOAuthProvider } from "./oauth-provider"
import { MCPOAuthStore } from "./oauth-store"

const DEFAULT_PORT = 19876
const PATH = "/mcp/oauth/callback"
const MAX_AGE = 10 * 60 * 1000

export type AttemptID = `mcp_auth_${string}`
export type AuthStatus =
  | { readonly status: "connected" }
  | { readonly status: "auth-required" }
  | { readonly status: "not-applicable" }
  | {
      readonly status: "authorizing"
      readonly attempts: ReadonlyArray<{
        readonly attemptID: AttemptID
        readonly mode: "auto" | "manual"
        readonly created: number
        readonly expires: number
      }>
    }
  | { readonly status: "failed"; readonly code: string }

export type BeginResult =
  | { readonly status: "connected" }
  | {
      readonly status: "authorizing"
      readonly attemptID: AttemptID
      readonly mode: "auto" | "manual"
      readonly created: number
      readonly expires: number
      readonly authorizationUrl: string
    }

export class AuthError extends Schema.TaggedErrorClass<AuthError>()("MCP.AuthError", {
  code: Schema.Literals([
    "not-applicable",
    "invalid-redirect",
    "callback-unavailable",
    "attempt-invalid",
    "attempt-expired",
    "attempt-cancelled",
    "attempt-used",
    "discovery",
    "exchange",
    "store",
  ]),
  server: Schema.String.pipe(Schema.optional),
  attemptID: Schema.String.pipe(Schema.optional),
  message: Schema.String,
}) {}

export interface Interface {
  readonly status: (target: MCPOAuthStore.Target) => Effect.Effect<AuthStatus, AuthError>
  readonly begin: (input: {
    readonly target: MCPOAuthStore.Target
    readonly config: typeof ConfigMCP.OAuth.Type
    readonly mode?: "auto" | "manual"
  }) => Effect.Effect<BeginResult, AuthError>
  readonly complete: (input: {
    readonly target: MCPOAuthStore.Target
    readonly config: typeof ConfigMCP.OAuth.Type
    readonly attemptID: AttemptID
    readonly code: string
    readonly state: string
  }) => Effect.Effect<AuthStatus, AuthError>
  readonly cancel: (attemptID: AttemptID) => Effect.Effect<void, AuthError>
  readonly remove: (target: MCPOAuthStore.Target) => Effect.Effect<void, AuthError>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/MCPOAuth") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const store = yield* MCPOAuthStore.Service
    const callbacks = yield* MCPOAuthCallback.Service
    const listeners = new Map<string, { close: () => Promise<void> }>()

    const failure = (code: AuthError["code"], target?: MCPOAuthStore.Target, attemptID?: string) =>
      new AuthError({ code, server: target?.name, attemptID, message: `MCP OAuth ${code}` })
    const safe = <A>(effect: Effect.Effect<A, MCPOAuthStore.StoreError>, target?: MCPOAuthStore.Target) =>
      effect.pipe(Effect.mapError(() => failure("store", target)))
    const close = (attemptID: string) =>
      Effect.sync(() => {
        const listener = listeners.get(attemptID)
        listeners.delete(attemptID)
        void listener?.close().catch(() => undefined)
      })
    const terminal = (
      target: MCPOAuthStore.Target,
      attemptID: string,
      phase: "complete" | "cancelled" | "expired" | "failed",
      error?: string,
    ) =>
      safe(
        store.update(target, (entry) => ({
          ...entry,
          attempts: {
            ...entry.attempts,
            [attemptID]: {
              mode: entry.attempts?.[attemptID]?.mode,
              created: entry.attempts?.[attemptID]?.created,
              expires: entry.attempts?.[attemptID]?.expires,
              phase,
              ...(error ? { error } : {}),
            },
          },
        })),
        target,
      ).pipe(Effect.andThen(close(attemptID)), Effect.asVoid)

    const status: Interface["status"] = (target) =>
      safe(store.get(target), target).pipe(
        Effect.flatMap((entry) =>
          Effect.gen(function* () {
            const now = Date.now()
            const attempts = Object.entries(entry.attempts ?? {})
            for (const [id, attempt] of attempts)
              if (attempt.phase === "pending" && (attempt.expires ?? 0) <= now)
                yield* terminal(target, id, "expired", "attempt-expired")
            if (entry.tokens?.access_token) return { status: "connected" } as const
            const live = attempts
              .filter(([, attempt]) => attempt.phase === "pending" && (attempt.expires ?? 0) > now)
              .map(([attemptID, attempt]) => ({
                attemptID: attemptID as AttemptID,
                mode: attempt.mode!,
                created: attempt.created!,
                expires: attempt.expires!,
              }))
              .sort((a, b) => a.created - b.created || a.attemptID.localeCompare(b.attemptID))
            if (live.length) return { status: "authorizing", attempts: live } as const
            const failed = attempts
              .filter(([, attempt]) => attempt.phase === "failed")
              .sort((a, b) => (b[1].created ?? 0) - (a[1].created ?? 0))[0]
            if (failed) return { status: "failed", code: failed[1].error ?? "exchange" } as const
            return { status: "auth-required" } as const
          }),
        ),
      )

    const complete: Interface["complete"] = (input) =>
      Effect.gen(function* () {
        if (!input.code || !input.state) return yield* failure("attempt-invalid", input.target, input.attemptID)
        const claimed = yield* safe(
          store.update(input.target, (entry) => {
            const attempt = entry.attempts?.[input.attemptID]
            if (!attempt || attempt.phase !== "pending" || attempt.state !== input.state) return entry
            return {
              ...entry,
              attempts: { ...entry.attempts, [input.attemptID]: { ...attempt, phase: "exchanging", code: input.code } },
            }
          }),
          input.target,
        )
        const attempt = claimed.attempts?.[input.attemptID]
        if (!attempt) return yield* failure("attempt-invalid", input.target, input.attemptID)
        if ((attempt.expires ?? 0) <= Date.now()) {
          yield* terminal(input.target, input.attemptID, "expired", "attempt-expired")
          return yield* failure("attempt-expired", input.target, input.attemptID)
        }
        if (attempt.phase !== "exchanging" || attempt.code !== input.code)
          return yield* failure("attempt-used", input.target, input.attemptID)
        const provider = MCPOAuthProvider.make({
          store,
          target: input.target,
          attemptID: input.attemptID,
          state: input.state,
          redirectUrl: attempt.redirect!,
          config: input.config,
          onRedirect: async () => {
            throw failure("exchange", input.target, input.attemptID)
          },
        })
        const result = yield* Effect.tryPromise({
          try: (signal) =>
            auth(provider, {
              serverUrl: input.target.endpoint,
              authorizationCode: input.code,
              fetchFn: abortFetch(signal),
            }),
          catch: () => failure("exchange", input.target, input.attemptID),
        }).pipe(Effect.tapError(() => terminal(input.target, input.attemptID, "failed", "exchange")))
        if (result !== "AUTHORIZED") return yield* failure("exchange", input.target, input.attemptID)
        yield* terminal(input.target, input.attemptID, "complete")
        const entry = yield* safe(store.get(input.target), input.target)
        yield* Effect.forEach(
          Object.entries(entry.attempts ?? {}).filter(
            ([id, sibling]) => id !== input.attemptID && sibling.phase === "pending",
          ),
          ([id]) => terminal(input.target, id, "cancelled"),
          { discard: true },
        )
        return { status: "connected" } as const
      })

    const begin: Interface["begin"] = (input) =>
      Effect.gen(function* () {
        const existing = yield* safe(store.get(input.target), input.target)
        if (existing.tokens?.access_token) return { status: "connected" } as const
        const attemptID = `mcp_auth_${randomBytes(16).toString("hex")}` as AttemptID
        const state = randomBytes(32).toString("base64url")
        const created = Date.now()
        const expires = created + MAX_AGE
        const redirect = redirectFor(input.config)
        const requested = input.mode ?? "auto"
        const mode = requested === "auto" && redirect.local ? "auto" : "manual"
        yield* safe(
          store.update(input.target, (entry) => ({
            ...entry,
            attempts: {
              ...entry.attempts,
              [attemptID]: {
                state,
                mode,
                redirect: redirect.url,
                created,
                expires,
                phase: "pending",
              },
            },
          })),
          input.target,
        )
        if (mode === "auto") {
          const listener = yield* Effect.tryPromise({
            try: () =>
              callbacks.register({
                redirect: redirect.url,
                state,
                receive: async (result) => {
                  if (!result.code) {
                    await Effect.runPromise(terminal(input.target, attemptID, "failed", "provider-error"))
                    return
                  }
                  await Effect.runPromise(
                    complete({ ...input, attemptID, code: result.code, state }).pipe(Effect.ignore),
                  )
                },
              }),
            catch: () => failure("callback-unavailable", input.target, attemptID),
          }).pipe(Effect.tapError(() => terminal(input.target, attemptID, "failed", "callback-unavailable")))
          listeners.set(attemptID, listener)
        }
        let authorizationUrl: string | undefined
        const provider = MCPOAuthProvider.make({
          store,
          target: input.target,
          attemptID,
          state,
          redirectUrl: redirect.url,
          config: input.config,
          onRedirect: async (url) => {
            authorizationUrl = url.toString()
          },
        })
        const result = yield* Effect.tryPromise({
          try: (signal) => auth(provider, { serverUrl: input.target.endpoint, fetchFn: abortFetch(signal) }),
          catch: () => failure("discovery", input.target, attemptID),
        }).pipe(Effect.tapError(() => terminal(input.target, attemptID, "failed", "discovery")))
        if (result === "AUTHORIZED") {
          yield* terminal(input.target, attemptID, "complete")
          return { status: "connected" } as const
        }
        if (!authorizationUrl) {
          yield* terminal(input.target, attemptID, "failed", "discovery")
          return yield* failure("discovery", input.target, attemptID)
        }
        return { status: "authorizing", attemptID, mode, created, expires, authorizationUrl } as const
      })

    const cancel: Interface["cancel"] = (attemptID) =>
      safe(store.findAttempt(attemptID)).pipe(
        Effect.flatMap((found) =>
          !found
            ? Effect.fail(failure("attempt-invalid", undefined, attemptID))
            : found.attempt.phase !== "pending"
              ? Effect.fail(failure("attempt-used", found.target, attemptID))
              : terminal(found.target, attemptID, "cancelled"),
        ),
      )
    const remove: Interface["remove"] = (target) =>
      safe(store.get(target), target).pipe(
        Effect.flatMap((entry) =>
          Effect.forEach(Object.keys(entry.attempts ?? {}), close, { discard: true }).pipe(
            Effect.andThen(safe(store.remove(target), target)),
          ),
        ),
      )

    return Service.of({ status, begin, complete, cancel, remove })
  }),
)

function redirectFor(config: typeof ConfigMCP.OAuth.Type) {
  const value = config.redirect_uri ?? `http://127.0.0.1:${config.callback_port ?? DEFAULT_PORT}${PATH}`
  const url = new URL(value)
  if (config.callback_port !== undefined && url.port && Number(url.port) !== config.callback_port)
    throw new AuthError({ code: "invalid-redirect", message: "MCP OAuth invalid-redirect" })
  const local = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "[::1]")
  if (local && (!url.port || url.search || url.hash || url.username || url.password))
    throw new AuthError({ code: "invalid-redirect", message: "MCP OAuth invalid-redirect" })
  return { url: url.toString(), local }
}

function abortFetch(signal: AbortSignal) {
  return (input: string | URL | Request, init?: RequestInit) => fetch(input, { ...init, signal })
}
