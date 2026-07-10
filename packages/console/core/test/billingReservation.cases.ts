import { afterEach, describe, expect, setSystemTime, test } from "bun:test"
import { eq, sql } from "../src/drizzle"
import {
  BillingTable,
  LiteTable,
  SubscriptionTable,
  UsageReservationTable,
  UsageTable,
} from "../src/schema/billing.sql"
import { UserTable } from "../src/schema/user.sql"
import { WorkspaceTable } from "../src/schema/workspace.sql"
import {
  failUsage,
  finalizeUsage,
  markUsageDispatched,
  recoverUsage,
  releaseUsage,
  reserveUsage,
} from "../src/usage-reservation"
import { getMonthlyBounds, getWeekBounds } from "../src/util/date"
import { testDatabase, useTestDatabase } from "./database"

const workspaceID = "workspace_reservation"
const userID = "user_reservation"

afterEach(() => {
  setSystemTime()
})

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
    expect(usages[0].reservationID).toBe("rsv_success")
  })

  test("charges the full actual cost when it exceeds the hold", async () => {
    await seed(100)
    await reserve("rsv_overage", 75)

    expect(await usage("rsv_overage", 125)).toBe(true)

    const billing = await testDatabase()
      .select()
      .from(BillingTable)
      .where(eq(BillingTable.workspaceID, workspaceID))
      .then((rows) => rows[0])
    const reservation = await testDatabase()
      .select()
      .from(UsageReservationTable)
      .where(eq(UsageReservationTable.id, "rsv_overage"))
      .then((rows) => rows[0])
    expect(billing.balance).toBe(-25)
    expect(billing.monthlyUsage).toBe(125)
    expect(reservation.amountActual).toBe(125)
  })

  test("settles dispatched requests with unknown usage at the full hold", async () => {
    await seed(100)
    await reserve("rsv_unknown", 75)
    await useTestDatabase(() =>
      markUsageDispatched({
        id: "rsv_unknown",
        usage: {
          model: "test-model",
          provider: "test-provider",
          inputTokens: 40,
          outputTokens: 20,
          keyID: "key_unknown",
          sessionID: "session_unknown",
        },
      }),
    )

    expect(await useTestDatabase(() => releaseUsage("rsv_unknown"))).toBe(false)
    expect(await useTestDatabase(() => failUsage("rsv_unknown"))).toBe(true)
    expect(await useTestDatabase(() => failUsage("rsv_unknown"))).toBe(false)

    const reservation = await testDatabase()
      .select()
      .from(UsageReservationTable)
      .where(eq(UsageReservationTable.id, "rsv_unknown"))
      .then((rows) => rows[0])
    const ledger = await testDatabase()
      .select()
      .from(UsageTable)
      .then((rows) => rows[0])
    expect(reservation.status).toBe("settled")
    expect(reservation.amountActual).toBe(75)
    expect(ledger.cost).toBe(75)
    expect(ledger.reservationID).toBe("rsv_unknown")
    expect(ledger.enrichment).toMatchObject({ estimated: true, unknown: true })
  })

  test("releases only failures proven to precede dispatch", async () => {
    await seed(100)
    await reserve("rsv_not_dispatched", 75)

    expect(await useTestDatabase(() => failUsage("rsv_not_dispatched"))).toBe(true)

    const billing = await testDatabase()
      .select()
      .from(BillingTable)
      .where(eq(BillingTable.workspaceID, workspaceID))
      .then((rows) => rows[0])
    const reservation = await testDatabase()
      .select()
      .from(UsageReservationTable)
      .where(eq(UsageReservationTable.id, "rsv_not_dispatched"))
      .then((rows) => rows[0])
    expect(billing.balance).toBe(100)
    expect(reservation.status).toBe("released")
  })

  test("keeps a rejected finalization pending so it can be retried", async () => {
    await seed(100)
    await reserve("rsv_retry", 75)
    await testDatabase().execute(
      sql.raw(`
        CREATE TRIGGER fail_usage_insert BEFORE INSERT ON \`usage\`
        FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced usage insert failure'
      `),
    )

    await expect(usage("rsv_retry", 30)).rejects.toThrow()
    const pending = await testDatabase()
      .select()
      .from(UsageReservationTable)
      .where(eq(UsageReservationTable.id, "rsv_retry"))
      .then((rows) => rows[0])
    expect(pending.status).toBe("pending")
    await testDatabase().execute(sql.raw("DROP TRIGGER fail_usage_insert"))

    expect(await usage("rsv_retry", 30)).toBe(true)
    expect(await testDatabase().select().from(UsageTable)).toHaveLength(1)
  })

  test("allows only one concurrent finalization or release", async () => {
    await seed(100)
    await reserve("rsv_race", 75)

    const results = await Promise.all([usage("rsv_race", 30), useTestDatabase(() => releaseUsage("rsv_race"))])

    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await testDatabase().select().from(UsageTable)).toHaveLength(results[0] ? 1 : 0)
  })

  test("recovers stale dispatched and undispatched holds conservatively", async () => {
    await seed(200)
    await reserve("rsv_stale_dispatched", 75)
    await reserve("rsv_stale_pending", 50)
    await useTestDatabase(() =>
      markUsageDispatched({
        id: "rsv_stale_dispatched",
        usage: {
          model: "test-model",
          provider: "test-provider",
          inputTokens: 40,
          outputTokens: 20,
        },
      }),
    )
    const stale = new Date("2026-01-01T00:00:00Z")
    await testDatabase().update(UsageReservationTable).set({ timeCreated: stale })
    await testDatabase()
      .update(UsageReservationTable)
      .set({ timeDispatched: stale })
      .where(eq(UsageReservationTable.id, "rsv_stale_dispatched"))

    const recovered = await useTestDatabase(() =>
      recoverUsage({ workspaceID, before: new Date("2026-01-02T00:00:00Z") }),
    )

    const rows = await testDatabase().select().from(UsageReservationTable)
    const billing = await testDatabase()
      .select()
      .from(BillingTable)
      .then((result) => result[0])
    expect(recovered).toEqual({ released: 1, settled: 1 })
    expect(rows.find((row) => row.id === "rsv_stale_dispatched")?.status).toBe("settled")
    expect(rows.find((row) => row.id === "rsv_stale_pending")?.status).toBe("released")
    expect(billing.balance).toBe(125)
    expect(await testDatabase().select().from(UsageTable)).toHaveLength(1)
  })

  test("reports the exact subscription quota dimension", async () => {
    await seed()
    await testDatabase().insert(SubscriptionTable).values({ id: "subscription_dimension", workspaceID, userID })

    const fixed = useTestDatabase(() =>
      reserveUsage({
        id: "rsv_fixed_dimension",
        workspaceID,
        userID,
        source: "subscription",
        amount: 75,
        limits: {
          fixed: { amount: 50, start: getWeekBounds(new Date()).start },
          rolling: { amount: 100, seconds: 18_000 },
        },
      }),
    )
    await expect(fixed).rejects.toMatchObject({ reason: "fixed" })

    const rolling = useTestDatabase(() =>
      reserveUsage({
        id: "rsv_rolling_dimension",
        workspaceID,
        userID,
        source: "subscription",
        amount: 75,
        limits: {
          fixed: { amount: 100, start: getWeekBounds(new Date()).start },
          rolling: { amount: 50, seconds: 18_000 },
        },
      }),
    )
    await expect(rolling).rejects.toMatchObject({ reason: "rolling" })
  })

  test("reports each exact Lite quota dimension", async () => {
    await seed()
    const anchor = new Date()
    await testDatabase().insert(LiteTable).values({ id: "lite_dimension", workspaceID, userID, timeCreated: anchor })
    const reserve = (id: string, limits: { weekly: number; monthly: number; rolling: number }) =>
      useTestDatabase(() =>
        reserveUsage({
          id,
          workspaceID,
          userID,
          source: "lite",
          amount: 75,
          limits: {
            weekly: { amount: limits.weekly, start: getWeekBounds(new Date()).start },
            monthly: { amount: limits.monthly, start: getMonthlyBounds(new Date(), anchor).start, anchor },
            rolling: { amount: limits.rolling, seconds: 18_000 },
          },
        }),
      )

    await expect(reserve("rsv_weekly_dimension", { weekly: 50, monthly: 100, rolling: 100 })).rejects.toMatchObject({
      reason: "weekly",
    })
    await expect(reserve("rsv_monthly_dimension", { weekly: 100, monthly: 50, rolling: 100 })).rejects.toMatchObject({
      reason: "monthly",
    })
    await expect(
      reserve("rsv_lite_rolling_dimension", { weekly: 100, monthly: 100, rolling: 50 }),
    ).rejects.toMatchObject({ reason: "rolling" })
  })

  test("reports exact balance, workspace, and user rejection reasons", async () => {
    await seed(50)

    await expect(reserve("rsv_balance_dimension", 75)).rejects.toMatchObject({ reason: "balance" })
    await expect(reserve("rsv_workspace_dimension", 40, { workspace: 30, user: 100 })).rejects.toMatchObject({
      reason: "workspace",
    })
    await expect(reserve("rsv_user_dimension", 40, { workspace: 100, user: 30 })).rejects.toMatchObject({
      reason: "user",
    })
  })

  test("keeps the original Lite monthly anchor across February", async () => {
    setSystemTime(new Date("2026-02-28T13:00:00Z"))
    await seed()
    const anchor = new Date("2026-01-31T12:00:00Z")
    await testDatabase().insert(LiteTable).values({ id: "lite_anchor", workspaceID, userID, timeCreated: anchor })
    await useTestDatabase(() =>
      reserveUsage({
        id: "rsv_lite_anchor",
        workspaceID,
        userID,
        source: "lite",
        amount: 75,
        limits: {
          weekly: { amount: 1_000, start: getWeekBounds(new Date()).start },
          monthly: { amount: 1_000, start: getMonthlyBounds(new Date(), anchor).start, anchor },
          rolling: { amount: 1_000, seconds: 18_000 },
        },
      }),
    )
    await testDatabase()
      .update(UsageReservationTable)
      .set({ limits: sql`JSON_REMOVE(${UsageReservationTable.limits}, '$.monthly.anchor')` })
      .where(eq(UsageReservationTable.id, "rsv_lite_anchor"))

    setSystemTime(new Date("2026-03-29T13:00:00Z"))
    await testDatabase()
      .update(LiteTable)
      .set({ monthlyUsage: 100, timeMonthlyUpdated: new Date("2026-03-29T13:00:00Z") })
      .where(eq(LiteTable.userID, userID))
    await usage("rsv_lite_anchor", 30)

    const lite = await testDatabase()
      .select()
      .from(LiteTable)
      .then((rows) => rows[0])
    expect(lite.monthlyUsage).toBe(55)
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
