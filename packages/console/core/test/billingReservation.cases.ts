import { describe, expect, test } from "bun:test"
import { eq, sql } from "../src/drizzle"
import { BillingTable, SubscriptionTable, UsageReservationTable, UsageTable } from "../src/schema/billing.sql"
import { UserTable } from "../src/schema/user.sql"
import { WorkspaceTable } from "../src/schema/workspace.sql"
import { finalizeUsage, releaseUsage, reserveUsage } from "../src/usage-reservation"
import { getWeekBounds } from "../src/util/date"
import { testDatabase, useTestDatabase } from "./database"

const workspaceID = "workspace_reservation"
const userID = "user_reservation"

async function seed(balance = 1_000) {
  await testDatabase().insert(WorkspaceTable).values({ id: workspaceID, name: "Reservation" })
  await testDatabase().insert(BillingTable).values({ id: "billing_reservation", workspaceID, balance, reload: false })
  await testDatabase().insert(UserTable).values({ id: userID, workspaceID, name: "Reservation", role: "admin" })
}

function reserve(id: string, amount: number, limits = { workspace: 10_000, user: 10_000 }) {
  return useTestDatabase(() =>
    reserveUsage({
      id,
      workspaceID,
      userID,
      source: "balance",
      amount,
      limits,
    }),
  )
}

function usage(id: string, amount: number) {
  return useTestDatabase(() =>
    finalizeUsage({
      id,
      amount,
      usage: {
        model: "test-model",
        provider: "test-provider",
        inputTokens: 10,
        outputTokens: 5,
        cost: amount,
      },
    }),
  )
}

