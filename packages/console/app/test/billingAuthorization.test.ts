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
  const redis = {
    getdel: async <T>(key: string) => {
      const value = values.get(key)
      values.delete(key)
      return value as T | undefined
    },
    incrby: async (key: string, amount: number) => values.set(key, (values.get(key) ?? 0) + amount),
  }

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
  const redis = {
    getdel: async <T>(key: string) => {
      const value = values.get(key)
      values.delete(key)
      return value as T | undefined
    },
    incrby: async (key: string, amount: number) => values.set(key, (values.get(key) ?? 0) + amount),
  }

  await expect(useTestDatabase(() => drainUsage(workspaceID, admin.userID, redis, "test"))).rejects.toThrow()
  expect(values.get(wKey)).toBe(30)
  expect(values.get(uKey)).toBe(40)
})

stripeWebhookTests({ testDatabase, useTestDatabase })
