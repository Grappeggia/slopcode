import { Effect, Layer } from "effect"
import { Database } from "../../database/database"
import { EventV2 } from "../../event"
import { LocationServiceMap } from "../../location-layer"
import { SessionInput } from "../input"
import { SessionRunCoordinator } from "../run-coordinator"
import { SessionRunner } from "../runner"
import { SessionSchema } from "../schema"
import { SessionStore } from "../store"
import { SessionExecution } from "../execution"
import { logFailure } from "../logging"
import { SessionRuntime } from "../runtime"
import { SessionEvent } from "../event"
import { SessionTask } from "../task"
import { Schema } from "effect"

/** Current-process routing for implicit-local Locations. Future remote placement belongs here. */
export const layer = Layer.effect(
  SessionExecution.Service,
  Effect.gen(function* () {
    const db = (yield* Database.Service).db
    const store = yield* SessionStore.Service
    const events = yield* EventV2.Service
    const locations = yield* LocationServiceMap
    const runtime = yield* SessionRuntime.Service
    const recovered = yield* runtime.recover()
    const recovery = new Map(recovered.map((info) => [info.sessionID, info]))
    yield* Effect.forEach(
      [
        ...(yield* SessionInput.pendingCompactionSessions(db)),
        ...(yield* SessionInput.pendingShellSessions(db)),
        ...(yield* SessionTask.requestedSessions(db)),
      ].filter((sessionID, index, sessions) => sessions.indexOf(sessionID) === index),
      Effect.fnUntraced(function* (sessionID) {
        if (recovery.has(sessionID)) return
        const info = yield* runtime.get(sessionID)
        if (info?.owner === "v2") recovery.set(sessionID, info)
      }),
      { discard: true },
    )
    const coordinator = yield* SessionRunCoordinator.make<SessionSchema.ID, void, SessionRunner.RunError>({
      drain: Effect.fnUntraced(function* (sessionID: SessionSchema.ID, mode) {
        const session = yield* store.get(sessionID)
        if (!session) return yield* Effect.die(`Session not found: ${sessionID}`)
        return yield* SessionRunner.Service.use((runner) => runner.run({ sessionID, force: mode === "run" })).pipe(
          Effect.provide(locations.get(session.location)),
        )
      }),
      onFailure: (sessionID, cause) => logFailure("Failed to drain Session", sessionID, cause),
    })
    yield* events.listen((event) => {
      if (Schema.is(SessionEvent.Task.Execute)(event))
        return SessionTask.orphaned(db, event.data.childSessionID).pipe(
          Effect.flatMap((orphaned) =>
            orphaned
              ? Effect.void
              : coordinator
                  .wake(event.data.childSessionID)
                  .pipe(Effect.andThen(coordinator.awaitIdle(event.data.childSessionID))),
          ),
          Effect.orDie,
        )
      if (Schema.is(SessionEvent.Task.Interrupt)(event))
        return coordinator.interrupt(event.data.childSessionID).pipe(
          Effect.andThen(coordinator.awaitIdle(event.data.childSessionID)),
          Effect.catch(() => Effect.void),
        )
      return Effect.void
    })
    yield* Effect.forEach(
      recovery.values(),
      Effect.fnUntraced(function* (info) {
        if (yield* SessionTask.orphaned(db, info.sessionID)) return
        const pending = yield* Effect.all([
          SessionInput.hasPendingShell(db, info.sessionID),
          SessionInput.hasPendingCompaction(db, info.sessionID),
          SessionInput.hasPending(db, info.sessionID, "steer"),
          SessionInput.hasPending(db, info.sessionID, "queue"),
          SessionTask.hasPending(store, info.sessionID),
        ])
        if (!pending.some(Boolean)) return
        yield* coordinator.wake(info.sessionID)
        if (pending.filter(Boolean).length > 1) yield* coordinator.wake(info.sessionID)
      }),
      { discard: true },
    )

    return SessionExecution.Service.of({
      interrupt: coordinator.interrupt,
      resume: coordinator.run,
      wake: coordinator.wake,
      wait: coordinator.awaitIdle,
    })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(Database.defaultLayer),
  Layer.provide(SessionStore.defaultLayer),
  Layer.provide(SessionRuntime.defaultLayer),
)
