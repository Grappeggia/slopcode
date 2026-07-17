import { PermissionV1 } from "@slopcode-ai/core/v1/permission"
import { test, expect } from "bun:test"
import { eq } from "drizzle-orm"
import os from "os"
import { Cause, Context, Deferred, Effect, Exit, Fiber, Layer, Ref, Schema } from "effect"
import { EventV2Bridge } from "../../src/event-v2-bridge"
import { CrossSpawnSpawner } from "@slopcode-ai/core/cross-spawn-spawner"
import { Database } from "@slopcode-ai/core/database/database"
import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { PermissionTable } from "@slopcode-ai/core/permission/sql"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { SessionTable } from "@slopcode-ai/core/session/sql"
import { Permission } from "../../src/permission"
import { InstanceState } from "../../src/effect/instance-state"
import { InstanceRef } from "../../src/effect/instance-ref"
import { InstanceBootstrap } from "../../src/project/bootstrap-service"
import { InstanceStore } from "../../src/project/instance-store"
import { TestInstance, reloadInstance, tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { MessageID, SessionID } from "../../src/session/schema"

const events = EventV2Bridge.defaultLayer
const noopBootstrap = Layer.succeed(InstanceBootstrap.Service, InstanceBootstrap.Service.of({ run: Effect.void }))
const saved = PermissionSaved.defaultLayer
const decodeAsked = Schema.decodeUnknownSync(Permission.Event.Asked.data)
const decodeReply = Schema.decodeUnknownSync(Permission.Event.Replied.data)
const env = Layer.mergeAll(
  Permission.layer.pipe(Layer.provideMerge(saved), Layer.provide(events)),
  events,
  Database.defaultLayer,
  CrossSpawnSpawner.defaultLayer,
  InstanceStore.defaultLayer.pipe(Layer.provide(noopBootstrap)),
)
const it = testEffect(env)

class ForecastGate extends Context.Service<
  ForecastGate,
  { entered: Deferred.Deferred<void>; release: Deferred.Deferred<void> }
>()("@test/ForecastGate") {}

const gateLayer = Layer.effect(
  ForecastGate,
  Effect.gen(function* () {
    return ForecastGate.of({ entered: yield* Deferred.make<void>(), release: yield* Deferred.make<void>() })
  }),
)
const gatedSaved = Layer.effect(
  PermissionSaved.Service,
  Effect.gen(function* () {
    const live = yield* PermissionSaved.Service
    const gate = yield* ForecastGate
    let first = true
    return PermissionSaved.Service.of({
      ...live,
      list: (input) =>
        Effect.gen(function* () {
          if (first) {
            first = false
            yield* Deferred.succeed(gate.entered, undefined)
            yield* Deferred.await(gate.release)
          }
          return yield* live.list(input)
        }),
    })
  }),
).pipe(Layer.provide(saved), Layer.provide(gateLayer))
const raceEnv = Layer.mergeAll(
  Permission.layer.pipe(Layer.provide(gatedSaved), Layer.provide(events)),
  events,
  Database.defaultLayer,
  CrossSpawnSpawner.defaultLayer,
  InstanceStore.defaultLayer.pipe(Layer.provide(noopBootstrap)),
  gateLayer,
)
const raceIt = testEffect(raceEnv)

class CommitGate extends Context.Service<
  CommitGate,
  { entered: Deferred.Deferred<void>; release: Deferred.Deferred<void> }
>()("@test/CommitGate") {}

const commitGateLayer = Layer.effect(
  CommitGate,
  Effect.gen(function* () {
    return CommitGate.of({ entered: yield* Deferred.make<void>(), release: yield* Deferred.make<void>() })
  }),
)
const committedSaved = Layer.effect(
  PermissionSaved.Service,
  Effect.gen(function* () {
    const live = yield* PermissionSaved.Service
    const gate = yield* CommitGate
    return PermissionSaved.Service.of({
      ...live,
      addBatch: (input) =>
        live.addBatch(input).pipe(
          Effect.tap(() => Deferred.succeed(gate.entered, undefined)),
          Effect.andThen(Deferred.await(gate.release)),
        ),
    })
  }),
).pipe(Layer.provide(saved), Layer.provide(commitGateLayer))
const commitEnv = Layer.mergeAll(
  Permission.layer.pipe(Layer.provideMerge(committedSaved), Layer.provide(events)),
  events,
  Database.defaultLayer,
  CrossSpawnSpawner.defaultLayer,
  InstanceStore.defaultLayer.pipe(Layer.provide(noopBootstrap)),
  commitGateLayer,
)
const commitIt = testEffect(commitEnv)

class RegistrationGate extends Context.Service<
  RegistrationGate,
  { entered: Deferred.Deferred<void>; release: Deferred.Deferred<void>; armed: boolean }
>()("@test/RegistrationGate") {}

const registrationGateLayer = Layer.effect(
  RegistrationGate,
  Effect.gen(function* () {
    return RegistrationGate.of({
      entered: yield* Deferred.make<void>(),
      release: yield* Deferred.make<void>(),
      armed: false,
    })
  }),
)
const registrationSaved = Layer.effect(
  PermissionSaved.Service,
  Effect.gen(function* () {
    const live = yield* PermissionSaved.Service
    const gate = yield* RegistrationGate
    return PermissionSaved.Service.of({
      ...live,
      list: (input) =>
        Effect.gen(function* () {
          const rows = yield* live.list(input)
          if (!gate.armed || (input?.scope !== "project" && input?.scope !== "directory")) return rows
          gate.armed = false
          yield* Deferred.succeed(gate.entered, undefined)
          yield* Deferred.await(gate.release)
          return rows
        }),
      listCurrent: (input) =>
        Effect.gen(function* () {
          const rows = yield* live.listCurrent(input)
          if (!gate.armed) return rows
          gate.armed = false
          yield* Deferred.succeed(gate.entered, undefined)
          yield* Deferred.await(gate.release)
          return rows
        }),
    })
  }),
).pipe(Layer.provide(saved), Layer.provide(registrationGateLayer))
const registrationEnv = Layer.mergeAll(
  Permission.layer.pipe(Layer.provideMerge(registrationSaved), Layer.provide(events)),
  events,
  Database.defaultLayer,
  CrossSpawnSpawner.defaultLayer,
  InstanceStore.defaultLayer.pipe(Layer.provide(noopBootstrap)),
  registrationGateLayer,
)
const registrationIt = testEffect(registrationEnv)

const rejectAll = (message?: string) =>
  Effect.gen(function* () {
    const permission = yield* Permission.Service
    for (const req of yield* permission.list()) {
      yield* permission.reply({
        requestID: req.id,
        reply: "reject",
        message,
      })
    }
  })

const waitForPending = (count: number) =>
  Effect.gen(function* () {
    const permission = yield* Permission.Service
    return yield* Effect.gen(function* () {
      while (true) {
        const list = yield* permission.list()
        if (list.length === count) return list
        yield* Effect.sleep("10 millis")
      }
    }).pipe(
      Effect.timeoutOrElse({
        duration: "1 second",
        orElse: () => Effect.fail(new Error(`timed out waiting for ${count} pending permission request(s)`)),
      }),
    )
  })

const fail = <A, E, R>(self: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const exit = yield* self.pipe(Effect.exit)
    if (Exit.isFailure(exit)) return Cause.squash(exit.cause)
    throw new Error("expected permission effect to fail")
  })

const ask = (input: Parameters<Permission.Interface["ask"]>[0]) =>
  Effect.gen(function* () {
    const permission = yield* Permission.Service
    return yield* permission.ask(input)
  })

const reply = (input: Parameters<Permission.Interface["reply"]>[0]) =>
  Effect.gen(function* () {
    const permission = yield* Permission.Service
    return yield* permission.reply(input)
  })

const list = () =>
  Effect.gen(function* () {
    const permission = yield* Permission.Service
    return yield* permission.list()
  })

const forecast = (input: Parameters<Permission.Interface["forecast"]>[0]) =>
  Effect.gen(function* () {
    const permission = yield* Permission.Service
    return yield* permission.forecast(input)
  })

const review = (
  sessionID: SessionID,
  policy: () => Effect.Effect<PermissionV1.Ruleset> = () =>
    Effect.succeed([{ permission: "*", pattern: "*", action: "ask" }]),
) =>
  Effect.gen(function* () {
    const permission = yield* Permission.Service
    return yield* permission.review({ sessionID, policy })
  })

const replyBatch = (input: Parameters<Permission.Interface["replyBatch"]>[0]) =>
  Effect.gen(function* () {
    const permission = yield* Permission.Service
    return yield* permission.replyBatch(input)
  })

registrationIt.instance(
  "ask revalidates a stale snapshot before registering after project approval",
  () =>
    Effect.gen(function* () {
      const gate = yield* RegistrationGate
      const source = yield* ask({
        id: PermissionV1.ID.make("per_registration_source_project"),
        sessionID: SessionID.make("ses_registration_project_source"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: ["git status"],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      yield* waitForPending(1)

      gate.armed = true
      const stale = yield* ask({
        id: PermissionV1.ID.make("per_registration_stale_project"),
        sessionID: SessionID.make("ses_registration_project_other"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      yield* Deferred.await(gate.entered)

      yield* reply({ requestID: PermissionV1.ID.make("per_registration_source_project"), reply: "project" })
      yield* Fiber.join(source)
      yield* Deferred.succeed(gate.release, undefined)

      yield* Fiber.join(stale).pipe(Effect.timeout("1 second"))
      expect(yield* list()).toEqual([])
    }),
  { git: true },
)

registrationIt.instance(
  "ask applies a live deny before a concurrent project grant during admission",
  () =>
    Effect.gen(function* () {
      const gate = yield* RegistrationGate
      const policy = yield* Ref.make<PermissionV1.Ruleset>([
        { permission: "bash", pattern: "*", action: "ask" },
      ])
      const source = yield* ask({
        id: PermissionV1.ID.make("per_registration_deny_source"),
        sessionID: SessionID.make("ses_registration_deny_source"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: ["git status"],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      yield* waitForPending(1)

      gate.armed = true
      const stale = yield* ask({
        id: PermissionV1.ID.make("per_registration_deny_stale"),
        sessionID: SessionID.make("ses_registration_deny_target"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: yield* Ref.get(policy),
        policy: () => Ref.get(policy),
      }).pipe(Effect.forkScoped)
      yield* Deferred.await(gate.entered)

      yield* Ref.set(policy, [{ permission: "bash", pattern: "*", action: "deny" }])
      yield* reply({ requestID: PermissionV1.ID.make("per_registration_deny_source"), reply: "project" })
      yield* Fiber.join(source)
      yield* Deferred.succeed(gate.release, undefined)

      const exit = yield* Fiber.await(stale).pipe(Effect.timeout("1 second"))
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBeInstanceOf(PermissionV1.DeniedError)
      expect(yield* list()).toEqual([])
    }),
  { git: true },
)

// fromConfig tests

test("fromConfig - string value becomes wildcard rule", () => {
  const result = Permission.fromConfig({ bash: "allow" })
  expect(result).toEqual([{ permission: "bash", pattern: "*", action: "allow" }])
})

test("fromConfig - object value converts to rules array", () => {
  const result = Permission.fromConfig({ bash: { "*": "allow", rm: "deny" } })
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "rm", action: "deny" },
  ])
})

test("fromConfig - mixed string and object values", () => {
  const result = Permission.fromConfig({
    bash: { "*": "allow", rm: "deny" },
    edit: "allow",
    webfetch: "ask",
  })
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "rm", action: "deny" },
    { permission: "edit", pattern: "*", action: "allow" },
    { permission: "webfetch", pattern: "*", action: "ask" },
  ])
})

test("fromConfig - empty object", () => {
  const result = Permission.fromConfig({})
  expect(result).toEqual([])
})

test("fromConfig - expands tilde to home directory", () => {
  const result = Permission.fromConfig({ external_directory: { "~/projects/*": "allow" } })
  expect(result).toEqual([{ permission: "external_directory", pattern: `${os.homedir()}/projects/*`, action: "allow" }])
})

test("fromConfig - expands $HOME to home directory", () => {
  const result = Permission.fromConfig({ external_directory: { "$HOME/projects/*": "allow" } })
  expect(result).toEqual([{ permission: "external_directory", pattern: `${os.homedir()}/projects/*`, action: "allow" }])
})

test("fromConfig - expands $HOME without trailing slash", () => {
  const result = Permission.fromConfig({ external_directory: { $HOME: "allow" } })
  expect(result).toEqual([{ permission: "external_directory", pattern: os.homedir(), action: "allow" }])
})

test("fromConfig - does not expand tilde in middle of path", () => {
  const result = Permission.fromConfig({ external_directory: { "/some/~/path": "allow" } })
  expect(result).toEqual([{ permission: "external_directory", pattern: "/some/~/path", action: "allow" }])
})

// Permission precedence follows config insertion order. `evaluate()` uses the
// last matching rule, so later config entries intentionally override earlier
// entries even when a wildcard appears after a specific permission.

test("fromConfig - preserves top-level config key order", () => {
  const wildcardFirst = Permission.fromConfig({ "*": "deny", bash: "allow" })
  const specificFirst = Permission.fromConfig({ bash: "allow", "*": "deny" })

  expect(wildcardFirst.map((r) => r.permission)).toEqual(["*", "bash"])
  expect(specificFirst.map((r) => r.permission)).toEqual(["bash", "*"])

  expect(Permission.evaluate("bash", "ls", wildcardFirst).action).toBe("allow")
  expect(Permission.evaluate("bash", "ls", specificFirst).action).toBe("deny")
})

test("fromConfig - wildcard acts as fallback when it appears before specifics", () => {
  const ruleset = Permission.fromConfig({ "*": "ask", bash: "allow" })
  expect(Permission.evaluate("edit", "foo.ts", ruleset).action).toBe("ask")
  expect(Permission.evaluate("bash", "ls", ruleset).action).toBe("allow")
})

test("fromConfig - top-level ordering is not sorted by wildcard specificity", () => {
  const ruleset = Permission.fromConfig({
    bash: "allow",
    "*": "ask",
    edit: "deny",
    "mcp_*": "allow",
  })
  expect(ruleset.map((r) => r.permission)).toEqual(["bash", "*", "edit", "mcp_*"])
})

test("fromConfig - sub-pattern insertion order inside a tool key is preserved", () => {
  const ruleset = Permission.fromConfig({ bash: { "*": "deny", "git *": "allow" } })
  expect(ruleset.map((r) => r.pattern)).toEqual(["*", "git *"])
  expect(Permission.evaluate("bash", "rm foo", ruleset).action).toBe("deny")
  expect(Permission.evaluate("bash", "git status", ruleset).action).toBe("allow")
})

test("fromConfig - documented fallback-first example", () => {
  const ruleset = Permission.fromConfig({ "*": "ask", bash: "allow", edit: "deny" })
  expect(Permission.evaluate("bash", "ls", ruleset).action).toBe("allow")
  expect(Permission.evaluate("edit", "foo.ts", ruleset).action).toBe("deny")
  expect(Permission.evaluate("read", "foo.ts", ruleset).action).toBe("ask")
})

it.instance("query returns the effective action without requests, events, or approvals", () =>
  Effect.gen(function* () {
    const permission = yield* Permission.Service
    const bridge = yield* EventV2Bridge.Service
    const events: string[] = []
    const unsubscribe = yield* bridge.listen((event) =>
      Effect.sync(() => {
        events.push(event.type)
      }),
    )

    expect(
      yield* permission.query({
        permission: "read",
        pattern: "secret.env",
        ruleset: [
          { permission: "read", pattern: "*", action: "allow" },
          { permission: "read", pattern: "*.env", action: "ask" },
        ],
      }),
    ).toBe("ask")
    expect(yield* permission.list()).toEqual([])
    expect(events).toEqual([])

    const pending = yield* Effect.forkChild(
      permission.ask({
        sessionID: SessionID.make("ses_query"),
        permission: "read",
        patterns: ["secret.env"],
        always: ["secret.env"],
        metadata: {},
        ruleset: [{ permission: "read", pattern: "*", action: "ask" }],
      }),
    )
    expect((yield* waitForPending(1))[0]?.patterns).toEqual(["secret.env"])
    yield* Fiber.interrupt(pending)
    yield* unsubscribe
  }),
)

it.instance(
  "query includes remembered project approvals without creating requests",
  () =>
    Effect.gen(function* () {
      const permission = yield* Permission.Service
      const bridge = yield* EventV2Bridge.Service
      const events: string[] = []
      const unsubscribe = yield* bridge.listen((event) =>
        Effect.sync(() => {
          events.push(event.type)
        }),
      )
      const first = yield* permission
        .ask({
          sessionID: SessionID.make("ses_permission_source"),
          permission: "read",
          patterns: ["secret.txt"],
          always: ["*.txt"],
          metadata: {},
          ruleset: [{ permission: "read", pattern: "*", action: "ask" }],
        })
        .pipe(Effect.forkChild)
      const pending = yield* waitForPending(1)
      yield* permission.reply({ requestID: pending[0].id, reply: "project" })
      yield* Fiber.join(first)

      events.length = 0
      expect(
        yield* permission.query({
          permission: "read",
          pattern: "secret.txt",
          ruleset: [{ permission: "read", pattern: "*", action: "ask" }],
        }),
      ).toBe("allow")
      expect(
        yield* permission.query({
          permission: "read",
          pattern: "secret.txt",
          ruleset: [{ permission: "read", pattern: "*", action: "deny" }],
        }),
      ).toBe("deny")
      expect(yield* permission.list()).toEqual([])
      expect(events).toEqual([])

      yield* permission.ask({
        sessionID: SessionID.make("ses_permission_target"),
        permission: "read",
        patterns: ["secret.txt"],
        always: [],
        metadata: {},
        ruleset: [{ permission: "read", pattern: "*", action: "ask" }],
      })
      expect(yield* permission.list()).toEqual([])
      expect(events).toEqual([])
      yield* unsubscribe
    }),
  { git: true },
)

test("fromConfig - expands exact tilde to home directory", () => {
  const result = Permission.fromConfig({ external_directory: { "~": "allow" } })
  expect(result).toEqual([{ permission: "external_directory", pattern: os.homedir(), action: "allow" }])
})

test("evaluate - matches expanded tilde pattern", () => {
  const ruleset = Permission.fromConfig({ external_directory: { "~/projects/*": "allow" } })
  const result = Permission.evaluate("external_directory", `${os.homedir()}/projects/file.txt`, ruleset)
  expect(result.action).toBe("allow")
})

test("evaluate - matches expanded $HOME pattern", () => {
  const ruleset = Permission.fromConfig({ external_directory: { "$HOME/projects/*": "allow" } })
  const result = Permission.evaluate("external_directory", `${os.homedir()}/projects/file.txt`, ruleset)
  expect(result.action).toBe("allow")
})

// merge tests

test("merge - simple concatenation", () => {
  const result = Permission.merge(
    [{ permission: "bash", pattern: "*", action: "allow" }],
    [{ permission: "bash", pattern: "*", action: "deny" }],
  )
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "*", action: "deny" },
  ])
})

test("merge - adds new permission", () => {
  const result = Permission.merge(
    [{ permission: "bash", pattern: "*", action: "allow" }],
    [{ permission: "edit", pattern: "*", action: "deny" }],
  )
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "edit", pattern: "*", action: "deny" },
  ])
})

