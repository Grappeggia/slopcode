import { expect } from "bun:test"
import { Database } from "@slopcode-ai/core/database/database"
import { Context, Effect, Layer } from "effect"
import path from "path"
import { Agent } from "../../src/agent/agent"
import { Config } from "../../src/config/config"
import { InstanceState } from "../../src/effect/instance-state"
import { Memory, candidates } from "../../src/memory/memory"
import { LLM } from "../../src/session/llm"
import type { Info as SessionInfo } from "../../src/session/session"
import { Provider } from "../../src/provider/provider"
import { provideInstanceEffect, TestInstance, tmpdir } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const configLayer = Layer.mock(Config.Service, {
  get: () => Effect.succeed({ memory: { enabled: false } }),
})
const enabledConfigLayer = Layer.mock(Config.Service, {
  get: () => Effect.succeed({ memory: { enabled: true } }),
})
function memoryLayer(database = Database.defaultLayer, config = configLayer) {
  return Memory.layer.pipe(
    Layer.provide(database),
    Layer.provide(config),
    Layer.provide(Layer.mock(Agent.Service, {})),
    Layer.provide(Layer.mock(Provider.Service, {})),
    Layer.provide(Layer.mock(LLM.Service, {})),
  )
}
const it = testEffect(memoryLayer())
const enabled = testEffect(memoryLayer(Database.defaultLayer, enabledConfigLayer))

function session(input: { projectID: string; metadata?: Record<string, unknown> }) {
  return {
    id: "ses_00000000000000000000000000",
    projectID: input.projectID,
    metadata: input.metadata,
  } as SessionInfo
}

function project() {
  return InstanceState.context.pipe(Effect.map((ctx) => ctx.project.id))
}

it.instance("dedupes project memories", () =>
  Effect.gen(function* () {
    yield* project()
    const memory = yield* Memory.Service

    const first = yield* memory.create({ content: "Use Bun APIs for filesystem work", scope: "project" })
    const second = yield* memory.create({ content: "Use Bun APIs for filesystem work", scope: "project" })
    const list = yield* memory.list({ includeDisabled: true })

    expect(first?.id).toBe(second?.id)
    expect(list).toHaveLength(1)
  }),
)

it.instance("atomically dedupes concurrent global memories", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    const filename = path.join(test.directory, "concurrent-memory.sqlite")
    const contexts = yield* Effect.forEach(
      Array.from({ length: 8 }),
      () => Layer.build(memoryLayer(Database.layerFromPath(filename))),
      { concurrency: 1 },
    )
    const memories = contexts.map((context) => Context.get(context, Memory.Service))
    const created = yield* Effect.all(
      memories.map((memory) =>
        memory.create({ content: "Keep concurrent memory extraction deterministic", scope: "global" }),
      ),
      { concurrency: "unbounded" },
    )
    const rows = yield* memories[0].list({ includeDisabled: true })

    expect(created.every((item) => item !== undefined)).toBe(true)
    expect(new Set(created.map((item) => item?.id)).size).toBe(1)
    expect(rows.filter((item) => item.enabled)).toHaveLength(1)
    expect(created).toEqual(created.map(() => created[0]))
    expect(rows).toEqual(created[0] ? [created[0]] : [])
  }),
)

it.instance("dedupes a disabled memory", () =>
  Effect.gen(function* () {
    yield* project()
    const memory = yield* Memory.Service
    const first = yield* memory.create({ content: "Keep this disabled memory deduplicated", scope: "project" })
    if (!first) return
    yield* memory.update(first.id, { enabled: false })

    const duplicate = yield* memory.create({ content: "Keep this disabled memory deduplicated", scope: "project" })
    const rows = yield* memory.list({ includeDisabled: true })

    expect(duplicate?.id).toBe(first.id)
    expect(duplicate?.enabled).toBe(false)
    expect(rows.map((item) => item.id)).toEqual([first.id])
  }),
)

