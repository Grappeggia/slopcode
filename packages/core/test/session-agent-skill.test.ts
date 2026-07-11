import { describe, expect } from "bun:test"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { EventTable } from "@slopcode-ai/core/event/sql"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { PluginBoot } from "@slopcode-ai/core/plugin/boot"
import { Project } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionControl } from "@slopcode-ai/core/session/control"
import { SessionExecution } from "@slopcode-ai/core/session/execution"
import * as SessionExecutionLocal from "@slopcode-ai/core/session/execution/local"
import { SessionInput } from "@slopcode-ai/core/session/input"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { Prompt } from "@slopcode-ai/core/session/prompt"
import { SessionProjector } from "@slopcode-ai/core/session/projector"
import { SessionRuntime } from "@slopcode-ai/core/session/runtime"
import { SessionRunner } from "@slopcode-ai/core/session/runner"
import { SessionInputTable, SessionTable } from "@slopcode-ai/core/session/sql"
import { SessionStore } from "@slopcode-ai/core/session/store"
import { SkillV2 } from "@slopcode-ai/core/skill"
import { eq, sql } from "drizzle-orm"
import { Context, Deferred, Effect, Exit, Layer, Scope } from "effect"
import { testEffect } from "./lib/effect"

const database = Database.layerFromPath(":memory:")
const events = EventV2.layer.pipe(Layer.provide(database))
const projector = SessionProjector.layer.pipe(Layer.provide(events), Layer.provide(database))
const store = SessionStore.layer.pipe(Layer.provide(database))
const runtime = SessionRuntime.layer.pipe(Layer.provide(database))
const agents = AgentV2.layer
const skillItems: SkillV2.Info[] = []
const skills = Layer.mock(SkillV2.Service, {
  list: () => Effect.succeed(Array.from(new Map(skillItems.map((skill) => [skill.name, skill])).values())),
})
let bootHook = Effect.void
const boot = Layer.mock(PluginBoot.Service, { wait: () => Effect.suspend(() => bootHook) })
const catalogs = Layer.mergeAll(agents, skills, boot)
const locations = Layer.mock(LocationServiceMap, { get: () => catalogs })
const wakes: SessionV2.ID[] = []
const execution = Layer.mock(SessionExecution.Service, {
  wake: (id) => Effect.sync(() => void wakes.push(id)),
})
const sessions = SessionV2.layer.pipe(
  Layer.provide(events),
  Layer.provide(database),
  Layer.provide(store),
  Layer.provide(Project.defaultLayer),
  Layer.provide(execution),
  Layer.provide(locations),
)
const control = SessionControl.layer.pipe(Layer.provide(sessions), Layer.provide(runtime))
const it = testEffect(
  Layer.mergeAll(
    database,
    events,
    projector,
    store,
    runtime,
    agents,
    skills,
    boot,
    locations,
    execution,
    sessions,
    control,
  ),
)
const sessionID = SessionV2.ID.make("ses_agent_skill")

const setup = Effect.gen(function* () {
  skillItems.length = 0
  wakes.length = 0
  bootHook = Effect.void
  const { db } = yield* Database.Service
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
      slug: "test",
      directory: "/project",
      title: "test",
      version: "test",
      runtime: "v2",
    })
    .run()
    .pipe(Effect.orDie)
  yield* (yield* AgentV2.Service).transform((editor) => {
    editor.update(AgentV2.ID.make("build"), (agent) => {
      agent.mode = "primary"
    })
    editor.update(AgentV2.ID.make("reviewer"), (agent) => {
      agent.mode = "primary"
    })
  })
})

