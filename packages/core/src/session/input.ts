export * as SessionInput from "./input"

import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm"
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

export type ShellRequest = {
  readonly admittedSeq: number
  readonly id: SessionMessage.ID
  readonly sessionID: SessionSchema.ID
  readonly command: string
  readonly resume: boolean
}

export type PendingShell = ShellRequest & { readonly phase: "execute" | "continue" | "settle-continuation" }

export type ShellTerminal = {
  readonly status: SessionEvent.Shell.Status
  readonly output: string
  readonly exitCode?: number
  readonly truncated: boolean
  readonly stdoutTruncated?: boolean
  readonly stderrTruncated?: boolean
}

export const shellRequestEventID = (id: SessionMessage.ID) => `evt_shell_request_${id}` as EventV2.ID
export const shellStartedEventID = (id: SessionMessage.ID) => `evt_shell_started_${id}` as EventV2.ID
export const shellTerminalEventID = (id: SessionMessage.ID) => `evt_shell_terminal_${id}` as EventV2.ID
export const shellContinuedEventID = (id: SessionMessage.ID) => `evt_shell_continued_${id}` as EventV2.ID
export const shellContinuationStartedEventID = (id: SessionMessage.ID) =>
  `evt_shell_continuation_started_${id}` as EventV2.ID
export const shellContinuationUnknownEventID = (id: SessionMessage.ID) =>
  `evt_shell_continuation_unknown_${id}` as EventV2.ID

const shellRequestedType = `${SessionEvent.Shell.Requested.type}.1`
const shellStartedType = `${SessionEvent.Shell.Started.type}.1`
const shellEndedType = `${SessionEvent.Shell.Ended.type}.2`
const shellContinuedType = `${SessionEvent.Shell.Continued.type}.1`
const shellContinuationStartedType = `${SessionEvent.Shell.ContinuationStarted.type}.1`
const shellContinuationUnknownType = `${SessionEvent.Shell.ContinuationUnknown.type}.1`
const decodeShellRequest = Schema.decodeUnknownEffect(SessionEvent.Shell.Requested.data)
const decodeShellTerminal = Schema.decodeUnknownEffect(SessionEvent.Shell.Ended.data)

export const findShell = Effect.fn("SessionInput.findShell")(function* (db: DatabaseService, id: SessionMessage.ID) {
  const row = yield* db
    .select()
    .from(EventTable)
    .where(eq(EventTable.id, shellRequestEventID(id)))
    .get()
    .pipe(Effect.orDie)
  if (!row || row.type !== shellRequestedType) return
  const data = yield* decodeShellRequest(row.data).pipe(Effect.orDie)
  return {
    admittedSeq: row.seq,
    id: data.messageID,
    sessionID: data.sessionID,
    command: data.command,
    resume: data.resume,
  } satisfies ShellRequest
})

export const startedShell = Effect.fn("SessionInput.startedShell")(function* (
  db: DatabaseService,
  id: SessionMessage.ID,
) {
  const row = yield* db
    .select({ type: EventTable.type })
    .from(EventTable)
    .where(eq(EventTable.id, shellStartedEventID(id)))
    .get()
    .pipe(Effect.orDie)
  return row?.type === shellStartedType
})

export const terminalShell = Effect.fn("SessionInput.terminalShell")(function* (
  db: DatabaseService,
  id: SessionMessage.ID,
) {
  const row = yield* db
    .select()
    .from(EventTable)
    .where(eq(EventTable.id, shellTerminalEventID(id)))
    .get()
    .pipe(Effect.orDie)
  if (!row) return
  if (row.type !== shellEndedType) return yield* Effect.die(`Invalid shell terminal event: ${row.type}`)
  const data = yield* decodeShellTerminal(row.data).pipe(Effect.orDie)
  return {
    status: data.status,
    output: data.output,
    exitCode: data.exitCode,
    truncated: data.truncated,
    stdoutTruncated: data.stdoutTruncated,
    stderrTruncated: data.stderrTruncated,
  } satisfies ShellTerminal
})

export const shellContinued = Effect.fn("SessionInput.shellContinued")(function* (
  db: DatabaseService,
  id: SessionMessage.ID,
) {
  const row = yield* db
    .select({ type: EventTable.type })
    .from(EventTable)
    .where(eq(EventTable.id, shellContinuedEventID(id)))
    .get()
    .pipe(Effect.orDie)
  return row?.type === shellContinuedType
})

