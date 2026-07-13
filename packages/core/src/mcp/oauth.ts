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
  | { readonly status: "failed"; readonly code: FailureCode }

export const FailureCode = Schema.Literals([
  "attempt-expired",
  "provider-error",
  "callback-unavailable",
  "indeterminate-exchange",
  "discovery",
  "exchange",
])
export type FailureCode = typeof FailureCode.Type

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
    "connection",
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
  readonly onChange: (
    handler: (target: MCPOAuthStore.Target, status: { readonly status: "failed"; readonly code: FailureCode }) => void,
  ) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/MCPOAuth") {}

export const layerWith = (options: { readonly maxAge?: number; readonly observeInterval?: number } = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const store = yield* MCPOAuthStore.Service
      const callbacks = yield* MCPOAuthCallback.Service
      const listeners = new Map<string, { close: () => Promise<void> }>()
      const exchanges = new Map<string, { readonly controller: AbortController; readonly settled: Promise<void> }>()
      const timers = new Map<string, ReturnType<typeof setTimeout>>()
      const observers = new Map<string, ReturnType<typeof setInterval>>()
      const owned = new Set<string>()
      const completions = new Set<(target: MCPOAuthStore.Target) => void>()

      const failure = (code: AuthError["code"], target?: MCPOAuthStore.Target, attemptID?: string) =>
        new AuthError({ code, server: target?.name, attemptID, message: `MCP OAuth ${code}` })
      const safe = <A>(effect: Effect.Effect<A, MCPOAuthStore.StoreError>, target?: MCPOAuthStore.Target) =>
        effect.pipe(Effect.mapError(() => failure("store", target)))
      const close = (attemptID: string) =>
        Effect.gen(function* () {
          const timer = timers.get(attemptID)
          if (timer) clearTimeout(timer)
          timers.delete(attemptID)
          const observer = observers.get(attemptID)
          if (observer) clearInterval(observer)
          observers.delete(attemptID)
          const listener = listeners.get(attemptID)
          listeners.delete(attemptID)
          owned.delete(attemptID)
          if (listener) yield* Effect.promise(() => listener.close()).pipe(Effect.ignore)
        })
      const later = (attemptID: string) =>
        setTimeout(() => Effect.runPromise(close(attemptID)).catch(() => undefined), 0)
      const settle = (attemptIDs: ReadonlyArray<string>) =>
        Effect.gen(function* () {
          attemptIDs.forEach((attemptID) => exchanges.get(attemptID)?.controller.abort())
          yield* Effect.promise(() =>
            Promise.all(attemptIDs.map((attemptID) => exchanges.get(attemptID)?.settled ?? Promise.resolve())),
          ).pipe(Effect.ignore)
          yield* Effect.forEach(attemptIDs, close, { discard: true })
        })
      const changes = new Set<Parameters<Interface["onChange"]>[0]>()
      const changed = (target: MCPOAuthStore.Target, code: FailureCode) =>
        Effect.sync(() => changes.forEach((handler) => handler(target, { status: "failed", code })))
      const mark = (
        target: MCPOAuthStore.Target,
        attemptID: string,
        phase: "expired" | "failed",
        error: FailureCode,
        expected?: ReadonlyArray<MCPOAuthStore.Attempt["phase"]>,
      ) =>
        safe(store.finishAttempt(target, attemptID, phase, error, expected), target).pipe(
          Effect.flatMap((updated) => (updated ? changed(target, error).pipe(Effect.as(true)) : Effect.succeed(false))),
        )
      const terminal = (
        target: MCPOAuthStore.Target,
        attemptID: string,
        phase: "complete" | "cancelled" | "expired" | "failed",
        error?: FailureCode,
      ) =>
        phase === "complete" || phase === "cancelled"
          ? close(attemptID)
          : mark(target, attemptID, phase, (error ?? phase) as FailureCode).pipe(
              Effect.andThen(close(attemptID)),
              Effect.asVoid,
            )
      const schedule = (target: MCPOAuthStore.Target, attemptID: string, expires: number) =>
        Effect.sync(() => {
          const current = timers.get(attemptID)
          if (current) clearTimeout(current)
          timers.set(
            attemptID,
            setTimeout(
              () => {
                void Effect.runPromise(
                  mark(target, attemptID, "expired", "attempt-expired", ["initializing", "pending"]).pipe(
                    Effect.flatMap((updated) => (updated ? close(attemptID) : Effect.void)),
                  ),
                ).catch(() => undefined)
              },
              Math.max(0, expires - Date.now()),
            ),
          )
        })
      const observe = (attemptID: string) =>
        Effect.sync(() => {
          const current = observers.get(attemptID)
          if (current) clearInterval(current)
          let checking = false
          observers.set(
            attemptID,
            setInterval(() => {
              if (checking) return
              checking = true
              void Effect.runPromise(store.findAttempt(attemptID))
                .then((found) => {
                  if (!found || ["complete", "cancelled", "expired", "failed"].includes(found.attempt.phase ?? ""))
                    return Effect.runPromise(close(attemptID))
                })
                .catch(() => undefined)
                .finally(() => {
                  checking = false
                })
            }, options.observeInterval ?? 250),
          )
        })

      const status: Interface["status"] = (target) =>
        safe(store.get(target), target).pipe(
          Effect.flatMap((entry) =>
            Effect.gen(function* () {
              const now = Date.now()
              const stale = Object.entries(entry.attempts ?? {})
              let expired = false
              for (const [id, attempt] of stale)
                if (attempt.phase === "pending" && (attempt.expires ?? 0) <= now)
                  yield* terminal(target, id, "expired", "attempt-expired").pipe(
                    Effect.tap(() => Effect.sync(() => (expired = true))),
                  )
              const current = expired ? yield* safe(store.get(target), target) : entry
              const attempts = Object.entries(current.attempts ?? {})
              if (usable(current)) return { status: "credential-ready" } as const
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
                .filter(([, attempt]) => attempt.phase === "failed" || attempt.phase === "expired")
                .sort((a, b) => (b[1].created ?? 0) - (a[1].created ?? 0))[0]
              if (failed) return { status: "failed", code: failureCode(failed[1].error) } as const
              return { status: "auth-required" } as const
            }),
          ),
        )

      const finish = (
        input: Parameters<Interface["complete"]>[0],
        recovered = false,
        callback = false,
        external?: AbortSignal,
      ) =>
        Effect.gen(function* () {
          if (!input.code || !input.state) return yield* failure("attempt-invalid", input.target, input.attemptID)
          if (!recovered) {
            const claim = yield* safe(
              store.claimAttempt(input.attemptID, input.state, input.code, Date.now()),
              input.target,
            )
            if (claim.status === "expired") return yield* failure("attempt-expired", input.target, input.attemptID)
            if (claim.status !== "claimed" || JSON.stringify(claim.target) !== JSON.stringify(input.target))
              return yield* failure(
                claim.status === "invalid" ? "attempt-invalid" : "attempt-used",
                input.target,
                input.attemptID,
              )
          }
          if (!callback) yield* close(input.attemptID)
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
                  if (latest?.attempt.phase !== "exchanging") return { status: "LOST", cancelled: [] } as const
                  const exchanged = await auth(provider, {
                    serverUrl: input.target.endpoint,
                    authorizationCode: input.code,
                    fetchFn: abortFetch(signal, external),
                  })
                  if (exchanged !== "AUTHORIZED" || !tokens) return "INVALID" as const
                  const committed = await Effect.runPromise(store.finishExchange(input.target, input.attemptID, tokens))
                  return committed.won
                    ? ({ status: "WON", cancelled: committed.cancelled } as const)
                    : ({ status: "LOST", cancelled: [] } as const)
                },
                { signal },
              ),
            catch: () => failure("exchange", input.target, input.attemptID),
          }).pipe(Effect.tapError(() => mark(input.target, input.attemptID, "failed", "exchange", ["exchanging"])))
          if (result === "INVALID") return yield* failure("exchange", input.target, input.attemptID)
          if (result.status === "LOST") return yield* failure("attempt-used", input.target, input.attemptID)
          yield* settle(result.cancelled)
          if (!callback) yield* close(input.attemptID)
          return { status: "credential-ready" } as const
        })
      const complete: Interface["complete"] = (input) => finish(input)

      const begin: Interface["begin"] = (input) =>
        Effect.gen(function* () {
          const existing = yield* safe(store.get(input.target), input.target)
          const redirect = yield* Effect.try({
            try: () => redirectFor(input.config),
            catch: () => failure("invalid-redirect", input.target),
          })
          const compatibility = MCPOAuthProvider.compatibility(input.target.endpoint, input.config, redirect.url)
          if (existing.compatibility === compatibility && usable(existing)) return { status: "connected" } as const
          if (existing.compatibility && existing.compatibility !== compatibility)
            yield* safe(store.cancelTarget(input.target, true), input.target)
          const attemptID = `mcp_auth_${randomBytes(16).toString("hex")}` as AttemptID
          const state = randomBytes(32).toString("base64url")
          const created = Date.now()
          const expires = created + (options.maxAge ?? MAX_AGE)
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
                  phase: "initializing",
                },
              },
            })),
            input.target,
          )
          owned.add(attemptID)
          yield* observe(attemptID)
          yield* schedule(input.target, attemptID, expires)
          return yield* Effect.gen(function* () {
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
              return { status: "connected" } as const
            }
            if (!authorizationUrl) {
              yield* terminal(input.target, attemptID, "failed", "discovery")
              return yield* failure("discovery", input.target, attemptID)
            }
            if (mode === "auto") {
              const listener = yield* Effect.tryPromise({
                try: () =>
                  callbacks.register({
                    redirect: redirect.url,
                    state,
                    receive: async (result) => {
                      if (!result.code) {
                        await Effect.runPromise(mark(input.target, attemptID, "failed", "provider-error", ["pending"]))
                        later(attemptID)
                        return true
                      }
                      const controller = new AbortController()
                      const running = Effect.runPromiseExit(
                        finish({ ...input, attemptID, code: result.code, state }, false, true, controller.signal),
                      )
                      exchanges.set(attemptID, { controller, settled: running.then(() => undefined) })
                      const completed = await running.finally(() => exchanges.delete(attemptID))
                      if (completed._tag !== "Success") {
                        await Effect.runPromise(
                          mark(input.target, attemptID, "failed", "exchange", ["received", "exchanging"]),
                        )
                        later(attemptID)
                        return false
                      }
                      later(attemptID)
                      completions.forEach((handler) => handler(input.target))
                      return true
                    },
                  }),
                catch: () => failure("callback-unavailable", input.target, attemptID),
              }).pipe(Effect.tapError(() => terminal(input.target, attemptID, "failed", "callback-unavailable")))
              listeners.set(attemptID, listener)
            }
            if (!(yield* safe(store.readyAttempt(input.target, attemptID, authorizationUrl), input.target))) {
              yield* terminal(input.target, attemptID, "failed", "discovery")
              return yield* failure("attempt-used", input.target, attemptID)
            }
            return { status: "authorizing", attemptID, mode, created, expires, authorizationUrl } as const
          }).pipe(Effect.onInterrupt(() => terminal(input.target, attemptID, "failed", "discovery")))
        })

      const cancel: Interface["cancel"] = (attemptID) =>
        safe(store.cancelAttempt(attemptID)).pipe(
          Effect.flatMap((result) =>
            result.status === "cancelled"
              ? close(attemptID)
              : Effect.fail(
                  failure(result.status === "missing" ? "attempt-invalid" : "attempt-used", undefined, attemptID),
                ),
          ),
        )
      const quiesce = (target: MCPOAuthStore.Target, entry: MCPOAuthStore.Entry) =>
        Effect.gen(function* () {
          const ids = Object.keys(entry.attempts ?? {})
          ids.forEach((id) => exchanges.get(id)?.controller.abort())
          yield* Effect.promise(() =>
            Promise.all(ids.map((id) => exchanges.get(id)?.settled ?? Promise.resolve())),
          ).pipe(Effect.ignore)
          yield* Effect.forEach(
            ids,
            (id) =>
              safe(store.findAttempt(id), target).pipe(
                Effect.flatMap((found) =>
                  found?.attempt.phase === "received" || found?.attempt.phase === "exchanging"
                    ? mark(target, id, "failed", "exchange", ["received", "exchanging"])
                    : Effect.void,
                ),
              ),
            { discard: true },
          )
          yield* Effect.forEach(ids, close, { discard: true })
        })
      const remove: Interface["remove"] = (target) =>
        safe(store.get(target), target).pipe(
          Effect.flatMap((entry) =>
            quiesce(target, entry).pipe(
              Effect.andThen(safe(store.cancelTarget(target, true), target)),
              Effect.andThen(safe(store.remove(target), target)),
            ),
          ),
        )
      const reset: Interface["reset"] = (target) =>
        safe(store.get(target), target).pipe(
          Effect.flatMap((entry) =>
            quiesce(target, entry).pipe(Effect.andThen(safe(store.cancelTarget(target, true), target))),
          ),
        )
      const stop: Interface["stop"] = (target) =>
        safe(store.get(target), target).pipe(
          Effect.flatMap((entry) =>
            quiesce(target, entry).pipe(Effect.andThen(safe(store.cancelTarget(target), target))),
          ),
        )

      const recoverAttempt = (
        input: Parameters<Interface["recover"]>[0],
        attemptID: string,
        attempt: MCPOAuthStore.Attempt,
      ): Effect.Effect<void, AuthError> => {
        if (attempt.phase === "initializing") return terminal(input.target, attemptID, "failed", "discovery")
        if (attempt.phase === "exchanging") return terminal(input.target, attemptID, "failed", "indeterminate-exchange")
        if (attempt.phase === "received" && attempt.code && attempt.state)
          return finish(
            {
              target: input.target,
              config: input.config,
              attemptID: attemptID as AttemptID,
              code: attempt.code,
              state: attempt.state,
            },
            true,
          ).pipe(Effect.asVoid)
        if (attempt.phase !== "pending") return Effect.void
        if ((attempt.expires ?? 0) <= Date.now()) return terminal(input.target, attemptID, "expired", "attempt-expired")
        if (attempt.mode !== "auto" || !attempt.redirect || !attempt.state)
          return schedule(input.target, attemptID, attempt.expires!)
        return Effect.tryPromise({
          try: () =>
            callbacks.register({
              redirect: attempt.redirect!,
              state: attempt.state!,
              receive: async (result) => {
                if (!result.code) {
                  await Effect.runPromise(mark(input.target, attemptID, "failed", "provider-error", ["pending"]))
                  later(attemptID)
                  return true
                }
                const controller = new AbortController()
                const running = Effect.runPromiseExit(
                  finish(
                    {
                      target: input.target,
                      config: input.config,
                      attemptID: attemptID as AttemptID,
                      code: result.code,
                      state: attempt.state!,
                    },
                    false,
                    true,
                    controller.signal,
                  ),
                )
                exchanges.set(attemptID, { controller, settled: running.then(() => undefined) })
                const completed = await running.finally(() => exchanges.delete(attemptID))
                if (completed._tag !== "Success") {
                  await Effect.runPromise(
                    mark(input.target, attemptID, "failed", "exchange", ["received", "exchanging"]),
                  )
                  later(attemptID)
                  return false
                }
                later(attemptID)
                completions.forEach((handler) => handler(input.target))
                return true
              },
            }),
          catch: () => failure("callback-unavailable", input.target, attemptID),
        }).pipe(
          Effect.tap((listener) => Effect.sync(() => listeners.set(attemptID, listener))),
          Effect.tap(() => schedule(input.target, attemptID, attempt.expires!)),
          Effect.catch(() => terminal(input.target, attemptID, "failed", "callback-unavailable")),
          Effect.asVoid,
        )
      }

      const recover: Interface["recover"] = (input) =>
        Effect.gen(function* () {
          const redirect = yield* Effect.try({
            try: () => redirectFor(input.config),
            catch: () => failure("invalid-redirect", input.target),
          })
          const compatibility = MCPOAuthProvider.compatibility(input.target.endpoint, input.config, redirect.url)
          yield* safe(
            store.claimLegacy(input.target, {
              compatibility,
              clientID: input.config.client_id,
              clientSecret: input.config.client_secret,
              scope: input.config.scope,
            }),
            input.target,
          )
          const entry = yield* safe(store.get(input.target), input.target)
          if (Object.keys(entry).length === 0) return
          const compatible =
            entry.compatibility === compatibility &&
            Object.values(entry.attempts ?? {}).every(
              (attempt) =>
                !["initializing", "pending", "received", "exchanging"].includes(attempt.phase ?? "") ||
                attempt.redirect === redirect.url,
            )
          if (!compatible) return yield* reset(input.target)
          yield* Effect.forEach(
            Object.entries(entry.attempts ?? {}),
            ([attemptID, attempt]) => {
              if (!["initializing", "pending", "received", "exchanging"].includes(attempt.phase ?? ""))
                return Effect.void
              owned.add(attemptID)
              return observe(attemptID).pipe(Effect.andThen(recoverAttempt(input, attemptID, attempt)))
            },
            { discard: true },
          )
        })

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => exchanges.forEach((exchange) => exchange.controller.abort())).pipe(
          Effect.andThen(
            Effect.promise(() => Promise.all([...exchanges.values()].map((exchange) => exchange.settled))),
          ),
          Effect.andThen(
            Effect.forEach(
              [...owned],
              (attemptID) =>
                safe(store.findAttempt(attemptID)).pipe(
                  Effect.flatMap((found) =>
                    found?.attempt.phase === "pending"
                      ? cancel(attemptID as AttemptID)
                      : found?.attempt.phase === "initializing"
                        ? terminal(found.target, attemptID, "failed", "discovery")
                        : found?.attempt.phase === "received" || found?.attempt.phase === "exchanging"
                          ? terminal(found.target, attemptID, "failed", "exchange")
                          : close(attemptID),
                  ),
                  Effect.ignore,
                ),
              { discard: true },
            ),
          ),
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
        onChange: (handler) => Effect.sync(() => changes.add(handler)).pipe(Effect.asVoid),
      })
    }),
  )

