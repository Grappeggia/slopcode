import { describe, expect, test } from "bun:test"
import { Actor } from "@slopcode-ai/console-core/actor.js"
import { and, eq, sql } from "@slopcode-ai/console-core/drizzle/index.js"
import { BillingTable } from "@slopcode-ai/console-core/schema/billing.sql.js"
import { UserTable } from "@slopcode-ai/console-core/schema/user.sql.js"
import { WorkspaceTable } from "@slopcode-ai/console-core/schema/workspace.sql.js"
import { reloadBilling, setBillingReload } from "../src/routes/workspace/[id]/billing/server"
import { testDatabase, useTestDatabase } from "../../core/test/database"
import { stripeWebhookTests } from "./stripeWebhook.cases"
import { drainUsage } from "../src/routes/zen/util/usageBatcher"

const workspaceID = "workspace_billing"
const admin = {
  userID: "user_admin",
  workspaceID,
  accountID: "account_admin",
  role: "admin" as const,
}
const member = {
  ...admin,
  userID: "user_member",
  accountID: "account_member",
  role: "member" as const,
}

const CLAIM_USAGE = `
local workspace = redis.call("GETDEL", KEYS[1]) or "0"
local user = redis.call("GETDEL", KEYS[2]) or "0"
return {workspace, user}
`

const RESTORE_USAGE = `
redis.call("INCRBY", KEYS[1], ARGV[1])
redis.call("INCRBY", KEYS[2], ARGV[2])
return 1
`

class Redis {
  scripts: string[] = []

  constructor(
    readonly values: Map<string, number>,
    readonly claimed?: (keys: string[]) => void,
  ) {}

  async eval<T>(script: string, keys: string[], args: unknown[]) {
    this.scripts.push(script)
    if (script === CLAIM_USAGE) {
      const values = keys.map((key) => this.values.get(key) ?? 0)
      keys.forEach((key) => this.values.delete(key))
      this.claimed?.(keys)
      return values as T
    }
    if (script !== RESTORE_USAGE) throw new Error("Unexpected Redis script")
    keys.forEach((key, index) => this.values.set(key, (this.values.get(key) ?? 0) + Number(args[index])))
    return 1 as T
  }

  async incrby(key: string, amount: number) {
    this.values.set(key, (this.values.get(key) ?? 0) + amount)
  }
}

async function seed() {
  await testDatabase()
    .insert(WorkspaceTable)
    .values([
      { id: workspaceID, name: "Billing" },
      { id: "workspace_other", name: "Other" },
    ])
  await testDatabase()
    .insert(BillingTable)
    .values([
      { id: "billing_actor", workspaceID, balance: 0, reload: false },
      { id: "billing_other", workspaceID: "workspace_other", balance: 0, reload: false },
    ])
}

describe("billing server operations", () => {
  test("rejects a member manual reload before invoking the charge", () => {
    let called = false

    expect(() =>
      Actor.provide("user", member, () =>
        reloadBilling(() => {
          called = true
        }),
      ),
    ).toThrow("Action not allowed")
    expect(called).toBe(false)
  })

  test("runs an admin manual reload in the actor workspace", () => {
    const workspace = Actor.provide("user", admin, () => reloadBilling((workspaceID) => workspaceID))
    expect(workspace).toBe(workspaceID)
  })

  test("rejects a member reload-settings update", async () => {
    await seed()

    await expect(
      useTestDatabase(() =>
        Actor.provide("user", member, () => setBillingReload({ reload: true, reloadAmount: 25, reloadTrigger: 10 })),
      ),
    ).rejects.toThrow("Action not allowed")

    const billing = await testDatabase()
      .select()
      .from(BillingTable)
      .where(eq(BillingTable.workspaceID, workspaceID))
      .then((rows) => rows[0])
    expect(billing.reload).toBe(false)
  })

  test("rejects an unauthenticated reload-settings update", async () => {
    await seed()

    await expect(
      useTestDatabase(() => setBillingReload({ reload: true, reloadAmount: 25, reloadTrigger: 10 })),
    ).rejects.toThrow()

    const billing = await testDatabase()
      .select()
      .from(BillingTable)
      .where(eq(BillingTable.workspaceID, workspaceID))
      .then((rows) => rows[0])
    expect(billing.reload).toBe(false)
  })

  test("updates only the admin actor workspace reload settings", async () => {
    await seed()

    await useTestDatabase(() =>
      Actor.provide("user", admin, () => setBillingReload({ reload: true, reloadAmount: 25, reloadTrigger: 10 })),
    )

    const rows = await testDatabase()
      .select()
      .from(BillingTable)
      .where(and(eq(BillingTable.workspaceID, workspaceID), eq(BillingTable.id, "billing_actor")))
    const other = await testDatabase()
      .select()
      .from(BillingTable)
      .where(eq(BillingTable.workspaceID, "workspace_other"))
      .then((rows) => rows[0])

    expect(rows[0].reload).toBe(true)
    expect(rows[0].reloadAmount).toBe(25)
    expect(rows[0].reloadTrigger).toBe(10)
    expect(other.reload).toBe(false)
  })
})

test("drains legacy hot-workspace usage before reservation admission", async () => {
  await seed()
  await testDatabase().insert(UserTable).values({ id: admin.userID, workspaceID, name: "Admin", role: "admin" })
  const values = new Map([
    [`test:usage:wrk:${workspaceID}`, 30],
    [`test:usage:usr:${workspaceID}:${admin.userID}`, 40],
  ])
  const redis = new Redis(values)

  await useTestDatabase(() => drainUsage(workspaceID, admin.userID, redis, "test"))

  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .where(eq(BillingTable.workspaceID, workspaceID))
    .then((rows) => rows[0])
  const user = await testDatabase()
    .select()
    .from(UserTable)
    .where(eq(UserTable.id, admin.userID))
    .then((rows) => rows[0])
  expect(billing.balance).toBe(-30)
  expect(billing.monthlyUsage).toBe(30)
  expect(user.monthlyUsage).toBe(40)
  expect(redis.scripts).toEqual([CLAIM_USAGE])
})

test("restores claimed legacy usage when its database flush fails", async () => {
  await seed()
  await testDatabase().insert(UserTable).values({ id: admin.userID, workspaceID, name: "Admin", role: "admin" })
  await testDatabase().execute(
    sql.raw(`
      CREATE TRIGGER fail_billing_update BEFORE UPDATE ON billing
      FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced billing update failure'
    `),
  )
  const wKey = `test:usage:wrk:${workspaceID}`
  const uKey = `test:usage:usr:${workspaceID}:${admin.userID}`
  const values = new Map([
    [wKey, 30],
    [uKey, 40],
  ])
  const redis = new Redis(values, (keys) => {
    values.set(keys[0], 5)
    values.set(keys[1], 7)
  })

  await expect(useTestDatabase(() => drainUsage(workspaceID, admin.userID, redis, "test"))).rejects.toThrow()
  expect(values.get(wKey)).toBe(35)
  expect(values.get(uKey)).toBe(47)
  expect(redis.scripts).toEqual([CLAIM_USAGE, RESTORE_USAGE])
})

stripeWebhookTests({ testDatabase, useTestDatabase })