describe("Zen usage reservations", () => {
  test("prevents concurrent requests from spending the same balance", async () => {
    await seed(100)

    const results = await Promise.allSettled([reserve("rsv_balance_a", 75), reserve("rsv_balance_b", 75)])
    const billing = await testDatabase()
      .select()
      .from(BillingTable)
      .where(eq(BillingTable.workspaceID, workspaceID))
      .then((rows) => rows[0])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    expect(billing.balance).toBe(25)
  })

  test("allows bounded normal concurrency when capacity covers each hold", async () => {
    await seed(100)

    const results = await Promise.allSettled([reserve("rsv_normal_a", 40), reserve("rsv_normal_b", 40)])
    const billing = await testDatabase()
      .select()
      .from(BillingTable)
      .where(eq(BillingTable.workspaceID, workspaceID))
      .then((rows) => rows[0])

    expect(results.every((result) => result.status === "fulfilled")).toBe(true)
    expect(billing.balance).toBe(20)
  })

  test("prevents concurrent requests from reusing workspace and user quota", async () => {
    await seed()

    const results = await Promise.allSettled([
      reserve("rsv_quota_a", 75, { workspace: 100, user: 100 }),
      reserve("rsv_quota_b", 75, { workspace: 100, user: 100 }),
    ])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
  })

  test("prevents concurrent requests from reusing subscription quota", async () => {
    await seed()
    await testDatabase().insert(SubscriptionTable).values({ id: "subscription_reservation", workspaceID, userID })
    const input = (id: string) =>
      useTestDatabase(() =>
        reserveUsage({
          id,
          workspaceID,
          userID,
          source: "subscription",
          amount: 75,
          limits: {
            fixed: { amount: 100, start: getWeekBounds(new Date()).start },
            rolling: { amount: 100, seconds: 18_000 },
          },
        }),
      )

    const results = await Promise.allSettled([input("rsv_subscription_a"), input("rsv_subscription_b")])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
  })

  test("releases a provider setup failure exactly once", async () => {
    await seed(100)
    await reserve("rsv_failure", 75)

    expect(await useTestDatabase(() => releaseUsage("rsv_failure"))).toBe(true)
    expect(await useTestDatabase(() => releaseUsage("rsv_failure"))).toBe(false)

    const billing = await testDatabase()
      .select()
      .from(BillingTable)
      .where(eq(BillingTable.workspaceID, workspaceID))
      .then((rows) => rows[0])
    const reservation = await testDatabase()
      .select()
      .from(UsageReservationTable)
      .where(eq(UsageReservationTable.id, "rsv_failure"))
      .then((rows) => rows[0])

    expect(billing.balance).toBe(100)
    expect(billing.monthlyUsage).toBe(0)
    expect(reservation.status).toBe("released")
    expect(reservation.amountActual).toBe(0)
  })

  test("reconciles successful usage and inserts its ledger row exactly once", async () => {
    await seed(100)
    await reserve("rsv_success", 75)

    expect(await usage("rsv_success", 30)).toBe(true)
    expect(await usage("rsv_success", 30)).toBe(false)

    const billing = await testDatabase()
      .select()
      .from(BillingTable)
      .where(eq(BillingTable.workspaceID, workspaceID))
      .then((rows) => rows[0])
    const user = await testDatabase()
      .select()
      .from(UserTable)
      .where(eq(UserTable.id, userID))
      .then((rows) => rows[0])
    const reservations = await testDatabase().select().from(UsageReservationTable)
    const usages = await testDatabase().select().from(UsageTable)

    expect(billing.balance).toBe(70)
    expect(billing.monthlyUsage).toBe(30)
    expect(user.monthlyUsage).toBe(30)
    expect(reservations).toHaveLength(1)
    expect(reservations[0].status).toBe("settled")
    expect(reservations[0].amountActual).toBe(30)
    expect(usages).toHaveLength(1)
    expect(usages[0].cost).toBe(30)
  })

  test("does not release an old-period hold from current monthly quota", async () => {
    await seed(1_000)
    await reserve("rsv_old_period", 75)
    const now = new Date()
    const previous = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    await testDatabase()
      .update(UsageReservationTable)
      .set({ limits: sql`JSON_SET(${UsageReservationTable.limits}, '$.calendar.start', ${previous})` })
      .where(eq(UsageReservationTable.id, "rsv_old_period"))
    await testDatabase()
      .update(BillingTable)
      .set({ monthlyUsage: 40, timeMonthlyUsageUpdated: now })
      .where(eq(BillingTable.workspaceID, workspaceID))
    await testDatabase()
      .update(UserTable)
      .set({ monthlyUsage: 40, timeMonthlyUsageUpdated: now })
      .where(eq(UserTable.id, userID))

    await useTestDatabase(() => releaseUsage("rsv_old_period"))

    const billing = await testDatabase()
      .select()
      .from(BillingTable)
      .where(eq(BillingTable.workspaceID, workspaceID))
      .then((rows) => rows[0])
    const user = await testDatabase()
      .select()
      .from(UserTable)
      .where(eq(UserTable.id, userID))
      .then((rows) => rows[0])
    expect(billing.balance).toBe(1_000)
    expect(billing.monthlyUsage).toBe(40)
    expect(user.monthlyUsage).toBe(40)
  })

  test("discards expired rolling usage when an old hold settles", async () => {
    await seed()
    await testDatabase().insert(SubscriptionTable).values({ id: "subscription_expired", workspaceID, userID })
    await useTestDatabase(() =>
      reserveUsage({
        id: "rsv_expired",
        workspaceID,
        userID,
        source: "subscription",
        amount: 75,
        limits: {
          fixed: { amount: 1_000, start: getWeekBounds(new Date()).start },
          rolling: { amount: 1_000, seconds: 1 },
        },
      }),
    )
    const expired = new Date(Date.now() - 10_000)
    await testDatabase()
      .update(SubscriptionTable)
      .set({ rollingUsage: 100, timeRollingUpdated: expired })
      .where(eq(SubscriptionTable.userID, userID))
    await testDatabase()
      .update(UsageReservationTable)
      .set({ limits: sql`JSON_SET(${UsageReservationTable.limits}, '$.rolling.start', ${expired.getTime()})` })
      .where(eq(UsageReservationTable.id, "rsv_expired"))

    await useTestDatabase(() => releaseUsage("rsv_expired"))

    const subscription = await testDatabase()
      .select()
      .from(SubscriptionTable)
      .where(eq(SubscriptionTable.userID, userID))
      .then((rows) => rows[0])
    expect(subscription.rollingUsage).toBe(0)
  })
})
