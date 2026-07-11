import { describe, expect, test } from "bun:test"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { EventTable } from "@slopcode-ai/core/event/sql"
import { Location } from "@slopcode-ai/core/location"
import { ModelV2 } from "@slopcode-ai/core/model"
import { PermissionV2 } from "@slopcode-ai/core/permission"
import { PluginBoot } from "@slopcode-ai/core/plugin/boot"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionEvent } from "@slopcode-ai/core/session/event"
import { SessionInput } from "@slopcode-ai/core/session/input"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionProjector } from "@slopcode-ai/core/session/projector"
import { SessionSchema } from "@slopcode-ai/core/session/schema"
import { SessionInputTable, SessionTable } from "@slopcode-ai/core/session/sql"
import { SessionStore } from "@slopcode-ai/core/session/store"
import { SessionTask } from "@slopcode-ai/core/session/task"
import { ApplicationTools } from "@slopcode-ai/core/tool/application-tools"
import { TaskTool } from "@slopcode-ai/core/tool/task"
import { ToolOutputStore } from "@slopcode-ai/core/tool-output-store"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { and, eq } from "drizzle-orm"
import { DateTime, Deferred, Effect, Fiber, Layer, Schema } from "effect"
import { testEffect } from "./lib/effect"

const agent = (id: string, mode: "subagent" | "primary" | "all" = "subagent", hidden = false) =>
  new AgentV2.Info({
    id: AgentV2.ID.make(id),
    request: { headers: {}, body: {} },
    mode,
    hidden,
    permissions: [],
    description: `${id} agent`,
  })

describe("TaskTool catalog", () => {
  test("sorts callable agents and filters hidden, primary, and denied entries", () => {
    const rules: PermissionV2.Ruleset = [{ action: "task", resource: "denied", effect: "deny" }]
    const description = TaskTool.describe(
      [
        agent("zeta"),
        agent("primary", "primary"),
        agent("denied"),
        agent("alpha", "all"),
        agent("hidden", "all", true),
      ],
      rules,
    )
    expect(description).toContain("alpha: alpha agent")
    expect(description).toContain("zeta: zeta agent")
    expect(description.indexOf("alpha:")).toBeLessThan(description.indexOf("zeta:"))
    expect(description).not.toContain("denied:")
    expect(description).not.toContain("hidden:")
    expect(description).not.toContain("primary:")
  })

  test("does not accept the legacy background input", () => {
    expect(TaskTool.validateInput({ background: true })).toContain("not supported")
  })
})

const location = Location.Ref.make({ directory: AbsolutePath.make("/project") })
const parentID = SessionSchema.ID.make("ses_task_parent")
const messageID = SessionMessage.ID.make("msg_task_parent")
const inherited = ModelV2.Ref.make({
  providerID: ProviderV2.ID.make("parent-provider"),
  id: ModelV2.ID.make("parent-model"),
  variant: ModelV2.VariantID.make("parent-variant"),
})
const override = ModelV2.Ref.make({
  providerID: ProviderV2.ID.make("agent-provider"),
  id: ModelV2.ID.make("agent-model"),
  variant: ModelV2.VariantID.make("agent-variant"),
})

