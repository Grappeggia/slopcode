export * as SessionInput from "./input"

import { and, asc, eq, isNull, lte } from "drizzle-orm"
import { DateTime, Effect, Schema } from "effect"
import type { Database } from "../database/database"
import type { EventV2 } from "../event"
import { EventSequenceTable, EventTable } from "../event/sql"
import { NonNegativeInt } from "../schema"
import { V2Schema } from "../v2-schema"
import { SessionEvent } from "./event"
import { SessionMessage } from "./message"
import { Prompt } from "./prompt"
import { SessionSchema } from "./schema"
import { SessionInputTable, SessionMessageTable } from "./sql"

type DatabaseService = Database.Interface["db"]

export const Delivery = Schema.Literals(["steer", "queue"])
export type Delivery = typeof Delivery.Type

export class Admitted extends Schema.Class<Admitted>("SessionInput.Admitted")({
  admittedSeq: NonNegativeInt,
  id: SessionMessage.ID,
  sessionID: SessionSchema.ID,
  prompt: Prompt,
  delivery: Delivery,
  timeCreated: V2Schema.DateTimeUtcFromMillis,
  promotedSeq: NonNegativeInt.pipe(Schema.optional),
}) {}

const decodePrompt = Schema.decodeUnknownSync(Prompt)
const encodePrompt = Schema.encodeSync(Prompt)

const fromRow = (row: typeof SessionInputTable.$inferSelect): Admitted =>
  new Admitted({
    admittedSeq: row.admitted_seq,
    id: SessionMessage.ID.make(row.id),
    sessionID: SessionSchema.ID.make(row.session_id),
    prompt: decodePrompt(row.prompt),
    delivery: row.delivery,
    timeCreated: DateTime.makeUnsafe(row.time_created),
    ...(row.promoted_seq === null ? {} : { promotedSeq: row.promoted_seq }),
  })

export const find = Effect.fn("SessionInput.find")(function* (db: DatabaseService, id: SessionMessage.ID) {
  const row = yield* db.select().from(SessionInputTable).where(eq(SessionInputTable.id, id)).get().pipe(Effect.orDie)
  return row === undefined ? undefined : fromRow(row)
})

export class LifecycleConflict extends Schema.TaggedErrorClass<LifecycleConflict>()("SessionInput.LifecycleConflict", {
  id: SessionMessage.ID,
}) {}

export const admit = Effect.fn("SessionInput.admit")(function* (
  db: DatabaseService,
  events: EventV2.Interface,
  input: {
    readonly id: SessionMessage.ID
    readonly sessionID: SessionSchema.ID
    readonly prompt: Prompt
    readonly delivery: Delivery
  },
) {
  const existing = yield* find(db, input.id)
  if (existing !== undefined) return existing
  const timestamp = yield* DateTime.now
  return yield* events
    .publish(SessionEvent.PromptLifecycle.Admitted, {
      messageID: input.id,
      sessionID: input.sessionID,
      timestamp,
      prompt: input.prompt,
      delivery: input.delivery,
    })
    .pipe(
      Effect.flatMap((event) =>
        event.seq === undefined
          ? Effect.die("Prompt admission event is missing aggregate sequence")
          : Effect.succeed(
              new Admitted({
                admittedSeq: event.seq,
                id: input.id,
                sessionID: input.sessionID,
                prompt: input.prompt,
                delivery: input.delivery,
                timeCreated: timestamp,
              }),
            ),
      ),
      Effect.catchDefect((defect) =>
        find(db, input.id).pipe(Effect.flatMap((stored) => (stored ? Effect.succeed(stored) : Effect.die(defect)))),
      ),
    )
})

export const latestSeq = Effect.fn("SessionInput.latestSeq")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
) {
  const row = yield* db
    .select({ seq: EventSequenceTable.seq })
    .from(EventSequenceTable)
    .where(eq(EventSequenceTable.aggregate_id, sessionID))
    .get()
    .pipe(Effect.orDie)
  return row?.seq ?? -1
})

