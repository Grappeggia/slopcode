import { LayerNode } from "@slopcode-ai/core/effect/layer-node"
import { ConfigPermissionV1 } from "@slopcode-ai/core/v1/config/permission"
import { InstanceState } from "@/effect/instance-state"
import { Wildcard } from "@slopcode-ai/core/util/wildcard"
import { Deferred, Effect, Fiber, Layer, Context, Schema, Scope, Semaphore } from "effect"
import os from "os"
import { PermissionV1 } from "@slopcode-ai/core/v1/permission"
import { EventV2Bridge } from "@/event-v2-bridge"
import { EventV2 } from "@slopcode-ai/core/event"
import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { AbsolutePath } from "@slopcode-ai/core/schema"

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
const ExactResource = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(ForecastLimits.resource))
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

type AskInput = PermissionV1.AskInput & { policy?: () => Effect.Effect<PermissionV1.Ruleset> }

export interface Interface {
  readonly ask: (input: AskInput) => Effect.Effect<void, PermissionV1.Error>
  readonly query: (input: {
    permission: string
    pattern: string
    ruleset: PermissionV1.Ruleset
    sessionID?: PermissionV1.Request["sessionID"]
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
  readonly get: (id: PermissionV1.ID) => Effect.Effect<PermissionV1.Request | undefined>
}

interface BlockingEntry {
  kind: "blocking"
  info: PermissionV1.Request
  ruleset: PermissionV1.Ruleset
  policy: () => Effect.Effect<PermissionV1.Ruleset>
  deferred: Deferred.Deferred<void, PermissionV1.RejectedError | PermissionV1.CorrectedError>
  phase: "publishing" | "pending"
  answer?: {
    reply: PermissionV1.Reply
    error?: PermissionV1.RejectedError | PermissionV1.CorrectedError
  }
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
  exposed: PermissionV1.ID[]
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
  active: Map<PermissionV1.Request["sessionID"], PermissionV1.BatchID>
  grants: Map<PermissionV1.Request["sessionID"], Grant[]>
  approvals: Map<PermissionV1.Request["sessionID"], Grant[]>
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
    const scope = yield* Scope.Scope
    const lock = Semaphore.makeUnsafe(1)
    const publish = <A>(effect: Effect.Effect<A>, kind: "asked" | "terminal", input: object) =>
      Effect.uninterruptible(
        Effect.gen(function* () {
          const fiber = yield* effect.pipe(
            Effect.interruptible,
            Effect.as(true),
            Effect.timeoutOrElse({
              duration: "1 second",
              orElse: () =>
                Effect.logWarning(`permission ${kind} event publication timed out`, input).pipe(Effect.as(false)),
            }),
            Effect.catchCause((cause) =>
              Effect.logWarning(`permission ${kind} event publication failed`, { ...input, cause }).pipe(
                Effect.as(false),
              ),
            ),
            Effect.forkIn(scope),
          )
          return yield* Fiber.join(fiber)
        }),
      )
    const asked = (input: PermissionV1.Request) => publish(events.publish(Event.Asked, input), "asked", input)
    const terminal = (input: TerminalReply) => publish(events.publish(Event.Replied, input), "terminal", input)
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
          active: new Map<PermissionV1.Request["sessionID"], PermissionV1.BatchID>(),
          grants: new Map<PermissionV1.Request["sessionID"], Grant[]>(),
          approvals: new Map<PermissionV1.Request["sessionID"], Grant[]>(),
        }

        yield* Effect.addFinalizer(() =>
          Effect.uninterruptible(
            Effect.gen(function* () {
              const replies = yield* lock.withPermits(1)(
                Effect.gen(function* () {
                  const replies: TerminalReply[] = []
                  for (const item of state.pending.values()) {
                    if (item.kind !== "blocking") continue
                    const answer = item.answer ?? { reply: "reject" as const, error: new PermissionV1.RejectedError() }
                    if (answer.error) yield* Deferred.fail(item.deferred, answer.error)
                    else yield* Deferred.succeed(item.deferred, undefined)
                    replies.push({ sessionID: item.info.sessionID, requestID: item.info.id, reply: answer.reply })
                  }
                  for (const batch of state.batches.values()) {
                    batch.phase = "settling"
                    for (const requestID of batch.exposed) {
                      const item = state.pending.get(requestID)
                      if (!item || item.kind !== "forecast") continue
                      replies.push({ sessionID: item.info.sessionID, requestID, reply: "reject" })
                    }
                    yield* Deferred.succeed(batch.deferred, undefined)
                  }
                  state.pending.clear()
                  state.forecasts.clear()
                  state.batches.clear()
                  state.active.clear()
                  state.grants.clear()
                  state.approvals.clear()
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

    const location = Effect.fnUntraced(function* () {
      const ctx = yield* InstanceState.context
      return {
        directory: AbsolutePath.make(ctx.directory),
        project: { id: ctx.project.id, directory: AbsolutePath.make(ctx.worktree) },
        vcs:
          ctx.project.id !== ProjectV2.ID.global && ctx.project.vcs === "git"
            ? { type: "git" as const, store: AbsolutePath.make(ctx.worktree) }
            : undefined,
      }
    })

    const approvals = Effect.fnUntraced(function* (sessionID?: PermissionV1.Request["sessionID"]) {
      const rows = yield* Effect.all([
        saved.list({ scope: "global" }),
        sessionID ? saved.list({ scope: "session", sessionID }) : Effect.succeed([]),
        saved.listCurrent(yield* location()),
      ]).pipe(Effect.map((rows) => rows.flat()))
      if (!sessionID) return rows
      return [
        ...rows,
        ...((yield* InstanceState.get(state)).approvals.get(sessionID) ?? []).flatMap((item) =>
          item.resources.map((resource) => ({ action: item.permission, resource, match: "pattern" as const })),
        ),
      ]
    })

    const approve = Effect.fnUntraced(function* (
      sessionID: PermissionV1.Request["sessionID"],
      permission: string,
      resources: ReadonlyArray<string>,
    ) {
      if (!resources.length) return
      const current = yield* InstanceState.get(state)
      const rows = current.approvals.get(sessionID) ?? []
      rows.push({ permission, resources: [...new Set(resources)].toSorted() })
      current.approvals.set(sessionID, rows)
    })

    function approved(
      permission: string,
      pattern: string,
      rows: ReadonlyArray<Pick<PermissionSaved.Info, "action" | "resource" | "match">>,
    ) {
      return rows.some((row) =>
        row.match === "exact"
          ? row.action === permission && row.resource === pattern
          : Wildcard.match(permission, row.action) && Wildcard.match(pattern, row.resource),
      )
    }

    function resolve(
      permission: string,
      pattern: string,
      ruleset: PermissionV1.Ruleset,
      rows: ReadonlyArray<Pick<PermissionSaved.Info, "action" | "resource" | "match">>,
    ) {
      const configured = evaluate(permission, pattern, ruleset)
      if (configured.action !== "ask") return configured.action
      if (permission === "external_directory") return "ask"
      return approved(permission, pattern, rows) ? "allow" : "ask"
    }

    const settleBlocking = Effect.fnUntraced(function* (
      current: State,
      id: PermissionV1.ID,
      item: BlockingEntry,
      reply: PermissionV1.Reply,
      error?: PermissionV1.RejectedError | PermissionV1.CorrectedError,
    ) {
      if (item.phase === "publishing") {
        item.answer = { reply, ...(error ? { error } : {}) }
        return undefined
      }
      current.pending.delete(id)
      if (error) yield* Deferred.fail(item.deferred, error)
      else yield* Deferred.succeed(item.deferred, undefined)
      return { sessionID: item.info.sessionID, requestID: item.info.id, reply }
    })

    const resolvePending = Effect.fnUntraced(function* (
      current: State,
      reply: "always" | "project" | "session" | "global",
      sessionID: PermissionV1.Request["sessionID"],
    ) {
      const replies: TerminalReply[] = []
      for (const [id, item] of current.pending.entries()) {
        if (item.kind !== "blocking" || item.answer) continue
        if (reply !== "project" && reply !== "global" && item.info.sessionID !== sessionID) continue
        const rows = yield* approvals(item.info.sessionID)
        const ruleset = yield* item.policy()
        const ok = item.info.patterns.every(
          (pattern) => resolve(item.info.permission, pattern, ruleset, rows) === "allow",
        )
        if (!ok) continue
        const settled = yield* settleBlocking(current, id, item, reply)
        if (settled) replies.push(settled)
      }
      return replies
    })

    const query = Effect.fn("Permission.query")(function* (input: {
      permission: string
      pattern: string
      ruleset: PermissionV1.Ruleset
      sessionID?: PermissionV1.Request["sessionID"]
    }) {
      return resolve(input.permission, input.pattern, input.ruleset, yield* approvals(input.sessionID))
    })

    const ask = Effect.fn("Permission.ask")(function* (input: AskInput) {
      const { ruleset, policy, ...request } = input
      const needed: string[] = []
      const approved = yield* approvals(request.sessionID)

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
      const id = request.id ?? PermissionV1.ID.ascending()
      const info: PermissionV1.Request = {
        id,
        sessionID: request.sessionID,
        permission: request.permission,
        patterns: request.patterns,
        metadata: request.metadata,
        always: request.always,
        grant:
          request.permission === "external_directory"
            ? undefined
            : { resources, scopes: ["session" as const, "global" as const] },
        tool: request.tool,
      }
      yield* Effect.logInfo("asking", { id, permission: info.permission, patterns: info.patterns })

      const deferred = yield* Deferred.make<void, PermissionV1.RejectedError | PermissionV1.CorrectedError>()
      const entry: BlockingEntry = {
        kind: "blocking",
        info,
        ruleset,
        policy: policy ?? (() => Effect.succeed(ruleset)),
        deferred,
        phase: "publishing",
      }
      return yield* Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          yield* restore(lock.take(1))
          const registered = yield* Effect.gen(function* () {
            const current = yield* InstanceState.get(state)
            const rows = yield* approvals(request.sessionID)
            if (request.patterns.every((pattern) => resolve(request.permission, pattern, ruleset, rows) === "allow"))
              return false
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
              return false
            }
            current.pending.set(id, entry)
            return true
          }).pipe(Effect.ensuring(lock.release(1)))
          if (!registered) return undefined

          const cancel = () =>
            Effect.uninterruptible(
              Effect.gen(function* () {
                const reply = yield* lock.withPermits(1)(
                  Effect.gen(function* () {
                    const current = yield* InstanceState.get(state)
                    if (current.pending.get(id) !== entry) return undefined
                    current.pending.delete(id)
                    const error = new PermissionV1.RejectedError()
                    yield* Deferred.fail(deferred, error)
                    return { sessionID: info.sessionID, requestID: info.id, reply: "reject" as const }
                  }),
                )
                if (reply) yield* terminal(reply)
              }),
            )

          const published = yield* asked(info)
          const reply = yield* lock.withPermits(1)(
            Effect.gen(function* () {
              const current = yield* InstanceState.get(state)
              if (current.pending.get(id) !== entry) return undefined
              if (!entry.answer && published) {
                entry.phase = "pending"
                return undefined
              }

              const answer = entry.answer ?? {
                reply: "reject" as const,
                error: new PermissionV1.RejectedError(),
              }
              current.pending.delete(id)
              if (answer.error) yield* Deferred.fail(deferred, answer.error)
              else yield* Deferred.succeed(deferred, undefined)
              return { sessionID: info.sessionID, requestID: info.id, reply: answer.reply }
            }),
          )
          if (reply) yield* terminal(reply)
          return yield* restore(Deferred.await(deferred)).pipe(Effect.onInterrupt(cancel))
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
              if (
                (yield* query({
                  permission: candidate.action,
                  pattern: resource,
                  ruleset: input.ruleset,
                  sessionID: input.sessionID,
                })) === "ask"
              )
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
      if (current.active.get(batch.sessionID) === batchID) current.active.delete(batch.sessionID)
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
      const replies = batch.exposed.flatMap((requestID): TerminalReply[] => {
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

    const publishBatch = Effect.fnUntraced(function* (input: {
      batchID: PermissionV1.BatchID
      batch: Batch
      requests: ForecastEntry["info"][]
    }) {
      for (const info of input.requests) {
        const exposed = yield* lock.withPermits(1)(
          Effect.gen(function* () {
            const current = yield* InstanceState.get(state)
            const batch = current.batches.get(input.batchID)
            if (batch !== input.batch || batch.phase !== "publishing") return false
            batch.exposed.push(info.id)
            return true
          }),
        )
        if (!exposed) return false
        if (yield* asked(info)) continue
        const replies = yield* lock.withPermits(1)(
          Effect.gen(function* () {
            return yield* settleLocked(yield* InstanceState.get(state), input.batchID)
          }),
        )
        yield* Effect.forEach(replies, terminal, { discard: true, concurrency: "unbounded" })
        return false
      }

      return yield* lock.withPermits(1)(
        Effect.gen(function* () {
          const current = yield* InstanceState.get(state)
          const batch = current.batches.get(input.batchID)
          if (batch !== input.batch || batch.phase !== "publishing") return false
          batch.phase = "pending"
          return true
        }),
      )
    })

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
                const activeID = current.active.get(input.sessionID)
                const active = activeID ? current.batches.get(activeID) : undefined
                if (activeID && active) return { batchID: activeID, batch: active, owner: false as const, requests: [] }
                if (activeID) current.active.delete(input.sessionID)
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
                const size = forecast.candidates.length
                const requests = forecast.candidates.map((candidate): ForecastEntry["info"] => ({
                  id: PermissionV1.ID.ascending(),
                  sessionID: input.sessionID,
                  permission: candidate.action,
                  patterns: [...candidate.resources],
                  metadata: {},
                  always: [...candidate.resources],
                  grant:
                    candidate.action === "external_directory"
                      ? undefined
                      : { resources: [...candidate.resources], scopes: ["session" as const, "global" as const] },
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
                  exposed: [],
                  deferred,
                  policy: input.policy,
                  phase: "publishing",
                }
                current.batches.set(batchID, batch)
                current.active.set(input.sessionID, batchID)
                for (const info of requests) current.pending.set(info.id, { kind: "forecast", info })
                return { batchID, batch, owner: true as const, requests }
              }),
            )
            if (!batch) return false
            if (batch.owner) yield* publishBatch(batch)
            yield* restore(Deferred.await(batch.batch.deferred)).pipe(
              Effect.onInterrupt(() => (batch.owner ? settle(batch.batchID) : Effect.void)),
            )
            return true
          }),
        ),
    )

    const replyBatch = Effect.fn("Permission.replyBatch")((raw: PermissionV1.BatchReplyInput) =>
      Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const input = yield* restore(Schema.decodeUnknownEffect(PermissionV1.BatchReplyInput)(raw))
          yield* restore(lock.take(1))
          const replies = yield* Effect.gen(function* () {
            const current = yield* InstanceState.get(state)
            const batch = current.batches.get(input.batchID)
            if (!batch)
              return yield* new PermissionV1.BatchError({
                batchID: input.batchID,
                message: "Forecast batch not found",
              })
            if (batch.phase !== "publishing" && batch.phase !== "pending")
              return yield* new PermissionV1.BatchError({
                batchID: input.batchID,
                message: "Forecast batch is busy",
              })
            const phase = batch.phase
            const requestIDs = phase === "publishing" ? batch.exposed : batch.requestIDs
            const selected = new Set(input.requestIDs)
            if (selected.size !== input.requestIDs.length || (input.reply === "reject" && selected.size > 0))
              return yield* new PermissionV1.BatchError({
                batchID: input.batchID,
                message: "Forecast selection is invalid",
              })
            if (input.requestIDs.some((id) => !requestIDs.includes(id)))
              return yield* new PermissionV1.BatchError({
                batchID: input.batchID,
                message: "Forecast selection contains a request outside the exposed batch",
              })

            const requests = requestIDs
              .map((id) => current.pending.get(id))
              .filter((item): item is ForecastEntry => item?.kind === "forecast" && item.info.batchID === input.batchID)
            if (requests.length !== requestIDs.length)
              return yield* new PermissionV1.BatchError({
                batchID: input.batchID,
                message: "Forecast batch is incomplete",
              })

            batch.phase = "replying"
            return yield* Effect.gen(function* () {
              const policy = yield* batch.policy()
              const approved = yield* approvals(batch.sessionID)
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
                const scoped =
                  (input.reply === "session" || input.reply === "global") && Boolean(item.info.grant?.resources.length)
                const durable = input.reply === "project" && item.info.always.length > 0
                return {
                  item,
                  reply:
                    input.reply === "always"
                      ? ("always" as const)
                      : scoped
                        ? input.reply
                        : durable
                          ? ("project" as const)
                          : ("once" as const),
                  resources,
                }
              })
              const persistent = decisions.filter(
                (item) => item.reply === "project" || item.reply === "session" || item.reply === "global",
              )
              if (persistent.length && input.reply === "session") {
                yield* saved.addBatch({
                  scope: "session",
                  sessionID: batch.sessionID,
                  entries: persistent.map((item) => ({
                    action: item.item.info.permission,
                    resources: item.resources,
                  })),
                })
              }
              if (persistent.length && input.reply === "global") {
                yield* saved.addBatch({
                  scope: "global",
                  entries: persistent.map((item) => ({
                    action: item.item.info.permission,
                    resources: item.resources,
                  })),
                })
              }
              if (persistent.length && input.reply === "project") {
                const owner = PermissionSaved.current(yield* location())
                yield* saved.addBatch({
                  ...owner,
                  entries: persistent.map((item) => ({
                    action: item.item.info.permission,
                    resources: item.item.info.always,
                  })),
                })
              }

              for (const item of decisions) {
                if (item.reply !== "always") continue
                yield* approve(batch.sessionID, item.item.info.permission, item.item.info.always)
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
              if (
                (input.reply === "always" || input.reply === "project") &&
                decisions.some((item) => item.reply === input.reply)
              )
                replies.push(...(yield* resolvePending(current, input.reply, batch.sessionID)))
              yield* finishLocked(current, input.batchID, batch)
              return replies
            }).pipe(
              Effect.ensuring(
                Effect.sync(() => {
                  if (current.batches.get(input.batchID) === batch && batch.phase === "replying") batch.phase = phase
                }),
              ),
            )
          }).pipe(Effect.ensuring(lock.release(1)))
          yield* Effect.forEach(replies, terminal, { discard: true, concurrency: "unbounded" })
        }),
      ),
    )

    const reply = Effect.fn("Permission.reply")((input: PermissionV1.ReplyInput) =>
      Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          yield* restore(lock.take(1))
          const result = yield* Effect.gen(function* () {
            const current = yield* InstanceState.get(state)
            const existing = current.pending.get(input.requestID)
            if (!existing || (existing.kind === "blocking" && existing.answer))
              return yield* new PermissionV1.NotFoundError({ requestID: input.requestID })
            if (existing.kind === "forecast") return { kind: "forecast" as const, batchID: existing.info.batchID }

            const replies: TerminalReply[] = []
            const settle = Effect.fnUntraced(function* (
              id: PermissionV1.ID,
              item: BlockingEntry,
              reply: PermissionV1.Reply,
              error?: PermissionV1.RejectedError | PermissionV1.CorrectedError,
            ) {
              const settled = yield* settleBlocking(current, id, item, reply, error)
              if (settled) replies.push(settled)
            })

            if (input.reply === "reject") {
              for (const [id, item] of current.pending.entries()) {
                if (item.kind !== "blocking" || item.answer || item.info.sessionID !== existing.info.sessionID) continue
                const error =
                  item === existing && input.message
                    ? new PermissionV1.CorrectedError({ feedback: input.message })
                    : new PermissionV1.RejectedError()
                yield* settle(id, item, "reject", error)
              }
              return { kind: "blocking" as const, replies }
            }

            const approved = yield* approvals(existing.info.sessionID)
            const ruleset = yield* existing.policy()
            const actions = existing.info.patterns.map((pattern) => ({
              pattern,
              action: resolve(existing.info.permission, pattern, ruleset, approved),
            }))
            const resources = actions.filter((action) => action.action === "ask").map((action) => action.pattern)
            const shown = new Set(existing.info.grant?.resources ?? [])
            const exact = resources.filter((resource) => shown.has(resource))
            const expanded = Boolean(existing.info.grant) && resources.some((resource) => !shown.has(resource))
            const requested =
              input.reply === "project" && !existing.info.always.length
                ? ("once" as const)
                : (input.reply === "session" || input.reply === "global") && !existing.info.grant?.resources.length
                  ? ("once" as const)
                  : input.reply
            const answer =
              actions.some((action) => action.action === "deny") || expanded
                ? ("reject" as const)
                : resources.length
                  ? requested
                  : ("once" as const)
            if (answer === "project") {
              const owner = PermissionSaved.current(yield* location())
              yield* saved.add({
                ...owner,
                action: existing.info.permission,
                resources: existing.info.always,
              })
            }
            if (answer === "always")
              yield* approve(existing.info.sessionID, existing.info.permission, existing.info.always)
            if (answer === "session")
              yield* saved.add({
                scope: "session",
                sessionID: existing.info.sessionID,
                action: existing.info.permission,
                resources: exact,
              })
            if (answer === "global")
              yield* saved.add({ scope: "global", action: existing.info.permission, resources: exact })

            if (answer === "reject") {
              for (const [id, item] of current.pending.entries()) {
                if (item.kind !== "blocking" || item.answer || item.info.sessionID !== existing.info.sessionID) continue
                const error =
                  item === existing && input.message
                    ? new PermissionV1.CorrectedError({ feedback: input.message })
                    : new PermissionV1.RejectedError()
                yield* settle(id, item, "reject", error)
              }
              return { kind: "blocking" as const, replies }
            }

            yield* settle(input.requestID, existing, answer)
            if (answer === "once") return { kind: "blocking" as const, replies }
            replies.push(...(yield* resolvePending(current, answer, existing.info.sessionID)))
            return { kind: "blocking" as const, replies }
          }).pipe(Effect.ensuring(lock.release(1)))

          if (result.kind === "forecast") {
            yield* replyBatch({
              batchID: result.batchID,
              requestIDs: input.reply === "reject" ? [] : [input.requestID],
              reply: input.reply,
            }).pipe(Effect.mapError(() => new PermissionV1.NotFoundError({ requestID: input.requestID })))
            return undefined
          }
          yield* Effect.forEach(result.replies, terminal, { discard: true, concurrency: "unbounded" })
          return undefined
        }),
      ),
    )

    const list = Effect.fn("Permission.list")(function* () {
      return yield* lock.withPermits(1)(
        Effect.gen(function* () {
          const current = yield* InstanceState.get(state)
          return Array.from(current.pending.values()).flatMap((item) => {
            if (item.kind === "blocking") return item.phase === "pending" ? [item.info] : []
            return current.batches.get(item.info.batchID)?.phase === "pending" ? [item.info] : []
          })
        }),
      )
    })

    const get = Effect.fn("Permission.get")(function* (id: PermissionV1.ID) {
      return yield* lock.withPermits(1)(
        Effect.gen(function* () {
          return (yield* InstanceState.get(state)).pending.get(id)?.info
        }),
      )
    })

    return Service.of({ ask, query, reply, forecast, review, replyBatch, list, get })
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