test("merge - concatenates rules for same permission", () => {
  const result = Permission.merge(
    [{ permission: "bash", pattern: "foo", action: "ask" }],
    [{ permission: "bash", pattern: "*", action: "deny" }],
  )
  expect(result).toEqual([
    { permission: "bash", pattern: "foo", action: "ask" },
    { permission: "bash", pattern: "*", action: "deny" },
  ])
})

test("merge - multiple rulesets", () => {
  const result = Permission.merge(
    [{ permission: "bash", pattern: "*", action: "allow" }],
    [{ permission: "bash", pattern: "rm", action: "ask" }],
    [{ permission: "edit", pattern: "*", action: "allow" }],
  )
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "rm", action: "ask" },
    { permission: "edit", pattern: "*", action: "allow" },
  ])
})

test("merge - empty ruleset does nothing", () => {
  const result = Permission.merge([{ permission: "bash", pattern: "*", action: "allow" }], [])
  expect(result).toEqual([{ permission: "bash", pattern: "*", action: "allow" }])
})

test("merge - preserves rule order", () => {
  const result = Permission.merge(
    [
      { permission: "edit", pattern: "src/*", action: "allow" },
      { permission: "edit", pattern: "src/secret/*", action: "deny" },
    ],
    [{ permission: "edit", pattern: "src/secret/ok.ts", action: "allow" }],
  )
  expect(result).toEqual([
    { permission: "edit", pattern: "src/*", action: "allow" },
    { permission: "edit", pattern: "src/secret/*", action: "deny" },
    { permission: "edit", pattern: "src/secret/ok.ts", action: "allow" },
  ])
})

test("merge - config permission overrides default ask", () => {
  const defaults: PermissionV1.Ruleset = [{ permission: "*", pattern: "*", action: "ask" }]
  const config: PermissionV1.Ruleset = [{ permission: "bash", pattern: "*", action: "allow" }]
  const merged = Permission.merge(defaults, config)

  expect(Permission.evaluate("bash", "ls", merged).action).toBe("allow")
  expect(Permission.evaluate("edit", "foo.ts", merged).action).toBe("ask")
})

test("merge - config ask overrides default allow", () => {
  const defaults: PermissionV1.Ruleset = [{ permission: "bash", pattern: "*", action: "allow" }]
  const config: PermissionV1.Ruleset = [{ permission: "bash", pattern: "*", action: "ask" }]
  const merged = Permission.merge(defaults, config)

  expect(Permission.evaluate("bash", "ls", merged).action).toBe("ask")
})

// evaluate tests

test("evaluate - exact pattern match", () => {
  const result = Permission.evaluate("bash", "rm", [{ permission: "bash", pattern: "rm", action: "deny" }])
  expect(result.action).toBe("deny")
})

test("evaluate - wildcard pattern match", () => {
  const result = Permission.evaluate("bash", "rm", [{ permission: "bash", pattern: "*", action: "allow" }])
  expect(result.action).toBe("allow")
})

test("evaluate - last matching rule wins", () => {
  const result = Permission.evaluate("bash", "rm", [
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "rm", action: "deny" },
  ])
  expect(result.action).toBe("deny")
})

