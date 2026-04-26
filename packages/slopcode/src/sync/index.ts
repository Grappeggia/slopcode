import z from "zod"
import { and, asc, eq, lte, not, or } from "drizzle-orm"
import { Database } from "@/storage/db"
import { Identifier } from "@/id/id"
import { EventSequenceTable, EventTable } from "./event.sql"
import { MessageTable, PartTable, SessionTable, TodoTable } from "@/session/session.sql"

const supported = [
  "session.created",
  "session.updated",
  "session.deleted",
  "message.updated",
  "message.removed",
  "message.part.updated",
  "message.part.delta",
  "message.part.removed",
  "todo.updated",
] as const

const supportedSet = new Set<string>(supported)

const dataSchema = z.record(z.string(), z.unknown())

export const Serialized = z.object({
  id: z.string(),
  aggregateID: z.string(),
  seq: z.number().int().min(0),
  type: z.enum(supported),
  data: dataSchema,
})

export type Serialized = z.infer<typeof Serialized>

const rowSchema = z.object({
  id: z.string(),
  aggregate_id: z.string(),
  seq: z.number().int().min(0),
  type: z.enum(supported),
  data: dataSchema,
})

type Json = Record<string, unknown>

const object = (value: unknown): Json | undefined => {
  if (typeof value !== "object") return
  if (value === null) return
  if (Array.isArray(value)) return
  return value as Json
}

const text = (value: unknown) => (typeof value === "string" ? value : undefined)
const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined)

const clone = (value: Json) => JSON.parse(JSON.stringify(value)) as Json

const aggregate = (type: string, data: Json) => {
  if (type.startsWith("session.")) return text(object(data.info)?.id)
  if (type === "message.updated") return text(object(data.info)?.sessionID)
  if (type === "message.removed") return text(data.sessionID)
  if (type === "message.part.updated") return text(object(data.part)?.sessionID)
  if (type === "message.part.delta") return text(data.sessionID)
  if (type === "message.part.removed") return text(data.sessionID)
  if (type === "todo.updated") return text(data.sessionID)
}

const sessionRow = (info: Json) => {
  const summary = object(info.summary)
  const share = object(info.share)
  const time = object(info.time)
  return {
    id: text(info.id) ?? "",
    project_id: text(info.projectID) ?? "global",
    parent_id: text(info.parentID) ?? null,
    slug: text(info.slug) ?? "",
    directory: text(info.directory) ?? "",
    title: text(info.title) ?? "",
    version: text(info.version) ?? "",
    share_url: text(share?.url) ?? null,
    summary_additions: number(summary?.additions) ?? null,
    summary_deletions: number(summary?.deletions) ?? null,
    summary_files: number(summary?.files) ?? null,
    summary_diffs: summary?.diffs as typeof SessionTable.$inferInsert.summary_diffs,
    revert: object(info.revert) as typeof SessionTable.$inferInsert.revert,
    permission: info.permission as typeof SessionTable.$inferInsert.permission,
    time_created: number(time?.created) ?? Date.now(),
    time_updated: number(time?.updated) ?? Date.now(),
    time_compacting: number(time?.compacting) ?? null,
    time_archived: number(time?.archived) ?? null,
  }
}

const messageRow = (info: Json) => {
  const sessionID = text(info.sessionID) ?? ""
  const created = number(object(info.time)?.created) ?? Date.now()
  const data = { ...info }
  delete data.id
  delete data.sessionID
  return {
    id: text(info.id) ?? "",
    session_id: sessionID,
    time_created: created,
    data: data as typeof MessageTable.$inferInsert.data,
  }
}

const partRow = (part: Json) => {
  const sessionID = text(part.sessionID) ?? ""
  const messageID = text(part.messageID) ?? ""
  const data = { ...part }
  delete data.id
  delete data.sessionID
  delete data.messageID
  return {
    id: text(part.id) ?? "",
    message_id: messageID,
    session_id: sessionID,
    time_created: Date.now(),
    data: data as typeof PartTable.$inferInsert.data,
  }
}

const eventRow = (event: Serialized) => ({
  id: event.id,
  aggregate_id: event.aggregateID,
  seq: event.seq,
  type: event.type,
  data: clone(event.data),
})

const seq = (db: Database.TxOrDb, aggregateID: string) => {
  const row = db.select().from(EventSequenceTable).where(eq(EventSequenceTable.aggregate_id, aggregateID)).get()
  return row?.seq != null ? row.seq + 1 : 0
}

const store = (db: Database.TxOrDb, event: Serialized) => {
  db.insert(EventSequenceTable)
    .values({
      aggregate_id: event.aggregateID,
      seq: event.seq,
    })
    .onConflictDoUpdate({
      target: EventSequenceTable.aggregate_id,
      set: { seq: event.seq },
    })
    .run()
  db.insert(EventTable).values(eventRow(event)).run()
}

const patchDelta = (db: Database.TxOrDb, data: Json) => {
  const sessionID = text(data.sessionID)
  const messageID = text(data.messageID)
  const partID = text(data.partID)
  const field = text(data.field)
  const delta = text(data.delta)
  if (!sessionID || !messageID || !partID || !field || delta === undefined) return
  const row = db
    .select()
    .from(PartTable)
    .where(and(eq(PartTable.id, partID), eq(PartTable.message_id, messageID), eq(PartTable.session_id, sessionID)))
    .get()
  if (!row) return
  const next = { ...row.data } as Record<string, unknown>
  const current = next[field]
  if (typeof current === "string") next[field] = current + delta
  else if (current === undefined) next[field] = delta
  else return
  db.update(PartTable)
    .set({ data: next as typeof PartTable.$inferInsert.data })
    .where(and(eq(PartTable.id, partID), eq(PartTable.message_id, messageID), eq(PartTable.session_id, sessionID)))
    .run()
}

