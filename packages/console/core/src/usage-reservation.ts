import { and, Database, eq, isNotNull, isNull, lte, or, sql } from "./drizzle"
import { Identifier } from "./identifier"
import {
  BillingTable,
  LiteTable,
  SubscriptionTable,
  UsageReservationLimits,
  UsageReservationSources,
  UsageReservationTable,
  UsageReservationUsage,
  UsageTable,
} from "./schema/billing.sql"
import { UserTable } from "./schema/user.sql"
import { getMonthlyBounds, getWeekBounds } from "./util/date"

export type UsageReservationSource = (typeof UsageReservationSources)[number]
export const USAGE_LEASE_SECONDS = 45
export type UsageReservationInput = {
  id: string
  workspaceID: string
  userID: string
  source: UsageReservationSource
  amount: number
  limits?: {
    workspace?: number
    user?: number
    fixed?: { amount: number; start: Date }
    rolling?: { amount: number; seconds: number }
    weekly?: { amount: number; start: Date }
    monthly?: { amount: number; start: Date; anchor: Date }
  }
}
export type UsageFinalization = {
  id: string
  amount: number
  usage: {
    model: string
    provider: string
    inputTokens: number
    outputTokens: number
    reasoningTokens?: number
    cacheReadTokens?: number
    cacheWrite5mTokens?: number
    cacheWrite1hTokens?: number
    cost: number
    keyID?: string
    sessionID?: string
    enrichment?: { plan?: "sub" | "byok" | "lite"; estimated?: boolean; unknown?: boolean }
  }
}
export type UsageSettlement = {
  status: "settled" | "released"
  amount: number
  usage?: UsageFinalization["usage"]
}

export class UsageReservationError extends Error {
  reason: "balance" | "workspace" | "user" | "fixed" | "rolling" | "weekly" | "monthly"
  retryAfter?: number

  constructor(reason: UsageReservationError["reason"], retryAfter?: number) {
    super(`Usage reservation rejected: ${reason}`)
    this.reason = reason
    this.retryAfter = retryAfter
  }
}

export class UsageReservationPendingError extends Error {
  constructor(id: string) {
    super(`Usage reservation is still pending: ${id}`)
  }
}

function retryAfter(time: Date | number) {
  return Math.max(1, Math.ceil((new Date(time).getTime() - Date.now()) / 1000))
}

function affected(result: unknown) {
  if (typeof result === "object" && result && "rowsAffected" in result && typeof result.rowsAffected === "number")
    return result.rowsAffected
  if (!Array.isArray(result)) throw new Error("Unknown database update result")
  const value: unknown = result[0]
  if (typeof value === "object" && value && "affectedRows" in value && typeof value.affectedRows === "number")
    return value.affectedRows
  throw new Error("Unknown database update result")
}

