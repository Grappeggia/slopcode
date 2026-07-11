import { Effect, Layer } from "effect"
import { Database } from "../../database/database"
import { LocationServiceMap } from "../../location-layer"
import { SessionInput } from "../input"
import { SessionRunCoordinator } from "../run-coordinator"
import { SessionRunner } from "../runner"
import { SessionSchema } from "../schema"
import { SessionStore } from "../store"
import { SessionExecution } from "../execution"
import { logFailure } from "../logging"
import { SessionRuntime } from "../runtime"

/** Current-process routing for implicit-local Locations. Future remote placement belongs here. */
export const layer = Layer.effect(
  SessionExecution.Service,
  Effect.gen(function* () {
    const db = (yield* Database.Service).db
    const store = yield* SessionStore.Service
    const locations = yield* LocationServiceMap
    const runtime = yield* SessionRuntime.Service
    const recovered = yield* runtime.recover()
    const recovery = new Map(recovered.map((info) => [info.sessionID, info]))
    yield* Effect.forEach(
      yield* SessionInput.pendingCompactionSessions(db),
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
    yield* Effect.forEach(
      recovery.values(),
      Effect.fnUntraced(function* (info) {
        const pending = yield* Effect.all([
          SessionInput.hasPendingCompaction(db, info.sessionID),
          SessionInput.hasPending(db, info.sessionID, "steer"),
          SessionInput.hasPending(db, info.sessionID, "queue"),
        ])
        if (!pending.some(Boolean)) return
        yield* coordinator.wake(info.sessionID)
        if (pending.slice(1).some(Boolean)) yield* coordinator.wake(info.sessionID)
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
