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
  candidates: Schema.Array(ForecastCandidate).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(ForecastLimits.candidates),
  ),
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
  requestIDs: PermissionV1.ID[]
  deferred: Deferred.Deferred<void>
}

interface Grant {
  permission: string
  resources: string[]
}

interface State {
  pending: Map<PermissionV1.ID, PendingEntry>
  forecasts: Map<PermissionV1.Request["sessionID"], ForecastCandidate[]>
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
    const state = yield* InstanceState.make<State>(
      Effect.fn("Permission.state")(function* (ctx) {
        void ctx
        const state = {
          pending: new Map<PermissionV1.ID, PendingEntry>(),
          forecasts: new Map<PermissionV1.Request["sessionID"], ForecastCandidate[]>(),
          batches: new Map<PermissionV1.BatchID, Batch>(),
          grants: new Map<PermissionV1.Request["sessionID"], Grant[]>(),
        }

        yield* Effect.addFinalizer(() =>
          Effect.gen(function* () {
            for (const item of state.pending.values()) {
              if (item.kind === "blocking") yield* Deferred.fail(item.deferred, new PermissionV1.RejectedError())
              if (item.kind === "forecast") {
                yield* events.publish(Event.Replied, {
                  sessionID: item.info.sessionID,
                  requestID: item.info.id,
                  reply: "reject",
                })
              }
            }
            for (const batch of state.batches.values()) yield* Deferred.succeed(batch.deferred, undefined)
            state.pending.clear()
            state.forecasts.clear()
            state.batches.clear()
            state.grants.clear()
          }),
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
      const current = yield* InstanceState.get(state)
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

      if (candidates.length) current.forecasts.set(input.sessionID, candidates)
      if (!candidates.length) current.forecasts.delete(input.sessionID)
      return candidates
    })

    const settle = Effect.fnUntraced(function* (batchID: PermissionV1.BatchID) {
      const current = yield* InstanceState.get(state)
      const batch = current.batches.get(batchID)
      if (!batch) return
      for (const requestID of batch.requestIDs) {
        const item = current.pending.get(requestID)
        if (!item || item.kind !== "forecast") continue
        yield* events.publish(Event.Replied, {
          sessionID: item.info.sessionID,
          requestID,
          reply: "reject",
        })
        current.pending.delete(requestID)
      }
      current.batches.delete(batchID)
      yield* Deferred.succeed(batch.deferred, undefined)
    })

    const review = Effect.fn("Permission.review")(
      (input: { sessionID: PermissionV1.Request["sessionID"]; tool?: PermissionV1.Request["tool"] }) =>
        Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            const current = yield* InstanceState.get(state)
            const candidates = current.forecasts.get(input.sessionID) ?? []
            current.forecasts.delete(input.sessionID)
            if (!candidates.length) return false

            const batchID = PermissionV1.BatchID.ascending()
            const deferred = yield* Deferred.make<void>()
            const persist = Boolean(yield* projectID())
            const requests = candidates.map((candidate): ForecastEntry["info"] => ({
              id: PermissionV1.ID.ascending(),
              sessionID: input.sessionID,
              permission: candidate.action,
              patterns: [...candidate.resources],
              metadata: {},
              always: persist ? [...candidate.resources] : [],
              kind: "forecast",
              batchID,
              reason: candidate.reason,
              tool: input.tool,
            }))
            current.batches.set(batchID, {
              sessionID: input.sessionID,
              requestIDs: requests.map((item) => item.id),
              deferred,
            })
            for (const info of requests) current.pending.set(info.id, { kind: "forecast", info })
            yield* Effect.forEach(requests, (info) => events.publish(Event.Asked, info), { discard: true })
            yield* restore(Deferred.await(deferred)).pipe(Effect.onInterrupt(() => settle(batchID)))
            return true
          }),
        ),
    )

    const replyBatch = Effect.fn("Permission.replyBatch")((raw: PermissionV1.BatchReplyInput) =>
      lock.withPermits(1)(
        Effect.uninterruptible(
          Effect.gen(function* () {
            const input = yield* Schema.decodeUnknownEffect(PermissionV1.BatchReplyInput)(raw)
            const current = yield* InstanceState.get(state)
            const batch = current.batches.get(input.batchID)
            if (!batch)
              return yield* new PermissionV1.BatchError({ batchID: input.batchID, message: "Forecast batch not found" })
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
              .filter((item): item is ForecastEntry => item?.kind === "forecast" && item.info.batchID === input.batchID)
            if (requests.length !== batch.requestIDs.length)
              return yield* new PermissionV1.BatchError({
                batchID: input.batchID,
                message: "Forecast batch is incomplete",
              })

            const picked = requests.filter((item) => selected.has(item.info.id))
            const project = yield* projectID()
            const persistent =
              input.reply === "always" && Boolean(project) && picked.every((item) => item.info.always.length)
            if (persistent && project) {
              yield* saved.addBatch({
                projectID: project,
                entries: picked.map((item) => ({ action: item.info.permission, resources: item.info.always })),
              })
            }

            if (input.reply === "once" || (input.reply === "always" && !persistent)) {
              const grants = current.grants.get(batch.sessionID) ?? []
              grants.push(
                ...picked.map((item) => ({
                  permission: item.info.permission,
                  resources: [...new Set(item.info.patterns)].toSorted(),
                })),
              )
              if (grants.length) current.grants.set(batch.sessionID, grants)
            }

            for (const item of requests) {
              const reply = selected.has(item.info.id) ? (persistent ? "always" : "once") : "reject"
              yield* events.publish(Event.Replied, {
                sessionID: item.info.sessionID,
                requestID: item.info.id,
                reply,
              })
            }
            for (const requestID of batch.requestIDs) current.pending.delete(requestID)
            current.batches.delete(input.batchID)
            return yield* Deferred.succeed(batch.deferred, undefined)
          }),
        ),
      ),
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
            }).pipe(Effect.orDie)
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
