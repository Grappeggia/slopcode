import { beforeEach, describe, expect, test } from "bun:test"
import { Database } from "@slopcode-ai/core/database/database"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import type { ModelMessage } from "ai"
import { Cause, Effect, Exit, Layer, Schema } from "effect"
import * as Stream from "effect/Stream"
import { Agent } from "../../src/agent/agent"
import { Instruction } from "../../src/session/instruction"
import { LLM } from "../../src/session/llm"
import { MessageID, PartID, SessionID } from "../../src/session/schema"
import { Session } from "../../src/session/session"
import { SessionSideQuestion } from "../../src/session/side-question"
import { SystemPrompt } from "../../src/session/system"
import { Plugin } from "../../src/plugin"
import { ProviderTest } from "../fake/provider"
import { TestConfig } from "../fixture/config"
import { testEffect } from "../lib/effect"

const ref = {
  providerID: ProviderV2.ID.make("test"),
  modelID: ModelV2.ID.make("test-model"),
}

const model = ProviderTest.model({
  id: ref.modelID,
  providerID: ref.providerID,
  api: { id: ref.modelID, url: "https://example.com", npm: "@ai-sdk/openai" },
  limit: { context: 800, output: 100 },
})

const build = {
  name: "build",
  mode: "primary",
  permission: [],
  options: {},
} satisfies Agent.Info

const requests: LLM.StreamInput[] = []
const hooks: string[] = []

const agents = Layer.succeed(
  Agent.Service,
  Agent.Service.of({
    get: () => Effect.succeed(build),
    list: () => Effect.succeed([build]),
    defaultInfo: () => Effect.succeed(build),
    defaultAgent: () => Effect.succeed(build.name),
    generate: () => Effect.die("not implemented"),
  }),
)

const llm = Layer.succeed(
  LLM.Service,
  LLM.Service.of({
    stream: (input) => {
      requests.push(input)
      return Stream.empty
    },
  }),
)

const plugin = Layer.mock(Plugin.Service)({
  trigger: <Name extends string, Input, Output>(name: Name, _input: Input, output: Output) => {
    hooks.push(name)
    return Effect.succeed(output)
  },
  list: () => Effect.succeed([]),
  init: () => Effect.void,
})

const system = Layer.mock(SystemPrompt.Service)({
  environment: () => Effect.succeed(["test environment"]),
  skills: () => Effect.succeed(undefined),
})

const instruction = Layer.mock(Instruction.Service)({
  system: () => Effect.succeed(["test project instructions"]),
})

const provider = ProviderTest.fake({ model })
const side = SessionSideQuestion.layer.pipe(
  Layer.provide(agents),
  Layer.provide(provider.layer),
  Layer.provide(Session.defaultLayer),
  Layer.provide(plugin),
  Layer.provide(system),
  Layer.provide(instruction),
  Layer.provide(llm),
  Layer.provide(TestConfig.layer()),
  Layer.provide(Database.defaultLayer),
)
const it = testEffect(Layer.mergeAll(Session.defaultLayer, Database.defaultLayer, side))

beforeEach(() => {
  requests.length = 0
  hooks.length = 0
})

function user(sessionID: SessionID, ...texts: string[]) {
  return Effect.gen(function* () {
    const sessions = yield* Session.Service
    const message = yield* sessions.updateMessage({
      id: MessageID.ascending(),
      sessionID,
      role: "user",
      agent: build.name,
      model: ref,
      time: { created: Date.now() },
    })
    const parts = yield* Effect.forEach(texts, (text) =>
      sessions.updatePart({
        id: PartID.ascending(),
        sessionID,
        messageID: message.id,
        type: "text",
        text,
      }),
    )
    return { message, parts }
  })
}

function assistant(sessionID: SessionID, parentID: MessageID, text: string, summary = false) {
  return Effect.gen(function* () {
    const sessions = yield* Session.Service
    const message = yield* sessions.updateMessage({
      id: MessageID.ascending(),
      sessionID,
      parentID,
      role: "assistant",
      mode: build.name,
      agent: build.name,
      path: { cwd: "/tmp", root: "/tmp" },
      cost: 0,
      tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
      modelID: ref.modelID,
      providerID: ref.providerID,
      time: { created: Date.now(), completed: Date.now() },
      finish: "stop",
      summary,
    })
    yield* sessions.updatePart({
      id: PartID.ascending(),
      sessionID,
      messageID: message.id,
      type: "text",
      text,
    })
    return message
  })
}