export const projectAdmitted = Effect.fn("SessionInput.projectAdmitted")(function* (
  db: DatabaseService,
  input: {
    readonly admittedSeq: number
    readonly id: SessionMessage.ID
    readonly sessionID: SessionSchema.ID
    readonly prompt: Prompt
    readonly delivery: Delivery
    readonly timeCreated: DateTime.Utc
  },
) {
  const message = yield* db
    .select({ id: SessionMessageTable.id })
    .from(SessionMessageTable)
    .where(eq(SessionMessageTable.id, input.id))
    .get()
    .pipe(Effect.orDie)
  if (message) return yield* Effect.die(new LifecycleConflict({ id: input.id }))
  const stored = yield* db
    .insert(SessionInputTable)
    .values({
      id: input.id,
      session_id: input.sessionID,
      admitted_seq: input.admittedSeq,
      prompt: encodePrompt(input.prompt),
      delivery: input.delivery,
      time_created: DateTime.toEpochMillis(input.timeCreated),
    })
    .onConflictDoNothing()
    .returning({ id: SessionInputTable.id })
    .get()
    .pipe(Effect.orDie)
  if (!stored) return yield* Effect.die(new LifecycleConflict({ id: input.id }))
})

export const projectPromoted = Effect.fn("SessionInput.projectPromoted")(function* (
  db: DatabaseService,
  input: {
    readonly id: SessionMessage.ID
    readonly sessionID: SessionSchema.ID
    readonly prompt: Prompt
    readonly timeCreated: DateTime.Utc
    readonly promotedSeq: number
  },
) {
  const updated = yield* db
    .update(SessionInputTable)
    .set({ promoted_seq: input.promotedSeq })
    .where(
      and(
        eq(SessionInputTable.id, input.id),
        eq(SessionInputTable.session_id, input.sessionID),
        isNull(SessionInputTable.promoted_seq),
      ),
    )
    .returning()
    .get()
    .pipe(Effect.orDie)
  if (!updated) return yield* Effect.die(new LifecycleConflict({ id: input.id }))
  const stored = fromRow(updated)
  if (
    !matchesPrompt(stored, input) ||
    DateTime.toEpochMillis(stored.timeCreated) !== DateTime.toEpochMillis(input.timeCreated)
  )
    return yield* Effect.die(new LifecycleConflict({ id: input.id }))
  return toMessage(stored)
})

export const hasPending = Effect.fn("SessionInput.hasPending")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
  delivery: Delivery,
) {
  const row = yield* db
    .select({ id: SessionInputTable.id })
    .from(SessionInputTable)
    .where(
      and(
        eq(SessionInputTable.session_id, sessionID),
        isNull(SessionInputTable.promoted_seq),
        eq(SessionInputTable.delivery, delivery),
      ),
    )
    .limit(1)
    .get()
    .pipe(Effect.orDie)
  return row !== undefined
})

export type CompactionRequest = {
  readonly admittedSeq: number
  readonly id: SessionMessage.ID
  readonly sessionID: SessionSchema.ID
  readonly instruction?: string
}

export type CompactionTerminal =
  | { readonly type: "ended" }
  | { readonly type: "skipped" }
  | {
      readonly type: "failed"
      readonly reason: typeof SessionEvent.Compaction.Failed.data.Type.reason
      readonly message: string
    }

export const compactionRequestEventID = (id: SessionMessage.ID) =>
  `evt_compaction_request_${id}` as EventV2.ID
export const compactionTerminalEventID = (id: SessionMessage.ID) =>
  `evt_compaction_terminal_${id}` as EventV2.ID

const compactionRequestedType = `${SessionEvent.Compaction.Requested.type}.1`
const compactionSkippedType = `${SessionEvent.Compaction.Skipped.type}.1`
const compactionFailedType = `${SessionEvent.Compaction.Failed.type}.1`
const compactionEndedType = `${SessionEvent.Compaction.Ended.type}.2`
const decodeCompactionRequest = Schema.decodeUnknownEffect(SessionEvent.Compaction.Requested.data)
const decodeCompactionFailed = Schema.decodeUnknownEffect(SessionEvent.Compaction.Failed.data)

