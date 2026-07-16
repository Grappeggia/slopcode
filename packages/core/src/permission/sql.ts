import { sql } from "drizzle-orm"
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../database/schema.sql"
import type { ProjectV2 } from "../project"
import { ProjectTable } from "../project/sql"
import type { SessionSchema } from "../session/schema"
import { SessionTable } from "../session/sql"
import type { PermissionSaved } from "./saved"

export const PermissionTable = sqliteTable(
  "permission",
  {
    id: text().$type<PermissionSaved.ID>().primaryKey(),
    project_id: text()
      .$type<ProjectV2.ID>()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    action: text().notNull(),
    resource: text().notNull(),
    scope: text().$type<PermissionSaved.Scope>().notNull().default("project"),
    match: text().$type<PermissionSaved.Match>().notNull().default("pattern"),
    session_id: text()
      .$type<SessionSchema.ID>()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    ...Timestamps,
  },
  (table) => [
    uniqueIndex("permission_project_scope_action_resource_match_idx")
      .on(table.project_id, table.scope, table.action, table.resource, table.match)
      .where(sql`${table.session_id} IS NULL`),
    uniqueIndex("permission_session_scope_action_resource_match_idx")
      .on(table.session_id, table.scope, table.action, table.resource, table.match)
      .where(sql`${table.session_id} IS NOT NULL`),
  ],
)
