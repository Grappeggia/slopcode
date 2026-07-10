import { afterAll, beforeAll, expect, test } from "bun:test"
import { eq } from "@slopcode-ai/console-core/drizzle/index.js"
import { BillingTable } from "@slopcode-ai/console-core/schema/billing.sql.js"
import { UserTable } from "@slopcode-ai/console-core/schema/user.sql.js"
import { WorkspaceTable } from "@slopcode-ai/console-core/schema/workspace.sql.js"
import { testDatabase, useTestDatabase } from "../../core/test/database"
import {
  ACK_USAGE,
  acquireUsageCutover,
  CLAIM_USAGE,
  drainUsage,
  incrementUsage,
  refreshUsageCutover,
  releaseUsageCutover,
} from "../src/routes/zen/util/usageBatcher"

let container = ""

async function run(args: string[]) {
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" })
  const output = Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
  const code = await proc.exited
  const [stdout, stderr] = await output
  if (code !== 0) throw new Error(stderr.trim() || `${args.join(" ")} failed with exit code ${code}`)
  return stdout.trim()
}

async function command(args: unknown[]) {
  return JSON.parse(await run(["docker", "exec", container, "redis-cli", "--json", ...args.map(String)]))
}

const redis = {
  eval<T>(script: string, keys: string[], args: unknown[]) {
    return command(["EVAL", script, keys.length, ...keys, ...args]) as Promise<T>
  },
}

async function ready(attempts = 40): Promise<void> {
  const pong = await run(["docker", "exec", container, "redis-cli", "PING"]).catch(() => "")
  if (pong === "PONG") return
  if (attempts === 0) throw new Error("Redis test container did not become ready")
  await Bun.sleep(100)
  return ready(attempts - 1)
}

beforeAll(async () => {
  container = `slopcode-console-redis-${crypto.randomUUID()}`
  await run(["docker", "run", "--rm", "-d", "--name", container, "redis:7.4.2-alpine"])
  await ready()
})

afterAll(async () => {
  if (container) await run(["docker", "rm", "-f", container])
})

test("runs independent multi-user claims and old split writes against Redis Lua", async () => {
  const workspace = "usage:wrk:shared"
  const userA = "usage:usr:shared:a"
  const userB = "usage:usr:shared:b"
  const workspaceQueue = "usage:claims:wrk:shared:queue"
  const workspaceData = "usage:claims:wrk:shared:data"
  const aQueue = "usage:claims:usr:shared:a:queue"
  const aData = "usage:claims:usr:shared:a:data"
  const bQueue = "usage:claims:usr:shared:b:queue"
  const bData = "usage:claims:usr:shared:b:data"

  expect(await incrementUsage(redis, workspace, userA, 30, 10)).toEqual({ workspaceCost: 30, userCost: 10 })
  expect(await incrementUsage(redis, workspace, userB, 40, 20)).toEqual({ workspaceCost: 70, userCost: 20 })
  expect(
    await redis.eval<[number, string, string]>(
      CLAIM_USAGE,
      [workspace, workspaceQueue, workspaceData],
      ["workspace:one"],
    ),
  ).toEqual([1, "workspace:one", "70"])
  expect(
    await redis.eval<[number, string, string]>(
      CLAIM_USAGE,
      [workspace, workspaceQueue, workspaceData],
      ["workspace:other"],
    ),
  ).toEqual([1, "workspace:one", "70"])
  expect(await redis.eval<[number, string, string]>(CLAIM_USAGE, [userA, aQueue, aData], ["user:a"])).toEqual([
    1,
    "user:a",
    "10",
  ])
  expect(await redis.eval<[number, string, string]>(CLAIM_USAGE, [userB, bQueue, bData], ["user:b"])).toEqual([
    1,
    "user:b",
    "20",
  ])
  expect(await command(["TTL", workspace])).toBe(-1)
  expect(await command(["TTL", workspaceQueue])).toBe(-1)
  expect(await command(["TTL", workspaceData])).toBe(-1)
  expect(await redis.eval<number>(ACK_USAGE, [workspaceQueue, workspaceData], ["workspace:one"])).toBe(1)
  expect(await redis.eval<number>(ACK_USAGE, [workspaceQueue, workspaceData], ["workspace:one"])).toBe(0)
  expect(await redis.eval<number>(ACK_USAGE, [aQueue, aData], ["user:a"])).toBe(1)
  expect(await redis.eval<number>(ACK_USAGE, [bQueue, bData], ["user:b"])).toBe(1)
  expect(await command(["TTL", workspaceQueue])).toBe(-2)
  expect(await command(["TTL", workspaceData])).toBe(-2)

  await command(["INCRBY", workspace, 50])
  expect(
    await redis.eval<[number, string, string]>(
      CLAIM_USAGE,
      [workspace, workspaceQueue, workspaceData],
      ["workspace:split"],
    ),
  ).toEqual([1, "workspace:split", "50"])
  expect(await redis.eval<[number, string, string]>(CLAIM_USAGE, [userA, aQueue, aData], ["user:empty"])).toEqual([
    0,
    "",
    "0",
  ])
  await command(["INCRBY", userA, 20])
  expect(await redis.eval<number>(ACK_USAGE, [workspaceQueue, workspaceData], ["workspace:split"])).toBe(1)
  expect(
    await redis.eval<[number, string, string]>(
      CLAIM_USAGE,
      [workspace, workspaceQueue, workspaceData],
      ["workspace:empty"],
    ),
  ).toEqual([0, "", "0"])
  expect(await redis.eval<[number, string, string]>(CLAIM_USAGE, [userA, aQueue, aData], ["user:split"])).toEqual([
    1,
    "user:split",
    "20",
  ])
})