describe("SessionV2.switchAgent", () => {
  it.effect("publishes one durable switch and projects the selected agent", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service

      yield* session.switchAgent({ sessionID, agent: "reviewer" })

      expect(yield* session.get(sessionID)).toMatchObject({ agent: "reviewer" })
      expect(yield* session.messages({ sessionID })).toMatchObject([{ type: "agent-switched", agent: "reviewer" }])
    }),
  )

  it.effect("does not publish when the requested agent is already selected", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const { db } = yield* Database.Service

      yield* session.switchAgent({ sessionID, agent: "reviewer" })
      yield* session.switchAgent({ sessionID, agent: "reviewer" })

      expect(
        yield* db.select().from(EventTable).where(eq(EventTable.aggregate_id, sessionID)).all().pipe(Effect.orDie),
      ).toHaveLength(1)
    }),
  )

  it.effect("rejects missing, hidden, and subagent selections without mutation", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const agents = yield* AgentV2.Service
      const { db } = yield* Database.Service
      yield* agents.transform((editor) => {
        editor.update(AgentV2.ID.make("hidden"), (agent) => {
          agent.mode = "primary"
          agent.hidden = true
        })
        editor.update(AgentV2.ID.make("child"), (agent) => {
          agent.mode = "subagent"
        })
      })

      for (const agent of ["missing", "hidden", "child"]) {
        expect(yield* session.switchAgent({ sessionID, agent }).pipe(Effect.flip)).toMatchObject({
          _tag: "Session.AgentUnavailableError",
          agent,
          available: ["build", "reviewer"],
        })
      }
      expect((yield* session.get(sessionID)).agent).toBeUndefined()
      expect(
        yield* db.select().from(EventTable).where(eq(EventTable.aggregate_id, sessionID)).all().pipe(Effect.orDie),
      ).toHaveLength(0)
    }),
  )

  it.effect("waits for plugin boot before resolving the agent catalog", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const agents = yield* AgentV2.Service
      bootHook = agents.transform((editor) =>
        editor.update(AgentV2.ID.make("late"), (agent) => {
          agent.mode = "primary"
        }),
      )

      yield* session.switchAgent({ sessionID, agent: "late" })

      expect(yield* session.get(sessionID)).toMatchObject({ agent: "late" })
    }),
  )
})

