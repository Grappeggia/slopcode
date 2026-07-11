import { describe, expect } from "bun:test"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { SessionControl as CoreSessionControl } from "@slopcode-ai/core/session/control"
import { Project } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionInput } from "@slopcode-ai/core/session/input"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionExecution } from "@slopcode-ai/core/session/execution"
import { SessionRuntime } from "@slopcode-ai/core/session/runtime"
import { SessionStore } from "@slopcode-ai/core/session/store"
import { SessionTable } from "@slopcode-ai/core/session/sql"
import { SessionV1 } from "@slopcode-ai/core/v1/session"
import { eq, sql } from "drizzle-orm"
import { Context, DateTime, Deferred, Effect, Exit, Fiber, Layer, Scope, Stream } from "effect"
import { SessionControl } from "../../src/session/control"
import { SessionPrompt } from "../../src/session/prompt"
import { MessageID, SessionID } from "../../src/session/schema"
import { testEffect } from "../lib/effect"

const database = Database.layerFromPath(":memory:")
const runtime = SessionRuntime.layer.pipe(Layer.provide(database))
const sessionID = SessionID.make("ses_control_test")
const legacyCalls: SessionPrompt.PromptInput[] = []
const legacyCancelCalls: SessionID[] = []
const legacyCancelGates: Effect.Effect<void>[] = []
const v2Calls: Array<{ readonly prompt: string; readonly resume?: boolean }> = []
const interruptCalls: SessionID[] = []
const realInterruptCalls: SessionID[] = []
const legacyMessage = {
  info: {
    id: MessageID.ascending(),
    role: "user",
    sessionID,
    time: { created: 0 },
    agent: "build",
    model: { providerID: "test", modelID: "test" },
  },
  parts: [],
} as unknown as SessionV1.WithParts

const legacy = Layer.succeed(
  SessionPrompt.Service,
  SessionPrompt.Service.of({
    cancel: (id, coordinate) => {
      const cancel = Effect.gen(function* () {
        yield* legacyCancelGates.shift() ?? Effect.void
        legacyCancelCalls.push(id)
      })
      return coordinate ? coordinate(cancel) : cancel
    },
    prompt: (input, guard) =>
      Effect.gen(function* () {
        yield* guard ?? Effect.void
        legacyCalls.push(input)
        return legacyMessage
      }),
    loop: () => Effect.succeed(legacyMessage),
    shell: () => Effect.die("unused"),
    command: () => Effect.die("unused"),
    resolvePromptParts: () => Effect.succeed([]),
  }),
)

const sessions = Layer.succeed(
  SessionV2.Service,
  SessionV2.Service.of({
    list: () => Effect.succeed([]),
    create: () => Effect.die("unused"),
    get: () => Effect.die("unused"),
    messages: () => Effect.succeed([]),
    message: () => Effect.succeed(undefined),
    context: () => Effect.succeed([]),
    events: () => Stream.empty,
    switchAgent: () => Effect.die("unused"),
    switchModel: () => Effect.void,
    prompt: (input, commit) =>
      Effect.gen(function* () {
        yield* commit ?? Effect.void
        v2Calls.push({ prompt: input.prompt.text, resume: input.resume })
        return new SessionInput.Admitted({
          admittedSeq: 1,
          id: input.id ?? SessionMessage.ID.create(),
          sessionID: input.sessionID,
          prompt: input.prompt,
          delivery: input.delivery ?? "steer",
          timeCreated: DateTime.makeUnsafe(0),
        })
      }),
    shell: () => Effect.die("unused"),
    skill: () => Effect.die("unused"),
    compact: () => Effect.die("unused"),
    wait: () => Effect.die("unused"),
    resume: () => Effect.void,
    interrupt: (id, commit) =>
      Effect.gen(function* () {
        yield* commit ?? Effect.void
        interruptCalls.push(SessionID.make(id))
      }),
  }),
)
const core = CoreSessionControl.layer.pipe(Layer.provide(runtime), Layer.provide(sessions))
const control = SessionControl.layer.pipe(
  Layer.provide(runtime),
  Layer.provide(legacy),
  Layer.provide(core),
  Layer.provide(sessions),
)
const it = testEffect(Layer.mergeAll(database, runtime, legacy, sessions, core, control))

