import { describe, expect, test } from "bun:test"
import type { APIEvent } from "@solidjs/start/server"
import { Actor } from "@slopcode-ai/console-core/actor.js"
import { and, eq, sql } from "@slopcode-ai/console-core/drizzle/index.js"
import { BillingTable, UsageReservationTable, UsageTable } from "@slopcode-ai/console-core/schema/billing.sql.js"
import { KeyTable } from "@slopcode-ai/console-core/schema/key.sql.js"
import { UserTable } from "@slopcode-ai/console-core/schema/user.sql.js"
import { WorkspaceTable } from "@slopcode-ai/console-core/schema/workspace.sql.js"
import { recoverUsage } from "@slopcode-ai/console-core/usage-reservation.js"
import { reloadBilling, setBillingReload } from "../src/routes/workspace/[id]/billing/server"
import { testDatabase, useTestDatabase } from "../../core/test/database"
import { stripeWebhookTests } from "./stripeWebhook.cases"
import { drainUsage, incrementUsage } from "../src/routes/zen/util/usageBatcher"
import { handler, type HandlerRuntime } from "../src/routes/zen/util/handler"

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

const CLAIM_USAGE = `
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

const ACK_USAGE = `
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

const INCREMENT_USAGE = `
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

class Redis {
  calls: { script: string; keys: string[]; args: unknown[]; result?: unknown }[] = []
  queues = new Map<string, string[]>()
  claims = new Map<string, Map<string, number>>()
  failClaim = false
  failAck = false

  constructor(readonly values: Map<string, number>) {}

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
      if (keys.length !== 4 || args.length !== 1) throw new Error("Invalid claim contract")
      const queue = this.queues.get(keys[2]) ?? []
      const claims = this.claims.get(keys[3]) ?? new Map<string, number>()
      const current = queue[0]
      const result = (() => {
        if (current)
          return [1, current, String(claims.get(`${current}:workspace`)), String(claims.get(`${current}:user`))]
        const safe = Math.max(this.values.get(keys[0]) ?? 0, this.values.get(keys[1]) ?? 0)
        if (safe === 0) return [0, "", "0", "0"]
        const id = String(args[0])
        this.values.set(keys[0], 0)
        this.values.set(keys[1], 0)
        queue.push(id)
        claims.set(`${id}:workspace`, safe)
        claims.set(`${id}:user`, safe)
        this.queues.set(keys[2], queue)
        this.claims.set(keys[3], claims)
        return [1, id, String(safe), String(safe)]
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
        claims.delete(`${id}:workspace`)
        claims.delete(`${id}:user`)
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

const model = {
  providers: {
    fake: {
      api: "https://provider.test/v1",
      apiKey: "provider-key",
      format: "oa-compat" as const,
    },
  },
  models: {
    "test-model": {
      name: "Test Model",
      cost: { input: 0.000001, output: 0.000002 },
      limit: { context: 10_000, output: 1_000 },
      trialProvider: undefined,
      providers: [
        {
          id: "fake",
          model: "test-model",
          priority: 0,
          weight: 1,
          payloadModifier: { max_completion_tokens: 100 },
        },
      ],
    },
  },
} as unknown as HandlerRuntime["data"]

async function seedZen() {
  await testDatabase().insert(WorkspaceTable).values({ id: workspaceID, name: "Zen" })
  await testDatabase()
    .insert(BillingTable)
    .values({ id: "billing_zen", workspaceID, balance: 1_000_000_000, reload: false })
  await testDatabase().insert(UserTable).values({ id: admin.userID, workspaceID, name: "Admin", role: "admin" })
  await testDatabase().insert(KeyTable).values({
    id: "key_zen",
    workspaceID,
    userID: admin.userID,
    name: "Zen",
    key: "sk-zen",
  })
}

function zenRequest(runtime: HandlerRuntime) {
  return useTestDatabase(() =>
    handler(
      {
        request: new Request("https://slopcode.ai/zen/v1/chat/completions", {
          method: "POST",
          headers: {
            authorization: "Bearer sk-zen",
            "content-type": "application/json",
            "x-real-ip": "127.0.0.1",
          },
          body: JSON.stringify({
            model: "test-model",
            stream: true,
            messages: [{ role: "user", content: "hello" }],
            max_tokens: 20,
            max_output_tokens: 50,
          }),
        }),
      } as APIEvent,
      {
        format: "oa-compat",
        modelList: "full",
        parseApiKey: (headers) => headers.get("authorization")?.split(" ")[1],
        parseModel: (_url, body) => body.model,
        parseVariant: () => undefined,
        parseIsStream: (_url, body) => !!body.stream,
      },
      { data: model, rateLimit: false, reload: false, ...runtime },
    ),
  )
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

test("drains and acknowledges a conservative legacy usage claim", async () => {
  await seed()
  await testDatabase().insert(UserTable).values({ id: admin.userID, workspaceID, name: "Admin", role: "admin" })
  const values = new Map([
    [`test:usage:wrk:${workspaceID}`, 30],
    [`test:usage:usr:${workspaceID}:${admin.userID}`, 40],
  ])
  const redis = new Redis(values)

  await useTestDatabase(() => drainUsage(workspaceID, admin.userID, redis, "test", () => "claim_success"))

  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .where(eq(BillingTable.workspaceID, workspaceID))
    .then((rows) => rows[0])
  const user = await testDatabase()
    .select()
    .from(UserTable)
    .where(eq(UserTable.id, admin.userID))
    .then((rows) => rows[0])
  expect(billing.balance).toBe(-40)
  expect(billing.monthlyUsage).toBe(40)
  expect(user.monthlyUsage).toBe(40)
  expect(redis.queues.size).toBe(0)
  expect(redis.claims.size).toBe(0)
  expect(redis.calls.map((call) => call.script)).toEqual([CLAIM_USAGE, ACK_USAGE, CLAIM_USAGE])
  expect(redis.calls[0].keys).toEqual([
    `test:usage:wrk:${workspaceID}`,
    `test:usage:usr:${workspaceID}:${admin.userID}`,
    `test:usage:claims:${workspaceID}:${admin.userID}:queue`,
    `test:usage:claims:${workspaceID}:${admin.userID}:data`,
  ])
  expect(redis.calls[0].args).toEqual(["claim_success"])
  expect(redis.calls[0].result).toEqual([1, "claim_success", "40", "40"])
  expect(redis.calls[1]).toMatchObject({
    keys: [
      `test:usage:claims:${workspaceID}:${admin.userID}:queue`,
      `test:usage:claims:${workspaceID}:${admin.userID}:data`,
    ],
    args: ["claim_success"],
    result: 1,
  })
})

test("retries a staged claim after its database flush fails", async () => {
  await seed()
  await testDatabase().insert(UserTable).values({ id: admin.userID, workspaceID, name: "Admin", role: "admin" })
  await testDatabase().execute(
    sql.raw(`
      CREATE TRIGGER fail_billing_update BEFORE UPDATE ON billing
      FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced billing update failure'
    `),
  )
  const wKey = `test:usage:wrk:${workspaceID}`
  const uKey = `test:usage:usr:${workspaceID}:${admin.userID}`
  const values = new Map([
    [wKey, 30],
    [uKey, 40],
  ])
  const redis = new Redis(values)

  await expect(
    useTestDatabase(() => drainUsage(workspaceID, admin.userID, redis, "test", () => "claim_retry")),
  ).rejects.toThrow()
  expect(values.get(wKey)).toBe(0)
  expect(values.get(uKey)).toBe(0)
  expect(redis.queues.size).toBe(1)
  await testDatabase().execute(sql.raw("DROP TRIGGER fail_billing_update"))
  await incrementUsage(redis, wKey, uKey, 5, 7)

  await useTestDatabase(() => drainUsage(workspaceID, admin.userID, redis, "test", () => "claim_new"))
  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  const user = await testDatabase()
    .select()
    .from(UserTable)
    .then((rows) => rows[0])
  expect(billing.balance).toBe(-47)
  expect(user.monthlyUsage).toBe(47)
  expect(redis.queues.size).toBe(0)
})

test("replays a staged claim after its Redis response is lost", async () => {
  await seed()
  await testDatabase().insert(UserTable).values({ id: admin.userID, workspaceID, name: "Admin", role: "admin" })
  const values = new Map([
    [`test:usage:wrk:${workspaceID}`, 30],
    [`test:usage:usr:${workspaceID}:${admin.userID}`, 40],
  ])
  const redis = new Redis(values)
  redis.failClaim = true

  await expect(
    useTestDatabase(() => drainUsage(workspaceID, admin.userID, redis, "test", () => "claim_lost")),
  ).rejects.toThrow("lost claim response")
  await useTestDatabase(() => drainUsage(workspaceID, admin.userID, redis, "test", () => "claim_other"))

  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  expect(billing.balance).toBe(-40)
  expect(redis.queues.size).toBe(0)
})

test("does not double-apply a claim after its acknowledgement response is lost", async () => {
  await seed()
  await testDatabase().insert(UserTable).values({ id: admin.userID, workspaceID, name: "Admin", role: "admin" })
  const values = new Map([
    [`test:usage:wrk:${workspaceID}`, 30],
    [`test:usage:usr:${workspaceID}:${admin.userID}`, 40],
  ])
  const redis = new Redis(values)
  redis.failAck = true

  await expect(
    useTestDatabase(() => drainUsage(workspaceID, admin.userID, redis, "test", () => "claim_ack_lost")),
  ).rejects.toThrow("lost acknowledgement response")
  await useTestDatabase(() => drainUsage(workspaceID, admin.userID, redis, "test", () => "claim_after_ack"))

  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  expect(billing.balance).toBe(-40)
})

test("applies a concurrently claimed legacy batch only once", async () => {
  await seed()
  await testDatabase().insert(UserTable).values({ id: admin.userID, workspaceID, name: "Admin", role: "admin" })
  const redis = new Redis(
    new Map([
      [`test:usage:wrk:${workspaceID}`, 40],
      [`test:usage:usr:${workspaceID}:${admin.userID}`, 40],
    ]),
  )

  const results = await Promise.all([
    useTestDatabase(() => drainUsage(workspaceID, admin.userID, redis, "test", () => "claim_concurrent_a")),
    useTestDatabase(() => drainUsage(workspaceID, admin.userID, redis, "test", () => "claim_concurrent_b")),
  ])

  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  expect(results).toHaveLength(2)
  expect(billing.balance).toBe(-40)
})

test("increments workspace and user legacy counters in one exact script", async () => {
  const values = new Map<string, number>()
  const redis = new Redis(values)

  expect(await incrementUsage(redis, "workspace", "user", 30, 40)).toEqual({ workspaceCost: 30, userCost: 40 })
  expect(values).toEqual(
    new Map([
      ["workspace", 30],
      ["user", 40],
    ]),
  )
  expect(redis.calls[0]).toMatchObject({ script: INCREMENT_USAGE, keys: ["workspace", "user"], args: [30, 40] })
  await expect(redis.eval("return 1", [], [])).rejects.toThrow("Unexpected Redis script")
})

test("handler drains a canceled provider stream while its live lease blocks recovery", async () => {
  await seedZen()
  const encoder = new TextEncoder()
  let release = () => {}
  let providerCanceled = false
  let sent: Record<string, unknown> | undefined
  const lifetimes: Promise<void>[] = []
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            id: "chatcmpl_test",
            choices: [{ index: 0, delta: { content: "hello" }, finish_reason: null }],
          })}\n\n`,
        ),
      )
      release = () =>
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              choices: [],
              usage: { prompt_tokens: 10, completion_tokens: 5 },
            })}\n\n`,
          ),
        )
    },
    cancel() {
      providerCanceled = true
    },
  })
  const response = await zenRequest({
    leaseSeconds: 1,
    heartbeatInterval: 200,
    drainTimeout: 1_500,
    waitUntil(promise) {
      lifetimes.push(promise)
    },
    async fetch(_url, init) {
      sent = JSON.parse(String(init?.body))
      return new Response(source, { status: 200, headers: { "content-type": "text/event-stream" } })
    },
  })
  const reader = response.body!.getReader()
  expect((await reader.read()).done).toBe(false)
  await reader.cancel("client disconnected")
  await Bun.sleep(1_100)

  const live = await testDatabase()
    .select()
    .from(UsageReservationTable)
    .then((rows) => rows[0])
  expect(live.status).toBe("pending")
  expect(live.usage?.outputTokens).toBe(100)
  expect(live.timeLeaseExpires!.getTime()).toBeGreaterThan(Date.now())
  expect(await useTestDatabase(() => recoverUsage({ workspaceID, before: new Date(), now: new Date() }))).toEqual({
    released: 0,
    settled: 0,
  })
  release()
  await Promise.all(lifetimes)

  const reservation = await testDatabase()
    .select()
    .from(UsageReservationTable)
    .then((rows) => rows[0])
  const usage = await testDatabase()
    .select()
    .from(UsageTable)
    .then((rows) => rows[0])
  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  expect(sent).toMatchObject({ max_tokens: 100 })
  expect(sent?.max_completion_tokens).toBeUndefined()
  expect(sent?.max_output_tokens).toBeUndefined()
  expect(providerCanceled).toBe(true)
  expect(reservation.status).toBe("settled")
  expect(reservation.amountActual).toBe(2_000)
  expect(reservation.timeLeaseExpires).toBeNull()
  expect(usage.cost).toBe(2_000)
  expect(usage.enrichment?.unknown).toBeUndefined()
  expect(billing.balance).toBe(999_998_000)
})

test("handler timeout aborts upstream and settles the full unknown hold", async () => {
  await seedZen()
  const encoder = new TextEncoder()
  const lifetimes: Promise<void>[] = []
  let aborted = false
  const response = await zenRequest({
    leaseSeconds: 1,
    heartbeatInterval: 5,
    drainTimeout: 20,
    waitUntil(promise) {
      lifetimes.push(promise)
    },
    async fetch(_url, init) {
      init?.signal?.addEventListener("abort", () => {
        aborted = true
      })
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'))
          },
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      )
    },
  })
  const reader = response.body!.getReader()
  await reader.read()
  await reader.cancel("client disconnected")
  const hold = await testDatabase()
    .select()
    .from(UsageReservationTable)
    .then((rows) => rows[0].amount)
  await Promise.all(lifetimes)

  const reservation = await testDatabase()
    .select()
    .from(UsageReservationTable)
    .then((rows) => rows[0])
  const usage = await testDatabase()
    .select()
    .from(UsageTable)
    .then((rows) => rows[0])
  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  expect(aborted).toBe(true)
  expect(reservation.status).toBe("settled")
  expect(reservation.amountActual).toBe(hold)
  expect(reservation.timeLeaseExpires).toBeNull()
  expect(usage.cost).toBe(hold)
  expect(usage.enrichment).toMatchObject({ estimated: true, unknown: true })
  expect(billing.balance).toBe(1_000_000_000 - hold)
})

stripeWebhookTests({ testDatabase, useTestDatabase })
