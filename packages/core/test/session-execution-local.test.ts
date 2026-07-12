import { describe, expect } from "bun:test"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { EventTable } from "@slopcode-ai/core/event/sql"
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
import { SessionExecutionStatus } from "@slopcode-ai/core/session/execution-status"
import { SessionSchema } from "@slopcode-ai/core/session/schema"
import { SessionTable } from "@slopcode-ai/core/session/sql"
import { SessionStore } from "@slopcode-ai/core/session/store"
import { SessionTask } from "@slopcode-ai/core/session/task"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { DateTime, Deferred, Effect, Fiber, Layer } from "effect"
import * as TestClock from "effect/testing/TestClock"
import { eq } from "drizzle-orm"
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
  it.effect("interrupts busy activities before and after an uncertain provider dispatch", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const status = yield* SessionExecutionStatus.make
      yield* db.insert(ProjectTable).values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] }).onConflictDoNothing().run().pipe(Effect.orDie)
      const ids = ["before_dispatch", "after_dispatch"] as const
      for (const kind of ids) {
        const sessionID = SessionSchema.ID.make(`ses_recovered_${kind}`)
        const rootID = SessionMessage.ID.make(`msg_recovered_${kind}`)
        yield* db.insert(SessionTable).values({ id: sessionID, project_id: Project.ID.global, slug: sessionID, directory: "/project", title: kind, version: "test", runtime: "v2", runtime_state: "draining", runtime_epoch: 1 }).run().pipe(Effect.orDie)
        const fence = { sessionID, owner: "v2" as const, runtimeState: "draining" as const, epoch: 1, activityID: rootID, rootID, activity: "prompt" as const }
        yield* status.start({ ...fence, phase: "preparing" })
        if (kind === "after_dispatch") yield* status.dispatch({ ...fence, phase: "provider", requestAttempt: 1, providerAttempt: 1, recovery: "interrupt", fingerprint: "a".repeat(64) })
      }
      let runs = 0
      const runner = Layer.succeed(SessionRunner.Service, SessionRunner.Service.of({ run: () => Effect.sync(() => runs++) }))
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
      )

      yield* Effect.scoped(Layer.build(execution))

      expect(runs).toBe(1)
      expect(yield* status.get(SessionSchema.ID.make("ses_recovered_before_dispatch"))).toMatchObject({ type: "busy", phase: "preparing" })
      expect(yield* status.get(SessionSchema.ID.make("ses_recovered_after_dispatch"))).toMatchObject({ type: "interrupted", code: "restart" })
      expect(yield* runtime.get(SessionSchema.ID.make("ses_recovered_after_dispatch"))).toMatchObject({ state: "ready", epoch: 2 })
    }),
  )
  it.effect("pauses a stale execution epoch and records runtime replacement without running", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const status = yield* SessionExecutionStatus.make
      const sessionID = SessionSchema.ID.make("ses_recovered_stale_execution")
      const rootID = SessionMessage.ID.make("msg_recovered_stale_execution")
      yield* db.insert(ProjectTable).values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] }).onConflictDoNothing().run().pipe(Effect.orDie)
      yield* db.insert(SessionTable).values({ id: sessionID, project_id: Project.ID.global, slug: sessionID, directory: "/project", title: "stale", version: "test", runtime: "v2", runtime_state: "draining", runtime_epoch: 1 }).run().pipe(Effect.orDie)
      yield* status.start({ sessionID, owner: "v2", runtimeState: "draining", epoch: 1, activityID: rootID, rootID, activity: "prompt", phase: "preparing" })
      yield* runtime.assign({ sessionID, state: "migrating", expectedOwner: "v2", expectedEpoch: 1 })
      let runs = 0
      const runner = Layer.succeed(SessionRunner.Service, SessionRunner.Service.of({ run: () => Effect.sync(() => runs++) }))
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
      )

      yield* Effect.scoped(Layer.build(execution))

      expect(runs).toBe(0)
      expect(yield* runtime.get(sessionID)).toMatchObject({ owner: "v2", state: "paused", epoch: 3 })
      expect(yield* status.get(sessionID)).toMatchObject({ type: "interrupted", code: "runtime-replaced", epoch: 3 })
    }),
  )
  it.effect("conservatively terminalizes an unsafe persisted provider retry without redispatch", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const events = yield* EventV2.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const status = yield* SessionExecutionStatus.make
      const sessionID = SessionSchema.ID.make("ses_recovered_unsafe_retry")
      const rootID = SessionMessage.ID.make("msg_recovered_unsafe_retry")
      yield* db.insert(ProjectTable).values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] }).onConflictDoNothing().run().pipe(Effect.orDie)
      yield* db.insert(SessionTable).values({ id: sessionID, project_id: Project.ID.global, slug: sessionID, directory: "/project", title: "Recovered retry", version: "test", runtime: "v2", runtime_state: "draining", runtime_epoch: 1 }).run().pipe(Effect.orDie)
      const fence = { sessionID, owner: "v2" as const, runtimeState: "draining" as const, epoch: 1, activityID: rootID, rootID, activity: "prompt" as const }
      yield* status.start({ ...fence, phase: "preparing" })
      yield* status.dispatch({ ...fence, phase: "provider", requestAttempt: 1, providerAttempt: 1, recovery: "interrupt", fingerprint: "a".repeat(64) })
      yield* status.complete({ ...fence, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint: "a".repeat(64) })
      yield* status.retry({ ...fence, phase: "provider", requestAttempt: 1, providerAttempt: 2, attempt: 1, maxAttempts: 5, nextAt: 50_000, code: "server", action: "retry-provider", message: "retry later", recovery: "interrupt", fingerprint: "a".repeat(64) })
      let runs = 0
      const runner = Layer.succeed(SessionRunner.Service, SessionRunner.Service.of({ run: () => Effect.sync(() => runs++) }))
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
      )

      yield* Effect.all([
        Effect.scoped(Layer.build(Layer.fresh(execution))),
        Effect.scoped(Layer.build(Layer.fresh(execution))),
      ], { concurrency: "unbounded", discard: true })

      expect(runs).toBe(0)
      expect(yield* status.get(sessionID)).toMatchObject({ type: "interrupted", code: "restart", message: "Provider retry cannot be reconstructed safely after restart" })
      expect(yield* runtime.get(sessionID)).toMatchObject({ owner: "v2", state: "ready", epoch: 2 })
      expect(yield* db.select().from(EventTable).where(eq(EventTable.type, "session.next.execution.interrupted.1")).all().pipe(Effect.orDie)).toHaveLength(1)
    }),
  )
  it.effect("registers a future durable retry without dispatching before its deadline", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const status = yield* SessionExecutionStatus.make
      const sessionID = SessionSchema.ID.make("ses_recovered_future_retry")
      const rootID = SessionMessage.ID.make("msg_recovered_future_retry")
      yield* db.insert(ProjectTable).values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] }).onConflictDoNothing().run().pipe(Effect.orDie)
      yield* db.insert(SessionTable).values({ id: sessionID, project_id: Project.ID.global, slug: sessionID, directory: "/project", title: "future", version: "test", runtime: "v2", runtime_state: "draining", runtime_epoch: 1 }).run().pipe(Effect.orDie)
      const fence = { sessionID, owner: "v2" as const, runtimeState: "draining" as const, epoch: 1, activityID: rootID, rootID, activity: "prompt" as const }
      yield* status.start({ ...fence, phase: "preparing" })
      yield* status.dispatch({ ...fence, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint: "a".repeat(64) })
      yield* status.complete({ ...fence, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint: "a".repeat(64) })
      yield* status.retry({ ...fence, phase: "provider", requestAttempt: 1, providerAttempt: 2, attempt: 1, maxAttempts: 5, nextAt: 1_000, code: "server", action: "retry-provider", message: "safe", recovery: "retry-provider", fingerprint: "a".repeat(64) })
      let runs = 0
      const runner = Layer.succeed(SessionRunner.Service, SessionRunner.Service.of({ run: () => Effect.sync(() => runs++) }))
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
      )

      yield* Effect.gen(function* () {
        yield* SessionExecution.Service
        yield* TestClock.adjust(999)
        expect(runs).toBe(0)
        yield* TestClock.adjust(1)
        yield* Effect.yieldNow
        expect(runs).toBe(1)
      }).pipe(Effect.provide(execution))
    }),
  )
  it.effect("conservatively terminalizes generic completion crash windows without redispatch", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const status = yield* SessionExecutionStatus.make
      yield* db.insert(ProjectTable).values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] }).onConflictDoNothing().run().pipe(Effect.orDie)
      const cases = ["successful", "failed-before-retry", "nonretryable-before-terminal"]
      for (const item of cases) {
        const sessionID = SessionSchema.ID.make(`ses_recovered_completion_${item}`)
        const rootID = SessionMessage.ID.make(`msg_recovered_completion_${item}`)
        yield* db.insert(SessionTable).values({ id: sessionID, project_id: Project.ID.global, slug: sessionID, directory: "/project", title: item, version: "test", runtime: "v2", runtime_state: "draining", runtime_epoch: 1 }).run().pipe(Effect.orDie)
        const fence = { sessionID, owner: "v2" as const, runtimeState: "draining" as const, epoch: 1, activityID: rootID, rootID, activity: "prompt" as const }
        yield* status.start({ ...fence, phase: "preparing" })
        yield* status.dispatch({ ...fence, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint: "a".repeat(64) })
        yield* status.complete({ ...fence, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint: "a".repeat(64) })
      }
      const runs: SessionSchema.ID[] = []
      const runner = Layer.succeed(SessionRunner.Service, SessionRunner.Service.of({ run: (input) => Effect.sync(() => runs.push(input.sessionID)) }))
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
      )

      yield* Effect.scoped(Layer.build(execution))
      expect(runs).toEqual([])
      for (const item of cases)
        expect(yield* status.get(SessionSchema.ID.make(`ses_recovered_completion_${item}`))).toMatchObject({ type: "interrupted", code: "restart" })
    }),
  )
  it.effect("wakes only an explicitly durable provider continuation", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const status = yield* SessionExecutionStatus.make
      const sessionID = SessionSchema.ID.make("ses_recovered_explicit_continuation")
      const rootID = SessionMessage.ID.make("msg_recovered_explicit_continuation")
      const fingerprint = "f".repeat(64)
      yield* db.insert(ProjectTable).values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] }).onConflictDoNothing().run().pipe(Effect.orDie)
      yield* db.insert(SessionTable).values({ id: sessionID, project_id: Project.ID.global, slug: sessionID, directory: "/project", title: "continuation", version: "test", runtime: "v2", runtime_state: "draining", runtime_epoch: 1 }).run().pipe(Effect.orDie)
      const fence = { sessionID, owner: "v2" as const, runtimeState: "draining" as const, epoch: 1, activityID: rootID, rootID, activity: "prompt" as const }
      yield* status.start({ ...fence, phase: "preparing" })
      yield* status.dispatch({ ...fence, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint })
      yield* status.complete({ ...fence, phase: "tool", requestAttempt: 1, providerAttempt: 1, fingerprint })
      yield* (status as unknown as {
        readonly continue: (input: typeof fence & { readonly phase: "tool"; readonly requestAttempt: number; readonly providerAttempt: number; readonly fingerprint: string }) => Effect.Effect<unknown>
      }).continue({ ...fence, phase: "tool", requestAttempt: 1, providerAttempt: 1, fingerprint })
      const runs: SessionSchema.ID[] = []
      const runner = Layer.succeed(SessionRunner.Service, SessionRunner.Service.of({ run: (input) => Effect.sync(() => runs.push(input.sessionID)) }))
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
      )

      yield* Effect.scoped(Layer.build(execution))
      expect(runs).toEqual([sessionID])
    }),
  )
  it.effect("reconstructs each durable proof when the continuation marker was not published", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const db = database.db
      const events = yield* EventV2.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const status = yield* SessionExecutionStatus.make
      yield* db.insert(ProjectTable).values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] }).onConflictDoNothing().run().pipe(Effect.orDie)
      const cases = ["tool", "structured", "compaction", "steer"] as const
      for (const kind of cases) {
        const sessionID = SessionSchema.ID.make(`ses_recovered_proof_${kind}`)
        const rootID = SessionMessage.ID.make(`msg_recovered_proof_${kind}`)
        const assistantMessageID = SessionMessage.ID.make(`msg_recovered_proof_${kind}_assistant`)
        const fingerprint = kind.charCodeAt(0).toString(16).repeat(64).slice(0, 64)
        yield* db.insert(SessionTable).values({ id: sessionID, project_id: Project.ID.global, slug: sessionID, directory: "/project", title: kind, version: "test", runtime: "v2", runtime_state: "draining", runtime_epoch: 1 }).run().pipe(Effect.orDie)
        const fence = { sessionID, owner: "v2" as const, runtimeState: "draining" as const, epoch: 1, activityID: rootID, rootID, activity: "prompt" as const }
        yield* status.start({ ...fence, phase: "preparing" })
        yield* status.dispatch({ ...fence, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint })
        if (kind === "tool" || kind === "steer") {
          yield* events.publish(SessionEvent.Step.Started, { sessionID, timestamp: yield* DateTime.now, assistantMessageID, rootUserID: rootID, agent: "build", model: { providerID: ProviderV2.ID.make("fake"), id: ModelV2.ID.make("fake") } })
          if (kind === "tool") {
            yield* events.publish(SessionEvent.Tool.CalledV1, { sessionID, timestamp: yield* DateTime.now, assistantMessageID, callID: "call-proof", tool: "echo", input: { text: "done" }, provider: { executed: false } })
            yield* events.publish(SessionEvent.Tool.Success, { sessionID, timestamp: yield* DateTime.now, assistantMessageID, callID: "call-proof", structured: { text: "done" }, content: [], provider: { executed: false } })
          }
          yield* events.publish(SessionEvent.Step.Ended, { sessionID, timestamp: yield* DateTime.now, assistantMessageID, finish: kind === "tool" ? "tool-calls" : "stop", cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } })
        }
        yield* status.complete({ ...fence, phase: kind === "tool" ? "tool" : "provider", requestAttempt: 1, providerAttempt: 1, fingerprint })
        if (kind === "structured")
          yield* events.publish(SessionEvent.Structured.Retry, { sessionID, timestamp: yield* DateTime.now, rootUserID: rootID, assistantMessageID, attempt: 1, remaining: 1, reason: "schema", message: "retry" })
        if (kind === "compaction") {
          const messageID = SessionMessage.ID.make("msg_recovered_proof_compaction_summary")
          yield* events.publish(SessionEvent.Compaction.Started, { sessionID, timestamp: yield* DateTime.now, messageID, reason: "auto" })
          yield* events.publish(SessionEvent.Compaction.Ended, { sessionID, timestamp: yield* DateTime.now, messageID, reason: "auto", text: "summary", recent: "" })
        }
        if (kind === "steer")
          yield* SessionInput.admit(db, events, { id: SessionMessage.ID.make("msg_recovered_proof_steer_pending"), sessionID, prompt: new Prompt({ text: "continue" }), delivery: "steer" })
      }
      expect(yield* db.select().from(EventTable).where(eq(EventTable.type, "session.next.execution.continuation.ready.1")).all().pipe(Effect.orDie)).toEqual([])
      const runs: SessionSchema.ID[] = []
      const runner = Layer.succeed(SessionRunner.Service, SessionRunner.Service.of({ run: (input) => Effect.sync(() => runs.push(input.sessionID)) }))
      const execution = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
      )

      yield* Effect.scoped(Layer.build(execution))
      expect(runs.sort()).toEqual(cases.map((kind) => SessionSchema.ID.make(`ses_recovered_proof_${kind}`)).sort())
      expect(yield* db.select().from(EventTable).where(eq(EventTable.type, "session.next.execution.continuation.ready.1")).all().pipe(Effect.orDie)).toHaveLength(4)
    }),
  )
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
      const wrongTypeMessage = SessionMessage.ID.make("msg_wrong_type_task_origin")
      const corruptMessage = SessionMessage.ID.make("msg_corrupt_task_origin")
      const parentMismatchMessage = SessionMessage.ID.make("msg_parent_mismatch_task_origin")
      const originOwnerMessage = SessionMessage.ID.make("msg_owner_task_origin")
      const originPayloadMessage = SessionMessage.ID.make("msg_payload_task_origin")
      const fabricated = SessionTask.childID(parentID, fabricatedMessage, "call-fabricated")
      const damaged = SessionTask.childID(parentID, damagedMessage, "call-damaged")
      const wrongType = SessionTask.childID(parentID, wrongTypeMessage, "call-wrong-type")
      const corrupt = SessionTask.childID(parentID, corruptMessage, "call-corrupt")
      const parentMismatch = SessionTask.childID(parentID, parentMismatchMessage, "call-parent-mismatch")
      const originMismatch = SessionTask.childID(parentID, originOwnerMessage, "call-owner-origin")
      const otherParent = SessionSchema.ID.make("ses_other_damaged_task_parent")
      const model = ModelV2.Ref.make({ providerID: ProviderV2.ID.make("fake"), id: ModelV2.ID.make("fake") })
      const timestamp = yield* DateTime.now
      const request = (
        messageID: SessionMessage.ID,
        callID: string,
        childSessionID: SessionSchema.ID,
        title: string,
      ) => ({
        sessionID: parentID,
        timestamp,
        assistantMessageID: messageID,
        callID,
        childSessionID,
        promptMessageID: SessionTask.promptID(parentID, messageID, callID),
        description: title,
        prompt: "must not execute",
        agent: "general" as const,
        model,
        multiAgent: "v2" as const,
        callerAgent: AgentV2.ID.make("build"),
        permissions: [],
        plan: { multiAgent: "v2" as const },
        projectID: Project.ID.global,
        location: { directory: AbsolutePath.make("/project") },
        title,
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
            title: "Damaged task parent",
            version: "test",
            runtime: "v2" as const,
          },
          {
            id: otherParent,
            project_id: Project.ID.global,
            slug: otherParent,
            directory: "/project",
            title: "Other damaged task parent",
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
          {
            id: wrongType,
            project_id: Project.ID.global,
            parent_id: parentID,
            slug: wrongType,
            directory: "/project",
            title: "Wrong type (@general subagent)",
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
                origin: { messageID: wrongTypeMessage, callID: "call-wrong-type" },
                ceiling: [],
              },
            },
          },
          {
            id: corrupt,
            project_id: Project.ID.global,
            parent_id: parentID,
            slug: corrupt,
            directory: "/project",
            title: "Corrupt (@general subagent)",
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
                origin: { messageID: corruptMessage, callID: "call-corrupt" },
                ceiling: [],
              },
            },
          },
          {
            id: parentMismatch,
            project_id: Project.ID.global,
            parent_id: otherParent,
            slug: parentMismatch,
            directory: "/project",
            title: "Parent mismatch (@general subagent)",
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
                origin: { messageID: parentMismatchMessage, callID: "call-parent-mismatch" },
                ceiling: [],
              },
            },
          },
          {
            id: originMismatch,
            project_id: Project.ID.global,
            parent_id: parentID,
            slug: originMismatch,
            directory: "/project",
            title: "Origin mismatch (@general subagent)",
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
                origin: { messageID: originOwnerMessage, callID: "call-owner-origin" },
                ceiling: [],
              },
            },
          },
        ])
        .run()
        .pipe(Effect.orDie)
      yield* events.publish(
        SessionEvent.InterruptRequested,
        { sessionID: parentID, timestamp: yield* DateTime.now },
        { id: SessionTask.requestEventID(parentID, wrongTypeMessage, "call-wrong-type") },
      )
      yield* events.publish(
        SessionEvent.Task.Requested,
        {
          sessionID: parentID,
          timestamp: yield* DateTime.now,
          assistantMessageID: corruptMessage,
          callID: "call-corrupt",
          childSessionID: corrupt,
          promptMessageID: SessionTask.promptID(parentID, corruptMessage, "call-corrupt"),
          description: "Corrupt",
          prompt: "must not execute",
          agent: "general",
          model,
          multiAgent: "v2",
          callerAgent: "build",
          permissions: [],
          plan: { multiAgent: "v2" },
          projectID: Project.ID.global,
          location: { directory: AbsolutePath.make("/project") },
          title: "Corrupt (@general subagent)",
          ceiling: [],
        },
        { id: SessionTask.requestEventID(parentID, corruptMessage, "call-corrupt") },
      )
      yield* db
        .update(EventTable)
        .set({ data: { corrupt: true } })
        .where(eq(EventTable.id, SessionTask.requestEventID(parentID, corruptMessage, "call-corrupt")))
        .run()
        .pipe(Effect.orDie)
      yield* events.publish(
        SessionEvent.Task.Requested,
        request(
          parentMismatchMessage,
          "call-parent-mismatch",
          parentMismatch,
          "Parent mismatch (@general subagent)",
        ),
        { id: SessionTask.requestEventID(parentID, parentMismatchMessage, "call-parent-mismatch") },
      )
      yield* events.publish(
        SessionEvent.Task.Requested,
        request(
          originPayloadMessage,
          "call-payload-origin",
          originMismatch,
          "Origin mismatch (@general subagent)",
        ),
        { id: SessionTask.requestEventID(parentID, originOwnerMessage, "call-owner-origin") },
      )
      yield* Effect.forEach(
        [fabricated, damaged, wrongType, corrupt, parentMismatch, originMismatch],
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

      expect(
        (yield* SessionTask.request(db, parentID, wrongTypeMessage, "call-wrong-type").pipe(Effect.exit))._tag,
      ).toBe("Failure")
      expect(
        (yield* SessionTask.request(db, parentID, corruptMessage, "call-corrupt").pipe(Effect.exit))._tag,
      ).toBe("Failure")
      yield* Effect.gen(function* () {
        yield* SessionExecution.Service
        yield* events.publish(SessionEvent.Task.Execute, {
          sessionID: parentID,
          timestamp: yield* DateTime.now,
          assistantMessageID: wrongTypeMessage,
          callID: "call-wrong-type",
          childSessionID: wrongType,
        })
        yield* events.publish(SessionEvent.Task.Execute, {
          sessionID: parentID,
          timestamp: yield* DateTime.now,
          assistantMessageID: corruptMessage,
          callID: "call-corrupt",
          childSessionID: corrupt,
        })
        yield* events.publish(SessionEvent.Task.Execute, {
          sessionID: parentID,
          timestamp: yield* DateTime.now,
          assistantMessageID: parentMismatchMessage,
          callID: "call-parent-mismatch",
          childSessionID: parentMismatch,
        })
        yield* events.publish(SessionEvent.Task.Execute, {
          sessionID: parentID,
          timestamp: yield* DateTime.now,
          assistantMessageID: originOwnerMessage,
          callID: "call-owner-origin",
          childSessionID: originMismatch,
        })
        yield* Effect.yieldNow
      }).pipe(Effect.provide(execution))

      expect(yield* SessionTask.orphaned(db, fabricated)).toBeTrue()
      expect(yield* SessionTask.orphaned(db, damaged)).toBeTrue()
      expect(yield* SessionTask.orphaned(db, wrongType)).toBeTrue()
      expect(yield* SessionTask.orphaned(db, corrupt)).toBeTrue()
      expect(yield* SessionTask.orphaned(db, parentMismatch)).toBeTrue()
      expect(yield* SessionTask.orphaned(db, originMismatch)).toBeTrue()
      expect(yield* SessionTask.cancelled(db, parentID, parentMismatchMessage, "call-parent-mismatch")).toBeTrue()
      expect(yield* SessionTask.cancelled(db, parentID, originOwnerMessage, "call-owner-origin")).toBeTrue()
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
