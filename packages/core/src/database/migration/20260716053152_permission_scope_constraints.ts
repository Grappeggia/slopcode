import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260716053152_permission_scope_constraints",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(
        `CREATE UNIQUE INDEX IF NOT EXISTS \`session_id_project_idx\` ON \`session\` (\`id\`,\`project_id\`);`,
      )
      yield* tx.run(`
        CREATE TABLE \`__new_permission\` (
          \`id\` text PRIMARY KEY,
          \`project_id\` text NOT NULL,
          \`action\` text NOT NULL,
          \`resource\` text NOT NULL,
          \`scope\` text DEFAULT 'project' NOT NULL,
          \`match\` text DEFAULT 'pattern' NOT NULL,
          \`session_id\` text,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          CONSTRAINT \`fk_permission_project_id_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`project\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`permission_session_owner_fk\` FOREIGN KEY (\`session_id\`,\`project_id\`) REFERENCES \`session\`(\`id\`,\`project_id\`) ON DELETE CASCADE,
          CONSTRAINT "permission_scope_match_check" CHECK(("scope" = 'project' AND "match" = 'pattern' AND "session_id" IS NULL)
                OR ("scope" = 'session' AND "match" = 'exact' AND "session_id" IS NOT NULL)
                OR ("scope" = 'global' AND "match" = 'exact' AND "session_id" IS NULL AND "project_id" = 'global'))
        );
      `)
      yield* tx.run(`
        INSERT INTO \`__new_permission\`
          (\`id\`, \`project_id\`, \`action\`, \`resource\`, \`scope\`, \`match\`, \`session_id\`, \`time_created\`, \`time_updated\`)
        SELECT p.\`id\`, p.\`project_id\`, p.\`action\`, p.\`resource\`, p.\`scope\`, p.\`match\`, p.\`session_id\`, p.\`time_created\`, p.\`time_updated\`
        FROM \`permission\` p
        WHERE (p.\`scope\` = 'project' AND p.\`match\` = 'pattern' AND p.\`session_id\` IS NULL)
           OR (p.\`scope\` = 'global' AND p.\`match\` = 'exact' AND p.\`session_id\` IS NULL AND p.\`project_id\` = 'global')
           OR (p.\`scope\` = 'session' AND p.\`match\` = 'exact' AND p.\`session_id\` IS NOT NULL AND EXISTS (
             SELECT 1 FROM \`session\` s WHERE s.\`id\` = p.\`session_id\` AND s.\`project_id\` = p.\`project_id\`
           ));
      `)
      yield* tx.run(`DROP TABLE \`permission\`;`)
      yield* tx.run(`ALTER TABLE \`__new_permission\` RENAME TO \`permission\`;`)
      yield* tx.run(
        `CREATE UNIQUE INDEX \`permission_project_scope_action_resource_match_idx\` ON \`permission\` (\`project_id\`,\`scope\`,\`action\`,\`resource\`,\`match\`) WHERE "permission"."session_id" IS NULL;`,
      )
      yield* tx.run(
        `CREATE UNIQUE INDEX \`permission_session_scope_action_resource_match_idx\` ON \`permission\` (\`session_id\`,\`scope\`,\`action\`,\`resource\`,\`match\`) WHERE "permission"."session_id" IS NOT NULL;`,
      )
    })
  },
} satisfies DatabaseMigration.Migration
