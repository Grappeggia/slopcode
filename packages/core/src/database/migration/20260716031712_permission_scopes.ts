import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260716031712_permission_scopes",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`permission\` ADD \`scope\` text DEFAULT 'project' NOT NULL;`)
      yield* tx.run(`ALTER TABLE \`permission\` ADD \`match\` text DEFAULT 'pattern' NOT NULL;`)
      yield* tx.run(`ALTER TABLE \`permission\` ADD \`session_id\` text REFERENCES session(id) ON DELETE CASCADE;`)
      yield* tx.run(`DROP INDEX IF EXISTS \`permission_project_action_resource_idx\`;`)
      yield* tx.run(
        `CREATE UNIQUE INDEX \`permission_project_scope_action_resource_match_idx\` ON \`permission\` (\`project_id\`,\`scope\`,\`action\`,\`resource\`,\`match\`) WHERE "permission"."session_id" IS NULL;`,
      )
      yield* tx.run(
        `CREATE UNIQUE INDEX \`permission_session_scope_action_resource_match_idx\` ON \`permission\` (\`session_id\`,\`scope\`,\`action\`,\`resource\`,\`match\`) WHERE "permission"."session_id" IS NOT NULL;`,
      )
    })
  },
} satisfies DatabaseMigration.Migration
