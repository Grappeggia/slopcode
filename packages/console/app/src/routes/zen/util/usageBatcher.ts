import { Resource } from "@slopcode-ai/console-resource"
import { and, Database, eq, sql } from "@slopcode-ai/console-core/drizzle/index.js"
import { BillingTable } from "@slopcode-ai/console-core/schema/billing.sql.js"
import { UserTable } from "@slopcode-ai/console-core/schema/user.sql.js"
import { getRedis } from "./redis"

type Redis = {
  eval<T>(script: string, keys: string[], args: unknown[]): Promise<T>
  incrby(key: string, amount: number): Promise<unknown>
}

export const CLAIM_USAGE = `
local workspace = redis.call("GETDEL", KEYS[1]) or "0"
local user = redis.call("GETDEL", KEYS[2]) or "0"
return {workspace, user}
`

export const RESTORE_USAGE = `
redis.call("INCRBY", KEYS[1], ARGV[1])
redis.call("INCRBY", KEYS[2], ARGV[2])
return 1
`

async function claim(redis: Redis, workspace: string, user: string) {
  return redis.eval<[number | string, number | string]>(CLAIM_USAGE, [workspace, user], []).then((values) => ({
    workspaceCost: Number(values[0] ?? 0),
    userCost: Number(values[1] ?? 0),
  }))
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
  const total = await claim(redis, wKey, uKey)
  if (total.workspaceCost === 0 && total.userCost === 0) return null
  return total
}

export async function drainUsage(
  workspaceID: string,
  userID: string,
  redis: Redis = getRedis(),
  stage = Resource.App.stage,
) {
  const wKey = `${stage}:usage:wrk:${workspaceID}`
  const uKey = `${stage}:usage:usr:${workspaceID}:${userID}`
  const { workspaceCost, userCost } = await claim(redis, wKey, uKey)
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
    await redis.eval(RESTORE_USAGE, [wKey, uKey], [workspaceCost, userCost])
    throw error
  })
}