export const startedShellContinuation = Effect.fn("SessionInput.startedShellContinuation")(function* (
  db: DatabaseService,
  id: SessionMessage.ID,
) {
  const row = yield* db
    .select({ type: EventTable.type })
    .from(EventTable)
    .where(eq(EventTable.id, shellContinuationStartedEventID(id)))
    .get()
    .pipe(Effect.orDie)
  return row?.type === shellContinuationStartedType
})

export const unknownShellContinuation = Effect.fn("SessionInput.unknownShellContinuation")(function* (
  db: DatabaseService,
  id: SessionMessage.ID,
) {
  const row = yield* db
    .select({ type: EventTable.type })
    .from(EventTable)
    .where(eq(EventTable.id, shellContinuationUnknownEventID(id)))
    .get()
    .pipe(Effect.orDie)
  return row?.type === shellContinuationUnknownType
})

const shellRequests = Effect.fnUntraced(function* (db: DatabaseService, sessionID?: SessionSchema.ID) {
  const rows = yield* db
    .select()
    .from(EventTable)
    .where(
      sessionID
        ? and(eq(EventTable.aggregate_id, sessionID), eq(EventTable.type, shellRequestedType))
        : eq(EventTable.type, shellRequestedType),
    )
    .orderBy(asc(EventTable.seq))
    .all()
    .pipe(Effect.orDie)
  return yield* Effect.forEach(rows, (row) =>
    decodeShellRequest(row.data).pipe(
      Effect.orDie,
      Effect.map(
        (data) =>
          ({
            admittedSeq: row.seq,
            id: data.messageID,
            sessionID: data.sessionID,
            command: data.command,
            resume: data.resume,
          }) satisfies ShellRequest,
      ),
    ),
  )
})

export const pendingRequestedShells = Effect.fn("SessionInput.pendingRequestedShells")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
) {
  return yield* Effect.filter(yield* shellRequests(db, sessionID), (request) =>
    Effect.all([startedShell(db, request.id), terminalShell(db, request.id)]).pipe(
      Effect.map(([started, terminal]) => !started && terminal === undefined),
    ),
  )
})

export const pendingShell = Effect.fn("SessionInput.pendingShell")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
) {
  for (const request of yield* shellRequests(db, sessionID)) {
    const terminal = yield* terminalShell(db, request.id)
    if (!terminal) return { ...request, phase: "execute" } satisfies PendingShell
    if (!request.resume || (yield* shellContinued(db, request.id)) || (yield* unknownShellContinuation(db, request.id)))
      continue
    if (yield* startedShellContinuation(db, request.id))
      return { ...request, phase: "settle-continuation" } satisfies PendingShell
    return { ...request, phase: "continue" } satisfies PendingShell
  }
})

export const hasPendingShell = Effect.fn("SessionInput.hasPendingShell")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
) {
  return (yield* pendingShell(db, sessionID)) !== undefined
})

export const pendingShellSessions = Effect.fn("SessionInput.pendingShellSessions")(function* (db: DatabaseService) {
  const requests = yield* shellRequests(db)
  if (!requests.length) return []
  const rows = yield* db
    .select({ id: EventTable.id, type: EventTable.type })
    .from(EventTable)
    .where(inArray(EventTable.type, [shellEndedType, shellContinuedType, shellContinuationUnknownType]))
    .all()
    .pipe(Effect.orDie)
  const ids = new Set(rows.map((row) => row.id))
  return [
    ...new Set(
      requests
        .filter(
          (request) =>
            !ids.has(shellTerminalEventID(request.id)) ||
            (request.resume &&
              !ids.has(shellContinuedEventID(request.id)) &&
              !ids.has(shellContinuationUnknownEventID(request.id))),
        )
        .map((request) => request.sessionID),
    ),
  ]
})

class ShellLifecycleConflict extends Error {}

const shellEvent = Effect.fnUntraced(function* (db: DatabaseService, id: EventV2.ID, type?: string) {
  const row = yield* db.select({ type: EventTable.type }).from(EventTable).where(eq(EventTable.id, id)).get().pipe(Effect.orDie)
  return row !== undefined && (type === undefined || row.type === type)
})

const shellTransition = (condition: Effect.Effect<boolean>) =>
  condition.pipe(Effect.flatMap((allowed) => (allowed ? Effect.void : Effect.die(new ShellLifecycleConflict()))))

