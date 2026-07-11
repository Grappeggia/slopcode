import { describe, expect } from "bun:test"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { Project } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionExecution } from "@slopcode-ai/core/session/execution"
import * as SessionExecutionLocal from "@slopcode-ai/core/session/execution/local"
import { SessionInput } from "@slopcode-ai/core/session/input"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { Prompt } from "@slopcode-ai/core/session/prompt"
import { SessionProjector } from "@slopcode-ai/core/session/projector"
import { SessionRunner } from "@slopcode-ai/core/session/runner"
import { SessionRuntime } from "@slopcode-ai/core/session/runtime"
import { SessionSchema } from "@slopcode-ai/core/session/schema"
import { SessionTable } from "@slopcode-ai/core/session/sql"
import { SessionStore } from "@slopcode-ai/core/session/store"
import { Deferred, Effect, Fiber, Layer } from "effect"
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
