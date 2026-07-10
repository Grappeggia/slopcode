import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260703232749_add_memory",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`memory\` (
          \`id\` text PRIMARY KEY,
          \`project_id\` text,
          \`scope\` text NOT NULL,
          \`content\` text NOT NULL,
          \`hash\` text NOT NULL,
          \`source_session_id\` text,
          \`source_message_id\` text,
          \`enabled\` integer DEFAULT true NOT NULL,
          \`time_accessed\` integer,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          CONSTRAINT \`fk_memory_project_id_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`project\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`CREATE INDEX \`memory_project_enabled_time_idx\` ON \`memory\` (\`project_id\`,\`enabled\`,\`time_updated\`);`)
      yield* tx.run(
        `CREATE UNIQUE INDEX \`memory_global_scope_hash_idx\` ON \`memory\` (\`scope\`,\`hash\`) WHERE "memory"."project_id" IS NULL;`,
      )
      yield* tx.run(
        `CREATE UNIQUE INDEX \`memory_project_scope_hash_idx\` ON \`memory\` (\`scope\`,\`project_id\`,\`hash\`) WHERE "memory"."project_id" IS NOT NULL;`,
      )
    })
  },
} satisfies DatabaseMigration.Migration
