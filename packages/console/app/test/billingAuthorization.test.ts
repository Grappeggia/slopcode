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
import { handler, type HandlerRuntime } from "../src/routes/zen/util/handler"
import {
  acquireUsageCutover,
  incrementUsage,
  REFRESH_USAGE_CUTOVER,
  releaseUsageCutover,
} from "../src/routes/zen/util/usageBatcher"
import { UsageRedis } from "./usageBatcher.cases"
import "./usageBatcherRedis.cases"

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
        request: new Request("https://slopcode.dev/zen/v1/chat/completions", {
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

test("handler emits stale recovery's durable hold and usage when lease ownership is lost", async () => {
  await seedZen()
  const encoder = new TextEncoder()
  const lifetimes: Promise<void>[] = []
  let release = () => {}
  const response = await zenRequest({
    leaseSeconds: 60,
    heartbeatInterval: 60_000,
    waitUntil(promise) {
      lifetimes.push(promise)
    },
    async fetch() {
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'))
            release = () => {
              controller.enqueue(
                encoder.encode('data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n'),
              )
              controller.close()
            }
          },
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      )
    },
  })
  const body = new Response(response.body).text()
  const pending = await testDatabase()
    .select()
    .from(UsageReservationTable)
    .then((rows) => rows[0])
  expect(pending.amount).toBeGreaterThan(2_000)
  await testDatabase()
    .update(UsageReservationTable)
    .set({ timeLeaseExpires: new Date(Date.now() - 1_000) })
    .where(eq(UsageReservationTable.id, pending.id))
  expect(await useTestDatabase(() => recoverUsage({ workspaceID, before: new Date(), now: new Date() }))).toEqual({
    released: 0,
    settled: 1,
  })

  release()
  const text = await body
  await Promise.all(lifetimes)

  const chunks = text
    .split("\n\n")
    .filter((part) => part.startsWith("data: "))
    .map((part) => JSON.parse(part.slice(6)))
  const cost = chunks.find((chunk) => chunk.cost)?.cost
  const usage = await testDatabase()
    .select()
    .from(UsageTable)
    .then((rows) => rows[0])
  expect(cost).toBe((pending.amount / 100_000_000).toFixed(8))
  expect(usage).toMatchObject({
    inputTokens: pending.usage?.inputTokens,
    outputTokens: pending.usage?.outputTokens,
    cost: pending.amount,
    enrichment: { estimated: true, unknown: true },
  })
})

test("hot-workspace handler fences concurrent admission and drains writes around settlement", async () => {
  await seedZen()
  const encoder = new TextEncoder()
  const redis = new UsageRedis()
  const workspace = `test:usage:wrk:${workspaceID}`
  const user = `test:usage:usr:${workspaceID}:${admin.userID}`
  const firstLifetimes: Promise<void>[] = []
  let releaseFirst = () => {}
  const first = await zenRequest({
    usageCutover: {
      redis,
      stage: "test",
      hotWorkspaces: new Set([workspaceID]),
      owner: "handler_first",
      graceMs: 1_000,
      leaseMs: 1_000,
      heartbeatInterval: 10,
    },
    waitUntil(promise) {
      firstLifetimes.push(promise)
    },
    async fetch() {
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'))
            releaseFirst = () => {
              controller.enqueue(
                encoder.encode('data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n'),
              )
              controller.close()
            }
          },
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      )
    },
  })
  const firstBody = new Response(first.body).text()
  let blockedFetch = false
  const blocked = await zenRequest({
    usageCutover: {
      redis,
      stage: "test",
      hotWorkspaces: new Set([workspaceID]),
      owner: "handler_blocked",
      graceMs: 1_000,
      leaseMs: 1_000,
    },
    async fetch() {
      blockedFetch = true
      throw new Error("blocked request reached provider")
    },
  })
  expect(blocked.status).toBe(429)
  expect(blocked.headers.get("retry-after")).toBe("1")
  expect(blockedFetch).toBe(false)
  expect(redis.calls.some((call) => call.script === REFRESH_USAGE_CUTOVER)).toBe(true)

  await incrementUsage(redis, workspace, user, 30, 10)
  releaseFirst()
  await firstBody
  await Promise.all(firstLifetimes)
  const firstBilling = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  const firstUser = await testDatabase()
    .select()
    .from(UserTable)
    .then((rows) => rows[0])
  expect(firstBilling.monthlyUsage).toBe(2_030)
  expect(firstUser.monthlyUsage).toBe(2_010)
  expect(redis.leases.size).toBe(0)

  await incrementUsage(redis, workspace, user, 5, 5)
  const secondLifetimes: Promise<void>[] = []
  let releaseSecond = () => {}
  const second = await zenRequest({
    usageCutover: {
      redis,
      stage: "test",
      hotWorkspaces: new Set([workspaceID]),
      owner: "handler_second",
      graceMs: 1_000,
      leaseMs: 1_000,
      heartbeatInterval: 100,
    },
    waitUntil(promise) {
      secondLifetimes.push(promise)
    },
    async fetch() {
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"again"}}]}\n\n'))
            releaseSecond = () => {
              controller.enqueue(
                encoder.encode('data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n'),
              )
              controller.close()
            }
          },
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      )
    },
  })
  const secondBody = new Response(second.body).text()
  const pending = await testDatabase()
    .select()
    .from(UsageReservationTable)
    .then((rows) => rows.find((row) => row.status === "pending")!)
  const interimBilling = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  const interimUser = await testDatabase()
    .select()
    .from(UserTable)
    .then((rows) => rows[0])
  expect(interimBilling.monthlyUsage).toBe(firstBilling.monthlyUsage! + 5 + pending.amount)
  expect(interimUser.monthlyUsage).toBe(firstUser.monthlyUsage! + 5 + pending.amount)
  releaseSecond()
  await secondBody
  await Promise.all(secondLifetimes)
})

