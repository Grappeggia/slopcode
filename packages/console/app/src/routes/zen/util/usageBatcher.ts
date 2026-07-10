import { Resource } from "@slopcode-ai/console-resource"
import { and, Database, eq, sql } from "@slopcode-ai/console-core/drizzle/index.js"
import { BillingTable } from "@slopcode-ai/console-core/schema/billing.sql.js"
import { UserTable } from "@slopcode-ai/console-core/schema/user.sql.js"
import { getRedis } from "./redis"

type Redis = {
  getdel<T>(key: string): Promise<T | null | undefined>
  incrby(key: string, amount: number): Promise<unknown>
}

// Workspaces whose balance/usage updates should be batched in Redis to avoid
// row-level lock contention on BillingTable / UserTable.
export const HOT_WORKSPACES = new Set<string>([
  "wrk_01KJ8PX5CH50Y4YNGNS9ZR8YDC", // invoice
])

// Probability that a given request flushes the accumulated totals to the DB.
// Lower = fewer DB writes, more staleness. ~1 in 100 -> ~1% of requests write.
const FLUSH_PROBABILITY = 1 / 100

export async function accumulateUsage(workspaceID: string, userID: string, workspaceCost: number, userCost: number) {
  const redis = getRedis()
  const wKey = `${Resource.App.stage}:usage:wrk:${workspaceID}`
  const uKey = `${Resource.App.stage}:usage:usr:${workspaceID}:${userID}`

  await Promise.all([redis.incrby(wKey, workspaceCost), redis.incrby(uKey, userCost)])

  if (Math.random() > FLUSH_PROBABILITY) return null

  // Atomically take the current totals and reset to 0
  const [workspaceTotal, userTotal] = await Promise.all([redis.getdel<number>(wKey), redis.getdel<number>(uKey)])

  const workspaceFlush = Number(workspaceTotal ?? 0)
  const userFlush = Number(userTotal ?? 0)
  if (workspaceFlush === 0 && userFlush === 0) return null

  return { workspaceCost: workspaceFlush, userCost: userFlush }
}

export async function drainUsage(
  workspaceID: string,
  userID: string,
  redis: Redis = getRedis(),
  stage = Resource.App.stage,
) {
  const wKey = `${stage}:usage:wrk:${workspaceID}`
  const uKey = `${stage}:usage:usr:${workspaceID}:${userID}`
  const [workspaceCost, userCost] = await Promise.all([redis.getdel<number>(wKey), redis.getdel<number>(uKey)]).then(
    (values) => values.map((value) => Number(value ?? 0)),
  )
  if (workspaceCost === 0 && userCost === 0) return

  await Database.transaction(async (tx) => {
    await tx
      .update(BillingTable)
      .set({
        balance: sql`${BillingTable.balance} - ${workspaceCost}`,
        monthlyUsage: sql`
          CASE
            WHEN MONTH(${BillingTable.timeMonthlyUsageUpdated}) = MONTH(now()) AND YEAR(${BillingTable.timeMonthlyUsageUpdated}) = YEAR(now()) THEN COALESCE(${BillingTable.monthlyUsage}, 0) + ${workspaceCost}
            ELSE ${workspaceCost}
          END
        `,
        timeMonthlyUsageUpdated: sql`now()`,
      })
      .where(eq(BillingTable.workspaceID, workspaceID))
    await tx
      .update(UserTable)
      .set({
        monthlyUsage: sql`
          CASE
            WHEN MONTH(${UserTable.timeMonthlyUsageUpdated}) = MONTH(now()) AND YEAR(${UserTable.timeMonthlyUsageUpdated}) = YEAR(now()) THEN COALESCE(${UserTable.monthlyUsage}, 0) + ${userCost}
            ELSE ${userCost}
          END
        `,
        timeMonthlyUsageUpdated: sql`now()`,
      })
      .where(and(eq(UserTable.workspaceID, workspaceID), eq(UserTable.id, userID)))
  }).catch(async (error) => {
    await Promise.all([redis.incrby(wKey, workspaceCost), redis.incrby(uKey, userCost)])
    throw error
  })
}
