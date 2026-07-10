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
local id = redis.call("LINDEX", KEYS[2], 0)
while id do
  local value = redis.call("HGET", KEYS[3], id)
  if value then
    return {1, id, value}
  end
  redis.call("LPOP", KEYS[2])
  id = redis.call("LINDEX", KEYS[2], 0)
end

local value = redis.call("GET", KEYS[1])
if value and not tonumber(value) then
  return redis.error_reply("usage is not numeric")
end
value = tonumber(value or "0")
if value == 0 then
  return {0, "", "0"}
end

id = ARGV[1]
redis.call("SET", KEYS[1], 0)
redis.call("HSET", KEYS[3], id, value)
redis.call("RPUSH", KEYS[2], id)
return {1, id, tostring(value)}
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
redis.call("HDEL", KEYS[2], id)
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
    workspace: {
      counter: `${root}:wrk:${workspaceID}`,
      queue: `${root}:claims:wrk:${workspaceID}:queue`,
      claims: `${root}:claims:wrk:${workspaceID}:data`,
    },
    user: {
      counter: `${root}:usr:${workspaceID}:${userID}`,
      queue: `${root}:claims:usr:${workspaceID}:${userID}:queue`,
      claims: `${root}:claims:usr:${workspaceID}:${userID}:data`,
    },
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

async function claimUsage(redis: Redis, key: ReturnType<typeof keys>["workspace"], id: string) {
  const result = await redis.eval<[number, string, number | string]>(
    CLAIM_USAGE,
    [key.counter, key.queue, key.claims],
    [id],
  )
  const status = Number(result[0])
  if (status === 0) return
  const cost = Number(result[2])
  if (status !== 1 || !result[1] || !Number.isSafeInteger(cost) || cost < 0)
    throw new Error("Invalid legacy usage claim response")
  return { id: String(result[1]), cost }
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
  await incrementUsage(redis, key.workspace.counter, key.user.counter, workspaceCost, userCost)
  if (random() > FLUSH_PROBABILITY) return null
  return drainUsage(workspaceID, userID, redis, stage)
}

export async function drainUsage(
  workspaceID: string,
  userID: string,
  redis: Redis = getRedis(),
  stage = Resource.App.stage,
  create: () => string = () => crypto.randomUUID(),
  pause: () => Promise<unknown> = () => Bun.sleep(10),
) {
  const key = keys(stage, workspaceID, userID)
  const total = { workspaceCost: 0, userCost: 0 }
  const apply = async (kind: "workspace" | "user", claim: { id: string; cost: number }) => {
    const fresh = await Database.transaction(async (tx) => {
      const inserted = affected(await tx.insert(LegacyUsageClaimTable).ignore().values({ id: claim.id })) > 0
      if (!inserted) return false
      if (kind === "workspace") {
        const updated = await tx
          .update(BillingTable)
          .set({
            balance: sql`${BillingTable.balance} - ${claim.cost}`,
            monthlyUsage: sql`
              CASE
                WHEN MONTH(${BillingTable.timeMonthlyUsageUpdated}) = MONTH(now()) AND YEAR(${BillingTable.timeMonthlyUsageUpdated}) = YEAR(now()) THEN COALESCE(${BillingTable.monthlyUsage}, 0) + ${claim.cost}
                ELSE ${claim.cost}
              END
            `,
            timeMonthlyUsageUpdated: sql`now()`,
          })
          .where(eq(BillingTable.workspaceID, workspaceID))
        if (affected(updated) !== 1) throw new Error(`Legacy usage workspace not found: ${workspaceID}`)
        return true
      }
      const updated = await tx
        .update(UserTable)
        .set({
          monthlyUsage: sql`
            CASE
              WHEN MONTH(${UserTable.timeMonthlyUsageUpdated}) = MONTH(now()) AND YEAR(${UserTable.timeMonthlyUsageUpdated}) = YEAR(now()) THEN COALESCE(${UserTable.monthlyUsage}, 0) + ${claim.cost}
              ELSE ${claim.cost}
            END
          `,
          timeMonthlyUsageUpdated: sql`now()`,
        })
        .where(and(eq(UserTable.workspaceID, workspaceID), eq(UserTable.id, userID)))
      if (affected(updated) !== 1) throw new Error(`Legacy usage user not found: ${userID}`)
      return true
    })

    const acknowledged = await redis.eval<number>(ACK_USAGE, [key[kind].queue, key[kind].claims], [claim.id])
    if (![-1, 0, 1].includes(Number(acknowledged)))
      throw new Error(`Legacy usage claim acknowledgement failed: ${claim.id}`)
    if (fresh) total[kind === "workspace" ? "workspaceCost" : "userCost"] += claim.cost
  }
  const flush = async (attempt: number, quiet = 0): Promise<typeof total | undefined> => {
    if (attempt === 100) throw new Error("Legacy usage drain did not converge")
    const claims = await Promise.all([
      claimUsage(redis, key.workspace, `workspace:${create()}`),
      claimUsage(redis, key.user, `user:${create()}`),
    ])
    const entries = (["workspace", "user"] as const).flatMap((kind, index) =>
      claims[index] ? [{ kind, claim: claims[index] }] : [],
    )
    if (entries.length) {
      const results = await Promise.allSettled(entries.map((entry) => apply(entry.kind, entry.claim!)))
      const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected")
      if (failed) throw failed.reason
      return flush(attempt + 1)
    }
    if (quiet === 1) return total.workspaceCost || total.userCost ? total : undefined
    await pause()
    return flush(attempt + 1, quiet + 1)
  }
  return flush(0)
}
