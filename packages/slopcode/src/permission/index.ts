import { LayerNode } from "@slopcode-ai/core/effect/layer-node"
import { ConfigPermissionV1 } from "@slopcode-ai/core/v1/config/permission"
import { InstanceState } from "@/effect/instance-state"
import { Wildcard } from "@slopcode-ai/core/util/wildcard"
import { Deferred, Effect, Layer, Context, Schema, Semaphore } from "effect"
import os from "os"
import { PermissionV1 } from "@slopcode-ai/core/v1/permission"
import { EventV2Bridge } from "@/event-v2-bridge"
import { EventV2 } from "@slopcode-ai/core/event"
import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { ProjectV2 } from "@slopcode-ai/core/project"

export const Event = {
  Asked: EventV2.define({ type: "permission.asked", schema: PermissionV1.Request.fields }),
  Replied: EventV2.define({
    type: "permission.replied",
    schema: {
      sessionID: PermissionV1.Request.fields.sessionID,
      requestID: PermissionV1.ID,
      reply: PermissionV1.Reply,
    },
  }),
}

export const ForecastLimits = {
  candidates: 16,
  resources: 16,
  action: 64,
  resource: 512,
  reason: 280,
} as const

const ExactAction = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(ForecastLimits.action),
  Schema.isPattern(/^[A-Za-z0-9_:-]+$/),
)
const ExactResource = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(ForecastLimits.resource),
  Schema.isPattern(/^[^*?]+$/),
)
export const ForecastCandidate = Schema.Struct({
  action: ExactAction,
  resources: Schema.Array(ExactResource).check(Schema.isMinLength(1), Schema.isMaxLength(ForecastLimits.resources)),
  reason: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(ForecastLimits.reason)),
}).annotate({ identifier: "PermissionForecastCandidate" })
export type ForecastCandidate = typeof ForecastCandidate.Type

export const ForecastInput = Schema.Struct({
  sessionID: PermissionV1.Request.fields.sessionID,
  ruleset: PermissionV1.Ruleset,
  candidates: Schema.Array(ForecastCandidate).check(Schema.isMaxLength(ForecastLimits.candidates)),
}).annotate({ identifier: "PermissionForecastInput" })
export type ForecastInput = typeof ForecastInput.Type

export interface Interface {
  readonly ask: (input: PermissionV1.AskInput) => Effect.Effect<void, PermissionV1.Error>
  readonly query: (input: {
    permission: string
    pattern: string
    ruleset: PermissionV1.Ruleset
  }) => Effect.Effect<PermissionV1.Action>
  readonly reply: (input: PermissionV1.ReplyInput) => Effect.Effect<void, PermissionV1.NotFoundError>
  readonly forecast: (input: ForecastInput) => Effect.Effect<ReadonlyArray<ForecastCandidate>, Schema.SchemaError>
  readonly review: (input: {
    sessionID: PermissionV1.Request["sessionID"]
    tool?: PermissionV1.Request["tool"]
    policy: () => Effect.Effect<PermissionV1.Ruleset>
  }) => Effect.Effect<boolean>
  readonly replyBatch: (
    input: PermissionV1.BatchReplyInput,
  ) => Effect.Effect<void, PermissionV1.BatchError | Schema.SchemaError>
  readonly list: () => Effect.Effect<ReadonlyArray<PermissionV1.Request>>
}

interface BlockingEntry {
  kind: "blocking"
  info: PermissionV1.Request
  ruleset: PermissionV1.Ruleset
  deferred: Deferred.Deferred<void, PermissionV1.RejectedError | PermissionV1.CorrectedError>
}

interface ForecastEntry {
  kind: "forecast"
  info: PermissionV1.Request & { kind: "forecast"; batchID: PermissionV1.BatchID }
}

type PendingEntry = BlockingEntry | ForecastEntry

interface Batch {
  sessionID: PermissionV1.Request["sessionID"]
  generation: number
  requestIDs: PermissionV1.ID[]
  deferred: Deferred.Deferred<void>
  policy: () => Effect.Effect<PermissionV1.Ruleset>
  phase: "publishing" | "pending" | "replying" | "settling"
}

