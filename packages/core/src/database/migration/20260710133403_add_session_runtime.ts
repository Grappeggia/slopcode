import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260710133403_add_session_runtime",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`session\` ADD \`runtime\` text DEFAULT 'v1' NOT NULL;`)
      yield* tx.run(`ALTER TABLE \`session\` ADD \`runtime_epoch\` integer DEFAULT 0 NOT NULL;`)
      yield* tx.run(`ALTER TABLE \`session\` ADD \`runtime_state\` text DEFAULT 'ready' NOT NULL;`)
    })
  },
} satisfies DatabaseMigration.Migration
