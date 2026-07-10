import { expect, test } from "bun:test"
import { eq, sql } from "@slopcode-ai/console-core/drizzle/index.js"
import { BillingTable } from "@slopcode-ai/console-core/schema/billing.sql.js"
import { UserTable } from "@slopcode-ai/console-core/schema/user.sql.js"
import { WorkspaceTable } from "@slopcode-ai/console-core/schema/workspace.sql.js"
import { testDatabase, useTestDatabase } from "../../core/test/database"
import {
  ACK_USAGE,
  CLAIM_USAGE,
  drainUsage,
  INCREMENT_USAGE,
  incrementUsage,
} from "../src/routes/zen/util/usageBatcher"

const workspaceID = "workspace_legacy_usage"
const userA = "user_legacy_a"
const userB = "user_legacy_b"

class Redis {
  calls: { script: string; keys: string[]; args: unknown[]; result?: unknown }[] = []
  queues = new Map<string, string[]>()
  claims = new Map<string, Map<string, number>>()
  failClaim = false
  failAck = false
  onEmpty: ((key: string) => void) | undefined

  constructor(readonly values = new Map<string, number>()) {}

  async eval<T>(script: string, keys: string[], args: unknown[]) {
    const call = { script, keys, args } as (typeof this.calls)[number]
    this.calls.push(call)
    if (script === INCREMENT_USAGE) {
      if (keys.length !== 2 || args.length !== 2) throw new Error("Invalid increment contract")
      const result = [
        (this.values.get(keys[0]) ?? 0) + Number(args[0]),
        (this.values.get(keys[1]) ?? 0) + Number(args[1]),
      ]
      this.values.set(keys[0], result[0])
      this.values.set(keys[1], result[1])
      call.result = result
      return result as T
    }
    if (script === CLAIM_USAGE) {
      if (keys.length !== 3 || args.length !== 1) throw new Error("Invalid claim contract")
      const queue = this.queues.get(keys[1]) ?? []
      const claims = this.claims.get(keys[2]) ?? new Map<string, number>()
      while (queue[0] && !claims.has(queue[0])) queue.shift()
      const current = queue[0]
      const result = (() => {
        if (current) return [1, current, String(claims.get(current))]
        const value = this.values.get(keys[0]) ?? 0
        if (value === 0) {
          this.onEmpty?.(keys[0])
          return [0, "", "0"]
        }
        const id = String(args[0])
        this.values.set(keys[0], 0)
        queue.push(id)
        claims.set(id, value)
        this.queues.set(keys[1], queue)
        this.claims.set(keys[2], claims)
        return [1, id, String(value)]
      })()
      call.result = result
      if (this.failClaim) {
        this.failClaim = false
        throw new Error("lost claim response")
      }
      return result as T
    }
    if (script === ACK_USAGE) {
      if (keys.length !== 2 || args.length !== 1) throw new Error("Invalid acknowledgement contract")
      const queue = this.queues.get(keys[0]) ?? []
      const claims = this.claims.get(keys[1]) ?? new Map<string, number>()
      const id = String(args[0])
      const result = !queue[0] ? 0 : queue[0] !== id ? -1 : 1
      if (result === 1) {
        queue.shift()
        claims.delete(id)
        if (queue.length) this.queues.set(keys[0], queue)
        else this.queues.delete(keys[0])
        if (claims.size) this.claims.set(keys[1], claims)
        else this.claims.delete(keys[1])
      }
      call.result = result
      if (this.failAck) {
        this.failAck = false
        throw new Error("lost acknowledgement response")
      }
      return result as T
    }
    throw new Error("Unexpected Redis script")
  }
}

async function seed() {
  await testDatabase().insert(WorkspaceTable).values({ id: workspaceID, name: "Legacy usage" })
  await testDatabase().insert(BillingTable).values({ id: "billing_legacy", workspaceID, balance: 0, reload: false })
  await testDatabase()
    .insert(UserTable)
    .values([
      { id: userA, workspaceID, name: "User A", role: "admin" },
      { id: userB, workspaceID, name: "User B", role: "member" },
    ])
}