interface Grant {
  permission: string
  resources: string[]
}

interface TerminalReply {
  sessionID: PermissionV1.Request["sessionID"]
  requestID: PermissionV1.ID
  reply: PermissionV1.Reply
}

interface State {
  pending: Map<PermissionV1.ID, PendingEntry>
  forecasts: Map<
    PermissionV1.Request["sessionID"],
    { phase: "open" | "closed"; generation: number; candidates: ForecastCandidate[] }
  >
  batches: Map<PermissionV1.BatchID, Batch>
  grants: Map<PermissionV1.Request["sessionID"], Grant[]>
}

export function evaluate(permission: string, pattern: string, ...rulesets: PermissionV1.Ruleset[]): PermissionV1.Rule {
  return (
    rulesets
      .flat()
      .findLast((rule) => Wildcard.match(permission, rule.permission) && Wildcard.match(pattern, rule.pattern)) ?? {
      action: "ask",
      permission,
      pattern: "*",
    }
  )
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/Permission") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const events = yield* EventV2Bridge.Service
    const saved = yield* PermissionSaved.Service
    const lock = Semaphore.makeUnsafe(1)
    const terminal = Effect.fnUntraced(function* (input: TerminalReply) {
      yield* events.publish(Event.Replied, input).pipe(
        Effect.interruptible,
        Effect.timeoutOrElse({
          duration: "1 second",
          orElse: () => Effect.logWarning("permission terminal event publication timed out", input),
        }),
        Effect.catchCause((cause) =>
          Effect.logWarning("permission terminal event publication failed", { ...input, cause }),
        ),
      )
    })
    const state = yield* InstanceState.make<State>(
      Effect.fn("Permission.state")(function* (ctx) {
        void ctx
        const state = {
          pending: new Map<PermissionV1.ID, PendingEntry>(),
          forecasts: new Map<
            PermissionV1.Request["sessionID"],
            { phase: "open" | "closed"; generation: number; candidates: ForecastCandidate[] }
          >(),
          batches: new Map<PermissionV1.BatchID, Batch>(),
          grants: new Map<PermissionV1.Request["sessionID"], Grant[]>(),
        }

        yield* Effect.addFinalizer(() =>
          Effect.uninterruptible(
            Effect.gen(function* () {
              const replies = yield* lock.withPermits(1)(
                Effect.gen(function* () {
                  const replies: TerminalReply[] = []
                  for (const item of state.pending.values()) {
                    if (item.kind === "blocking") yield* Deferred.fail(item.deferred, new PermissionV1.RejectedError())
                  }
                  for (const batch of state.batches.values()) {
                    batch.phase = "settling"
                    for (const requestID of batch.requestIDs) {
                      const item = state.pending.get(requestID)
                      if (!item || item.kind !== "forecast") continue
                      replies.push({ sessionID: item.info.sessionID, requestID, reply: "reject" })
                    }
                    yield* Deferred.succeed(batch.deferred, undefined)
                  }
                  state.pending.clear()
                  state.forecasts.clear()
                  state.batches.clear()
                  state.grants.clear()
                  return replies
                }),
              )
              yield* Effect.forEach(replies, terminal, { discard: true, concurrency: "unbounded" })
            }),
          ),
        )

        return state
      }),
    )

    const projectID = Effect.fnUntraced(function* () {
      const ctx = yield* InstanceState.context
      return ctx.project.id === ProjectV2.ID.global || ctx.project.vcs !== "git" ? undefined : ctx.project.id
    })

    const approvals = Effect.fnUntraced(function* () {
      const project = yield* projectID()
      if (!project) return []
      return (yield* saved.list({ projectID: project })).map(
        (item): PermissionV1.Rule => ({ permission: item.action, pattern: item.resource, action: "allow" }),
      )
    })

    function resolve(
      permission: string,
      pattern: string,
      ruleset: PermissionV1.Ruleset,
      approved: PermissionV1.Ruleset,
    ) {
      const configured = evaluate(permission, pattern, ruleset)
      if (configured.action !== "ask") return configured.action
      return evaluate(permission, pattern, approved).action === "allow" ? "allow" : "ask"
    }

    const query = Effect.fn("Permission.query")(function* (input: {
      permission: string
      pattern: string
      ruleset: PermissionV1.Ruleset
    }) {
      return resolve(input.permission, input.pattern, input.ruleset, yield* approvals())
    })

    const ask = Effect.fn("Permission.ask")(function* (input: PermissionV1.AskInput) {
      const current = yield* InstanceState.get(state)
      const pending = current.pending
      const { ruleset, ...request } = input
      const needed: string[] = []
      const approved = yield* approvals()

      for (const pattern of request.patterns) {
        const action = resolve(request.permission, pattern, ruleset, approved)
        yield* Effect.logInfo("evaluated", { permission: request.permission, pattern, action })
        if (action === "deny") {
          return yield* new PermissionV1.DeniedError({
            ruleset: ruleset.filter((rule) => Wildcard.match(request.permission, rule.permission)),
          })
        }
        if (action === "allow") continue
        needed.push(pattern)
      }

      if (!needed.length) return undefined

      const resources = [...new Set(needed)].toSorted()
      const grants = current.grants.get(request.sessionID) ?? []
      const grant = grants.findIndex(
        (item) =>
          item.permission === request.permission &&
          item.resources.length === resources.length &&
          item.resources.every((resource, index) => resource === resources[index]),
      )
      if (grant !== -1) {
        grants.splice(grant, 1)
        if (!grants.length) current.grants.delete(request.sessionID)
        return undefined
      }

      const id = request.id ?? PermissionV1.ID.ascending()
      const info: PermissionV1.Request = {
        id,
        sessionID: request.sessionID,
        permission: request.permission,
        patterns: request.patterns,
        metadata: request.metadata,
        always: (yield* projectID()) ? request.always : [],
        tool: request.tool,
      }
      yield* Effect.logInfo("asking", { id, permission: info.permission, patterns: info.patterns })

      const deferred = yield* Deferred.make<void, PermissionV1.RejectedError | PermissionV1.CorrectedError>()
      pending.set(id, { kind: "blocking", info, ruleset, deferred })
      yield* events.publish(Event.Asked, info)
      return yield* Effect.ensuring(
        Deferred.await(deferred),
        Effect.sync(() => {
          pending.delete(id)
        }),
      )
    })

    const forecast = Effect.fn("Permission.forecast")(function* (raw: ForecastInput) {
      const input = yield* Schema.decodeUnknownEffect(ForecastInput)(raw)
      const snapshot = (yield* InstanceState.get(state)).forecasts.get(input.sessionID)
      const generation = snapshot?.generation ?? 0
      return yield* lock.withPermits(1)(
        Effect.gen(function* () {
          const current = yield* InstanceState.get(state)
          const previous = current.forecasts.get(input.sessionID)
          if (previous?.phase === "closed" || (previous && previous.generation !== generation)) return []
          const candidates: ForecastCandidate[] = []
          const seen = new Set<string>()

          for (const candidate of input.candidates) {
            const resources: string[] = []
            for (const resource of new Set(candidate.resources)) {
              if ((yield* query({ permission: candidate.action, pattern: resource, ruleset: input.ruleset })) === "ask")
                resources.push(resource)
            }
            if (!resources.length) continue
            const item = { action: candidate.action, resources: resources.toSorted(), reason: candidate.reason }
            const key = JSON.stringify(item)
            if (seen.has(key)) continue
            seen.add(key)
            candidates.push(item)
          }

          current.forecasts.set(input.sessionID, {
            phase: "open",
            generation,
            candidates,
          })
          return candidates
        }),
      )
    })

    const finishLocked = Effect.fnUntraced(function* (current: State, batchID: PermissionV1.BatchID, batch: Batch) {
      for (const requestID of batch.requestIDs) current.pending.delete(requestID)
      current.batches.delete(batchID)
      const forecast = current.forecasts.get(batch.sessionID)
      if (forecast?.phase === "closed" && forecast.generation === batch.generation) {
        current.forecasts.set(batch.sessionID, {
          phase: "open",
          generation: batch.generation + 1,
          candidates: [],
        })
      }
      yield* Deferred.succeed(batch.deferred, undefined)
    })

    const settleLocked = Effect.fnUntraced(function* (current: State, batchID: PermissionV1.BatchID) {
      const batch = current.batches.get(batchID)
      if (!batch) return []
      batch.phase = "settling"
      const replies = batch.requestIDs.flatMap((requestID): TerminalReply[] => {
        const item = current.pending.get(requestID)
        if (!item || item.kind !== "forecast") return []
        return [{ sessionID: item.info.sessionID, requestID, reply: "reject" }]
      })
      yield* finishLocked(current, batchID, batch)
      return replies
    })

    const settle = (batchID: PermissionV1.BatchID) =>
      Effect.uninterruptible(
        Effect.gen(function* () {
          const replies = yield* lock.withPermits(1)(
            Effect.gen(function* () {
              return yield* settleLocked(yield* InstanceState.get(state), batchID)
            }),
          )
          yield* Effect.forEach(replies, terminal, { discard: true, concurrency: "unbounded" })
        }),
      )

    const review = Effect.fn("Permission.review")(
      (input: {
        sessionID: PermissionV1.Request["sessionID"]
        tool?: PermissionV1.Request["tool"]
        policy: () => Effect.Effect<PermissionV1.Ruleset>
      }) =>
        Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            const batch = yield* lock.withPermits(1)(
              Effect.gen(function* () {
                const current = yield* InstanceState.get(state)
                const forecast = current.forecasts.get(input.sessionID)
                if (!forecast) {
                  current.forecasts.set(input.sessionID, {
                    phase: "open",
                    generation: 1,
                    candidates: [],
                  })
                  return undefined
                }
                if (forecast.phase === "closed") return undefined
                current.forecasts.set(input.sessionID, {
                  phase: "closed",
                  generation: forecast.generation,
                  candidates: [],
                })
                if (!forecast.candidates.length) {
                  current.forecasts.set(input.sessionID, {
                    phase: "open",
                    generation: forecast.generation + 1,
                    candidates: [],
                  })
                  return undefined
                }

                const batchID = PermissionV1.BatchID.ascending()
                const deferred = yield* Deferred.make<void>()
                const persist = Boolean(yield* projectID())
                const size = forecast.candidates.length
                const requests = forecast.candidates.map((candidate): ForecastEntry["info"] => ({
                  id: PermissionV1.ID.ascending(),
                  sessionID: input.sessionID,
                  permission: candidate.action,
                  patterns: [...candidate.resources],
                  metadata: {},
                  always: persist ? [...candidate.resources] : [],
                  kind: "forecast",
                  batchID,
                  batchSize: size,
                  reason: candidate.reason,
                  tool: input.tool,
                }))
                const batch: Batch = {
                  sessionID: input.sessionID,
                  generation: forecast.generation,
                  requestIDs: requests.map((item) => item.id),
                  deferred,
                  policy: input.policy,
                  phase: "publishing",
                }
                current.batches.set(batchID, batch)
                for (const info of requests) current.pending.set(info.id, { kind: "forecast", info })
                yield* Effect.forEach(requests, (info) => events.publish(Event.Asked, info), { discard: true })
                batch.phase = "pending"
                return { batchID, deferred }
              }),
            )
            if (!batch) return false
            yield* restore(Deferred.await(batch.deferred)).pipe(Effect.onInterrupt(() => settle(batch.batchID)))
            return true
          }),
        ),
    )

    const replyBatch = Effect.fn("Permission.replyBatch")((raw: PermissionV1.BatchReplyInput) =>
      Effect.gen(function* () {
        const replies = yield* lock.withPermits(1)(
          Effect.uninterruptible(
            Effect.gen(function* () {
              const input = yield* Schema.decodeUnknownEffect(PermissionV1.BatchReplyInput)(raw)
              const current = yield* InstanceState.get(state)
              const batch = current.batches.get(input.batchID)
              if (!batch)
                return yield* new PermissionV1.BatchError({
                  batchID: input.batchID,
                  message: "Forecast batch not found",
                })
              if (batch.phase !== "pending")
                return yield* new PermissionV1.BatchError({ batchID: input.batchID, message: "Forecast batch is busy" })
              const selected = new Set(input.requestIDs)
              if (selected.size !== input.requestIDs.length || (input.reply === "reject" && selected.size > 0))
                return yield* new PermissionV1.BatchError({
                  batchID: input.batchID,
                  message: "Forecast selection is invalid",
                })
              if (input.requestIDs.some((id) => !batch.requestIDs.includes(id)))
                return yield* new PermissionV1.BatchError({
                  batchID: input.batchID,
                  message: "Forecast selection contains a request outside the batch",
                })

              const requests = batch.requestIDs
                .map((id) => current.pending.get(id))
                .filter(
                  (item): item is ForecastEntry => item?.kind === "forecast" && item.info.batchID === input.batchID,
                )
              if (requests.length !== batch.requestIDs.length)
                return yield* new PermissionV1.BatchError({
                  batchID: input.batchID,
                  message: "Forecast batch is incomplete",
                })

              batch.phase = "replying"
              const policy = yield* batch.policy()
              const approved = yield* approvals()
              const project = yield* projectID()
              const decisions = requests.map((item) => {
                if (!selected.has(item.info.id)) return { item, reply: "reject" as const, resources: [] }
                const actions = item.info.patterns.map((pattern) => ({
                  pattern,
                  action: resolve(item.info.permission, pattern, policy, approved),
                }))
                if (actions.some((action) => action.action === "deny"))
                  return { item, reply: "reject" as const, resources: [] }
                const resources = actions.filter((action) => action.action === "ask").map((action) => action.pattern)
                if (!resources.length) return { item, reply: "once" as const, resources }
                const persistent = input.reply === "always" && Boolean(project) && item.info.always.length > 0
                return { item, reply: persistent ? ("always" as const) : ("once" as const), resources }
              })
              const persistent = decisions.filter((item) => item.reply === "always")
              if (persistent.length && project) {
                yield* saved.addBatch({
                  projectID: project,
                  entries: persistent.map((item) => ({
                    action: item.item.info.permission,
                    resources: item.resources,
                  })),
                })
              }

              const once = decisions.filter((item) => item.reply === "once" && item.resources.length)
              if (once.length) {
                const grants = current.grants.get(batch.sessionID) ?? []
                grants.push(
                  ...once.map((item) => ({
                    permission: item.item.info.permission,
                    resources: [...new Set(item.resources)].toSorted(),
                  })),
                )
                if (grants.length) current.grants.set(batch.sessionID, grants)
              }

              const replies = decisions.map(
                (decision): TerminalReply => ({
                  sessionID: decision.item.info.sessionID,
                  requestID: decision.item.info.id,
                  reply: decision.reply,
                }),
              )
              yield* finishLocked(current, input.batchID, batch)
              return replies
            }).pipe(
              Effect.ensuring(
                Effect.gen(function* () {
                  const current = yield* InstanceState.get(state)
                  const batch = current.batches.get(raw.batchID)
                  if (batch?.phase === "replying") batch.phase = "pending"
                }),
              ),
            ),
          ),
        )
        yield* Effect.forEach(replies, terminal, { discard: true, concurrency: "unbounded" })
      }),
    )

    const reply = Effect.fn("Permission.reply")((input: PermissionV1.ReplyInput) =>
      Effect.uninterruptible(
        Effect.gen(function* () {
          const { pending } = yield* InstanceState.get(state)
          const existing = pending.get(input.requestID)
          if (!existing) return yield* new PermissionV1.NotFoundError({ requestID: input.requestID })
          if (existing.kind === "forecast") {
            yield* replyBatch({
              batchID: existing.info.batchID,
              requestIDs: input.reply === "reject" ? [] : [existing.info.id],
              reply: input.reply,
            }).pipe(Effect.mapError(() => new PermissionV1.NotFoundError({ requestID: input.requestID })))
            return undefined
          }
          const project = yield* projectID()
          const answer = input.reply === "always" && (!existing.info.always.length || !project) ? "once" : input.reply

          if (answer === "always" && project) {
            yield* saved.add({
              projectID: project,
              action: existing.info.permission,
              resources: existing.info.always,
            })
          }

          yield* events.publish(Event.Replied, {
            sessionID: existing.info.sessionID,
            requestID: existing.info.id,
            reply: answer,
          })

          if (answer === "reject") {
            yield* Deferred.fail(
              existing.deferred,
              input.message
                ? new PermissionV1.CorrectedError({ feedback: input.message })
                : new PermissionV1.RejectedError(),
            )
            pending.delete(input.requestID)

            for (const [id, item] of pending.entries()) {
              if (item.kind !== "blocking") continue
              if (item.info.sessionID !== existing.info.sessionID) continue
              yield* events.publish(Event.Replied, {
                sessionID: item.info.sessionID,
                requestID: item.info.id,
                reply: "reject",
              })
              yield* Deferred.fail(item.deferred, new PermissionV1.RejectedError())
              pending.delete(id)
            }
            return undefined
          }

          yield* Deferred.succeed(existing.deferred, undefined)
          pending.delete(input.requestID)
          if (answer === "once") return undefined

          const approved = yield* approvals()
          for (const [id, item] of pending.entries()) {
            if (item.kind !== "blocking") continue
            if (item.info.sessionID !== existing.info.sessionID) continue
            const ok = item.info.patterns.every(
              (pattern) => resolve(item.info.permission, pattern, item.ruleset, approved) === "allow",
            )
            if (!ok) continue
            yield* events.publish(Event.Replied, {
              sessionID: item.info.sessionID,
              requestID: item.info.id,
              reply: "always",
            })
            yield* Deferred.succeed(item.deferred, undefined)
            pending.delete(id)
          }
          return undefined
        }),
      ),
    )

    const list = Effect.fn("Permission.list")(function* () {
      const pending = (yield* InstanceState.get(state)).pending
      return Array.from(pending.values(), (item) => item.info)
    })

    return Service.of({ ask, query, reply, forecast, review, replyBatch, list })
  }),
)