test("evaluate - last matching rule wins (wildcard after specific)", () => {
  const result = Permission.evaluate("bash", "rm", [
    { permission: "bash", pattern: "rm", action: "deny" },
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  expect(result.action).toBe("allow")
})

test("evaluate - glob pattern match", () => {
  const result = Permission.evaluate("edit", "src/foo.ts", [{ permission: "edit", pattern: "src/*", action: "allow" }])
  expect(result.action).toBe("allow")
})

test("evaluate - last matching glob wins", () => {
  const result = Permission.evaluate("edit", "src/components/Button.tsx", [
    { permission: "edit", pattern: "src/*", action: "deny" },
    { permission: "edit", pattern: "src/components/*", action: "allow" },
  ])
  expect(result.action).toBe("allow")
})

test("evaluate - order matters for specificity", () => {
  const result = Permission.evaluate("edit", "src/components/Button.tsx", [
    { permission: "edit", pattern: "src/components/*", action: "allow" },
    { permission: "edit", pattern: "src/*", action: "deny" },
  ])
  expect(result.action).toBe("deny")
})

test("evaluate - unknown permission returns ask", () => {
  const result = Permission.evaluate("unknown_tool", "anything", [
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  expect(result.action).toBe("ask")
})

test("evaluate - empty ruleset returns ask", () => {
  const result = Permission.evaluate("bash", "rm", [])
  expect(result.action).toBe("ask")
})

test("evaluate - no matching pattern returns ask", () => {
  const result = Permission.evaluate("edit", "etc/passwd", [{ permission: "edit", pattern: "src/*", action: "allow" }])
  expect(result.action).toBe("ask")
})

test("evaluate - empty rules array returns ask", () => {
  const result = Permission.evaluate("bash", "rm", [])
  expect(result.action).toBe("ask")
})

test("evaluate - multiple matching patterns, last wins", () => {
  const result = Permission.evaluate("edit", "src/secret.ts", [
    { permission: "edit", pattern: "*", action: "ask" },
    { permission: "edit", pattern: "src/*", action: "allow" },
    { permission: "edit", pattern: "src/secret.ts", action: "deny" },
  ])
  expect(result.action).toBe("deny")
})

test("evaluate - non-matching patterns are skipped", () => {
  const result = Permission.evaluate("edit", "src/foo.ts", [
    { permission: "edit", pattern: "*", action: "ask" },
    { permission: "edit", pattern: "test/*", action: "deny" },
    { permission: "edit", pattern: "src/*", action: "allow" },
  ])
  expect(result.action).toBe("allow")
})

test("evaluate - exact match at end wins over earlier wildcard", () => {
  const result = Permission.evaluate("bash", "/bin/rm", [
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "/bin/rm", action: "deny" },
  ])
  expect(result.action).toBe("deny")
})

test("evaluate - wildcard at end overrides earlier exact match", () => {
  const result = Permission.evaluate("bash", "/bin/rm", [
    { permission: "bash", pattern: "/bin/rm", action: "deny" },
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  expect(result.action).toBe("allow")
})

// wildcard permission tests

test("evaluate - wildcard permission matches any permission", () => {
  const result = Permission.evaluate("bash", "rm", [{ permission: "*", pattern: "*", action: "deny" }])
  expect(result.action).toBe("deny")
})

test("evaluate - wildcard permission with specific pattern", () => {
  const result = Permission.evaluate("bash", "rm", [{ permission: "*", pattern: "rm", action: "deny" }])
  expect(result.action).toBe("deny")
})

test("evaluate - glob permission pattern", () => {
  const result = Permission.evaluate("mcp_server_tool", "anything", [
    { permission: "mcp_*", pattern: "*", action: "allow" },
  ])
  expect(result.action).toBe("allow")
})

test("evaluate - specific permission and wildcard permission combined", () => {
  const result = Permission.evaluate("bash", "rm", [
    { permission: "*", pattern: "*", action: "deny" },
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  expect(result.action).toBe("allow")
})

test("evaluate - wildcard permission does not match when specific exists", () => {
  const result = Permission.evaluate("edit", "src/foo.ts", [
    { permission: "*", pattern: "*", action: "deny" },
    { permission: "edit", pattern: "src/*", action: "allow" },
  ])
  expect(result.action).toBe("allow")
})

test("evaluate - multiple matching permission patterns combine rules", () => {
  const result = Permission.evaluate("mcp_dangerous", "anything", [
    { permission: "*", pattern: "*", action: "ask" },
    { permission: "mcp_*", pattern: "*", action: "allow" },
    { permission: "mcp_dangerous", pattern: "*", action: "deny" },
  ])
  expect(result.action).toBe("deny")
})

test("evaluate - wildcard permission fallback for unknown tool", () => {
  const result = Permission.evaluate("unknown_tool", "anything", [
    { permission: "*", pattern: "*", action: "ask" },
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  expect(result.action).toBe("ask")
})

test("evaluate - later wildcard permission can override earlier specific permission", () => {
  const result = Permission.evaluate("bash", "rm", [
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "*", pattern: "*", action: "deny" },
  ])
  expect(result.action).toBe("deny")
})

test("evaluate - merges multiple rulesets", () => {
  const config: PermissionV1.Ruleset = [{ permission: "bash", pattern: "*", action: "allow" }]
  const approved: PermissionV1.Ruleset = [{ permission: "bash", pattern: "rm", action: "deny" }]
  const result = Permission.evaluate("bash", "rm", config, approved)
  expect(result.action).toBe("deny")
})

// disabled tests

test("disabled - returns empty set when all tools allowed", () => {
  const result = Permission.disabled(["bash", "edit", "read"], [{ permission: "*", pattern: "*", action: "allow" }])
  expect(result.size).toBe(0)
})

test("disabled - disables tool when denied", () => {
  const result = Permission.disabled(
    ["bash", "edit", "read"],
    [
      { permission: "*", pattern: "*", action: "allow" },
      { permission: "bash", pattern: "*", action: "deny" },
    ],
  )
  expect(result.has("bash")).toBe(true)
  expect(result.has("edit")).toBe(false)
  expect(result.has("read")).toBe(false)
})

test("disabled - disables edit/write/apply_patch when edit denied", () => {
  const result = Permission.disabled(
    ["edit", "write", "apply_patch", "bash"],
    [
      { permission: "*", pattern: "*", action: "allow" },
      { permission: "edit", pattern: "*", action: "deny" },
    ],
  )
  expect(result.has("edit")).toBe(true)
  expect(result.has("write")).toBe(true)
  expect(result.has("apply_patch")).toBe(true)
  expect(result.has("bash")).toBe(false)
})

test("disabled - does not disable when partially denied", () => {
  const result = Permission.disabled(
    ["bash"],
    [
      { permission: "bash", pattern: "*", action: "allow" },
      { permission: "bash", pattern: "rm *", action: "deny" },
    ],
  )
  expect(result.has("bash")).toBe(false)
})

test("disabled - does not disable when action is ask", () => {
  const result = Permission.disabled(["bash", "edit"], [{ permission: "*", pattern: "*", action: "ask" }])
  expect(result.size).toBe(0)
})

test("disabled - does not disable when specific allow after wildcard deny", () => {
  const result = Permission.disabled(
    ["bash"],
    [
      { permission: "bash", pattern: "*", action: "deny" },
      { permission: "bash", pattern: "echo *", action: "allow" },
    ],
  )
  expect(result.has("bash")).toBe(false)
})

test("disabled - does not disable when wildcard allow after deny", () => {
  const result = Permission.disabled(
    ["bash"],
    [
      { permission: "bash", pattern: "rm *", action: "deny" },
      { permission: "bash", pattern: "*", action: "allow" },
    ],
  )
  expect(result.has("bash")).toBe(false)
})

test("disabled - disables multiple tools", () => {
  const result = Permission.disabled(
    ["bash", "edit", "webfetch"],
    [
      { permission: "bash", pattern: "*", action: "deny" },
      { permission: "edit", pattern: "*", action: "deny" },
      { permission: "webfetch", pattern: "*", action: "deny" },
    ],
  )
  expect(result.has("bash")).toBe(true)
  expect(result.has("edit")).toBe(true)
  expect(result.has("webfetch")).toBe(true)
})

test("disabled - wildcard permission denies all tools", () => {
  const result = Permission.disabled(["bash", "edit", "read"], [{ permission: "*", pattern: "*", action: "deny" }])
  expect(result.has("bash")).toBe(true)
  expect(result.has("edit")).toBe(true)
  expect(result.has("read")).toBe(true)
})

test("disabled - specific allow overrides wildcard deny", () => {
  const result = Permission.disabled(
    ["bash", "edit", "read"],
    [
      { permission: "*", pattern: "*", action: "deny" },
      { permission: "bash", pattern: "*", action: "allow" },
    ],
  )
  expect(result.has("bash")).toBe(false)
  expect(result.has("edit")).toBe(true)
  expect(result.has("read")).toBe(true)
})

// ask tests

it.instance(
  "ask - resolves immediately when action is allow",
  () =>
    Effect.gen(function* () {
      const result = yield* ask({
        sessionID: SessionID.make("session_test"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "allow" }],
      })
      expect(result).toBeUndefined()
    }),
  { git: true },
)

it.instance(
  "ask - throws DeniedError when action is deny",
  () =>
    Effect.gen(function* () {
      const err = yield* fail(
        ask({
          sessionID: SessionID.make("session_test"),
          permission: "bash",
          patterns: ["rm -rf /"],
          metadata: {},
          always: [],
          ruleset: [{ permission: "bash", pattern: "*", action: "deny" }],
        }),
      )
      expect(err).toBeInstanceOf(PermissionV1.DeniedError)
    }),
  { git: true },
)

it.instance(
  "ask - stays pending when action is ask",
  () =>
    Effect.gen(function* () {
      const fiber = yield* ask({
        sessionID: SessionID.make("session_test"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)

      expect(yield* waitForPending(1)).toHaveLength(1)
      yield* rejectAll()
      yield* Fiber.await(fiber)
    }),
  { git: true },
)

it.instance(
  "forecast replaces the session set, filters configured decisions, and deduplicates resources",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_forecast_replace")
      const ruleset: PermissionV1.Ruleset = [
        { permission: "bash", pattern: "git status", action: "ask" },
        { permission: "bash", pattern: "git log", action: "allow" },
        { permission: "bash", pattern: "git push", action: "deny" },
        { permission: "read", pattern: "README.md", action: "ask" },
      ]

      expect(
        yield* forecast({
          sessionID,
          ruleset,
          candidates: [
            {
              action: "bash",
              resources: ["git status", "git status", "git log", "git push"],
              reason: "Inspect repository state",
            },
            { action: "bash", resources: ["git status"], reason: "Inspect repository state" },
          ],
        }),
      ).toEqual([
        {
          action: "bash",
          resources: ["git status"],
          reason: "Inspect repository state",
        },
      ])

      expect(
        yield* forecast({
          sessionID,
          ruleset,
          candidates: [{ action: "read", resources: ["README.md"], reason: "Review documentation" }],
        }),
      ).toEqual([{ action: "read", resources: ["README.md"], reason: "Review documentation" }])

      const fiber = yield* review(sessionID).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(1)
      expect(pending).toMatchObject([
        {
          sessionID,
          permission: "read",
          patterns: ["README.md"],
          always: ["README.md"],
          kind: "forecast",
          reason: "Review documentation",
        },
      ])
      expect(pending[0].batchID?.startsWith("pmb_")).toBe(true)
      yield* replyBatch({ batchID: pending[0].batchID!, requestIDs: [], reply: "reject" })
      expect(yield* Fiber.join(fiber)).toBe(true)
      expect(yield* list()).toEqual([])
    }),
  { git: true },
)

it.instance(
  "an empty forecast explicitly clears the previous session forecast",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_forecast_clear")
      const ruleset: PermissionV1.Ruleset = [{ permission: "bash", pattern: "*", action: "ask" }]
      yield* forecast({
        sessionID,
        ruleset,
        candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }],
      })

      expect(yield* forecast({ sessionID, ruleset, candidates: [] })).toEqual([])
      expect(yield* review(sessionID, () => Effect.succeed(ruleset))).toBe(false)
      expect(yield* list()).toEqual([])
    }),
  { git: true },
)

raceIt.instance(
  "concurrent forecast replacement is serialized so the latest invocation wins",
  () =>
    Effect.gen(function* () {
      const gate = yield* ForecastGate
      const sessionID = SessionID.make("ses_forecast_concurrent")
      const ruleset: PermissionV1.Ruleset = [{ permission: "*", pattern: "*", action: "ask" }]
      const first = yield* forecast({
        sessionID,
        ruleset,
        candidates: [{ action: "bash", resources: ["git status"], reason: "First forecast" }],
      }).pipe(Effect.forkScoped)
      yield* Deferred.await(gate.entered)
      const second = yield* forecast({
        sessionID,
        ruleset,
        candidates: [{ action: "read", resources: ["README.md"], reason: "Latest forecast" }],
      }).pipe(Effect.forkScoped)
      yield* Effect.yieldNow
      yield* Deferred.succeed(gate.release, undefined)
      yield* Fiber.join(first)
      yield* Fiber.join(second)

      const reviewFiber = yield* review(sessionID).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(1)
      expect(pending[0]).toMatchObject({ permission: "read", reason: "Latest forecast" })
      yield* replyBatch({ batchID: pending[0].batchID!, requestIDs: [], reply: "reject" })
      yield* Fiber.join(reviewFiber)
    }),
  { git: true },
)

it.instance(
  "a forecast queued after review starts cannot replace the stable reviewed set",
  () =>
    Effect.gen(function* () {
      const bridge = yield* EventV2Bridge.Service
      const publishing = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const unsubscribe = yield* bridge.listen((event) =>
        Effect.gen(function* () {
          if (event.type !== Permission.Event.Asked.type) return
          yield* Deferred.succeed(publishing, undefined)
          yield* Deferred.await(release)
        }),
      )
      yield* Effect.addFinalizer(() => unsubscribe)
      const sessionID = SessionID.make("ses_forecast_after_review")
      const ruleset: PermissionV1.Ruleset = [{ permission: "*", pattern: "*", action: "ask" }]
      yield* forecast({
        sessionID,
        ruleset,
        candidates: [{ action: "bash", resources: ["git status"], reason: "Reviewed forecast" }],
      })
      const reviewFiber = yield* review(sessionID).pipe(Effect.forkScoped)
      yield* Deferred.await(publishing)
      const late = yield* forecast({
        sessionID,
        ruleset,
        candidates: [{ action: "read", resources: ["README.md"], reason: "Late forecast" }],
      }).pipe(Effect.forkScoped)
      yield* Effect.yieldNow
      yield* Deferred.succeed(release, undefined)

      expect(yield* Fiber.join(late)).toEqual([])
      const pending = yield* waitForPending(1)
      expect(pending[0]).toMatchObject({ permission: "bash", reason: "Reviewed forecast" })
      yield* replyBatch({ batchID: pending[0].batchID!, requestIDs: [], reply: "reject" })
      yield* Fiber.join(reviewFiber)
      expect(yield* review(sessionID)).toBe(false)
    }),
  { git: true },
)

it.instance(
  "concurrent reviews join the same active forecast batch",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_forecast_concurrent_review")
      yield* forecast({
        sessionID,
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }],
      })

      const first = yield* review(sessionID).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(1)
      const second = yield* review(sessionID).pipe(Effect.forkScoped)
      yield* Effect.yieldNow
      yield* replyBatch({ batchID: pending[0].batchID!, requestIDs: [], reply: "reject" })

      expect(yield* Fiber.join(first)).toBe(true)
      expect(yield* Fiber.join(second)).toBe(true)
      expect(yield* list()).toEqual([])
    }),
  { git: true },
)

it.instance(
  "a defective Asked listener cancels the exposed batch without publishing later asks",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_forecast_asked_defect")
      const order: Array<{ type: "asked" | "replied"; requestID: PermissionV1.ID }> = []
      const unsubscribe = yield* (yield* EventV2Bridge.Service).listen((event) => {
        if (event.type === Permission.Event.Asked.type) {
          const item = decodeAsked(event.data)
          if (item.sessionID !== sessionID) return Effect.void
          order.push({ type: "asked", requestID: item.id })
          return Effect.die(new Error("asked listener failed"))
        }
        if (event.type === Permission.Event.Replied.type) {
          const item = decodeReply(event.data)
          if (item.sessionID === sessionID) order.push({ type: "replied", requestID: item.requestID })
        }
        return Effect.void
      })
      yield* Effect.addFinalizer(() => unsubscribe)
      yield* forecast({
        sessionID,
        ruleset: [{ permission: "*", pattern: "*", action: "ask" }],
        candidates: [
          { action: "bash", resources: ["git status"], reason: "Inspect state" },
          { action: "read", resources: ["README.md"], reason: "Review docs" },
        ],
      })

      expect(yield* review(sessionID)).toBe(true)
      expect(order).toHaveLength(2)
      expect(order[0]).toMatchObject({ type: "asked" })
      expect(order[1]).toEqual({ type: "replied", requestID: order[0].requestID })
      expect(yield* list()).toEqual([])
      expect(
        yield* forecast({
          sessionID,
          ruleset: [{ permission: "read", pattern: "*", action: "ask" }],
          candidates: [{ action: "read", resources: ["fresh.md"], reason: "Fresh cycle" }],
        }),
      ).toHaveLength(1)
    }),
  { git: true },
)

it.instance(
  "a defective Asked listener rejects an ordinary request with a coherent terminal",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_asked_defect_blocking")
      const order: Array<{ type: "asked" | "replied"; requestID: PermissionV1.ID }> = []
      const unsubscribe = yield* (yield* EventV2Bridge.Service).listen((event) => {
        if (event.type === Permission.Event.Asked.type) {
          const item = decodeAsked(event.data)
          if (item.sessionID !== sessionID) return Effect.void
          order.push({ type: "asked", requestID: item.id })
          return Effect.die(new Error("asked listener failed"))
        }
        if (event.type === Permission.Event.Replied.type) {
          const item = decodeReply(event.data)
          if (item.sessionID === sessionID) order.push({ type: "replied", requestID: item.requestID })
        }
        return Effect.void
      })
      yield* Effect.addFinalizer(() => unsubscribe)

      expect(
        yield* ask({
          sessionID,
          permission: "bash",
          patterns: ["git status"],
          metadata: {},
          always: [],
          ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        }).pipe(Effect.exit, Effect.map(Exit.isFailure)),
      ).toBe(true)
      expect(order).toHaveLength(2)
      expect(order[0]).toMatchObject({ type: "asked" })
      expect(order[1]).toEqual({ type: "replied", requestID: order[0].requestID })
      expect(yield* list()).toEqual([])
    }),
  { git: true },
)

for (const mode of ["timeout", "defect"] as const) {
  for (const answer of ["once", "always", "project"] as const) {
    it.instance(
      `an ordinary ${answer} reply from an Asked listener wins against publication ${mode}`,
      () =>
        Effect.gen(function* () {
          const permission = yield* Permission.Service
          const entered = yield* Deferred.make<void>()
          const release = yield* Deferred.make<void>()
          const settled = yield* Deferred.make<void>()
          const sessionID = SessionID.make(`ses_asked_${mode}_${answer}`)
          const requestID = PermissionV1.ID.make(`per_asked_${mode}_${answer}`)
          const replies: PermissionV1.Reply[] = []
          const unsubscribe = yield* (yield* EventV2Bridge.Service).listen((event) => {
            if (event.type === Permission.Event.Replied.type) {
              const item = decodeReply(event.data)
              if (item.requestID === requestID) replies.push(item.reply)
              return Effect.void
            }
            if (event.type !== Permission.Event.Asked.type) return Effect.void
            const item = decodeAsked(event.data)
            if (item.id !== requestID) return Effect.void
            return Effect.gen(function* () {
              yield* Deferred.succeed(entered, undefined)
              yield* Deferred.await(release)
              yield* permission.reply({ requestID, reply: answer }).pipe(Effect.orDie)
              yield* Deferred.succeed(settled, undefined)
              if (mode === "defect") return yield* Effect.die(new Error("asked listener failed after reply"))
              return yield* Effect.never
            })
          })
          yield* Effect.addFinalizer(() => unsubscribe)

          const fiber = yield* ask({
            id: requestID,
            sessionID,
            permission: "bash",
            patterns: ["git status"],
            metadata: {},
            always: ["git status"],
            ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
          }).pipe(Effect.forkScoped)
          yield* Deferred.await(entered)

          expect(yield* list()).toEqual([])
          yield* Deferred.succeed(release, undefined)
          yield* Deferred.await(settled)
          expect(Exit.isSuccess(yield* Fiber.await(fiber).pipe(Effect.timeout("3 seconds")))).toBe(true)
          expect(replies).toEqual([answer])
          expect(yield* list()).toEqual([])

          const ctx = yield* InstanceState.context
          expect(yield* (yield* PermissionSaved.Service).list({ projectID: ctx.project.id })).toHaveLength(
            answer === "project" ? 1 : 0,
          )
        }),
      { git: true },
    )
  }
}

