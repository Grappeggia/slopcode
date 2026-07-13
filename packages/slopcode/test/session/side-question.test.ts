import { beforeEach, describe, expect, test } from "bun:test"
import { Database } from "@slopcode-ai/core/database/database"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import type { ModelMessage } from "ai"
import path from "path"
import { Cause, Deferred, Effect, Exit, Fiber, Layer, Schema } from "effect"
import * as Stream from "effect/Stream"
import { Agent } from "../../src/agent/agent"
import { Instruction } from "../../src/session/instruction"
import { LLM } from "../../src/session/llm"
import { MessageID, PartID, SessionID } from "../../src/session/schema"
import { Session } from "../../src/session/session"
import { SessionSideQuestion } from "../../src/session/side-question"
import { SideQuestionReader } from "../../src/session/side-question-reader"
import { SystemPrompt } from "../../src/session/system"
import { Plugin } from "../../src/plugin"
import { Permission } from "../../src/permission"
import { ProviderTest } from "../fake/provider"
import { TestConfig } from "../fixture/config"
import { testEffect } from "../lib/effect"
import { LLMEvent, ToolResultValue, Usage } from "@slopcode-ai/llm"
import type { ToolExecutionOptions } from "ai"
import { Token } from "../../src/util/token"

const ref = {
  providerID: ProviderV2.ID.make("test"),
  modelID: ModelV2.ID.make("test-model"),
}

const model = ProviderTest.model({
  id: ref.modelID,
  providerID: ref.providerID,
  api: { id: ref.modelID, url: "https://example.com", npm: "@ai-sdk/openai" },
  limit: { context: 4_000, output: 500 },
})

const MAX_SIDE_TURNS = 32
const MAX_SIDE_TEXT = 64_000

const build = {
  name: "build",
  mode: "primary",
  permission: [],
  options: {},
} satisfies Agent.Info

const requests: LLM.StreamInput[] = []
const hooks: string[] = []
let respond = (_input: LLM.StreamInput): Stream.Stream<LLMEvent, unknown> => Stream.empty
let beforeRead = (_callID: string): Effect.Effect<void> => Effect.void
let released = (_input: { callID: string; fd: number; identity: string }): Effect.Effect<void> => Effect.void

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
      return respond(input)
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

const readerHooks = Layer.succeed(
  SideQuestionReader.ReaderHooks,
  SideQuestionReader.ReaderHooks.of({
    beforeRead: (callID) => beforeRead(callID),
    released: (input) => released(input),
  }),
)

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
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Permission.defaultLayer),
  Layer.provide(LocationServiceMap.layer),
  Layer.provide(readerHooks),
)
const it = testEffect(Layer.mergeAll(Session.defaultLayer, Database.defaultLayer, side))

