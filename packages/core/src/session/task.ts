export * as SessionTask from "./task"

import { and, asc, eq, gt, inArray } from "drizzle-orm"
import { Effect, Option, Schema } from "effect"
import { createHash } from "node:crypto"
import type { Database } from "../database/database"
import { EventV2 } from "../event"
import { EventTable } from "../event/sql"
import { SessionEvent } from "./event"
import { SessionMessage } from "./message"
import { SessionSchema } from "./schema"
import type { SessionStore } from "./store"
import { SessionTaskMetadata } from "./task-metadata"
import { SessionTable } from "./sql"

type DatabaseService = Database.Interface["db"]

const hash = (...parts: ReadonlyArray<string>) =>
  createHash("sha256")
    .update(parts.map((part) => `${part.length}:${part}`).join("|"))
    .digest("hex")

export const childID = (parentID: SessionSchema.ID, messageID: SessionMessage.ID, callID: string) =>
  SessionSchema.ID.make(`ses_${hash("task-child-v2", parentID, messageID, callID)}`)

export const promptID = (parentID: SessionSchema.ID, messageID: SessionMessage.ID, callID: string) =>
  SessionMessage.ID.make(`msg_${hash("task-prompt-v2", parentID, messageID, callID)}`)

export const requestEventID = (parentID: SessionSchema.ID, messageID: SessionMessage.ID, callID: string) =>
  EventV2.ID.make(`evt_${hash("task-request-v2", parentID, messageID, callID)}`)

export const preparedEventID = (parentID: SessionSchema.ID, messageID: SessionMessage.ID, callID: string) =>
  EventV2.ID.make(`evt_${hash("task-prepared-v2", parentID, messageID, callID)}`)

export const interruptedEventID = (parentID: SessionSchema.ID, messageID: SessionMessage.ID, callID: string) =>
  EventV2.ID.make(`evt_${hash("task-interrupted-v2", parentID, messageID, callID)}`)

export const interruptedToolEventID = (parentID: SessionSchema.ID, messageID: SessionMessage.ID, callID: string) =>
  EventV2.ID.make(`evt_${hash("task-tool-interrupted-v2", parentID, messageID, callID)}`)

export const progressEventID = (parentID: SessionSchema.ID, messageID: SessionMessage.ID, callID: string) =>
  EventV2.ID.make(`evt_${hash("task-progress-v2", parentID, messageID, callID)}`)

const requestedType = `${SessionEvent.Task.Requested.type}.1`
const preparedType = `${SessionEvent.Task.Prepared.type}.1`
const interruptedType = `${SessionEvent.Task.Interrupted.type}.1`
const interruptRequestedType = `${SessionEvent.InterruptRequested.type}.1`
const taskCallTypes = [
  `${SessionEvent.Tool.Input.Started.type}.1`,
  `${SessionEvent.Tool.Input.Ended.type}.1`,
  `${SessionEvent.Tool.CalledV1.type}.1`,
]
const decodeRequest = Schema.decodeUnknownEffect(SessionEvent.Task.Requested.data)
const decodePrepared = Schema.decodeUnknownEffect(SessionEvent.Task.Prepared.data)
const decodeProgress = Schema.decodeUnknownEffect(SessionEvent.Tool.Progress.data)

export const prepared = Effect.fn("SessionTask.prepared")(function* (
  db: DatabaseService,
  parentID: SessionSchema.ID,
  messageID: SessionMessage.ID,
  callID: string,
) {
  const row = yield* db
    .select()
    .from(EventTable)
    .where(eq(EventTable.id, preparedEventID(parentID, messageID, callID)))
    .get()
    .pipe(Effect.orDie)
  if (!row) return
  if (row.type !== preparedType) return yield* Effect.die(`Invalid task prepared event: ${row.type}`)
  return yield* decodePrepared(row.data).pipe(Effect.orDie)
})

export const progress = Effect.fn("SessionTask.progress")(function* (
  db: DatabaseService,
  parentID: SessionSchema.ID,
  messageID: SessionMessage.ID,
  callID: string,
) {
  const row = yield* db
    .select()
    .from(EventTable)
    .where(eq(EventTable.id, progressEventID(parentID, messageID, callID)))
    .get()
    .pipe(Effect.orDie)
  if (!row) return
  if (row.type !== `${SessionEvent.Tool.Progress.type}.1`)
    return yield* Effect.die(`Invalid task progress event: ${row.type}`)
  return yield* decodeProgress(row.data).pipe(Effect.orDie)
})

