import { describe, expect } from "bun:test"
import path from "path"
import { Effect, Layer, Stream } from "effect"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { asc, eq } from "drizzle-orm"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { EventTable } from "@slopcode-ai/core/event/sql"
import { Location } from "@slopcode-ai/core/location"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionV1 } from "@slopcode-ai/core/v1/session"
import { Prompt } from "@slopcode-ai/core/session/prompt"
import { SessionProjector } from "@slopcode-ai/core/session/projector"
import { SessionExecution } from "@slopcode-ai/core/session/execution"
import { SessionInput } from "@slopcode-ai/core/session/input"
import { SessionEvent } from "@slopcode-ai/core/session/event"
import { SessionTable } from "@slopcode-ai/core/session/sql"
import { SessionStore } from "@slopcode-ai/core/session/store"
import { SessionRuntime } from "@slopcode-ai/core/session/runtime"
import { WorkspaceV2 } from "@slopcode-ai/core/workspace"
import { testEffect } from "./lib/effect"
import { locationServices } from "./lib/location-services"
import { tmpdir } from "./fixture/tmpdir"

const database = Database.layerFromPath(":memory:")
const events = EventV2.layer.pipe(Layer.provide(database))
const projects = Layer.succeed(
  ProjectV2.Service,
  ProjectV2.Service.of({
    resolve: (directory) => Effect.succeed({ id: ProjectV2.ID.global, directory }),
    directories: () => Effect.succeed([]),
    commit: () => Effect.void,
  }),
)
const projector = SessionProjector.layer.pipe(Layer.provide(events), Layer.provide(database))
const store = SessionStore.layer.pipe(Layer.provide(database))
const runtime = SessionRuntime.layer.pipe(Layer.provide(database))
const sessions = SessionV2.layer.pipe(
  Layer.provide(events),
  Layer.provide(database),
  Layer.provide(store),
  Layer.provide(projects),
  Layer.provide(SessionExecution.noopLayer),
  Layer.provide(locationServices),
)
const it = testEffect(
  Layer.mergeAll(database, events, projects, projector, store, runtime, SessionExecution.noopLayer, sessions),
)
const location = Location.Ref.make({ directory: AbsolutePath.make("/project") })
const id = SessionV2.ID.create()