it.instance(
  "a never-resolving Asked listener cannot hold the lock or strand the forecast generation",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_forecast_asked_suspended")
      const entered = yield* Deferred.make<void>()
      const order: Array<{ type: "asked" | "replied"; requestID: PermissionV1.ID }> = []
      const unsubscribe = yield* (yield* EventV2Bridge.Service).listen((event) => {
        if (event.type === Permission.Event.Asked.type) {
          const item = decodeAsked(event.data)
          if (item.sessionID !== sessionID) return Effect.void
          order.push({ type: "asked", requestID: item.id })
          return Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never))
        }
        if (event.type === Permission.Event.Replied.type) {
          const item = decodeReply(event.data)
          if (item.sessionID === sessionID) order.push({ type: "replied", requestID: item.requestID })
        }
        return Effect.void
      })
      yield* Effect.addFinalizer(() => unsubscribe)
      yield* forecast({
        sessionID,
        ruleset: [{ permission: "*", pattern: "*", action: "ask" }],
        candidates: [
          { action: "bash", resources: ["git status"], reason: "Inspect state" },
          { action: "read", resources: ["README.md"], reason: "Review docs" },
        ],
      })
      const active = yield* review(sessionID).pipe(Effect.forkScoped)
      yield* Deferred.await(entered)

      expect(
        yield* forecast({
          sessionID,
          ruleset: [{ permission: "read", pattern: "*", action: "ask" }],
          candidates: [{ action: "read", resources: ["late.md"], reason: "Late cycle" }],
        }).pipe(Effect.timeout("500 millis")),
      ).toEqual([])
      expect(yield* Fiber.join(active).pipe(Effect.timeout("3 seconds"))).toBe(true)
      expect(order).toHaveLength(2)
      expect(order[0]).toMatchObject({ type: "asked" })
      expect(order[1]).toEqual({ type: "replied", requestID: order[0].requestID })
      expect(yield* list()).toEqual([])
      expect(
        yield* forecast({
          sessionID,
          ruleset: [{ permission: "read", pattern: "*", action: "ask" }],
          candidates: [{ action: "read", resources: ["fresh.md"], reason: "Fresh cycle" }],
        }),
      ).toHaveLength(1)
    }),
  { git: true },
)

it.instance(
  "partial forecast publication hides the batch and rejects exactly the Asked prefix",
  () =>
    Effect.gen(function* () {
      const bridge = yield* EventV2Bridge.Service
      const second = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const asked: PermissionV1.ID[] = []
      const replied: Array<{ requestID: PermissionV1.ID; reply: PermissionV1.Reply }> = []
      const unsubscribe = yield* bridge.listen((event) =>
        Effect.gen(function* () {
          if (event.type === Permission.Event.Asked.type) {
            const item = decodeAsked(event.data)
            asked.push(item.id)
            if (asked.length === 2) {
              yield* Deferred.succeed(second, undefined)
              yield* Deferred.await(release)
              return yield* Effect.die(new Error("second asked publication failed"))
            }
          }
          if (event.type === Permission.Event.Replied.type) {
            const item = decodeReply(event.data)
            replied.push({ requestID: item.requestID, reply: item.reply })
          }
          return undefined
        }),
      )
      yield* Effect.addFinalizer(() => unsubscribe)
      const sessionID = SessionID.make("ses_forecast_partial_publish")
      yield* forecast({
        sessionID,
        ruleset: [{ permission: "*", pattern: "*", action: "ask" }],
        candidates: [
          { action: "bash", resources: ["git status"], reason: "Inspect state" },
          { action: "read", resources: ["README.md"], reason: "Review docs" },
          { action: "edit", resources: ["package.json"], reason: "Update package" },
        ],
      })

      const reviewFiber = yield* review(sessionID).pipe(Effect.forkScoped)
      yield* Deferred.await(second)
      const during = yield* list()
      yield* Deferred.succeed(release, undefined)
      expect(yield* Fiber.join(reviewFiber).pipe(Effect.timeout("3 seconds"))).toBe(true)

      expect(during).toEqual([])
      expect(asked).toHaveLength(2)
      expect(replied).toEqual(asked.map((requestID) => ({ requestID, reply: "reject" })))
      expect(yield* list()).toEqual([])
    }),
  { git: true },
)

for (const answer of ["once", "always", "project"] as const) {
  it.instance(
    `interruption wins deterministically against a queued ${answer} batch reply`,
    () =>
      Effect.gen(function* () {
        const bridge = yield* EventV2Bridge.Service
        const terminal = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        const sessionID = SessionID.make(`ses_forecast_interrupt_${answer}`)
        yield* forecast({
          sessionID,
          ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
          candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }],
        })
        const reviewFiber = yield* review(sessionID).pipe(Effect.forkScoped)
        const pending = yield* waitForPending(1)
        const unsubscribe = yield* bridge.listen((event) =>
          Effect.gen(function* () {
            if (event.type !== Permission.Event.Replied.type) return
            const item = decodeReply(event.data)
            if (item.requestID !== pending[0].id || item.reply !== "reject") return
            yield* Deferred.succeed(terminal, undefined)
            yield* Deferred.await(release)
          }),
        )
        yield* Effect.addFinalizer(() => unsubscribe)

        const interrupted = yield* Fiber.interrupt(reviewFiber).pipe(Effect.forkScoped)
        yield* Deferred.await(terminal)
        const response = yield* replyBatch({
          batchID: pending[0].batchID!,
          requestIDs: [pending[0].id],
          reply: answer,
        }).pipe(Effect.exit, Effect.forkScoped)
        yield* Effect.yieldNow
        yield* Deferred.succeed(release, undefined)
        yield* Fiber.join(interrupted)

        expect(Exit.isFailure(yield* Fiber.join(response))).toBe(true)
        expect(yield* list()).toEqual([])
        const ctx = yield* InstanceState.context
        expect(yield* (yield* PermissionSaved.Service).list({ projectID: ctx.project.id })).toEqual([])

        const blocked = yield* ask({
          sessionID,
          permission: "bash",
          patterns: ["git status"],
          metadata: {},
          always: [],
          ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        }).pipe(Effect.forkScoped)
        expect(yield* waitForPending(1)).toHaveLength(1)
        yield* rejectAll()
        yield* Fiber.await(blocked)
      }),
    { git: true },
  )
}

it.instance(
  "batch approval revalidates current allow policy without creating a latent once grant",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_forecast_policy_allow")
      const policy = yield* Ref.make<PermissionV1.Ruleset>([{ permission: "bash", pattern: "*", action: "ask" }])
      yield* forecast({
        sessionID,
        ruleset: yield* Ref.get(policy),
        candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }],
      })
      const reviewFiber = yield* review(sessionID, () => Ref.get(policy)).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(1)
      yield* Ref.set(policy, [{ permission: "bash", pattern: "*", action: "allow" }])
      yield* replyBatch({ batchID: pending[0].batchID!, requestIDs: [pending[0].id], reply: "once" })
      yield* Fiber.join(reviewFiber)

      yield* Ref.set(policy, [{ permission: "bash", pattern: "*", action: "ask" }])
      const blocked = yield* ask({
        sessionID,
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: yield* Ref.get(policy),
      }).pipe(Effect.forkScoped)
      expect(yield* waitForPending(1)).toHaveLength(1)
      yield* rejectAll()
      yield* Fiber.await(blocked)
    }),
  { git: true },
)

it.instance(
  "batch approval revalidates current deny policy without persistent approval",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_forecast_policy_deny")
      const replies: Array<{ requestID: PermissionV1.ID; reply: PermissionV1.Reply }> = []
      const unsubscribe = yield* (yield* EventV2Bridge.Service).listen((event) => {
        if (event.type === Permission.Event.Replied.type) {
          const item = decodeReply(event.data)
          replies.push({ requestID: item.requestID, reply: item.reply })
        }
        return Effect.void
      })
      yield* Effect.addFinalizer(() => unsubscribe)
      const policy = yield* Ref.make<PermissionV1.Ruleset>([{ permission: "bash", pattern: "*", action: "ask" }])
      yield* forecast({
        sessionID,
        ruleset: yield* Ref.get(policy),
        candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }],
      })
      const reviewFiber = yield* review(sessionID, () => Ref.get(policy)).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(1)
      yield* Ref.set(policy, [{ permission: "bash", pattern: "*", action: "deny" }])
      yield* replyBatch({ batchID: pending[0].batchID!, requestIDs: [pending[0].id], reply: "project" })
      yield* Fiber.join(reviewFiber)

      const ctx = yield* InstanceState.context
      expect(yield* (yield* PermissionSaved.Service).list({ projectID: ctx.project.id })).toEqual([])
      expect(replies).toContainEqual({ requestID: pending[0].id, reply: "reject" })
      yield* Ref.set(policy, [{ permission: "bash", pattern: "*", action: "ask" }])
      const blocked = yield* ask({
        sessionID,
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: yield* Ref.get(policy),
      }).pipe(Effect.forkScoped)
      expect(yield* waitForPending(1)).toHaveLength(1)
      yield* rejectAll()
      yield* Fiber.await(blocked)
    }),
  { git: true },
)

it.instance(
  "batch Always resolves matching blocking requests only in its session",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_batch_always_scope")
      const same = yield* ask({
        id: PermissionV1.ID.make("per_batch_always_same"),
        sessionID,
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      const other = yield* ask({
        id: PermissionV1.ID.make("per_batch_always_other"),
        sessionID: SessionID.make("ses_batch_always_other"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      yield* waitForPending(2)
      yield* forecast({
        sessionID,
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }],
      })
      const active = yield* review(sessionID).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(3)
      const batch = pending.find((item) => item.kind === "forecast")!

      yield* replyBatch({ batchID: batch.batchID!, requestIDs: [batch.id], reply: "always" })

      yield* Fiber.join(active)
      yield* Fiber.join(same).pipe(Effect.timeout("1 second"))
      expect((yield* list()).map((item) => item.id)).toEqual([PermissionV1.ID.make("per_batch_always_other")])
      yield* rejectAll()
      yield* Fiber.await(other)
    }),
  { git: true },
)

it.instance(
  "batch Project resolves matching blocking requests across sessions",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_batch_project_source")
      const blocking = yield* ask({
        id: PermissionV1.ID.make("per_batch_project_other"),
        sessionID: SessionID.make("ses_batch_project_other"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      yield* waitForPending(1)
      yield* forecast({
        sessionID,
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }],
      })
      const active = yield* review(sessionID).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(2)
      const batch = pending.find((item) => item.kind === "forecast")!

      yield* replyBatch({ batchID: batch.batchID!, requestIDs: [batch.id], reply: "project" })

      yield* Fiber.join(active)
      yield* Fiber.join(blocking).pipe(Effect.timeout("1 second"))
      expect(yield* list()).toEqual([])
    }),
  { git: true },
)

commitIt.instance(
  "pending interruption after durable commit cannot skip bounded terminal publication",
  () =>
    Effect.gen(function* () {
      const gate = yield* CommitGate
      const sessionID = SessionID.make("ses_forecast_commit_interrupt")
      const published = yield* Deferred.make<void>()
      const terminal: Array<{ requestID: PermissionV1.ID; reply: PermissionV1.Reply }> = []
      const unsubscribe = yield* (yield* EventV2Bridge.Service).listen((event) => {
        if (event.type !== Permission.Event.Replied.type) return Effect.void
        const item = decodeReply(event.data)
        if (item.sessionID !== sessionID) return Effect.void
        terminal.push({ requestID: item.requestID, reply: item.reply })
        return Deferred.succeed(published, undefined).pipe(Effect.andThen(Effect.never))
      })
      yield* Effect.addFinalizer(() => unsubscribe)
      yield* forecast({
        sessionID,
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }],
      })
      const active = yield* review(sessionID).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(1)
      const response = yield* replyBatch({
        batchID: pending[0].batchID!,
        requestIDs: [pending[0].id],
        reply: "project",
      }).pipe(Effect.forkScoped)
      yield* Deferred.await(gate.entered)

      response.interruptUnsafe()
      yield* Deferred.succeed(gate.release, undefined)
      yield* Deferred.await(published)
      const interrupted = yield* Fiber.await(response).pipe(Effect.timeout("3 seconds"))

      expect(Exit.isFailure(interrupted) && Cause.hasInterrupts(interrupted.cause)).toBe(true)
      expect(terminal).toEqual([{ requestID: pending[0].id, reply: "project" }])
      expect(yield* Fiber.join(active)).toBe(true)
      expect(yield* list()).toEqual([])
      const ctx = yield* InstanceState.context
      expect(yield* (yield* PermissionSaved.Service).list({ projectID: ctx.project.id })).toHaveLength(1)
    }),
  { git: true },
)

for (const answer of ["once", "always", "project", "reject"] as const) {
  it.instance(
    `terminal listener defects cannot roll back a settled ${answer === "reject" ? "skip" : answer} batch`,
    () =>
      Effect.gen(function* () {
        const sessionID = SessionID.make(`ses_terminal_defect_${answer}`)
        const terminal: PermissionV1.ID[] = []
        const unsubscribe = yield* (yield* EventV2Bridge.Service).listen((event) => {
          if (event.type !== Permission.Event.Replied.type) return Effect.void
          const item = decodeReply(event.data)
          if (item.sessionID !== sessionID) return Effect.void
          terminal.push(item.requestID)
          return Effect.die(new Error("terminal listener failed"))
        })
        yield* Effect.addFinalizer(() => unsubscribe)
        yield* forecast({
          sessionID,
          ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
          candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }],
        })
        const reviewFiber = yield* review(sessionID).pipe(Effect.forkScoped)
        const pending = yield* waitForPending(1)

        yield* replyBatch({
          batchID: pending[0].batchID!,
          requestIDs: answer === "reject" ? [] : [pending[0].id],
          reply: answer,
        })
        expect(yield* Fiber.join(reviewFiber)).toBe(true)
        expect(yield* list()).toEqual([])
        expect(terminal).toEqual([pending[0].id])
        expect(
          Exit.isFailure(
            yield* replyBatch({
              batchID: pending[0].batchID!,
              requestIDs: [],
              reply: "reject",
            }).pipe(Effect.exit),
          ),
        ).toBe(true)

        if (answer === "project") {
          const ctx = yield* InstanceState.context
          expect(yield* (yield* PermissionSaved.Service).list({ projectID: ctx.project.id })).toHaveLength(1)
        }
        if (answer === "once") {
          expect(
            yield* ask({
              sessionID,
              permission: "bash",
              patterns: ["git status"],
              metadata: {},
              always: [],
              ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
            }),
          ).toBeUndefined()
        }
      }),
    { git: true },
  )
}