it.instance("rejects an update that duplicates another memory", () =>
  Effect.gen(function* () {
    const memory = yield* Memory.Service
    const first = yield* memory.create({ content: "Keep the first durable project memory" })
    const second = yield* memory.create({ content: "Keep the second durable project memory" })
    if (!first || !second) return

    expect(yield* memory.update(second.id, { content: first.content })).toBeUndefined()
    expect((yield* memory.list({ includeDisabled: true })).find((item) => item.id === second.id)?.content).toBe(
      second.content,
    )
  }),
)

it.instance("keeps concurrent duplicate updates conflict-safe", () =>
  Effect.gen(function* () {
    const memory = yield* Memory.Service
    const first = yield* memory.create({ content: "Keep the first concurrent update fixture" })
    const second = yield* memory.create({ content: "Keep the second concurrent update fixture" })
    if (!first || !second) return

    const updated = yield* Effect.all(
      [first.id, second.id].map((id) => memory.update(id, { content: "Converge on one durable memory value" })),
      { concurrency: "unbounded" },
    )
    const rows = yield* memory.list({ includeDisabled: true })

    expect(updated.filter((item) => item !== undefined)).toHaveLength(1)
    expect(rows.filter((item) => item.content === "Converge on one durable memory value")).toHaveLength(1)
  }),
)

it.instance("recreates a hard-deleted memory as a new active row", () =>
  Effect.gen(function* () {
    yield* project()
    const memory = yield* Memory.Service
    const first = yield* memory.create({ content: "Recreate this memory after deleting it", scope: "project" })
    if (!first) return
    yield* memory.remove(first.id)

    const recreated = yield* memory.create({ content: "Recreate this memory after deleting it", scope: "project" })
    const rows = yield* memory.list({ includeDisabled: true })

    expect(recreated?.id).not.toBe(first.id)
    expect(recreated?.enabled).toBe(true)
    expect(rows).toEqual(recreated ? [recreated] : [])
  }),
)

it.instance(
  "does not mutate another project's memories",
  () =>
    Effect.gen(function* () {
      const memory = yield* Memory.Service
      const directory = yield* Effect.acquireRelease(
        Effect.promise(() => tmpdir({ git: true })),
        (item) => Effect.promise(() => item[Symbol.asyncDispose]()),
      )
      const foreign = yield* memory
        .create({ content: "Keep this memory private to the foreign project", scope: "project" })
        .pipe(provideInstanceEffect(directory.path))
      if (!foreign) return

      expect(yield* memory.update(foreign.id, { content: "Cross-project update must not succeed" })).toBeUndefined()
      yield* memory.remove(foreign.id)

      const rows = yield* memory.list({ includeDisabled: true }).pipe(provideInstanceEffect(directory.path))
      expect(rows.map((item) => item.id)).toContain(foreign.id)
      expect(rows.find((item) => item.id === foreign.id)?.content).toBe(foreign.content)
    }),
  { git: true },
)

it.instance("selects only when session memory is enabled", () =>
  Effect.gen(function* () {
    const projectID = yield* project()
    const memory = yield* Memory.Service
    yield* memory.create({ content: "Prefer compact test fixtures in this project", scope: "project" })

    expect(yield* memory.select({ session: session({ projectID }) })).toEqual([])
    expect(
      yield* memory.select({ session: session({ projectID, metadata: { memory: { status: "enabled" } } }) }),
    ).toHaveLength(1)
  }),
)

it.instance("redacts secrets before storing", () =>
  Effect.gen(function* () {
    yield* project()
    const memory = yield* Memory.Service
    yield* memory.create({ content: "The API token is token=sk-abcdefghijklmnopqrstuv for local tests" })
    const list = yield* memory.list({ includeDisabled: true })

    expect(list[0]?.content).toContain("[redacted]")
    expect(list[0]?.content).not.toContain("sk-abcdefghijklmnopqrstuv")
  }),
)