describe("SessionV2.skill", () => {
  it.effect("admits skill content through durable prompt input", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const { db } = yield* Database.Service
      skillItems.push(
        new SkillV2.Info({
          name: "review",
          location: AbsolutePath.make("/earlier/review.md"),
          content: "Earlier source",
        }),
        new SkillV2.Info({
          name: "review",
          location: AbsolutePath.make("/skills/review.md"),
          content: "Review this change",
        }),
      )

      yield* session.skill({ sessionID, skill: "review", resume: false })

      expect(yield* db.select().from(SessionInputTable).all().pipe(Effect.orDie)).toMatchObject([
        { session_id: sessionID, prompt: { text: "Review this change" } },
      ])
      expect(yield* SessionInput.hasPending(db, sessionID, "steer")).toBeTrue()
      expect(wakes).toEqual([])
    }),
  )

  it.effect("uses the content selected by current source precedence", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const { db } = yield* Database.Service
      skillItems.push(
        new SkillV2.Info({
          name: "review",
          location: AbsolutePath.make("/later/review.md"),
          content: "Later source",
        }),
      )

      yield* session.skill({ sessionID, skill: "review", resume: false })

      expect(yield* db.select().from(SessionInputTable).get().pipe(Effect.orDie)).toMatchObject({
        prompt: { text: "Later source" },
      })
    }),
  )

  it.effect("rejects an unknown skill without admitting input", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const { db } = yield* Database.Service
      skillItems.push(
        new SkillV2.Info({
          name: "review",
          location: AbsolutePath.make("/skills/review.md"),
          content: "Review",
        }),
      )

      expect(yield* session.skill({ sessionID, skill: "missing" }).pipe(Effect.flip)).toMatchObject({
        _tag: "Session.SkillNotFoundError",
        skill: "missing",
        available: ["review"],
      })
      expect(yield* db.select().from(SessionInputTable).all().pipe(Effect.orDie)).toEqual([])
      expect(wakes).toEqual([])
    }),
  )

  it.effect("reuses prompt idempotency and conflict behavior", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const { db } = yield* Database.Service
      const id = SessionMessage.ID.create()
      skillItems.push(
        new SkillV2.Info({
          name: "review",
          location: AbsolutePath.make("/skills/review.md"),
          content: "Review",
        }),
      )
      const input = { id, sessionID, skill: "review", resume: false }

      const first = yield* session.skill(input)
      expect(yield* session.skill(input)).toEqual(first)
      skillItems[0] = new SkillV2.Info({
        name: "review",
        location: AbsolutePath.make("/skills/review.md"),
        content: "Changed review",
      })

      expect(yield* session.skill(input).pipe(Effect.flip)).toMatchObject({
        _tag: "Session.PromptConflictError",
        sessionID,
        messageID: id,
      })
      expect(yield* db.select().from(SessionInputTable).all().pipe(Effect.orDie)).toHaveLength(1)
    }),
  )

  it.effect("wakes by default after durable admission", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      skillItems.push(
        new SkillV2.Info({
          name: "review",
          location: AbsolutePath.make("/skills/review.md"),
          content: "Review",
        }),
      )

      yield* session.skill({ sessionID, skill: "review" })

      expect(wakes).toEqual([sessionID])
    }),
  )

  it.effect("waits for plugin boot before resolving the skill catalog", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      bootHook = Effect.sync(() =>
        skillItems.push(
          new SkillV2.Info({
            name: "late",
            location: AbsolutePath.make("/skills/late.md"),
            content: "Loaded after boot",
          }),
        ),
      )

      const admitted = yield* session.skill({ sessionID, skill: "late", resume: false })

      expect(admitted.prompt.text).toBe("Loaded after boot")
    }),
  )

  it.effect("is recovered as pending durable input after startup", () =>
    Effect.gen(function* () {
      yield* setup
      const session = yield* SessionV2.Service
      const database = yield* Database.Service
      const store = yield* SessionStore.Service
      const runtime = yield* SessionRuntime.Service
      const started = yield* Deferred.make<void>()
      skillItems.push(
        new SkillV2.Info({
          name: "review",
          location: AbsolutePath.make("/skills/review.md"),
          content: "Recover this skill",
        }),
      )
      yield* session.skill({ sessionID, skill: "review", resume: false })
      yield* runtime.assign({ sessionID, state: "draining", expectedOwner: "v2", expectedEpoch: 0 })
      const runner = Layer.mock(SessionRunner.Service, { run: () => Deferred.succeed(started, undefined) })
      const recovered = SessionExecutionLocal.layer.pipe(
        Layer.provide(Layer.succeed(Database.Service, database)),
        Layer.provide(Layer.succeed(SessionStore.Service, store)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, runtime)),
        Layer.provide(Layer.mock(LocationServiceMap, { get: () => runner })),
      )

      yield* SessionExecution.Service.pipe(Effect.andThen(Deferred.await(started)), Effect.provide(recovered))

      expect(yield* SessionInput.hasPending(database.db, sessionID, "steer")).toBeTrue()
      expect(yield* runtime.get(sessionID)).toMatchObject({ owner: "v2", state: "paused", epoch: 2 })
    }),
  )
})