function key(user: string) {
  return {
    workspace: `test:usage:wrk:${workspaceID}`,
    user: `test:usage:usr:${workspaceID}:${user}`,
    workspaceQueue: `test:usage:claims:wrk:${workspaceID}:queue`,
    workspaceClaims: `test:usage:claims:wrk:${workspaceID}:data`,
    userQueue: `test:usage:claims:usr:${workspaceID}:${user}:queue`,
    userClaims: `test:usage:claims:usr:${workspaceID}:${user}:data`,
  }
}

function ids(prefix = "") {
  let value = 0
  return () => `${prefix}claim_${value++}`
}

test("applies unequal workspace and user legacy counters independently", async () => {
  await seed()
  const keys = key(userA)
  const redis = new Redis(
    new Map([
      [keys.workspace, 30],
      [keys.user, 40],
    ]),
  )

  const result = await useTestDatabase(() =>
    drainUsage(workspaceID, userA, redis, "test", ids(), () => Promise.resolve()),
  )
  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  const user = await testDatabase()
    .select()
    .from(UserTable)
    .where(eq(UserTable.id, userA))
    .then((rows) => rows[0])

  expect(result).toEqual({ workspaceCost: 30, userCost: 40 })
  expect(billing.balance).toBe(-30)
  expect(billing.monthlyUsage).toBe(30)
  expect(user.monthlyUsage).toBe(40)
  expect(redis.queues.size).toBe(0)
  expect(redis.claims.size).toBe(0)
  expect(redis.calls[0]).toMatchObject({
    script: CLAIM_USAGE,
    keys: [keys.workspace, keys.workspaceQueue, keys.workspaceClaims],
    args: ["workspace:claim_0"],
    result: [1, "workspace:claim_0", "30"],
  })
  expect(redis.calls[1]).toMatchObject({
    script: CLAIM_USAGE,
    keys: [keys.user, keys.userQueue, keys.userClaims],
    args: ["user:claim_1"],
    result: [1, "user:claim_1", "40"],
  })
  expect(redis.calls.filter((call) => call.script === CLAIM_USAGE)).toHaveLength(6)
  expect(redis.calls.filter((call) => call.script === ACK_USAGE)).toHaveLength(2)
})

test("applies one shared workspace aggregate and each user aggregate exactly once", async () => {
  await seed()
  const a = key(userA)
  const b = key(userB)
  const redis = new Redis()
  await incrementUsage(redis, a.workspace, a.user, 30, 10)
  await incrementUsage(redis, b.workspace, b.user, 40, 20)

  await useTestDatabase(() => drainUsage(workspaceID, userA, redis, "test", ids("a_"), () => Promise.resolve()))
  await useTestDatabase(() => drainUsage(workspaceID, userB, redis, "test", ids("b_"), () => Promise.resolve()))

  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  const users = await testDatabase().select().from(UserTable)
  expect(billing.balance).toBe(-70)
  expect(billing.monthlyUsage).toBe(70)
  expect(users.find((user) => user.id === userA)?.monthlyUsage).toBe(10)
  expect(users.find((user) => user.id === userB)?.monthlyUsage).toBe(20)
})

test("admits a straddled old-producer user write without debiting workspace twice", async () => {
  await seed()
  const keys = key(userA)
  const redis = new Redis(new Map([[keys.workspace, 50]]))
  let empty = 0
  redis.onEmpty = (name) => {
    if (name !== keys.user) return
    empty++
    if (empty !== 2) return
    redis.onEmpty = undefined
    redis.values.set(keys.user, 20)
  }

  await useTestDatabase(() => drainUsage(workspaceID, userA, redis, "test", ids(), () => Promise.resolve()))

  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  const user = await testDatabase()
    .select()
    .from(UserTable)
    .where(eq(UserTable.id, userA))
    .then((rows) => rows[0])
  expect(billing.balance).toBe(-50)
  expect(billing.monthlyUsage).toBe(50)
  expect(user.monthlyUsage).toBe(20)
  expect(empty).toBe(2)
  expect(redis.values.get(keys.workspace)).toBe(0)
  expect(redis.values.get(keys.user)).toBe(0)
})

