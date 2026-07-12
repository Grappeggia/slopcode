import { describe, expect } from "bun:test"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { Project } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionExecutionStatus } from "@slopcode-ai/core/session/execution-status"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionProjector } from "@slopcode-ai/core/session/projector"
import { SessionSchema } from "@slopcode-ai/core/session/schema"
import { SessionTable } from "@slopcode-ai/core/session/sql"
import { DateTime, Effect, Layer } from "effect"
import * as TestClock from "effect/testing/TestClock"
import { EventTable } from "@slopcode-ai/core/event/sql"
import { eq } from "drizzle-orm"
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

      yield* service.dispatch({ ...fence, ...activity, phase: "provider", providerAttempt: 1 })
      yield* service.complete({ ...fence, ...activity, phase: "provider", providerAttempt: 1 })
      yield* service.retry({
        ...fence,
        ...activity,
        phase: "provider",
        providerAttempt: 2,
        attempt: 1,
        maxAttempts: 5,
        structuredAttempt: 3,
        nextAt: 12_000,
        code: "server",
        action: "retry-provider",
        message: "Provider unavailable",
      })
      expect(yield* service.get(sessionID)).toMatchObject({
        type: "retrying",
        providerAttempt: 2,
        structuredAttempt: 3,
        attempt: 1,
        maxAttempts: 5,
        nextAt: 12_000,
      })
      yield* service.dispatch({ ...fence, ...activity, phase: "provider", providerAttempt: 2 })
      yield* service.complete({ ...fence, ...activity, phase: "provider", providerAttempt: 2 })
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
})
