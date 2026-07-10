import { sql } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../database/schema.sql"
import { ProjectTable } from "../project/sql"
import type { Memory } from "../memory"
import type { ProjectV2 } from "../project"
import type { SessionSchema } from "../session/schema"
import type { SessionV1 } from "../v1/session"

export const MemoryTable = sqliteTable(
  "memory",
  {
    id: text().$type<Memory.ID>().primaryKey(),
    project_id: text()
      .$type<ProjectV2.ID>()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    scope: text().$type<Memory.Scope>().notNull(),
    content: text().notNull(),
    hash: text().notNull(),
    source_session_id: text().$type<SessionSchema.ID>(),
    source_message_id: text().$type<SessionV1.MessageID>(),
    enabled: integer({ mode: "boolean" }).notNull().default(true),
    time_accessed: integer(),
    ...Timestamps,
  },
  (table) => [
    index("memory_project_enabled_time_idx").on(table.project_id, table.enabled, table.time_updated),
    uniqueIndex("memory_global_scope_hash_idx")
      .on(table.scope, table.hash)
      .where(sql`${table.project_id} IS NULL`),
    uniqueIndex("memory_project_scope_hash_idx")
      .on(table.scope, table.project_id, table.hash)
      .where(sql`${table.project_id} IS NOT NULL`),
  ],
)