for (const answer of ["once", "always", "project", "reject"] as const) {
  it.instance(
    `a suspended terminal listener cannot hang ${answer === "reject" ? "skip" : answer} batch settlement`,
    () =>
      Effect.gen(function* () {
        const sessionID = SessionID.make(`ses_terminal_suspended_${answer}`)
        const unsubscribe = yield* (yield* EventV2Bridge.Service).listen((event) => {
          if (event.type !== Permission.Event.Replied.type) return Effect.void
          if (decodeReply(event.data).sessionID !== sessionID) return Effect.void
          return Effect.never
        })
        yield* Effect.addFinalizer(() => unsubscribe)
        yield* forecast({
          sessionID,
          ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
          candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }],
        })
        const reviewFiber = yield* review(sessionID).pipe(Effect.forkScoped)
        const pending = yield* waitForPending(1)

        yield* replyBatch({
          batchID: pending[0].batchID!,
          requestIDs: answer === "reject" ? [] : [pending[0].id],
          reply: answer,
        }).pipe(Effect.timeout("3 seconds"))
        expect(yield* Fiber.join(reviewFiber)).toBe(true)
        expect(yield* list()).toEqual([])
        if (answer === "project") {
          const ctx = yield* InstanceState.context
          expect(yield* (yield* PermissionSaved.Service).list({ projectID: ctx.project.id })).toHaveLength(1)
        }
      }),
    { git: true },
  )
}

it.instance(
  "a suspended terminal listener cannot hang interrupted review settlement",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_terminal_suspended_interrupt")
      const unsubscribe = yield* (yield* EventV2Bridge.Service).listen((event) => {
        if (event.type !== Permission.Event.Replied.type) return Effect.void
        if (decodeReply(event.data).sessionID !== sessionID) return Effect.void
        return Effect.never
      })
      yield* Effect.addFinalizer(() => unsubscribe)
      yield* forecast({
        sessionID,
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }],
      })
      const reviewFiber = yield* review(sessionID).pipe(Effect.forkScoped)
      yield* waitForPending(1)

      yield* Fiber.interrupt(reviewFiber).pipe(Effect.timeout("3 seconds"))
      expect(yield* list()).toEqual([])
    }),
  { git: true },
)

it.instance(
  "terminal publication cannot delay durable cleanup or the next forecast cycle",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_terminal_cleanup_order")
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const unsubscribe = yield* (yield* EventV2Bridge.Service).listen((event) => {
        if (event.type !== Permission.Event.Replied.type) return Effect.void
        if (decodeReply(event.data).sessionID !== sessionID) return Effect.void
        return Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)))
      })
      yield* Effect.addFinalizer(() => unsubscribe)
      yield* forecast({
        sessionID,
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }],
      })
      const reviewFiber = yield* review(sessionID).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(1)
      const response = yield* replyBatch({
        batchID: pending[0].batchID!,
        requestIDs: [pending[0].id],
        reply: "once",
      }).pipe(Effect.forkScoped)
      yield* Deferred.await(entered)

      expect(yield* list()).toEqual([])
      expect(yield* Fiber.join(reviewFiber)).toBe(true)
      expect(
        yield* forecast({
          sessionID,
          ruleset: [{ permission: "read", pattern: "*", action: "ask" }],
          candidates: [{ action: "read", resources: ["README.md"], reason: "Review docs" }],
        }),
      ).toHaveLength(1)

      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(response)
    }),
  { git: true },
)

it.instance(
  "the same session can complete two independent forecast review cycles",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_forecast_two_cycles")
      const ruleset: PermissionV1.Ruleset = [{ permission: "*", pattern: "*", action: "ask" }]
      yield* forecast({
        sessionID,
        ruleset,
        candidates: [{ action: "bash", resources: ["git status"], reason: "First cycle" }],
      })
      const first = yield* review(sessionID).pipe(Effect.forkScoped)
      const firstBatch = yield* waitForPending(1)
      yield* replyBatch({ batchID: firstBatch[0].batchID!, requestIDs: [], reply: "reject" })
      expect(yield* Fiber.join(first)).toBe(true)

      expect(
        yield* forecast({
          sessionID,
          ruleset,
          candidates: [{ action: "read", resources: ["README.md"], reason: "Second cycle" }],
        }),
      ).toHaveLength(1)
      const second = yield* review(sessionID).pipe(Effect.forkScoped)
      const secondBatch = yield* waitForPending(1)
      expect(secondBatch[0]).toMatchObject({ permission: "read", reason: "Second cycle" })
      yield* replyBatch({ batchID: secondBatch[0].batchID!, requestIDs: [], reply: "reject" })
      expect(yield* Fiber.join(second)).toBe(true)
    }),
  { git: true },
)

it.instance(
  "an old-generation forecast queued during reply cannot populate the reopened cycle",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_forecast_old_cycle")
      const ruleset: PermissionV1.Ruleset = [{ permission: "*", pattern: "*", action: "ask" }]
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      yield* forecast({
        sessionID,
        ruleset,
        candidates: [{ action: "bash", resources: ["git status"], reason: "Current cycle" }],
      })
      const reviewFiber = yield* review(sessionID, () =>
        Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.as(ruleset)),
      ).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(1)
      const response = yield* replyBatch({
        batchID: pending[0].batchID!,
        requestIDs: [pending[0].id],
        reply: "once",
      }).pipe(Effect.forkScoped)
      yield* Deferred.await(entered)
      const late = yield* forecast({
        sessionID,
        ruleset,
        candidates: [{ action: "read", resources: ["stale.md"], reason: "Stale cycle" }],
      }).pipe(Effect.forkScoped)
      yield* Effect.yieldNow
      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(response)
      yield* Fiber.join(reviewFiber)

      expect(yield* Fiber.join(late)).toEqual([])
      expect(
        yield* forecast({
          sessionID,
          ruleset,
          candidates: [{ action: "read", resources: ["fresh.md"], reason: "Fresh cycle" }],
        }),
      ).toEqual([{ action: "read", resources: ["fresh.md"], reason: "Fresh cycle" }])
    }),
  { git: true },
)

it.instance(
  "forecast once grants are exact, session-scoped, consumed once, and never override runtime denies",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_forecast_once")
      yield* forecast({
        sessionID,
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect changes" }],
      })
      const reviewFiber = yield* review(sessionID).pipe(Effect.forkScoped)
      const batch = yield* waitForPending(1)
      yield* replyBatch({ batchID: batch[0].batchID!, requestIDs: [batch[0].id], reply: "once" })
      yield* Fiber.join(reviewFiber)

      const denied = yield* fail(
        ask({
          sessionID,
          permission: "bash",
          patterns: ["git status"],
          metadata: {},
          always: [],
          ruleset: [{ permission: "bash", pattern: "*", action: "deny" }],
        }),
      )
      expect(denied).toBeInstanceOf(PermissionV1.DeniedError)

      expect(
        yield* ask({
          sessionID,
          permission: "bash",
          patterns: ["git status"],
          metadata: {},
          always: [],
          ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        }),
      ).toBeUndefined()

      const otherSession = yield* ask({
        sessionID: SessionID.make("ses_forecast_other"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      expect(yield* waitForPending(1)).toHaveLength(1)
      yield* rejectAll()
      yield* Fiber.await(otherSession)

      const consumed = yield* ask({
        sessionID,
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      expect(yield* waitForPending(1)).toHaveLength(1)
      yield* rejectAll()
      yield* Fiber.await(consumed)
    }),
  { git: true },
)

it.instance(
  "forecast once grants consume the complete resource set atomically",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_forecast_resource_set")
      yield* forecast({
        sessionID,
        ruleset: [{ permission: "read", pattern: "*", action: "ask" }],
        candidates: [{ action: "read", resources: ["README.md", "AGENTS.md"], reason: "Review guidance" }],
      })
      const reviewFiber = yield* review(sessionID).pipe(Effect.forkScoped)
      const batch = yield* waitForPending(1)
      yield* replyBatch({ batchID: batch[0].batchID!, requestIDs: [batch[0].id], reply: "once" })
      yield* Fiber.join(reviewFiber)

      const subset = yield* ask({
        sessionID,
        permission: "read",
        patterns: ["README.md"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "read", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      expect(yield* waitForPending(1)).toHaveLength(1)
      yield* rejectAll()
      yield* Fiber.await(subset)

      expect(
        yield* ask({
          sessionID,
          permission: "read",
          patterns: ["AGENTS.md", "README.md"],
          metadata: {},
          always: [],
          ruleset: [{ permission: "read", pattern: "*", action: "ask" }],
        }),
      ).toBeUndefined()

      const consumed = yield* ask({
        sessionID,
        permission: "read",
        patterns: ["README.md", "AGENTS.md"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "read", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      expect(yield* waitForPending(1)).toHaveLength(1)
      yield* rejectAll()
      yield* Fiber.await(consumed)
    }),
  { git: true },
)

it.instance(
  "forecast batch validation is atomic and skips every unselected request",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_forecast_atomic")
      yield* forecast({
        sessionID,
        ruleset: [{ permission: "*", pattern: "*", action: "ask" }],
        candidates: [
          { action: "bash", resources: ["git status"], reason: "Inspect changes" },
          { action: "read", resources: ["README.md"], reason: "Review docs" },
        ],
      })
      const fiber = yield* review(sessionID).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(2)

      expect(
        Exit.isFailure(
          yield* replyBatch({
            batchID: pending[0].batchID!,
            requestIDs: [pending[0].id, PermissionV1.ID.make("per_foreign")],
            reply: "once",
          }).pipe(Effect.exit),
        ),
      ).toBe(true)
      expect(yield* list()).toHaveLength(2)

      yield* replyBatch({ batchID: pending[0].batchID!, requestIDs: [pending[0].id], reply: "once" })
      expect(yield* Fiber.join(fiber)).toBe(true)
      expect(yield* list()).toEqual([])

      const granted = pending[0]
      expect(
        yield* ask({
          sessionID,
          permission: granted.permission,
          patterns: [...granted.patterns],
          metadata: {},
          always: [],
          ruleset: [{ permission: granted.permission, pattern: "*", action: "ask" }],
        }),
      ).toBeUndefined()

      const skipped = pending[1]
      const blocked = yield* ask({
        sessionID,
        permission: skipped.permission,
        patterns: [...skipped.patterns],
        metadata: {},
        always: [],
        ruleset: [{ permission: skipped.permission, pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      expect(yield* waitForPending(1)).toHaveLength(1)
      yield* rejectAll()
      yield* Fiber.await(blocked)
    }),
  { git: true },
)

it.instance(
  "forecast batches persist every selected exact resource for one session",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_forecast_session_scope")
      const ctx = yield* InstanceState.context
      const { db } = yield* Database.Service
      yield* db
        .insert(SessionTable)
        .values({
          id: sessionID,
          project_id: ctx.project.id,
          slug: "forecast-session-scope",
          directory: ctx.directory,
          title: "forecast session scope",
          version: "test",
        })
        .run()
        .pipe(Effect.orDie)
      const ruleset: PermissionV1.Ruleset = [{ permission: "bash", pattern: "*", action: "ask" }]
      yield* forecast({
        sessionID,
        ruleset,
        candidates: [{ action: "bash", resources: ["echo *", "file?.txt"], reason: "Run exact commands" }],
      })
      const active = yield* review(sessionID, () => Effect.succeed(ruleset)).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(1)
      yield* replyBatch({ batchID: pending[0].batchID!, requestIDs: [pending[0].id], reply: "session" })
      yield* Fiber.join(active)

      expect(yield* (yield* PermissionSaved.Service).list({ scope: "session", sessionID })).toMatchObject([
        { scope: "session", match: "exact", resource: "echo *" },
        { scope: "session", match: "exact", resource: "file?.txt" },
      ])
      expect(
        yield* ask({
          sessionID,
          permission: "bash",
          patterns: ["echo *", "file?.txt"],
          metadata: {},
          always: [],
          ruleset,
        }),
      ).toBeUndefined()
    }),
  { git: true },
)

it.instance(
  "persistent forecast batch failure leaves every request pending and writes no partial approvals",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_forecast_persist_atomic")
      yield* forecast({
        sessionID,
        ruleset: [{ permission: "*", pattern: "*", action: "ask" }],
        candidates: [
          { action: "bash", resources: ["git status"], reason: "Inspect changes" },
          { action: "read", resources: ["README.md"], reason: "Review docs" },
        ],
      })
      const fiber = yield* review(sessionID).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(2)
      const { db } = yield* Database.Service
      yield* db
        .run(
          "CREATE TRIGGER fail_forecast_permission_insert BEFORE INSERT ON permission WHEN NEW.action = 'read' BEGIN SELECT RAISE(FAIL, 'forced forecast failure'); END",
        )
        .pipe(Effect.orDie)

      expect(
        Exit.isFailure(
          yield* replyBatch({
            batchID: pending[0].batchID!,
            requestIDs: pending.map((item) => item.id),
            reply: "project",
          }).pipe(Effect.exit),
        ),
      ).toBe(true)
      expect(yield* list()).toHaveLength(2)
      const ctx = yield* InstanceState.context
      expect(yield* (yield* PermissionSaved.Service).list({ projectID: ctx.project.id })).toEqual([])

      yield* db.run("DROP TRIGGER fail_forecast_permission_insert").pipe(Effect.orDie)
      yield* replyBatch({ batchID: pending[0].batchID!, requestIDs: [], reply: "reject" })
      expect(yield* Fiber.join(fiber)).toBe(true)
    }),
  { git: true },
)

it.instance(
  "interrupted forecast reviews publish terminal replies and clear transient requests",
  () =>
    Effect.gen(function* () {
      const bridge = yield* EventV2Bridge.Service
      const replies: PermissionV1.ID[] = []
      const unsubscribe = yield* bridge.listen((event) => {
        if (event.type === Permission.Event.Replied.type) replies.push(decodeReply(event.data).requestID)
        return Effect.void
      })
      yield* Effect.addFinalizer(() => unsubscribe)
      const sessionID = SessionID.make("ses_forecast_cleanup")
      yield* forecast({
        sessionID,
        ruleset: [{ permission: "*", pattern: "*", action: "ask" }],
        candidates: [
          { action: "bash", resources: ["git status"], reason: "Inspect changes" },
          { action: "read", resources: ["README.md"], reason: "Review docs" },
        ],
      })
      const fiber = yield* review(sessionID).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(2)
      yield* Fiber.interrupt(fiber)

      expect(yield* list()).toEqual([])
      expect(replies.toSorted()).toEqual(pending.map((item) => item.id).toSorted())
    }),
  { git: true },
)

it.instance(
  "ask - adds request to pending list",
  () =>
    Effect.gen(function* () {
      const fiber = yield* ask({
        sessionID: SessionID.make("session_test"),
        permission: "bash",
        patterns: ["ls"],
        metadata: { cmd: "ls" },
        always: ["ls"],
        tool: {
          messageID: MessageID.make("msg_test"),
          callID: "call_test",
        },
        ruleset: [],
      }).pipe(Effect.forkScoped)

      const items = yield* waitForPending(1)
      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({
        sessionID: SessionID.make("session_test"),
        permission: "bash",
        patterns: ["ls"],
        metadata: { cmd: "ls" },
        always: ["ls"],
        tool: {
          messageID: MessageID.make("msg_test"),
          callID: "call_test",
        },
      })

      yield* rejectAll()
      yield* Fiber.await(fiber)
    }),
  { git: true },
)

it.instance(
  "ask - publishes asked event",
  () =>
    Effect.gen(function* () {
      const events = yield* EventV2Bridge.Service
      const seen = yield* Deferred.make<PermissionV1.Request>()
      const unsub = yield* events.listen((event) => {
        if (event.type === Permission.Event.Asked.type)
          Deferred.doneUnsafe(seen, Effect.succeed(decodeAsked(event.data)))
        return Effect.void
      })
      yield* Effect.addFinalizer(() => unsub)

      const fiber = yield* ask({
        sessionID: SessionID.make("session_test"),
        permission: "bash",
        patterns: ["ls"],
        metadata: { cmd: "ls" },
        always: ["ls"],
        tool: {
          messageID: MessageID.make("msg_test"),
          callID: "call_test",
        },
        ruleset: [],
      }).pipe(Effect.forkScoped)

      expect(yield* waitForPending(1)).toHaveLength(1)
      expect(
        yield* Deferred.await(seen).pipe(
          Effect.timeoutOrElse({
            duration: "1 second",
            orElse: () => Effect.fail(new Error("timed out waiting for permission asked event")),
          }),
        ),
      ).toMatchObject({
        sessionID: SessionID.make("session_test"),
        permission: "bash",
        patterns: ["ls"],
      })

      yield* rejectAll()
      yield* Fiber.await(fiber)
    }),
  { git: true },
)

// reply tests

it.instance(
  "reply - once resolves the pending ask",
  () =>
    Effect.gen(function* () {
      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_test1"),
        sessionID: SessionID.make("session_test"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      }).pipe(Effect.forkScoped)

      yield* waitForPending(1)
      yield* reply({ requestID: PermissionV1.ID.make("per_test1"), reply: "once" })
      yield* Fiber.join(fiber)
    }),
  { git: true },
)

it.instance(
  "reply - reject throws RejectedError",
  () =>
    Effect.gen(function* () {
      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_test2"),
        sessionID: SessionID.make("session_test"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      }).pipe(Effect.forkScoped)

      yield* waitForPending(1)
      yield* reply({ requestID: PermissionV1.ID.make("per_test2"), reply: "reject" })

      const exit = yield* Fiber.await(fiber)
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBeInstanceOf(PermissionV1.RejectedError)
    }),
  { git: true },
)

it.instance(
  "reply - reject with message throws CorrectedError",
  () =>
    Effect.gen(function* () {
      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_test2b"),
        sessionID: SessionID.make("session_test"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      }).pipe(Effect.forkScoped)

      yield* waitForPending(1)
      yield* reply({
        requestID: PermissionV1.ID.make("per_test2b"),
        reply: "reject",
        message: "Use a safer command",
      })

      const exit = yield* Fiber.await(fiber)
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const err = Cause.squash(exit.cause)
        expect(err).toBeInstanceOf(PermissionV1.CorrectedError)
        expect(String(err)).toContain("Use a safer command")
      }
    }),
  { git: true },
)

it.instance(
  "ordinary replies revalidate live policy before persisting or resolving",
  () =>
    Effect.gen(function* () {
      const policy = yield* Ref.make<PermissionV1.Ruleset>([{ permission: "bash", pattern: "*", action: "ask" }])
      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_live_policy"),
        sessionID: SessionID.make("ses_live_policy"),
        permission: "bash",
        patterns: ["rm -rf target"],
        metadata: {},
        always: ["rm *"],
        ruleset: yield* Ref.get(policy),
        policy: () => Ref.get(policy),
      }).pipe(Effect.forkScoped)
      yield* waitForPending(1)
      yield* Ref.set(policy, [{ permission: "bash", pattern: "rm *", action: "deny" }])
      yield* reply({ requestID: PermissionV1.ID.make("per_live_policy"), reply: "global" })

      expect(Exit.isFailure(yield* Fiber.await(fiber))).toBe(true)
      expect(yield* (yield* PermissionSaved.Service).list({ scope: "global" })).toEqual([])
    }),
  { git: true },
)

