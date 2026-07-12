import { describe, expect } from "bun:test"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { Project } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionExecutionStatus } from "@slopcode-ai/core/session/execution-status"
import { SessionEvent } from "@slopcode-ai/core/session/event"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionProjector } from "@slopcode-ai/core/session/projector"
import { SessionSchema } from "@slopcode-ai/core/session/schema"
import { SessionExecutionStatusTable, SessionTable } from "@slopcode-ai/core/session/sql"
import { Context, DateTime, Deferred, Effect, Exit, Fiber, Layer, Schema, Scope } from "effect"
import * as TestClock from "effect/testing/TestClock"
import { EventTable } from "@slopcode-ai/core/event/sql"
import { asc, eq, inArray } from "drizzle-orm"
import { testEffect } from "./lib/effect"

const database = Database.layerFromPath(":memory:")
const events = EventV2.layer.pipe(Layer.provide(database))
const projector = SessionProjector.layer.pipe(Layer.provide(events), Layer.provide(database))
const status = SessionExecutionStatus.layer.pipe(Layer.provide(database), Layer.provide(events))
const it = testEffect(Layer.mergeAll(database, events, projector, status))
const sessionID = SessionSchema.ID.make("ses_execution_status")
const rootID = SessionMessage.ID.make("msg_execution_status")

const setup = Effect.gen(function* () {
  const db = (yield* Database.Service).db
  yield* db.insert(ProjectTable).values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] }).onConflictDoNothing().run().pipe(Effect.orDie)
  yield* db.insert(SessionTable).values({
    id: sessionID,
    project_id: Project.ID.global,
    slug: sessionID,
    directory: "/project",
    title: "status",
    version: "test",
    runtime: "v2",
    runtime_state: "draining",
    runtime_epoch: 1,
  }).onConflictDoNothing().run().pipe(Effect.orDie)
})

