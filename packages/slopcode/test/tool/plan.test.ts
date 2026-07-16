import { expect } from "bun:test"
import { LayerNode } from "@slopcode-ai/core/effect/layer-node"
import { PermissionV1 } from "@slopcode-ai/core/v1/permission"
import { SessionV1 } from "@slopcode-ai/core/v1/session"
import { Database } from "@slopcode-ai/core/database/database"
import { SessionTable } from "@slopcode-ai/core/session/sql"
import { Deferred, Effect, Exit, Fiber, Result, Schema } from "effect"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { ModelV2 } from "@slopcode-ai/core/model"
import { Agent } from "@/agent/agent"
import { Config } from "@/config/config"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { InstanceState } from "@/effect/instance-state"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Permission } from "@/permission"
import { Question } from "@/question"
import { MessageID, SessionID } from "@/session/schema"
import { Session } from "@/session/session"
import { ToolRegistry } from "@/tool/registry"
import type { Tool } from "@/tool/tool"
import { TestConfig } from "../fixture/config"
import { testEffect } from "../lib/effect"

const root = LayerNode.group([
  ToolRegistry.node,
  Agent.node,
  Session.node,
  Permission.node,
  Question.node,
  Database.node,
  EventV2Bridge.node,
])
const decodeMessage = Schema.decodeUnknownSync(SessionV1.Event.MessageUpdated.data)
const decodeAsked = Schema.decodeUnknownSync(Permission.Event.Asked.data)
const decodeReply = Schema.decodeUnknownSync(Permission.Event.Replied.data)
const it = testEffect(
  LayerNode.buildLayer(root, {
    replacements: [
      LayerNode.replace(
        Config.node,
        TestConfig.layer({
          directories: () => InstanceState.directory.pipe(Effect.map((directory) => [directory + "/.slopcode"])),
        }),
      ),
      LayerNode.replace(RuntimeFlags.node, RuntimeFlags.layer({ experimentalPlanMode: true, client: "cli" })),
    ],
  }),
)

function context(sessionID: SessionID, agent = "plan"): Tool.Context {
  return {
    sessionID,
    messageID: MessageID.make("msg_plan_tool"),
    callID: "call_plan_tool",
    agent,
    abort: new AbortController().signal,
    messages: [],
    metadata: () => Effect.void,
    ask: () => Effect.void,
  }
}

const wait = Effect.fn("PlanTest.wait")(function* <A>(read: Effect.Effect<ReadonlyArray<A>>) {
  return yield* Effect.gen(function* () {
    for (;;) {
      const items = yield* read
      if (items.length) return items
      yield* Effect.yieldNow
    }
  }).pipe(Effect.timeout("2 seconds"))
})

it.instance("exposes a bounded exact plan-only forecast tool", () =>
  Effect.gen(function* () {
    const registry = yield* ToolRegistry.Service
    const tool = (yield* registry.all()).find((item) => item.id === "plan_permissions")
    if (!tool) throw new Error("plan_permissions tool not found")

    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(tool.parameters)({
          permissions: [{ action: "*", resources: ["git status"], reason: "Too broad" }],
        }),
      ),
    ).toBe(true)
    expect(Result.isSuccess(Schema.decodeUnknownResult(tool.parameters)({ permissions: [] }))).toBe(true)
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(tool.parameters)({
          permissions: [
            { action: "bash", resources: ["git *", "file?.txt", "[abc]"], reason: "Literal metacharacters" },
          ],
        }),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(tool.parameters)({
          permissions: [
            {
              action: "bash",
              resources: Array.from({ length: 17 }, (_, index) => `git status ${index}`),
              reason: "Too many resources",
            },
          ],
        }),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(tool.parameters)({
          permissions: [{ action: "bash", resources: ["git status"], reason: "x".repeat(281) }],
        }),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(tool.parameters)({
          permissions: Array.from({ length: 17 }, (_, index) => ({
            action: "bash",
            resources: [`git status ${index}`],
            reason: "Inspect repository state",
          })),
        }),
      ),
    ).toBe(true)

    const session = yield* (yield* Session.Service).create({ title: "Plan" })
    expect(
      Exit.isFailure(
        yield* tool
          .execute(
            {
              permissions: [{ action: "doom_loop", resources: ["bash"], reason: "Continue repeated checks" }],
            },
            context(session.id, "build"),
          )
          .pipe(Effect.exit),
      ),
    ).toBe(true)
  }),
)