export async function reserveUsage(input: UsageReservationInput) {
  if (!Number.isSafeInteger(input.amount) || input.amount < 0) throw new Error("Invalid usage reservation amount")

  const calendar = new Date()
  calendar.setUTCDate(1)
  calendar.setUTCHours(0, 0, 0, 0)
  const limits: UsageReservationLimits = {
    calendar: input.source === "balance" ? { start: calendar.getTime() } : undefined,
    workspace: input.limits?.workspace,
    user: input.limits?.user,
    fixed: input.limits?.fixed
      ? { amount: input.limits.fixed.amount, start: input.limits.fixed.start.getTime() }
      : undefined,
    rolling: input.limits?.rolling,
    weekly: input.limits?.weekly
      ? { amount: input.limits.weekly.amount, start: input.limits.weekly.start.getTime() }
      : undefined,
    monthly: input.limits?.monthly
      ? {
          amount: input.limits.monthly.amount,
          start: input.limits.monthly.start.getTime(),
          anchor: input.limits.monthly.anchor.getTime(),
        }
      : undefined,
  } satisfies UsageReservationLimits

  return Database.transaction(async (tx) => {
    await tx.insert(UsageReservationTable).values({
      id: input.id,
      workspaceID: input.workspaceID,
      userID: input.userID,
      source: input.source,
      amount: input.amount,
      limits,
    })

    if (input.source === "free" || input.source === "byok") return

    if (input.source === "balance") {
      const billing = await tx
        .update(BillingTable)
        .set({
          balance: sql`${BillingTable.balance} - ${input.amount}`,
          monthlyUsage: sql`
            CASE
              WHEN ${BillingTable.timeMonthlyUsageUpdated} >= ${calendar} THEN COALESCE(${BillingTable.monthlyUsage}, 0) + ${input.amount}
              ELSE ${input.amount}
            END
          `,
          timeMonthlyUsageUpdated: sql`now()`,
        })
        .where(
          and(
            eq(BillingTable.workspaceID, input.workspaceID),
            sql`${BillingTable.balance} >= ${input.amount}`,
            limits.workspace === undefined
              ? undefined
              : sql`
                  CASE
                    WHEN ${BillingTable.timeMonthlyUsageUpdated} >= ${calendar} THEN COALESCE(${BillingTable.monthlyUsage}, 0)
                    ELSE 0
                  END + ${input.amount} <= ${limits.workspace}
                `,
          ),
        )
      if (affected(billing) === 0) {
        const row = await tx
          .select({ balance: BillingTable.balance })
          .from(BillingTable)
          .where(eq(BillingTable.workspaceID, input.workspaceID))
          .then((rows) => rows[0])
        if (!row || row.balance < input.amount) throw new UsageReservationError("balance")
        throw new UsageReservationError("workspace")
      }

      const user = await tx
        .update(UserTable)
        .set({
          monthlyUsage: sql`
            CASE
              WHEN ${UserTable.timeMonthlyUsageUpdated} >= ${calendar} THEN COALESCE(${UserTable.monthlyUsage}, 0) + ${input.amount}
              ELSE ${input.amount}
            END
          `,
          timeMonthlyUsageUpdated: sql`now()`,
        })
        .where(
          and(
            eq(UserTable.workspaceID, input.workspaceID),
            eq(UserTable.id, input.userID),
            limits.user === undefined
              ? undefined
              : sql`
                  CASE
                    WHEN ${UserTable.timeMonthlyUsageUpdated} >= ${calendar} THEN COALESCE(${UserTable.monthlyUsage}, 0)
                    ELSE 0
                  END + ${input.amount} <= ${limits.user}
                `,
          ),
        )
      if (affected(user) === 0) throw new UsageReservationError("user")
      return
    }

    if (input.source === "subscription") {
      if (!limits.fixed || !limits.rolling) throw new Error("Missing subscription reservation limits")
      const fixed = new Date(limits.fixed.start)
      const subscription = await tx
        .update(SubscriptionTable)
        .set({
          fixedUsage: sql`
            CASE
              WHEN ${SubscriptionTable.timeFixedUpdated} >= ${fixed} THEN COALESCE(${SubscriptionTable.fixedUsage}, 0) + ${input.amount}
              ELSE ${input.amount}
            END
          `,
          timeFixedUpdated: sql`now()`,
          rollingUsage: sql`
            CASE
              WHEN UNIX_TIMESTAMP(${SubscriptionTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${limits.rolling.seconds} THEN COALESCE(${SubscriptionTable.rollingUsage}, 0) + ${input.amount}
              ELSE ${input.amount}
            END
          `,
          timeRollingUpdated: sql`
            CASE
              WHEN UNIX_TIMESTAMP(${SubscriptionTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${limits.rolling.seconds} THEN ${SubscriptionTable.timeRollingUpdated}
              ELSE now()
            END
          `,
        })
        .where(
          and(
            eq(SubscriptionTable.workspaceID, input.workspaceID),
            eq(SubscriptionTable.userID, input.userID),
            isNull(SubscriptionTable.timeDeleted),
            sql`
              CASE
                WHEN ${SubscriptionTable.timeFixedUpdated} >= ${fixed} THEN COALESCE(${SubscriptionTable.fixedUsage}, 0)
                ELSE 0
              END + ${input.amount} <= ${limits.fixed.amount}
            `,
            sql`
              CASE
                WHEN UNIX_TIMESTAMP(${SubscriptionTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${limits.rolling.seconds} THEN COALESCE(${SubscriptionTable.rollingUsage}, 0)
                ELSE 0
              END + ${input.amount} <= ${limits.rolling.amount}
            `,
          ),
        )
      if (affected(subscription) === 0) {
        const row = await tx
          .select({
            fixed: SubscriptionTable.fixedUsage,
            rolling: SubscriptionTable.rollingUsage,
            timeFixed: SubscriptionTable.timeFixedUpdated,
            timeRolling: SubscriptionTable.timeRollingUpdated,
          })
          .from(SubscriptionTable)
          .where(
            and(
              eq(SubscriptionTable.workspaceID, input.workspaceID),
              eq(SubscriptionTable.userID, input.userID),
              isNull(SubscriptionTable.timeDeleted),
            ),
          )
          .then((rows) => rows[0])
        if (!row) throw new Error("Subscription reservation target not found")
        if ((row.timeFixed && row.timeFixed >= fixed ? (row.fixed ?? 0) : 0) + input.amount > limits.fixed.amount)
          throw new UsageReservationError("fixed", retryAfter(fixed.getTime() + 7 * 24 * 60 * 60 * 1000))
        if (
          (row.timeRolling && row.timeRolling.getTime() >= Date.now() - limits.rolling.seconds * 1000
            ? (row.rolling ?? 0)
            : 0) +
            input.amount >
          limits.rolling.amount
        )
          throw new UsageReservationError(
            "rolling",
            retryAfter((row.timeRolling?.getTime() ?? Date.now()) + limits.rolling.seconds * 1000),
          )
        throw new Error("Subscription reservation update failed")
      }
      const anchor = await tx
        .select({ time: SubscriptionTable.timeRollingUpdated })
        .from(SubscriptionTable)
        .where(
          and(
            eq(SubscriptionTable.workspaceID, input.workspaceID),
            eq(SubscriptionTable.userID, input.userID),
            isNull(SubscriptionTable.timeDeleted),
          ),
        )
        .then((rows) => rows[0]?.time)
      if (!anchor) throw new Error("Subscription rolling window was not initialized")
      limits.rolling = { ...limits.rolling, start: anchor.getTime() }
      await tx.update(UsageReservationTable).set({ limits }).where(eq(UsageReservationTable.id, input.id))
      return
    }

    if (!limits.weekly || !limits.monthly || !limits.rolling) throw new Error("Missing Lite reservation limits")
    const weekly = new Date(limits.weekly.start)
    const monthly = new Date(limits.monthly.start)
    const lite = await tx
      .update(LiteTable)
      .set({
        monthlyUsage: sql`
          CASE
            WHEN ${LiteTable.timeMonthlyUpdated} >= ${monthly} THEN COALESCE(${LiteTable.monthlyUsage}, 0) + ${input.amount}
            ELSE ${input.amount}
          END
        `,
        timeMonthlyUpdated: sql`now()`,
        weeklyUsage: sql`
          CASE
            WHEN ${LiteTable.timeWeeklyUpdated} >= ${weekly} THEN COALESCE(${LiteTable.weeklyUsage}, 0) + ${input.amount}
            ELSE ${input.amount}
          END
        `,
        timeWeeklyUpdated: sql`now()`,
        rollingUsage: sql`
          CASE
            WHEN UNIX_TIMESTAMP(${LiteTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${limits.rolling.seconds} THEN COALESCE(${LiteTable.rollingUsage}, 0) + ${input.amount}
            ELSE ${input.amount}
          END
        `,
        timeRollingUpdated: sql`
          CASE
            WHEN UNIX_TIMESTAMP(${LiteTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${limits.rolling.seconds} THEN ${LiteTable.timeRollingUpdated}
            ELSE now()
          END
        `,
      })
      .where(
        and(
          eq(LiteTable.workspaceID, input.workspaceID),
          eq(LiteTable.userID, input.userID),
          isNull(LiteTable.timeDeleted),
          sql`
            CASE
              WHEN ${LiteTable.timeMonthlyUpdated} >= ${monthly} THEN COALESCE(${LiteTable.monthlyUsage}, 0)
              ELSE 0
            END + ${input.amount} <= ${limits.monthly.amount}
          `,
          sql`
            CASE
              WHEN ${LiteTable.timeWeeklyUpdated} >= ${weekly} THEN COALESCE(${LiteTable.weeklyUsage}, 0)
              ELSE 0
            END + ${input.amount} <= ${limits.weekly.amount}
          `,
          sql`
            CASE
              WHEN UNIX_TIMESTAMP(${LiteTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${limits.rolling.seconds} THEN COALESCE(${LiteTable.rollingUsage}, 0)
              ELSE 0
            END + ${input.amount} <= ${limits.rolling.amount}
          `,
        ),
      )
    if (affected(lite) === 0) {
      const row = await tx
        .select({
          weekly: LiteTable.weeklyUsage,
          monthly: LiteTable.monthlyUsage,
          rolling: LiteTable.rollingUsage,
          timeWeekly: LiteTable.timeWeeklyUpdated,
          timeMonthly: LiteTable.timeMonthlyUpdated,
          timeRolling: LiteTable.timeRollingUpdated,
        })
        .from(LiteTable)
        .where(
          and(
            eq(LiteTable.workspaceID, input.workspaceID),
            eq(LiteTable.userID, input.userID),
            isNull(LiteTable.timeDeleted),
          ),
        )
        .then((rows) => rows[0])
      if (!row) throw new Error("Lite reservation target not found")
      if ((row.timeWeekly && row.timeWeekly >= weekly ? (row.weekly ?? 0) : 0) + input.amount > limits.weekly.amount)
        throw new UsageReservationError("weekly", retryAfter(weekly.getTime() + 7 * 24 * 60 * 60 * 1000))
      if (
        (row.timeMonthly && row.timeMonthly >= monthly ? (row.monthly ?? 0) : 0) + input.amount >
        limits.monthly.amount
      )
        throw new UsageReservationError(
          "monthly",
          retryAfter(getMonthlyBounds(new Date(), new Date(limits.monthly.anchor)).end),
        )
      if (
        (row.timeRolling && row.timeRolling.getTime() >= Date.now() - limits.rolling.seconds * 1000
          ? (row.rolling ?? 0)
          : 0) +
          input.amount >
        limits.rolling.amount
      )
        throw new UsageReservationError(
          "rolling",
          retryAfter((row.timeRolling?.getTime() ?? Date.now()) + limits.rolling.seconds * 1000),
        )
      throw new Error("Lite reservation update failed")
    }
    const anchor = await tx
      .select({ time: LiteTable.timeRollingUpdated })
      .from(LiteTable)
      .where(
        and(
          eq(LiteTable.workspaceID, input.workspaceID),
          eq(LiteTable.userID, input.userID),
          isNull(LiteTable.timeDeleted),
        ),
      )
      .then((rows) => rows[0]?.time)
    if (!anchor) throw new Error("Lite rolling window was not initialized")
    limits.rolling = { ...limits.rolling, start: anchor.getTime() }
    await tx.update(UsageReservationTable).set({ limits }).where(eq(UsageReservationTable.id, input.id))
  })
}