function ask(sessionID: SessionID, input: Pick<SessionSideQuestion.Input, "question" | "turns">) {
  return Effect.gen(function* () {
    const service = yield* SessionSideQuestion.Service
    yield* service
      .ask({
        sessionID,
        question: input.question,
        turns: input.turns,
        agent: build.name,
        model: ref,
        variant: "high",
      })
      .pipe(Stream.runDrain)
    const request = requests.at(-1)
    if (!request) return yield* Effect.die("side question did not call the LLM")
    return request
  })
}

function texts(messages: ModelMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    text:
      typeof message.content === "string"
        ? message.content
        : message.content
            .flatMap((part) => ("text" in part && typeof part.text === "string" ? [part.text] : []))
            .join(""),
  }))
}

describe("SessionSideQuestion schemas", () => {
  const decode = Schema.decodeUnknownSync(SessionSideQuestion.Input)

  test("trims the question and completed turns", () => {
    expect(
      decode({
        sessionID: SessionID.make("ses_test"),
        question: "  current  ",
        agent: "build",
        model: ref,
        turns: [{ question: "  prior question ", answer: " prior answer  " }],
      }),
    ).toMatchObject({
      question: "current",
      turns: [{ question: "prior question", answer: "prior answer" }],
    })
  })

  test("rejects empty current questions and completed turn fields", () => {
    const base = { sessionID: SessionID.make("ses_test"), agent: "build", model: ref }
    expect(() => decode({ ...base, question: "   " })).toThrow()
    expect(() => decode({ ...base, question: "current", turns: [{ question: " ", answer: "answer" }] })).toThrow()
    expect(() => decode({ ...base, question: "current", turns: [{ question: "question", answer: "\n" }] })).toThrow()
  })
})

it.instance("orders persisted context, side turns, and the current question without writing session history", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create({ metadata: { goal: { text: "Ship follow-ups", status: "active" } } })
    const first = yield* user(session.id, "main question")
    yield* assistant(session.id, first.message.id, "main answer")
    const before = yield* sessions.messages({ sessionID: session.id })

    const request = yield* ask(session.id, {
      question: "  current side question  ",
      turns: [
        { question: "  first side question", answer: "first side answer  " },
        { question: "second side question  ", answer: "  second side answer" },
      ],
    })

    expect(texts(request.messages)).toEqual([
      { role: "user", text: "main question" },
      { role: "assistant", text: "main answer" },
      { role: "user", text: "first side question" },
      { role: "assistant", text: "first side answer" },
      { role: "user", text: "second side question" },
      { role: "assistant", text: "second side answer" },
      { role: "user", text: "current side question" },
    ])
    expect(request.system).toEqual([
      "test environment",
      "test project instructions",
      "<system-reminder>\nCurrent session goal: Ship follow-ups\nUse this as the north star unless the user explicitly changes it.\n</system-reminder>",
      expect.stringContaining("You are answering a side question"),
    ])
    expect(request.user.model.variant).toBe("high")
    expect(request.agent).toBe(build)
    expect(request.model).toBe(model)
    expect(request.tools).toEqual({})
    expect(request.toolChoice).toBe("none")
    expect(hooks).toContain("experimental.chat.messages.transform")
    expect(yield* sessions.messages({ sessionID: session.id })).toEqual(before)
  }),
)

