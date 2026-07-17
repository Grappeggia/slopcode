import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260717051925_permission_directory_owner",
  strict: true,
  up(tx) {
    return Effect.gen(function* () {
      const tables = yield* tx.all<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('permission', '__new_permission');`,
      )
      const current = tables.some((table) => table.name === "permission")
      const replacement = tables.some((table) => table.name === "__new_permission")
      if (!current && replacement) yield* tx.run(`ALTER TABLE \`__new_permission\` RENAME TO \`permission\`;`)
      if (!current && !replacement) return yield* Effect.die("Permission table not found")
      yield* tx.run(`DROP TABLE IF EXISTS \`__new_permission\`;`)
      yield* tx.run(`
        CREATE TABLE \`__new_permission\` (
          \`id\` text PRIMARY KEY,
          \`project_id\` text NOT NULL,
          \`action\` text NOT NULL,
          \`resource\` text NOT NULL,
          \`scope\` text DEFAULT 'project' NOT NULL,
          \`match\` text DEFAULT 'pattern' NOT NULL,
          \`session_id\` text,
          \`directory_id\` text,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          CONSTRAINT \`fk_permission_project_id_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`project\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`permission_session_owner_fk\` FOREIGN KEY (\`session_id\`,\`project_id\`) REFERENCES \`session\`(\`id\`,\`project_id\`) ON DELETE CASCADE,
          CONSTRAINT "permission_scope_match_check" CHECK(("scope" = 'project' AND "match" = 'pattern' AND "session_id" IS NULL)
                AND "directory_id" IS NULL
                OR ("scope" = 'session' AND "match" = 'exact' AND "session_id" IS NOT NULL
                  AND "directory_id" IS NULL)
                OR ("scope" = 'global' AND "match" = 'exact' AND "session_id" IS NULL
                  AND "directory_id" IS NULL AND "project_id" = 'global')
                OR ("scope" = 'directory' AND "match" = 'pattern' AND "session_id" IS NULL
                  AND "directory_id" IS NOT NULL AND length("directory_id") = 64
                  AND "directory_id" NOT GLOB '*[^0-9a-f]*' AND "project_id" = 'global'))
        );
      `)
      const columns = yield* tx.all<{ name: string }>(`PRAGMA table_info('permission');`)
      yield* tx.run(
        columns.some((column) => column.name === "directory_id")
          ? `INSERT INTO \`__new_permission\`(\`id\`, \`project_id\`, \`action\`, \`resource\`, \`scope\`, \`match\`, \`session_id\`, \`directory_id\`, \`time_created\`, \`time_updated\`) SELECT \`id\`, \`project_id\`, \`action\`, \`resource\`, \`scope\`, \`match\`, \`session_id\`, \`directory_id\`, \`time_created\`, \`time_updated\` FROM \`permission\`;`
          : `INSERT INTO \`__new_permission\`(\`id\`, \`project_id\`, \`action\`, \`resource\`, \`scope\`, \`match\`, \`session_id\`, \`time_created\`, \`time_updated\`) SELECT \`id\`, \`project_id\`, \`action\`, \`resource\`, \`scope\`, \`match\`, \`session_id\`, \`time_created\`, \`time_updated\` FROM \`permission\`;`,
      )
      yield* tx.run(`DROP TABLE \`permission\`;`)
      yield* tx.run(`ALTER TABLE \`__new_permission\` RENAME TO \`permission\`;`)
      yield* tx.run(
        `CREATE UNIQUE INDEX \`permission_project_scope_action_resource_match_idx\` ON \`permission\` (\`project_id\`,\`scope\`,\`action\`,\`resource\`,\`match\`) WHERE "permission"."session_id" IS NULL AND "permission"."directory_id" IS NULL;`,
      )
      yield* tx.run(
        `CREATE UNIQUE INDEX \`permission_session_scope_action_resource_match_idx\` ON \`permission\` (\`session_id\`,\`scope\`,\`action\`,\`resource\`,\`match\`) WHERE "permission"."session_id" IS NOT NULL;`,
      )
      yield* tx.run(
        `CREATE UNIQUE INDEX \`permission_directory_scope_action_resource_match_idx\` ON \`permission\` (\`directory_id\`,\`scope\`,\`action\`,\`resource\`,\`match\`) WHERE "permission"."directory_id" IS NOT NULL;`,
      )
    })
  },
} satisfies DatabaseMigration.Migration