function lease(seconds: number) {
  if (!Number.isSafeInteger(seconds) || seconds <= 0) throw new Error("Invalid usage reservation lease")
  return new Date(Date.now() + seconds * 1000)
}

export function markUsageDispatched(input: { id: string; usage: UsageReservationUsage; leaseSeconds?: number }) {
  return Database.use(
    async (tx) =>
      affected(
        await tx
          .update(UsageReservationTable)
          .set({
            usage: input.usage,
            timeDispatched: sql`COALESCE(${UsageReservationTable.timeDispatched}, now())`,
            timeLeaseExpires: lease(input.leaseSeconds ?? USAGE_LEASE_SECONDS),
          })
          .where(and(eq(UsageReservationTable.id, input.id), eq(UsageReservationTable.status, "pending"))),
      ) > 0,
  )
}

export function heartbeatUsage(id: string, seconds = USAGE_LEASE_SECONDS) {
  return Database.use(
    async (tx) =>
      affected(
        await tx
          .update(UsageReservationTable)
          .set({ timeLeaseExpires: lease(seconds) })
          .where(
            and(
              eq(UsageReservationTable.id, id),
              eq(UsageReservationTable.status, "pending"),
              isNotNull(UsageReservationTable.timeDispatched),
            ),
          ),
      ) > 0,
  )
}