it.instance("reloads main-session context on every stateless follow-up", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create()
    const first = yield* user(session.id, "first main question")
    yield* assistant(session.id, first.message.id, "first main answer")

    const prior = [{ question: "side question", answer: "side answer" }]
    const initial = yield* ask(session.id, { question: "follow-up one", turns: prior })
    const second = yield* user(session.id, "new main question")
    yield* assistant(session.id, second.message.id, "new main answer")
    const refreshed = yield* ask(session.id, { question: "follow-up two", turns: prior })

    expect(texts(initial.messages).map((item) => item.text)).not.toContain("new main question")
    expect(texts(refreshed.messages)).toEqual([
      { role: "user", text: "first main question" },
      { role: "assistant", text: "first main answer" },
      { role: "user", text: "new main question" },
      { role: "assistant", text: "new main answer" },
      { role: "user", text: "side question" },
      { role: "assistant", text: "side answer" },
      { role: "user", text: "follow-up two" },
    ])
  }),
)

it.instance("applies a partial revert boundary in memory without cleanup writes", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create()
    const first = yield* user(session.id, "kept question")
    yield* assistant(session.id, first.message.id, "kept answer")
    const target = yield* user(session.id, "visible before revert", "hidden after revert")
    yield* assistant(session.id, target.message.id, "hidden answer")
    yield* sessions.setRevert({
      sessionID: session.id,
      revert: { messageID: target.message.id, partID: target.parts[1].id },
      summary: { additions: 0, deletions: 0, files: 0 },
    })
    const before = yield* sessions.messages({ sessionID: session.id })

    const request = yield* ask(session.id, { question: "current" })

    expect(texts(request.messages)).toEqual([
      { role: "user", text: "kept question" },
      { role: "assistant", text: "kept answer" },
      { role: "user", text: "visible before revert" },
      { role: "user", text: "current" },
    ])
    expect(yield* sessions.messages({ sessionID: session.id })).toEqual(before)
    expect((yield* sessions.get(session.id)).revert).toEqual({
      messageID: target.message.id,
      partID: target.parts[1].id,
    })
  }),
)

it.instance("budgets old main history while preserving compaction context and the latest main turn", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create()
    const stale = yield* user(session.id, "stale small question")
    yield* assistant(session.id, stale.message.id, "stale small answer")
    const old = yield* user(session.id, `old tail ${"x".repeat(10_000)}`)
    yield* assistant(session.id, old.message.id, "old tail answer")
    const compact = yield* sessions.updateMessage({
      id: MessageID.ascending(),
      sessionID: session.id,
      role: "user",
      agent: build.name,
      model: ref,
      time: { created: Date.now() },
    })
    yield* sessions.updatePart({
      id: PartID.ascending(),
      sessionID: session.id,
      messageID: compact.id,
      type: "compaction",
      auto: true,
      tail_start_id: stale.message.id,
    })
    yield* assistant(session.id, compact.id, "compaction summary", true)
    const recent = yield* user(session.id, "recent main question")
    yield* assistant(session.id, recent.message.id, "recent main answer")

    const request = yield* ask(session.id, {
      question: "current",
      turns: [{ question: "side question", answer: "side answer" }],
    })
    const content = texts(request.messages)

    expect(content).toContainEqual({ role: "user", text: "What did we do so far?" })
    expect(content).toContainEqual({ role: "assistant", text: "compaction summary" })
    expect(content).toContainEqual({ role: "user", text: "recent main question" })
    expect(content).toContainEqual({ role: "assistant", text: "recent main answer" })
    expect(content.some((item) => item.text.startsWith("old tail"))).toBe(false)
    expect(content.some((item) => item.text.startsWith("stale small"))).toBe(false)
    expect(content.slice(-3)).toEqual([
      { role: "user", text: "side question" },
      { role: "assistant", text: "side answer" },
      { role: "user", text: "current" },
    ])
  }),
)

it.instance("rejects untrimmed empty input when the service is called directly", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create()
    const service = yield* SessionSideQuestion.Service
    const stream = (question: string, turns?: SessionSideQuestion.Input["turns"]) =>
      service
        .ask({ sessionID: session.id, question, turns, agent: build.name, model: ref })
        .pipe(Stream.runDrain, Effect.exit)

    for (const exit of [
      yield* stream("   "),
      yield* stream("current", [{ question: " ", answer: "answer" }]),
      yield* stream("current", [{ question: "question", answer: "\t" }]),
    ]) {
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBeInstanceOf(Error)
    }
    expect(requests).toHaveLength(0)
  }),
)
