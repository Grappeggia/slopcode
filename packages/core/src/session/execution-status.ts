export * as SessionExecutionStatus from "./execution-status"

import { createHash } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { and, asc, eq } from "drizzle-orm"
import { Clock, Context, DateTime, Effect, Layer, Schema } from "effect"
import { Database } from "../database/database"
import { EventV2 } from "../event"
import { EventTable } from "../event/sql"
import { NonNegativeInt } from "../schema"
import { SessionEvent } from "./event"
import { SessionMessage } from "./message"
import { SessionRuntime } from "./runtime"
import { SessionProviderRetry } from "./provider-retry"
import { SessionSchema } from "./schema"
import { SessionExecutionStatusTable, SessionTable } from "./sql"

export const Activity = Schema.Literals(["prompt", "shell", "compaction", "task"])
export type Activity = typeof Activity.Type
export const Phase = Schema.Literals(["preparing", "provider", "tool", "shell", "compaction", "task", "settling"])
export type Phase = typeof Phase.Type
export const TerminalCode = Schema.Literals([
  "interrupted",
  "restart",
  "runtime-replaced",
  "provider-nonretryable",
  "provider-exhausted",
  "runner-failure",
  "step-limit",
])
export type TerminalCode = typeof TerminalCode.Type

const Identity = {
  activityID: SessionMessage.ID,
  rootID: SessionMessage.ID,
  activity: Activity,
}
const Fingerprint = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/))
const Active = {
  ...Identity,
  phase: Phase,
  owner: Schema.Literal("v2"),
  epoch: NonNegativeInt,
  seq: NonNegativeInt,
  requestAttempt: NonNegativeInt.pipe(Schema.optional),
  providerAttempt: NonNegativeInt.pipe(Schema.optional),
  structuredAttempt: NonNegativeInt.pipe(Schema.optional),
  fingerprint: Fingerprint.pipe(Schema.optional),
}
export const Info = Schema.Union([
  Schema.Struct({ type: Schema.Literal("idle") }),
  Schema.Struct({
    type: Schema.Literal("busy"),
    ...Active,
    recovery: Schema.Literals(["retry-provider", "continue-provider", "interrupt"]).pipe(Schema.optional),
  }),
  Schema.Struct({
    type: Schema.Literal("retrying"),
    ...Active,
    attempt: NonNegativeInt,
    maxAttempts: NonNegativeInt,
    nextAt: NonNegativeInt,
    code: SessionEvent.Execution.RetryCode,
    action: SessionEvent.Execution.RetryAction,
    message: SessionEvent.Execution.Message,
    recovery: Schema.Literals(["retry-provider", "interrupt"]),
    fingerprint: Fingerprint,
  }),
  Schema.Struct({ type: Schema.Literal("interrupted"), ...Active, code: TerminalCode, message: SessionEvent.Execution.Message }),
  Schema.Struct({ type: Schema.Literal("terminal-failure"), ...Active, code: TerminalCode, message: SessionEvent.Execution.Message }),
]).pipe(Schema.toTaggedUnion("type"))
export type Info = typeof Info.Type

type Fence = {
  readonly sessionID: SessionSchema.ID
  readonly owner: "v2"
  readonly epoch: number
  readonly runtimeState: "draining"
}
type IdentityInput = {
  readonly activityID: SessionMessage.ID
  readonly rootID: SessionMessage.ID
  readonly activity: Activity
}
type ActiveInput = Fence & IdentityInput & {
  readonly phase: Phase
  readonly requestAttempt?: number
  readonly providerAttempt?: number
  readonly structuredAttempt?: number
  readonly fingerprint?: string
}

export class NotFound extends Schema.TaggedErrorClass<NotFound>()("SessionExecutionStatus.NotFound", {
  sessionID: SessionSchema.ID,
}) {}

export class TransitionRejected extends Schema.TaggedErrorClass<TransitionRejected>()("SessionExecutionStatus.TransitionRejected", {
  sessionID: SessionSchema.ID,
  message: Schema.String,
}) {}