export async function failUsage(id: string) {
  if (!(await releaseUsage(id))) await settleUnknownUsage(id)
  return getUsageSettlement(id)
}

async function settleUnknownUsage(id: string, claim?: { lease: { now: Date; legacyBefore: Date } }) {
  const reservation = await Database.use((tx) =>
    tx
      .select()
      .from(UsageReservationTable)
      .where(and(eq(UsageReservationTable.id, id), eq(UsageReservationTable.status, "pending")))
      .then((rows) => rows[0]),
  )
  if (!reservation?.timeDispatched) return false
  const usage = reservation.usage ?? {
    model: "unknown",
    provider: "unknown",
    inputTokens: 0,
    outputTokens: 0,
  }
  return settleUsage(
    id,
    reservation.amount,
    "settled",
    {
      ...usage,
      cost: reservation.amount,
      enrichment: {
        ...usage.enrichment,
        estimated: true,
        unknown: true,
      },
    },
    claim,
  )
}

export async function recoverUsage(input: { workspaceID: string; before: Date; now?: Date; limit?: number }) {
  const now = input.now ?? new Date()
  const rows = await Database.use((tx) =>
    tx
      .select({
        id: UsageReservationTable.id,
        timeCreated: UsageReservationTable.timeCreated,
        timeDispatched: UsageReservationTable.timeDispatched,
      })
      .from(UsageReservationTable)
      .where(
        and(
          eq(UsageReservationTable.workspaceID, input.workspaceID),
          eq(UsageReservationTable.status, "pending"),
          or(
            and(isNull(UsageReservationTable.timeDispatched), lte(UsageReservationTable.timeCreated, input.before)),
            and(
              isNotNull(UsageReservationTable.timeDispatched),
              or(
                lte(UsageReservationTable.timeLeaseExpires, now),
                and(
                  isNull(UsageReservationTable.timeLeaseExpires),
                  lte(UsageReservationTable.timeDispatched, input.before),
                ),
              ),
            ),
          ),
        ),
      )
      .orderBy(UsageReservationTable.timeCreated)
      .limit(input.limit ?? 100),
  )
  const results = await Promise.all(
    rows.map((row) =>
      row.timeDispatched
        ? settleUnknownUsage(row.id, { lease: { now, legacyBefore: input.before } })
        : settleUsage(row.id, 0, "released", undefined, {
            undispatched: true,
            createdBefore: input.before,
          }),
    ),
  )
  return {
    released: rows.filter((row, index) => !row.timeDispatched && results[index]).length,
    settled: rows.filter((row, index) => row.timeDispatched && results[index]).length,
  }
}

