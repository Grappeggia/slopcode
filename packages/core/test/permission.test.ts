import { describe, expect } from "bun:test"
import { Deferred, Effect, Fiber, Layer } from "effect"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { Location } from "@slopcode-ai/core/location"
import { PermissionV2 } from "@slopcode-ai/core/permission"
import { PermissionTable } from "@slopcode-ai/core/permission/sql"
import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { Project } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionTable } from "@slopcode-ai/core/session/sql"
import { SessionExecution } from "@slopcode-ai/core/session/execution"
import { SessionStore } from "@slopcode-ai/core/session/store"
import { ShellParser } from "@slopcode-ai/core/shell-parser"
import { eq } from "drizzle-orm"
import { location } from "./fixture/location"
import { testEffect } from "./lib/effect"
import { locationServices } from "./lib/location-services"

const database = Database.layerFromPath(":memory:")
const projectID = Project.ID.make("project_test")
const current = Layer.succeed(
  Location.Service,
  Location.Service.of({
    ...location({ directory: AbsolutePath.make("/project") }),
    project: { id: projectID, directory: AbsolutePath.make("/project") },
    vcs: { type: "git", store: AbsolutePath.make("/project/.git") },
  }),
)
const events = EventV2.layer.pipe(Layer.provide(database))
const store = SessionStore.layer.pipe(Layer.provide(database))
const sessions = SessionV2.layer.pipe(
  Layer.provide(events),
  Layer.provide(database),
  Layer.provide(store),
  Layer.provide(Project.defaultLayer),
  Layer.provide(SessionExecution.noopLayer),
  Layer.provide(locationServices),
)
const saved = PermissionSaved.layer.pipe(Layer.provide(database))
const layer = PermissionV2.locationLayer.pipe(
  Layer.provideMerge(database),
  Layer.provideMerge(store),
  Layer.provideMerge(events),
  Layer.provideMerge(current),
  Layer.provideMerge(sessions),
  Layer.provideMerge(SessionExecution.noopLayer),
  Layer.provideMerge(saved),
)
const it = testEffect(layer)

function setup(rules: PermissionV2.Ruleset = []) {
  return Effect.gen(function* () {
    const { db } = yield* Database.Service
    yield* db
      .insert(ProjectTable)
      .values({ id: projectID, worktree: AbsolutePath.make("/project"), vcs: "git", sandboxes: [] })
      .onConflictDoNothing()
      .run()
      .pipe(Effect.orDie)
    yield* db
      .insert(SessionTable)
      .values({
        id: SessionV2.ID.make("ses_test"),
        project_id: projectID,
        slug: "test",
        directory: "/project",
        title: "test",
        version: "test",
        agent: "test",
      })
      .onConflictDoNothing()
      .run()
      .pipe(Effect.orDie)
    yield* setRules(rules)
  })
}

function setRules(rules: PermissionV2.Ruleset) {
  return Effect.gen(function* () {
    const agents = yield* AgentV2.Service
    yield* agents.transform((editor) =>
      editor.update(AgentV2.ID.make("test"), (agent) => {
        agent.permissions = [...rules]
      }),
    )
  })
}

function assertion(input: Partial<PermissionV2.AssertInput> = {}) {
  return {
    id: PermissionV2.ID.create("per_test"),
    sessionID: SessionV2.ID.make("ses_test"),
    action: "read",
    resources: ["src/index.ts"],
    ...input,
  } satisfies PermissionV2.AssertInput
}

function waitForRequest(input: PermissionV2.AssertInput = assertion()) {
  return Effect.gen(function* () {
    const service = yield* PermissionV2.Service
    const events = yield* EventV2.Service
    const asked = yield* Deferred.make<PermissionV2.Request>()
    const unsubscribe = yield* events.listen((event) =>
      event.type === PermissionV2.Event.Asked.type
        ? Deferred.succeed(asked, event.data as PermissionV2.Request).pipe(Effect.asVoid)
        : Effect.void,
    )
    yield* Effect.addFinalizer(() => unsubscribe)
    const fiber = yield* service.assert(input).pipe(Effect.forkScoped)
    const request = yield* Deferred.await(asked)
    return { service, fiber, request }
  })
}

