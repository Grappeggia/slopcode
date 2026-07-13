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
import { Prompt } from "@slopcode-ai/core/session/prompt"
import { SessionProjector } from "@slopcode-ai/core/session/projector"
import { SessionSchema } from "@slopcode-ai/core/session/schema"
import { SessionInputTable, SessionTable } from "@slopcode-ai/core/session/sql"
import { SessionStore } from "@slopcode-ai/core/session/store"
import { SessionTask } from "@slopcode-ai/core/session/task"
import { ApplicationTools } from "@slopcode-ai/core/tool/application-tools"
import { TaskTool } from "@slopcode-ai/core/tool/task"
import { ToolOutputStore } from "@slopcode-ai/core/tool-output-store"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { Tool } from "@slopcode-ai/core/tool/tool"
import { and, eq } from "drizzle-orm"
import { DateTime, Deferred, Effect, Exit, Fiber, Layer, Schema, Scope } from "effect"
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
  const general = new AgentV2.Info({
    ...agent("general"),
    permissions: [{ action: "*", resource: "*", effect: "allow" }],
  })
  const modeled = new AgentV2.Info({
    ...agent("modeled"),
    model: override,
    permissions: [
      { action: "task", resource: "*", effect: "allow" },
      { action: "todowrite", resource: "*", effect: "allow" },
    ],
  })
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
  let bounded = false
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
    bound: (input) =>
      Effect.succeed({
        output: bounded ? { ...input.output, content: [{ type: "text", text: "bounded-task-output" }] } : input.output,
        outputPaths: [],
      }),
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
    bound(value: boolean) {
      bounded = value
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
        const result = yield* settleWith(
          "call-create",
          input,
          [
            { action: "external_directory", resource: "/outside/*", effect: "deny" },
            { action: "edit", resource: "snapshot-secret", effect: "deny" },
            { action: "read", resource: "*", effect: "allow" },
          ],
          { multiAgent: "v1" },
        )
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
            { action: "external_directory", resource: "/outside/*", effect: "deny" },
            { action: "edit", resource: "snapshot-secret", effect: "deny" },
            { action: "task", resource: "*", effect: "deny" },
            { action: "todowrite", resource: "*", effect: "deny" },
          ]),
        )
        expect((yield* (yield* SessionStore.Service).task(taskID))?.ceiling).not.toContainEqual({
          action: "read",
          resource: "*",
          effect: "allow",
        })
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
        expect(
          (yield* settleWith(
            "call-create",
            input,
            [
              { action: "external_directory", resource: "/outside/*", effect: "deny" },
              { action: "edit", resource: "snapshot-secret", effect: "deny" },
              { action: "read", resource: "*", effect: "allow" },
            ],
            { multiAgent: "v1" },
          )).result.type,
        ).toBe("text")
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

  fixture.it.effect("rejects an incompatible row occupying the deterministic child ID without prompting it", () =>
    Effect.gen(function* () {
      yield* seed
      const db = (yield* Database.Service).db
      const taskID = SessionTask.childID(parentID, messageID, "call-collision")
      yield* db
        .insert(SessionTable)
        .values({
          id: taskID,
          project_id: ProjectV2.ID.global,
          slug: taskID,
          directory: location.directory,
          title: "Unowned collision",
          version: "test",
          runtime: "v2",
          parent_id: parentID,
          agent: "general",
          model: inherited,
          metadata: { task: { version: 1, damaged: true } },
        })
        .run()
        .pipe(Effect.orDie)

      expect(
        (yield* settle("call-collision", { description: "Collision", prompt: "never", subagent_type: "general" }))
          .result,
      ).toMatchObject({ type: "error", value: expect.stringContaining("conflict") })
      expect(yield* SessionInput.find(db, SessionTask.promptID(parentID, messageID, "call-collision"))).toBeUndefined()
      expect(yield* SessionTask.orphaned(db, taskID)).toBeTrue()
    }),
  )

  fixture.it.effect("rejects schema-valid task metadata without its canonical origin request", () =>
    Effect.gen(function* () {
      yield* seed
      yield* complete([])
      const db = (yield* Database.Service).db
      const originMessage = SessionMessage.ID.make("msg_fabricated_origin")
      const originCall = "call-fabricated-origin"
      const taskID = SessionTask.childID(parentID, originMessage, originCall)
      yield* db
        .insert(SessionTable)
        .values({
          id: taskID,
          project_id: ProjectV2.ID.global,
          parent_id: parentID,
          slug: taskID,
          directory: location.directory,
          title: "Fabricated (@general subagent)",
          version: "test",
          runtime: "v2",
          agent: "general",
          model: inherited,
          metadata: {
            task: {
              version: 1,
              parentID,
              agent: "general",
              origin: { messageID: originMessage, callID: originCall },
              ceiling: [],
            },
          },
        })
        .run()
        .pipe(Effect.orDie)

      const callID = "call-fabricated-resume"
      expect(
        (yield* settle(callID, {
          description: "Continue",
          prompt: "never",
          subagent_type: "general",
          task_id: taskID,
        })).result,
      ).toMatchObject({ type: "error", value: expect.stringContaining("conflict") })
      expect(yield* SessionInput.find(db, SessionTask.promptID(parentID, messageID, callID))).toBeUndefined()
      expect(yield* SessionTask.orphaned(db, taskID)).toBeTrue()
      expect(yield* SessionTask.cancelled(db, parentID, originMessage, originCall)).toBeTrue()
    }),
  )

  fixture.it.effect("rejects Location, project, agent, and task-owner resume conflicts before admission", () =>
    Effect.gen(function* () {
      yield* seed
      yield* complete([])
      const db = (yield* Database.Service).db
      yield* settle("call-resume-owner", { description: "Owned", prompt: "first", subagent_type: "general" })
      const taskID = SessionTask.childID(parentID, messageID, "call-resume-owner")
      const original = (yield* db
        .select()
        .from(SessionTable)
        .where(eq(SessionTable.id, taskID))
        .get()
        .pipe(Effect.orDie))!
      const other = ProjectV2.ID.make("other-project")
      yield* db.insert(ProjectTable).values({ id: other, worktree: "/other", sandboxes: [] }).run().pipe(Effect.orDie)
      const conflicts = [
        { directory: "/other" },
        { project_id: other },
        { agent: "modeled" },
        {
          metadata: {
            task: {
              ...(original.metadata!.task as object),
              parentID: SessionSchema.ID.make("ses_other_parent"),
            },
          },
        },
      ]
      for (const [index, conflict] of conflicts.entries()) {
        yield* db.update(SessionTable).set(conflict).where(eq(SessionTable.id, taskID)).run().pipe(Effect.orDie)
        const callID = `call-resume-conflict-${index}`
        expect(
          (yield* settle(callID, {
            description: "Continue",
            prompt: "never",
            subagent_type: "general",
            task_id: taskID,
          })).result,
        ).toMatchObject({ type: "error", value: expect.stringContaining("conflict") })
        expect(yield* SessionInput.find(db, SessionTask.promptID(parentID, messageID, callID))).toBeUndefined()
        yield* db
          .update(SessionTable)
          .set({
            directory: original.directory,
            project_id: original.project_id,
            agent: original.agent,
            metadata: original.metadata,
          })
          .where(eq(SessionTable.id, taskID))
          .run()
          .pipe(Effect.orDie)
      }
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
      expect((yield* (yield* SessionStore.Service).task(taskID))?.ceiling).not.toEqual(
        expect.arrayContaining([
          { action: "task", resource: "*", effect: "deny" },
          { action: "todowrite", resource: "*", effect: "deny" },
        ]),
      )
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

  fixture.it.effect("recovers valid resumes with changed descriptions and caller permissions", () =>
    Effect.gen(function* () {
      yield* seed
      const db = (yield* Database.Service).db
      const runs: string[] = []
      yield* complete(runs)
      yield* settle("call-resume-origin", {
        description: "Modeled",
        prompt: "first",
        subagent_type: "modeled",
      })
      const taskID = SessionTask.childID(parentID, messageID, "call-resume-origin")
      const cases = [
        {
          callID: "call-resume-description-recovery",
          description: "Continue with a different description",
          permissions: [] as PermissionV2.Ruleset,
        },
        {
          callID: "call-resume-permission-recovery",
          description: "Modeled",
          permissions: [{ action: "edit", resource: "new-secret", effect: "deny" as const }],
        },
      ]
      for (const item of cases) {
        const input = {
          description: item.description,
          prompt: item.callID,
          subagent_type: "modeled",
          task_id: taskID,
        }
        expect((yield* settleWith(item.callID, input, item.permissions)).result.type).toBe("text")
        const request = yield* SessionTask.request(db, parentID, messageID, item.callID)
        expect(request).toMatchObject({
          title: "Modeled (@modeled subagent)",
          ceiling: item.permissions,
          permissions: item.permissions,
        })
        const materialized = yield* (yield* ToolRegistry.Service).materialize(request!.permissions, request!.plan)
        expect(
          (yield* materialized.settle({
            sessionID: parentID,
            agent: request!.callerAgent,
            assistantMessageID: messageID,
            call: { type: "tool-call", id: item.callID, name: "task", input },
            task: request,
          })).result.type,
        ).toBe("text")
      }
      expect(runs).toEqual([
        "call-resume-origin",
        "call-resume-description-recovery",
        "call-resume-permission-recovery",
      ])
    }),
  )

  fixture.it.effect("monotonically strengthens a resumed child ceiling and recovers the revised request", () =>
    Effect.gen(function* () {
      yield* seed
      const db = (yield* Database.Service).db
      const runs: string[] = []
      yield* complete(runs)
      yield* settleWith("call-ceiling-origin", { description: "Ceiling", prompt: "origin", subagent_type: "general" }, [
        { action: "*", resource: "/outside/*", effect: "ask" },
      ])
      const taskID = SessionTask.childID(parentID, messageID, "call-ceiling-origin")
      const callID = "call-ceiling-resume"
      const permissions: PermissionV2.Ruleset = [
        { action: "*", resource: "/outside/*", effect: "ask" },
        { action: "edit", resource: "new-secret", effect: "deny" },
      ]
      const input = {
        description: "Continue ceiling",
        prompt: "resume",
        subagent_type: "general",
        task_id: taskID,
      }
      expect((yield* settleWith(callID, input, permissions)).result.type).toBe("text")
      const expected = expect.arrayContaining([
        { action: "*", resource: "/outside/*", effect: "ask" },
        { action: "edit", resource: "new-secret", effect: "deny" },
        { action: "task", resource: "*", effect: "deny" },
        { action: "todowrite", resource: "*", effect: "deny" },
      ])
      expect((yield* (yield* SessionStore.Service).task(taskID))?.ceiling).toEqual(expected)
      const request = yield* SessionTask.request(db, parentID, messageID, callID)
      expect(request?.ceiling).toEqual(expected)
      const materialized = yield* (yield* ToolRegistry.Service).materialize(request!.permissions, request!.plan)
      expect(
        (yield* materialized.settle({
          sessionID: parentID,
          agent: request!.callerAgent,
          assistantMessageID: messageID,
          call: { type: "tool-call", id: callID, name: "task", input },
          task: request,
        })).result.type,
      ).toBe("text")
      expect(runs).toEqual(["call-ceiling-origin", callID])
    }),
  )

  fixture.it.effect("atomically unions concurrent resume ceiling revisions and recovers both requests", () =>
    Effect.gen(function* () {
      yield* seed
      const db = (yield* Database.Service).db
      const runs: string[] = []
      yield* complete(runs)
      yield* settle("call-ceiling-race-origin", {
        description: "Race",
        prompt: "origin",
        subagent_type: "general",
      })
      const taskID = SessionTask.childID(parentID, messageID, "call-ceiling-race-origin")
      const calls = [
        {
          id: "call-ceiling-race-a",
          deny: { action: "edit", resource: "secret-a", effect: "deny" as const },
        },
        {
          id: "call-ceiling-race-b",
          deny: { action: "read", resource: "secret-b", effect: "deny" as const },
        },
      ]
      yield* Effect.all(
        calls.map((item) =>
          settleWith(item.id, { description: item.id, prompt: item.id, subagent_type: "general", task_id: taskID }, [
            item.deny,
          ]),
        ),
        { concurrency: "unbounded" },
      )
      const ceiling = (yield* (yield* SessionStore.Service).task(taskID))!.ceiling
      expect(ceiling).toEqual(expect.arrayContaining(calls.map((item) => item.deny)))
      for (const item of calls) {
        const request = (yield* SessionTask.request(db, parentID, messageID, item.id))!
        expect(
          request.ceiling.every((rule) => ceiling.some((current) => JSON.stringify(current) === JSON.stringify(rule))),
        ).toBeTrue()
        const materialized = yield* (yield* ToolRegistry.Service).materialize(request.permissions, request.plan)
        expect(
          (yield* materialized.settle({
            sessionID: parentID,
            agent: request.callerAgent,
            assistantMessageID: messageID,
            call: {
              type: "tool-call",
              id: item.id,
              name: "task",
              input: { description: item.id, prompt: item.id, subagent_type: "general", task_id: taskID },
            },
            task: request,
          })).result.type,
        ).toBe("text")
      }
    }),
  )

  fixture.it.effect("serializes competing persisted ceiling revisions", () =>
    Effect.gen(function* () {
      yield* seed
      const db = (yield* Database.Service).db
      const runs: string[] = []
      yield* complete(runs)
      yield* settle("call-ceiling-atomic-origin", {
        description: "Atomic",
        prompt: "origin",
        subagent_type: "general",
      })
      const taskID = SessionTask.childID(parentID, messageID, "call-ceiling-atomic-origin")
      const restrictions: PermissionV2.Ruleset = [
        { action: "edit", resource: "atomic-a", effect: "deny" },
        { action: "read", resource: "atomic-b", effect: "deny" },
      ]
      yield* Effect.all(
        restrictions.map((rule) => SessionTask.strengthen(db, taskID, [rule])),
        { concurrency: "unbounded" },
      )
      expect((yield* (yield* SessionStore.Service).task(taskID))?.ceiling).toEqual(expect.arrayContaining(restrictions))
    }),
  )

  fixture.it.effect("recovers child creation, request, admission, and terminal boundaries without duplicate work", () =>
    Effect.gen(function* () {
      yield* seed
      const db = (yield* Database.Service).db
      const events = yield* EventV2.Service
      const runs: string[] = []
      yield* complete(runs)
      for (const phase of ["request", "child", "admission"] as const) {
        const callID = `call-restart-${phase}`
        const taskID = SessionTask.childID(parentID, messageID, callID)
        const promptID = SessionTask.promptID(parentID, messageID, callID)
        yield* events.publish(
          SessionEvent.Task.Requested,
          {
            sessionID: parentID,
            timestamp: yield* DateTime.now,
            assistantMessageID: messageID,
            callID,
            childSessionID: taskID,
            promptMessageID: promptID,
            description: `Restart ${phase}`,
            prompt: phase,
            agent: "general",
            model: inherited,
            multiAgent: "v2",
            callerAgent: "build",
            permissions: [],
            plan: { multiAgent: "v2" },
            projectID: ProjectV2.ID.global,
            location,
            title: `Restart ${phase} (@general subagent)`,
            ceiling: [
              { action: "task", resource: "*", effect: "deny" },
              { action: "todowrite", resource: "*", effect: "deny" },
            ],
          },
          { id: SessionTask.requestEventID(parentID, messageID, callID) },
        )
        if (phase !== "request")
          yield* db
            .insert(SessionTable)
            .values({
              id: taskID,
              project_id: ProjectV2.ID.global,
              slug: taskID,
              directory: location.directory,
              title: `Restart ${phase} (@general subagent)`,
              version: "test",
              runtime: "v2",
              parent_id: parentID,
              agent: "general",
              model: inherited,
              metadata: {
                task: {
                  version: 1,
                  parentID,
                  agent: "general",
                  origin: { messageID, callID },
                  ceiling: [
                    { action: "task", resource: "*", effect: "deny" },
                    { action: "todowrite", resource: "*", effect: "deny" },
                  ],
                },
              },
            })
            .run()
            .pipe(Effect.orDie)
        if (phase === "admission")
          yield* SessionInput.admit(db, events, {
            id: promptID,
            sessionID: taskID,
            prompt: new Prompt({ text: phase }),
            delivery: "steer",
          })

        expect(
          (yield* settle(callID, { description: `Restart ${phase}`, prompt: phase, subagent_type: "general" })).result
            .type,
        ).toBe("text")
        expect(runs.filter((id) => id === callID)).toHaveLength(1)
        expect(
          yield* db.select().from(SessionInputTable).where(eq(SessionInputTable.id, promptID)).all().pipe(Effect.orDie),
        ).toHaveLength(1)
      }

      const terminalInput = { description: "Terminal", prompt: "terminal", subagent_type: "general" }
      expect((yield* settle("call-restart-terminal", terminalInput)).result.type).toBe("text")
      expect((yield* settle("call-restart-terminal", terminalInput)).result.type).toBe("text")
      expect(runs.filter((id) => id === "call-restart-terminal")).toHaveLength(1)
    }),
  )

  fixture.it.effect("creates a missing child from the immutable request snapshot after parent mutation", () =>
    Effect.gen(function* () {
      yield* seed
      const db = (yield* Database.Service).db
      const events = yield* EventV2.Service
      const runs: string[] = []
      yield* complete(runs)
      const callID = "call-request-before-child"
      const taskID = SessionTask.childID(parentID, messageID, callID)
      const input = { description: "Snapshotted", prompt: "recover snapshot", subagent_type: "general" }
      const request = {
        sessionID: parentID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID,
        childSessionID: taskID,
        promptMessageID: SessionTask.promptID(parentID, messageID, callID),
        description: input.description,
        prompt: input.prompt,
        agent: AgentV2.ID.make("general"),
        model: inherited,
        multiAgent: "v2" as const,
        callerAgent: AgentV2.ID.make("build"),
        permissions: [{ action: "edit", resource: "snapshot-only", effect: "deny" as const }],
        plan: { mode: "code-only" as const, multiAgent: "v2" as const },
        projectID: ProjectV2.ID.global,
        location,
        title: "Snapshotted (@general subagent)",
        ceiling: [
          { action: "task", resource: "*", effect: "deny" as const },
          { action: "todowrite", resource: "*", effect: "deny" as const },
        ],
      }
      yield* events.publish(SessionEvent.Task.Requested, request, {
        id: SessionTask.requestEventID(parentID, messageID, callID),
      })
      yield* db
        .update(SessionTable)
        .set({ agent: "modeled", model: override })
        .where(eq(SessionTable.id, parentID))
        .run()
        .pipe(Effect.orDie)
      const materialized = yield* (yield* ToolRegistry.Service).materialize(request.permissions, request.plan)
      expect(
        (yield* materialized.settle({
          sessionID: parentID,
          agent: request.callerAgent,
          assistantMessageID: messageID,
          call: { type: "tool-call", id: callID, name: "task", input },
          task: request,
        })).result.type,
      ).toBe("text")
      expect(
        yield* db.select().from(SessionTable).where(eq(SessionTable.id, taskID)).get().pipe(Effect.orDie),
      ).toMatchObject({
        agent: "general",
        model: inherited,
        title: request.title,
        metadata: { task: { ceiling: request.ceiling } },
      })
      expect(runs).toEqual([callID])
      expect(
        yield* db
          .select()
          .from(SessionInputTable)
          .where(eq(SessionInputTable.id, request.promptMessageID))
          .all()
          .pipe(Effect.orDie),
      ).toHaveLength(1)
    }),
  )

  fixture.it.effect(
    "reconnects a persisted request through the canonical task registration without duplicate work",
    () =>
      Effect.gen(function* () {
        yield* seed
        const db = (yield* Database.Service).db
        const runs: string[] = []
        yield* complete(runs)
        const callID = "call-canonical-recovery"
        const input = { description: "Canonical", prompt: "recover", subagent_type: "general" }
        const permissions = [{ action: "edit", resource: "secret", effect: "deny" as const }]
        expect(
          (yield* settleWith(callID, input, permissions, { mode: "code-only", multiAgent: "v2" })).result.type,
        ).toBe("text")
        const request = yield* SessionTask.request(db, parentID, messageID, callID)
        expect(request).toBeDefined()
        const assertions = fixture.assertions.length
        const materialized = yield* (yield* ToolRegistry.Service).materialize(request!.permissions, request!.plan)
        const recovered = yield* materialized.settle({
          sessionID: parentID,
          agent: request!.callerAgent,
          assistantMessageID: messageID,
          call: { type: "tool-call", id: callID, name: "task", input },
          task: request,
        })

        expect(recovered.result.type).toBe("text")
        expect(runs).toEqual([callID])
        expect(fixture.assertions).toHaveLength(assertions)
      }),
  )

  fixture.it.effect("keeps task stale registration and output bounding authoritative", () =>
    Effect.gen(function* () {
      yield* seed
      yield* complete([])
      const registry = yield* ToolRegistry.Service
      const stale = yield* registry.materialize()
      const scope = yield* Scope.make()
      yield* registry
        .register({
          task: Tool.make({
            description: "Replacement task",
            input: Schema.Struct({}),
            output: Schema.Struct({}),
            execute: () => Effect.succeed({}),
          }),
        })
        .pipe(Scope.provide(scope))
      expect(
        (yield* stale.settle({
          sessionID: parentID,
          agent: AgentV2.ID.make("build"),
          assistantMessageID: messageID,
          call: {
            type: "tool-call",
            id: "call-stale-task",
            name: "task",
            input: { description: "Stale", prompt: "never", subagent_type: "general" },
          },
        })).result,
      ).toEqual({ type: "error", value: "Stale tool call: task" })
      yield* Scope.close(scope, Exit.void)

      fixture.bound(true)
      expect(
        (yield* settle("call-bounded-task", { description: "Bound", prompt: "bound", subagent_type: "general" }))
          .result,
      ).toEqual({
        type: "text",
        value: "bounded-task-output",
      })
      fixture.bound(false)
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

  fixture.it.effect("does not emit Task.Execute when interruption wins immediately after prompt admission", () =>
    Effect.gen(function* () {
      yield* seed
      const events = yield* EventV2.Service
      const db = (yield* Database.Service).db
      const callID = "call-interrupt-before-execute"
      const childID = SessionTask.childID(parentID, messageID, callID)
      let executes = 0
      yield* events.listen((event) => {
        if (Schema.is(SessionEvent.Task.Execute)(event)) {
          executes++
          return Effect.void
        }
        if (
          !Schema.is(SessionEvent.PromptLifecycle.Admitted)(event) ||
          event.data.messageID !== SessionTask.promptID(parentID, messageID, callID)
        )
          return Effect.void
        return events.publish(
          SessionEvent.Task.Interrupted,
          {
            sessionID: parentID,
            timestamp: event.data.timestamp,
            assistantMessageID: messageID,
            callID,
            childSessionID: childID,
          },
          { id: SessionTask.interruptedEventID(parentID, messageID, callID) },
        )
      })

      expect(
        (yield* settle(callID, { description: "Race", prompt: "never execute", subagent_type: "general" })).result,
      ).toMatchObject({ type: "error", value: expect.stringContaining("interrupted") })
      expect(yield* SessionTask.orphaned(db, childID)).toBeTrue()
      expect(executes).toBe(0)
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