export function releaseUsage(id: string) {
  return settleUsage(id, 0, "released", undefined, { undispatched: true })
}

export async function getUsageSettlement(id: string): Promise<UsageSettlement> {
  return Database.use(async (tx) => {
    const reservation = await tx
      .select({ status: UsageReservationTable.status, amount: UsageReservationTable.amountActual })
      .from(UsageReservationTable)
      .where(eq(UsageReservationTable.id, id))
      .then((rows) => rows[0])
    if (!reservation) throw new Error("Usage reservation not found")
    if (reservation.status === "pending") throw new UsageReservationPendingError(id)
    if (reservation.amount === null) throw new Error("Terminal usage reservation amount not found")
    const usage = await tx
      .select({
        model: UsageTable.model,
        provider: UsageTable.provider,
        inputTokens: UsageTable.inputTokens,
        outputTokens: UsageTable.outputTokens,
        reasoningTokens: UsageTable.reasoningTokens,
        cacheReadTokens: UsageTable.cacheReadTokens,
        cacheWrite5mTokens: UsageTable.cacheWrite5mTokens,
        cacheWrite1hTokens: UsageTable.cacheWrite1hTokens,
        cost: UsageTable.cost,
        keyID: UsageTable.keyID,
        sessionID: UsageTable.sessionID,
        enrichment: UsageTable.enrichment,
      })
      .from(UsageTable)
      .where(eq(UsageTable.reservationID, id))
      .then((rows) => rows[0])
    return {
      status: reservation.status,
      amount: reservation.amount,
      usage: usage
        ? {
            ...usage,
            reasoningTokens: usage.reasoningTokens ?? undefined,
            cacheReadTokens: usage.cacheReadTokens ?? undefined,
            cacheWrite5mTokens: usage.cacheWrite5mTokens ?? undefined,
            cacheWrite1hTokens: usage.cacheWrite1hTokens ?? undefined,
            keyID: usage.keyID ?? undefined,
            sessionID: usage.sessionID ?? undefined,
            enrichment: usage.enrichment ?? undefined,
          }
        : undefined,
    }
  })
}