describe("SessionControl", () => {
  it.effect("rejects V1 ownership before agent switch or skill admission", () =>
    Effect.gen(function* () {
      yield* setup
      const control = yield* SessionControl.Service
      const { db } = yield* Database.Service
      yield* db
        .update(SessionTable)
        .set({ runtime: "v1" })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)
      skillItems.push(
        new SkillV2.Info({
          name: "review",
          location: AbsolutePath.make("/skills/review.md"),
          content: "Review",
        }),
      )

      expect(yield* control.switchAgent({ sessionID, agent: "reviewer" }).pipe(Effect.flip)).toMatchObject({
        _tag: "SessionRuntime.Mismatch",
        actualOwner: "v1",
      })
      expect(yield* control.skill({ sessionID, skill: "review" }).pipe(Effect.flip)).toMatchObject({
        _tag: "SessionRuntime.Mismatch",
        actualOwner: "v1",
      })
      expect(
        yield* db.select().from(EventTable).where(eq(EventTable.aggregate_id, sessionID)).all().pipe(Effect.orDie),
      ).toEqual([])
      expect(yield* db.select().from(SessionInputTable).all().pipe(Effect.orDie)).toEqual([])
    }),
  )

  it.effect("rejects a stale epoch before publishing a switch", () =>
    Effect.gen(function* () {
      yield* setup
      const control = yield* SessionControl.Service
      const runtime = yield* SessionRuntime.Service
      const { db } = yield* Database.Service
      yield* runtime.assign({ sessionID, state: "ready", expectedOwner: "v2", expectedEpoch: 0 })

      expect(yield* control.switchAgent({ sessionID, agent: "reviewer", epoch: 0 }).pipe(Effect.flip)).toMatchObject({
        _tag: "SessionRuntime.Mismatch",
        expectedEpoch: 0,
        actualEpoch: 1,
      })
      expect(
        yield* db.select().from(EventTable).where(eq(EventTable.aggregate_id, sessionID)).all().pipe(Effect.orDie),
      ).toEqual([])
    }),
  )

  it.effect("rechecks ownership after catalog boot before mutating state", () =>
    Effect.gen(function* () {
      yield* setup
      const control = yield* SessionControl.Service
      const runtime = yield* SessionRuntime.Service
      const { db } = yield* Database.Service
      skillItems.push(
        new SkillV2.Info({
          name: "review",
          location: AbsolutePath.make("/skills/review.md"),
          content: "Review",
        }),
      )
      bootHook = runtime.assign({ sessionID, owner: "v1", expectedOwner: "v2", expectedEpoch: 0 }).pipe(Effect.asVoid)

      expect(yield* control.switchAgent({ sessionID, agent: "reviewer", epoch: 0 }).pipe(Effect.flip)).toMatchObject({
        _tag: "SessionRuntime.Mismatch",
        actualOwner: "v1",
        actualEpoch: 1,
      })
      expect(
        yield* db.select().from(EventTable).where(eq(EventTable.aggregate_id, sessionID)).all().pipe(Effect.orDie),
      ).toEqual([])
      expect(yield* db.select().from(SessionInputTable).all().pipe(Effect.orDie)).toEqual([])
    }),
  )

  it.effect("fences agent and skill at their event commit", () =>
    Effect.gen(function* () {
      yield* setup
      skillItems.push(
        new SkillV2.Info({ name: "review", location: AbsolutePath.make("/skills/review.md"), content: "Review" }),
      )
      const { db } = yield* Database.Service
      const events = yield* EventV2.Service
      const control = yield* SessionControl.Service
      const runtime = yield* SessionRuntime.Service
      const changes = ["owner", "state", "epoch"] as const
      let change: (typeof changes)[number] = "owner"
      let commits = 0
      yield* events.beforeCommit((event) => {
        if (!("sessionID" in event.data) || event.data.sessionID !== sessionID) return Effect.void
        commits++
        return db
          .update(SessionTable)
          .set({
            ...(change === "owner" ? { runtime: "v1" as const } : {}),
            ...(change === "state" ? { runtime_state: "draining" as const } : {}),
            runtime_epoch: sql`${SessionTable.runtime_epoch} + 1`,
          })
          .where(eq(SessionTable.id, sessionID))
          .run()
          .pipe(Effect.orDie, Effect.asVoid)
      })
      const operations = [
        () => control.switchAgent({ sessionID, agent: "reviewer" }),
        () => control.skill({ sessionID, skill: "review", resume: false }),
      ]
      for (change of changes)
        for (const operation of operations) {
          expect(yield* operation().pipe(Effect.flip)).toMatchObject({
            _tag: "SessionRuntime.Mismatch",
            actualOwner: change === "owner" ? "v1" : "v2",
            actualState: change === "state" ? "draining" : "ready",
            actualEpoch: 1,
          })
          expect(yield* runtime.assert({ sessionID, owner: "v2", state: "ready", epoch: 0 })).toBeDefined()
        }
      expect(commits).toBe(6)
      expect(
        yield* db.select().from(EventTable).where(eq(EventTable.aggregate_id, sessionID)).all().pipe(Effect.orDie),
      ).toEqual([])
      expect(yield* db.select().from(SessionInputTable).all().pipe(Effect.orDie)).toEqual([])
      expect(wakes).toEqual([])
    }),
  )

  it.effect("fences same-agent and exact-skill retries without mutation or wake", () =>
    Effect.gen(function* () {
      yield* setup
      skillItems.push(
        new SkillV2.Info({ name: "review", location: AbsolutePath.make("/skills/review.md"), content: "Review" }),
      )
      const { db } = yield* Database.Service
      const events = yield* EventV2.Service
      const runtime = yield* SessionRuntime.Service
      const sessions = yield* SessionV2.Service
      const id = SessionMessage.ID.make("msg_guarded_skill_retry")
      wakes.length = 0
      yield* db.update(SessionTable).set({ agent: "reviewer" }).where(eq(SessionTable.id, sessionID)).run().pipe(Effect.orDie)
      yield* SessionInput.admit(db, events, {
        id,
        sessionID,
        prompt: new Prompt({ text: "Review" }),
        delivery: "steer",
      })
      let change: "owner" | "epoch" = "epoch"
      const transition = () =>
        db
          .update(SessionTable)
          .set({
            ...(change === "owner" ? { runtime: "v1" as const } : {}),
            runtime_epoch: sql`${SessionTable.runtime_epoch} + 1`,
          })
          .where(eq(SessionTable.id, sessionID))
          .run()
          .pipe(Effect.orDie, Effect.asVoid)
      const fenced = SessionRuntime.Service.of({
        ...runtime,
        assert: (input) =>
          input.epoch === undefined ? runtime.assert(input).pipe(Effect.tap(transition)) : runtime.assert(input),
      })
      const layer = SessionControl.layer.pipe(
        Layer.provide(Layer.succeed(SessionV2.Service, sessions)),
        Layer.provide(Layer.succeed(SessionRuntime.Service, fenced)),
      )
      const before = yield* db.select().from(EventTable).where(eq(EventTable.aggregate_id, sessionID)).all().pipe(Effect.orDie)
      const scope = yield* Scope.make()
      yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void))
      const control = Context.get(yield* Layer.buildWithScope(Layer.fresh(layer), scope), SessionControl.Service)
      expect(yield* control.switchAgent({ sessionID, agent: "reviewer" }).pipe(Effect.flip)).toMatchObject({
        _tag: "SessionRuntime.Mismatch",
        actualEpoch: 1,
      })
      yield* db
        .update(SessionTable)
        .set({ runtime: "v2", runtime_state: "ready", runtime_epoch: 0 })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)
      change = "owner"
      expect(yield* control.skill({ id, sessionID, skill: "review" }).pipe(Effect.flip)).toMatchObject({
        _tag: "SessionRuntime.Mismatch",
        actualOwner: "v1",
      })
      yield* db
        .update(SessionTable)
        .set({ runtime: "v2", runtime_state: "ready", runtime_epoch: 0 })
        .where(eq(SessionTable.id, sessionID))
        .run()
        .pipe(Effect.orDie)

      expect(yield* db.select().from(EventTable).where(eq(EventTable.aggregate_id, sessionID)).all().pipe(Effect.orDie)).toEqual(before)
      expect(wakes).toEqual([])
      expect(yield* runtime.assert({ sessionID, owner: "v2", state: "ready", epoch: 0 })).toBeDefined()
    }),
  )
})