describe("SessionExecutionStatus", () => {
  it.effect("projects deterministic busy, retrying, and successful settlement", () =>
    Effect.gen(function* () {
      yield* setup
      const service = yield* SessionExecutionStatus.Service
      expect(yield* service.get(sessionID)).toEqual({ type: "idle" })
      const fence = { sessionID, owner: "v2" as const, epoch: 1, runtimeState: "draining" as const }
      const activity = { activityID: rootID, rootID, activity: "prompt" as const }
      const first = yield* service.start({ ...fence, ...activity, phase: "preparing" })
      const duplicate = yield* service.start({ ...fence, ...activity, phase: "preparing" })
      expect(duplicate.seq).toBe(first.seq)
      expect(yield* service.get(sessionID)).toMatchObject({ type: "busy", ...activity, phase: "preparing", epoch: 1 })

      yield* service.dispatch({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint: "a".repeat(64) })
      yield* service.complete({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint: "a".repeat(64) })
      yield* service.retry({
        ...fence,
        ...activity,
        phase: "provider",
        requestAttempt: 1,
        providerAttempt: 2,
        attempt: 1,
        maxAttempts: 5,
        structuredAttempt: 3,
        nextAt: 12_000,
        code: "server",
        action: "retry-provider",
        message: "Provider unavailable",
        fingerprint: "a".repeat(64),
      })
      expect(yield* service.get(sessionID)).toMatchObject({
        type: "retrying",
        providerAttempt: 2,
        structuredAttempt: 3,
        attempt: 1,
        maxAttempts: 5,
        nextAt: 12_000,
      })
      yield* service.dispatch({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 2, fingerprint: "a".repeat(64), now: 12_000 })
      yield* service.complete({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 2, fingerprint: "a".repeat(64) })
      yield* service.succeed({ ...fence, ...activity })
      expect(yield* service.get(sessionID)).toEqual({ type: "idle" })
    }),
  )

  it.effect("retains bounded terminals until a new activity starts", () =>
    Effect.gen(function* () {
      yield* setup
      const service = yield* SessionExecutionStatus.Service
      const fence = { sessionID, owner: "v2" as const, epoch: 1, runtimeState: "draining" as const }
      const activity = { activityID: rootID, rootID, activity: "shell" as const }
      yield* service.start({ ...fence, ...activity, phase: "shell" })
      yield* service.interrupt({ ...fence, ...activity, phase: "shell", code: "interrupted", message: "Stopped", resultingEpoch: 2 })
      expect(yield* service.get(sessionID)).toMatchObject({ type: "interrupted", code: "interrupted", epoch: 2 })

      yield* (yield* Database.Service).db.update(SessionTable).set({ runtime_state: "draining", runtime_epoch: 3 }).where(eq(SessionTable.id, sessionID)).run().pipe(Effect.orDie)
      yield* service.start({ ...fence, epoch: 3, ...activity, phase: "shell" })
      expect(yield* service.get(sessionID)).toMatchObject({ type: "busy", activityID: rootID, epoch: 3 })
      yield* service.interrupt({ ...fence, epoch: 3, ...activity, phase: "shell", code: "interrupted", message: "Stopped again", resultingEpoch: 4 })

      const next = SessionMessage.ID.make("msg_execution_status_next")
      yield* (yield* Database.Service).db.update(SessionTable).set({ runtime_state: "draining", runtime_epoch: 5 }).where(eq(SessionTable.id, sessionID)).run().pipe(Effect.orDie)
      yield* service.start({
        sessionID,
        owner: "v2",
        epoch: 5,
        runtimeState: "draining",
        activityID: next,
        rootID: next,
        activity: "compaction",
        phase: "compaction",
      })
      expect(yield* service.get(sessionID)).toMatchObject({ type: "busy", activityID: next })
    }),
  )

  it.effect("lists only V2 projected non-idle state and rejects stale fences", () =>
    Effect.gen(function* () {
      yield* setup
      const service = yield* SessionExecutionStatus.Service
      const activity = { activityID: rootID, rootID, activity: "prompt" as const }
      yield* service.start({ sessionID, owner: "v2", epoch: 1, runtimeState: "draining", ...activity, phase: "preparing" })
      expect(yield* service.list({ owner: "v2", nonIdle: true })).toHaveLength(1)
      expect((yield* service.fail({
        sessionID,
        owner: "v2",
        epoch: 0,
        runtimeState: "draining",
        ...activity,
        code: "runner-failure",
        message: "stale",
        resultingEpoch: 1,
      }).pipe(Effect.exit))._tag).toBe("Failure")
      expect(yield* service.get(sessionID)).toMatchObject({ type: "busy" })
    }),
  )

  it.effect("stores real transition time once while duplicate publication stays idempotent", () =>
    Effect.gen(function* () {
      yield* setup
      const service = yield* SessionExecutionStatus.Service
      const fence = { sessionID, owner: "v2" as const, epoch: 1, runtimeState: "draining" as const }
      const activity = { activityID: rootID, rootID, activity: "prompt" as const }
      yield* TestClock.setTime(1_000)
      const first = yield* service.start({ ...fence, ...activity, phase: "preparing" })
      yield* TestClock.setTime(9_000)
      const duplicate = yield* service.start({ ...fence, ...activity, phase: "preparing" })
      const row = yield* (yield* Database.Service).db.select({ data: EventTable.data }).from(EventTable).where(eq(EventTable.id, first.id)).get().pipe(Effect.orDie)

      expect(duplicate.seq).toBe(first.seq)
      expect(row?.data).toMatchObject({ timestamp: 1_000 })
    }),
  )

  it.effect("settles one root without releasing before a distinct root starts", () =>
    Effect.gen(function* () {
      yield* setup
      const service = yield* SessionExecutionStatus.Service
      const db = (yield* Database.Service).db
      const fence = { sessionID, owner: "v2" as const, epoch: 1, runtimeState: "draining" as const }
      const first = { activityID: rootID, rootID, activity: "prompt" as const }
      const nextID = SessionMessage.ID.make("msg_execution_status_queued")
      const next = { activityID: nextID, rootID: nextID, activity: "prompt" as const }

      yield* service.start({ ...fence, ...first, phase: "preparing" })
      yield* service.succeed({ ...fence, ...first, release: false })
      expect(yield* service.get(sessionID)).toEqual({ type: "idle" })
      expect(yield* db.select({ state: SessionTable.runtime_state, epoch: SessionTable.runtime_epoch }).from(SessionTable).where(eq(SessionTable.id, sessionID)).get().pipe(Effect.orDie)).toEqual({ state: "draining", epoch: 1 })

      yield* service.start({ ...fence, ...next, phase: "preparing" })
      expect(yield* service.get(sessionID)).toMatchObject({ type: "busy", activityID: nextID, epoch: 1 })
    }),
  )

  it.effect("claims one retry dispatch under concurrent wake attempts", () =>
    Effect.gen(function* () {
      yield* setup
      const service = yield* SessionExecutionStatus.Service
      const fence = { sessionID, owner: "v2" as const, epoch: 1, runtimeState: "draining" as const }
      const activity = { activityID: rootID, rootID, activity: "prompt" as const }
      yield* service.start({ ...fence, ...activity, phase: "preparing" })
      yield* service.dispatch({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint: "a".repeat(64) })
      yield* service.complete({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint: "a".repeat(64) })
      yield* service.retry({
        ...fence,
        ...activity,
        phase: "provider",
        requestAttempt: 1,
        providerAttempt: 2,
        attempt: 1,
        maxAttempts: 5,
        nextAt: 0,
        code: "server",
        action: "retry-provider",
        message: "safe",
        recovery: "retry-provider",
        fingerprint: "a".repeat(64),
      })

      const claims = yield* Effect.all(
        Array.from({ length: 4 }, () => service.dispatch({
          ...fence,
          ...activity,
          phase: "provider",
          requestAttempt: 1,
          providerAttempt: 2,
          recovery: "retry-provider",
          fingerprint: "a".repeat(64),
          now: 0,
        }).pipe(Effect.exit)),
        { concurrency: "unbounded" },
      )

      expect(claims.filter(Exit.isSuccess).filter((claim) => claim.value.claimed)).toHaveLength(1)
    }),
  )

  it.effect("forces two independent event services through one dispatch barrier and streams once", () =>
    Effect.gen(function* () {
      yield* setup
      const service = yield* SessionExecutionStatus.Service
      const database = yield* Database.Service
      const fence = { sessionID, owner: "v2" as const, epoch: 1, runtimeState: "draining" as const }
      const activity = { activityID: rootID, rootID, activity: "prompt" as const }
      const fingerprint = "c".repeat(64)
      yield* service.start({ ...fence, ...activity, phase: "preparing" })
      yield* service.dispatch({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint })
      yield* service.complete({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint })
      yield* service.retry({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 2, attempt: 1, maxAttempts: 5, nextAt: 0, code: "server", action: "retry-provider", message: "safe", fingerprint })
      const scope = yield* Scope.make()
      const make = Effect.gen(function* () {
        const context = yield* Layer.buildWithScope(Layer.fresh(EventV2.layer.pipe(Layer.provide(Layer.succeed(Database.Service, database)))), scope)
        const events = Context.get(context, EventV2.Service)
        yield* SessionExecutionStatus.project(events, database.db)
        return yield* SessionExecutionStatus.make.pipe(Effect.provideService(EventV2.Service, events))
      })
      const left = yield* make
      const right = yield* make
      const ready = yield* Deferred.make<void>()
      const gate = yield* Deferred.make<void>()
      let arrivals = 0
      let streams = 0
      const llm = { stream: () => { streams++ } }
      const attempt = (candidate: SessionExecutionStatus.Interface) => Effect.gen(function* () {
        arrivals++
        if (arrivals === 2) yield* Deferred.succeed(ready, undefined)
        yield* Deferred.await(gate)
        const claim = yield* candidate.dispatch({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 2, fingerprint, now: 0 })
        if (claim.claimed) llm.stream()
      })
      const claims = yield* Effect.all([attempt(left), attempt(right)], { concurrency: "unbounded" }).pipe(Effect.forkChild)
      yield* Deferred.await(ready)
      yield* Deferred.succeed(gate, undefined)
      yield* Fiber.join(claims)

      expect(streams).toBe(1)
      yield* Scope.close(scope, Exit.void)
    }),
  )

  it.effect("rolls back the status claim when deterministic dispatch event insertion fails", () =>
    Effect.gen(function* () {
      yield* setup
      const service = yield* SessionExecutionStatus.Service
      const events = yield* EventV2.Service
      const db = (yield* Database.Service).db
      const fence = { sessionID, owner: "v2" as const, epoch: 1, runtimeState: "draining" as const }
      const activity = { activityID: rootID, rootID, activity: "prompt" as const }
      const fingerprint = "d".repeat(64)
      yield* service.start({ ...fence, ...activity, phase: "preparing" })
      yield* service.dispatch({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint })
      yield* service.complete({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint })
      yield* service.retry({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 2, attempt: 1, maxAttempts: 5, nextAt: 0, code: "server", action: "retry-provider", message: "safe", fingerprint })
      const before = yield* db.select().from(SessionExecutionStatusTable).where(eq(SessionExecutionStatusTable.session_id, sessionID)).get().pipe(Effect.orDie)
      yield* events.beforeCommit((event) => event.type === SessionEvent.Execution.ProviderDispatched.type ? Effect.die("forced dispatch insertion failure") : Effect.void)

      expect((yield* service.dispatch({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 2, fingerprint, now: 0 }).pipe(Effect.exit))._tag).toBe("Failure")
      const after = yield* db.select().from(SessionExecutionStatusTable).where(eq(SessionExecutionStatusTable.session_id, sessionID)).get().pipe(Effect.orDie)
      expect(after).toEqual(before)
      expect(yield* db.select().from(EventTable).where(eq(EventTable.id, SessionExecutionStatus.eventID({ ...fence, ...activity, kind: SessionEvent.Execution.ProviderDispatched.type, requestAttempt: 1, providerAttempt: 2 }))).get().pipe(Effect.orDie)).toBeUndefined()
    }),
  )

  it.effect("rebuilds the complete execution status projection from its event log", () =>
    Effect.gen(function* () {
      const service = yield* SessionExecutionStatus.Service
      const events = yield* EventV2.Service
      const db = (yield* Database.Service).db
      yield* db.insert(ProjectTable).values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] }).onConflictDoNothing().run().pipe(Effect.orDie)
      const ids = ["continuation", "terminal", "success"] as const
      for (const kind of ids) {
        const id = SessionSchema.ID.make(`ses_execution_status_replay_${kind}`)
        const root = SessionMessage.ID.make(`msg_execution_status_replay_${kind}`)
        const fingerprint = kind.charCodeAt(0).toString(16).repeat(64).slice(0, 64)
        const fence = { sessionID: id, owner: "v2" as const, epoch: 1, runtimeState: "draining" as const }
        const activity = { activityID: root, rootID: root, activity: "prompt" as const }
        yield* db.insert(SessionTable).values({ id, project_id: Project.ID.global, slug: id, directory: "/project", title: kind, version: "test", runtime: "v2", runtime_state: "draining", runtime_epoch: 1 }).run().pipe(Effect.orDie)
        yield* service.start({ ...fence, ...activity, phase: "preparing" })
        yield* service.dispatch({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint })
        yield* service.complete({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint })
        if (kind === "continuation") yield* service.continue({ ...fence, ...activity, phase: "tool", requestAttempt: 1, providerAttempt: 1, fingerprint })
        if (kind === "terminal") yield* service.fail({ ...fence, ...activity, phase: "settling", requestAttempt: 1, providerAttempt: 1, fingerprint, code: "runner-failure", message: "failed", resultingEpoch: 2 })
        if (kind === "success") yield* service.succeed({ ...fence, ...activity, phase: "settling", requestAttempt: 1, providerAttempt: 1, fingerprint, release: false })
      }
      const expected = new Map(yield* Effect.forEach(ids, (kind) => {
        const id = SessionSchema.ID.make(`ses_execution_status_replay_${kind}`)
        return service.get(id).pipe(Effect.map((value) => [id, value] as const))
      }))
      const replayIDs = ids.map((kind) => SessionSchema.ID.make(`ses_execution_status_replay_${kind}`))
      const recorded = yield* db.select().from(EventTable).where(inArray(EventTable.aggregate_id, replayIDs)).orderBy(asc(EventTable.seq)).all().pipe(Effect.orDie)

      yield* Effect.forEach(ids, (kind) => {
        const id = SessionSchema.ID.make(`ses_execution_status_replay_${kind}`)
        return events.remove(id).pipe(Effect.andThen(db.delete(SessionExecutionStatusTable).where(eq(SessionExecutionStatusTable.session_id, id)).run()), Effect.orDie)
      }, { discard: true })
      yield* Effect.forEach(replayIDs, (id) => events.replayAll(recorded.filter((event) => event.aggregate_id === id).map((event) => ({ id: event.id, aggregateID: event.aggregate_id, seq: event.seq, type: event.type, data: event.data }))), { discard: true })
      for (const [id, value] of expected) expect(yield* service.get(id)).toEqual(value)
    }),
  )

  it.effect("rejects early and mismatched retry claims without changing durable state", () =>
    Effect.gen(function* () {
      yield* setup
      const service = yield* SessionExecutionStatus.Service
      const fence = { sessionID, owner: "v2" as const, epoch: 1, runtimeState: "draining" as const }
      const activity = { activityID: rootID, rootID, activity: "prompt" as const }
      const fingerprint = "b".repeat(64)
      yield* service.start({ ...fence, ...activity, phase: "preparing" })
      yield* service.dispatch({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint })
      yield* service.complete({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint })
      yield* service.retry({
        ...fence,
        ...activity,
        phase: "provider",
        requestAttempt: 1,
        providerAttempt: 2,
        attempt: 1,
        maxAttempts: 5,
        nextAt: 10_000,
        code: "server",
        action: "retry-provider",
        message: "safe",
        recovery: "retry-provider",
        fingerprint,
      })

      for (const input of [
        { requestAttempt: 1, providerAttempt: 2, fingerprint, now: 9_999 },
        { requestAttempt: 2, providerAttempt: 2, fingerprint, now: 10_000 },
        { requestAttempt: 1, providerAttempt: 3, fingerprint, now: 10_000 },
        { requestAttempt: 1, providerAttempt: 2, fingerprint: "c".repeat(64), now: 10_000 },
      ]) {
        const exit = yield* service.dispatch({
          ...fence,
          ...activity,
          phase: "provider",
          recovery: "retry-provider",
          ...input,
        }).pipe(Effect.exit)
        expect(exit._tag).toBe("Failure")
        expect(yield* service.get(sessionID)).toMatchObject({ type: "retrying", nextAt: 10_000, fingerprint })
      }
    }),
  )

  it.effect("normalizes and caps messages at the status service boundary", () =>
    Effect.gen(function* () {
      yield* setup
      const service = yield* SessionExecutionStatus.Service
      const fence = { sessionID, owner: "v2" as const, epoch: 1, runtimeState: "draining" as const }
      const activity = { activityID: rootID, rootID, activity: "prompt" as const }
      const secret = "boundary-secret-canary"
      yield* service.start({ ...fence, ...activity, phase: "preparing" })
      yield* service.fail({
        ...fence,
        ...activity,
        phase: "settling",
        code: "runner-failure",
        message: `Basic ${secret} api_key = "${secret}" credential=${secret} ${"x".repeat(900)}`,
        resultingEpoch: 2,
      })
      const terminal = yield* service.get(sessionID)
      expect(terminal).toMatchObject({ type: "terminal-failure" })
      expect(JSON.stringify(terminal)).not.toContain(secret)
      expect(new TextEncoder().encode("message" in terminal ? terminal.message : "").byteLength).toBeLessThanOrEqual(512)
    }),
  )

  it.effect("enforces the 512-byte UTF-8 message bound during synchronized publication", () =>
    Effect.gen(function* () {
      yield* setup
      const service = yield* SessionExecutionStatus.Service
      const events = yield* EventV2.Service
      const fence = { sessionID, owner: "v2" as const, epoch: 1, runtimeState: "draining" as const }
      const activity = { activityID: rootID, rootID, activity: "prompt" as const }
      yield* service.start({ ...fence, ...activity, phase: "preparing" })
      const data = {
        sessionID,
        owner: "v2" as const,
        epoch: 1,
        ...activity,
        phase: "settling" as const,
        code: "runner-failure" as const,
        resultingEpoch: 2,
        timestamp: yield* DateTime.now,
      }

      yield* events.publish(SessionEvent.Execution.Failed, { ...data, message: "😀".repeat(128) })
      expect((yield* events.publish(SessionEvent.Execution.Failed, { ...data, message: "😀".repeat(129) }).pipe(Effect.exit))._tag).toBe("Failure")
    }),
  )

  it.effect("decodes continuation readiness through canonical durable and all-event unions", () =>
    Effect.gen(function* () {
      yield* setup
      const service = yield* SessionExecutionStatus.Service
      const fence = { sessionID, owner: "v2" as const, epoch: 1, runtimeState: "draining" as const }
      const activity = { activityID: rootID, rootID, activity: "prompt" as const }
      const fingerprint = "f".repeat(64)
      yield* service.start({ ...fence, ...activity, phase: "preparing" })
      yield* service.dispatch({ ...fence, ...activity, phase: "provider", requestAttempt: 1, providerAttempt: 1, fingerprint })
      yield* service.complete({ ...fence, ...activity, phase: "tool", requestAttempt: 1, providerAttempt: 1, fingerprint })
      const event = yield* service.continue({ ...fence, ...activity, phase: "tool", requestAttempt: 1, providerAttempt: 1, fingerprint })

      expect(Schema.is(SessionEvent.Durable)(event)).toBe(true)
      expect(Schema.is(SessionEvent.All)(event)).toBe(true)
    }),
  )

  it.effect("records epoch replacement during tool, shell, task, and compaction phases", () =>
    Effect.gen(function* () {
      const service = yield* SessionExecutionStatus.Service
      const db = (yield* Database.Service).db
      yield* db.insert(ProjectTable).values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] }).onConflictDoNothing().run().pipe(Effect.orDie)
      for (const item of [
        { name: "tool", activity: "prompt" as const, phase: "tool" as const },
        { name: "shell", activity: "shell" as const, phase: "shell" as const },
        { name: "task", activity: "task" as const, phase: "task" as const },
        { name: "compaction", activity: "compaction" as const, phase: "compaction" as const },
      ]) {
        const id = SessionSchema.ID.make(`ses_epoch_${item.name}`)
        const root = SessionMessage.ID.make(`msg_epoch_${item.name}`)
        yield* db.insert(SessionTable).values({ id, project_id: Project.ID.global, slug: id, directory: "/project", title: item.name, version: "test", runtime: "v2", runtime_state: "draining", runtime_epoch: 1 }).run().pipe(Effect.orDie)
        const active = { sessionID: id, owner: "v2" as const, runtimeState: "draining" as const, epoch: 1, activityID: root, rootID: root, activity: item.activity, phase: item.phase }
        yield* service.start(active)
        yield* db.update(SessionTable).set({ runtime_state: "paused", runtime_epoch: 2 }).where(eq(SessionTable.id, id)).run().pipe(Effect.orDie)
        yield* service.replace({ ...active, resultingOwner: "v2", resultingState: "paused", resultingEpoch: 2 })
        expect(yield* service.get(id)).toMatchObject({ type: "interrupted", code: "runtime-replaced", phase: item.phase, epoch: 2 })
      }
    }),
  )
})