it.instance(
  "ordinary scoped replies fail closed when live policy expands beyond the displayed grant",
  () =>
    Effect.gen(function* () {
      const policy = yield* Ref.make<PermissionV1.Ruleset>([
        { permission: "bash", pattern: "*", action: "ask" },
        { permission: "bash", pattern: "configured", action: "allow" },
      ])
      const saved = yield* PermissionSaved.Service
      yield* saved.add({ scope: "global", action: "bash", resources: ["revoked"] })
      const prior = (yield* saved.list({ scope: "global" }))[0]
      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_live_expansion"),
        sessionID: SessionID.make("ses_live_expansion"),
        permission: "bash",
        patterns: ["shown", "configured", "revoked"],
        metadata: {},
        always: [],
        ruleset: yield* Ref.get(policy),
        policy: () => Ref.get(policy),
      }).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(1)
      expect(pending[0].grant?.resources).toEqual(["shown"])

      yield* Ref.set(policy, [{ permission: "bash", pattern: "*", action: "ask" }])
      yield* saved.remove({ id: prior.id, scope: "global" })
      yield* reply({ requestID: PermissionV1.ID.make("per_live_expansion"), reply: "global" })

      expect(Exit.isFailure(yield* Fiber.await(fiber))).toBe(true)
      expect(yield* saved.list({ scope: "global" })).toEqual([])
    }),
  { git: true },
)

it.instance(
  "ordinary scoped replies persist only displayed resources still unresolved",
  () =>
    Effect.gen(function* () {
      const policy = yield* Ref.make<PermissionV1.Ruleset>([{ permission: "bash", pattern: "*", action: "ask" }])
      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_live_narrowing"),
        sessionID: SessionID.make("ses_live_narrowing"),
        permission: "bash",
        patterns: ["keep", "narrowed"],
        metadata: {},
        always: [],
        ruleset: yield* Ref.get(policy),
        policy: () => Ref.get(policy),
      }).pipe(Effect.forkScoped)
      expect((yield* waitForPending(1))[0].grant?.resources).toEqual(["keep", "narrowed"])
      yield* Ref.set(policy, [
        { permission: "bash", pattern: "*", action: "ask" },
        { permission: "bash", pattern: "narrowed", action: "allow" },
      ])

      yield* reply({ requestID: PermissionV1.ID.make("per_live_narrowing"), reply: "global" })
      yield* Fiber.join(fiber)
      expect(yield* (yield* PermissionSaved.Service).list({ scope: "global" })).toMatchObject([
        { action: "bash", resource: "keep" },
      ])
    }),
  { git: true },
)

it.instance(
  "reply - explicit reject still rejects after live policy allows",
  () =>
    Effect.gen(function* () {
      const policy = yield* Ref.make<PermissionV1.Ruleset>([{ permission: "bash", pattern: "*", action: "ask" }])
      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_reject_after_allow"),
        sessionID: SessionID.make("ses_reject_after_allow"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: yield* Ref.get(policy),
        policy: () => Ref.get(policy),
      }).pipe(Effect.forkScoped)
      yield* waitForPending(1)
      yield* Ref.set(policy, [{ permission: "bash", pattern: "*", action: "allow" }])
      yield* reply({ requestID: PermissionV1.ID.make("per_reject_after_allow"), reply: "reject" })

      const exit = yield* Fiber.await(fiber)
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBeInstanceOf(PermissionV1.RejectedError)
    }),
  { git: true },
)

it.instance(
  "reply - always stays in memory for the current session only",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("session_test")
      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_test3"),
        sessionID,
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: ["ls"],
        ruleset: [],
      }).pipe(Effect.forkScoped)

      yield* waitForPending(1)
      yield* reply({ requestID: PermissionV1.ID.make("per_test3"), reply: "always" })
      yield* Fiber.join(fiber)

      expect(
        yield* ask({
          sessionID,
          permission: "bash",
          patterns: ["ls"],
          metadata: {},
          always: [],
          ruleset: [],
        }),
      ).toBeUndefined()
      expect(yield* (yield* PermissionSaved.Service).list()).toEqual([])

      const other = yield* ask({
        sessionID: SessionID.make("session_test2"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      }).pipe(Effect.forkScoped)
      expect(yield* waitForPending(1)).toHaveLength(1)
      yield* rejectAll()
      yield* Fiber.await(other)

      yield* reloadInstance({ directory: (yield* TestInstance).directory })
      const restarted = yield* ask({
        sessionID,
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      }).pipe(Effect.forkScoped)
      expect(yield* waitForPending(1)).toHaveLength(1)
      yield* rejectAll()
      yield* Fiber.await(restarted)
    }),
  { git: true },
)

it.instance(
  "session grants survive reload, stay exact, and never reach sibling sessions",
  () =>
    Effect.gen(function* () {
      const sessionID = SessionID.make("ses_scope_owner")
      const siblingID = SessionID.make("ses_scope_sibling")
      const resource = "echo * ? [abc]"
      const ctx = yield* InstanceState.context
      const { db } = yield* Database.Service
      yield* db
        .insert(SessionTable)
        .values({
          id: sessionID,
          project_id: ctx.project.id,
          slug: "scope-owner",
          directory: ctx.directory,
          title: "scope owner",
          version: "test",
        })
        .run()
        .pipe(Effect.orDie)
      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_session_scope"),
        sessionID,
        permission: "bash",
        patterns: [resource],
        metadata: {},
        always: ["legacy *"],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      const pending = yield* waitForPending(1)
      expect(pending[0].grant).toEqual({ resources: [resource], scopes: ["session", "global"] })
      yield* reply({ requestID: pending[0].id, reply: "session" })
      yield* Fiber.join(fiber)

      expect(
        yield* ask({
          sessionID,
          permission: "bash",
          patterns: [resource],
          metadata: {},
          always: [],
          ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        }),
      ).toBeUndefined()
      const sibling = yield* ask({
        sessionID: siblingID,
        permission: "bash",
        patterns: [resource],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      expect(yield* waitForPending(1)).toHaveLength(1)
      yield* rejectAll()
      yield* Fiber.await(sibling)

      yield* reloadInstance({ directory: (yield* TestInstance).directory })
      expect(
        yield* ask({
          sessionID,
          permission: "bash",
          patterns: [resource],
          metadata: {},
          always: [],
          ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        }),
      ).toBeUndefined()
      yield* db.delete(SessionTable).where(eq(SessionTable.id, sessionID)).run().pipe(Effect.orDie)
      expect(yield* (yield* PermissionSaved.Service).list({ scope: "session", sessionID })).toEqual([])
    }),
  { git: true },
)

it.live("global exact grants cross Git and non-Git projects without widening metacharacters", () =>
  Effect.gen(function* () {
    const git = yield* tmpdirScoped({ git: true })
    const plain = yield* tmpdirScoped()
    const store = yield* InstanceStore.Service
    const first = yield* store.load({ directory: git })
    const second = yield* store.load({ directory: plain })
    const resource = "echo * ? [abc]"
    const active = yield* ask({
      id: PermissionV1.ID.make("per_global_exact"),
      sessionID: SessionID.make("ses_global_owner"),
      permission: "bash",
      patterns: [resource],
      metadata: {},
      always: ["legacy *"],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, first), Effect.forkScoped)
    const pending = yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, first))
    yield* reply({ requestID: pending[0].id, reply: "global" }).pipe(Effect.provideService(InstanceRef, first))
    yield* Fiber.join(active)

    expect(
      yield* ask({
        sessionID: SessionID.make("ses_global_other"),
        permission: "bash",
        patterns: [resource],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.provideService(InstanceRef, second)),
    ).toBeUndefined()
    const widened = yield* ask({
      sessionID: SessionID.make("ses_global_widened"),
      permission: "bash",
      patterns: ["echo anything x a"],
      metadata: {},
      always: [],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, second), Effect.forkScoped)
    expect(yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, second))).toHaveLength(1)
    yield* rejectAll().pipe(Effect.provideService(InstanceRef, second))
    yield* Fiber.await(widened)
  }),
)