export const findCompaction = Effect.fn("SessionInput.findCompaction")(function* (
  db: DatabaseService,
  id: SessionMessage.ID,
) {
  const row = yield* db
    .select()
    .from(EventTable)
    .where(eq(EventTable.id, compactionRequestEventID(id)))
    .get()
    .pipe(Effect.orDie)
  if (!row || row.type !== compactionRequestedType) return
  const data = yield* decodeCompactionRequest(row.data).pipe(Effect.orDie)
  return {
    admittedSeq: row.seq,
    id: data.messageID,
    sessionID: data.sessionID,
    ...(data.instruction === undefined ? {} : { instruction: data.instruction }),
  } satisfies CompactionRequest
})

export const terminalCompaction = Effect.fn("SessionInput.terminalCompaction")(function* (
  db: DatabaseService,
  id: SessionMessage.ID,
) {
  const row = yield* db
    .select()
    .from(EventTable)
    .where(eq(EventTable.id, compactionTerminalEventID(id)))
    .get()
    .pipe(Effect.orDie)
  if (!row) return
  if (row.type === compactionEndedType) return { type: "ended" } as const
  if (row.type === compactionSkippedType) return { type: "skipped" } as const
  if (row.type !== compactionFailedType) return yield* Effect.die(`Invalid manual compaction terminal event: ${row.type}`)
  const data = yield* decodeCompactionFailed(row.data).pipe(Effect.orDie)
  return { type: "failed", reason: data.reason, message: data.message } as const
})

export const pendingCompaction = Effect.fn("SessionInput.pendingCompaction")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
) {
  const rows = yield* db
    .select()
    .from(EventTable)
    .where(and(eq(EventTable.aggregate_id, sessionID), eq(EventTable.type, compactionRequestedType)))
    .orderBy(asc(EventTable.seq))
    .all()
    .pipe(Effect.orDie)
  const requests = yield* Effect.forEach(rows, (row) =>
    decodeCompactionRequest(row.data).pipe(
      Effect.orDie,
      Effect.map(
        (data) =>
          ({
            admittedSeq: row.seq,
            id: data.messageID,
            sessionID: data.sessionID,
            ...(data.instruction === undefined ? {} : { instruction: data.instruction }),
          }) satisfies CompactionRequest,
      ),
    ),
  )
  const unsettled = yield* Effect.filter(requests, (request) =>
    terminalCompaction(db, request.id).pipe(Effect.map((result) => result === undefined)),
  )
  return unsettled[0]
})

export const hasPendingCompaction = Effect.fn("SessionInput.hasPendingCompaction")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
) {
  return (yield* pendingCompaction(db, sessionID)) !== undefined
})

export const pendingCompactionSessions = Effect.fn("SessionInput.pendingCompactionSessions")(function* (
  db: DatabaseService,
) {
  const rows = yield* db
    .select({ data: EventTable.data })
    .from(EventTable)
    .where(eq(EventTable.type, compactionRequestedType))
    .orderBy(asc(EventTable.seq))
    .all()
    .pipe(Effect.orDie)
  const requests = yield* Effect.forEach(rows, (row) => decodeCompactionRequest(row.data).pipe(Effect.orDie))
  const pending = yield* Effect.filter(requests, (request) =>
    terminalCompaction(db, request.messageID).pipe(Effect.map((result) => result === undefined)),
  )
  return [...new Set(pending.map((request) => request.sessionID))]
})

export const admitCompaction = Effect.fn("SessionInput.admitCompaction")(function* (
  db: DatabaseService,
  events: EventV2.Interface,
  input: {
    readonly id: SessionMessage.ID
    readonly sessionID: SessionSchema.ID
    readonly instruction?: string
  },
) {
  const existing = yield* findCompaction(db, input.id)
  if (existing) return existing
  const timestamp = yield* DateTime.now
  return yield* events
    .publish(
      SessionEvent.Compaction.Requested,
      {
        sessionID: input.sessionID,
        messageID: input.id,
        timestamp,
        ...(input.instruction === undefined ? {} : { instruction: input.instruction }),
      },
      { id: compactionRequestEventID(input.id) },
    )
    .pipe(
      Effect.flatMap((event) =>
        event.seq === undefined
          ? Effect.die("Compaction request event is missing aggregate sequence")
          : Effect.succeed({
              admittedSeq: event.seq,
              id: input.id,
              sessionID: input.sessionID,
              ...(input.instruction === undefined ? {} : { instruction: input.instruction }),
            } satisfies CompactionRequest),
      ),
      Effect.catchDefect((defect) =>
        findCompaction(db, input.id).pipe(
          Effect.flatMap((stored) => (stored ? Effect.succeed(stored) : Effect.die(defect))),
        ),
      ),
    )
})