export async function finalizeUsage(input: UsageFinalization) {
  await settleUsage(input.id, input.amount, "settled", input.usage)
  return getUsageSettlement(input.id)
}

async function settleUsage(
  id: string,
  amount: number,
  status: "settled" | "released",
  usage?: UsageFinalization["usage"],
  claim?: {
    undispatched?: boolean
    createdBefore?: Date
    lease?: { now: Date; legacyBefore: Date }
  },
) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Invalid finalized usage amount")

  return Database.transaction(async (tx) => {
    const claimed = await tx
      .update(UsageReservationTable)
      .set({ status, amountActual: amount, timeLeaseExpires: null })
      .where(
        and(
          eq(UsageReservationTable.id, id),
          eq(UsageReservationTable.status, "pending"),
          claim?.undispatched ? isNull(UsageReservationTable.timeDispatched) : undefined,
          claim?.createdBefore ? lte(UsageReservationTable.timeCreated, claim.createdBefore) : undefined,
          claim?.lease
            ? and(
                isNotNull(UsageReservationTable.timeDispatched),
                or(
                  lte(UsageReservationTable.timeLeaseExpires, claim.lease.now),
                  and(
                    isNull(UsageReservationTable.timeLeaseExpires),
                    lte(UsageReservationTable.timeDispatched, claim.lease.legacyBefore),
                  ),
                ),
              )
            : undefined,
        ),
      )
    if (affected(claimed) === 0) return false

    const reservation = await tx
      .select()
      .from(UsageReservationTable)
      .where(eq(UsageReservationTable.id, id))
      .then((rows) => rows[0])
    if (!reservation) throw new Error("Usage reservation not found")
    const delta = amount - reservation.amount

    if (reservation.source === "balance") {
      const month = new Date()
      month.setUTCDate(1)
      month.setUTCHours(0, 0, 0, 0)
      const current = reservation.limits?.calendar?.start === month.getTime()
      await tx
        .update(BillingTable)
        .set({
          balance: sql`${BillingTable.balance} - ${delta}`,
          monthlyUsage: current
            ? sql`GREATEST(0, COALESCE(${BillingTable.monthlyUsage}, 0) + ${delta})`
            : sql`
                CASE
                  WHEN ${BillingTable.timeMonthlyUsageUpdated} >= ${month} THEN COALESCE(${BillingTable.monthlyUsage}, 0) + ${amount}
                  ELSE ${amount}
                END
              `,
          timeMonthlyUsageUpdated: sql`now()`,
        })
        .where(eq(BillingTable.workspaceID, reservation.workspaceID))
      await tx
        .update(UserTable)
        .set({
          monthlyUsage: current
            ? sql`GREATEST(0, COALESCE(${UserTable.monthlyUsage}, 0) + ${delta})`
            : sql`
                CASE
                  WHEN ${UserTable.timeMonthlyUsageUpdated} >= ${month} THEN COALESCE(${UserTable.monthlyUsage}, 0) + ${amount}
                  ELSE ${amount}
                END
              `,
          timeMonthlyUsageUpdated: sql`now()`,
        })
        .where(and(eq(UserTable.workspaceID, reservation.workspaceID), eq(UserTable.id, reservation.userID)))
    }

    if (reservation.source === "free" || reservation.source === "byok") {
      const month = new Date()
      month.setUTCDate(1)
      month.setUTCHours(0, 0, 0, 0)
      await tx
        .update(BillingTable)
        .set({
          monthlyUsage: sql`
            CASE
              WHEN ${BillingTable.timeMonthlyUsageUpdated} >= ${month} THEN COALESCE(${BillingTable.monthlyUsage}, 0) + ${amount}
              ELSE ${amount}
            END
          `,
          timeMonthlyUsageUpdated: sql`now()`,
        })
        .where(eq(BillingTable.workspaceID, reservation.workspaceID))
      await tx
        .update(UserTable)
        .set({
          monthlyUsage: sql`
            CASE
              WHEN ${UserTable.timeMonthlyUsageUpdated} >= ${month} THEN COALESCE(${UserTable.monthlyUsage}, 0) + ${amount}
              ELSE ${amount}
            END
          `,
          timeMonthlyUsageUpdated: sql`now()`,
        })
        .where(and(eq(UserTable.workspaceID, reservation.workspaceID), eq(UserTable.id, reservation.userID)))
    }

    if (reservation.source === "subscription") {
      const week = getWeekBounds(new Date())
      const current = reservation.limits?.fixed?.start === week.start.getTime()
      const seconds = reservation.limits?.rolling?.seconds ?? 0
      const rolling = reservation.limits?.rolling?.start
      await tx
        .update(SubscriptionTable)
        .set({
          fixedUsage: current
            ? sql`GREATEST(0, COALESCE(${SubscriptionTable.fixedUsage}, 0) + ${delta})`
            : sql`
                CASE
                  WHEN ${SubscriptionTable.timeFixedUpdated} >= ${week.start} THEN COALESCE(${SubscriptionTable.fixedUsage}, 0) + ${amount}
                  ELSE ${amount}
                END
              `,
          timeFixedUpdated: sql`now()`,
          rollingUsage: sql`
            CASE
              WHEN ${rolling === undefined ? sql`false` : sql`${SubscriptionTable.timeRollingUpdated} = ${new Date(rolling)}`}
                AND UNIX_TIMESTAMP(${SubscriptionTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${seconds}
                THEN GREATEST(0, COALESCE(${SubscriptionTable.rollingUsage}, 0) + ${delta})
              WHEN UNIX_TIMESTAMP(${SubscriptionTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${seconds}
                THEN COALESCE(${SubscriptionTable.rollingUsage}, 0) + ${amount}
              ELSE ${amount}
            END
          `,
          timeRollingUpdated: sql`
            CASE
              WHEN UNIX_TIMESTAMP(${SubscriptionTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${seconds} THEN ${SubscriptionTable.timeRollingUpdated}
              ELSE now()
            END
          `,
        })
        .where(
          and(
            eq(SubscriptionTable.workspaceID, reservation.workspaceID),
            eq(SubscriptionTable.userID, reservation.userID),
          ),
        )
    }

    if (reservation.source === "lite") {
      const week = getWeekBounds(new Date())
      const monthly =
        reservation.limits?.monthly?.anchor ??
        (await tx
          .select({ time: LiteTable.timeCreated })
          .from(LiteTable)
          .where(and(eq(LiteTable.workspaceID, reservation.workspaceID), eq(LiteTable.userID, reservation.userID)))
          .then((rows) => rows[0]?.time.getTime()))
      if (!monthly) throw new Error("Lite monthly anchor was not found")
      const month = getMonthlyBounds(new Date(), new Date(monthly))
      const currentWeek = reservation.limits?.weekly?.start === week.start.getTime()
      const currentMonth = reservation.limits?.monthly?.start === month.start.getTime()
      const seconds = reservation.limits?.rolling?.seconds ?? 0
      const rolling = reservation.limits?.rolling?.start
      await tx
        .update(LiteTable)
        .set({
          monthlyUsage: currentMonth
            ? sql`GREATEST(0, COALESCE(${LiteTable.monthlyUsage}, 0) + ${delta})`
            : sql`
                CASE
                  WHEN ${LiteTable.timeMonthlyUpdated} >= ${month.start} THEN COALESCE(${LiteTable.monthlyUsage}, 0) + ${amount}
                  ELSE ${amount}
                END
              `,
          timeMonthlyUpdated: sql`now()`,
          weeklyUsage: currentWeek
            ? sql`GREATEST(0, COALESCE(${LiteTable.weeklyUsage}, 0) + ${delta})`
            : sql`
                CASE
                  WHEN ${LiteTable.timeWeeklyUpdated} >= ${week.start} THEN COALESCE(${LiteTable.weeklyUsage}, 0) + ${amount}
                  ELSE ${amount}
                END
              `,
          timeWeeklyUpdated: sql`now()`,
          rollingUsage: sql`
            CASE
              WHEN ${rolling === undefined ? sql`false` : sql`${LiteTable.timeRollingUpdated} = ${new Date(rolling)}`}
                AND UNIX_TIMESTAMP(${LiteTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${seconds}
                THEN GREATEST(0, COALESCE(${LiteTable.rollingUsage}, 0) + ${delta})
              WHEN UNIX_TIMESTAMP(${LiteTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${seconds}
                THEN COALESCE(${LiteTable.rollingUsage}, 0) + ${amount}
              ELSE ${amount}
            END
          `,
          timeRollingUpdated: sql`
            CASE
              WHEN UNIX_TIMESTAMP(${LiteTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${seconds} THEN ${LiteTable.timeRollingUpdated}
              ELSE now()
            END
          `,
        })
        .where(and(eq(LiteTable.workspaceID, reservation.workspaceID), eq(LiteTable.userID, reservation.userID)))
    }

    if (usage) {
      await tx.insert(UsageTable).values({
        workspaceID: reservation.workspaceID,
        id: Identifier.create("usage"),
        model: usage.model,
        provider: usage.provider,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        reasoningTokens: usage.reasoningTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWrite5mTokens: usage.cacheWrite5mTokens,
        cacheWrite1hTokens: usage.cacheWrite1hTokens,
        cost: usage.cost,
        reservationID: reservation.id,
        keyID: usage.keyID,
        sessionID: usage.sessionID?.substring(0, 30),
        enrichment: usage.enrichment,
      })
    }

    return true
  })
}