it.instance("an empty plan permission forecast clears the previous session forecast", () =>
  Effect.gen(function* () {
    const registry = yield* ToolRegistry.Service
    const tool = (yield* registry.all()).find((item) => item.id === "plan_permissions")
    if (!tool) throw new Error("plan_permissions tool not found")
    const permissions = yield* Permission.Service
    const session = yield* (yield* Session.Service).create({ title: "Plan" })
    yield* (yield* Database.Service).db
      .insert(SessionTable)
      .values(Session.toRow(session))
      .onConflictDoNothing()
      .run()
      .pipe(Effect.orDie)

    yield* tool.execute(
      { permissions: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }] },
      context(session.id),
    )
    const result = yield* tool.execute({ permissions: [] }, context(session.id))

    expect(result.metadata).toMatchObject({ permissions: [] })
    expect(
      yield* permissions.review({
        sessionID: session.id,
        policy: () => Effect.succeed([{ permission: "bash", pattern: "*", action: "ask" }]),
      }),
    ).toBe(false)
    expect(yield* permissions.list()).toEqual([])
  }),
)

it.instance("plan exit reviews and skips every forecast before switching to build", () =>
  Effect.gen(function* () {
    const registry = yield* ToolRegistry.Service
    const tools = yield* registry.all()
    const forecast = tools.find((item) => item.id === "plan_permissions")
    const exit = tools.find((item) => item.id === "plan_exit")
    if (!forecast || !exit) throw new Error("plan tools not found")
    const sessions = yield* Session.Service
    const questions = yield* Question.Service
    const permissions = yield* Permission.Service
    const bridge = yield* EventV2Bridge.Service
    const updates: Array<{ role: string; agent?: string }> = []
    const terminal = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const unsubscribe = yield* bridge.listen((event) =>
      Effect.gen(function* () {
        if (event.type === Permission.Event.Replied.type && decodeReply(event.data).sessionID === session.id) {
          yield* Deferred.succeed(terminal, undefined)
          yield* Deferred.await(release)
        }
        if (event.type === SessionV1.Event.MessageUpdated.type) {
          const info = decodeMessage(event.data).info
          updates.push({ role: info.role, agent: info.agent })
        }
      }),
    )
    yield* Effect.addFinalizer(() => unsubscribe)
    const session = yield* sessions.create({ title: "Plan" })
    yield* (yield* Database.Service).db
      .insert(SessionTable)
      .values(Session.toRow(session))
      .onConflictDoNothing()
      .run()
      .pipe(Effect.orDie)
    yield* sessions.updateMessage({
      id: MessageID.make("msg_plan_user"),
      sessionID: session.id,
      role: "user",
      time: { created: Date.now() },
      agent: "plan",
      model: { providerID: ProviderV2.ID.make("test"), modelID: ModelV2.ID.make("test") },
    })

    yield* forecast.execute(
      {
        permissions: [{ action: "doom_loop", resources: ["bash"], reason: "Continue repeated checks" }],
      },
      context(session.id),
    )
    const fiber = yield* exit.execute({}, context(session.id)).pipe(Effect.forkScoped)
    const question = (yield* wait(questions.list()))[0]
    yield* questions.reply({ requestID: question.id, answers: [["Yes"]] })

    const batch = yield* wait(permissions.list())
    expect(batch).toHaveLength(1)
    expect(batch[0]).toMatchObject({ kind: "forecast", reason: "Continue repeated checks" })
    const response = yield* permissions
      .replyBatch({ batchID: batch[0].batchID!, requestIDs: [], reply: "reject" })
      .pipe(Effect.forkScoped)
    yield* Deferred.await(terminal)

    const result = yield* Fiber.join(fiber).pipe(Effect.timeout("500 millis"))
    expect(result.title).toBe("Switching to build agent")
    expect(updates.at(-1)).toMatchObject({ role: "user", agent: "build" })
    expect(yield* permissions.list()).toEqual([])
    yield* Deferred.succeed(release, undefined)
    yield* Fiber.join(response)
  }),
)

it.instance("skipping a forecast never rejects the plan transition", () =>
  Effect.gen(function* () {
    const permission = yield* Permission.Service
    const session = (yield* (yield* Session.Service).create({ title: "Plan" })).id
    yield* permission.forecast({
      sessionID: session,
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }],
    })
    const review = yield* permission
      .review({
        sessionID: session,
        policy: () => Effect.succeed([{ permission: "bash", pattern: "*", action: "ask" }]),
      })
      .pipe(Effect.forkScoped)
    const batch = yield* wait(permission.list())
    yield* permission.replyBatch({ batchID: batch[0].batchID!, requestIDs: [], reply: "reject" })
    expect(yield* Fiber.join(review)).toBe(true)
  }),
)

