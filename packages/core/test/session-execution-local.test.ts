import { describe, expect } from "bun:test"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { Project } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionExecution } from "@slopcode-ai/core/session/execution"
import * as SessionExecutionLocal from "@slopcode-ai/core/session/execution/local"
import { SessionInput } from "@slopcode-ai/core/session/input"
import { SessionEvent } from "@slopcode-ai/core/session/event"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { Prompt } from "@slopcode-ai/core/session/prompt"
import { SessionProjector } from "@slopcode-ai/core/session/projector"
import { SessionRunner } from "@slopcode-ai/core/session/runner"
import { SessionRuntime } from "@slopcode-ai/core/session/runtime"
import { SessionSchema } from "@slopcode-ai/core/session/schema"
import { SessionTable } from "@slopcode-ai/core/session/sql"
import { SessionStore } from "@slopcode-ai/core/session/store"
import { SessionTask } from "@slopcode-ai/core/session/task"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { DateTime, Deferred, Effect, Fiber, Layer } from "effect"
import { testEffect } from "./lib/effect"

const database = Database.layerFromPath(":memory:")
const events = EventV2.layer.pipe(Layer.provide(database))
const projector = SessionProjector.layer.pipe(Layer.provide(events), Layer.provide(database))
const store = SessionStore.layer.pipe(Layer.provide(database))
const runtime = SessionRuntime.layer.pipe(Layer.provide(database))
const it = testEffect(Layer.mergeAll(database, events, projector, store, runtime))

const verify = (delivery?: SessionInput.Delivery, interrupted = false) =>
  Effect.gen(function* () {
    const database = yield* Database.Service
    const db = database.db
    const events = yield* EventV2.Service
    const store = yield* SessionStore.Service
    const runtime = yield* SessionRuntime.Service
    const sessionID = SessionSchema.ID.make(`ses_recovered_${delivery ?? "idle"}${interrupted ? "_paused" : ""}`)
    yield* db
      .insert(ProjectTable)
      .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
      .run()
      .pipe(Effect.orDie)
    yield* db
      .insert(SessionTable)
      .values({
        id: sessionID,
        project_id: Project.ID.global,
        slug: sessionID,
        directory: "/project",
        title: "Recovered",
        version: "test",
        runtime: "v2",
      })
      .run()
      .pipe(Effect.orDie)
    if (delivery)
      yield* SessionInput.admit(db, events, {
        id: SessionMessage.ID.create(),
        sessionID,
        prompt: new Prompt({ text: "Persisted before restart" }),
        delivery,
      })
    yield* runtime.assign({
      sessionID,
      state: interrupted ? "paused" : "draining",
      expectedOwner: "v2",
      expectedEpoch: 0,
    })

    const started = yield* Deferred.make<boolean>()
    const release = yield* Deferred.make<void>()
    const done = yield* Deferred.make<void>()
    let provider = 0
    const runner = Layer.succeed(
      SessionRunner.Service,
      SessionRunner.Service.of({
        run: (input) =>
          Effect.gen(function* () {
            yield* Deferred.succeed(started, input.force === true)
            yield* Deferred.await(release)
            const pending = yield* Effect.all([
              SessionInput.hasPending(db, input.sessionID, "steer"),
              SessionInput.hasPending(db, input.sessionID, "queue"),
            ])
            if (pending.some(Boolean)) {
              provider++
              if (pending[0])
                yield* SessionInput.promoteSteers(
                  db,
                  events,
                  input.sessionID,
                  yield* SessionInput.latestSeq(db, input.sessionID),
                )
              if (pending[1]) yield* SessionInput.promoteNextQueued(db, events, input.sessionID)
            }
            yield* Deferred.succeed(done, undefined)
          }),
      }),
    )
    const execution = SessionExecutionLocal.layer.pipe(
      Layer.provide(Layer.succeed(Database.Service, database)),
      Layer.provide(Layer.succeed(SessionStore.Service, store)),
      Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
      Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
    )

    yield* Effect.gen(function* () {
      yield* SessionExecution.Service
      if (delivery) {
        expect(yield* Deferred.await(started)).toBe(false)
        yield* Deferred.succeed(release, undefined)
        yield* Deferred.await(done)
      }
    }).pipe(Effect.provide(execution))

    expect(yield* SessionInput.hasPending(db, sessionID, "steer")).toBe(false)
    expect(provider).toBe(delivery ? 1 : 0)
    expect(yield* runtime.get(sessionID)).toMatchObject({
      owner: "v2",
      state: "paused",
      epoch: interrupted ? 1 : 2,
    })
  })