it.instance(
  "reply - empty Always resources resolve without persistence",
  () =>
    Effect.gen(function* () {
      const bridge = yield* EventV2Bridge.Service
      const replies: PermissionV1.Reply[] = []
      const unsubscribe = yield* bridge.listen((event) => {
        if (event.type === Permission.Event.Replied.type) replies.push(decodeReply(event.data).reply)
        return Effect.void
      })
      yield* Effect.addFinalizer(() => unsubscribe)
      const first = yield* ask({
        id: PermissionV1.ID.make("per_empty_always"),
        sessionID: SessionID.make("session_empty_always"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      yield* waitForPending(1)
      yield* reply({ requestID: PermissionV1.ID.make("per_empty_always"), reply: "always" })
      yield* Fiber.join(first)
      expect(replies).toEqual(["always"])

      const ctx = yield* InstanceState.context
      const saved = yield* PermissionSaved.Service
      expect(yield* saved.list({ projectID: ctx.project.id })).toEqual([])

      const second = yield* ask({
        sessionID: SessionID.make("session_after_empty_always"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      expect(yield* waitForPending(1)).toHaveLength(1)
      yield* rejectAll()
      yield* Fiber.await(second)
    }),
  { git: true },
)

it.instance(
  "reply - project persists exact deduplicated approvals across an instance restart",
  () =>
    Effect.gen(function* () {
      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_restart"),
        sessionID: SessionID.make("session_restart"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: ["git status", "git status"],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)

      yield* waitForPending(1)
      yield* reply({ requestID: PermissionV1.ID.make("per_restart"), reply: "project" })
      yield* Fiber.join(fiber)

      const ctx = yield* InstanceState.context
      expect(yield* (yield* PermissionSaved.Service).list({ projectID: ctx.project.id })).toMatchObject([
        { projectID: ctx.project.id, action: "bash", resource: "git status" },
      ])

      yield* reloadInstance({ directory: (yield* TestInstance).directory })
      expect(
        yield* ask({
          sessionID: SessionID.make("session_after_restart"),
          permission: "bash",
          patterns: ["git status"],
          metadata: {},
          always: [],
          ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        }),
      ).toBeUndefined()
    }),
  { git: true },
)

it.instance(
  "saved approvals never override configured or task-ceiling denies and configured allows still win",
  () =>
    Effect.gen(function* () {
      const ctx = yield* InstanceState.context
      yield* (yield* PermissionSaved.Service).add({
        scope: "project",
        projectID: ctx.project.id,
        action: "bash",
        resources: ["git status"],
      })

      const configured = yield* fail(
        ask({
          sessionID: SessionID.make("session_config_deny"),
          permission: "bash",
          patterns: ["git status"],
          metadata: {},
          always: [],
          ruleset: [{ permission: "bash", pattern: "*", action: "deny" }],
        }),
      )
      expect(configured).toBeInstanceOf(PermissionV1.DeniedError)

      const ceiling = yield* fail(
        ask({
          sessionID: SessionID.make("session_ceiling_deny"),
          permission: "bash",
          patterns: ["git status"],
          metadata: {},
          always: [],
          ruleset: [
            { permission: "bash", pattern: "*", action: "ask" },
            { permission: "bash", pattern: "git status", action: "deny" },
          ],
        }),
      )
      expect(ceiling).toBeInstanceOf(PermissionV1.DeniedError)

      expect(
        yield* ask({
          sessionID: SessionID.make("session_config_allow"),
          permission: "read",
          patterns: ["README.md"],
          metadata: {},
          always: [],
          ruleset: [{ permission: "read", pattern: "*", action: "allow" }],
        }),
      ).toBeUndefined()
      expect(yield* list()).toEqual([])
    }),
  { git: true },
)

it.instance(
  "revocation is visible to the running permission service",
  () =>
    Effect.gen(function* () {
      const ctx = yield* InstanceState.context
      const saved = yield* PermissionSaved.Service
      yield* saved.add({ scope: "project", projectID: ctx.project.id, action: "bash", resources: ["bun test"] })
      const item = (yield* saved.list({ projectID: ctx.project.id }))[0]

      expect(
        yield* ask({
          sessionID: SessionID.make("session_before_revoke"),
          permission: "bash",
          patterns: ["bun test"],
          metadata: {},
          always: [],
          ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        }),
      ).toBeUndefined()

      expect(yield* saved.remove({ id: item.id, scope: "project", projectID: ctx.project.id })).toBe(true)
      const fiber = yield* ask({
        sessionID: SessionID.make("session_after_revoke"),
        permission: "bash",
        patterns: ["bun test"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      expect(yield* waitForPending(1)).toHaveLength(1)
      yield* rejectAll()
      yield* Fiber.await(fiber)
    }),
  { git: true },
)

it.live("shares approvals across one project's worktrees but isolates different projects", () =>
  Effect.gen(function* () {
    const mainDir = yield* tmpdirScoped({ git: true })
    const worktreeDir = yield* tmpdirScoped()
    const otherDir = yield* tmpdirScoped({ git: true })
    const store = yield* InstanceStore.Service
    const main = yield* store.load({ directory: mainDir })
    const worktree = yield* store.load({ directory: worktreeDir, project: main.project, worktree: main.worktree })
    const other = yield* store.load({ directory: otherDir })
    const saved = yield* PermissionSaved.Service
    yield* saved.add({ scope: "project", projectID: main.project.id, action: "bash", resources: ["git status"] })

    expect(
      yield* ask({
        sessionID: SessionID.make("session_worktree"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.provideService(InstanceRef, worktree)),
    ).toBeUndefined()

    const fiber = yield* ask({
      sessionID: SessionID.make("session_other_project"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: [],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, other), Effect.forkScoped)
    expect(yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, other))).toHaveLength(1)
    yield* rejectAll().pipe(Effect.provideService(InstanceRef, other))
    yield* Fiber.await(fiber)
  }),
)

it.live("project reply settles matching pending requests in a live sibling worktree", () =>
  Effect.gen(function* () {
    const mainDir = yield* tmpdirScoped({ git: true })
    const siblingDir = yield* tmpdirScoped()
    const store = yield* InstanceStore.Service
    const main = yield* store.load({ directory: mainDir })
    const sibling = yield* store.load({ directory: siblingDir, project: main.project, worktree: main.worktree })
    const source = yield* ask({
      id: PermissionV1.ID.make("per_cross_worktree_source"),
      sessionID: SessionID.make("ses_cross_worktree_source"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: ["git status"],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, main), Effect.forkScoped)
    const target = yield* ask({
      id: PermissionV1.ID.make("per_cross_worktree_target"),
      sessionID: SessionID.make("ses_cross_worktree_target"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: [],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, sibling), Effect.forkScoped)
    yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, main))
    yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, sibling))

    yield* reply({ requestID: PermissionV1.ID.make("per_cross_worktree_source"), reply: "project" }).pipe(
      Effect.provideService(InstanceRef, main),
    )

    yield* Fiber.join(source)
    yield* Fiber.join(target).pipe(Effect.timeout("1 second"))
    expect(yield* list().pipe(Effect.provideService(InstanceRef, main))).toEqual([])
    expect(yield* list().pipe(Effect.provideService(InstanceRef, sibling))).toEqual([])
  }),
)

it.live("project fan-out evaluates live policy in the target worktree context", () =>
  Effect.gen(function* () {
    const mainDir = yield* tmpdirScoped({ git: true })
    const siblingDir = yield* tmpdirScoped()
    const store = yield* InstanceStore.Service
    const main = yield* store.load({ directory: mainDir })
    const sibling = yield* store.load({ directory: siblingDir, project: main.project, worktree: main.worktree })
    const contextual = yield* Ref.make(false)
    const seen = yield* Ref.make<string[]>([])
    const source = yield* ask({
      id: PermissionV1.ID.make("per_cross_worktree_context_source"),
      sessionID: SessionID.make("ses_cross_worktree_context_source"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: ["git status"],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, main), Effect.forkScoped)
    const target = yield* ask({
      id: PermissionV1.ID.make("per_cross_worktree_context_target"),
      sessionID: SessionID.make("ses_cross_worktree_context_target"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: [],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      policy: () =>
        Effect.gen(function* () {
          const ctx = yield* InstanceState.context
          yield* Ref.update(seen, (items) => [...items, ctx.directory])
          if (!(yield* Ref.get(contextual)))
            return [{ permission: "bash", pattern: "*", action: "ask" }] as PermissionV1.Ruleset
          return [
            {
              permission: "bash",
              pattern: "*",
              action: ctx.directory === sibling.directory ? ("deny" as const) : ("ask" as const),
            },
          ]
        }),
    }).pipe(Effect.provideService(InstanceRef, sibling), Effect.forkScoped)
    yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, main))
    yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, sibling))
    yield* Ref.set(contextual, true)

    yield* reply({ requestID: PermissionV1.ID.make("per_cross_worktree_context_source"), reply: "project" }).pipe(
      Effect.provideService(InstanceRef, main),
    )

    yield* Fiber.join(source)
    expect(
      (yield* list().pipe(Effect.provideService(InstanceRef, sibling))).map((item) => item.id),
    ).toEqual([PermissionV1.ID.make("per_cross_worktree_context_target")])
    expect((yield* Ref.get(seen)).at(-1)).toBe(sibling.directory)
    yield* rejectAll().pipe(Effect.provideService(InstanceRef, sibling))
    yield* Fiber.await(target)
  }),
)

it.live("project batch settles matching pending requests in a live sibling worktree", () =>
  Effect.gen(function* () {
    const mainDir = yield* tmpdirScoped({ git: true })
    const siblingDir = yield* tmpdirScoped()
    const store = yield* InstanceStore.Service
    const main = yield* store.load({ directory: mainDir })
    const sibling = yield* store.load({ directory: siblingDir, project: main.project, worktree: main.worktree })
    const target = yield* ask({
      id: PermissionV1.ID.make("per_cross_worktree_batch_target"),
      sessionID: SessionID.make("ses_cross_worktree_batch_target"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: [],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, sibling), Effect.forkScoped)
    yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, sibling))

    const sessionID = SessionID.make("ses_cross_worktree_batch_source")
    yield* forecast({
      sessionID,
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      candidates: [{ action: "bash", resources: ["git status"], reason: "Inspect state" }],
    }).pipe(Effect.provideService(InstanceRef, main))
    const active = yield* review(sessionID).pipe(Effect.provideService(InstanceRef, main), Effect.forkScoped)
    const pending = yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, main))
    yield* replyBatch({ batchID: pending[0].batchID!, requestIDs: [pending[0].id], reply: "project" }).pipe(
      Effect.provideService(InstanceRef, main),
    )

    yield* Fiber.join(active)
    yield* Fiber.join(target).pipe(Effect.timeout("1 second"))
    expect(yield* list().pipe(Effect.provideService(InstanceRef, sibling))).toEqual([])
  }),
)

it.live("Always does not settle pending requests in a live sibling worktree session", () =>
  Effect.gen(function* () {
    const mainDir = yield* tmpdirScoped({ git: true })
    const siblingDir = yield* tmpdirScoped()
    const store = yield* InstanceStore.Service
    const main = yield* store.load({ directory: mainDir })
    const sibling = yield* store.load({ directory: siblingDir, project: main.project, worktree: main.worktree })
    const source = yield* ask({
      id: PermissionV1.ID.make("per_cross_worktree_always_source"),
      sessionID: SessionID.make("ses_cross_worktree_always_source"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: ["git status"],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, main), Effect.forkScoped)
    const target = yield* ask({
      id: PermissionV1.ID.make("per_cross_worktree_always_target"),
      sessionID: SessionID.make("ses_cross_worktree_always_target"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: [],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, sibling), Effect.forkScoped)
    yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, main))
    yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, sibling))

    yield* reply({ requestID: PermissionV1.ID.make("per_cross_worktree_always_source"), reply: "always" }).pipe(
      Effect.provideService(InstanceRef, main),
    )

    yield* Fiber.join(source)
    expect(
      (yield* list().pipe(Effect.provideService(InstanceRef, sibling))).map((item) => item.id),
    ).toEqual([PermissionV1.ID.make("per_cross_worktree_always_target")])
    yield* rejectAll().pipe(Effect.provideService(InstanceRef, sibling))
    yield* Fiber.await(target)
  }),
)

it.live("project reply does not settle pending requests in another non-Git directory", () =>
  Effect.gen(function* () {
    const firstDir = yield* tmpdirScoped()
    const secondDir = yield* tmpdirScoped()
    const store = yield* InstanceStore.Service
    const first = yield* store.load({ directory: firstDir })
    const second = yield* store.load({ directory: secondDir })
    const source = yield* ask({
      id: PermissionV1.ID.make("per_cross_directory_source"),
      sessionID: SessionID.make("ses_cross_directory_source"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: ["git status"],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, first), Effect.forkScoped)
    const target = yield* ask({
      id: PermissionV1.ID.make("per_cross_directory_target"),
      sessionID: SessionID.make("ses_cross_directory_target"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: [],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, second), Effect.forkScoped)
    yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, first))
    yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, second))

    yield* reply({ requestID: PermissionV1.ID.make("per_cross_directory_source"), reply: "project" }).pipe(
      Effect.provideService(InstanceRef, first),
    )

    yield* Fiber.join(source)
    expect(
      (yield* list().pipe(Effect.provideService(InstanceRef, second))).map((item) => item.id),
    ).toEqual([PermissionV1.ID.make("per_cross_directory_target")])
    yield* rejectAll().pipe(Effect.provideService(InstanceRef, second))
    yield* Fiber.await(target)
  }),
)

it.live("keeps Always session-scoped in real non-git directories across reload", () =>
  Effect.gen(function* () {
    const one = yield* tmpdirScoped()
    const two = yield* tmpdirScoped()
    const store = yield* InstanceStore.Service
    const first = yield* store.load({ directory: one })
    const second = yield* store.load({ directory: two })
    expect(first.project.id).toBe(second.project.id)
    const { db } = yield* Database.Service
    const projects = (yield* db.select().from(ProjectTable).all()).length

    const approved = yield* ask({
      id: PermissionV1.ID.make("per_non_git"),
      sessionID: SessionID.make("session_non_git"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: ["git status"],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, first), Effect.forkScoped)
    expect((yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, first)))[0].always).toEqual(["git status"])
    yield* reply({ requestID: PermissionV1.ID.make("per_non_git"), reply: "always" }).pipe(
      Effect.provideService(InstanceRef, first),
    )
    yield* Fiber.join(approved)
    expect(yield* db.select().from(PermissionTable).all()).toEqual([])

    const restarted = yield* store.reload({ directory: one })
    const restartedAsk = yield* ask({
      sessionID: SessionID.make("session_non_git_restart"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: ["git status"],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, restarted), Effect.forkScoped)
    expect((yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, restarted)))[0].always).toEqual([
      "git status",
    ])
    yield* rejectAll().pipe(Effect.provideService(InstanceRef, restarted))
    yield* Fiber.await(restartedAsk)

    const isolated = yield* ask({
      sessionID: SessionID.make("session_other_non_git"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: ["git status"],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, second), Effect.forkScoped)
    expect((yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, second)))[0].always).toEqual([
      "git status",
    ])
    yield* rejectAll().pipe(Effect.provideService(InstanceRef, second))
    yield* Fiber.await(isolated)
    expect(yield* (yield* PermissionSaved.Service).list({ projectID: first.project.id })).toEqual([])
    expect((yield* db.select().from(ProjectTable).all()).length).toBe(projects)
  }),
)