it.instance(
  "plan exit remains pending after persistence failure and completes after retry",
  () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const tools = yield* registry.all()
      const forecast = tools.find((item) => item.id === "plan_permissions")
      const exit = tools.find((item) => item.id === "plan_exit")
      if (!forecast || !exit) throw new Error("plan tools not found")
      const sessions = yield* Session.Service
      const questions = yield* Question.Service
      const permissions = yield* Permission.Service
      const database = yield* Database.Service
      const session = yield* sessions.create({ title: "Retry plan" })
      yield* database.db
        .insert(SessionTable)
        .values(Session.toRow(session))
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
      yield* sessions.updateMessage({
        id: MessageID.make("msg_plan_retry_user"),
        sessionID: session.id,
        role: "user",
        time: { created: Date.now() },
        agent: "plan",
        model: { providerID: ProviderV2.ID.make("test"), modelID: ModelV2.ID.make("test") },
      })
      yield* forecast.execute(
        { permissions: [{ action: "doom_loop", resources: ["bash"], reason: "Continue checks" }] },
        context(session.id),
      )
      const transition = yield* exit.execute({}, context(session.id)).pipe(Effect.forkScoped)
      const question = (yield* wait(questions.list()))[0]
      yield* questions.reply({ requestID: question.id, answers: [["Yes"]] })
      const batch = yield* wait(permissions.list())
      yield* database.db
        .run(
          "CREATE TRIGGER fail_plan_forecast_insert BEFORE INSERT ON permission WHEN NEW.action = 'doom_loop' BEGIN SELECT RAISE(FAIL, 'forced plan persistence failure'); END",
        )
        .pipe(Effect.orDie)

      expect(
        Exit.isFailure(
          yield* permissions
            .replyBatch({ batchID: batch[0].batchID!, requestIDs: [batch[0].id], reply: "always" })
            .pipe(Effect.exit),
        ),
      ).toBe(true)
      expect(yield* permissions.list()).toHaveLength(1)

      yield* database.db.run("DROP TRIGGER fail_plan_forecast_insert").pipe(Effect.orDie)
      yield* permissions.replyBatch({ batchID: batch[0].batchID!, requestIDs: [batch[0].id], reply: "always" })
      expect((yield* Fiber.join(transition)).title).toBe("Switching to build agent")
      expect(yield* permissions.list()).toEqual([])
    }),
  { git: true },
)

it.instance("concurrent plan exits join an active review before one build transition", () =>
  Effect.gen(function* () {
    const registry = yield* ToolRegistry.Service
    const tools = yield* registry.all()
    const forecast = tools.find((item) => item.id === "plan_permissions")
    const exit = tools.find((item) => item.id === "plan_exit")
    if (!forecast || !exit) throw new Error("plan tools not found")
    const sessions = yield* Session.Service
    const questions = yield* Question.Service
    const permissions = yield* Permission.Service
    const session = yield* sessions.create({ title: "Concurrent plan exit" })
    const publishing = yield* Deferred.make<PermissionV1.Request>()
    const release = yield* Deferred.make<void>()
    const builds: MessageID[] = []
    const unsubscribe = yield* (yield* EventV2Bridge.Service).listen((event) => {
      if (event.type === Permission.Event.Asked.type && decodeAsked(event.data).sessionID === session.id) {
        const request = decodeAsked(event.data)
        return Deferred.succeed(publishing, request).pipe(Effect.andThen(Deferred.await(release)))
      }
      if (event.type === SessionV1.Event.MessageUpdated.type) {
        const info = decodeMessage(event.data).info
        if (info.role === "user" && info.agent === "build") builds.push(info.id)
      }
      return Effect.void
    })
    yield* Effect.addFinalizer(() => unsubscribe)
    yield* (yield* Database.Service).db
      .insert(SessionTable)
      .values(Session.toRow(session))
      .onConflictDoNothing()
      .run()
      .pipe(Effect.orDie)
    yield* sessions.updateMessage({
      id: MessageID.make("msg_plan_concurrent_user"),
      sessionID: session.id,
      role: "user",
      time: { created: Date.now() },
      agent: "plan",
      model: { providerID: ProviderV2.ID.make("test"), modelID: ModelV2.ID.make("test") },
    })
    yield* forecast.execute(
      { permissions: [{ action: "doom_loop", resources: ["bash"], reason: "Continue checks" }] },
      context(session.id),
    )

    const review = yield* permissions
      .review({
        sessionID: session.id,
        policy: () => Effect.succeed([{ permission: "doom_loop", pattern: "*", action: "ask" }]),
      })
      .pipe(Effect.forkScoped)
    const batch = [yield* Deferred.await(publishing)]
    const first = yield* exit.execute({}, context(session.id)).pipe(Effect.forkScoped)
    const second = yield* exit.execute({}, context(session.id)).pipe(Effect.forkScoped)
    yield* wait(questions.list())
    expect(yield* questions.list()).toHaveLength(1)
    const question = (yield* questions.list())[0]
    yield* questions.reply({ requestID: question.id, answers: [["Yes"]] })
    expect(batch).toHaveLength(1)
    expect(builds).toHaveLength(0)
    const response = yield* permissions
      .replyBatch({ batchID: batch[0].batchID!, requestIDs: [], reply: "reject" })
      .pipe(Effect.forkScoped)
    yield* Deferred.succeed(release, undefined)
    yield* Fiber.join(response)

    expect(yield* Fiber.join(review)).toBe(true)
    expect((yield* Fiber.join(first)).title).toBe("Switching to build agent")
    expect((yield* Fiber.join(second)).title).toBe("Switching to build agent")
    expect(builds).toHaveLength(1)
  }),
)
