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