it.live("persists Project approvals per non-git directory", () =>
  Effect.gen(function* () {
    const one = yield* tmpdirScoped()
    const two = yield* tmpdirScoped()
    const store = yield* InstanceStore.Service
    const first = yield* store.load({ directory: one })
    const second = yield* store.load({ directory: two })
    const approved = yield* ask({
      id: PermissionV1.ID.make("per_non_git_project"),
      sessionID: SessionID.make("session_non_git_project"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: ["git status"],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, first), Effect.forkScoped)
    yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, first))
    yield* reply({ requestID: PermissionV1.ID.make("per_non_git_project"), reply: "project" }).pipe(
      Effect.provideService(InstanceRef, first),
    )
    yield* Fiber.join(approved)

    const restarted = yield* store.reload({ directory: one })
    expect(
      yield* ask({
        sessionID: SessionID.make("session_non_git_project_restart"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.provideService(InstanceRef, restarted)),
    ).toBeUndefined()

    const isolated = yield* ask({
      sessionID: SessionID.make("session_non_git_project_other"),
      permission: "bash",
      patterns: ["git status"],
      metadata: {},
      always: [],
      ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
    }).pipe(Effect.provideService(InstanceRef, second), Effect.forkScoped)
    expect(yield* waitForPending(1).pipe(Effect.provideService(InstanceRef, second))).toHaveLength(1)
    yield* rejectAll().pipe(Effect.provideService(InstanceRef, second))
    yield* Fiber.await(isolated)
    expect(
      yield* (yield* PermissionSaved.Service).list({
        scope: "directory",
        directoryID: PermissionSaved.DirectoryID.create(first.directory),
      }),
    ).toMatchObject([{ action: "bash", resource: "git status" }])
  }),
)

it.instance(
  "keeps Project pending and retriable when database persistence fails",
  () =>
    Effect.gen(function* () {
      const bridge = yield* EventV2Bridge.Service
      const replies: PermissionV1.Reply[] = []
      const unsubscribe = yield* bridge.listen((event) => {
        if (event.type === Permission.Event.Replied.type) replies.push(decodeReply(event.data).reply)
        return Effect.void
      })
      yield* Effect.addFinalizer(() => unsubscribe)
      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_database_failure"),
        sessionID: SessionID.make("session_database_failure"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: ["git status"],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      yield* waitForPending(1)
      const { db } = yield* Database.Service
      yield* db
        .run(
          "CREATE TRIGGER fail_permission_insert BEFORE INSERT ON permission BEGIN SELECT RAISE(FAIL, 'forced permission failure'); END",
        )
        .pipe(Effect.orDie)

      expect(
        Exit.isFailure(
          yield* reply({ requestID: PermissionV1.ID.make("per_database_failure"), reply: "project" }).pipe(Effect.exit),
        ),
      ).toBe(true)
      expect(yield* list()).toHaveLength(1)
      expect(replies).toEqual([])

      yield* db.run("DROP TRIGGER fail_permission_insert").pipe(Effect.orDie)
      yield* reply({ requestID: PermissionV1.ID.make("per_database_failure"), reply: "project" })
      yield* Fiber.join(fiber)
      expect(yield* list()).toEqual([])
      expect(replies).toEqual(["project"])
    }),
  { git: true },
)

it.instance(
  "finishes the persisted reply critical section when interrupted",
  () =>
    Effect.gen(function* () {
      const bridge = yield* EventV2Bridge.Service
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const unsubscribe = yield* bridge.listen((event) => {
        if (
          event.type !== Permission.Event.Replied.type ||
          decodeReply(event.data).requestID !== PermissionV1.ID.make("per_interrupted_reply")
        )
          return Effect.void
        return Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)))
      })
      yield* Effect.addFinalizer(() => unsubscribe)
      const askFiber = yield* ask({
        id: PermissionV1.ID.make("per_interrupted_reply"),
        sessionID: SessionID.make("session_interrupted_reply"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: ["git status"],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      yield* waitForPending(1)

      const replyFiber = yield* reply({
        requestID: PermissionV1.ID.make("per_interrupted_reply"),
        reply: "project",
      }).pipe(Effect.forkScoped)
      yield* Deferred.await(entered)
      const interrupt = yield* Fiber.interrupt(replyFiber).pipe(Effect.forkScoped)
      yield* Effect.yieldNow
      expect(yield* list()).toEqual([])

      yield* Deferred.succeed(release, undefined)
      yield* Fiber.await(interrupt)
      yield* Fiber.join(askFiber)
      expect(yield* list()).toEqual([])
      expect(
        yield* ask({
          sessionID: SessionID.make("session_after_interrupted_reply"),
          permission: "bash",
          patterns: ["git status"],
          metadata: {},
          always: [],
          ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
        }),
      ).toBeUndefined()
    }),
  { git: true },
)

it.instance(
  "reply - reject cancels all pending for same session",
  () =>
    Effect.gen(function* () {
      const a = yield* ask({
        id: PermissionV1.ID.make("per_test4a"),
        sessionID: SessionID.make("session_same"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      }).pipe(Effect.forkScoped)

      const b = yield* ask({
        id: PermissionV1.ID.make("per_test4b"),
        sessionID: SessionID.make("session_same"),
        permission: "edit",
        patterns: ["foo.ts"],
        metadata: {},
        always: [],
        ruleset: [],
      }).pipe(Effect.forkScoped)

      yield* waitForPending(2)
      yield* reply({ requestID: PermissionV1.ID.make("per_test4a"), reply: "reject" })

      const [ea, eb] = yield* Effect.all([Fiber.await(a), Fiber.await(b)])
      expect(Exit.isFailure(ea)).toBe(true)
      expect(Exit.isFailure(eb)).toBe(true)
      if (Exit.isFailure(ea)) expect(Cause.squash(ea.cause)).toBeInstanceOf(PermissionV1.RejectedError)
      if (Exit.isFailure(eb)) expect(Cause.squash(eb.cause)).toBeInstanceOf(PermissionV1.RejectedError)
    }),
  { git: true },
)

it.instance(
  "reply - project resolves matching pending requests across sessions",
  () =>
    Effect.gen(function* () {
      const first = yield* ask({
        id: PermissionV1.ID.make("per_project_first"),
        sessionID: SessionID.make("session_project_first"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: ["git status"],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)
      const second = yield* ask({
        id: PermissionV1.ID.make("per_project_second"),
        sessionID: SessionID.make("session_project_second"),
        permission: "bash",
        patterns: ["git status"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)

      yield* waitForPending(2)
      yield* reply({ requestID: PermissionV1.ID.make("per_project_first"), reply: "project" })

      yield* Fiber.join(first)
      yield* Fiber.join(second)
      expect(yield* list()).toEqual([])
    }),
  { git: true },
)

it.instance(
  "reply - always resolves matching pending requests in same session",
  () =>
    Effect.gen(function* () {
      const a = yield* ask({
        id: PermissionV1.ID.make("per_test5a"),
        sessionID: SessionID.make("session_same"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: ["ls"],
        ruleset: [],
      }).pipe(Effect.forkScoped)

      const b = yield* ask({
        id: PermissionV1.ID.make("per_test5b"),
        sessionID: SessionID.make("session_same"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      }).pipe(Effect.forkScoped)

      yield* waitForPending(2)
      yield* reply({ requestID: PermissionV1.ID.make("per_test5a"), reply: "always" })

      yield* Fiber.join(a)
      yield* Fiber.join(b)
      expect(yield* list()).toHaveLength(0)
    }),
  { git: true },
)

it.instance(
  "reply - always keeps other session pending",
  () =>
    Effect.gen(function* () {
      const a = yield* ask({
        id: PermissionV1.ID.make("per_test6a"),
        sessionID: SessionID.make("session_a"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: ["ls"],
        ruleset: [],
      }).pipe(Effect.forkScoped)

      const b = yield* ask({
        id: PermissionV1.ID.make("per_test6b"),
        sessionID: SessionID.make("session_b"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      }).pipe(Effect.forkScoped)

      yield* waitForPending(2)
      yield* reply({ requestID: PermissionV1.ID.make("per_test6a"), reply: "always" })

      yield* Fiber.join(a)
      expect((yield* list()).map((item) => item.id)).toEqual([PermissionV1.ID.make("per_test6b")])

      yield* rejectAll()
      yield* Fiber.await(b)
    }),
  { git: true },
)

it.instance(
  "reply - publishes replied event",
  () =>
    Effect.gen(function* () {
      const events = yield* EventV2Bridge.Service
      const seen = yield* Deferred.make<{
        sessionID: SessionID
        requestID: PermissionV1.ID
        reply: PermissionV1.Reply
      }>()

      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_test7"),
        sessionID: SessionID.make("session_test"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      }).pipe(Effect.forkScoped)

      yield* waitForPending(1)

      const unsub = yield* events.listen((event) => {
        if (event.type === Permission.Event.Replied.type)
          Deferred.doneUnsafe(seen, Effect.succeed(decodeReply(event.data)))
        return Effect.void
      })
      yield* Effect.addFinalizer(() => unsub)

      yield* reply({ requestID: PermissionV1.ID.make("per_test7"), reply: "once" })
      yield* Fiber.join(fiber)
      expect(
        yield* Deferred.await(seen).pipe(
          Effect.timeoutOrElse({
            duration: "1 second",
            orElse: () => Effect.fail(new Error("timed out waiting for permission replied event")),
          }),
        ),
      ).toEqual({
        sessionID: SessionID.make("session_test"),
        requestID: PermissionV1.ID.make("per_test7"),
        reply: "once",
      })
    }),
  { git: true },
)

it.live("permission requests stay isolated by directory", () =>
  Effect.gen(function* () {
    const one = yield* tmpdirScoped({ git: true })
    const two = yield* tmpdirScoped({ git: true })
    const store = yield* InstanceStore.Service

    const a = yield* store
      .provide(
        { directory: one },
        ask({
          id: PermissionV1.ID.make("per_dir_a"),
          sessionID: SessionID.make("session_dir_a"),
          permission: "bash",
          patterns: ["ls"],
          metadata: {},
          always: [],
          ruleset: [],
        }),
      )
      .pipe(Effect.forkScoped)

    const b = yield* store
      .provide(
        { directory: two },
        ask({
          id: PermissionV1.ID.make("per_dir_b"),
          sessionID: SessionID.make("session_dir_b"),
          permission: "bash",
          patterns: ["pwd"],
          metadata: {},
          always: [],
          ruleset: [],
        }),
      )
      .pipe(Effect.forkScoped)

    const onePending = yield* store.provide({ directory: one }, waitForPending(1))
    const twoPending = yield* store.provide({ directory: two }, waitForPending(1))

    expect(onePending).toHaveLength(1)
    expect(twoPending).toHaveLength(1)
    expect(onePending[0].id).toBe(PermissionV1.ID.make("per_dir_a"))
    expect(twoPending[0].id).toBe(PermissionV1.ID.make("per_dir_b"))

    yield* store.provide({ directory: one }, reply({ requestID: onePending[0].id, reply: "reject" }))
    yield* store.provide({ directory: two }, reply({ requestID: twoPending[0].id, reply: "reject" }))

    yield* Fiber.await(a)
    yield* Fiber.await(b)
  }),
)

it.instance(
  "pending permission rejects on instance dispose",
  () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const store = yield* InstanceStore.Service
      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_dispose"),
        sessionID: SessionID.make("session_dispose"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      }).pipe(Effect.forkScoped)

      expect(yield* waitForPending(1)).toHaveLength(1)
      const ctx = yield* store.load({ directory: test.directory })
      yield* store.dispose(ctx)

      const exit = yield* Fiber.await(fiber)
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBeInstanceOf(PermissionV1.RejectedError)
    }),
  { git: true },
)

it.instance(
  "pending permission rejects on instance reload",
  () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const store = yield* InstanceStore.Service
      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_reload"),
        sessionID: SessionID.make("session_reload"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      }).pipe(Effect.forkScoped)

      expect(yield* waitForPending(1)).toHaveLength(1)
      yield* store.reload({ directory: test.directory })

      const exit = yield* Fiber.await(fiber)
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBeInstanceOf(PermissionV1.RejectedError)
    }),
  { git: true },
)

it.instance(
  "reply - fails for unknown requestID",
  () =>
    Effect.gen(function* () {
      const exit = yield* reply({ requestID: PermissionV1.ID.make("per_unknown"), reply: "once" }).pipe(Effect.exit)
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(Cause.squash(exit.cause)).toMatchObject({ _tag: "Permission.NotFoundError", requestID: "per_unknown" })
      }
      expect(yield* list()).toHaveLength(0)
    }),
  { git: true },
)

it.instance(
  "ask - checks all patterns and stops on first deny",
  () =>
    Effect.gen(function* () {
      const err = yield* fail(
        ask({
          sessionID: SessionID.make("session_test"),
          permission: "bash",
          patterns: ["echo hello", "rm -rf /"],
          metadata: {},
          always: [],
          ruleset: [
            { permission: "bash", pattern: "*", action: "allow" },
            { permission: "bash", pattern: "rm *", action: "deny" },
          ],
        }),
      )
      expect(err).toBeInstanceOf(PermissionV1.DeniedError)
    }),
  { git: true },
)

it.instance(
  "ask - allows all patterns when all match allow rules",
  () =>
    Effect.gen(function* () {
      const result = yield* ask({
        sessionID: SessionID.make("session_test"),
        permission: "bash",
        patterns: ["echo hello", "ls -la", "pwd"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "allow" }],
      })
      expect(result).toBeUndefined()
    }),
  { git: true },
)

it.instance(
  "ask - should deny even when an earlier pattern is ask",
  () =>
    Effect.gen(function* () {
      const err = yield* fail(
        ask({
          sessionID: SessionID.make("session_test"),
          permission: "bash",
          patterns: ["echo hello", "rm -rf /"],
          metadata: {},
          always: [],
          ruleset: [
            { permission: "bash", pattern: "echo *", action: "ask" },
            { permission: "bash", pattern: "rm *", action: "deny" },
          ],
        }),
      )

      expect(err).toBeInstanceOf(PermissionV1.DeniedError)
      expect(yield* list()).toHaveLength(0)
    }),
  { git: true },
)

it.instance(
  "ask - abort should clear pending request",
  () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const store = yield* InstanceStore.Service

      const fiber = yield* ask({
        id: PermissionV1.ID.make("per_reload"),
        sessionID: SessionID.make("session_reload"),
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      }).pipe(Effect.forkScoped)

      const pending = yield* waitForPending(1)
      expect(pending).toHaveLength(1)
      yield* store.reload({ directory: test.directory })

      const exit = yield* Fiber.await(fiber)
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBeInstanceOf(PermissionV1.RejectedError)
    }),
  { git: true },
)
