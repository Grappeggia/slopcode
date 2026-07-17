export * as PermissionV2 from "./permission"

import { Context, Deferred, Effect as EffectRuntime, Exit, Layer, Schema, Semaphore } from "effect"
import { EventV2 } from "./event"
import { Location } from "./location"
import { AgentV2 } from "./agent"
import { SessionV2 } from "./session"
import { SessionStore } from "./session/store"
import { withStatics } from "./schema"
import { Identifier } from "./util/identifier"
import { Wildcard } from "./util/wildcard"
import { PermissionSchema } from "./permission/schema"
import { PermissionSaved } from "./permission/saved"

export { Effect, Rule, Ruleset } from "./permission/schema"
type Effect = PermissionSchema.Effect
type Rule = PermissionSchema.Rule
type Ruleset = PermissionSchema.Ruleset
const missingAgentPermissions: Ruleset = [{ action: "*", resource: "*", effect: "deny" }]

export const ID = Schema.String.check(Schema.isStartsWith("per")).pipe(
  Schema.brand("PermissionV2.ID"),
  withStatics((schema) => ({ create: (id?: string) => schema.make(id ?? "per_" + Identifier.ascending()) })),
)
export type ID = typeof ID.Type

export const Source = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("tool"),
    messageID: Schema.String,
    callID: Schema.String,
  }),
]).annotate({ identifier: "PermissionV2.Source" })
export type Source = typeof Source.Type

export const Grant = Schema.Struct({
  resources: Schema.Array(Schema.String),
  scopes: Schema.Array(Schema.Literals(["session", "global"])),
}).annotate({ identifier: "PermissionV2.Grant" })
export type Grant = typeof Grant.Type

const RequestFields = {
  sessionID: SessionV2.ID,
  action: Schema.String,
  resources: Schema.Array(Schema.String),
  save: Schema.Array(Schema.String).pipe(Schema.optional),
  grant: Grant.pipe(Schema.optional),
  metadata: Schema.Record(Schema.String, Schema.Unknown).pipe(Schema.optional),
  source: Source.pipe(Schema.optional),
}

export const Request = Schema.Struct({
  id: ID,
  ...RequestFields,
}).annotate({ identifier: "PermissionV2.Request" })
export type Request = typeof Request.Type

export const Reply = Schema.Literals(["once", "session", "global", "always", "project", "reject"]).annotate({
  identifier: "PermissionV2.Reply",
})
export type Reply = typeof Reply.Type

export const AssertInput = Schema.Struct({
  id: ID.pipe(Schema.optional),
  ...RequestFields,
  agent: AgentV2.ID.pipe(Schema.optional),
  rules: PermissionSchema.Ruleset.pipe(Schema.optional),
}).annotate({ identifier: "PermissionV2.AssertInput" })
export type AssertInput = typeof AssertInput.Type

export const ReplyInput = Schema.Struct({
  requestID: ID,
  reply: Reply,
  message: Schema.String.pipe(Schema.optional),
}).annotate({ identifier: "PermissionV2.ReplyInput" })
export type ReplyInput = typeof ReplyInput.Type

export const AskResult = Schema.Struct({
  id: ID,
  effect: PermissionSchema.Effect,
}).annotate({ identifier: "PermissionV2.AskResult" })
export type AskResult = typeof AskResult.Type

export const Event = {
  Asked: EventV2.define({ type: "permission.v2.asked", schema: Request.fields }),
  Replied: EventV2.define({
    type: "permission.v2.replied",
    schema: {
      sessionID: SessionV2.ID,
      requestID: ID,
      reply: Reply,
    },
  }),
}

export class RejectedError extends Schema.TaggedErrorClass<RejectedError>()("PermissionV2.RejectedError", {}) {}

export class CorrectedError extends Schema.TaggedErrorClass<CorrectedError>()("PermissionV2.CorrectedError", {
  feedback: Schema.String,
}) {}