export const strengthen = Effect.fn("SessionTask.strengthen")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
  ceiling: SessionTaskMetadata.Owner["ceiling"],
) {
  return yield* db.transaction(
    () =>
      Effect.gen(function* () {
        const row = yield* db
          .select({ metadata: SessionTable.metadata })
          .from(SessionTable)
          .where(eq(SessionTable.id, sessionID))
          .get()
          .pipe(Effect.orDie)
        const owner = SessionTaskMetadata.owner(row?.metadata)
        if (!row || !owner) return
        const merged = [...owner.ceiling, ...ceiling].filter(
          (rule, index, rules) =>
            rules.findIndex((current) => JSON.stringify(current) === JSON.stringify(rule)) === index,
        )
        if (merged.length !== owner.ceiling.length)
          yield* db
            .update(SessionTable)
            .set({ metadata: { ...(row.metadata ?? {}), task: { ...owner, ceiling: merged } } })
            .where(eq(SessionTable.id, sessionID))
            .run()
            .pipe(Effect.orDie)
        return { ...owner, ceiling: merged }
      }),
    { behavior: "immediate" },
  )
})

export const request = Effect.fn("SessionTask.request")(function* (
  db: DatabaseService,
  parentID: SessionSchema.ID,
  messageID: SessionMessage.ID,
  callID: string,
) {
  const row = yield* db
    .select()
    .from(EventTable)
    .where(eq(EventTable.id, requestEventID(parentID, messageID, callID)))
    .get()
    .pipe(Effect.orDie)
  if (!row) return
  if (row.type !== requestedType) return yield* Effect.die(`Invalid task request event: ${row.type}`)
  return Option.getOrUndefined(yield* decodeRequest(row.data).pipe(Effect.option))
})

const recoveryRequest = Effect.fnUntraced(function* (
  db: DatabaseService,
  parentID: SessionSchema.ID,
  messageID: SessionMessage.ID,
  callID: string,
) {
  const row = yield* db
    .select({ type: EventTable.type, data: EventTable.data })
    .from(EventTable)
    .where(eq(EventTable.id, requestEventID(parentID, messageID, callID)))
    .get()
    .pipe(Effect.orDie)
  if (!row || row.type !== requestedType) return
  return Option.getOrUndefined(yield* decodeRequest(row.data).pipe(Effect.option))
})

export const interrupted = Effect.fn("SessionTask.interrupted")(function* (
  db: DatabaseService,
  parentID: SessionSchema.ID,
  messageID: SessionMessage.ID,
  callID: string,
) {
  const row = yield* db
    .select({ type: EventTable.type })
    .from(EventTable)
    .where(eq(EventTable.id, interruptedEventID(parentID, messageID, callID)))
    .get()
    .pipe(Effect.orDie)
  return row?.type === interruptedType
})

export const cancelled = Effect.fn("SessionTask.cancelled")(function* (
  db: DatabaseService,
  parentID: SessionSchema.ID,
  messageID: SessionMessage.ID,
  callID: string,
) {
  if (yield* interrupted(db, parentID, messageID, callID)) return true
  const requested = yield* db
    .select({ seq: EventTable.seq, data: EventTable.data })
    .from(EventTable)
    .where(
      and(
        eq(EventTable.aggregate_id, parentID),
        eq(EventTable.type, requestedType),
        eq(EventTable.id, requestEventID(parentID, messageID, callID)),
      ),
    )
    .get()
    .pipe(Effect.orDie)
  if (requested && Option.isNone(yield* decodeRequest(requested.data).pipe(Effect.option))) return true
  const origin = requested
    ? requested
    : (yield* db
        .select({ seq: EventTable.seq, data: EventTable.data })
        .from(EventTable)
        .where(and(eq(EventTable.aggregate_id, parentID), inArray(EventTable.type, taskCallTypes)))
        .orderBy(asc(EventTable.seq))
        .all()
        .pipe(Effect.orDie)).find(
        (item) =>
          item.data.assistantMessageID === messageID &&
          item.data.callID === callID &&
          (item.data.name === "task" || item.data.tool === "task"),
      )
  if (!origin) return true
  return (
    (yield* db
      .select({ id: EventTable.id })
      .from(EventTable)
      .where(
        and(
          eq(EventTable.aggregate_id, parentID),
          gt(EventTable.seq, origin.seq),
          eq(EventTable.type, interruptRequestedType),
        ),
      )
      .get()
      .pipe(Effect.orDie)) !== undefined
  )
})