const settleCompaction = <D extends typeof SessionEvent.Compaction.Skipped | typeof SessionEvent.Compaction.Failed>(
  db: DatabaseService,
  events: EventV2.Interface,
  definition: D,
  data: EventV2.Data<D>,
) =>
  events.publish(definition, data, { id: compactionTerminalEventID(data.messageID) }).pipe(
    Effect.asVoid,
    Effect.catchDefect((defect) =>
      terminalCompaction(db, data.messageID).pipe(
        Effect.flatMap((stored) => (stored ? Effect.void : Effect.die(defect))),
      ),
    ),
  )

export const skipCompaction = Effect.fn("SessionInput.skipCompaction")(function* (
  db: DatabaseService,
  events: EventV2.Interface,
  request: CompactionRequest,
) {
  yield* settleCompaction(db, events, SessionEvent.Compaction.Skipped, {
    sessionID: request.sessionID,
    messageID: request.id,
    timestamp: yield* DateTime.now,
  })
})

export const failCompaction = Effect.fn("SessionInput.failCompaction")(function* (
  db: DatabaseService,
  events: EventV2.Interface,
  request: CompactionRequest,
  failure: {
    readonly reason: typeof SessionEvent.Compaction.Failed.data.Type.reason
    readonly message: string
  },
) {
  yield* settleCompaction(db, events, SessionEvent.Compaction.Failed, {
    sessionID: request.sessionID,
    messageID: request.id,
    timestamp: yield* DateTime.now,
    reason: failure.reason,
    message: failure.message,
  })
})

export const equivalent = (
  input: Admitted,
  expected: {
    readonly sessionID: SessionSchema.ID
    readonly prompt: Prompt
    readonly delivery: Delivery
  },
) => input.delivery === expected.delivery && matchesPrompt(input, expected)

const matchesPrompt = (input: Admitted, expected: { readonly sessionID: SessionSchema.ID; readonly prompt: Prompt }) =>
  input.sessionID === expected.sessionID &&
  JSON.stringify(encodePrompt(input.prompt)) === JSON.stringify(encodePrompt(expected.prompt))

export const guardReservedID = Effect.fn("SessionInput.guardReservedID")(function* (
  db: DatabaseService,
  event: EventV2.Payload,
) {
  if (
    Schema.is(SessionEvent.PromptLifecycle.Admitted)(event) ||
    Schema.is(SessionEvent.PromptLifecycle.Promoted)(event)
  ) {
    const requested = yield* db
      .select({ id: EventTable.id })
      .from(EventTable)
      .where(eq(EventTable.id, compactionRequestEventID(event.data.messageID)))
      .get()
      .pipe(Effect.orDie)
    if (requested) return yield* Effect.die(new LifecycleConflict({ id: event.data.messageID }))
    return
  }
  const id = reservedID(event)
  if (id === undefined) return
  const admitted = yield* db
    .select({ id: SessionInputTable.id })
    .from(SessionInputTable)
    .where(eq(SessionInputTable.id, id))
    .get()
    .pipe(Effect.orDie)
  if (admitted === undefined) return
  return yield* Effect.die(new LifecycleConflict({ id }))
})

