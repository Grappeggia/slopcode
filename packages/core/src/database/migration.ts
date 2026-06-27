export * as DatabaseMigration from "./migration"

import { sql } from "drizzle-orm"
import { Effect, Semaphore } from "effect"
import type { EffectDrizzleSqlite } from "@slopcode-ai/effect-drizzle-sqlite"
import { migrations } from "./migration.gen"
import schema from "./schema.gen"

type Database = EffectDrizzleSqlite.EffectSQLiteDatabase
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0]
const lock = Semaphore.makeUnsafe(1)

export type Migration = {
  id: string
  up: (tx: Transaction) => Effect.Effect<void, unknown>
}

export function apply(db: Database) {
  return lock.withPermit(
    Effect.gen(function* () {
      const tables = yield* db.all<{ name: string }>(
        sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
      )
      if (tables.some((table) => table.name === "session")) return yield* applyOnly(db, migrations)
      if (tables.length > 0) return yield* Effect.die("Database is not empty and has no session table")
      yield* db.transaction((tx) =>
        Effect.gen(function* () {
          yield* schema.up(tx)
          yield* tx.run(
            sql`CREATE TABLE ${sql.identifier("migration")} (id TEXT PRIMARY KEY, time_completed INTEGER NOT NULL)`,
          )
          yield* Effect.forEach(migrations, (migration) =>
            tx.run(
              sql`INSERT INTO ${sql.identifier("migration")} (id, time_completed) VALUES (${migration.id}, ${Date.now()})`,
            ),
          )
        }),
      )
    }),
  )
}

export function applyOnly(db: Database, input: Migration[]) {
  return Effect.gen(function* () {
    yield* db.run(
      sql`CREATE TABLE IF NOT EXISTS ${sql.identifier("migration")} (id TEXT PRIMARY KEY, time_completed INTEGER NOT NULL)`,
    )
    let completed = new Set(
      (yield* db.all<{ id: string }>(sql`SELECT id FROM ${sql.identifier("migration")}`)).map((row) => row.id),
    )
    if (completed.size === 0) {
      // Existing installs used Drizzle's migration journal. Seed the new
      // journal once so TypeScript migrations don't replay old SQL.
      // Handle both old (name) and new (hash) drizzle journal schemas.
      if (
        yield* db.get(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${"__drizzle_migrations"}`)
      ) {
        const columns = yield* db.all<{ name: string }>(
          sql`PRAGMA table_info(${sql.identifier("__drizzle_migrations")})`,
        )
        const idCol = columns.find((c) => c.name === "hash")
          ? "hash"
          : columns.find((c) => c.name === "name")
            ? "name"
            : null
        if (idCol) {
          yield* db.run(sql`
            INSERT OR IGNORE INTO ${sql.identifier("migration")} (id, time_completed)
            SELECT ${sql.identifier(idCol)}, ${Date.now()}
            FROM ${sql.identifier("__drizzle_migrations")}
            WHERE ${sql.identifier(idCol)} IS NOT NULL AND ${sql.identifier(idCol)} != ''
          `)
        }
        completed = new Set(
          (yield* db.all<{ id: string }>(sql`SELECT id FROM ${sql.identifier("migration")}`)).map((row) => row.id),
        )
        // If seeding produced no usable IDs (empty hash/name columns),
        // mark the first N migrations as completed based on row count.
        // The old drizzle journal recorded applied migrations in order.
        if (completed.size === 0) {
          const count = yield* db.get<{ c: number }>(
            sql`SELECT COUNT(*) as c FROM ${sql.identifier("__drizzle_migrations")}`,
          )
          const n = count?.c ?? 0
          if (n > 0) {
            yield* db.transaction((tx) =>
              Effect.gen(function* () {
                for (let i = 0; i < Math.min(n, input.length); i++) {
                  yield* tx.run(
                    sql`INSERT OR IGNORE INTO ${sql.identifier("migration")} (id, time_completed) VALUES (${input[i].id}, ${Date.now()})`,
                  )
                }
              }),
            )
            completed = new Set(
              (yield* db.all<{ id: string }>(sql`SELECT id FROM ${sql.identifier("migration")}`)).map((row) => row.id),
            )
          }
        }
      }
    }

    for (const migration of input) {
      if (completed.has(migration.id)) continue
      yield* db.transaction((tx) =>
        Effect.gen(function* () {
          yield* migration.up(tx)
          yield* tx.run(
            sql`INSERT INTO ${sql.identifier("migration")} (id, time_completed) VALUES (${migration.id}, ${Date.now()})`,
          )
        }),
      )
    }
  })
}