describe("SessionExecutionLocal startup recovery", () => {
  it.effect("recovers and drains durable pending input without a new prompt", () => verify("steer"))
  it.effect("recovers and drains queued durable input without a new prompt", () => verify("queue"))
  it.effect("leaves recovered sessions paused when no durable input is pending", () => verify())
  it.effect("drains pending input when the previous startup stopped after pausing", () => verify("steer", true))

  it.effect("recovers one durable manual compaction request without repeating its terminal", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const events = yield* EventV2.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const sessionID = SessionSchema.ID.make("ses_recovered_manual_compaction")
      yield* db
        .insert(ProjectTable)
        .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(SessionTable)
        .values({
          id: sessionID,
          project_id: Project.ID.global,
          slug: sessionID,
          directory: "/project",
          title: "Recovered manual compaction",
          version: "test",
          runtime: "v2",
        })
        .run()
        .pipe(Effect.orDie)
      const id = SessionMessage.ID.make("msg_recovered_manual_compaction")
      const request = yield* SessionInput.admitCompaction(db, events, { id, sessionID })
      const done = yield* Deferred.make<void>()
      let runs = 0
      const runner = Layer.succeed(
        SessionRunner.Service,
        SessionRunner.Service.of({
          run: () =>
            Effect.gen(function* () {
              runs++
              yield* SessionInput.skipCompaction(db, events, request)
              yield* Deferred.succeed(done, undefined)
            }),
        }),
      )
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
      )

      yield* Effect.gen(function* () {
        yield* SessionExecution.Service
        yield* Deferred.await(done)
      }).pipe(Effect.provide(execution))
      expect(yield* SessionInput.terminalCompaction(db, id)).toEqual({ type: "skipped" })
      expect(runs).toBe(1)

      yield* runtime.assign({
        sessionID,
        state: "draining",
        expectedOwner: "v2",
        expectedEpoch: (yield* runtime.assert({ sessionID, owner: "v2" })).epoch,
      })
      yield* SessionExecution.Service.pipe(Effect.provide(execution))
      expect(runs).toBe(1)
    }),
  )

  it.effect("discovers a ready runtime shell request and never repeats its terminal", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const events = yield* EventV2.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const sessionID = SessionSchema.ID.make("ses_recovered_ready_shell")
      yield* db
        .insert(ProjectTable)
        .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(SessionTable)
        .values({
          id: sessionID,
          project_id: Project.ID.global,
          slug: sessionID,
          directory: "/project",
          title: "Recovered ready shell",
          version: "test",
          runtime: "v2",
          runtime_state: "ready",
        })
        .run()
        .pipe(Effect.orDie)
      const id = SessionMessage.ID.make("msg_recovered_ready_shell")
      const request = yield* SessionInput.admitShell(db, events, {
        id,
        sessionID,
        command: "pwd",
        resume: false,
      })
      const done = yield* Deferred.make<void>()
      let runs = 0
      const runner = Layer.succeed(
        SessionRunner.Service,
        SessionRunner.Service.of({
          run: () =>
            Effect.gen(function* () {
              runs++
              yield* SessionInput.startShell(db, events, request)
              yield* SessionInput.endShell(db, events, request, {
                status: "completed",
                output: "/project",
                exitCode: 0,
                truncated: false,
              })
              yield* Deferred.succeed(done, undefined)
            }),
        }),
      )
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
      )

      yield* Effect.gen(function* () {
        yield* SessionExecution.Service
        yield* Deferred.await(done)
      }).pipe(Effect.provide(execution))
      expect(yield* SessionInput.terminalShell(db, id)).toMatchObject({ status: "completed", exitCode: 0 })
      expect(runs).toBe(1)

      yield* SessionExecution.Service.pipe(Effect.provide(execution))
      expect(runs).toBe(1)
    }),
  )

  it.effect("recovers shell and compaction work without a prompt wake", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const events = yield* EventV2.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const sessionID = SessionSchema.ID.make("ses_recovered_shell_and_compaction")
      yield* db
        .insert(ProjectTable)
        .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(SessionTable)
        .values({
          id: sessionID,
          project_id: Project.ID.global,
          slug: sessionID,
          directory: "/project",
          title: "Recovered shell and compaction",
          version: "test",
          runtime: "v2",
          runtime_state: "ready",
        })
        .run()
        .pipe(Effect.orDie)
      const shell = yield* SessionInput.admitShell(db, events, {
        id: SessionMessage.ID.make("msg_recovered_shell_with_compaction"),
        sessionID,
        command: "pwd",
        resume: false,
      })
      const compaction = yield* SessionInput.admitCompaction(db, events, {
        id: SessionMessage.ID.make("msg_recovered_compaction_with_shell"),
        sessionID,
      })
      let runs = 0
      const runner = Layer.succeed(
        SessionRunner.Service,
        SessionRunner.Service.of({
          run: () =>
            Effect.gen(function* () {
              runs++
              if (runs === 1) {
                yield* SessionInput.startShell(db, events, shell)
                yield* SessionInput.endShell(db, events, shell, {
                  status: "completed",
                  output: "/project",
                  exitCode: 0,
                  truncated: false,
                })
                return
              }
              yield* SessionInput.skipCompaction(db, events, compaction)
            }),
        }),
      )
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
      )

      yield* Effect.gen(function* () {
        const service = yield* SessionExecution.Service
        yield* service.wait(sessionID)
      }).pipe(Effect.provide(execution))

      expect(runs).toBe(2)
      expect(yield* SessionInput.terminalShell(db, shell.id)).toMatchObject({ status: "completed" })
      expect(yield* SessionInput.terminalCompaction(db, compaction.id)).toEqual({ type: "skipped" })
    }),
  )

  it.effect("discovers a ready parent task request and reconnects it through the runner", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const events = yield* EventV2.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const sessionID = SessionSchema.ID.make("ses_recovered_ready_task")
      const messageID = SessionMessage.ID.make("msg_recovered_ready_task")
      const childID = SessionSchema.ID.make("ses_recovered_ready_task_child")
      yield* db
        .insert(ProjectTable)
        .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(SessionTable)
        .values({
          id: sessionID,
          project_id: Project.ID.global,
          slug: sessionID,
          directory: "/project",
          title: "Recovered ready task",
          version: "test",
          runtime: "v2",
          runtime_state: "ready",
        })
        .run()
        .pipe(Effect.orDie)
      const model = {
        providerID: ProviderV2.ID.make("fake"),
        id: ModelV2.ID.make("fake"),
        variant: ModelV2.VariantID.make("default"),
      }
      yield* events.publish(SessionEvent.Step.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        agent: "build",
        model,
      })
      yield* events.publish(SessionEvent.Tool.Input.Started, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID: "call-recovered-task",
        name: "task",
      })
      yield* events.publish(SessionEvent.Tool.Input.Ended, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID: messageID,
        callID: "call-recovered-task",
        text: '{"description":"Recover","prompt":"recover","subagent_type":"general"}',
      })
      yield* events.publish(
        SessionEvent.Task.Requested,
        {
          sessionID,
          timestamp: yield* DateTime.now,
          assistantMessageID: messageID,
          callID: "call-recovered-task",
          childSessionID: childID,
          promptMessageID: SessionMessage.ID.make("msg_recovered_ready_task_prompt"),
          description: "Recover",
          prompt: "recover",
          agent: "general",
          model,
          multiAgent: "v2",
          callerAgent: "build",
          permissions: [],
          plan: { multiAgent: "v2" },
          projectID: Project.ID.global,
          location: { directory: AbsolutePath.make("/project") },
          title: "Recovered child",
          ceiling: [],
        },
        { id: SessionTask.requestEventID(sessionID, messageID, "call-recovered-task") },
      )
      const done = yield* Deferred.make<void>()
      const runs: SessionSchema.ID[] = []
      const runner = Layer.succeed(
        SessionRunner.Service,
        SessionRunner.Service.of({
          run: (input) =>
            Effect.sync(() => runs.push(input.sessionID)).pipe(Effect.andThen(Deferred.succeed(done, undefined))),
        }),
      )
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
      )

      yield* Effect.gen(function* () {
        yield* SessionExecution.Service
        yield* Deferred.await(done)
      }).pipe(Effect.provide(execution))

      expect(runs).toEqual([sessionID])
    }),
  )

  it.effect("never restarts an owned child after the durable parent interrupt crash window", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const events = yield* EventV2.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const parentID = SessionSchema.ID.make("ses_interrupted_task_parent")
      const messageID = SessionMessage.ID.make("msg_interrupted_task_parent")
      const callID = "call-interrupted-task-parent"
      const childID = SessionTask.childID(parentID, messageID, callID)
      const model = {
        providerID: ProviderV2.ID.make("fake"),
        id: ModelV2.ID.make("fake"),
        variant: ModelV2.VariantID.make("default"),
      }
      yield* db
        .insert(ProjectTable)
        .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(SessionTable)
        .values([
          {
            id: parentID,
            project_id: Project.ID.global,
            slug: parentID,
            directory: "/project",
            title: "Interrupted parent",
            version: "test",
            runtime: "v2" as const,
          },
          {
            id: childID,
            project_id: Project.ID.global,
            parent_id: parentID,
            slug: childID,
            directory: "/project",
            title: "Interrupted child",
            version: "test",
            runtime: "v2" as const,
            runtime_state: "draining" as const,
            agent: "general",
            model,
            metadata: {
              task: { version: 1, parentID, agent: "general", origin: { messageID, callID }, ceiling: [] },
            },
          },
        ])
        .run()
        .pipe(Effect.orDie)
      yield* events.publish(
        SessionEvent.Task.Requested,
        {
          sessionID: parentID,
          timestamp: yield* DateTime.now,
          assistantMessageID: messageID,
          callID,
          childSessionID: childID,
          promptMessageID: SessionTask.promptID(parentID, messageID, callID),
          description: "Interrupted",
          prompt: "never run",
          agent: "general",
          model,
          multiAgent: "v2",
          callerAgent: "build",
          permissions: [],
          plan: { multiAgent: "v2" },
          projectID: Project.ID.global,
          location: { directory: AbsolutePath.make("/project") },
          title: "Interrupted child",
          ceiling: [],
        },
        { id: SessionTask.requestEventID(parentID, messageID, callID) },
      )
      yield* SessionInput.admit(db, events, {
        id: SessionTask.promptID(parentID, messageID, callID),
        sessionID: childID,
        prompt: new Prompt({ text: "never run" }),
        delivery: "steer",
      })
      yield* events.publish(SessionEvent.InterruptRequested, {
        sessionID: parentID,
        timestamp: yield* DateTime.now,
      })
      const runs: SessionSchema.ID[] = []
      const runner = Layer.succeed(
        SessionRunner.Service,
        SessionRunner.Service.of({ run: (input) => Effect.sync(() => runs.push(input.sessionID)) }),
      )
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
      )

      yield* SessionExecution.Service.pipe(Effect.provide(execution))
      yield* Effect.yieldNow

      expect(runs).not.toContain(childID)
    }),
  )

  it.effect("rechecks interruption committed between startup pending reads and child wake", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const events = yield* EventV2.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const parentID = SessionSchema.ID.make("ses_interrupted_resume_parent")
      const originMessageID = SessionMessage.ID.make("msg_interrupted_resume_origin")
      const resumeMessageID = SessionMessage.ID.make("msg_interrupted_resume_current")
      const originCallID = "call-interrupted-resume-origin"
      const resumeCallID = "call-interrupted-resume-current"
      const childID = SessionTask.childID(parentID, originMessageID, originCallID)
      const model = ModelV2.Ref.make({
        providerID: ProviderV2.ID.make("fake"),
        id: ModelV2.ID.make("fake"),
        variant: ModelV2.VariantID.make("default"),
      })
      const now = yield* DateTime.now
      const request = (messageID: SessionMessage.ID, callID: string, prompt: string) => ({
        sessionID: parentID,
        timestamp: now,
        assistantMessageID: messageID,
        callID,
        childSessionID: childID,
        promptMessageID: SessionTask.promptID(parentID, messageID, callID),
        description: callID === originCallID ? "Origin" : "Resume",
        prompt,
        agent: "general",
        model,
        multiAgent: "v2" as const,
        callerAgent: AgentV2.ID.make("build"),
        permissions: [],
        plan: { multiAgent: "v2" as const },
        projectID: Project.ID.global,
        location: { directory: AbsolutePath.make("/project") },
        title: "Origin (@general subagent)",
        ceiling: [],
      })
      yield* db
        .insert(ProjectTable)
        .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(SessionTable)
        .values([
          {
            id: parentID,
            project_id: Project.ID.global,
            slug: parentID,
            directory: "/project",
            title: "Interrupted resume parent",
            version: "test",
            runtime: "v2" as const,
          },
          {
            id: childID,
            project_id: Project.ID.global,
            parent_id: parentID,
            slug: childID,
            directory: "/project",
            title: "Origin (@general subagent)",
            version: "test",
            runtime: "v2" as const,
            runtime_state: "draining" as const,
            agent: "general",
            model,
            metadata: {
              task: {
                version: 1,
                parentID,
                agent: "general",
                origin: { messageID: originMessageID, callID: originCallID },
                ceiling: [],
              },
            },
          },
        ])
        .run()
        .pipe(Effect.orDie)
      yield* events.publish(SessionEvent.Task.Requested, request(originMessageID, originCallID, "origin"), {
        id: SessionTask.requestEventID(parentID, originMessageID, originCallID),
      })
      yield* events.publish(SessionEvent.Task.Requested, request(resumeMessageID, resumeCallID, "never run"), {
        id: SessionTask.requestEventID(parentID, resumeMessageID, resumeCallID),
      })
      yield* SessionInput.admit(db, events, {
        id: SessionTask.promptID(parentID, resumeMessageID, resumeCallID),
        sessionID: childID,
        prompt: new Prompt({ text: "never run" }),
        delivery: "steer",
      })
      let raced = false
      const racing = SessionStore.Service.of({
        ...store,
        context: (sessionID) =>
          Effect.gen(function* () {
            if (sessionID === childID && !raced) {
              raced = true
              yield* events.publish(
                SessionEvent.Task.Interrupted,
                {
                  sessionID: parentID,
                  timestamp: yield* DateTime.now,
                  assistantMessageID: resumeMessageID,
                  callID: resumeCallID,
                  childSessionID: childID,
                },
                { id: SessionTask.interruptedEventID(parentID, resumeMessageID, resumeCallID) },
              )
            }
            return yield* store.context(sessionID)
          }),
      })
      const runs: SessionSchema.ID[] = []
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, racing)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(
          Layer.mock(LocationServiceMap, {
            get: () =>
              Layer.succeed(
                SessionRunner.Service,
                SessionRunner.Service.of({ run: (input) => Effect.sync(() => runs.push(input.sessionID)) }),
              ),
          }),
        ),
      )

      yield* SessionExecution.Service.pipe(Effect.provide(execution))
      yield* Effect.yieldNow

      expect(raced).toBeTrue()
      expect(yield* SessionTask.interrupted(db, parentID, originMessageID, originCallID)).toBeFalse()
      expect(yield* SessionTask.orphaned(db, childID)).toBeTrue()
      expect(runs).not.toContain(childID)
    }),
  )

  it.effect("rechecks the orphan fence in the live Task.Execute listener", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const events = yield* EventV2.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const parentID = SessionSchema.ID.make("ses_live_execute_fence_parent")
      const messageID = SessionMessage.ID.make("msg_live_execute_fence")
      const callID = "call-live-execute-fence"
      const childID = SessionTask.childID(parentID, messageID, callID)
      const model = ModelV2.Ref.make({
        providerID: ProviderV2.ID.make("fake"),
        id: ModelV2.ID.make("fake"),
        variant: ModelV2.VariantID.make("default"),
      })
      yield* db
        .insert(ProjectTable)
        .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(SessionTable)
        .values([
          {
            id: parentID,
            project_id: Project.ID.global,
            slug: parentID,
            directory: "/project",
            title: "Live parent",
            version: "test",
            runtime: "v2" as const,
          },
          {
            id: childID,
            project_id: Project.ID.global,
            parent_id: parentID,
            slug: childID,
            directory: "/project",
            title: "Live (@general subagent)",
            version: "test",
            runtime: "v2" as const,
            agent: "general",
            model,
            metadata: {
              task: {
                version: 1,
                parentID,
                agent: "general",
                origin: { messageID, callID },
                ceiling: [],
              },
            },
          },
        ])
        .run()
        .pipe(Effect.orDie)
      yield* events.publish(
        SessionEvent.Task.Requested,
        {
          sessionID: parentID,
          timestamp: yield* DateTime.now,
          assistantMessageID: messageID,
          callID,
          childSessionID: childID,
          promptMessageID: SessionTask.promptID(parentID, messageID, callID),
          description: "Live",
          prompt: "never run",
          agent: "general",
          model,
          multiAgent: "v2",
          callerAgent: AgentV2.ID.make("build"),
          permissions: [],
          plan: { multiAgent: "v2" },
          projectID: Project.ID.global,
          location: { directory: AbsolutePath.make("/project") },
          title: "Live (@general subagent)",
          ceiling: [],
        },
        { id: SessionTask.requestEventID(parentID, messageID, callID) },
      )
      const runs: SessionSchema.ID[] = []
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(
          Layer.mock(LocationServiceMap, {
            get: () =>
              Layer.succeed(
                SessionRunner.Service,
                SessionRunner.Service.of({ run: (input) => Effect.sync(() => runs.push(input.sessionID)) }),
              ),
          }),
        ),
      )

      yield* Effect.gen(function* () {
        yield* events.publish(
          SessionEvent.Task.Interrupted,
          {
            sessionID: parentID,
            timestamp: yield* DateTime.now,
            assistantMessageID: messageID,
            callID,
            childSessionID: childID,
          },
          { id: SessionTask.interruptedEventID(parentID, messageID, callID) },
        )
        yield* events.publish(SessionEvent.Task.Execute, {
          sessionID: parentID,
          timestamp: yield* DateTime.now,
          assistantMessageID: messageID,
          callID,
          childSessionID: childID,
        })
      }).pipe(Effect.provide(execution))

      expect(runs).not.toContain(childID)
    }),
  )

  it.effect("never starts damaged or fabricated task children as ordinary V2 work", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const events = yield* EventV2.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const parentID = SessionSchema.ID.make("ses_damaged_task_parent")
      const fabricatedMessage = SessionMessage.ID.make("msg_fabricated_task_origin")
      const damagedMessage = SessionMessage.ID.make("msg_damaged_task_origin")
      const fabricated = SessionTask.childID(parentID, fabricatedMessage, "call-fabricated")
      const damaged = SessionTask.childID(parentID, damagedMessage, "call-damaged")
      const model = ModelV2.Ref.make({ providerID: ProviderV2.ID.make("fake"), id: ModelV2.ID.make("fake") })
      yield* db
        .insert(ProjectTable)
        .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(SessionTable)
        .values([
          {
            id: parentID,
            project_id: Project.ID.global,
            slug: parentID,
            directory: "/project",
            title: "Damaged task parent",
            version: "test",
            runtime: "v2" as const,
          },
          {
            id: fabricated,
            project_id: Project.ID.global,
            parent_id: parentID,
            slug: fabricated,
            directory: "/project",
            title: "Fabricated (@general subagent)",
            version: "test",
            runtime: "v2" as const,
            runtime_state: "draining" as const,
            agent: "general",
            model,
            metadata: {
              task: {
                version: 1,
                parentID,
                agent: "general",
                origin: { messageID: fabricatedMessage, callID: "call-fabricated" },
                ceiling: [],
              },
            },
          },
          {
            id: damaged,
            project_id: Project.ID.global,
            parent_id: parentID,
            slug: damaged,
            directory: "/project",
            title: "Damaged (@general subagent)",
            version: "test",
            runtime: "v2" as const,
            runtime_state: "draining" as const,
            agent: "general",
            model,
            metadata: { task: { version: 1, damaged: true } },
          },
        ])
        .run()
        .pipe(Effect.orDie)
      yield* Effect.forEach(
        [fabricated, damaged],
        (sessionID) =>
          SessionInput.admit(db, events, {
            id: SessionMessage.ID.create(),
            sessionID,
            prompt: new Prompt({ text: "must not execute" }),
            delivery: "steer",
          }),
        { discard: true },
      )
      const runs: SessionSchema.ID[] = []
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(
          Layer.mock(LocationServiceMap, {
            get: () =>
              Layer.succeed(
                SessionRunner.Service,
                SessionRunner.Service.of({ run: (input) => Effect.sync(() => runs.push(input.sessionID)) }),
              ),
          }),
        ),
      )

      yield* SessionExecution.Service.pipe(Effect.provide(execution))
      yield* Effect.yieldNow

      expect(yield* SessionTask.orphaned(db, fabricated)).toBeTrue()
      expect(yield* SessionTask.orphaned(db, damaged)).toBeTrue()
      expect(runs).toEqual([])
    }),
  )
})

