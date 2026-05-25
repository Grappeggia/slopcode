import { Database as Sqlite } from "bun:sqlite"
import { afterEach, expect, mock, test } from "bun:test"
import { eq } from "drizzle-orm"
import { Account } from "../../src/account"
import { AccountStateTable, AccountTable } from "../../src/account/account.sql"
import { Database } from "../../src/storage/db"
import { resetDatabase } from "../fixture/db"

const originalFetch = globalThis.fetch

afterEach(async () => {
  globalThis.fetch = originalFetch
  await resetDatabase()
})

test("migrates legacy control accounts into account tables", async () => {
  await resetDatabase()

  const db = new Sqlite(Database.Path, { create: true })
  db.run(`
    CREATE TABLE control_account (
      email text NOT NULL,
      url text NOT NULL,
      access_token text NOT NULL,
      refresh_token text NOT NULL,
      token_expiry integer,
      active integer NOT NULL DEFAULT 0,
      time_created integer NOT NULL,
      time_updated integer NOT NULL,
      PRIMARY KEY (email, url)
    )
  `)
  db.run(
    `INSERT INTO control_account (email, url, access_token, refresh_token, token_expiry, active, time_created, time_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["dev@example.com", "https://console.example.com/", "access-1", "refresh-1", Date.now() + 60_000, 1, 1, 1],
  )
  const sql = await Bun.file(
    new URL("../../migration/20260411174401_account_service/migration.sql", import.meta.url),
  ).text()
  for (const stmt of sql
    .split("--> statement-breakpoint")
    .map((item) => item.trim())
    .filter(Boolean)) {
    db.run(stmt)
  }
  const row = db.query("SELECT id, email, url FROM account").get() as { id: string; email: string; url: string }
  const state = db.query("SELECT active_account_id FROM account_state WHERE id = 1").get() as {
    active_account_id: string
  } | null
  db.close()

  expect(row).toEqual({
    id: "https://console.example.com::dev@example.com",
    email: "dev@example.com",
    url: "https://console.example.com",
  })
  expect(state?.active_account_id).toBe("https://console.example.com::dev@example.com")
})

test("refreshes expired account tokens", async () => {
  await resetDatabase()
  void Account.list()

  Database.use((db) => {
    db.insert(AccountTable)
      .values({
        id: "acc-1",
        email: "dev@example.com",
        url: "https://console.example.com",
        access_token: "stale-access",
        refresh_token: "refresh-1",
        token_expiry: Date.now() - 1,
        time_created: 1,
        time_updated: 1,
      })
      .run()
    db.insert(AccountStateTable)
      .values({
        id: 1,
        active_account_id: "acc-1",
        active_org_id: null,
      })
      .run()
  })

  globalThis.fetch = mock((input: string | URL | Request) => {
    const url = input.toString()
    if (url.endsWith("/auth/device/token")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: "fresh-access",
            refresh_token: "fresh-refresh",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      )
    }
    return Promise.resolve(new Response("not found", { status: 404 }))
  }) as unknown as typeof fetch

  const token = await Account.token("acc-1")
  expect(token).toBe("fresh-access")

  const row = Database.use((db) => db.select().from(AccountTable).where(eq(AccountTable.id, "acc-1")).get())
  expect(row?.access_token).toBe("fresh-access")
  expect(row?.refresh_token).toBe("fresh-refresh")
})