export class DeniedError extends Schema.TaggedErrorClass<DeniedError>()("PermissionV2.DeniedError", {
  rules: PermissionSchema.Ruleset,
}) {}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("PermissionV2.NotFoundError", {
  requestID: ID,
}) {}

export type Error = DeniedError | RejectedError | CorrectedError

export function evaluate(action: string, resource: string, ...rulesets: Ruleset[]): Rule {
  return (
    rulesets
      .flat()
      .findLast((rule) => Wildcard.match(action, rule.action) && Wildcard.match(resource, rule.resource)) ?? {
      action,
      resource: "*",
      effect: "ask",
    }
  )
}

export function merge(...rulesets: Ruleset[]): Ruleset {
  return rulesets.flat()
}

export interface Interface {
  readonly ask: (input: AssertInput) => EffectRuntime.Effect<AskResult, SessionV2.NotFoundError>
  readonly assert: (input: AssertInput) => EffectRuntime.Effect<void, Error | SessionV2.NotFoundError>
  readonly reply: (input: ReplyInput) => EffectRuntime.Effect<void, NotFoundError>
  readonly get: (id: ID) => EffectRuntime.Effect<Request | undefined>
  readonly forSession: (sessionID: SessionV2.ID) => EffectRuntime.Effect<ReadonlyArray<Request>>
  readonly list: () => EffectRuntime.Effect<ReadonlyArray<Request>>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/Permission") {}

interface Pending {
  readonly request: Request
  readonly agent?: AgentV2.ID
  readonly rules?: Ruleset
  readonly deferred: Deferred.Deferred<void, RejectedError | CorrectedError>
  phase: "pending" | "replying"
}

export const layer = Layer.effect(
  Service,
  EffectRuntime.gen(function* () {
    const events = yield* EventV2.Service
    const location = yield* Location.Service
    const agents = yield* AgentV2.Service
    const sessions = yield* SessionStore.Service
    const saved = yield* PermissionSaved.Service
    const pending = new Map<ID, Pending>()
    const memory = new Map<SessionV2.ID, Array<{ action: string; resource: string }>>()
    const lock = Semaphore.makeUnsafe(1)

    yield* EffectRuntime.addFinalizer(() =>
      EffectRuntime.forEach(pending.values(), (item) => Deferred.fail(item.deferred, new RejectedError()), {
        discard: true,
      }).pipe(
        EffectRuntime.ensuring(
          EffectRuntime.sync(() => {
            pending.clear()
            memory.clear()
          }),
        ),
      ),
    )

    const approvals = EffectRuntime.fnUntraced(function* (sessionID: SessionV2.ID) {
      const rows = yield* EffectRuntime.all([
        saved.list({ scope: "global" }),
        saved.list({ scope: "session", sessionID }),
        saved.listCurrent(location),
      ]).pipe(EffectRuntime.map((rows) => rows.flat()))
      return [
        ...rows,
        ...(memory.get(sessionID) ?? []).map((item) => ({ ...item, match: "pattern" as const })),
      ]
    })

    function approved(
      action: string,
      resource: string,
      rows: ReadonlyArray<Pick<PermissionSaved.Info, "action" | "resource" | "match">>,
    ) {
      return rows.some((row) =>
        row.match === "exact"
          ? row.action === action && row.resource === resource
          : Wildcard.match(action, row.action) && Wildcard.match(resource, row.resource),
      )
    }

    const configured = EffectRuntime.fn("PermissionV2.configured")(function* (
      sessionID: SessionV2.ID,
      agentID?: AgentV2.ID,
      rules?: Ruleset,
    ) {
      const session = yield* sessions.get(sessionID)
      if (!session) return yield* new SessionV2.NotFoundError({ sessionID })
      const agent = yield* agents.resolve(agentID ?? session.agent)
      return {
        rules: rules ?? agent?.permissions ?? missingAgentPermissions,
        ceiling: (yield* sessions.task(sessionID))?.ceiling ?? [],
      }
    })

    function denied(input: AssertInput, rules: Ruleset) {
      return input.resources.some((resource) => evaluate(input.action, resource, rules).effect === "deny")
    }

    function ceilingDenied(input: AssertInput, rules: Ruleset) {
      return input.resources.some((resource) =>
        rules.some(
          (rule) =>
            rule.effect === "deny" &&
            Wildcard.match(input.action, rule.action) &&
            Wildcard.match(resource, rule.resource),
        ),
      )
    }

    function ceilingAsks(input: AssertInput, rules: Ruleset) {
      return (
        input.action === "external_directory" &&
        input.resources.some((resource) =>
          rules.some(
            (rule) =>
              rule.effect === "ask" &&
              Wildcard.match(input.action, rule.action) &&
              Wildcard.match(resource, rule.resource),
          ),
        )
      )
    }

    function relevant(input: AssertInput, rules: Ruleset) {
      return rules.filter((rule) => Wildcard.match(input.action, rule.action))
    }

    const evaluateInput = EffectRuntime.fnUntraced(function* (input: AssertInput) {
      const configuredRules = yield* configured(input.sessionID, input.agent, input.rules)
      const combined = [...configuredRules.rules, ...configuredRules.ceiling]
      if (denied(input, configuredRules.rules) || ceilingDenied(input, configuredRules.ceiling))
        return { effect: "deny" as const, rules: combined, grant: [] as string[], forced: false }
      if (ceilingAsks(input, configuredRules.ceiling))
        return { effect: "ask" as const, rules: combined, grant: [] as string[], forced: true }
      const rows = yield* approvals(input.sessionID)
      const effects = input.resources.map((resource) => {
        const effect = evaluate(input.action, resource, configuredRules.rules).effect
        if (effect !== "ask") return effect
        return approved(input.action, resource, rows) ? ("allow" as const) : effect
      })
      const effect: Effect = effects.includes("deny") ? "deny" : effects.includes("ask") ? "ask" : "allow"
      return {
        effect,
        rules: combined,
        grant: input.resources.filter((_, index) => effects[index] === "ask"),
        forced: false,
      }
    })

    function request(input: AssertInput, grant: string[]): Request {
      return {
        id: input.id ?? ID.create(),
        sessionID: input.sessionID,
        action: input.action,
        resources: input.resources,
        save: input.save,
        grant: grant.length
          ? { resources: [...new Set(grant)].toSorted(), scopes: ["session" as const, "global" as const] }
          : undefined,
        metadata: input.metadata,
        source: input.source,
      }
    }

    const create = (input: AssertInput) =>
      EffectRuntime.uninterruptible(
        EffectRuntime.gen(function* () {
          const admission = yield* lock.withPermit(
            EffectRuntime.gen(function* () {
              const result = yield* evaluateInput(input)
              const value = request(input, result.grant ?? [])
              if (result.effect !== "ask") return { result, value }
              const deferred = yield* Deferred.make<void, RejectedError | CorrectedError>()
              const item: Pending = {
                request: value,
                agent: input.agent,
                rules: input.rules,
                deferred,
                phase: "pending",
              }
              if (pending.has(value.id)) return yield* EffectRuntime.die(`Duplicate pending permission ID: ${value.id}`)
              pending.set(value.id, item)
              return { result, value, item }
            }),
          )
          if (!admission.item) return admission
          yield* events
            .publish(Event.Asked, admission.value)
            .pipe(
              EffectRuntime.onError(() =>
                lock.withPermit(
                  EffectRuntime.sync(() => {
                    if (pending.get(admission.value.id) === admission.item) pending.delete(admission.value.id)
                  }),
                ),
              ),
            )
          return admission
        }),
      )

    const ask = EffectRuntime.fn("PermissionV2.ask")(function* (input: AssertInput) {
      const result = yield* evaluateInput(input)
      const value = request(input, result.grant ?? [])
      if (result.effect !== "ask") return { id: value.id, effect: result.effect }
      const admission = yield* create(input)
      return { id: admission.value.id, effect: admission.result.effect }
    })

    const assert = EffectRuntime.fn("PermissionV2.assert")((input: AssertInput) =>
      EffectRuntime.uninterruptibleMask((restore) =>
        EffectRuntime.gen(function* () {
          const result = yield* evaluateInput(input)
          if (result.effect === "deny") {
            return yield* new DeniedError({
              rules: relevant(input, result.rules),
            })
          }
          if (result.effect === "allow") return
          const admission = yield* create(input)
          if (admission.result.effect === "deny") {
            return yield* new DeniedError({
              rules: relevant(input, admission.result.rules),
            })
          }
          if (admission.result.effect === "allow") return
          const item = admission.item!
          return yield* restore(Deferred.await(item.deferred)).pipe(
            EffectRuntime.ensuring(
              EffectRuntime.gen(function* () {
                const claimed = yield* lock.withPermit(
                  EffectRuntime.sync(() => {
                    if (pending.get(item.request.id) !== item || item.phase !== "pending") return false
                    item.phase = "replying"
                    pending.delete(item.request.id)
                    return true
                  }),
                )
                if (!claimed) return
                yield* events.publish(Event.Replied, {
                  sessionID: item.request.sessionID,
                  requestID: item.request.id,
                  reply: "reject",
                })
                yield* Deferred.fail(item.deferred, new RejectedError())
              }),
            ),
          )
        }),
      ),
    )

    const claim = (requestID: ID) =>
      lock.withPermit(
        EffectRuntime.gen(function* () {
          const item = pending.get(requestID)
          if (!item || item.phase !== "pending") return yield* new NotFoundError({ requestID })
          item.phase = "replying"
          return item
        }),
      )

    const release = (item: Pending) =>
      lock.withPermit(
        EffectRuntime.sync(() => {
          if (pending.get(item.request.id) === item && item.phase === "replying") item.phase = "pending"
        }),
      )

    const settle = (item: Pending, reply: Reply, error?: RejectedError | CorrectedError) =>
      EffectRuntime.gen(function* () {
        yield* events.publish(Event.Replied, {
          sessionID: item.request.sessionID,
          requestID: item.request.id,
          reply,
        })
        yield* lock.withPermit(
          EffectRuntime.gen(function* () {
            if (pending.get(item.request.id) !== item || item.phase !== "replying") return
            pending.delete(item.request.id)
            if (error) yield* Deferred.fail(item.deferred, error)
            else yield* Deferred.succeed(item.deferred, undefined)
          }),
        )
      }).pipe(EffectRuntime.onExit((exit) => (Exit.isFailure(exit) ? release(item) : EffectRuntime.void)))

    const reply = EffectRuntime.fn("PermissionV2.reply")((input: ReplyInput) =>
      EffectRuntime.uninterruptible(
        EffectRuntime.gen(function* () {
          const existing = yield* claim(input.requestID)
          return yield* EffectRuntime.gen(function* () {
            const current =
              input.reply === "reject"
                ? undefined
                : yield* evaluateInput({
                    ...existing.request,
                    agent: existing.agent,
                    rules: existing.rules,
                  }).pipe(
                    EffectRuntime.catchTag("Session.NotFoundError", () =>
                      EffectRuntime.fail(new NotFoundError({ requestID: input.requestID })),
                    ),
                  )
            const requested =
              input.reply === "project" && !existing.request.save?.length
                ? ("once" as const)
                : (input.reply === "session" || input.reply === "global") &&
                    (!existing.request.grant?.resources.length || current?.forced)
                  ? ("once" as const)
                  : input.reply
            const shown = new Set(existing.request.grant?.resources ?? [])
            const resources = current?.grant.filter((resource) => shown.has(resource)) ?? []
            const expanded = current?.grant.some((resource) => !shown.has(resource))
            const answer =
              input.reply === "reject" || current?.effect === "deny" || expanded
                ? ("reject" as const)
                : current?.effect === "allow"
                  ? "once"
                  : requested

            if (answer === "project") {
              yield* saved.add({
                ...PermissionSaved.current(location),
                action: existing.request.action,
                resources: existing.request.save ?? [],
              })
            }
            if (answer === "always" && existing.request.save?.length) {
              const rows = memory.get(existing.request.sessionID) ?? []
              rows.push(
                ...existing.request.save.map((resource) => ({ action: existing.request.action, resource })),
              )
              memory.set(existing.request.sessionID, rows)
            }
            if (answer === "session")
              yield* saved.add({
                scope: "session",
                sessionID: existing.request.sessionID,
                action: existing.request.action,
                resources,
              })
            if (answer === "global")
              yield* saved.add({
                scope: "global",
                action: existing.request.action,
                resources,
              })

            if (answer === "reject") {
              const related = yield* lock.withPermit(
                EffectRuntime.sync(() =>
                  Array.from(pending.values()).filter((item) => {
                    if (
                      item === existing ||
                      item.phase !== "pending" ||
                      item.request.sessionID !== existing.request.sessionID
                    )
                      return false
                    item.phase = "replying"
                    return true
                  }),
                ),
              )
              const claimed = [existing, ...related]
              // Complete each terminal before a later listener can fail the fan-out.
              yield* EffectRuntime.gen(function* () {
                for (const item of claimed) {
                  yield* settle(
                    item,
                    answer,
                    item === existing && input.message
                      ? new CorrectedError({ feedback: input.message })
                      : new RejectedError(),
                  )
                }
              }).pipe(
                EffectRuntime.onExit((exit) =>
                  Exit.isFailure(exit)
                    ? EffectRuntime.forEach(claimed, release, { discard: true })
                    : EffectRuntime.void,
                ),
              )
              return
            }

            yield* settle(existing, answer)
            if (answer !== "always" && answer !== "project" && answer !== "session" && answer !== "global") return

            const candidates = yield* lock.withPermit(
              EffectRuntime.sync(() =>
                Array.from(pending.values()).filter(
                  (item) =>
                    item.phase === "pending" &&
                    (answer === "global" ||
                      answer === "project" ||
                      item.request.sessionID === existing.request.sessionID),
                ),
              ),
            )
            for (const item of candidates) {
              const result = yield* evaluateInput({ ...item.request, agent: item.agent, rules: item.rules }).pipe(
                EffectRuntime.catchTag("Session.NotFoundError", () => EffectRuntime.succeed(undefined)),
              )
              if (!result || result.effect !== "allow") continue
              const claimed = yield* lock.withPermit(
                EffectRuntime.gen(function* () {
                  if (pending.get(item.request.id) !== item || item.phase !== "pending") return false
                  item.phase = "replying"
                  return true
                }),
              )
              if (claimed) yield* settle(item, answer)
            }
          }).pipe(EffectRuntime.onExit((exit) => (Exit.isFailure(exit) ? release(existing) : EffectRuntime.void)))
        }),
      ),
    )

    const list = EffectRuntime.fn("PermissionV2.list")(function* () {
      return yield* lock.withPermit(EffectRuntime.sync(() => Array.from(pending.values(), (item) => item.request)))
    })

    const get = EffectRuntime.fn("PermissionV2.get")(function* (id: ID) {
      return yield* lock.withPermit(EffectRuntime.sync(() => pending.get(id)?.request))
    })

    const forSession = EffectRuntime.fn("PermissionV2.forSession")(function* (sessionID: SessionV2.ID) {
      return yield* lock.withPermit(
        EffectRuntime.sync(() =>
          Array.from(pending.values(), (item) => item.request).filter((request) => request.sessionID === sessionID),
        ),
      )
    })

    return Service.of({ ask, assert, reply, get, forSession, list })
  }),
)

export const locationLayer = layer.pipe(Layer.provideMerge(AgentV2.locationLayer))