beforeEach(() => {
  requests.length = 0
  hooks.length = 0
  respond = () => Stream.empty
  beforeRead = () => Effect.void
  released = () => Effect.void
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

  test("bounds client-carried turn count and text sizes", () => {
    const base = { sessionID: SessionID.make("ses_test"), agent: "build", model: ref }
    expect(() => decode({ ...base, question: "x".repeat(MAX_SIDE_TEXT + 1) })).toThrow()
    expect(() =>
      decode({
        ...base,
        question: "current",
        turns: [{ question: "question", answer: "x".repeat(MAX_SIDE_TEXT + 1) }],
      }),
    ).toThrow()
    expect(() =>
      decode({
        ...base,
        question: "current",
        turns: Array.from({ length: MAX_SIDE_TURNS + 1 }, (_, index) => ({
          question: `question ${index}`,
          answer: `answer ${index}`,
        })),
      }),
    ).toThrow()
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
    expect(Object.keys(request.tools)).toEqual(["read"])
    expect(request.toolChoice).toBe("auto")
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

it.instance("drops older client turns before newer turns when the selected model context is small", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create()
    const first = yield* user(session.id, `old main ${"m".repeat(4_000)}`)
    yield* assistant(session.id, first.message.id, "old main answer")
    const turns = Array.from({ length: 6 }, (_, index) => ({
      question: `side question ${index} ${"q".repeat(500)}`,
      answer: `side answer ${index} ${"a".repeat(500)}`,
    }))

    const request = yield* ask(session.id, { question: "mandatory current question", turns })
    const content = texts(request.messages)

    expect(content.at(-1)).toEqual({ role: "user", text: "mandatory current question" })
    expect(content.some((item) => item.text.startsWith("side question 5"))).toBe(true)
    expect(content.some((item) => item.text.startsWith("side question 0"))).toBe(false)
    expect(content.some((item) => item.text.startsWith("old main"))).toBe(false)
    expect(Token.estimate(JSON.stringify([...request.system, ...request.messages]))).toBeLessThan(model.limit.context)
  }),
)

it.instance("fails before provider execution when mandatory side content cannot fit", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create()
    const service = yield* SessionSideQuestion.Service

    const result = yield* service
      .ask({ sessionID: session.id, question: "x".repeat(10_000), agent: build.name, model: ref })
      .pipe(Stream.runDrain, Effect.exit)

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) expect(String(Cause.squash(result.cause))).toMatch(/selected model context limit/i)
    expect(requests).toHaveLength(0)
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

it.instance("continues private read calls transiently and reports bounded usage without persistence", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create({
      permission: [{ permission: "read", pattern: "notes.txt", action: "allow" }],
    })
    const first = yield* user(session.id, "main question")
    yield* assistant(session.id, first.message.id, "main answer")
    const before = yield* sessions.get(session.id)
    const messages = yield* sessions.messages({ sessionID: session.id })
    yield* Effect.promise(() => Bun.write(path.join(before.directory, "notes.txt"), "private context"))
    let closed = 0
    released = () =>
      Effect.sync(() => {
        closed += 1
      })

    respond = (input) => {
      if (requests.length > 1) {
        return Stream.fromIterable([
          LLMEvent.textDelta({ id: "answer", text: "final side answer" }),
          LLMEvent.finish({ reason: "stop", usage: new Usage({ inputTokens: 5, outputTokens: 3 }) }),
        ])
      }
      const execute = input.tools.read?.execute
      if (!execute) return Stream.fail(new Error("private read tool missing"))
      return Stream.unwrap(
        Effect.promise(async () => {
          const result = await execute({ path: "notes.txt", offset: 1, limit: 10 }, {
            toolCallId: "read_1",
            messages: input.messages,
            abortSignal: new AbortController().signal,
          } as ToolExecutionOptions)
          return Stream.fromIterable([
            LLMEvent.toolCall({ id: "read_1", name: "read", input: { path: "notes.txt", offset: 1, limit: 10 } }),
            LLMEvent.toolResult({
              id: "read_1",
              name: "read",
              result: ToolResultValue.make(result),
            }),
            LLMEvent.finish({ reason: "tool-calls", usage: new Usage({ inputTokens: 7, outputTokens: 2 }) }),
          ])
        }),
      )
    }

    const service = yield* SessionSideQuestion.Service
    const events = yield* service
      .ask({ sessionID: session.id, question: "read the notes", agent: build.name, model: ref })
      .pipe(Stream.runCollect)
    const list = Array.from(events)

    expect(requests).toHaveLength(2)
    expect(Object.keys(requests[0]!.tools)).toEqual(["read"])
    expect(requests[0]!.toolChoice).toBe("auto")
    expect(requests[0]!.permission).toEqual([{ permission: "read", pattern: "*", action: "allow" }])
    expect(requests[1]!.messages.at(-2)).toMatchObject({
      role: "assistant",
      content: [expect.objectContaining({ type: "tool-call", toolName: "read", toolCallId: "read_1" })],
    })
    expect(requests[1]!.messages.at(-1)).toMatchObject({
      role: "tool",
      content: [expect.objectContaining({ type: "tool-result", toolName: "read", toolCallId: "read_1" })],
    })
    expect(list[0]).toEqual({ type: "status", status: "generating", round: 1 })
    expect(list).toContainEqual(expect.objectContaining({ type: "status", status: "reading", round: 1 }))
    expect(list).toContainEqual(
      expect.objectContaining({ type: "read", path: "notes.txt", lines: 1, files: 1, callID: "read_1" }),
    )
    expect(list).toContainEqual(
      expect.objectContaining({ type: "usage", rounds: 2, calls: 1, files: 1, inputTokens: 12, outputTokens: 5 }),
    )
    expect(list).toContainEqual({ type: "text", text: "final side answer" })
    expect(closed).toBe(1)
    expect(hooks.filter((name) => name.startsWith("tool."))).toEqual([])
    expect(yield* sessions.messages({ sessionID: session.id })).toEqual(messages)
    expect(yield* sessions.get(session.id)).toEqual(before)
  }),
)

