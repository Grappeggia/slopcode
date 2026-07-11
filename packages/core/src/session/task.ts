export * as SessionTask from "./task"

import { and, eq, gt } from "drizzle-orm"
import { Effect, Schema } from "effect"
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

export const interruptedEventID = (parentID: SessionSchema.ID, messageID: SessionMessage.ID, callID: string) =>
  EventV2.ID.make(`evt_${hash("task-interrupted-v2", parentID, messageID, callID)}`)

export const interruptedToolEventID = (parentID: SessionSchema.ID, messageID: SessionMessage.ID, callID: string) =>
  EventV2.ID.make(`evt_${hash("task-tool-interrupted-v2", parentID, messageID, callID)}`)

const requestedType = `${SessionEvent.Task.Requested.type}.1`
const interruptedType = `${SessionEvent.Task.Interrupted.type}.1`
const interruptRequestedType = `${SessionEvent.InterruptRequested.type}.1`
const decodeRequest = Schema.decodeUnknownEffect(SessionEvent.Task.Requested.data)

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
  return yield* decodeRequest(row.data).pipe(Effect.orDie)
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

export const requestedSessions = Effect.fn("SessionTask.requestedSessions")(function* (db: DatabaseService) {
  const rows = yield* db
    .select({ aggregateID: EventTable.aggregate_id })
    .from(EventTable)
    .where(eq(EventTable.type, requestedType))
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
  const row = yield* db
    .select({ metadata: SessionTable.metadata })
    .from(SessionTable)
    .where(eq(SessionTable.id, sessionID))
    .get()
    .pipe(Effect.orDie)
  const owner = SessionTaskMetadata.owner(row?.metadata)
  if (!owner) return false
  const request = yield* db
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
  if (!request) return false
  return (
    (yield* db
      .select({ id: EventTable.id })
      .from(EventTable)
      .where(
        and(
          eq(EventTable.aggregate_id, owner.parentID),
          gt(EventTable.seq, request.seq),
          eq(EventTable.type, interruptRequestedType),
        ),
      )
      .get()
      .pipe(Effect.orDie)) !== undefined ||
    (yield* interrupted(db, owner.parentID, owner.origin.messageID, owner.origin.callID))
  )
})