const realEvents = EventV2.layer.pipe(Layer.provide(database))
const realStore = SessionStore.layer.pipe(Layer.provide(database))
const realExecution = Layer.mock(SessionExecution.Service, {
  interrupt: (id) => Effect.sync(() => realInterruptCalls.push(SessionID.make(id))),
})
const realSessions = SessionV2.layer.pipe(
  Layer.provide(realEvents),
  Layer.provide(database),
  Layer.provide(realStore),
  Layer.provide(Project.defaultLayer),
  Layer.provide(realExecution),
  Layer.provide(LocationServiceMap.layer),
)

const setup = Effect.gen(function* () {
  const { db } = yield* Database.Service
  legacyCalls.length = 0
  legacyCancelCalls.length = 0
  legacyCancelGates.length = 0
  v2Calls.length = 0
  interruptCalls.length = 0
  realInterruptCalls.length = 0
  yield* db
    .insert(ProjectTable)
    .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
    .onConflictDoNothing()
    .run()
    .pipe(Effect.orDie)
  yield* db
    .update(SessionTable)
    .set({ runtime: "v1", runtime_state: "ready", runtime_epoch: 0 })
    .where(eq(SessionTable.id, sessionID))
    .run()
    .pipe(Effect.orDie)
  yield* db
    .insert(SessionTable)
    .values({
      id: sessionID,
      project_id: Project.ID.global,
      slug: "test",
      directory: "/project",
      title: "test",
      version: "test",
    })
    .onConflictDoNothing()
    .run()
    .pipe(Effect.orDie)
})