const project = (db: Database.TxOrDb, event: Serialized) => {
  if (event.type === "session.created" || event.type === "session.updated") {
    const info = object(event.data.info)
    if (!info) return
    const row = sessionRow(info)
    const { id, ...set } = row
    db.insert(SessionTable).values(row).onConflictDoUpdate({ target: SessionTable.id, set }).run()
    return
  }

  if (event.type === "session.deleted") {
    const id = text(object(event.data.info)?.id)
    if (!id) return
    db.delete(SessionTable).where(eq(SessionTable.id, id)).run()
    return
  }

  if (event.type === "message.updated") {
    const info = object(event.data.info)
    if (!info) return
    const row = messageRow(info)
    const { id, ...set } = row
    db.insert(MessageTable).values(row).onConflictDoUpdate({ target: MessageTable.id, set }).run()
    return
  }

  if (event.type === "message.removed") {
    const sessionID = text(event.data.sessionID)
    const messageID = text(event.data.messageID)
    if (!sessionID || !messageID) return
    db.delete(MessageTable)
      .where(and(eq(MessageTable.id, messageID), eq(MessageTable.session_id, sessionID)))
      .run()
    return
  }

  if (event.type === "message.part.updated") {
    const part = object(event.data.part)
    if (!part) return
    const row = partRow(part)
    const { id, ...set } = row
    db.insert(PartTable).values(row).onConflictDoUpdate({ target: PartTable.id, set }).run()
    return
  }

  if (event.type === "message.part.delta") {
    patchDelta(db, event.data)
    return
  }

  if (event.type === "message.part.removed") {
    const sessionID = text(event.data.sessionID)
    const partID = text(event.data.partID)
    if (!sessionID || !partID) return
    db.delete(PartTable)
      .where(and(eq(PartTable.id, partID), eq(PartTable.session_id, sessionID)))
      .run()
    return
  }

  if (event.type === "todo.updated") {
    const sessionID = text(event.data.sessionID)
    const todos = Array.isArray(event.data.todos)
      ? event.data.todos.map(object).filter((item): item is Json => !!item)
      : []
    if (!sessionID) return
    db.delete(TodoTable).where(eq(TodoTable.session_id, sessionID)).run()
    if (todos.length === 0) return
    db.insert(TodoTable)
      .values(
        todos.map((todo, position) => ({
          session_id: sessionID,
          content: text(todo.content) ?? "",
          status: text(todo.status) ?? "pending",
          priority: text(todo.priority) ?? "medium",
          position,
        })),
      )
      .run()
  }
}

export namespace SyncEvent {
  export function types() {
    return [...supported]
  }

  export function capture(type: string, payload: Record<string, unknown>) {
    if (!supportedSet.has(type)) return
    const aggregateID = aggregate(type, payload)
    if (!aggregateID) return
    Database.use((db) => {
      store(db, {
        id: Identifier.ascending("event"),
        aggregateID,
        seq: seq(db, aggregateID),
        type: type as Serialized["type"],
        data: clone(payload),
      })
    })
  }

  export function history(state: Record<string, number>) {
    const known = Object.entries(state)
    const where =
      known.length > 0
        ? not(or(...known.map(([id, value]) => and(eq(EventTable.aggregate_id, id), lte(EventTable.seq, value))))!)
        : undefined
    const rows = Database.use((db) => db.select().from(EventTable).where(where).orderBy(asc(EventTable.seq)).all())
    return rows.map((row) =>
      Serialized.parse({
        id: row.id,
        aggregateID: row.aggregate_id,
        seq: row.seq,
        type: row.type,
        data: row.data,
      }),
    )
  }

  export function replay(event: Serialized) {
    Database.transaction((db) => {
      const row = db
        .select()
        .from(EventSequenceTable)
        .where(eq(EventSequenceTable.aggregate_id, event.aggregateID))
        .get()
      const latest = row?.seq ?? -1
      if (event.seq <= latest) return
      const expected = latest + 1
      if (event.seq !== expected) {
        throw new Error(
          `Sequence mismatch for aggregate "${event.aggregateID}": expected ${expected}, got ${event.seq}`,
        )
      }
      project(db, event)
      store(db, event)
    })
  }

  export function replayAll(events: Serialized[]) {
    const aggregateID = events[0]?.aggregateID
    if (!aggregateID) return
    if (events.some((item) => item.aggregateID !== aggregateID)) {
      throw new Error("Replay events must belong to the same aggregate")
    }
    const start = events[0]?.seq ?? 0
    events.forEach((item, index) => {
      const expected = start + index
      if (item.seq !== expected) {
        throw new Error(`Replay sequence mismatch at index ${index}: expected ${expected}, got ${item.seq}`)
      }
    })
    events.forEach((item) => replay(item))
    return aggregateID
  }

  export function remove(aggregateID: string) {
    Database.transaction((db) => {
      db.delete(EventSequenceTable).where(eq(EventSequenceTable.aggregate_id, aggregateID)).run()
      db.delete(EventTable).where(eq(EventTable.aggregate_id, aggregateID)).run()
    })
  }

  export function row(value: unknown) {
    return rowSchema.parse(value)
  }
}