export const requestedSessions = Effect.fn("SessionTask.requestedSessions")(function* (db: DatabaseService) {
  const rows = yield* db
    .select({ aggregateID: EventTable.aggregate_id })
    .from(EventTable)
    .where(inArray(EventTable.type, [preparedType, requestedType]))
    .all()
    .pipe(Effect.orDie)
  return [...new Set(rows.map((row) => SessionSchema.ID.make(row.aggregateID)))]
})

export const hasPending = Effect.fn("SessionTask.hasPending")(function* (
  store: SessionStore.Interface,
  sessionID: SessionSchema.ID,
) {
  return (yield* store.context(sessionID)).some(
    (message) =>
      message.type === "assistant" &&
      message.content.some(
        (part) => part.type === "tool" && part.name === "task" && ["pending", "running"].includes(part.state.status),
      ),
  )
})

export const orphaned = Effect.fn("SessionTask.orphaned")(function* (db: DatabaseService, sessionID: SessionSchema.ID) {
  const row = yield* db.select().from(SessionTable).where(eq(SessionTable.id, sessionID)).get().pipe(Effect.orDie)
  const owner = SessionTaskMetadata.owner(row?.metadata)
  if (!row) return false
  if (!owner)
    return (
      row.parent_id !== null || (typeof row.metadata === "object" && row.metadata !== null && "task" in row.metadata)
    )
  const origin = yield* recoveryRequest(db, owner.parentID, owner.origin.messageID, owner.origin.callID)
  const canonical = (item: SessionEvent.Task.Requested["data"]) =>
    row.id === childID(owner.parentID, owner.origin.messageID, owner.origin.callID) &&
    item.sessionID === owner.parentID &&
    item.childSessionID === row.id &&
    item.promptMessageID === promptID(item.sessionID, item.assistantMessageID, item.callID) &&
    item.agent === owner.agent &&
    item.agent === row.agent &&
    item.projectID === row.project_id &&
    item.location.directory === row.directory &&
    item.location.workspaceID === (row.workspace_id ?? undefined) &&
    item.title === row.title &&
    item.model.id === row.model?.id &&
    item.model.providerID === row.model?.providerID &&
    (item.model.variant ?? "default") === (row.model?.variant ?? "default") &&
    item.ceiling.every((rule) => owner.ceiling.some((current) => JSON.stringify(current) === JSON.stringify(rule)))
  if (!origin || !canonical(origin)) return true
  const originRow = yield* db
    .select({ seq: EventTable.seq })
    .from(EventTable)
    .where(
      and(
        eq(EventTable.aggregate_id, owner.parentID),
        eq(EventTable.type, requestedType),
        eq(EventTable.id, requestEventID(owner.parentID, owner.origin.messageID, owner.origin.callID)),
      ),
    )
    .get()
    .pipe(Effect.orDie)
  if (!originRow) return true
  const requests = yield* db
    .select({ id: EventTable.id, data: EventTable.data })
    .from(EventTable)
    .where(and(eq(EventTable.aggregate_id, owner.parentID), eq(EventTable.type, requestedType)))
    .all()
    .pipe(Effect.orDie)
  const decoded = (yield* Effect.forEach(requests, (item) =>
    decodeRequest(item.data).pipe(Effect.option, Effect.map(Option.map((data) => ({ id: item.id, data })))),
  )).flatMap(Option.toArray)
  const interruptedRequests = yield* Effect.forEach(
    decoded.filter(
      (item) =>
        item.id === requestEventID(owner.parentID, item.data.assistantMessageID, item.data.callID) &&
        canonical(item.data),
    ),
    (item) => interrupted(db, owner.parentID, item.data.assistantMessageID, item.data.callID),
  )
  return (
    (yield* db
      .select({ id: EventTable.id })
      .from(EventTable)
      .where(
        and(
          eq(EventTable.aggregate_id, owner.parentID),
          gt(EventTable.seq, originRow.seq),
          eq(EventTable.type, interruptRequestedType),
        ),
      )
      .get()
      .pipe(Effect.orDie)) !== undefined || interruptedRequests.some(Boolean)
  )
})