export const admitShell = Effect.fn("SessionInput.admitShell")(function* (
  db: DatabaseService,
  events: EventV2.Interface,
  input: {
    readonly id: SessionMessage.ID
    readonly sessionID: SessionSchema.ID
    readonly command: string
    readonly resume: boolean
  },
) {
  const existing = yield* findShell(db, input.id)
  if (existing) return existing
  const timestamp = yield* DateTime.now
  return yield* events
    .publish(
      SessionEvent.Shell.Requested,
      { ...input, messageID: input.id, timestamp },
      { id: shellRequestEventID(input.id) },
    )
    .pipe(
      Effect.flatMap((event) =>
        event.seq === undefined
          ? Effect.die("Shell request event is missing aggregate sequence")
          : Effect.succeed({
              admittedSeq: event.seq,
              id: input.id,
              sessionID: input.sessionID,
              command: input.command,
              resume: input.resume,
            } satisfies ShellRequest),
      ),
      Effect.catchDefect((defect) =>
        findShell(db, input.id).pipe(Effect.flatMap((stored) => (stored ? Effect.succeed(stored) : Effect.die(defect)))),
      ),
    )
})

export const startShell = Effect.fn("SessionInput.startShell")(function* (
  db: DatabaseService,
  events: EventV2.Interface,
  request: ShellRequest,
) {
  return yield* events
    .publish(
      SessionEvent.Shell.Started,
      {
        sessionID: request.sessionID,
        messageID: request.id,
        timestamp: yield* DateTime.now,
        callID: request.id,
        command: request.command,
      },
      {
        id: shellStartedEventID(request.id),
        commit: () =>
          shellTransition(
            Effect.all([
              shellEvent(db, shellRequestEventID(request.id), shellRequestedType),
              shellEvent(db, shellTerminalEventID(request.id)).pipe(Effect.map((exists) => !exists)),
            ]).pipe(Effect.map((checks) => checks.every(Boolean))),
          ),
      },
    )
    .pipe(
      Effect.as(true),
      Effect.catchDefect((defect) =>
        defect instanceof ShellLifecycleConflict
          ? Effect.succeed(false)
          : startedShell(db, request.id).pipe(
              Effect.flatMap((stored) => (stored ? Effect.succeed(false) : Effect.die(defect))),
            ),
      ),
    )
})

export const endShell = Effect.fn("SessionInput.endShell")(function* (
  db: DatabaseService,
  events: EventV2.Interface,
  request: ShellRequest,
  result: ShellTerminal,
  expected: "requested" | "started" = "started",
) {
  return yield* events
    .publish(
      SessionEvent.Shell.Ended,
      {
        sessionID: request.sessionID,
        messageID: request.id,
        timestamp: yield* DateTime.now,
        callID: request.id,
        ...result,
      },
      {
        id: shellTerminalEventID(request.id),
        commit: () =>
          shellTransition(
            Effect.all([
              shellEvent(db, shellRequestEventID(request.id), shellRequestedType),
              startedShell(db, request.id),
            ]).pipe(
              Effect.map(
                ([requested, started]) => requested && (expected === "started" ? started : !started),
              ),
            ),
          ),
      },
    )
    .pipe(
      Effect.as(true),
      Effect.catchDefect((defect) =>
        defect instanceof ShellLifecycleConflict
          ? Effect.succeed(false)
          : terminalShell(db, request.id).pipe(
              Effect.flatMap((stored) => (stored ? Effect.succeed(false) : Effect.die(defect))),
            ),
      ),
    )
})

export const startShellContinuation = Effect.fn("SessionInput.startShellContinuation")(function* (
  db: DatabaseService,
  events: EventV2.Interface,
  request: ShellRequest,
) {
  return yield* events
    .publish(
      SessionEvent.Shell.ContinuationStarted,
      { sessionID: request.sessionID, messageID: request.id, timestamp: yield* DateTime.now },
      {
        id: shellContinuationStartedEventID(request.id),
        commit: () =>
          shellTransition(
            Effect.all([
              shellEvent(db, shellTerminalEventID(request.id), shellEndedType),
              shellEvent(db, shellContinuedEventID(request.id)).pipe(Effect.map((exists) => !exists)),
              shellEvent(db, shellContinuationUnknownEventID(request.id)).pipe(Effect.map((exists) => !exists)),
            ]).pipe(Effect.map((checks) => checks.every(Boolean))),
          ),
      },
    )
    .pipe(
      Effect.as(true),
      Effect.catchDefect((defect) =>
        defect instanceof ShellLifecycleConflict
          ? Effect.succeed(false)
          : startedShellContinuation(db, request.id).pipe(
              Effect.flatMap((stored) => (stored ? Effect.succeed(false) : Effect.die(defect))),
            ),
      ),
    )
})