it.instance("rejects a maximum read continuation before a small-context provider request", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create({
      permission: [{ permission: "read", pattern: "large.txt", action: "allow" }],
    })
    yield* Effect.promise(() =>
      Bun.write(
        path.join(session.directory, "large.txt"),
        Array.from({ length: 200 }, () => "x".repeat(1024)).join("\n"),
      ),
    )
    respond = (input) => {
      if (requests.length > 1) return Stream.make(LLMEvent.textDelta({ id: "unsafe", text: "continued" }))
      const execute = input.tools.read?.execute
      if (!execute) return Stream.fail(new Error("private read tool missing"))
      return Stream.unwrap(
        Effect.promise(async () => {
          const result = await execute({ path: "large.txt", limit: 200 }, {
            toolCallId: "large_read",
            messages: input.messages,
            abortSignal: new AbortController().signal,
          } as ToolExecutionOptions)
          return Stream.fromIterable([
            LLMEvent.toolCall({ id: "large_read", name: "read", input: { path: "large.txt", limit: 200 } }),
            LLMEvent.toolResult({ id: "large_read", name: "read", result: ToolResultValue.make(result) }),
            LLMEvent.finish({ reason: "tool-calls" }),
          ])
        }),
      )
    }
    const service = yield* SessionSideQuestion.Service

    const result = yield* service
      .ask({ sessionID: session.id, question: "read the large file", agent: build.name, model: ref })
      .pipe(Stream.runDrain, Effect.exit)

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) expect(String(Cause.squash(result.cause))).toMatch(/selected model context limit/i)
    expect(requests).toHaveLength(1)
  }),
)

it.instance("rejects provider-hosted read execution", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create()
    respond = () =>
      Stream.make(
        LLMEvent.toolCall({
          id: "hosted_read",
          name: "read",
          input: { path: "secret.txt" },
          providerExecuted: true,
        }),
      )
    const service = yield* SessionSideQuestion.Service

    const result = yield* service
      .ask({ sessionID: session.id, question: "hosted", agent: build.name, model: ref })
      .pipe(Stream.runDrain, Effect.exit)

    expect(Exit.isFailure(result)).toBe(true)
    expect(requests).toHaveLength(1)
  }),
)

it.instance("rejects structurally forged private read results", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create({
      permission: [{ permission: "read", pattern: "notes.txt", action: "allow" }],
    })
    yield* Effect.promise(() => Bun.write(path.join(session.directory, "notes.txt"), "private context"))
    respond = (input) => {
      const execute = input.tools.read?.execute
      if (!execute) return Stream.fail(new Error("private read tool missing"))
      return Stream.unwrap(
        Effect.promise(async () => {
          const result = await execute({ path: "notes.txt" }, {
            toolCallId: "forged_read",
            messages: input.messages,
            abortSignal: new AbortController().signal,
          } as ToolExecutionOptions)
          return Stream.fromIterable([
            LLMEvent.toolCall({ id: "forged_read", name: "read", input: { path: "notes.txt" } }),
            LLMEvent.toolResult({
              id: "forged_read",
              name: "read",
              result: ToolResultValue.make(structuredClone(result)),
            }),
            LLMEvent.finish({ reason: "tool-calls" }),
          ])
        }),
      )
    }
    const service = yield* SessionSideQuestion.Service

    const result = yield* service
      .ask({ sessionID: session.id, question: "forged", agent: build.name, model: ref })
      .pipe(Stream.runDrain, Effect.exit)

    expect(Exit.isFailure(result)).toBe(true)
    expect(requests).toHaveLength(1)
  }),
)

