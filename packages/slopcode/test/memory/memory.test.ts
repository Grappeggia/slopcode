import { expect } from "bun:test"
import { Database } from "@slopcode-ai/core/database/database"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Config } from "../../src/config/config"
import { InstanceState } from "../../src/effect/instance-state"
import { Memory } from "../../src/memory/memory"
import { LLM } from "../../src/session/llm"
import type { Info as SessionInfo } from "../../src/session/session"
import { Provider } from "../../src/provider/provider"
import { testEffect } from "../lib/effect"

const configLayer = Layer.mock(Config.Service, {
  get: () => Effect.succeed({ memory: { enabled: false } }),
})
const it = testEffect(
  Memory.layer.pipe(
    Layer.provide(Database.defaultLayer),
    Layer.provide(configLayer),
    Layer.provide(Layer.mock(Agent.Service, {})),
    Layer.provide(Layer.mock(Provider.Service, {})),
    Layer.provide(Layer.mock(LLM.Service, {})),
  ),
)

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

it.instance("selects only when session memory is enabled", () =>
  Effect.gen(function* () {
    const projectID = yield* project()
    const memory = yield* Memory.Service
    yield* memory.create({ content: "Prefer compact test fixtures in this project", scope: "project" })

    expect(yield* memory.select({ session: session({ projectID }) })).toEqual([])
    expect(yield* memory.select({ session: session({ projectID, metadata: { memory: { status: "enabled" } } }) })).toHaveLength(
      1,
    )
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

it.instance("lists and manages more than 100 memories", () =>
  Effect.gen(function* () {
    yield* project()
    const memory = yield* Memory.Service
    const ids = (
      yield* Effect.forEach(
        Array.from({ length: 102 }, (_, index) => `Project memory fixture number ${index.toString().padStart(3, "0")}`),
        (content) => memory.create({ content }),
        { concurrency: 1 },
      )
    ).flatMap((item) => (item ? [item.id] : []))
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
  }),
)