export const layer = layerWith()

function redirectFor(config: typeof ConfigMCP.OAuth.Type) {
  const value = config.redirect_uri ?? `http://127.0.0.1:${config.callback_port ?? DEFAULT_PORT}${PATH}`
  const url = new URL(value)
  if (
    config.callback_port !== undefined &&
    config.redirect_uri !== undefined &&
    (url.protocol !== "http:" ||
      (url.hostname !== "127.0.0.1" && url.hostname !== "[::1]") ||
      !url.port ||
      Number(url.port) !== config.callback_port)
  )
    throw new AuthError({ code: "invalid-redirect", message: "MCP OAuth invalid-redirect" })
  const local = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "[::1]")
  if (local && (!url.port || url.search || url.hash || url.username || url.password))
    throw new AuthError({ code: "invalid-redirect", message: "MCP OAuth invalid-redirect" })
  return { url: url.toString(), local }
}

function failureCode(value: string | undefined): FailureCode {
  return [
    "attempt-expired",
    "provider-error",
    "callback-unavailable",
    "indeterminate-exchange",
    "discovery",
    "exchange",
  ].includes(value ?? "")
    ? (value as FailureCode)
    : "exchange"
}

function abortFetch(signal: AbortSignal, external?: AbortSignal) {
  return (input: string | URL | Request, init?: RequestInit) =>
    fetch(input, { ...init, signal: merge(signal, external, init?.signal) })
}

function merge(...signals: ReadonlyArray<AbortSignal | null | undefined>) {
  const active = [...new Set(signals.filter((value): value is AbortSignal => value !== undefined && value !== null))]
  return active.length === 1 ? active[0]! : AbortSignal.any(active)
}

function usable(entry: MCPOAuthStore.Entry) {
  if (!entry.tokens?.access_token) return false
  return entry.tokens.expires_at === undefined || entry.tokens.expires_at > Date.now() / 1000
}