export const settleUnknownShellContinuation = Effect.fn("SessionInput.settleUnknownShellContinuation")(function* (
  db: DatabaseService,
  events: EventV2.Interface,
  request: ShellRequest,
) {
  return yield* events
    .publish(
      SessionEvent.Shell.ContinuationUnknown,
      { sessionID: request.sessionID, messageID: request.id, timestamp: yield* DateTime.now },
      {
        id: shellContinuationUnknownEventID(request.id),
        commit: () =>
          shellTransition(
            Effect.all([
              startedShellContinuation(db, request.id),
              shellContinued(db, request.id).pipe(Effect.map((continued) => !continued)),
            ]).pipe(Effect.map((checks) => checks.every(Boolean))),
          ),
      },
    )
    .pipe(
      Effect.as(true),
      Effect.catchDefect((defect) =>
        defect instanceof ShellLifecycleConflict
          ? Effect.succeed(false)
          : unknownShellContinuation(db, request.id).pipe(
              Effect.flatMap((stored) => (stored ? Effect.succeed(false) : Effect.die(defect))),
            ),
      ),
    )
})

export const continueShell = Effect.fn("SessionInput.continueShell")(function* (
  db: DatabaseService,
  events: EventV2.Interface,
  request: ShellRequest,
) {
  return yield* events
    .publish(
      SessionEvent.Shell.Continued,
      { sessionID: request.sessionID, messageID: request.id, timestamp: yield* DateTime.now },
      {
        id: shellContinuedEventID(request.id),
        commit: () =>
          shellTransition(
            Effect.all([
              startedShellContinuation(db, request.id),
              unknownShellContinuation(db, request.id).pipe(Effect.map((unknown) => !unknown)),
            ]).pipe(Effect.map((checks) => checks.every(Boolean))),
          ),
      },
    )
    .pipe(
      Effect.as(true),
      Effect.catchDefect((defect) =>
        defect instanceof ShellLifecycleConflict
          ? Effect.succeed(false)
          : shellContinued(db, request.id).pipe(
              Effect.flatMap((stored) => (stored ? Effect.succeed(false) : Effect.die(defect))),
            ),
      ),
    )
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
    const requested = yield* Effect.all([
      db
        .select({ id: EventTable.id })
        .from(EventTable)
        .where(eq(EventTable.id, compactionRequestEventID(event.data.messageID)))
        .get()
        .pipe(Effect.orDie),
      db
        .select({ id: EventTable.id })
        .from(EventTable)
        .where(eq(EventTable.id, shellRequestEventID(event.data.messageID)))
        .get()
        .pipe(Effect.orDie),
    ])
    if (requested.some(Boolean)) return yield* Effect.die(new LifecycleConflict({ id: event.data.messageID }))
    return
  }
  const id = reservedID(event)
  if (id === undefined) return
  const conflicts = yield* Effect.all([
    db
      .select({ id: SessionInputTable.id })
      .from(SessionInputTable)
      .where(eq(SessionInputTable.id, id))
      .get()
      .pipe(Effect.orDie),
    Schema.is(SessionEvent.Shell.Started)(event)
      ? Effect.succeed(undefined)
      : db
          .select({ id: EventTable.id })
          .from(EventTable)
          .where(eq(EventTable.id, shellRequestEventID(id)))
          .get()
          .pipe(Effect.orDie),
    Schema.is(SessionEvent.Compaction.Started)(event)
      ? Effect.succeed(undefined)
      : db
          .select({ id: EventTable.id })
          .from(EventTable)
          .where(eq(EventTable.id, compactionRequestEventID(id)))
          .get()
          .pipe(Effect.orDie),
    Schema.is(SessionEvent.Shell.Requested)(event) || Schema.is(SessionEvent.Compaction.Requested)(event)
      ? db
          .select({ id: SessionMessageTable.id })
          .from(SessionMessageTable)
          .where(eq(SessionMessageTable.id, id))
          .get()
          .pipe(Effect.orDie)
      : Effect.succeed(undefined),
  ])
  if (!conflicts.some(Boolean)) return
  return yield* Effect.die(new LifecycleConflict({ id }))
})

const reservedID = (event: EventV2.Payload) => {
  if (Schema.is(SessionEvent.Step.Started)(event)) return event.data.assistantMessageID
  if (Schema.is(SessionEvent.AgentSwitched)(event)) return event.data.messageID
  if (Schema.is(SessionEvent.ModelSwitched)(event)) return event.data.messageID
  if (Schema.is(SessionEvent.Prompted)(event)) return event.data.messageID
  if (Schema.is(SessionEvent.Synthetic)(event)) return event.data.messageID
  if (Schema.is(SessionEvent.Shell.Requested)(event)) return event.data.messageID
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