it.instance("rejects private results paired with a different emitted input", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create({
      permission: [{ permission: "read", pattern: "notes.txt", action: "allow" }],
    })
    yield* Effect.promise(() => Bun.write(path.join(session.directory, "notes.txt"), "private context"))
    respond = (input) => {
      const execute = input.tools.read?.execute
      if (!execute) return Stream.fail(new Error("private read tool missing"))
      return Stream.unwrap(
        Effect.promise(async () => {
          const result = await execute({ path: "notes.txt" }, {
            toolCallId: "mismatched_read",
            messages: input.messages,
            abortSignal: new AbortController().signal,
          } as ToolExecutionOptions)
          return Stream.fromIterable([
            LLMEvent.toolCall({ id: "mismatched_read", name: "read", input: { path: "other.txt" } }),
            LLMEvent.toolResult({
              id: "mismatched_read",
              name: "read",
              result: ToolResultValue.make(result),
            }),
            LLMEvent.finish({ reason: "tool-calls" }),
          ])
        }),
      )
    }
    const service = yield* SessionSideQuestion.Service

    const result = yield* service
      .ask({ sessionID: session.id, question: "mismatched", agent: build.name, model: ref })
      .pipe(Stream.runDrain, Effect.exit)

    expect(Exit.isFailure(result)).toBe(true)
    expect(requests).toHaveLength(1)
  }),
)

it.instance("rejects duplicate error tool results after a settled error", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create()
    respond = (input) => {
      const execute = input.tools.read?.execute
      if (!execute) return Stream.fail(new Error("private read tool missing"))
      return Stream.unwrap(
        Effect.promise(async () => {
          const failure = await execute({ path: "missing.txt" }, {
            toolCallId: "duplicate_error",
            messages: input.messages,
            abortSignal: new AbortController().signal,
          } as ToolExecutionOptions).then(
            () => "read unexpectedly succeeded",
            (error: unknown) => (error instanceof Error ? error.message : String(error)),
          )
          return Stream.fromIterable([
            LLMEvent.toolCall({ id: "duplicate_error", name: "read", input: { path: "missing.txt" } }),
            LLMEvent.toolError({ id: "duplicate_error", name: "read", message: failure }),
            LLMEvent.toolResult({
              id: "duplicate_error",
              name: "read",
              result: ToolResultValue.make(failure, "error"),
            }),
            LLMEvent.finish({ reason: "tool-calls" }),
          ])
        }),
      )
    }
    const service = yield* SessionSideQuestion.Service

    const result = yield* service
      .ask({ sessionID: session.id, question: "duplicate", agent: build.name, model: ref })
      .pipe(Stream.runDrain, Effect.exit)

    expect(Exit.isFailure(result)).toBe(true)
    expect(requests).toHaveLength(1)
  }),
)

it.instance("rejects error tool results paired with a different emitted input", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create()
    respond = (input) => {
      const execute = input.tools.read?.execute
      if (!execute) return Stream.fail(new Error("private read tool missing"))
      return Stream.unwrap(
        Effect.promise(async () => {
          const failure = await execute({ path: "missing.txt" }, {
            toolCallId: "mismatched_error",
            messages: input.messages,
            abortSignal: new AbortController().signal,
          } as ToolExecutionOptions).then(
            () => "read unexpectedly succeeded",
            (error: unknown) => (error instanceof Error ? error.message : String(error)),
          )
          return Stream.fromIterable([
            LLMEvent.toolCall({ id: "mismatched_error", name: "read", input: { path: "different.txt" } }),
            LLMEvent.toolResult({
              id: "mismatched_error",
              name: "read",
              result: ToolResultValue.make(failure, "error"),
            }),
            LLMEvent.finish({ reason: "tool-calls" }),
          ])
        }),
      )
    }
    const service = yield* SessionSideQuestion.Service

    const result = yield* service
      .ask({ sessionID: session.id, question: "mismatch", agent: build.name, model: ref })
      .pipe(Stream.runDrain, Effect.exit)

    expect(Exit.isFailure(result)).toBe(true)
    expect(requests).toHaveLength(1)
  }),
)

it.instance("rejects more than the total private tool-call budget in one round", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create()
    respond = () =>
      Stream.fromIterable(
        Array.from({ length: SideQuestionReader.MAX_CALLS + 1 }, (_, index) =>
          LLMEvent.toolCall({ id: `read_${index}`, name: "read", input: { path: "missing.txt" } }),
        ),
      )
    const service = yield* SessionSideQuestion.Service

    const result = yield* service
      .ask({ sessionID: session.id, question: "many", agent: build.name, model: ref })
      .pipe(Stream.runDrain, Effect.exit)

    expect(Exit.isFailure(result)).toBe(true)
    expect(requests).toHaveLength(1)
  }),
)