describe("SessionV2.create", () => {
  it.effect("derives stable namespaced external IDs", () =>
    Effect.sync(() => {
      const input = { namespace: "opencord.agent-thread", key: "thread-1" }

      expect(SessionV2.ID.fromExternal(input)).toBe(SessionV2.ID.fromExternal(input))
      expect(SessionV2.ID.fromExternal(input)).toMatch(/^ses_[a-f0-9]{64}$/)
      expect(SessionV2.ID.fromExternal({ ...input, namespace: "another-app" })).not.toBe(
        SessionV2.ID.fromExternal(input),
      )
      expect(SessionV2.ID.fromExternal({ namespace: "a:b", key: "c" })).not.toBe(
        SessionV2.ID.fromExternal({ namespace: "a", key: "b:c" }),
      )
    }),
  )

  it.effect("creates a fresh projected session when the ID is omitted", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service

      const first = yield* session.create({ location })
      const second = yield* session.create({ location })

      expect(second.id).not.toBe(first.id)
      expect(yield* session.list()).toHaveLength(2)
    }),
  )

  it.effect("returns the original session when the ID is retried", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const input = { id, location }

      const first = yield* session.create(input)
      const retried = yield* session.create(input)

      expect(retried).toEqual(first)
      expect(yield* session.list()).toEqual([first])
    }),
  )

  it.effect("stores supplied immutable create attributes", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const workspaceID = WorkspaceV2.ID.make("wrk_test")
      const model = ModelV2.Ref.make({
        id: ModelV2.ID.make("sonnet"),
        providerID: ProviderV2.ID.anthropic,
        variant: ModelV2.VariantID.make("fast"),
      })

      expect(
        yield* session.create({
          location: Location.Ref.make({ directory: location.directory, workspaceID }),
          agent: AgentV2.ID.make("build"),
          model,
        }),
      ).toMatchObject({ location: { directory: location.directory, workspaceID }, agent: "build", model })
    }),
  )

  it.effect("returns the existing Session when one ID is reused with different create arguments", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const created = yield* session.create({ id, location })
      const changed = [
        { id, location: Location.Ref.make({ directory: AbsolutePath.make("/other") }) },
        { id, location, agent: AgentV2.ID.make("build") },
        {
          id,
          location,
          model: ModelV2.Ref.make({ id: ModelV2.ID.make("sonnet"), providerID: ProviderV2.ID.anthropic }),
        },
      ]

      for (const input of changed) {
        expect(yield* session.create(input)).toEqual(created)
      }
      expect(yield* session.list()).toHaveLength(1)
    }),
  )

  it.effect("returns one recorded session to concurrent exact retries", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const input = { id, location }

      const created = yield* Effect.all([session.create(input), session.create(input)], { concurrency: "unbounded" })

      expect(created[1]).toEqual(created[0])
      expect(yield* session.list()).toEqual([created[0]])
    }),
  )

  it.effect("returns the current Session projection after updates", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const { db } = yield* Database.Service
      const input = { id, location }
      const created = yield* session.create(input)

      yield* db.update(SessionTable).set({ agent: "build" }).where(eq(SessionTable.id, id)).run().pipe(Effect.orDie)

      expect(yield* session.create(input)).toMatchObject({ id: created.id, agent: "build" })
    }),
  )

  it.effect("returns the current Session projection after projected updates", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const input = { id, location }
      const created = yield* session.create(input)

      yield* events.publish(SessionV1.Event.Updated, {
        sessionID: id,
        info: SessionV1.SessionInfo.make({
          id,
          slug: "updated",
          version: "test",
          projectID: created.projectID,
          directory: created.location.directory,
          title: "updated",
          agent: "build",
          time: { created: 0, updated: 1 },
        }),
      })

      expect(yield* session.create(input)).toMatchObject({ id, agent: "build" })
    }),
  )

  it.effect("persists creation through the existing legacy created event", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const { db } = yield* Database.Service
      const created = yield* session.create({ location })

      expect(
        yield* db.select().from(EventTable).where(eq(EventTable.aggregate_id, created.id)).all().pipe(Effect.orDie),
      ).toMatchObject([{ type: EventV2.versionedType(SessionV1.Event.Created.type, 1) }])
    }),
  )

  it.effect("defaults new sessions to V1 runtime ownership", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      const created = yield* session.create({ location })

      expect(yield* runtime.get(created.id)).toMatchObject({
        sessionID: created.id,
        owner: "v1",
        epoch: 0,
        state: "ready",
      })
      expect(yield* runtime.assert({ sessionID: created.id, owner: "v1", epoch: 0 })).toMatchObject({
        owner: "v1",
        epoch: 0,
      })
    }),
  )

  it.effect("creates explicitly V2-owned sessions at epoch zero", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      const { db } = yield* Database.Service
      const created = yield* session.create({ id, location, runtime: "v2" })

      expect(yield* runtime.get(created.id)).toMatchObject({
        sessionID: created.id,
        owner: "v2",
        epoch: 0,
        state: "ready",
      })
      const event = yield* db
        .select()
        .from(EventTable)
        .where(eq(EventTable.aggregate_id, created.id))
        .get()
        .pipe(Effect.orDie)
      expect(event?.data).not.toHaveProperty("runtime")
      expect(event?.data).not.toHaveProperty("owner")
    }),
  )

  it.effect("keeps exact V2 creation retries idempotent", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      const { db } = yield* Database.Service
      const input = { id, location, runtime: "v2" as const }

      const created = yield* session.create(input)
      const retried = yield* session.create(input)

      expect(retried).toEqual(created)
      expect(yield* runtime.get(id)).toMatchObject({ owner: "v2", epoch: 0, state: "ready" })
      expect(
        yield* db.select().from(EventTable).where(eq(EventTable.aggregate_id, id)).all().pipe(Effect.orDie),
      ).toHaveLength(1)
    }),
  )

  it.effect("does not take ownership from an existing V1 session", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      const { db } = yield* Database.Service
      const created = yield* session.create({ id, location })

      const collided = yield* session.create({ id, location, runtime: "v2" })

      expect(collided).toEqual(created)
      expect(yield* runtime.get(id)).toMatchObject({ owner: "v1", epoch: 0, state: "ready" })
      expect(
        yield* db.select().from(EventTable).where(eq(EventTable.aggregate_id, id)).all().pipe(Effect.orDie),
      ).toHaveLength(1)
    }),
  )

  it.effect("assigns runtime ownership with epoch fencing", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      const created = yield* session.create({ location })

      const assigned = yield* runtime.assign({
        sessionID: created.id,
        owner: "v2",
        state: "migrating",
        expectedOwner: "v1",
        expectedEpoch: 0,
      })

      expect(assigned).toMatchObject({ owner: "v2", epoch: 1, state: "migrating" })
      expect(
        yield* runtime
          .assign({
            sessionID: created.id,
            owner: "v1",
            expectedOwner: "v1",
            expectedEpoch: 0,
          })
          .pipe(Effect.flip),
      ).toMatchObject({
        _tag: "SessionRuntime.Mismatch",
        expectedOwner: "v1",
        actualOwner: "v2",
        expectedEpoch: 0,
        actualEpoch: 1,
      })
      expect(yield* runtime.assert({ sessionID: created.id, owner: "v2", epoch: 1 })).toMatchObject({
        owner: "v2",
        epoch: 1,
        state: "migrating",
      })
    }),
  )

  it.effect("recovers active V2 runtimes once and fences their stale epochs", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      const drainingID = SessionV2.ID.make("ses_recover_draining")
      const migratingID = SessionV2.ID.make("ses_recover_migrating")
      yield* session.create({ id: drainingID, location, runtime: "v2" })
      yield* session.create({ id: migratingID, location, runtime: "v2" })
      yield* runtime.assign({ sessionID: drainingID, state: "draining", expectedOwner: "v2", expectedEpoch: 0 })
      yield* runtime.assign({ sessionID: migratingID, state: "migrating", expectedOwner: "v2", expectedEpoch: 0 })

      expect(yield* runtime.recover()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sessionID: drainingID, owner: "v2", state: "paused", epoch: 2 }),
          expect.objectContaining({ sessionID: migratingID, owner: "v2", state: "paused", epoch: 2 }),
        ]),
      )
      expect(yield* runtime.recover()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sessionID: drainingID, owner: "v2", state: "paused", epoch: 2 }),
          expect.objectContaining({ sessionID: migratingID, owner: "v2", state: "paused", epoch: 2 }),
        ]),
      )
      expect(yield* runtime.get(drainingID)).toMatchObject({ owner: "v2", state: "paused", epoch: 2 })
      expect(yield* runtime.assert({ sessionID: drainingID, owner: "v2", epoch: 1 }).pipe(Effect.flip)).toMatchObject({
        _tag: "SessionRuntime.Mismatch",
        expectedEpoch: 1,
        actualEpoch: 2,
      })
    }),
  )

  it.effect("leaves V1 and inactive V2 runtimes untouched during recovery", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const runtime = yield* SessionRuntime.Service
      const v1ID = SessionV2.ID.make("ses_recover_v1")
      const readyID = SessionV2.ID.make("ses_recover_ready")
      const pausedID = SessionV2.ID.make("ses_recover_paused")
      yield* session.create({ id: v1ID, location })
      yield* session.create({ id: readyID, location, runtime: "v2" })
      yield* session.create({ id: pausedID, location, runtime: "v2" })
      yield* runtime.assign({ sessionID: v1ID, state: "draining", expectedOwner: "v1", expectedEpoch: 0 })
      yield* runtime.assign({ sessionID: pausedID, state: "paused", expectedOwner: "v2", expectedEpoch: 0 })

      expect(yield* runtime.recover()).toEqual([
        expect.objectContaining({ sessionID: pausedID, owner: "v2", state: "paused", epoch: 1 }),
      ])
      expect(yield* runtime.get(v1ID)).toMatchObject({ owner: "v1", state: "draining", epoch: 1 })
      expect(yield* runtime.get(readyID)).toMatchObject({ owner: "v2", state: "ready", epoch: 0 })
      expect(yield* runtime.get(pausedID)).toMatchObject({ owner: "v2", state: "paused", epoch: 1 })
    }),
  )

  it.effect("persists caller-ID creation through the existing created event", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const { db } = yield* Database.Service
      const created = yield* session.create({ id, location })

      expect(
        yield* db.select().from(EventTable).where(eq(EventTable.aggregate_id, created.id)).get().pipe(Effect.orDie),
      ).toMatchObject({
        data: { sessionID: id },
      })
    }),
  )

  it.effect("omits legacy creation rows from the V2 Session event stream", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const events = yield* EventV2.Service
      const { db } = yield* Database.Service
      const created = yield* session.create({ location })
      yield* session.prompt({ sessionID: created.id, prompt: new Prompt({ text: "Hello" }), resume: false })
      yield* SessionInput.promoteSteers(db, events, created.id, Number.MAX_SAFE_INTEGER)

      expect(
        Array.from(yield* session.events({ sessionID: created.id }).pipe(Stream.take(2), Stream.runCollect)),
      ).toMatchObject([
        { cursor: 1, event: { type: "session.next.prompt.admitted", data: { prompt: { text: "Hello" } } } },
        { cursor: 2, event: { type: "session.next.prompt.promoted" } },
      ])
    }),
  )

  it.effect("replays one prompt lifecycle into a fresh target database", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const sourceEvents = yield* EventV2.Service
      const sourceDb = (yield* Database.Service).db
      const created = yield* session.create({ id: SessionV2.ID.make("ses_fresh_target_replay"), location })
      const admitted = yield* session.prompt({
        sessionID: created.id,
        prompt: new Prompt({ text: "Replay lifecycle" }),
        resume: false,
      })
      yield* SessionInput.promoteSteers(sourceDb, sourceEvents, created.id, Number.MAX_SAFE_INTEGER)
      const serialized = (yield* sourceDb
        .select()
        .from(EventTable)
        .where(eq(EventTable.aggregate_id, created.id))
        .orderBy(asc(EventTable.seq))
        .all()
        .pipe(Effect.orDie)).map((event) => ({
        id: event.id,
        aggregateID: event.aggregate_id,
        seq: event.seq,
        type: event.type,
        data: event.data,
      }))

      const tmp = yield* Effect.acquireRelease(
        Effect.promise(() => tmpdir()),
        (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
      )
      const targetDatabase = Database.layerFromPath(path.join(tmp.path, "target.sqlite"))
      const targetEvents = EventV2.layer.pipe(Layer.provide(targetDatabase))
      const targetProjector = SessionProjector.layer.pipe(Layer.provide(targetEvents), Layer.provide(targetDatabase))
      const targetStore = SessionStore.layer.pipe(Layer.provide(targetDatabase))

      yield* Effect.gen(function* () {
        const db = (yield* Database.Service).db
        const events = yield* EventV2.Service
        const store = yield* SessionStore.Service
        yield* db
          .insert(ProjectTable)
          .values({ id: ProjectV2.ID.global, worktree: location.directory, sandboxes: [] })
          .run()
          .pipe(Effect.orDie)

        expect(yield* store.get(created.id)).toBeUndefined()
        expect(yield* events.replayAll(serialized.slice(0, 2))).toBe(created.id)
        expect(yield* SessionInput.find(db, admitted.id)).toMatchObject({
          id: admitted.id,
          sessionID: created.id,
          prompt: { text: "Replay lifecycle" },
          delivery: "steer",
          admittedSeq: 1,
        })
        expect(yield* store.context(created.id)).toEqual([])

        expect(yield* events.replayAll(serialized.slice(2))).toBe(created.id)
        expect(yield* SessionInput.find(db, admitted.id)).toMatchObject({
          id: admitted.id,
          sessionID: created.id,
          prompt: { text: "Replay lifecycle" },
          delivery: "steer",
          admittedSeq: 1,
          promotedSeq: 2,
        })
        expect(yield* store.context(created.id)).toMatchObject([
          { id: admitted.id, type: "user", text: "Replay lifecycle" },
        ])
        expect(
          (yield* db
            .select()
            .from(EventTable)
            .where(eq(EventTable.aggregate_id, created.id))
            .orderBy(asc(EventTable.seq))
            .all()
            .pipe(Effect.orDie)).map((event) => [event.seq, event.type]),
        ).toEqual([
          [0, EventV2.versionedType(SessionV1.Event.Created.type, 1)],
          [1, EventV2.versionedType(SessionEvent.PromptLifecycle.Admitted.type, 1)],
          [2, EventV2.versionedType(SessionEvent.PromptLifecycle.Promoted.type, 1)],
        ])
      }).pipe(Effect.provide(Layer.fresh(Layer.mergeAll(targetDatabase, targetEvents, targetProjector, targetStore))))
    }),
  )

  it.effect("does not mask unrelated created projector defects", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const event = yield* EventV2.Service
      const defect = new Error("unrelated projector defect")
      yield* event.project(SessionV1.Event.Created, () => Effect.die(defect))

      expect(yield* session.create({ id, location }).pipe(Effect.catchDefect(Effect.succeed))).toBe(defect)
    }),
  )

  it.effect("switches the selected model through the durable Session event", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const created = yield* session.create({ location })
      const model = ModelV2.Ref.make({
        id: ModelV2.ID.make("sonnet"),
        providerID: ProviderV2.ID.anthropic,
        variant: ModelV2.VariantID.make("high"),
      })

      yield* session.switchModel({ sessionID: created.id, model })

      expect(yield* session.get(created.id)).toMatchObject({ model })
      expect(
        Array.from(yield* session.events({ sessionID: created.id }).pipe(Stream.take(1), Stream.runCollect)),
      ).toMatchObject([{ event: { type: "session.next.model.switched", data: { model } } }])
    }),
  )

  it.effect("persists repeated switches as distinct durable Session events", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const created = yield* session.create({ location })
      const model = ModelV2.Ref.make({ id: ModelV2.ID.make("sonnet"), providerID: ProviderV2.ID.anthropic })

      yield* session.switchModel({ sessionID: created.id, model })
      yield* session.switchModel({ sessionID: created.id, model })

      const { db } = yield* Database.Service
      expect(
        yield* db.select().from(EventTable).where(eq(EventTable.aggregate_id, created.id)).all().pipe(Effect.orDie),
      ).toHaveLength(3)
      expect(yield* session.get(created.id)).toMatchObject({ model })
    }),
  )

  it.effect("rejects a model switch for a missing Session", () =>
    Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const missing = SessionV2.ID.make("ses_missing_model_switch")

      expect(
        yield* session
          .switchModel({
            sessionID: missing,
            model: ModelV2.Ref.make({ id: ModelV2.ID.make("sonnet"), providerID: ProviderV2.ID.anthropic }),
          })
          .pipe(
            Effect.flip,
            Effect.map((error) => error._tag),
          ),
      ).toBe("Session.NotFoundError")
    }),
  )
})