function expand(pattern: string): string {
  if (pattern.startsWith("~/")) return os.homedir() + pattern.slice(1)
  if (pattern === "~") return os.homedir()
  if (pattern.startsWith("$HOME/")) return os.homedir() + pattern.slice(5)
  if (pattern.startsWith("$HOME")) return os.homedir() + pattern.slice(5)
  return pattern
}

export function fromConfig(permission: ConfigPermissionV1.Info) {
  const ruleset: PermissionV1.Rule[] = []
  for (const [key, value] of Object.entries(permission)) {
    if (typeof value === "string") {
      ruleset.push({ permission: key, action: value, pattern: "*" })
      continue
    }
    ruleset.push(
      ...Object.entries(value).map(([pattern, action]) => ({ permission: key, pattern: expand(pattern), action })),
    )
  }
  return ruleset
}

export function merge(...rulesets: PermissionV1.Ruleset[]): PermissionV1.Rule[] {
  return rulesets.flat()
}

export function disabled(tools: string[], ruleset: PermissionV1.Ruleset): Set<string> {
  const edits = ["edit", "write", "apply_patch"]
  return new Set(
    tools.filter((tool) => {
      const permission = edits.includes(tool) ? "edit" : tool
      const rule = ruleset.findLast((rule) => Wildcard.match(permission, rule.permission))
      return rule?.pattern === "*" && rule.action === "deny"
    }),
  )
}

export const defaultLayer = layer.pipe(
  Layer.provide(EventV2Bridge.defaultLayer),
  Layer.provideMerge(PermissionSaved.defaultLayer),
)

export const node = LayerNode.make(layer, [EventV2Bridge.node, PermissionSaved.node])

export * as Permission from "."