function integration() {
  const database = Database.layerFromPath(":memory:")
  const events = EventV2.layer.pipe(Layer.provide(database))
  const projector = SessionProjector.layer.pipe(Layer.provide(database), Layer.provide(events))
  const store = SessionStore.layer.pipe(Layer.provide(database))
  const build = new AgentV2.Info({
    id: AgentV2.ID.make("build"),
    request: { headers: {}, body: {} },
    mode: "primary",
    hidden: false,
    permissions: [
      { action: "*", resource: "*", effect: "allow" },
      { action: "external_directory", resource: "*", effect: "ask" },
      { action: "edit", resource: "secret", effect: "deny" },
    ],
  })
  const general = agent("general")
  const modeled = new AgentV2.Info({ ...agent("modeled"), model: override })
  const catalog = [build, general, modeled, agent("primary", "primary"), agent("hidden", "all", true)]
  const agents = Layer.mock(AgentV2.Service, {
    all: () => Effect.succeed(catalog),
    get: (id) => Effect.succeed(catalog.find((item) => item.id === id)),
    resolve: (id) => Effect.succeed(catalog.find((item) => item.id === id)),
    select: (id) => {
      const info = catalog.find((item) => item.id === id)
      return Effect.succeed({ id: info?.id ?? build.id, info })
    },
  })
  const assertions: PermissionV2.AssertInput[] = []
  let denied = false
  let gate: Deferred.Deferred<void> | undefined
  const permissions = Layer.mock(PermissionV2.Service, {
    assert: (input) =>
      Effect.sync(() => assertions.push(input)).pipe(
        Effect.andThen(gate ? Deferred.await(gate) : Effect.void),
        Effect.andThen(denied ? Effect.fail(new PermissionV2.DeniedError({ rules: [] })) : Effect.void),
      ),
  })
  const boot = Layer.mock(PluginBoot.Service, { wait: () => Effect.void })
  const projects = Layer.mock(ProjectV2.Service, {
    resolve: (directory) => Effect.succeed({ id: ProjectV2.ID.global, directory }),
  })
  const output = Layer.mock(ToolOutputStore.Service, {
    bound: (input) => Effect.succeed({ output: input.output, outputPaths: [] }),
  })
  const registry = ToolRegistry.layer.pipe(Layer.provide(ApplicationTools.layer), Layer.provide(output))
  const locationLayer = Location.layer(location).pipe(Layer.provide(projects))
  const tool = TaskTool.layer.pipe(
    Layer.provide(registry),
    Layer.provide(database),
    Layer.provide(events),
    Layer.provide(projects),
    Layer.provide(store),
    Layer.provide(agents),
    Layer.provide(permissions),
    Layer.provide(boot),
    Layer.provide(locationLayer),
  )
  const layer = Layer.mergeAll(
    database,
    events,
    projector,
    store,
    agents,
    permissions,
    boot,
    projects,
    output,
    registry,
    locationLayer,
    tool,
  )
  return {
    it: testEffect(layer),
    assertions,
    deny(value: boolean) {
      denied = value
    },
    ask(value: Deferred.Deferred<void> | undefined) {
      gate = value
    },
  }
}

const fixture = integration()

const seed = Effect.gen(function* () {
  const db = (yield* Database.Service).db
  const events = yield* EventV2.Service
  yield* db
    .insert(ProjectTable)
    .values({ id: ProjectV2.ID.global, worktree: location.directory, sandboxes: [] })
    .onConflictDoNothing()
    .run()
    .pipe(Effect.orDie)
  yield* db
    .insert(SessionTable)
    .values({
      id: parentID,
      project_id: ProjectV2.ID.global,
      slug: parentID,
      directory: location.directory,
      title: "Parent",
      version: "test",
      runtime: "v2",
      agent: "build",
      model: inherited,
    })
    .onConflictDoNothing()
    .run()
    .pipe(Effect.orDie)
  if (!(yield* db.select().from(EventTable).where(eq(EventTable.aggregate_id, parentID)).get().pipe(Effect.orDie)))
    yield* events.publish(SessionEvent.Step.Started, {
      sessionID: parentID,
      timestamp: yield* DateTime.now,
      assistantMessageID: messageID,
      agent: "build",
      model: inherited,
    })
})

const complete = (runs: string[]) =>
  Effect.gen(function* () {
    const db = (yield* Database.Service).db
    const events = yield* EventV2.Service
    yield* events.listen((event) => {
      if (!Schema.is(SessionEvent.Task.Execute)(event)) return Effect.void
      return Effect.gen(function* () {
        runs.push(event.data.callID)
        yield* SessionInput.promoteSteers(
          db,
          events,
          event.data.childSessionID,
          yield* SessionInput.latestSeq(db, event.data.childSessionID),
        )
        const promptID = SessionTask.promptID(event.data.sessionID, event.data.assistantMessageID, event.data.callID)
        const input = yield* SessionInput.find(db, promptID)
        const assistant = SessionMessage.ID.make(`msg_child_${event.data.callID.replaceAll("/", "_")}_${runs.length}`)
        const row = yield* db
          .select({ model: SessionTable.model, agent: SessionTable.agent })
          .from(SessionTable)
          .where(eq(SessionTable.id, event.data.childSessionID))
          .get()
          .pipe(Effect.orDie)
        const model = row!.model!
        yield* events.publish(SessionEvent.Step.Started, {
          sessionID: event.data.childSessionID,
          timestamp: yield* DateTime.now,
          assistantMessageID: assistant,
          agent: row!.agent!,
          model: ModelV2.Ref.make({
            providerID: ProviderV2.ID.make(model.providerID),
            id: ModelV2.ID.make(model.id),
            variant: ModelV2.VariantID.make(model.variant ?? "default"),
          }),
        })
        if (input?.prompt.text === "error") {
          yield* events.publish(SessionEvent.Step.Failed, {
            sessionID: event.data.childSessionID,
            timestamp: yield* DateTime.now,
            assistantMessageID: assistant,
            error: { type: "unknown", message: "child failed" },
          })
          return
        }
        if (input?.prompt.text !== "empty") {
          yield* events.publish(SessionEvent.Text.Started, {
            sessionID: event.data.childSessionID,
            timestamp: yield* DateTime.now,
            assistantMessageID: assistant,
            textID: "text",
          })
          yield* events.publish(SessionEvent.Text.Ended, {
            sessionID: event.data.childSessionID,
            timestamp: yield* DateTime.now,
            assistantMessageID: assistant,
            textID: "text",
            text: `result:${input?.prompt.text}`,
          })
        }
        yield* events.publish(SessionEvent.Step.Ended, {
          sessionID: event.data.childSessionID,
          timestamp: yield* DateTime.now,
          assistantMessageID: assistant,
          finish: "stop",
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        })
      })
    })
  })