describe("SessionControl", () => {
  it.effect("routes V1-owned prompts to SessionPrompt", () =>
    Effect.gen(function* () {
      yield* setup
      const control = yield* SessionControl.Service

      expect(yield* control.prompt({ sessionID, parts: [{ type: "text", text: "legacy" }] })).toBe(legacyMessage)
      expect(legacyCalls).toHaveLength(1)
      expect(v2Calls).toEqual([])
    }),
  )

  it.effect("routes ready V1-owned interrupts to SessionPrompt", () =>
    Effect.gen(function* () {
      yield* setup
      const control = yield* SessionControl.Service

      yield* control.cancel(sessionID)
      expect(legacyCancelCalls).toEqual([sessionID])
      expect(interruptCalls).toEqual([])
    }),
  )

  for (const state of ["paused", "draining", "migrating"] as const) {
    it.effect(`rejects V1 prompt and interrupt while ${state} without mutation`, () =>
      Effect.gen(function* () {
        yield* setup
        const control = yield* SessionControl.Service
        const runtime = yield* SessionRuntime.Service
        yield* runtime.assign({ sessionID, state, expectedOwner: "v1", expectedEpoch: 0 })

        expect(
          yield* control.prompt({ sessionID, parts: [{ type: "text", text: state }] }).pipe(Effect.flip),
        ).toMatchObject({ _tag: "SessionRuntime.Mismatch", expectedState: "ready", actualState: state })
        expect(yield* control.cancel(sessionID).pipe(Effect.flip)).toMatchObject({
          _tag: "SessionRuntime.Mismatch",
          expectedState: "ready",
          actualState: state,
        })
        expect(legacyCalls).toEqual([])
        expect(legacyCancelCalls).toEqual([])
      }),
    )
  }

  it.effect("routes V2-owned prompts to SessionV2", () =>
    Effect.gen(function* () {
      yield* setup
      const control = yield* SessionControl.Service
      const runtime = yield* SessionRuntime.Service
      yield* runtime.assign({ sessionID, owner: "v2", expectedOwner: "v1", expectedEpoch: 0 })

      expect(
        yield* control.prompt({ sessionID, noReply: true, parts: [{ type: "text", text: "next" }] }),
      ).toMatchObject({ prompt: { text: "next" } })
      expect(legacyCalls).toEqual([])
      expect(v2Calls).toEqual([{ prompt: "next", resume: false }])
    }),
  )

  for (const state of ["paused", "draining", "migrating"] as const) {
    it.effect(`rejects V2 prompt and interrupt while ${state} without mutation`, () =>
      Effect.gen(function* () {
        yield* setup
        const control = yield* SessionControl.Service
        const runtime = yield* SessionRuntime.Service
        yield* runtime.assign({ sessionID, owner: "v2", state, expectedOwner: "v1", expectedEpoch: 0 })

        expect(
          yield* control.prompt({ sessionID, parts: [{ type: "text", text: state }] }).pipe(Effect.flip),
        ).toMatchObject({ _tag: "SessionRuntime.Mismatch", expectedState: "ready", actualState: state })
        expect(yield* control.cancel(sessionID).pipe(Effect.flip)).toMatchObject({
          _tag: "SessionRuntime.Mismatch",
          expectedState: "ready",
          actualState: state,
        })
        expect(v2Calls).toEqual([])
        expect(interruptCalls).toEqual([])
      }),
    )
  }

  it.effect("fences V2 prompt and interrupt owner, state, and epoch races at mutation", () =>
    Effect.gen(function* () {
      yield* setup
      const { db } = yield* Database.Service
      const runtime = yield* SessionRuntime.Service
      yield* runtime.assign({ sessionID, owner: "v2", expectedOwner: "v1", expectedEpoch: 0 })
      const changes = ["owner", "state", "epoch"] as const
      let change: (typeof changes)[number] = "owner"
      const transition = () =>
        db
          .update(SessionTable)
          .set({
            ...(change === "owner" ? { runtime: "v1" as const } : {}),
            ...(change === "state" ? { runtime_state: "draining" as const } : {}),
            ...(change === "epoch" ? { runtime_epoch: sql`${SessionTable.runtime_epoch} + 1` } : {}),
          })
          .where(eq(SessionTable.id, sessionID))
          .run()
          .pipe(Effect.orDie, Effect.asVoid)
      const fenced = SessionRuntime.Service.of({
        ...runtime,
        assert: (input) =>
          input.epoch === undefined ? runtime.assert(input).pipe(Effect.tap(transition)) : runtime.assert(input),
      })
      const core = CoreSessionControl.layer.pipe(
        Layer.provide(Layer.succeed(SessionRuntime.Service, fenced)),
        Layer.provide(sessions),
      )
      const layer = SessionControl.layer.pipe(
        Layer.provide(Layer.succeed(SessionRuntime.Service, fenced)),
        Layer.provide(legacy),
        Layer.provide(core),
        Layer.provide(sessions),
      )
      const scope = yield* Scope.make()
      yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void))
      const control = Context.get(yield* Layer.buildWithScope(Layer.fresh(layer), scope), SessionControl.Service)

      for (change of changes) {
        for (const operation of [
          () => control.prompt({ sessionID, parts: [{ type: "text", text: change }] }),
          () => control.cancel(sessionID),
        ]) {
          expect(yield* operation().pipe(Effect.flip)).toMatchObject({
            _tag: "SessionRuntime.Mismatch",
            actualOwner: change === "owner" ? "v1" : "v2",
            actualState: change === "state" ? "draining" : "ready",
            actualEpoch: change === "epoch" ? 2 : 1,
          })
          yield* db
            .update(SessionTable)
            .set({ runtime: "v2", runtime_state: "ready", runtime_epoch: 1 })
            .where(eq(SessionTable.id, sessionID))
            .run()
            .pipe(Effect.orDie)
        }
      }
      expect(v2Calls).toEqual([])
      expect(interruptCalls).toEqual([])
    }),
  )

  it.effect("fences V1 prompt and interrupt owner, state, and epoch races at mutation", () =>
    Effect.gen(function* () {
      yield* setup
      const { db } = yield* Database.Service
      const runtime = yield* SessionRuntime.Service
      const changes = ["owner", "state", "epoch"] as const
      let change: (typeof changes)[number] = "owner"
      let checks = 0
      const transition = () =>
        db
          .update(SessionTable)
          .set({
            ...(change === "owner" ? { runtime: "v2" as const } : {}),
            ...(change === "state" ? { runtime_state: "migrating" as const } : {}),
            ...(change === "epoch" ? { runtime_epoch: sql`${SessionTable.runtime_epoch} + 1` } : {}),
          })
          .where(eq(SessionTable.id, sessionID))
          .run()
          .pipe(Effect.orDie, Effect.asVoid)
      const fenced = SessionRuntime.Service.of({
        ...runtime,
        assert: (input) => runtime.assert(input).pipe(Effect.tap(() => (++checks === 1 ? transition() : Effect.void))),
      })
      const layer = SessionControl.layer.pipe(
        Layer.provide(Layer.succeed(SessionRuntime.Service, fenced)),
        Layer.provide(legacy),
        Layer.provide(core),
        Layer.provide(sessions),
      )
      const scope = yield* Scope.make()
      yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void))
      const control = Context.get(yield* Layer.buildWithScope(Layer.fresh(layer), scope), SessionControl.Service)

      for (change of changes) {
        for (const operation of [
          () => control.prompt({ sessionID, parts: [{ type: "text", text: change }] }),
          () => control.cancel(sessionID),
        ]) {
          checks = 0
          expect(yield* operation().pipe(Effect.flip)).toMatchObject({
            _tag: "SessionRuntime.Mismatch",
            actualOwner: change === "owner" ? "v2" : "v1",
            actualState: change === "state" ? "migrating" : "ready",
            actualEpoch: change === "epoch" ? 1 : 0,
          })
          yield* db
            .update(SessionTable)
            .set({ runtime: "v1", runtime_state: "ready", runtime_epoch: 0 })
            .where(eq(SessionTable.id, sessionID))
            .run()
            .pipe(Effect.orDie)
        }
      }
      expect(legacyCalls).toEqual([])
      expect(legacyCancelCalls).toEqual([])
    }),
  )

  it.effect("coordinates the V1 cancellation mutation inside the runtime claim", () =>
    Effect.gen(function* () {
      yield* setup
      const runtime = yield* SessionRuntime.Service
      const order: string[] = []
      const coordinated = SessionRuntime.Service.of({
        ...runtime,
        claim: (input, coordinate) =>
          runtime.claim(
            input,
            Effect.sync(() => order.push("claim")).pipe(
              Effect.andThen(coordinate ?? Effect.void),
              Effect.tap(() => Effect.sync(() => order.push("cancelled"))),
            ),
          ),
      })
      const layer = SessionControl.layer.pipe(
        Layer.provide(Layer.succeed(SessionRuntime.Service, coordinated)),
        Layer.provide(legacy),
        Layer.provide(core),
        Layer.provide(sessions),
      )
      const scope = yield* Scope.make()
      yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void))
      const control = Context.get(yield* Layer.buildWithScope(Layer.fresh(layer), scope), SessionControl.Service)

      yield* control.cancel(sessionID)

      expect(order).toEqual(["claim", "cancelled"])
      expect(legacyCancelCalls).toEqual([sessionID])
    }),
  )

  for (const change of ["owner", "state", "epoch"] as const) {
    it.effect(`serializes coordinated cancellation before a concurrent ${change} assignment`, () =>
      Effect.gen(function* () {
        yield* setup
        const runtime = yield* SessionRuntime.Service
        const checked = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        const done = yield* Deferred.make<void>()
        let claimed = false
        legacyCancelGates.push(
          Deferred.succeed(checked, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.asVoid),
        )
        const coordinated = SessionRuntime.Service.of({
          ...runtime,
          claim: (input, coordinate) =>
            Effect.gen(function* () {
              const current = yield* runtime.assert(input)
              claimed = true
              yield* coordinate ?? Effect.void
              claimed = false
              yield* Deferred.succeed(done, undefined)
              return current
            }),
          assign: (input) =>
            Effect.suspend(() => (claimed ? Deferred.await(done) : Effect.void)).pipe(
              Effect.andThen(runtime.assign(input)),
            ),
        })
        const layer = SessionControl.layer.pipe(
          Layer.provide(Layer.succeed(SessionRuntime.Service, coordinated)),
          Layer.provide(legacy),
          Layer.provide(core),
          Layer.provide(sessions),
        )
        const scope = yield* Scope.make()
        yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void))
        const control = Context.get(yield* Layer.buildWithScope(Layer.fresh(layer), scope), SessionControl.Service)
        const cancellation = yield* control.cancel(sessionID).pipe(Effect.forkChild)
        yield* Deferred.await(checked)
        const transition = yield* coordinated
          .assign({
            sessionID,
            ...(change === "owner" ? { owner: "v2" as const } : {}),
            ...(change === "state" ? { state: "migrating" as const } : {}),
            expectedOwner: "v1",
            expectedEpoch: 0,
          })
          .pipe(Effect.forkChild)
        yield* Effect.yieldNow
        expect(transition.pollUnsafe()).toBeUndefined()
        expect(legacyCancelCalls).toEqual([])

        yield* Deferred.succeed(release, undefined)
        yield* Fiber.join(cancellation)
        expect(legacyCancelCalls).toEqual([sessionID])
        expect(yield* Fiber.join(transition)).toMatchObject({
          owner: change === "owner" ? "v2" : "v1",
          state: change === "state" ? "migrating" : "ready",
          epoch: 1,
        })
      }),
    )
  }

  it.effect("fences missing projected V2 sessions with the real Core service before interrupting", () =>
    Effect.gen(function* () {
      yield* setup
      const { db } = yield* Database.Service
      const runtime = yield* SessionRuntime.Service
      yield* runtime.assign({ sessionID, owner: "v2", expectedOwner: "v1", expectedEpoch: 0 })
      const changes = ["owner", "state", "epoch"] as const
      let change: (typeof changes)[number] = "owner"
      const fenced = SessionRuntime.Service.of({
        ...runtime,
        assert: (input) =>
          input.epoch === undefined
            ? runtime.assert(input).pipe(
                Effect.tap(() =>
                  db
                    .update(SessionTable)
                    .set({
                      ...(change === "owner" ? { runtime: "v1" as const } : {}),
                      ...(change === "state" ? { runtime_state: "draining" as const } : {}),
                      ...(change === "epoch" ? { runtime_epoch: sql`${SessionTable.runtime_epoch} + 1` } : {}),
                    })
                    .where(eq(SessionTable.id, sessionID))
                    .run()
                    .pipe(Effect.orDie, Effect.asVoid),
                ),
              )
            : runtime.assert(input),
      })
      const core = CoreSessionControl.layer.pipe(
        Layer.provide(Layer.succeed(SessionRuntime.Service, fenced)),
        Layer.provide(realSessions),
      )
      const layer = SessionControl.layer.pipe(
        Layer.provide(Layer.succeed(SessionRuntime.Service, fenced)),
        Layer.provide(legacy),
        Layer.provide(core),
      )
      const scope = yield* Scope.make()
      yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void))
      const control = Context.get(yield* Layer.buildWithScope(Layer.fresh(layer), scope), SessionControl.Service)

      for (change of changes) {
        expect(yield* control.cancel(sessionID).pipe(Effect.flip)).toMatchObject({
          _tag: "SessionRuntime.Mismatch",
          actualOwner: change === "owner" ? "v1" : "v2",
          actualState: change === "state" ? "draining" : "ready",
          actualEpoch: change === "epoch" ? 2 : 1,
        })
        yield* db
          .update(SessionTable)
          .set({ runtime: "v2", runtime_state: "ready", runtime_epoch: 1 })
          .where(eq(SessionTable.id, sessionID))
          .run()
          .pipe(Effect.orDie)
      }
      expect(realInterruptCalls).toEqual([])
    }),
  )
})
