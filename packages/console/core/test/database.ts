import { afterAll, beforeAll, beforeEach, setDefaultTimeout } from "bun:test"
import mysql, { type Pool } from "mysql2/promise"
import { drizzle } from "drizzle-orm/mysql2"
import { Database } from "../src/drizzle"
import { AuthTable } from "../src/schema/auth.sql"
import {
  BillingTable,
  LegacyUsageClaimTable,
  LiteTable,
  SubscriptionTable,
  UsageReservationTable,
  UsageTable,
} from "../src/schema/billing.sql"
import { KeyTable } from "../src/schema/key.sql"
import { UserTable } from "../src/schema/user.sql"
import { WorkspaceTable } from "../src/schema/workspace.sql"

setDefaultTimeout(300_000)

type TestDatabase = ReturnType<typeof drizzle>

let container: string | undefined
let pool: Pool
let db: TestDatabase

async function run(args: string[]) {
  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  })
  const output = Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
  const code = await proc.exited
  const [stdout, stderr] = await output
  if (code !== 0) throw new Error(stderr.trim() || `${args.join(" ")} failed with exit code ${code}`)
  return stdout.trim()
}

async function wait(url: string, attempts = 120): Promise<void> {
  const connection = await mysql.createConnection(url).catch(() => undefined)
  if (connection) {
    await connection.end()
    return
  }
  if (attempts === 0) throw new Error("MySQL test database did not become ready")
  await Bun.sleep(500)
  return wait(url, attempts - 1)
}

async function migrate() {
  const files = await Array.fromAsync(
    new Bun.Glob("*/migration.sql").scan({
      cwd: new URL("../migrations", import.meta.url).pathname,
      absolute: true,
    }),
  )
  for (const file of files.sort()) {
    const statements = (await Bun.file(file).text())
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean)
    for (const statement of statements) await pool.query(statement)
  }
}

beforeAll(async () => {
  const url = await (async () => {
    if (process.env.SLOPCODE_CONSOLE_TEST_DATABASE_URL) return process.env.SLOPCODE_CONSOLE_TEST_DATABASE_URL
    container = `slopcode-console-test-${crypto.randomUUID()}`
    await run([
      "docker",
      "run",
      "--rm",
      "-d",
      "--name",
      container,
      "-e",
      "MYSQL_ROOT_PASSWORD=test",
      "-e",
      "MYSQL_DATABASE=console",
      "-p",
      "127.0.0.1::3306",
      "mysql:8.4",
    ])
    const port = await run([
      "docker",
      "inspect",
      "--format",
      '{{(index (index .NetworkSettings.Ports "3306/tcp") 0).HostPort}}',
      container,
    ])
    return `mysql://root:test@127.0.0.1:${port}/console`
  })()

  await wait(url)
  pool = mysql.createPool(url)
  db = drizzle({ client: pool })
  await migrate()
})

beforeEach(async () => {
  await pool.query("DROP TRIGGER IF EXISTS fail_key_update")
  await pool.query("DROP TRIGGER IF EXISTS fail_billing_update")
  await pool.query("DROP TRIGGER IF EXISTS fail_usage_insert")
  await db.delete(UsageTable)
  await db.delete(UsageReservationTable)
  await db.delete(LegacyUsageClaimTable)
  await db.delete(SubscriptionTable)
  await db.delete(LiteTable)
  await db.delete(KeyTable)
  await db.delete(UserTable)
  await db.delete(BillingTable)
  await db.delete(AuthTable)
  await db.delete(WorkspaceTable)
})

afterAll(async () => {
  await pool?.end()
  if (container) await run(["docker", "rm", "-f", container])
})

export function testDatabase() {
  return db
}

export function useTestDatabase<T>(callback: () => Promise<T>): Promise<T> {
  return Promise.resolve().then(() => Database.provide(db as unknown as Database.TxOrDb, callback))
}