it.instance("stops provider continuation at the configured round limit", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create()
    respond = (input) => {
      const id = `read_${requests.length}`
      const execute = input.tools.read?.execute
      if (!execute) return Stream.fail(new Error("private read tool missing"))
      return Stream.unwrap(
        Effect.promise(async () => {
          const failure = await execute({ path: "missing.txt" }, {
            toolCallId: id,
            messages: input.messages,
            abortSignal: new AbortController().signal,
          } as ToolExecutionOptions).then(
            () => "read unexpectedly succeeded",
            (error: unknown) => (error instanceof Error ? error.message : String(error)),
          )
          return Stream.fromIterable([
            LLMEvent.toolCall({ id, name: "read", input: { path: "missing.txt" } }),
            LLMEvent.toolError({ id, name: "read", message: failure }),
            LLMEvent.finish({ reason: "tool-calls" }),
          ])
        }),
      )
    }
    const service = yield* SessionSideQuestion.Service

    const result = yield* service
      .ask({ sessionID: session.id, question: "loop", agent: build.name, model: ref })
      .pipe(Stream.runDrain, Effect.exit)

    expect(Exit.isFailure(result)).toBe(true)
    expect(requests).toHaveLength(SessionSideQuestion.MAX_ROUNDS)
  }),
)

it.instance("interrupts provider work when the side stream is interrupted", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create()
    const started = yield* Deferred.make<void>()
    const stopped = yield* Deferred.make<void>()
    respond = () =>
      Stream.fromEffectDrain(Deferred.succeed(started, undefined)).pipe(
        Stream.concat(Stream.never),
        Stream.ensuring(Deferred.succeed(stopped, undefined)),
      )
    const service = yield* SessionSideQuestion.Service
    const fiber = yield* service
      .ask({ sessionID: session.id, question: "wait", agent: build.name, model: ref })
      .pipe(Stream.runDrain, Effect.forkChild)

    yield* Deferred.await(started)
    yield* Fiber.interrupt(fiber)
    yield* Deferred.await(stopped)
    expect(requests).toHaveLength(1)
  }),
)

it.instance("interrupts an in-flight private read when the side stream is interrupted", () =>
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create({
      permission: [{ permission: "read", pattern: "slow.txt", action: "allow" }],
    })
    yield* Effect.promise(() => Bun.write(path.join(session.directory, "slow.txt"), "slow"))
    const started = yield* Deferred.make<void>()
    const stopped = yield* Deferred.make<void>()
    let closed = false
    released = () =>
      Effect.sync(() => {
        closed = true
      })
    beforeRead = () =>
      Deferred.succeed(started, undefined).pipe(
        Effect.andThen(Effect.never),
        Effect.onInterrupt(() => Deferred.succeed(stopped, undefined)),
      )
    respond = (input) =>
      Stream.scoped(
        Stream.unwrap(
          Effect.gen(function* () {
            const ctrl = yield* Effect.acquireRelease(
              Effect.sync(() => new AbortController()),
              (ctrl) => Effect.sync(() => ctrl.abort()),
            )
            const execute = input.tools.read?.execute
            if (!execute) return Stream.fail(new Error("private read tool missing"))
            return Stream.unwrap(
              Effect.promise(async () => {
                await execute({ path: "slow.txt" }, {
                  toolCallId: "slow_read",
                  messages: input.messages,
                  abortSignal: ctrl.signal,
                } as ToolExecutionOptions)
                return Stream.empty
              }),
            )
          }),
        ),
      )
    const service = yield* SessionSideQuestion.Service
    const fiber = yield* service
      .ask({ sessionID: session.id, question: "slow", agent: build.name, model: ref })
      .pipe(Stream.runDrain, Effect.forkChild)

    yield* Deferred.await(started)
    yield* Fiber.interrupt(fiber)
    yield* Deferred.await(stopped)
    expect(requests).toHaveLength(1)
    expect(closed).toBe(true)
  }),
)