const reservedID = (event: EventV2.Payload) => {
  if (Schema.is(SessionEvent.Step.Started)(event)) return event.data.assistantMessageID
  if (Schema.is(SessionEvent.AgentSwitched)(event)) return event.data.messageID
  if (Schema.is(SessionEvent.ModelSwitched)(event)) return event.data.messageID
  if (Schema.is(SessionEvent.Prompted)(event)) return event.data.messageID
  if (Schema.is(SessionEvent.Synthetic)(event)) return event.data.messageID
  if (Schema.is(SessionEvent.Shell.Started)(event)) return event.data.messageID
  if (Schema.is(SessionEvent.Compaction.Requested)(event)) return event.data.messageID
  if (Schema.is(SessionEvent.Compaction.Started)(event)) return event.data.messageID
}

export const projectLegacyPrompted = Effect.fn("SessionInput.projectLegacyPrompted")(function* (
  db: DatabaseService,
  input: {
    readonly id: SessionMessage.ID
    readonly sessionID: SessionSchema.ID
    readonly prompt: Prompt
    readonly delivery: Delivery
    readonly timeCreated: DateTime.Utc
    readonly promotedSeq: number
  },
) {
  const inserted = yield* db
    .insert(SessionInputTable)
    .values({
      id: input.id,
      session_id: input.sessionID,
      admitted_seq: input.promotedSeq,
      prompt: encodePrompt(input.prompt),
      delivery: input.delivery,
      promoted_seq: input.promotedSeq,
      time_created: DateTime.toEpochMillis(input.timeCreated),
    })
    .onConflictDoNothing()
    .returning()
    .get()
    .pipe(Effect.orDie)
  if (!inserted) return yield* Effect.die("Prompt projection conflicts with admitted input")
  return fromRow(inserted)
})

const publish = Effect.fn("SessionInput.publish")(function* (
  db: DatabaseService,
  events: EventV2.Interface,
  sessionID: SessionSchema.ID,
  rows: ReadonlyArray<typeof SessionInputTable.$inferSelect>,
) {
  for (const row of rows) {
    yield* events
      .publish(SessionEvent.PromptLifecycle.Promoted, {
        sessionID,
        timestamp: yield* DateTime.now,
        messageID: SessionMessage.ID.make(row.id),
        prompt: decodePrompt(row.prompt),
        timeCreated: DateTime.makeUnsafe(row.time_created),
      })
      .pipe(
        Effect.catchDefect((defect) =>
          defect instanceof LifecycleConflict
            ? find(db, SessionMessage.ID.make(row.id)).pipe(
                Effect.flatMap((stored) => (stored?.promotedSeq === undefined ? Effect.die(defect) : Effect.void)),
              )
            : Effect.die(defect),
        ),
      )
  }
  return rows.length
})

export const promoteSteers = Effect.fn("SessionInput.promoteSteers")(function* (
  db: DatabaseService,
  events: EventV2.Interface,
  sessionID: SessionSchema.ID,
  cutoff: number,
) {
  const rows = yield* db
    .select()
    .from(SessionInputTable)
    .where(
      and(
        eq(SessionInputTable.session_id, sessionID),
        isNull(SessionInputTable.promoted_seq),
        eq(SessionInputTable.delivery, "steer"),
        lte(SessionInputTable.admitted_seq, cutoff),
      ),
    )
    .orderBy(asc(SessionInputTable.admitted_seq))
    .all()
    .pipe(Effect.orDie)
  return yield* publish(db, events, sessionID, rows)
})

export const promoteNextQueued = Effect.fn("SessionInput.promoteNextQueued")(function* (
  db: DatabaseService,
  events: EventV2.Interface,
  sessionID: SessionSchema.ID,
) {
  const row = yield* db
    .select()
    .from(SessionInputTable)
    .where(
      and(
        eq(SessionInputTable.session_id, sessionID),
        isNull(SessionInputTable.promoted_seq),
        eq(SessionInputTable.delivery, "queue"),
      ),
    )
    .orderBy(asc(SessionInputTable.admitted_seq))
    .limit(1)
    .get()
    .pipe(Effect.orDie)
  return row === undefined ? false : yield* publish(db, events, sessionID, [row]).pipe(Effect.as(true))
})

const toMessage = (input: Admitted) =>
  new SessionMessage.User({
    id: input.id,
    type: "user",
    text: input.prompt.text,
    files: input.prompt.files,
    agents: input.prompt.agents,
    time: { created: input.timeCreated },
  })
