import { sql } from "drizzle-orm"
import { check, foreignKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
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
    session_id: text().$type<SessionSchema.ID>(),
    directory_id: text().$type<PermissionSaved.DirectoryID>(),
    ...Timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.session_id, table.project_id],
      foreignColumns: [SessionTable.id, SessionTable.project_id],
      name: "permission_session_owner_fk",
    }).onDelete("cascade"),
    check(
      "permission_scope_match_check",
      sql`(${table.scope} = 'project' AND ${table.match} = 'pattern' AND ${table.session_id} IS NULL)
        AND ${table.directory_id} IS NULL
        OR (${table.scope} = 'session' AND ${table.match} = 'exact' AND ${table.session_id} IS NOT NULL
          AND ${table.directory_id} IS NULL)
        OR (${table.scope} = 'global' AND ${table.match} = 'exact' AND ${table.session_id} IS NULL
          AND ${table.directory_id} IS NULL AND ${table.project_id} = 'global')
        OR (${table.scope} = 'directory' AND ${table.match} = 'pattern' AND ${table.session_id} IS NULL
          AND ${table.directory_id} IS NOT NULL AND length(${table.directory_id}) = 64
          AND ${table.directory_id} NOT GLOB '*[^0-9a-f]*' AND ${table.project_id} = 'global')`,
    ),
    uniqueIndex("permission_project_scope_action_resource_match_idx")
      .on(table.project_id, table.scope, table.action, table.resource, table.match)
      .where(sql`${table.session_id} IS NULL AND ${table.directory_id} IS NULL`),
    uniqueIndex("permission_session_scope_action_resource_match_idx")
      .on(table.session_id, table.scope, table.action, table.resource, table.match)
      .where(sql`${table.session_id} IS NOT NULL`),
    uniqueIndex("permission_directory_scope_action_resource_match_idx")
      .on(table.directory_id, table.scope, table.action, table.resource, table.match)
      .where(sql`${table.directory_id} IS NOT NULL`),
  ],
)
