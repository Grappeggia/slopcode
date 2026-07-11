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
import { Deferred, Effect, Layer } from "effect"
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
})
