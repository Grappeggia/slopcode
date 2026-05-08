import { Database as BunDatabase } from "bun:sqlite"
import { drizzle, type SQLiteBunDatabase } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import { type SQLiteTransaction } from "drizzle-orm/sqlite-core"
export * from "drizzle-orm"
import { Context } from "../util/context"
import { lazy } from "../util/lazy"
import { Global } from "../global"
import { Log } from "../util/log"
import { NamedError } from "@slopcode-ai/util/error"
import z from "zod"
import path from "path"
import { readFileSync, readdirSync, existsSync } from "fs"
import * as schema from "./schema"

declare const SLOPCODE_MIGRATIONS: { sql: string; timestamp: number }[] | undefined

export const NotFoundError = NamedError.create(
  "NotFoundError",
  z.object({
    message: z.string(),
  }),
)

const log = Log.create({ service: "db" })

export namespace Database {
  export const Path = path.join(Global.Path.data, "slopcode.db")
  type Schema = typeof schema
  export type Transaction = SQLiteTransaction<"sync", void, Schema>

  type Client = SQLiteBunDatabase<Schema>

  type Journal = { sql: string; timestamp: number }[]
  const SessionWorkspaceMigration = "20260506040851_session_path_workspace"
  const SessionWorkspaceMigrationTime = time(SessionWorkspaceMigration)
  const ColumnRow = z.object({ name: z.string() })
  const MigrationRow = z.object({ created_at: z.coerce.number() })

  const state = {
    sqlite: undefined as BunDatabase | undefined,
  }

  function time(tag: string) {
    const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(tag)
    if (!match) return 0
    return Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
    )
  }

  function migrations(dir: string): Journal {
    const dirs = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    const sql = dirs
      .map((name) => {
        const file = path.join(dir, name, "migration.sql")
        if (!existsSync(file)) return
        return {
          sql: readFileSync(file, "utf-8"),
          timestamp: time(name),
        }
      })
      .filter(Boolean) as Journal

    return sql.sort((a, b) => a.timestamp - b.timestamp)
  }

  function quote(value: string) {
    return `'${value.replaceAll("'", "''")}'`
  }

  function table(sqlite: BunDatabase, name: string) {
    return sqlite.query(`select 1 from sqlite_master where type = 'table' and name = ${quote(name)}`).get() !== null
  }

  function columns(sqlite: BunDatabase, name: string) {
    return new Set(
      sqlite
        .query(`select name from pragma_table_info(${quote(name)})`)
        .all()
        .flatMap((row) => {
          const parsed = ColumnRow.safeParse(row)
          return parsed.success ? [parsed.data.name] : []
        }),
    )
  }

  function applied(sqlite: BunDatabase) {
    if (!table(sqlite, "__drizzle_migrations")) return new Set<number>()
    return new Set(
      sqlite
        .query("select created_at from __drizzle_migrations")
        .all()
        .flatMap((row) => {
          const parsed = MigrationRow.safeParse(row)
          return parsed.success ? [parsed.data.created_at] : []
        }),
    )
  }

  function preflight(sqlite: BunDatabase, entries: Journal) {
    const target = entries.find((entry) => entry.timestamp === SessionWorkspaceMigrationTime)
    if (!target) return
    if (!table(sqlite, "session") || !table(sqlite, "__drizzle_migrations")) return

    const done = applied(sqlite)
    if (done.has(target.timestamp)) return
    if (entries.some((entry) => entry.timestamp < target.timestamp && !done.has(entry.timestamp))) return

    const existing = columns(sqlite, "session")
    const missingPath = !existing.has("path")
    const missingWorkspace = !existing.has("workspace_id")
    if (!missingPath && !missingWorkspace) return

    log.info("repairing session workspace migration", {
      path: missingPath,
      workspace: missingWorkspace,
      timestamp: target.timestamp,
    })
    if (missingPath) sqlite.run("ALTER TABLE `session` ADD `path` text")
    if (missingWorkspace) sqlite.run("ALTER TABLE `session` ADD `workspace_id` text")
    sqlite.run("CREATE INDEX IF NOT EXISTS `session_path_idx` ON `session` (`path`)")
    sqlite.run("CREATE INDEX IF NOT EXISTS `session_workspace_idx` ON `session` (`workspace_id`)")
    sqlite.query("insert into __drizzle_migrations (hash, created_at) values ('', ?)").run(target.timestamp)
  }

  export const Client = lazy(() => {
    log.info("opening database", { path: path.join(Global.Path.data, "slopcode.db") })

    const sqlite = new BunDatabase(path.join(Global.Path.data, "slopcode.db"), { create: true })
    state.sqlite = sqlite

    sqlite.run("PRAGMA journal_mode = WAL")
    sqlite.run("PRAGMA synchronous = NORMAL")
    sqlite.run("PRAGMA busy_timeout = 5000")
    sqlite.run("PRAGMA cache_size = -64000")
    sqlite.run("PRAGMA foreign_keys = ON")
    sqlite.run("PRAGMA wal_checkpoint(PASSIVE)")

    const db = drizzle({ client: sqlite, schema })

    // Apply schema migrations
    const entries =
      typeof SLOPCODE_MIGRATIONS !== "undefined"
        ? SLOPCODE_MIGRATIONS
        : migrations(path.join(import.meta.dirname, "../../migration"))
    if (entries.length > 0) {
      preflight(sqlite, entries)
      log.info("applying migrations", {
        count: entries.length,
        mode: typeof SLOPCODE_MIGRATIONS !== "undefined" ? "bundled" : "dev",
      })
      migrate(db, entries)
    }

    return db
  })

  export function close() {
    const sqlite = state.sqlite
    if (!sqlite) return
    sqlite.close()
    state.sqlite = undefined
    Client.reset()
  }

  export type TxOrDb = Transaction | Client

  const ctx = Context.create<{
    tx: TxOrDb
    effects: (() => void | Promise<void>)[]
  }>("database")

  export function use<T>(callback: (trx: TxOrDb) => T): T {
    try {
      return callback(ctx.use().tx)
    } catch (err) {
      if (err instanceof Context.NotFound) {
        const effects: (() => void | Promise<void>)[] = []
        const result = ctx.provide({ effects, tx: Client() }, () => callback(Client()))
        for (const effect of effects) effect()
        return result
      }
      throw err
    }
  }

  export function effect(fn: () => any | Promise<any>) {
    try {
      ctx.use().effects.push(fn)
    } catch {
      fn()
    }
  }

  export function transaction<T>(callback: (tx: TxOrDb) => T): T {
    try {
      return callback(ctx.use().tx)
    } catch (err) {
      if (err instanceof Context.NotFound) {
        const effects: (() => void | Promise<void>)[] = []
        const result = Client().transaction((tx) => {
          return ctx.provide({ tx, effects }, () => callback(tx))
        })
        for (const effect of effects) effect()
        return result
      }
      throw err
    }
  }
}