it.instance("redacts namespaced and structured credentials before storing", () =>
  Effect.gen(function* () {
    yield* project()
    const memory = yield* Memory.Service
    const npm = "npm_abcdefghijklmnopqrstuvwxyz0123456789"
    const aws = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    const access = "AKIAIOSFODNN7EXAMPLE"
    const normal = "Keep project memories concise and actionable"
    const created = yield* Effect.forEach(
      [
        "Database credential: DATABASE_PASSWORD=correct-horse-battery-staple",
        `AWS credential: AWS_SECRET_ACCESS_KEY=${aws}`,
        `Registry credential: NPM_TOKEN=${npm}`,
        `The npm credential is ${npm}`,
        `The AWS access key is ${access}`,
        normal,
      ],
      (content) => memory.create({ content }),
      { concurrency: 1 },
    )
    const list = yield* memory.list({ includeDisabled: true })
    const contents = [...created.flatMap((item) => (item ? [item.content] : [])), ...list.map((item) => item.content)]

    expect(
      contents.some((content) =>
        ["correct-horse-battery-staple", aws, npm, access].some((value) => content.includes(value)),
      ),
    ).toBe(false)
    expect(contents).toContain("Database credential: DATABASE_PASSWORD=[redacted]")
    expect(contents).toContain("AWS credential: AWS_SECRET_ACCESS_KEY=[redacted]")
    expect(contents).toContain("Registry credential: NPM_TOKEN=[redacted]")
    expect(contents).toContain(normal)
  }),
)

it.instance("redacts JSON and SDK credentials before prompt reuse", () =>
  Effect.gen(function* () {
    const projectID = yield* project()
    const memory = yield* Memory.Service
    const npm = "npm_abcdefghijklmnopqrstuvwxyz0123456789"
    const secrets = [
      "fake-json-secret-value",
      "fake-sdk-secret-value",
      "fake-session-token-value",
      npm,
      "fake-api-key-value",
    ]
    const normal = '{"region":"us-west-2","retries":3}'
    const created = yield* Effect.forEach(
      [
        '{"AWS_SECRET_ACCESS_KEY":"fake-json-secret-value"}',
        '{"secretAccessKey":"fake-sdk-secret-value"}',
        '{"sessionToken":"fake-session-token-value"}',
        `{"NPM_TOKEN":"${npm}"}`,
        '{"apiKey":"fake-api-key-value"}',
        normal,
      ],
      (content) => memory.create({ content }),
      { concurrency: 1 },
    )
    const list = yield* memory.list({ includeDisabled: true })
    const selected = yield* memory.select({
      session: session({ projectID, metadata: { memory: { status: "enabled" } } }),
      limit: 10,
    })
    const contents = [
      ...created.flatMap((item) => (item ? [item.content] : [])),
      ...list.map((item) => item.content),
      ...selected.map((item) => item.content),
    ]

    expect(contents.some((content) => secrets.some((value) => content.includes(value)))).toBe(false)
    expect(contents).toContain('{"AWS_SECRET_ACCESS_KEY":"[redacted]"}')
    expect(contents).toContain('{"secretAccessKey":"[redacted]"}')
    expect(contents).toContain('{"sessionToken":"[redacted]"}')
    expect(contents).toContain('{"NPM_TOKEN":"[redacted]"}')
    expect(contents).toContain('{"apiKey":"[redacted]"}')
    expect(list.map((item) => item.content)).toContain(normal)
    expect(selected.map((item) => item.content)).toContain(normal)
  }),
)

