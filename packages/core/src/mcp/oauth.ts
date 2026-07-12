export * as MCPOAuth from "./oauth"

import { randomBytes } from "node:crypto"
import { auth } from "@modelcontextprotocol/sdk/client/auth.js"
import { Context, Effect, Layer, Schema } from "effect"
import type { ConfigMCP } from "../config/mcp"
import { Flock } from "../util/flock"
import { MCPOAuthCallback } from "./oauth-callback"
import { MCPOAuthProvider } from "./oauth-provider"
import { MCPOAuthStore } from "./oauth-store"

const DEFAULT_PORT = 19876
const PATH = "/mcp/oauth/callback"
const MAX_AGE = 10 * 60 * 1000

export type AttemptID = `mcp_auth_${string}`
export type AuthStatus =
  | { readonly status: "connected" }
  | { readonly status: "credential-ready" }
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
  | { readonly status: "credential-ready" }
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
  readonly reset: (target: MCPOAuthStore.Target) => Effect.Effect<void, AuthError>
  readonly stop: (target: MCPOAuthStore.Target) => Effect.Effect<void, AuthError>
  readonly recover: (input: {
    readonly target: MCPOAuthStore.Target
    readonly config: typeof ConfigMCP.OAuth.Type
  }) => Effect.Effect<void, AuthError>
  readonly onComplete: (handler: (target: MCPOAuthStore.Target) => void) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/MCPOAuth") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const store = yield* MCPOAuthStore.Service
    const callbacks = yield* MCPOAuthCallback.Service
    const listeners = new Map<string, { close: () => Promise<void> }>()
    const owned = new Set<string>()
    const completions = new Set<(target: MCPOAuthStore.Target) => void>()

    const failure = (code: AuthError["code"], target?: MCPOAuthStore.Target, attemptID?: string) =>
      new AuthError({ code, server: target?.name, attemptID, message: `MCP OAuth ${code}` })
    const safe = <A>(effect: Effect.Effect<A, MCPOAuthStore.StoreError>, target?: MCPOAuthStore.Target) =>
      effect.pipe(Effect.mapError(() => failure("store", target)))
    const close = (attemptID: string) =>
      Effect.sync(() => {
        const listener = listeners.get(attemptID)
        listeners.delete(attemptID)
        owned.delete(attemptID)
        void listener?.close().catch(() => undefined)
      })
    const terminal = (
      target: MCPOAuthStore.Target,
      attemptID: string,
      phase: "complete" | "cancelled" | "expired" | "failed",
      error?: string,
    ) =>
      phase === "complete" || phase === "cancelled"
        ? close(attemptID)
        : safe(store.finishAttempt(target, attemptID, phase, error ?? phase), target).pipe(
            Effect.andThen(close(attemptID)),
            Effect.asVoid,
          )

    const status: Interface["status"] = (target) =>
      safe(store.get(target), target).pipe(
        Effect.flatMap((entry) =>
          Effect.gen(function* () {
            const now = Date.now()
            const attempts = Object.entries(entry.attempts ?? {})
            for (const [id, attempt] of attempts)
              if (attempt.phase === "pending" && (attempt.expires ?? 0) <= now)
                yield* terminal(target, id, "expired", "attempt-expired")
            if (usable(entry)) return { status: "credential-ready" } as const
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

    const finish = (input: Parameters<Interface["complete"]>[0], recovered = false) =>
      Effect.gen(function* () {
        if (!input.code || !input.state) return yield* failure("attempt-invalid", input.target, input.attemptID)
        if (!recovered) {
          const claim = yield* safe(store.claimAttempt(input.attemptID, input.state, input.code, Date.now()), input.target)
          if (claim.status === "expired") return yield* failure("attempt-expired", input.target, input.attemptID)
          if (claim.status !== "claimed" || JSON.stringify(claim.target) !== JSON.stringify(input.target))
            return yield* failure(claim.status === "invalid" ? "attempt-invalid" : "attempt-used", input.target, input.attemptID)
        }
        yield* close(input.attemptID)
        const attempt = yield* safe(store.startExchange(input.target, input.attemptID, input.code), input.target)
        if (!attempt) return yield* failure("attempt-used", input.target, input.attemptID)
        let tokens: import("@modelcontextprotocol/sdk/shared/auth.js").OAuthTokens | undefined
        const provider = MCPOAuthProvider.make({
          store,
          target: input.target,
          attemptID: input.attemptID,
          state: input.state,
          redirectUrl: attempt.redirect!,
          compatibility: MCPOAuthProvider.compatibility(input.target.endpoint, input.config, attempt.redirect!),
          config: input.config,
          onRedirect: async () => {
            throw failure("exchange", input.target, input.attemptID)
          },
          saveTokens: async (value) => {
            tokens = value
          },
        })
        const result = yield* Effect.tryPromise({
          try: (signal) =>
            Flock.withLock(
              `mcp-oauth-exchange:${JSON.stringify(input.target)}`,
              async () => {
                const latest = await Effect.runPromise(store.findAttempt(input.attemptID))
                if (latest?.attempt.phase !== "exchanging") return "LOST" as const
                return auth(provider, {
                  serverUrl: input.target.endpoint,
                  authorizationCode: input.code,
                  fetchFn: abortFetch(signal),
                })
              },
              { signal },
            ),
          catch: () => failure("exchange", input.target, input.attemptID),
        }).pipe(
          Effect.tapError(() =>
            safe(store.finishAttempt(input.target, input.attemptID, "failed", "exchange", ["exchanging"]), input.target),
          ),
        )
        if (result === "LOST") return yield* failure("attempt-used", input.target, input.attemptID)
        if (result !== "AUTHORIZED") return yield* failure("exchange", input.target, input.attemptID)
        if (!tokens || !(yield* safe(store.finishExchange(input.target, input.attemptID, tokens), input.target)))
          return yield* failure("attempt-used", input.target, input.attemptID)
        yield* close(input.attemptID)
        return { status: "credential-ready" } as const
      })
    const complete: Interface["complete"] = (input) => finish(input)

    const begin: Interface["begin"] = (input) =>
      Effect.gen(function* () {
        const existing = yield* safe(store.get(input.target), input.target)
        const redirect = redirectFor(input.config)
        const compatibility = MCPOAuthProvider.compatibility(input.target.endpoint, input.config, redirect.url)
        if (existing.compatibility === compatibility && usable(existing))
          return { status: "credential-ready" } as const
        if (existing.compatibility && existing.compatibility !== compatibility)
          yield* safe(store.cancelTarget(input.target, true), input.target)
        const attemptID = `mcp_auth_${randomBytes(16).toString("hex")}` as AttemptID
        const state = randomBytes(32).toString("base64url")
        const created = Date.now()
        const expires = created + MAX_AGE
        const requested = input.mode ?? "auto"
        const mode = requested === "auto" && redirect.local ? "auto" : "manual"
        yield* safe(
          store.update(input.target, (entry) => ({
            ...entry,
            compatibility,
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
        owned.add(attemptID)
        if (mode === "auto") {
          const listener = yield* Effect.tryPromise({
            try: () =>
              callbacks.register({
                redirect: redirect.url,
                state,
                receive: async (result) => {
                  if (!result.code) {
                    await Effect.runPromise(terminal(input.target, attemptID, "failed", "provider-error"))
                    return true
                  }
                  const completed = await Effect.runPromiseExit(complete({ ...input, attemptID, code: result.code, state }))
                  if (completed._tag !== "Success") return false
                  completions.forEach((handler) => handler(input.target))
                  return true
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
          compatibility,
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
          return { status: "credential-ready" } as const
        }
        if (!authorizationUrl) {
          yield* terminal(input.target, attemptID, "failed", "discovery")
          return yield* failure("discovery", input.target, attemptID)
        }
        return { status: "authorizing", attemptID, mode, created, expires, authorizationUrl } as const
      })

    const cancel: Interface["cancel"] = (attemptID) =>
      safe(store.cancelAttempt(attemptID)).pipe(
        Effect.flatMap((result) =>
          result.status === "cancelled"
            ? close(attemptID)
            : Effect.fail(failure(result.status === "missing" ? "attempt-invalid" : "attempt-used", undefined, attemptID)),
        ),
      )
    const remove: Interface["remove"] = (target) =>
      safe(store.get(target), target).pipe(
        Effect.flatMap((entry) =>
          Effect.forEach(Object.keys(entry.attempts ?? {}), close, { discard: true }).pipe(
            Effect.andThen(safe(store.cancelTarget(target, true), target)),
            Effect.andThen(safe(store.remove(target), target)),
          ),
        ),
      )
    const reset: Interface["reset"] = (target) =>
      safe(store.get(target), target).pipe(
        Effect.flatMap((entry) =>
          Effect.forEach(Object.keys(entry.attempts ?? {}), close, { discard: true }).pipe(
            Effect.andThen(safe(store.cancelTarget(target, true), target)),
          ),
        ),
      )
    const stop: Interface["stop"] = (target) =>
      safe(store.get(target), target).pipe(
        Effect.flatMap((entry) =>
          Effect.forEach(Object.keys(entry.attempts ?? {}), close, { discard: true }).pipe(
            Effect.andThen(safe(store.cancelTarget(target), target)),
          ),
        ),
      )

    const recover: Interface["recover"] = (input) =>
      safe(store.get(input.target), input.target).pipe(
        Effect.flatMap((entry) =>
          Effect.forEach(
            Object.entries(entry.attempts ?? {}),
            ([attemptID, attempt]) => {
              if (["pending", "received", "exchanging"].includes(attempt.phase ?? "")) owned.add(attemptID)
              if (attempt.phase === "exchanging")
                return terminal(input.target, attemptID, "failed", "indeterminate-exchange")
              if (attempt.phase === "received" && attempt.code && attempt.state)
                return finish({
                  target: input.target,
                  config: input.config,
                  attemptID: attemptID as AttemptID,
                  code: attempt.code,
                  state: attempt.state,
                }, true).pipe(Effect.asVoid)
              if (attempt.phase !== "pending") return Effect.void
              if ((attempt.expires ?? 0) <= Date.now())
                return terminal(input.target, attemptID, "expired", "attempt-expired")
              if (attempt.mode !== "auto" || !attempt.redirect || !attempt.state) return Effect.void
              return Effect.tryPromise({
                try: () =>
                  callbacks.register({
                    redirect: attempt.redirect!,
                    state: attempt.state!,
                    receive: async (result) => {
                      if (!result.code) {
                        await Effect.runPromise(terminal(input.target, attemptID, "failed", "provider-error"))
                        return true
                      }
                      const completed = await Effect.runPromiseExit(
                        complete({
                          target: input.target,
                          config: input.config,
                          attemptID: attemptID as AttemptID,
                          code: result.code,
                          state: attempt.state!,
                        }),
                      )
                      if (completed._tag !== "Success") return false
                      completions.forEach((handler) => handler(input.target))
                      return true
                    },
                  }),
                catch: () => failure("callback-unavailable", input.target, attemptID),
              }).pipe(
                Effect.tap((listener) => Effect.sync(() => listeners.set(attemptID, listener))),
                Effect.catch(() => terminal(input.target, attemptID, "failed", "callback-unavailable")),
                Effect.asVoid,
              )
            },
            { discard: true },
          ),
        ),
      )

    yield* Effect.addFinalizer(() =>
      Effect.forEach(
        [...owned],
        (attemptID) =>
          safe(store.findAttempt(attemptID)).pipe(
            Effect.flatMap((found) =>
              found?.attempt.phase === "pending" ? cancel(attemptID as AttemptID) : close(attemptID),
            ),
            Effect.ignore,
          ),
        { discard: true },
      ),
    )

    return Service.of({
      status,
      begin,
      complete,
      cancel,
      remove,
      reset,
      stop,
      recover,
      onComplete: (handler) => Effect.sync(() => completions.add(handler)).pipe(Effect.asVoid),
    })
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
  return (input: string | URL | Request, init?: RequestInit) => fetch(input, { ...init, signal: merge(signal, init?.signal) })
}

function merge(first: AbortSignal, second?: AbortSignal | null) {
  if (!second || first === second) return first
  return AbortSignal.any([first, second])
}

function usable(entry: MCPOAuthStore.Entry) {
  if (!entry.tokens?.access_token) return false
  return entry.tokens.expires_at === undefined || entry.tokens.expires_at > Date.now() / 1000
}
