import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260712155937_session_execution_status",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`session_execution_status\` (
          \`session_id\` text PRIMARY KEY,
          \`activity_id\` text NOT NULL,
          \`root_id\` text NOT NULL,
          \`owner\` text NOT NULL,
          \`epoch\` integer NOT NULL,
          \`seq\` integer NOT NULL,
          \`data\` text NOT NULL,
          CONSTRAINT \`fk_session_execution_status_session_id_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`CREATE INDEX \`session_execution_status_owner_state_idx\` ON \`session_execution_status\` (\`owner\`,\`epoch\`,\`session_id\`);`)
    })
  },
} satisfies DatabaseMigration.Migration