it.instance("redacts standalone private keys and common bearer credentials", () =>
  Effect.gen(function* () {
    const memory = yield* Memory.Service
    const pem = "-----BEGIN PRIVATE KEY-----\nZmFrZS1wcml2YXRlLWtleQ==\n-----END PRIVATE KEY-----"
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzbG9wY29kZSJ9.c2lnbmF0dXJlMTIzNDU2"
    const google = "AIzaSyA12345678901234567890123456789012"
    const password = "Password is correct-horse-battery-staple"
    const created = yield* Effect.forEach(
      [pem, `Keep this JWT private: ${jwt}`, `Google API key is ${google}`, password],
      (content) => memory.create({ content }),
      { concurrency: 1 },
    )
    const contents = [
      ...created.flatMap((item) => (item ? [item.content] : [])),
      ...(yield* memory.list({ includeDisabled: true })).map((item) => item.content),
    ]

    expect(
      contents.some((content) =>
        [pem, jwt, google, "correct-horse-battery-staple"].some((value) => content.includes(value)),
      ),
    ).toBe(false)
  }),
)

it.instance("includes recent global memories when project memories exceed the prompt limit", () =>
  Effect.gen(function* () {
    const projectID = yield* project()
    const memory = yield* Memory.Service
    yield* Effect.forEach(
      Array.from({ length: 9 }, (_, index) => `Project selection fixture number ${index}`),
      (content) => memory.create({ content }),
      { concurrency: 1, discard: true },
    )
    yield* Effect.sleep("2 millis")
    const global = yield* memory.create({ content: "Use concise explanations in every project", scope: "global" })
    if (!global) return
    const selected = yield* memory.select({
      session: session({ projectID, metadata: { memory: { status: "enabled" } } }),
      limit: 8,
    })

    expect(selected).toHaveLength(8)
    expect(selected.map((item) => item.id)).toContain(global?.id)
    expect((yield* memory.list({ includeDisabled: true })).find((item) => item.id === global?.id)?.time.updated).toBe(
      global?.time.updated,
    )
  }),
)

enabled.instance("requires explicit session consent before selecting global memories", () =>
  Effect.gen(function* () {
    const projectID = yield* project()
    const memory = yield* Memory.Service
    const global = yield* memory.create({ content: "Use concise explanations in every project", scope: "global" })
    const projectMemory = yield* memory.create({ content: "Use Bun APIs in this project", scope: "project" })
    if (!global || !projectMemory) return
    const selected = yield* memory.select({ session: session({ projectID }) })

    expect(selected.map((item) => item.id)).toContain(projectMemory?.id)
    expect(selected.map((item) => item.id)).not.toContain(global?.id)
  }),
)

it.effect("forces automatically extracted candidates to project scope", () =>
  Effect.sync(() => {
    expect(candidates('{"memories":[{"content":"Use concise explanations everywhere","scope":"global"}]}')).toEqual([
      { content: "Use concise explanations everywhere", scope: "project" },
    ])
  }),
)

it.instance("lists and manages more than 100 memories", () =>
  Effect.gen(function* () {
    const projectID = yield* project()
    const memory = yield* Memory.Service
    const ids = (yield* Effect.forEach(
      Array.from({ length: 102 }, (_, index) => `Project memory fixture number ${index.toString().padStart(3, "0")}`),
      (content) => memory.create({ content }),
      { concurrency: 1 },
    )).flatMap((item) => (item ? [item.id] : []))
    const first = ids[0]!
    const last = ids.at(-1)!
    const listed = yield* memory.list({ includeDisabled: true })

    expect(ids).toHaveLength(102)
    expect(listed).toHaveLength(102)
    expect(listed.some((item) => item.id === first)).toBe(true)
    expect(listed.some((item) => item.id === last)).toBe(true)

    yield* memory.update(first, { enabled: false })
    expect((yield* memory.list()).some((item) => item.id === first)).toBe(false)
    expect((yield* memory.list({ includeDisabled: true })).some((item) => item.id === first)).toBe(true)

    yield* memory.remove(last)
    expect((yield* memory.list({ includeDisabled: true })).some((item) => item.id === last)).toBe(false)
    expect(
      yield* memory.select({
        session: session({ projectID, metadata: { memory: { status: "enabled" } } }),
        limit: 1_000,
      }),
    ).toHaveLength(50)
  }),
)