export class DurableTerminalError extends Schema.TaggedErrorClass<DurableTerminalError>()("SessionExecutionStatus.Terminal", {
  sessionID: SessionSchema.ID,
  code: TerminalCode,
  message: Schema.String,
}) {}

export interface Interface {
  readonly get: (sessionID: SessionSchema.ID) => Effect.Effect<Info, NotFound>
  readonly list: (input?: { readonly owner?: SessionRuntime.Owner; readonly nonIdle?: boolean }) => Effect.Effect<ReadonlyArray<{ readonly sessionID: SessionSchema.ID; readonly status: Info }>>
  readonly start: (input: ActiveInput) => Effect.Effect<EventV2.Payload>
  readonly dispatch: (input: ActiveInput & { readonly requestAttempt: number; readonly providerAttempt: number; readonly fingerprint: string; readonly now?: number; readonly recovery?: "retry-provider" | "continue-provider" | "interrupt" }) => Effect.Effect<{ readonly event?: EventV2.Payload; readonly claimed: boolean }>
  readonly complete: (input: ActiveInput & { readonly requestAttempt: number; readonly providerAttempt: number; readonly fingerprint: string }) => Effect.Effect<EventV2.Payload>
  readonly continue: (input: ActiveInput & { readonly requestAttempt: number; readonly providerAttempt: number; readonly fingerprint: string }) => Effect.Effect<EventV2.Payload>
  readonly retry: (input: ActiveInput & { readonly requestAttempt: number; readonly attempt: number; readonly maxAttempts: number; readonly nextAt: number; readonly code: SessionEvent.Execution.RetryCode; readonly action: SessionEvent.Execution.RetryAction; readonly message: string; readonly fingerprint: string; readonly recovery?: "retry-provider" | "interrupt" }) => Effect.Effect<EventV2.Payload>
  readonly succeed: (input: Fence & IdentityInput & { readonly release?: boolean }) => Effect.Effect<EventV2.Payload>
  readonly interrupt: (input: ActiveInput & { readonly code: TerminalCode; readonly message: string; readonly resultingEpoch: number }) => Effect.Effect<EventV2.Payload>
  readonly fail: (input: ActiveInput & { readonly code: TerminalCode; readonly message: string; readonly resultingEpoch: number }) => Effect.Effect<EventV2.Payload>
  readonly replace: (input: ActiveInput & { readonly resultingOwner: SessionRuntime.Owner; readonly resultingState: SessionRuntime.State; readonly resultingEpoch: number }) => Effect.Effect<EventV2.Payload>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/SessionExecutionStatus") {}

const hash = (...parts: ReadonlyArray<string | number | undefined>) => createHash("sha256").update(parts.map((part) => `${String(part).length}:${String(part)}`).join("|")).digest("hex")
export const eventID = (input: { readonly sessionID: SessionSchema.ID; readonly activityID: SessionMessage.ID; readonly rootID: SessionMessage.ID; readonly epoch: number; readonly kind: string; readonly requestAttempt?: number; readonly providerAttempt?: number; readonly structuredAttempt?: number }) =>
  EventV2.ID.make(`evt_${hash("session-execution-v1", input.sessionID, input.activityID, input.rootID, input.epoch, input.requestAttempt, input.structuredAttempt, input.providerAttempt, input.kind)}`)

const decode = Schema.decodeUnknownSync(Info)
const encode = Schema.encodeSync(Info)
const same = (row: typeof SessionExecutionStatusTable.$inferSelect | undefined, input: IdentityInput) =>
  row?.activity_id === input.activityID && row.root_id === input.rootID

export const make = Effect.gen(function* () {
    const db = (yield* Database.Service).db
    const events = yield* EventV2.Service
    const get = Effect.fn("SessionExecutionStatus.get")(function* (sessionID: SessionSchema.ID) {
      const session = yield* db.select({ id: SessionTable.id }).from(SessionTable).where(eq(SessionTable.id, sessionID)).get().pipe(Effect.orDie)
      if (!session) return yield* new NotFound({ sessionID })
      const row = yield* db.select().from(SessionExecutionStatusTable).where(eq(SessionExecutionStatusTable.session_id, sessionID)).get().pipe(Effect.orDie)
      return row ? decode(row.data) : ({ type: "idle" } as const)
    })
    const guard = (input: Fence & IdentityInput, predecessors: ReadonlyArray<Info["type"]>, validate?: (status: Info) => boolean) =>
      Effect.gen(function* () {
        const runtime = yield* db.select().from(SessionTable).where(eq(SessionTable.id, input.sessionID)).get().pipe(Effect.orDie)
        if (!runtime || runtime.runtime !== "v2" || runtime.runtime_state !== input.runtimeState || runtime.runtime_epoch !== input.epoch)
          return yield* new TransitionRejected({ sessionID: input.sessionID, message: "Session runtime fence changed" })
        const row = yield* db.select().from(SessionExecutionStatusTable).where(eq(SessionExecutionStatusTable.session_id, input.sessionID)).get().pipe(Effect.orDie)
        const type = row ? decode(row.data).type : "idle"
        const replacement = predecessors.includes("idle") && (type === "interrupted" || type === "terminal-failure")
        if (!predecessors.includes(type) || (type !== "idle" && !replacement && !same(row, input)))
          return yield* new TransitionRejected({ sessionID: input.sessionID, message: "Illegal execution status predecessor" })
        if (validate && !validate(row ? decode(row.data) : { type: "idle" }))
          return yield* new TransitionRejected({ sessionID: input.sessionID, message: "Execution status claim changed" })
      }).pipe(Effect.orDie)
    const publishEvent = events.publish as unknown as (definition: EventV2.Definition, data: unknown, options: EventV2.PublishOptions) => Effect.Effect<EventV2.Payload>
    const equivalent = (stored: Record<string, unknown>, current: Record<string, unknown>) => {
      const { timestamp: _, ...left } = stored
      const { timestamp: __, ...right } = current
      return isDeepStrictEqual(left, right)
    }
    const timestamp = (id: EventV2.ID) =>
      Effect.gen(function* () {
        const stored = yield* db.select({ data: EventTable.data }).from(EventTable).where(eq(EventTable.id, id)).get().pipe(Effect.orDie)
        return stored && typeof stored.data.timestamp === "number"
          ? DateTime.makeUnsafe(stored.data.timestamp)
          : yield* DateTime.now
      })
    const publish = (definition: EventV2.Definition, data: Record<string, unknown>, input: ActiveInput | (Fence & IdentityInput), predecessors: ReadonlyArray<Info["type"]>, commit?: (seq: number) => Effect.Effect<void>, validate?: (status: Info) => boolean) =>
      Effect.gen(function* () {
        const id = eventID({ ...input, kind: definition.type, requestAttempt: "requestAttempt" in input ? input.requestAttempt : undefined, providerAttempt: "providerAttempt" in input ? input.providerAttempt : undefined, structuredAttempt: "structuredAttempt" in input ? input.structuredAttempt : undefined })
        return yield* publishEvent(definition, { ...data, timestamp: yield* timestamp(id) }, {
          id,
          idempotent: true,
          equivalent,
          guard: () => guard(input, predecessors, validate),
          ...(commit ? { commit } : {}),
        })
      })
    const release = (input: Fence & IdentityInput, resultingEpoch: number, state: "ready" = "ready") =>
      db.update(SessionTable).set({ runtime_state: state, runtime_epoch: resultingEpoch }).where(and(eq(SessionTable.id, input.sessionID), eq(SessionTable.runtime, "v2"), eq(SessionTable.runtime_state, input.runtimeState), eq(SessionTable.runtime_epoch, input.epoch))).returning({ id: SessionTable.id }).get().pipe(Effect.orDie, Effect.flatMap((row) => row ? Effect.void : Effect.die("Session runtime release fence changed")))

    return Service.of({
      get,
      list: Effect.fn("SessionExecutionStatus.list")(function* (input = {}) {
        const rows = yield* db.select({ sessionID: SessionTable.id, owner: SessionTable.runtime, data: SessionExecutionStatusTable.data }).from(SessionTable).leftJoin(SessionExecutionStatusTable, eq(SessionExecutionStatusTable.session_id, SessionTable.id)).where(input.owner ? eq(SessionTable.runtime, input.owner) : undefined).orderBy(asc(SessionTable.id)).all().pipe(Effect.orDie)
        return rows.flatMap((row) => {
          const status = row.data ? decode(row.data) : ({ type: "idle" } as const)
          return input.nonIdle && status.type === "idle" ? [] : [{ sessionID: SessionSchema.ID.make(row.sessionID), status }]
        })
      }),
      start: (input) => publish(SessionEvent.Execution.Started, eventData(input), input, ["idle", "interrupted", "terminal-failure"]),
      dispatch: (input) => Effect.gen(function* () {
        let claimed = false
        const now = input.now ?? (yield* Clock.currentTimeMillis)
        const validate = (current: Info) => current.type === "retrying"
          ? current.recovery === "retry-provider" && current.nextAt <= now && current.requestAttempt === input.requestAttempt && current.providerAttempt === input.providerAttempt && current.fingerprint === input.fingerprint
          : current.type === "busy" && (
            current.requestAttempt === undefined
              ? input.requestAttempt === 1 && input.providerAttempt === 1
              : current.recovery === "continue-provider" && input.requestAttempt === current.requestAttempt + 1 && input.providerAttempt === 1
          )
        const event = yield* publish(
          SessionEvent.Execution.ProviderDispatched,
          { ...eventData(input), recovery: input.recovery ?? "retry-provider" },
          input,
          ["busy", "retrying"],
          () => Effect.sync(() => { claimed = true }),
          validate,
        )
        return { event, claimed }
      }),
      complete: (input) => publish(SessionEvent.Execution.ProviderCompleted, eventData(input), input, ["busy"], undefined, (current) => current.type === "busy" && current.requestAttempt === input.requestAttempt && current.providerAttempt === input.providerAttempt && current.fingerprint === input.fingerprint),
      continue: (input) => publish(SessionEvent.Execution.ContinuationReady, { ...eventData(input), recovery: "continue-provider" }, input, ["busy"], undefined, (current) => current.type === "busy" && current.recovery === undefined && current.requestAttempt === input.requestAttempt && current.providerAttempt === input.providerAttempt && current.fingerprint === input.fingerprint),
      retry: (input) => publish(SessionEvent.Execution.RetryScheduled, { ...eventData(input), message: SessionProviderRetry.sanitize(input.message), recovery: input.recovery ?? "retry-provider" }, input, ["busy"], undefined, (current) => current.type === "busy" && current.requestAttempt === input.requestAttempt && current.providerAttempt !== undefined && input.providerAttempt === current.providerAttempt + 1 && current.fingerprint === input.fingerprint),
      succeed: (input) => publish(SessionEvent.Execution.Succeeded, eventData(input), input, ["busy"], input.release === false ? undefined : () => release(input, input.epoch + 1)),
      interrupt: (input) => publish(SessionEvent.Execution.Interrupted, { ...eventData(input), message: SessionProviderRetry.sanitize(input.message) }, input, ["busy", "retrying"], () => release(input, input.resultingEpoch)),
      fail: (input) => publish(SessionEvent.Execution.Failed, { ...eventData(input), message: SessionProviderRetry.sanitize(input.message) }, input, ["busy", "retrying"], () => release(input, input.resultingEpoch)),
      replace: (input) => Effect.gen(function* () {
        const id = eventID({ ...input, kind: `${SessionEvent.Execution.Interrupted.type}:runtime-replaced`, requestAttempt: input.requestAttempt, providerAttempt: input.providerAttempt, structuredAttempt: input.structuredAttempt })
        const data = {
          ...eventData(input),
          timestamp: yield* timestamp(id),
          code: "runtime-replaced" as const,
          message: "Session runtime attachment was replaced",
          resultingEpoch: input.resultingEpoch,
        }
        return yield* publishEvent(SessionEvent.Execution.Interrupted, data, {
          id,
          idempotent: true,
          equivalent,
          guard: () => Effect.gen(function* () {
            const runtime = yield* db.select().from(SessionTable).where(eq(SessionTable.id, input.sessionID)).get().pipe(Effect.orDie)
            const row = yield* db.select().from(SessionExecutionStatusTable).where(eq(SessionExecutionStatusTable.session_id, input.sessionID)).get().pipe(Effect.orDie)
            if (!runtime || runtime.runtime !== input.resultingOwner || runtime.runtime_state !== input.resultingState || runtime.runtime_epoch !== input.resultingEpoch)
              return yield* new TransitionRejected({ sessionID: input.sessionID, message: "Replacement runtime fence changed" })
            if (!row || row.epoch !== input.epoch || !same(row, input) || (decode(row.data).type !== "busy" && decode(row.data).type !== "retrying"))
              return yield* new TransitionRejected({ sessionID: input.sessionID, message: "Replacement execution status changed" })
          }).pipe(Effect.orDie),
        })
      }),
    })
  })

export const layer = Layer.effect(Service, make)

export const project = (events: EventV2.Interface, db: Database.Interface["db"]) => {
  const active = (event: SessionEvent.Execution.Started | SessionEvent.Execution.ProviderDispatched | SessionEvent.Execution.ProviderCompleted | SessionEvent.Execution.ContinuationReady) => {
    if (event.seq === undefined) return Effect.die("Execution event is missing aggregate sequence")
    const status = { type: "busy" as const, ...event.data, seq: event.seq }
    return db.insert(SessionExecutionStatusTable).values({ session_id: event.data.sessionID, activity_id: event.data.activityID, root_id: event.data.rootID, owner: event.data.owner, epoch: event.data.epoch, seq: event.seq, data: encode(status) }).onConflictDoUpdate({ target: SessionExecutionStatusTable.session_id, set: { activity_id: event.data.activityID, root_id: event.data.rootID, owner: event.data.owner, epoch: event.data.epoch, seq: event.seq, data: encode(status) } }).run().pipe(Effect.orDie)
  }
  const retry = (event: SessionEvent.Execution.RetryScheduled) => {
    if (event.seq === undefined) return Effect.die("Execution event is missing aggregate sequence")
    const status = { type: "retrying" as const, ...event.data, seq: event.seq }
    return db.update(SessionExecutionStatusTable).set({ epoch: event.data.epoch, seq: event.seq, data: encode(status) }).where(eq(SessionExecutionStatusTable.session_id, event.data.sessionID)).run().pipe(Effect.orDie)
  }
  const terminal = (type: "interrupted" | "terminal-failure") => (event: SessionEvent.Execution.Interrupted | SessionEvent.Execution.Failed) => {
    if (event.seq === undefined) return Effect.die("Execution event is missing aggregate sequence")
    const status = { type, ...event.data, epoch: event.data.resultingEpoch, seq: event.seq }
    return db.update(SessionExecutionStatusTable).set({ epoch: event.data.resultingEpoch, seq: event.seq, data: encode(status) }).where(eq(SessionExecutionStatusTable.session_id, event.data.sessionID)).run().pipe(Effect.orDie)
  }
  return Effect.all([
    events.project(SessionEvent.Execution.Started, active),
    events.project(SessionEvent.Execution.ProviderDispatched, active),
    events.project(SessionEvent.Execution.ProviderCompleted, active),
    events.project(SessionEvent.Execution.ContinuationReady, active),
    events.project(SessionEvent.Execution.RetryScheduled, retry),
    events.project(SessionEvent.Execution.Succeeded, (event) => db.delete(SessionExecutionStatusTable).where(eq(SessionExecutionStatusTable.session_id, event.data.sessionID)).run().pipe(Effect.orDie)),
    events.project(SessionEvent.Execution.Interrupted, terminal("interrupted")),
    events.project(SessionEvent.Execution.Failed, terminal("terminal-failure")),
  ], { discard: true })
}

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer), Layer.provide(EventV2.defaultLayer))

const eventData = <A extends Fence & IdentityInput>(input: A) => {
  const { runtimeState: _, release: __, resultingOwner: ___, resultingState: ____, ...data } = input as A & {
    readonly release?: boolean
    readonly resultingOwner?: SessionRuntime.Owner
    readonly resultingState?: SessionRuntime.State
  }
  return data
}
