import { Resource } from "@slopcode-ai/console-resource"
import { and, Database, eq, sql } from "@slopcode-ai/console-core/drizzle/index.js"
import { BillingTable, LegacyUsageClaimTable } from "@slopcode-ai/console-core/schema/billing.sql.js"
import { UserTable } from "@slopcode-ai/console-core/schema/user.sql.js"
import { getRedis } from "./redis"

type Redis = {
  eval<T>(script: string, keys: string[], args: unknown[]): Promise<T>
}

export const INCREMENT_USAGE = `
local workspace = redis.call("GET", KEYS[1])
local user = redis.call("GET", KEYS[2])
if workspace and not tonumber(workspace) then
  return redis.error_reply("workspace usage is not numeric")
end
if user and not tonumber(user) then
  return redis.error_reply("user usage is not numeric")
end
workspace = tonumber(workspace or "0") + tonumber(ARGV[1])
user = tonumber(user or "0") + tonumber(ARGV[2])
redis.call("SET", KEYS[1], workspace)
redis.call("SET", KEYS[2], user)
return {workspace, user}
`

export const CLAIM_USAGE = `
local id = redis.call("LINDEX", KEYS[3], 0)
while id do
  local values = redis.call("HMGET", KEYS[4], id .. ":workspace", id .. ":user")
  if values[1] and values[2] then
    return {1, id, values[1], values[2]}
  end
  redis.call("LPOP", KEYS[3])
  id = redis.call("LINDEX", KEYS[3], 0)
end

local workspace = redis.call("GET", KEYS[1])
local user = redis.call("GET", KEYS[2])
if workspace and not tonumber(workspace) then
  return redis.error_reply("workspace usage is not numeric")
end
if user and not tonumber(user) then
  return redis.error_reply("user usage is not numeric")
end
workspace = tonumber(workspace or "0")
user = tonumber(user or "0")
local safe = math.max(workspace, user)
if safe == 0 then
  return {0, "", "0", "0"}
end

id = ARGV[1]
redis.call("SET", KEYS[1], 0)
redis.call("SET", KEYS[2], 0)
redis.call("HSET", KEYS[4], id .. ":workspace", safe, id .. ":user", safe)
redis.call("RPUSH", KEYS[3], id)
return {1, id, tostring(safe), tostring(safe)}
`

export const ACK_USAGE = `
local id = redis.call("LINDEX", KEYS[1], 0)
if not id then
  return 0
end
if id ~= ARGV[1] then
  return -1
end
redis.call("LPOP", KEYS[1])
redis.call("HDEL", KEYS[2], id .. ":workspace", id .. ":user")
if redis.call("LLEN", KEYS[1]) == 0 then
  redis.call("DEL", KEYS[1])
end
if redis.call("HLEN", KEYS[2]) == 0 then
  redis.call("DEL", KEYS[2])
end
return 1
`

function affected(result: unknown) {
  const value = Array.isArray(result) ? result[0] : result
  if (!value || typeof value !== "object") throw new Error("Database mutation result not found")
  if ("rowsAffected" in value && typeof value.rowsAffected === "number") return value.rowsAffected
  if ("affectedRows" in value && typeof value.affectedRows === "number") return value.affectedRows
  throw new Error("Database mutation count not found")
}

function keys(stage: string, workspaceID: string, userID: string) {
  const root = `${stage}:usage`
  return {
    workspace: `${root}:wrk:${workspaceID}`,
    user: `${root}:usr:${workspaceID}:${userID}`,
    queue: `${root}:claims:${workspaceID}:${userID}:queue`,
    claims: `${root}:claims:${workspaceID}:${userID}:data`,
  }
}

export async function incrementUsage(
  redis: Redis,
  workspace: string,
  user: string,
  workspaceCost: number,
  userCost: number,
) {
  const result = await redis.eval<[number | string, number | string]>(
    INCREMENT_USAGE,
    [workspace, user],
    [workspaceCost, userCost],
  )
  return { workspaceCost: Number(result[0]), userCost: Number(result[1]) }
}

async function claimUsage(redis: Redis, key: ReturnType<typeof keys>, id: string) {
  const result = await redis.eval<[number, string, number | string, number | string]>(
    CLAIM_USAGE,
    [key.workspace, key.user, key.queue, key.claims],
    [id],
  )
  if (Number(result[0]) !== 1) return
  return { id: String(result[1]), workspaceCost: Number(result[2]), userCost: Number(result[3]) }
}

// Workspaces whose balance/usage updates should be batched in Redis to avoid
// row-level lock contention on BillingTable / UserTable.
export const HOT_WORKSPACES = new Set<string>([
  "wrk_01KJ8PX5CH50Y4YNGNS9ZR8YDC", // invoice
])

const FLUSH_PROBABILITY = 1 / 100

export async function accumulateUsage(
  workspaceID: string,
  userID: string,
  workspaceCost: number,
  userCost: number,
  redis: Redis = getRedis(),
  stage = Resource.App.stage,
  random = Math.random,
) {
  const key = keys(stage, workspaceID, userID)
  await incrementUsage(redis, key.workspace, key.user, workspaceCost, userCost)
  if (random() > FLUSH_PROBABILITY) return null
  return drainUsage(workspaceID, userID, redis, stage)
}

export async function drainUsage(
  workspaceID: string,
  userID: string,
  redis: Redis = getRedis(),
  stage = Resource.App.stage,
  create: () => string = () => crypto.randomUUID(),
) {
  const key = keys(stage, workspaceID, userID)
  const total = { workspaceCost: 0, userCost: 0 }
  const flush = async (attempt: number): Promise<typeof total | undefined> => {
    if (attempt === 100) throw new Error("Legacy usage drain did not converge")
    const claim = await claimUsage(redis, key, create())
    if (!claim) return total.workspaceCost || total.userCost ? total : undefined

    await Database.transaction(async (tx) => {
      const fresh = affected(await tx.insert(LegacyUsageClaimTable).ignore().values({ id: claim.id })) > 0
      if (!fresh) return
      await tx
        .update(BillingTable)
        .set({
          balance: sql`${BillingTable.balance} - ${claim.workspaceCost}`,
          monthlyUsage: sql`
            CASE
              WHEN MONTH(${BillingTable.timeMonthlyUsageUpdated}) = MONTH(now()) AND YEAR(${BillingTable.timeMonthlyUsageUpdated}) = YEAR(now()) THEN COALESCE(${BillingTable.monthlyUsage}, 0) + ${claim.workspaceCost}
              ELSE ${claim.workspaceCost}
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
              WHEN MONTH(${UserTable.timeMonthlyUsageUpdated}) = MONTH(now()) AND YEAR(${UserTable.timeMonthlyUsageUpdated}) = YEAR(now()) THEN COALESCE(${UserTable.monthlyUsage}, 0) + ${claim.userCost}
              ELSE ${claim.userCost}
            END
          `,
          timeMonthlyUsageUpdated: sql`now()`,
        })
        .where(and(eq(UserTable.workspaceID, workspaceID), eq(UserTable.id, userID)))
    })

    const acknowledged = await redis.eval<number>(ACK_USAGE, [key.queue, key.claims], [claim.id])
    if (![-1, 0, 1].includes(Number(acknowledged)))
      throw new Error(`Legacy usage claim acknowledgement failed: ${claim.id}`)
    total.workspaceCost += claim.workspaceCost
    total.userCost += claim.userCost
    return flush(attempt + 1)
  }
  return flush(0)
}
