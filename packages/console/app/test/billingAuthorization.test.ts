import { describe, expect, test } from "bun:test"
import { Actor } from "@slopcode-ai/console-core/actor.js"
import { and, eq } from "@slopcode-ai/console-core/drizzle/index.js"
import { BillingTable } from "@slopcode-ai/console-core/schema/billing.sql.js"
import { WorkspaceTable } from "@slopcode-ai/console-core/schema/workspace.sql.js"
import { reloadBilling, setBillingReload } from "../src/routes/workspace/[id]/billing/server"
import { testDatabase, useTestDatabase } from "../../core/test/database"
import { stripeWebhookTests } from "./stripeWebhook.cases"

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

stripeWebhookTests({ testDatabase, useTestDatabase })