describe("PermissionV2", () => {
  it.effect("returns the evaluated effect and only queues prompts", () =>
    Effect.gen(function* () {
      yield* setup([{ action: "read", resource: "*", effect: "allow" }])
      const service = yield* PermissionV2.Service
      expect(yield* service.ask(assertion())).toEqual({ id: PermissionV2.ID.create("per_test"), effect: "allow" })
      expect(yield* service.list()).toEqual([])
      yield* setRules([{ action: "read", resource: "*", effect: "deny" }])
      expect(yield* service.ask(assertion())).toEqual({ id: PermissionV2.ID.create("per_test"), effect: "deny" })
      expect(yield* service.list()).toEqual([])
      yield* setRules([])
      expect(yield* service.ask(assertion())).toEqual({ id: PermissionV2.ID.create("per_test"), effect: "ask" })
      expect(yield* service.get(PermissionV2.ID.create("per_test"))).toBeDefined()
    }),
  )

  it.effect("evaluates against an explicit provider-turn agent", () =>
    Effect.gen(function* () {
      yield* setup([{ action: "read", resource: "*", effect: "allow" }])
      const agents = yield* AgentV2.Service
      yield* agents.transform((editor) =>
        editor.update(AgentV2.ID.make("reviewer"), (agent) => {
          agent.permissions.push({ action: "read", resource: "*", effect: "deny" })
        }),
      )
      const service = yield* PermissionV2.Service

      expect(yield* service.ask(assertion())).toMatchObject({ effect: "allow" })
      expect(yield* service.ask(assertion({ agent: AgentV2.ID.make("reviewer") }))).toMatchObject({ effect: "deny" })
      yield* agents.transform((editor) =>
        editor.update(AgentV2.ID.make("reviewer"), (agent) => {
          agent.permissions = []
        }),
      )
      expect(yield* service.ask(assertion({ agent: AgentV2.ID.make("reviewer") }))).toMatchObject({ effect: "ask" })
      expect(yield* service.get(PermissionV2.ID.create("per_test"))).not.toHaveProperty("agent")
    }),
  )

  it.effect("allows and denies from explicit rules without asking", () =>
    Effect.gen(function* () {
      yield* setup([{ action: "read", resource: "*", effect: "allow" }])
      const service = yield* PermissionV2.Service
      yield* service.assert(assertion())
      yield* setRules([{ action: "read", resource: "*", effect: "deny" }])
      const denied = yield* service.assert(assertion()).pipe(Effect.flip)
      expect(denied).toBeInstanceOf(PermissionV2.DeniedError)
      expect(yield* service.list()).toEqual([])
    }),
  )

  it.effect("enforces every persisted task ceiling deny over child rules and saved approvals", () =>
    Effect.gen(function* () {
      yield* setup([{ action: "read", resource: "*", effect: "allow" }])
      const { db } = yield* Database.Service
      yield* db
        .update(SessionTable)
        .set({
          metadata: {
            task: {
              version: 1,
              parentID: SessionV2.ID.make("ses_parent"),
              agent: AgentV2.ID.make("test"),
              origin: { messageID: "msg_parent", callID: "call-parent" },
              ceiling: [
                { action: "read", resource: "secret", effect: "deny" },
                { action: "read", resource: "*", effect: "allow" },
              ],
            },
          },
        })
        .where(eq(SessionTable.id, SessionV2.ID.make("ses_test")))
        .run()
        .pipe(Effect.orDie)
      yield* (yield* PermissionSaved.Service).add({
        scope: "project",
        projectID,
        action: "read",
        resources: ["secret"],
      })

      expect(yield* (yield* PermissionV2.Service).ask(assertion({ resources: ["secret"] }))).toMatchObject({
        effect: "deny",
      })
    }),
  )

  it.effect("forces external-directory ceiling asks over child allows and saved approvals", () =>
    Effect.gen(function* () {
      yield* setup([{ action: "external_directory", resource: "*", effect: "allow" }])
      const { db } = yield* Database.Service
      yield* db
        .update(SessionTable)
        .set({
          metadata: {
            task: {
              version: 1,
              parentID: SessionV2.ID.make("ses_parent"),
              agent: AgentV2.ID.make("test"),
              origin: { messageID: "msg_parent", callID: "call-parent" },
              ceiling: [{ action: "*", resource: "/outside/*", effect: "ask" }],
            },
          },
        })
        .where(eq(SessionTable.id, SessionV2.ID.make("ses_test")))
        .run()
        .pipe(Effect.orDie)
      yield* (yield* PermissionSaved.Service).add({
        scope: "project",
        projectID,
        action: "external_directory",
        resources: ["/outside/file"],
      })
      const service = yield* PermissionV2.Service
      const input = assertion({
        action: "external_directory",
        resources: ["/outside/file"],
        save: ["/outside/file"],
      })
      expect(yield* service.ask(input)).toMatchObject({ effect: "ask" })
      const pending = yield* service
        .assert({ ...input, id: PermissionV2.ID.create("per_ceiling_once") })
        .pipe(Effect.forkChild)
      yield* Effect.yieldNow
      yield* service.reply({ requestID: PermissionV2.ID.create("per_ceiling_once"), reply: "always" })
      yield* Fiber.join(pending)
      expect(yield* service.ask({ ...input, id: PermissionV2.ID.create("per_ceiling_future") })).toMatchObject({
        effect: "ask",
      })
    }),
  )

  it.effect("allows managed output reads without granting external directory access", () =>
    Effect.gen(function* () {
      yield* setup([
        { action: "*", resource: "*", effect: "deny" },
        { action: "read", resource: "*", effect: "allow" },
      ])
      const service = yield* PermissionV2.Service

      expect(yield* service.ask(assertion({ resources: ["tool_123"] }))).toMatchObject({ effect: "allow" })
      expect(
        yield* service.ask(assertion({ action: "external_directory", resources: ["/tmp/tool-output/*"] })),
      ).toMatchObject({ effect: "deny" })
    }),
  )

  it.effect("uses build permissions when the Session agent is omitted", () =>
    Effect.gen(function* () {
      yield* setup()
      const { db } = yield* Database.Service
      yield* db
        .update(SessionTable)
        .set({ agent: null })
        .where(eq(SessionTable.id, SessionV2.ID.make("ses_test")))
        .run()
        .pipe(Effect.orDie)
      const agents = yield* AgentV2.Service
      yield* agents.transform((editor) =>
        editor.update(AgentV2.ID.make("build"), (agent) => {
          agent.permissions = [{ action: "todowrite", resource: "*", effect: "allow" }]
        }),
      )

      const service = yield* PermissionV2.Service
      expect(yield* service.ask(assertion({ action: "todowrite", resources: ["*"] }))).toEqual({
        id: PermissionV2.ID.create("per_test"),
        effect: "allow",
      })
      expect(yield* service.list()).toEqual([])
    }),
  )

  it.effect("denies omitted-agent permissions when no primary default agent exists", () =>
    Effect.gen(function* () {
      yield* setup()
      const { db } = yield* Database.Service
      yield* db
        .update(SessionTable)
        .set({ agent: null })
        .where(eq(SessionTable.id, SessionV2.ID.make("ses_test")))
        .run()
        .pipe(Effect.orDie)
      const agents = yield* AgentV2.Service
      yield* agents.transform((editor) => {
        editor.remove(AgentV2.ID.make("test"))
        editor.remove(AgentV2.ID.make("build"))
      })

      const service = yield* PermissionV2.Service
      expect(yield* service.ask(assertion())).toEqual({ id: PermissionV2.ID.create("per_test"), effect: "deny" })
      expect(yield* service.list()).toEqual([])
    }),
  )

  it.effect("evaluates bash with the normal configured-rule semantics", () =>
    Effect.gen(function* () {
      yield* setup([{ action: "*", resource: "*", effect: "allow" }])
      const service = yield* PermissionV2.Service
      const bash = assertion({ action: "bash", resources: ["pwd"] })
      expect(yield* service.ask(bash)).toEqual({ id: PermissionV2.ID.create("per_test"), effect: "allow" })

      yield* setRules([])
      expect(yield* service.ask(bash)).toEqual({ id: PermissionV2.ID.create("per_test"), effect: "ask" })
      expect(yield* service.get(PermissionV2.ID.create("per_test"))).toBeDefined()
    }),
  )

  it.effect("uses saved bash approvals while preserving configured deny precedence", () =>
    Effect.gen(function* () {
      yield* setup()
      const saved = yield* PermissionSaved.Service
      yield* saved.add({ scope: "project", projectID, action: "bash", resources: ["pwd"] })

      const service = yield* PermissionV2.Service
      expect(yield* service.ask(assertion({ action: "bash", resources: ["pwd"] }))).toEqual({
        id: PermissionV2.ID.create("per_test"),
        effect: "allow",
      })
      expect(yield* service.list()).toEqual([])

      yield* setRules([{ action: "bash", resource: "*", effect: "deny" }])
      expect(yield* service.ask(assertion({ action: "bash", resources: ["pwd"] }))).toEqual({
        id: PermissionV2.ID.create("per_test"),
        effect: "deny",
      })
    }),
  )

  it.effect("denies any granular bash resource before prompting", () =>
    Effect.gen(function* () {
      yield* setup([
        { action: "bash", resource: "*", effect: "ask" },
        { action: "bash", resource: "git *", effect: "allow" },
        { action: "bash", resource: "rm *", effect: "deny" },
      ])
      const service = yield* PermissionV2.Service
      const denied = yield* service
        .assert(assertion({ action: "bash", resources: ["git status", "rm -rf target"] }))
        .pipe(Effect.flip)
      expect(denied).toBeInstanceOf(PermissionV2.DeniedError)
      expect(yield* service.list()).toEqual([])
    }),
  )

  it.effect("keeps granular bash once decisions ephemeral", () =>
    Effect.gen(function* () {
      yield* setup([
        { action: "bash", resource: "*", effect: "ask" },
        { action: "bash", resource: "git *", effect: "allow" },
      ])
      const input = assertion({
        action: "bash",
        resources: ["git status", "rm -rf target"],
        save: ["git status", "rm -rf target"],
      })
      const { service, fiber, request } = yield* waitForRequest(input)
      expect(request.resources).toEqual(["git status", "rm -rf target"])
      yield* service.reply({ requestID: request.id, reply: "once" })
      yield* Fiber.join(fiber)
      expect(yield* (yield* PermissionSaved.Service).list()).toEqual([])
      expect(yield* service.ask({ ...input, id: PermissionV2.ID.create("per_again") })).toMatchObject({
        effect: "ask",
      })
    }),
  )

  it.effect("persists literal session resources without interpreting glob metacharacters", () =>
    Effect.gen(function* () {
      yield* setup()
      const exact = "echo * ? [abc]"
      const input = assertion({ action: "bash", resources: [exact], save: ["legacy *"] })
      const { service, fiber, request } = yield* waitForRequest(input)
      expect(request.grant).toEqual({ resources: [exact], scopes: ["session", "global"] })
      yield* service.reply({ requestID: request.id, reply: "session" })
      yield* Fiber.join(fiber)

      expect(yield* service.ask({ ...input, id: PermissionV2.ID.create("per_exact") })).toMatchObject({
        effect: "allow",
      })
      expect(
        yield* service.ask({
          ...input,
          id: PermissionV2.ID.create("per_pattern"),
          resources: ["echo anything x a"],
        }),
      ).toMatchObject({ effect: "ask" })
    }),
  )

  it.effect("does not inherit session grants into child sessions", () =>
    Effect.gen(function* () {
      yield* setup()
      const { db } = yield* Database.Service
      const child = SessionV2.ID.make("ses_child")
      yield* db
        .insert(SessionTable)
        .values({
          id: child,
          parent_id: SessionV2.ID.make("ses_test"),
          project_id: projectID,
          slug: "child",
          directory: "/project",
          title: "child",
          version: "test",
          agent: "test",
        })
        .run()
        .pipe(Effect.orDie)
      const service = yield* PermissionV2.Service
      const input = assertion({ action: "bash", resources: ["bun test"] })
      const { fiber, request } = yield* waitForRequest(input)
      yield* service.reply({ requestID: request.id, reply: "session" })
      yield* Fiber.join(fiber)

      expect(yield* service.ask({ ...input, id: PermissionV2.ID.create("per_parent") })).toMatchObject({
        effect: "allow",
      })

      expect(yield* service.ask({ ...input, id: PermissionV2.ID.create("per_child"), sessionID: child })).toMatchObject(
        {
          effect: "ask",
        },
      )
    }),
  )

  it.effect("revalidates configured denies before applying a scoped reply", () =>
    Effect.gen(function* () {
      yield* setup()
      const input = assertion({ action: "bash", resources: ["rm -rf target"] })
      const { service, fiber, request } = yield* waitForRequest(input)
      yield* setRules([{ action: "bash", resource: "rm *", effect: "deny" }])
      yield* service.reply({ requestID: request.id, reply: "global" })

      expect(yield* Fiber.join(fiber).pipe(Effect.exit)).toMatchObject({ _tag: "Failure" })
      expect(yield* (yield* PermissionSaved.Service).list({ scope: "global" })).toEqual([])
    }),
  )

  it.effect("keeps multi-resource global persistence atomic and retryable", () =>
    Effect.gen(function* () {
      yield* setup()
      const input = assertion({ action: "bash", resources: ["echo *", "file?.txt"] })
      const { service, fiber, request } = yield* waitForRequest(input)
      const { db } = yield* Database.Service
      yield* db
        .run(
          "CREATE TRIGGER fail_global_permission BEFORE INSERT ON permission BEGIN SELECT RAISE(FAIL, 'forced permission failure'); END",
        )
        .pipe(Effect.orDie)

      expect(yield* service.reply({ requestID: request.id, reply: "global" }).pipe(Effect.exit)).toMatchObject({
        _tag: "Failure",
      })
      expect(yield* service.get(request.id)).toEqual(request)
      expect(yield* (yield* PermissionSaved.Service).list({ scope: "global" })).toEqual([])

      yield* db.run("DROP TRIGGER fail_global_permission").pipe(Effect.orDie)
      yield* service.reply({ requestID: request.id, reply: "global" })
      yield* Fiber.join(fiber)
      expect(yield* (yield* PermissionSaved.Service).list({ scope: "global" })).toHaveLength(2)
    }),
  )

  it.effect("saves every granular bash resource while configured deny still wins", () =>
    Effect.gen(function* () {
      yield* setup([
        { action: "bash", resource: "*", effect: "ask" },
        { action: "bash", resource: "git *", effect: "allow" },
      ])
      const input = assertion({
        action: "bash",
        resources: ["git status", "rm -rf target"],
        save: ["git status", "rm -rf target"],
      })
      const { service, fiber, request } = yield* waitForRequest(input)
      yield* service.reply({ requestID: request.id, reply: "always" })
      yield* Fiber.join(fiber)
      expect(yield* (yield* PermissionSaved.Service).list()).toMatchObject([
        { action: "bash", resource: "git status" },
        { action: "bash", resource: "rm -rf target" },
      ])
      expect(yield* service.ask({ ...input, id: PermissionV2.ID.create("per_saved") })).toMatchObject({
        effect: "allow",
      })

      yield* setRules([
        { action: "bash", resource: "*", effect: "ask" },
        { action: "bash", resource: "git *", effect: "allow" },
        { action: "bash", resource: "rm *", effect: "deny" },
      ])
      expect(yield* service.ask({ ...input, id: PermissionV2.ID.create("per_denied") })).toMatchObject({
        effect: "deny",
      })
    }),
  )

  it.effect("scopes saved opaque shell approvals to one exact shell statement", () =>
    Effect.gen(function* () {
      yield* setup()
      const resource = ShellParser.opaque("cmd.exe", "curl https://example.test/Auth/Path?token=TokenABC")
      const input = assertion({ action: "bash", resources: [resource], save: [resource] })
      const { service, fiber, request } = yield* waitForRequest(input)
      yield* service.reply({ requestID: request.id, reply: "always" })
      yield* Fiber.join(fiber)

      expect(yield* service.ask({ ...input, id: PermissionV2.ID.create("per_opaque_saved") })).toMatchObject({
        effect: "allow",
      })
      expect(
        yield* service.ask(
          assertion({
            id: PermissionV2.ID.create("per_opaque_other"),
            action: "bash",
            resources: [ShellParser.opaque("cmd.exe", "curl https://example.test/auth/path?token=tokenabc")],
          }),
        ),
      ).toMatchObject({ effect: "ask" })
      expect(
        yield* service.ask(
          assertion({
            id: PermissionV2.ID.create("per_opaque_shell"),
            action: "bash",
            resources: [ShellParser.opaque("CMD.EXE", "curl https://example.test/Auth/Path?token=TokenABC")],
          }),
        ),
      ).toMatchObject({ effect: "ask" })
    }),
  )

  it.effect("resolves an asked permission once", () =>
    Effect.gen(function* () {
      yield* setup()
      const { service, fiber, request } = yield* waitForRequest()
      expect(yield* service.list()).toEqual([request])
      expect(yield* service.forSession(request.sessionID)).toEqual([request])
      expect(yield* service.forSession(SessionV2.ID.make("ses_other"))).toEqual([])
      expect(yield* service.get(request.id)).toEqual(request)
      yield* service.reply({ requestID: request.id, reply: "once" })
      yield* Fiber.join(fiber)
      expect(yield* service.list()).toEqual([])
      expect(yield* service.get(request.id)).toBeUndefined()
    }),
  )

  it.effect("stores and removes saved resources for a project", () =>
    Effect.gen(function* () {
      yield* setup()
      const service = yield* PermissionV2.Service
      const asked = yield* Deferred.make<PermissionV2.Request>()
      const events = yield* EventV2.Service
      const unsubscribe = yield* events.listen((event) =>
        event.type === PermissionV2.Event.Asked.type
          ? Deferred.succeed(asked, event.data as PermissionV2.Request).pipe(Effect.asVoid)
          : Effect.void,
      )
      yield* Effect.addFinalizer(() => unsubscribe)
      const fiber = yield* service.assert(assertion({ save: ["src/*"] })).pipe(Effect.forkScoped)
      const request = yield* Deferred.await(asked)
      yield* service.reply({ requestID: request.id, reply: "always" })
      yield* Fiber.join(fiber)

      const { db } = yield* Database.Service
      expect(
        yield* db.select().from(PermissionTable).where(eq(PermissionTable.project_id, projectID)).all(),
      ).toMatchObject([{ action: "read", resource: "src/*" }])
      const saved = yield* PermissionSaved.Service
      const id = (yield* saved.list())[0].id
      expect(yield* saved.list()).toEqual([
        { id, projectID, scope: "project", match: "pattern", action: "read", resource: "src/*" },
      ])
      yield* service.assert(assertion({ id: PermissionV2.ID.create("per_next"), resources: ["src/next.ts"] }))
      expect(yield* saved.remove({ id, scope: "project", projectID })).toBe(true)
      expect(yield* saved.list()).toEqual([])
    }),
  )

  it.effect("deduplicates saved resources and scopes removal and clearing to a project", () =>
    Effect.gen(function* () {
      yield* setup()
      const { db } = yield* Database.Service
      const other = Project.ID.make("project_other")
      yield* db
        .insert(ProjectTable)
        .values({ id: other, worktree: AbsolutePath.make("/other"), sandboxes: [] })
        .run()
        .pipe(Effect.orDie)

      const saved = yield* PermissionSaved.Service
      yield* saved.add({ scope: "project", projectID, action: "bash", resources: ["git status", "git status"] })
      yield* saved.add({ scope: "project", projectID: other, action: "read", resources: ["README.md"] })

      const item = (yield* saved.list({ projectID }))[0]
      expect(yield* saved.list({ projectID })).toEqual([item])
      expect(item).toMatchObject({ action: "bash", resource: "git status" })
      expect(yield* saved.remove({ id: item.id, scope: "project", projectID: other })).toBe(false)
      expect(yield* saved.list({ projectID })).toEqual([item])
      expect(yield* saved.clear({ scope: "project", projectID: other })).toBe(1)
      expect(yield* saved.list({ projectID: other })).toEqual([])
      expect(yield* saved.list({ projectID })).toEqual([item])
    }),
  )

  it.effect("keeps legacy global-project rows quarantined but revocable", () =>
    Effect.gen(function* () {
      yield* setup()
      const saved = yield* PermissionSaved.Service
      const { db } = yield* Database.Service
      const legacy = PermissionSaved.ID.create()
      yield* db
        .insert(ProjectTable)
        .values({ id: Project.ID.global, worktree: AbsolutePath.make("/"), sandboxes: [] })
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(PermissionTable)
        .values({ id: legacy, project_id: Project.ID.global, action: "bash", resource: "legacy" })
        .run()
        .pipe(Effect.orDie)
      const count = (yield* db.select().from(ProjectTable).all()).length
      expect(yield* saved.list({ projectID: Project.ID.global, scope: "global" })).toEqual([])
      expect(yield* saved.list({ projectID: Project.ID.global, scope: "project" })).toMatchObject([
        { id: legacy, scope: "project", match: "pattern" },
      ])
      expect(yield* saved.remove({ id: legacy, scope: "global" })).toBe(false)
      expect(yield* saved.remove({ id: legacy, scope: "project", projectID: Project.ID.global })).toBe(true)
      expect(yield* db.select().from(PermissionTable).where(eq(PermissionTable.id, legacy)).get()).toBeUndefined()
      expect((yield* db.select().from(ProjectTable).all()).length).toBe(count)
    }),
  )
})
