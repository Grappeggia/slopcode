import { Clock, Effect, Fiber, Layer } from "effect"
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
import { SessionExecutionStatus } from "../execution-status"
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
    const status = yield* SessionExecutionStatus.make
    const recovered = yield* runtime.recover()
    const recovery = new Map(recovered.map((info) => [info.sessionID, info]))
    const resumable: SessionSchema.ID[] = []
    yield* Effect.forEach(
      recovered,
      Effect.fnUntraced(function* (info) {
        const current = yield* status.get(info.sessionID)
        if (current.type !== "busy" && current.type !== "retrying") return
        if (info.owner !== "v2" || info.state !== "draining" || info.epoch !== current.epoch) {
          const replacement = info.owner === "v2" && info.state !== "paused"
            ? yield* runtime.assign({ sessionID: info.sessionID, state: "paused", expectedOwner: "v2", expectedEpoch: info.epoch })
            : info
          yield* status.replace({
            sessionID: info.sessionID,
            owner: "v2",
            runtimeState: "draining",
            epoch: current.epoch,
            activityID: current.activityID,
            rootID: current.rootID,
            activity: current.activity,
            phase: current.phase,
            requestAttempt: current.requestAttempt,
            providerAttempt: current.providerAttempt,
            structuredAttempt: current.structuredAttempt,
            resultingOwner: replacement.owner,
            resultingState: replacement.state,
            resultingEpoch: replacement.epoch,
          }).pipe(Effect.exit)
          return
        }
        if (current.type === "retrying" && current.recovery === "retry-provider") {
          resumable.push(info.sessionID)
          return
        }
        if (current.type === "busy" && current.recovery === "retry-provider" && current.requestAttempt !== undefined && current.providerAttempt !== undefined) {
          if (current.providerAttempt >= 6) {
            yield* status.fail({
              sessionID: info.sessionID,
              owner: "v2",
              runtimeState: "draining",
              epoch: current.epoch,
              activityID: current.activityID,
              rootID: current.rootID,
              activity: current.activity,
              phase: current.phase,
              requestAttempt: current.requestAttempt,
              providerAttempt: current.providerAttempt,
              structuredAttempt: current.structuredAttempt,
              code: "provider-exhausted",
              message: "Provider retry budget was exhausted during restart recovery",
              resultingEpoch: current.epoch + 1,
            })
            return
          }
          yield* status.retry({
            sessionID: info.sessionID,
            owner: "v2",
            runtimeState: "draining",
            epoch: current.epoch,
            activityID: current.activityID,
            rootID: current.rootID,
            activity: current.activity,
            phase: "provider",
            requestAttempt: current.requestAttempt,
            providerAttempt: current.providerAttempt + 1,
            structuredAttempt: current.structuredAttempt,
            attempt: current.providerAttempt,
            maxAttempts: 5,
            nextAt: yield* Clock.currentTimeMillis,
            code: "dispatch-uncertain",
            action: "retry-provider",
            message: "Provider dispatch outcome was uncertain after restart",
            recovery: "retry-provider",
          })
          resumable.push(info.sessionID)
          return
        }
        yield* status.interrupt({
          sessionID: info.sessionID,
          owner: "v2",
          runtimeState: "draining",
          epoch: current.epoch,
          activityID: current.activityID,
          rootID: current.rootID,
          activity: current.activity,
          phase: current.phase,
          requestAttempt: current.requestAttempt,
          providerAttempt: current.providerAttempt,
          structuredAttempt: current.structuredAttempt,
          code: "restart",
          message: current.type === "retrying"
            ? "Provider retry cannot be reconstructed safely after restart"
            : "Session activity was interrupted by process restart",
          resultingEpoch: current.epoch + 1,
        })
      }),
      { discard: true },
    )
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
        if (yield* SessionTask.orphaned(db, sessionID)) return
        return yield* SessionRunner.Service.use((runner) => runner.run({ sessionID, force: mode === "run" })).pipe(
          Effect.provide(locations.get(session.location)),
        )
      }),
      onFailure: (sessionID, cause) => logFailure("Failed to drain Session", sessionID, cause),
    })
    const timers = new Map<SessionSchema.ID, Fiber.Fiber<void, never>>()
    yield* Effect.forEach(
      resumable,
      Effect.fnUntraced(function* (sessionID) {
        const current = yield* status.get(sessionID)
        if (current.type !== "retrying" || current.recovery !== "retry-provider") return
        const fiber = yield* Effect.sleep(Math.max(0, current.nextAt - (yield* Clock.currentTimeMillis))).pipe(
          Effect.andThen(coordinator.run(sessionID)),
          Effect.exit,
          Effect.asVoid,
          Effect.ensuring(Effect.sync(() => timers.delete(sessionID))),
          Effect.forkScoped,
        )
        timers.set(sessionID, fiber)
      }),
      { discard: true },
    )
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
        if (yield* SessionTask.orphaned(db, info.sessionID)) return
        yield* coordinator.wake(info.sessionID)
        if (pending.filter(Boolean).length > 1 && !(yield* SessionTask.orphaned(db, info.sessionID)))
          yield* coordinator.wake(info.sessionID)
      }),
      { discard: true },
    )

    return SessionExecution.Service.of({
      interrupt: (sessionID, seq) => Effect.gen(function* () {
        const timer = timers.get(sessionID)
        if (timer) {
          timers.delete(sessionID)
          yield* Fiber.interrupt(timer)
        }
        yield* coordinator.interrupt(sessionID, seq)
      }),
      resume: (sessionID) => Effect.gen(function* () {
        const timer = timers.get(sessionID)
        if (timer) return yield* Fiber.join(timer)
        yield* coordinator.run(sessionID)
      }),
      wake: (sessionID, seq) => timers.has(sessionID) ? Effect.void : coordinator.wake(sessionID, seq),
      wait: (sessionID) => Effect.gen(function* () {
        const timer = timers.get(sessionID)
        if (timer) yield* Fiber.join(timer)
        yield* coordinator.awaitIdle(sessionID)
      }),
    })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(Database.defaultLayer),
  Layer.provide(SessionStore.defaultLayer),
  Layer.provide(SessionRuntime.defaultLayer),
)