const settle = (callID: string, input: Record<string, unknown>, plan: ToolRegistry.ToolPlan = {}) =>
  Effect.gen(function* () {
    const materialized = yield* (yield* ToolRegistry.Service).materialize([], plan)
    return yield* materialized.settle({
      sessionID: parentID,
      agent: AgentV2.ID.make("build"),
      assistantMessageID: messageID,
      call: { type: "tool-call", id: callID, name: "task", input },
    })
  })

const settleWith = (
  callID: string,
  input: Record<string, unknown>,
  permissions: PermissionV2.Ruleset,
  plan: ToolRegistry.ToolPlan = {},
) =>
  Effect.gen(function* () {
    const materialized = yield* (yield* ToolRegistry.Service).materialize(permissions, plan)
    return yield* materialized.settle({
      sessionID: parentID,
      agent: AgentV2.ID.make("build"),
      assistantMessageID: messageID,
      call: { type: "tool-call", id: callID, name: "task", input },
    })
  })

describe("TaskTool durable orchestration", () => {
  fixture.it.effect(
    "creates a linked child with inherited model, ceiling, progress, version, and deterministic admission",
    () =>
      Effect.gen(function* () {
        yield* seed
        const runs: string[] = []
        yield* complete(runs)
        const input = { description: "Inspect code", prompt: "inspect", subagent_type: "general", command: "/inspect" }
        const result = yield* settle("call-create", input, { multiAgent: "v1" })
        const taskID = SessionTask.childID(parentID, messageID, "call-create")
        expect(result.result).toEqual({
          type: "text",
          value: `<task id="${taskID}" state="completed">\n<task_result>\nresult:inspect\n</task_result>\n</task>`,
        })
        const db = (yield* Database.Service).db
        expect(
          yield* db.select().from(SessionTable).where(eq(SessionTable.id, taskID)).get().pipe(Effect.orDie),
        ).toMatchObject({
          parent_id: parentID,
          title: "Inspect code (@general subagent)",
          directory: location.directory,
          runtime: "v2",
          agent: "general",
          model: inherited,
        })
        expect((yield* (yield* SessionStore.Service).task(taskID))?.ceiling).toEqual(
          expect.arrayContaining([
            { action: "external_directory", resource: "*", effect: "ask" },
            { action: "edit", resource: "secret", effect: "deny" },
            { action: "task", resource: "*", effect: "deny" },
            { action: "todowrite", resource: "*", effect: "deny" },
          ]),
        )
        expect(yield* SessionTask.request(db, parentID, messageID, "call-create")).toMatchObject({
          childSessionID: taskID,
          model: inherited,
          command: "/inspect",
          multiAgent: "v1",
        })
        expect(
          yield* db
            .select()
            .from(EventTable)
            .where(
              and(eq(EventTable.aggregate_id, parentID), eq(EventTable.type, `${SessionEvent.Tool.Progress.type}.1`)),
            )
            .all()
            .pipe(Effect.orDie),
        ).toHaveLength(1)
        expect(runs).toEqual(["call-create"])
        expect((yield* settle("call-create", input, { multiAgent: "v1" })).result.type).toBe("text")
        expect(runs).toEqual(["call-create"])
        expect(
          yield* db
            .select()
            .from(SessionInputTable)
            .where(eq(SessionInputTable.id, SessionTask.promptID(parentID, messageID, "call-create")))
            .all()
            .pipe(Effect.orDie),
        ).toHaveLength(1)
      }),
  )

  fixture.it.effect("uses agent model overrides and resumes a compatible child with valid empty output", () =>
    Effect.gen(function* () {
      yield* seed
      const runs: string[] = []
      yield* complete(runs)
      yield* settle("call-modeled", { description: "Modeled", prompt: "first", subagent_type: "modeled" })
      const taskID = SessionTask.childID(parentID, messageID, "call-modeled")
      expect(
        yield* (yield* Database.Service).db
          .select({ model: SessionTable.model })
          .from(SessionTable)
          .where(eq(SessionTable.id, taskID))
          .get()
          .pipe(Effect.orDie),
      ).toEqual({ model: override })
      expect(
        (yield* settle("call-resume", {
          description: "Continue",
          prompt: "empty",
          subagent_type: "modeled",
          task_id: taskID,
        })).result,
      ).toEqual({
        type: "text",
        value: `<task id="${taskID}" state="completed">\n<task_result>\n\n</task_result>\n</task>`,
      })
      expect(runs).toEqual(["call-modeled", "call-resume"])
    }),
  )

  fixture.it.effect("rejects unavailable agents, arbitrary resume, denial, and child errors with source metadata", () =>
    Effect.gen(function* () {
      yield* seed
      yield* complete([])
      expect(
        (yield* settle("call-primary", { description: "Bad", prompt: "x", subagent_type: "primary" })).result,
      ).toMatchObject({
        type: "error",
        value: expect.stringContaining("Callable agents"),
      })
      expect(
        (yield* settle("call-arbitrary", {
          description: "Bad resume",
          prompt: "x",
          subagent_type: "general",
          task_id: parentID,
        })).result,
      ).toMatchObject({ type: "error", value: expect.stringContaining("resume conflict") })
      fixture.deny(true)
      expect(
        (yield* settle("call-denied", { description: "Denied", prompt: "x", subagent_type: "general" })).result.type,
      ).toBe("error")
      fixture.deny(false)
      expect(
        (yield* settle("call-error", { description: "Error", prompt: "error", subagent_type: "general" })).result,
      ).toEqual({
        type: "error",
        value: "child failed",
      })
      expect(fixture.assertions.at(-1)).toMatchObject({
        action: "task",
        resources: ["general"],
        metadata: { description: "Error", agent: "general" },
        source: { type: "tool", messageID, callID: "call-error" },
      })
    }),
  )

  fixture.it.effect("uses the materialized permission snapshot for unavailable-agent diagnostics", () =>
    Effect.gen(function* () {
      yield* seed
      const result = yield* settleWith("call-filtered", { description: "Bad", prompt: "x", subagent_type: "missing" }, [
        { action: "task", resource: "modeled", effect: "deny" },
      ])
      expect(result.result).toEqual({
        type: "error",
        value: "Agent missing is unavailable. Callable agents: general",
      })
    }),
  )

  fixture.it.effect("preserves permission ask and durably cascades interruption", () =>
    Effect.gen(function* () {
      yield* seed
      const gate = yield* Deferred.make<void>()
      fixture.ask(gate)
      const pending = yield* settle("call-ask", { description: "Ask", prompt: "wait", subagent_type: "general" }).pipe(
        Effect.forkChild,
      )
      yield* Effect.yieldNow
      expect(yield* Deferred.isDone(gate)).toBeFalse()
      const executing = yield* Deferred.make<void>()
      const interrupted = yield* Deferred.make<void>()
      yield* (yield* EventV2.Service).listen((event) => {
        if (Schema.is(SessionEvent.Task.Execute)(event))
          return Deferred.succeed(executing, undefined).pipe(Effect.andThen(Effect.never))
        if (Schema.is(SessionEvent.Task.Interrupt)(event)) return Deferred.succeed(interrupted, undefined)
        return Effect.void
      })
      yield* Deferred.succeed(gate, undefined)
      fixture.ask(undefined)
      yield* Deferred.await(executing)
      yield* Fiber.interrupt(pending)
      expect(yield* Deferred.isDone(interrupted)).toBeTrue()
      expect(yield* SessionTask.interrupted((yield* Database.Service).db, parentID, messageID, "call-ask")).toBeTrue()
    }),
  )

  fixture.it.effect("executes independent nested CodeMode children in parallel", () =>
    Effect.gen(function* () {
      yield* seed
      const runs: string[] = []
      yield* complete(runs)
      const materialized = yield* (yield* ToolRegistry.Service).materialize([], { mode: "code-only", multiAgent: "v2" })
      expect(materialized.definitions[0]?.description).toContain("task (1 tool")
      const result = yield* materialized.settle({
        sessionID: parentID,
        agent: AgentV2.ID.make("build"),
        assistantMessageID: messageID,
        call: {
          type: "tool-call",
          toolType: "custom",
          id: "call-code",
          name: "exec",
          input:
            'return await Promise.all([tools.task({description:"A",prompt:"a",subagent_type:"general"}),tools.task({description:"B",prompt:"b",subagent_type:"general"})])',
        },
      })
      expect(result.output?.structured).toMatchObject({ ok: true })
      expect(runs.toSorted()).toEqual(["call-code/0", "call-code/1"])
    }),
  )
})