test("retries each staged dimension independently after a partial database failure", async () => {
  await seed()
  await testDatabase().execute(
    sql.raw(`
      CREATE TRIGGER fail_billing_update BEFORE UPDATE ON billing
      FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced billing update failure'
    `),
  )
  const keys = key(userA)
  const redis = new Redis(
    new Map([
      [keys.workspace, 30],
      [keys.user, 40],
    ]),
  )

  await expect(
    useTestDatabase(() => drainUsage(workspaceID, userA, redis, "test", ids(), () => Promise.resolve())),
  ).rejects.toThrow()
  expect(redis.queues.has(keys.workspaceQueue)).toBe(true)
  expect(redis.queues.has(keys.userQueue)).toBe(false)
  await testDatabase().execute(sql.raw("DROP TRIGGER fail_billing_update"))
  await incrementUsage(redis, keys.workspace, keys.user, 5, 7)

  await useTestDatabase(() => drainUsage(workspaceID, userA, redis, "test", ids("retry_"), () => Promise.resolve()))
  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  const user = await testDatabase()
    .select()
    .from(UserTable)
    .where(eq(UserTable.id, userA))
    .then((rows) => rows[0])
  expect(billing.balance).toBe(-35)
  expect(user.monthlyUsage).toBe(47)
  expect(redis.queues.size).toBe(0)
})

test("replays independently staged claims after claim and acknowledgement responses are lost", async () => {
  await seed()
  const keys = key(userA)
  const redis = new Redis(
    new Map([
      [keys.workspace, 30],
      [keys.user, 40],
    ]),
  )
  redis.failClaim = true

  await expect(
    useTestDatabase(() => drainUsage(workspaceID, userA, redis, "test", ids(), () => Promise.resolve())),
  ).rejects.toThrow("lost claim response")
  redis.failAck = true
  await expect(
    useTestDatabase(() => drainUsage(workspaceID, userA, redis, "test", ids(), () => Promise.resolve())),
  ).rejects.toThrow("lost acknowledgement response")
  await useTestDatabase(() => drainUsage(workspaceID, userA, redis, "test", ids(), () => Promise.resolve()))

  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  const user = await testDatabase()
    .select()
    .from(UserTable)
    .where(eq(UserTable.id, userA))
    .then((rows) => rows[0])
  expect(billing.balance).toBe(-30)
  expect(user.monthlyUsage).toBe(40)
  expect(redis.queues.size).toBe(0)
})

test("applies independently claimed dimensions once under concurrent drainers", async () => {
  await seed()
  const keys = key(userA)
  const redis = new Redis(
    new Map([
      [keys.workspace, 30],
      [keys.user, 40],
    ]),
  )

  await Promise.all([
    useTestDatabase(() => drainUsage(workspaceID, userA, redis, "test", ids(), () => Promise.resolve())),
    useTestDatabase(() => drainUsage(workspaceID, userA, redis, "test", ids(), () => Promise.resolve())),
  ])

  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  const user = await testDatabase()
    .select()
    .from(UserTable)
    .where(eq(UserTable.id, userA))
    .then((rows) => rows[0])
  expect(billing.balance).toBe(-30)
  expect(user.monthlyUsage).toBe(40)
})

test("increments both producer counters in one exact script", async () => {
  const redis = new Redis()

  expect(await incrementUsage(redis, "workspace", "user", 30, 40)).toEqual({ workspaceCost: 30, userCost: 40 })
  expect(redis.values).toEqual(
    new Map([
      ["workspace", 30],
      ["user", 40],
    ]),
  )
  expect(redis.calls[0]).toMatchObject({ script: INCREMENT_USAGE, keys: ["workspace", "user"], args: [30, 40] })
  await expect(redis.eval("return 1", [], [])).rejects.toThrow("Unexpected Redis script")
})