describe("SessionExecutionLocal wait", () => {
  it.effect("waits for the active provider and its coalesced follow-up", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const sessionID = SessionSchema.ID.make("ses_execution_wait")
      yield* database.db
        .insert(ProjectTable)
        .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
        .run()
        .pipe(Effect.orDie)
      yield* database.db
        .insert(SessionTable)
        .values({
          id: sessionID,
          project_id: Project.ID.global,
          slug: sessionID,
          directory: "/project",
          title: "Wait",
          version: "test",
          runtime: "v2",
        })
        .run()
        .pipe(Effect.orDie)
      const first = yield* Deferred.make<void>()
      const firstGate = yield* Deferred.make<void>()
      const second = yield* Deferred.make<void>()
      const secondGate = yield* Deferred.make<void>()
      const settled = yield* Deferred.make<void>()
      let runs = 0
      const runner = Layer.succeed(
        SessionRunner.Service,
        SessionRunner.Service.of({
          run: () =>
            Effect.sync(() => ++runs).pipe(
              Effect.flatMap((run) =>
                run === 1
                  ? Deferred.succeed(first, undefined).pipe(Effect.andThen(Deferred.await(firstGate)))
                  : Deferred.succeed(second, undefined).pipe(Effect.andThen(Deferred.await(secondGate))),
              ),
            ),
        }),
      )
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
      )

      yield* Effect.gen(function* () {
        const service = yield* SessionExecution.Service
        yield* service.wake(sessionID)
        yield* Deferred.await(first)
        yield* service.wake(sessionID)
        const wait = yield* service
          .wait(sessionID)
          .pipe(Effect.ensuring(Deferred.succeed(settled, undefined)), Effect.forkChild)
        yield* Deferred.succeed(firstGate, undefined)
        yield* Deferred.await(second)
        expect(yield* Deferred.isDone(settled)).toBeFalse()
        yield* Deferred.succeed(secondGate, undefined)
        yield* Fiber.join(wait)
      }).pipe(Effect.provide(execution))

      expect(runs).toBe(2)
    }),
  )
})