test("failed hot-workspace handler releases its cutover fence without completing grace", async () => {
  await seedZen()
  const redis = new UsageRedis()
  const workspace = `test:usage:wrk:${workspaceID}`
  const user = `test:usage:usr:${workspaceID}:${admin.userID}`
  const response = await zenRequest({
    usageCutover: {
      redis,
      stage: "test",
      hotWorkspaces: new Set([workspaceID]),
      owner: "handler_failed",
      graceMs: 1_000,
      leaseMs: 1_000,
      heartbeatInterval: 100,
    },
    async fetch() {
      await incrementUsage(redis, workspace, user, 30, 10)
      throw new Error("provider unavailable")
    },
  })

  expect(response.status).toBe(500)
  expect(redis.leases.size).toBe(0)
  expect(redis.values.get(workspace)).toBe(0)
  expect(redis.values.get(user)).toBe(0)
  const reservation = await testDatabase()
    .select()
    .from(UsageReservationTable)
    .then((rows) => rows[0])
  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  const member = await testDatabase()
    .select()
    .from(UserTable)
    .then((rows) => rows[0])
  expect(billing.monthlyUsage).toBe(reservation.amount + 30)
  expect(member.monthlyUsage).toBe(reservation.amount + 10)
  const next = await acquireUsageCutover(workspaceID, {
    redis,
    stage: "test",
    owner: "handler_retry",
    graceMs: 1_000,
    leaseMs: 1_000,
  })
  expect(next?.phase).toBe("grace")
  expect(await releaseUsageCutover(next!)).toBe(true)
})

test("canceled handler retries rejected finalization and rejects waitUntil while remaining recoverable", async () => {
  await seedZen()
  const encoder = new TextEncoder()
  const lifetimes: Promise<void>[] = []
  let release = () => {}
  const response = await zenRequest({
    leaseSeconds: 60,
    heartbeatInterval: 10,
    drainTimeout: 1_000,
    waitUntil(promise) {
      lifetimes.push(promise)
    },
    async fetch() {
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'))
            release = () =>
              controller.enqueue(
                encoder.encode('data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n'),
              )
          },
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      )
    },
  })
  const reader = response.body!.getReader()
  await reader.read()
  await reader.cancel("client disconnected")
  await testDatabase().execute(
    sql.raw(`
      CREATE TRIGGER fail_usage_insert BEFORE INSERT ON \`usage\`
      FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced usage insert failure'
    `),
  )
  const observed = lifetimes.map((promise) =>
    promise.then(
      () => undefined,
      (error) => error,
    ),
  )
  const start = Date.now()
  release()
  const results = await Promise.all(observed)

  const failures = results.filter((result): result is Error => result instanceof Error)
  const pending = await testDatabase()
    .select()
    .from(UsageReservationTable)
    .then((rows) => rows[0])
  const billing = await testDatabase()
    .select()
    .from(BillingTable)
    .then((rows) => rows[0])
  expect(failures).toHaveLength(1)
  expect(failures[0].message).toContain("Failed query")
  expect(Date.now() - start).toBeGreaterThanOrEqual(250)
  expect(pending.status).toBe("pending")
  expect(pending.timeLeaseExpires!.getTime()).toBeGreaterThan(Date.now())
  expect(await testDatabase().select().from(UsageTable)).toHaveLength(0)
  expect(billing.balance).toBe(1_000_000_000 - pending.amount)

  await testDatabase().execute(sql.raw("DROP TRIGGER fail_usage_insert"))
  await testDatabase()
    .update(UsageReservationTable)
    .set({ timeLeaseExpires: new Date(Date.now() - 1_000) })
    .where(eq(UsageReservationTable.id, pending.id))
  expect(await useTestDatabase(() => recoverUsage({ workspaceID, before: new Date(), now: new Date() }))).toEqual({
    released: 0,
    settled: 1,
  })
  expect(
    await testDatabase()
      .select()
      .from(UsageTable)
      .then((rows) => rows[0]),
  ).toMatchObject({
    cost: pending.amount,
    enrichment: { estimated: true, unknown: true },
  })
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