test("runs the production drain and cutover path against Redis Lua", async () => {
  const workspaceID = "workspace_redis_cutover"
  const userA = "user_redis_cutover_a"
  const userB = "user_redis_cutover_b"
  const workspace = `redis-test:usage:wrk:${workspaceID}`
  const a = `redis-test:usage:usr:${workspaceID}:${userA}`
  const b = `redis-test:usage:usr:${workspaceID}:${userB}`
  await testDatabase().insert(WorkspaceTable).values({ id: workspaceID, name: "Redis cutover" })
  await testDatabase().insert(BillingTable).values({ id: "billing_redis_cutover", workspaceID, balance: 0 })
  await testDatabase()
    .insert(UserTable)
    .values([
      { id: userA, workspaceID, name: "Redis A", role: "admin" },
      { id: userB, workspaceID, name: "Redis B", role: "member" },
    ])
  await incrementUsage(redis, workspace, a, 30, 10)
  await incrementUsage(redis, workspace, b, 40, 20)
  const cutover = await acquireUsageCutover(workspaceID, {
    redis,
    stage: "redis-test",
    owner: "redis-owner",
    graceMs: 0,
    leaseMs: 5_000,
  })
  expect(cutover?.phase).toBe("finalize")
  expect(await command(["PTTL", cutover!.lease])).toBeGreaterThan(0)
  expect(await refreshUsageCutover({ ...cutover!, owner: "redis-intruder" })).toBe(false)
  expect(await releaseUsageCutover({ ...cutover!, owner: "redis-intruder" }, true)).toBe(false)
  expect(await refreshUsageCutover(cutover!)).toBe(true)

  await useTestDatabase(() => drainUsage(workspaceID, userA, redis, "redis-test"))
  await incrementUsage(redis, workspace, a, 7, 7)
  await incrementUsage(redis, workspace, b, 5, 5)
  await useTestDatabase(() => drainUsage(workspaceID, userA, redis, "redis-test"))
  expect(await releaseUsageCutover(cutover!, true)).toBe(true)
  expect(
    await acquireUsageCutover(workspaceID, {
      redis,
      stage: "redis-test",
      owner: "redis-normal",
      graceMs: 0,
      leaseMs: 5_000,
    }),
  ).toBeUndefined()
  await useTestDatabase(() => drainUsage(workspaceID, userB, redis, "redis-test"))

  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  const users = await testDatabase().select().from(UserTable)
  expect(billing.monthlyUsage).toBe(82)
  expect(users.find((user) => user.id === userA)?.monthlyUsage).toBe(17)
  expect(users.find((user) => user.id === userB)?.monthlyUsage).toBe(25)
  expect(await command(["GET", workspace])).toBe("0")
  expect(await command(["GET", a])).toBe("0")
  expect(await command(["GET", b])).toBe("0")
  expect(await testDatabase().select().from(UserTable).where(eq(UserTable.workspaceID, workspaceID))).toHaveLength(2)
})
