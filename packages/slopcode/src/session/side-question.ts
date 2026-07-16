import { LayerNode } from "@slopcode-ai/core/effect/layer-node"
import { Database } from "@slopcode-ai/core/database/database"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { Location } from "@slopcode-ai/core/location"
import { LocationServiceMap, node as locationServiceMapNode } from "@slopcode-ai/core/location-layer"
import { ModelV2 } from "@slopcode-ai/core/model"
import { PluginBoot } from "@slopcode-ai/core/plugin/boot"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { Reference } from "@slopcode-ai/core/reference"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import type { SessionV1 } from "@slopcode-ai/core/v1/session"
import { Context, Effect, Layer, Option, Schema, SchemaTransformation } from "effect"
import * as Stream from "effect/Stream"
import type { ModelMessage } from "ai"
import { Agent } from "@/agent/agent"
import { Config } from "@/config/config"
import { InstanceState } from "@/effect/instance-state"
import { Permission } from "@/permission"
import { Plugin } from "@/plugin"
import { Provider } from "@/provider/provider"
import { ProviderTransform } from "@/provider/transform"
import { Instruction } from "./instruction"
import { LLM } from "./llm"
import { MessageV2 } from "./message-v2"
import * as SessionOverflow from "./overflow"
import { MessageID, SessionID } from "./schema"
import { Session } from "./session"
import { SystemPrompt } from "./system"
import { LLMEvent } from "@slopcode-ai/llm"
import { SideQuestionReader } from "./side-question-reader"

const PROMPT = `You are answering a side question in SlopCode.

Rules:
- Answer from the current conversation context and private read results provided here.
- You may only read a known workspace-relative text file or a file in a named configured reference.
- Do not guess paths, list directories, search, run commands, mutate files, or request any other tool.
- If the answer is not available and no exact relevant path is known, say you do not have enough context.
- Keep the answer concise.`

export const MAX_ROUNDS = 4
export const MAX_TURNS = 32
export const MAX_TEXT = 64_000

const Text = Schema.String.check(Schema.isMaxLength(MAX_TEXT)).pipe(
  Schema.decodeTo(
    Schema.Trimmed.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_TEXT)),
    SchemaTransformation.trim(),
  ),
)

export const Turn = Schema.Struct({
  question: Text,
  answer: Text,
}).annotate({ identifier: "SessionSideQuestion.Turn" })
export type Turn = typeof Turn.Type

export const Input = Schema.Struct({
  sessionID: SessionID,
  question: Text,
  turns: Schema.optional(Schema.Array(Turn).check(Schema.isMaxLength(MAX_TURNS))),
  agent: Schema.String,
  model: Schema.Struct({
    providerID: ProviderV2.ID,
    modelID: ModelV2.ID,
  }),
  variant: Schema.optional(Schema.String),
}).annotate({ identifier: "SessionSideQuestion.Input" })
export type Input = typeof Input.Type

export const Event = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("status"),
    status: Schema.Literals(["generating", "reading"]),
    round: Schema.Finite,
  }),
  Schema.Struct({
    type: Schema.Literal("read"),
    callID: Schema.String,
    path: Schema.String,
    reference: Schema.optional(Schema.String),
    offset: Schema.Finite,
    limit: Schema.Finite,
    lines: Schema.Finite,
    bytes: Schema.Finite,
    files: Schema.Finite,
  }),
  Schema.Struct({
    type: Schema.Literal("usage"),
    rounds: Schema.Finite,
    calls: Schema.Finite,
    files: Schema.Finite,
    lines: Schema.Finite,
    bytes: Schema.Finite,
    inputTokens: Schema.Finite,
    outputTokens: Schema.Finite,
  }),
  Schema.Struct({ type: Schema.Literal("text"), text: Schema.String }),
  Schema.Struct({ type: Schema.Literal("error"), message: Schema.String }),
  Schema.Struct({ type: Schema.Literal("done") }),
]).annotate({ identifier: "SessionSideQuestion.Event" })
export type Event = typeof Event.Type

export interface Interface {
  readonly ask: (input: Input) => Stream.Stream<Event, unknown>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/SessionSideQuestion") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const agents = yield* Agent.Service
    const provider = yield* Provider.Service
    const sessions = yield* Session.Service
    const plugin = yield* Plugin.Service
    const sys = yield* SystemPrompt.Service
    const instruction = yield* Instruction.Service
    const llm = yield* LLM.Service
    const config = yield* Config.Service
    const database = yield* Database.Service
    const locations = yield* LocationServiceMap
    const fs = yield* FSUtil.Service
    const permission = yield* Permission.Service
    const readerHooks = Option.getOrUndefined(yield* Effect.serviceOption(SideQuestionReader.ReaderHooks))

    const ask: Interface["ask"] = (input) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const question = input.question.trim()
          if (!question) throw new Error("Side question cannot be empty")
          if (question.length > MAX_TEXT) throw new Error(`Side question cannot exceed ${MAX_TEXT} characters`)
          const turns = (input.turns ?? []).map((turn) => ({
            question: turn.question.trim(),
            answer: turn.answer.trim(),
          }))
          if (turns.length > MAX_TURNS) throw new Error(`Side questions cannot include more than ${MAX_TURNS} turns`)
          if (turns.some((turn) => !turn.question || !turn.answer)) {
            throw new Error("Side question turns must include a question and answer")
          }
          if (turns.some((turn) => turn.question.length > MAX_TEXT || turn.answer.length > MAX_TEXT))
            throw new Error(`Side question turn text cannot exceed ${MAX_TEXT} characters`)

          const session = yield* sessions.get(input.sessionID)
          const agent = yield* agents.get(input.agent)
          if (!agent) throw new Error(`Agent not found: "${input.agent}"`)

          const model = yield* provider.getModel(input.model.providerID, input.model.modelID)
          const user = {
            id: MessageID.ascending(),
            role: "user" as const,
            sessionID: input.sessionID,
            time: { created: Date.now() },
            agent: agent.name,
            model: {
              providerID: model.providerID,
              modelID: model.id,
              variant: input.variant,
            },
          }

          const stored = yield* MessageV2.stream(input.sessionID).pipe(
            Effect.provideService(Database.Service, database),
          )
          const revert = session.revert
          const bounded = revert
            ? stored.flatMap((message) => {
                if (message.info.id < revert.messageID) return [message]
                if (message.info.id > revert.messageID || !revert.partID) return []
                const index = message.parts.findIndex((part) => part.id === revert.partID)
                if (index < 0) return [message]
                return [{ info: message.info, parts: message.parts.slice(0, index) }]
              })
            : stored
          const messages = structuredClone(MessageV2.filterCompacted(bounded))
          yield* plugin.trigger("experimental.chat.messages.transform", {}, { messages })

          const goal = session.metadata?.goal
          const constraint =
            goal &&
            typeof goal === "object" &&
            "text" in goal &&
            typeof goal.text === "string" &&
            goal.text.trim() &&
            (!("status" in goal) || goal.status !== "paused")
              ? `<system-reminder>\nCurrent session goal: ${goal.text.trim()}\nUse this as the north star unless the user explicitly changes it.\n</system-reminder>`
              : undefined
          const system = [
            ...(yield* sys.environment(model)),
            ...(yield* instruction.system()),
            ...(constraint ? [constraint] : []),
            PROMPT,
          ]
          const thread = turns.map((turn): ModelMessage[] => [
            { role: "user", content: turn.question },
            { role: "assistant", content: turn.answer },
          ])
          const groups: { messages: SessionV1.WithParts[]; model: ModelMessage[]; summary: boolean }[] = []
          for (const message of messages) {
            const group = message.info.role === "user" || groups.length === 0 ? undefined : groups.at(-1)
            if (group) {
              group.messages.push(message)
              group.summary ||= message.info.role === "assistant" && message.info.summary === true
              continue
            }
            groups.push({
              messages: [message],
              model: [],
              summary: message.info.role === "assistant" && message.info.summary === true,
            })
          }
          yield* Effect.forEach(
            groups,
            Effect.fnUntraced(function* (group) {
              group.model = yield* MessageV2.toModelMessagesEffect(group.messages, model, {
                stripMedia: true,
                toolOutputMaxChars: 2_000,
              })
            }),
            { discard: true },
          )
          const ruleset = Permission.merge(agent.permission, session.permission ?? [])
          const reader = yield* SideQuestionReader.make({
            sessionID: input.sessionID,
            ruleset,
            hooks: readerHooks,
            reference: (name) =>
              Effect.gen(function* () {
                const ctx = yield* InstanceState.context
                const layer = locations.get(Location.Ref.make({ directory: AbsolutePath.make(ctx.directory) }))
                return yield* Effect.gen(function* () {
                  yield* (yield* PluginBoot.Service).wait()
                  return (yield* (yield* Reference.Service).list()).find((item) => item.name === name)?.path
                }).pipe(Effect.provide(layer))
              }),
          }).pipe(Effect.provideService(FSUtil.Service, fs), Effect.provideService(Permission.Service, permission))
          const contextSystem = [...(agent.prompt ? [agent.prompt] : SystemPrompt.provider(model)), ...system]
          const usable =
            model.limit.context === 0
              ? Infinity
              : Math.min(
                  SessionOverflow.usable({ cfg: yield* config.get(), model }),
                  Math.min(
                    model.limit.input ?? Infinity,
                    Math.max(0, model.limit.context - ProviderTransform.maxOutputTokens(model)),
                  ),
                )
          const current: ModelMessage = { role: "user", content: question }
          const size = (value: ModelMessage[]) =>
            LLM.contextTokens({ system: contextSystem, messages: value, tools: reader.tools })
          if (size([current]) > usable)
            return yield* Effect.fail(new Error("Side question exceeds the selected model context limit"))

          const latest = groups.findLastIndex((group) => group.model.length > 0)
          const selected = new Set(
            groups.flatMap((group, index) => (group.summary && group.model.length > 0 ? [index] : [])),
          )
          if (latest >= 0) selected.add(latest)
          const main = () => groups.flatMap((group, index) => (selected.has(index) ? group.model : []))
          const side = [...(thread.at(-1) ?? [])]
          if (size([...main(), ...side, current]) > usable)
            return yield* Effect.fail(new Error("Side question exceeds the selected model context limit"))

          for (let index = thread.length - 2; index >= 0; index--) {
            const candidate = [...main(), ...thread[index]!, ...side, current]
            if (size(candidate) > usable) break
            side.unshift(...thread[index]!)
          }
          for (let index = groups.length - 1; index >= 0; index--) {
            if (selected.has(index)) continue
            const candidate = groups.flatMap((group, current) =>
              selected.has(current) || current === index ? group.model : [],
            )
            if (size([...candidate, ...side, current]) > usable) break
            selected.add(index)
          }
          const modelMessages = main()
          const usage = { inputTokens: 0, outputTokens: 0 }
          let emitted = 0
          const ids = new Set<string>()
          const initial: ModelMessage[] = [...modelMessages, ...side, current]
          const run = (messages: ModelMessage[], round: number): Stream.Stream<Event, unknown> => {
            if (size(messages) > usable)
              return Stream.fail(new Error("Side question exceeds the selected model context limit"))
            const calls: Extract<LLMEvent, { type: "tool-call" }>[] = []
            const results = new Map<
              string,
              { type: "success"; value: SideQuestionReader.Result } | { type: "error"; message: string }
            >()
            const errors = new Set<string>()
            const paired = new Set<string>()
            const stream = llm
              .stream({
                user,
                agent,
                sessionID: input.sessionID,
                parentSessionID: session.parentID,
                system,
                messages,
                tools: reader.tools,
                toolChoice: "auto",
                permission: [{ permission: "read", pattern: "*", action: "allow" }],
                model,
                runtime: "side",
                ...(usable === Infinity ? {} : { maxInputTokens: usable }),
              })
              .pipe(
                Stream.tap((event) =>
                  Effect.sync(() => {
                    if (event.type === "finish") {
                      usage.inputTokens += event.usage?.inputTokens ?? 0
                      usage.outputTokens += event.usage?.outputTokens ?? 0
                    }
                  }),
                ),
                Stream.flatMap((event): Stream.Stream<Event, unknown> => {
                  if (event.type === "text-delta") return Stream.make({ type: "text", text: event.text })
                  if (event.type === "tool-call") {
                    if (event.name !== "read") return Stream.fail(new Error(`Unexpected side tool call: ${event.name}`))
                    if (event.providerExecuted)
                      return Stream.fail(new Error("Provider-executed side reads are not allowed"))
                    if (emitted >= SideQuestionReader.MAX_CALLS)
                      return Stream.fail(
                        new Error(`Side question tool-call limit reached (${SideQuestionReader.MAX_CALLS})`),
                      )
                    if (ids.has(event.id)) return Stream.fail(new Error(`Duplicate side read call ID: ${event.id}`))
                    emitted += 1
                    ids.add(event.id)
                    calls.push(event)
                    return Stream.make({ type: "status", status: "reading", round })
                  }
                  if (event.type === "tool-result") {
                    if (event.providerExecuted)
                      return Stream.fail(new Error("Provider-executed side reads are not allowed"))
                    const call = calls.find((item) => item.id === event.id)
                    if (!call || call.name !== event.name)
                      return Stream.fail(new Error(`Unmatched side read result: ${event.id}`))
                    const settled = results.get(event.id)
                    if (settled) {
                      if (
                        settled.type !== "error" ||
                        event.result.type !== "error" ||
                        !errors.has(event.id) ||
                        paired.has(event.id) ||
                        String(event.result.value) !== settled.message
                      )
                        return Stream.fail(new Error(`Duplicate side read result: ${event.id}`))
                      paired.add(event.id)
                      return Stream.empty
                    }
                    if (event.result.type === "error") {
                      const failure = reader.consumeError(event.id, call.input)
                      if (!failure) return Stream.fail(new Error("Side read returned an untrusted error"))
                      results.set(event.id, { type: "error", message: failure })
                      return Stream.empty
                    }
                    const value = reader.consume(event.id, call.input, event.result.value)
                    if (!value) return Stream.fail(new Error("Side read returned an untrusted result"))
                    results.set(event.id, { type: "success", value })
                    return Stream.make({ type: "read", ...value.metadata.sideRead })
                  }
                  if (event.type === "tool-error") {
                    const call = calls.find((item) => item.id === event.id)
                    if (!call || call.name !== event.name)
                      return Stream.fail(new Error(`Unmatched side read error: ${event.id}`))
                    if (results.has(event.id)) return Stream.fail(new Error(`Duplicate side read result: ${event.id}`))
                    const failure = reader.consumeError(event.id, call.input)
                    if (!failure) return Stream.fail(new Error("Side read returned an untrusted error"))
                    if (event.message !== failure)
                      return Stream.fail(new Error("Side read returned an untrusted error"))
                    results.set(event.id, { type: "error", message: failure })
                    errors.add(event.id)
                    return Stream.empty
                  }
                  if (event.type === "provider-error") return Stream.fail(new Error(event.message))
                  return Stream.empty
                }),
              )
            const next = Stream.unwrap(
              Effect.sync(() => {
                const read = reader.usage()
                const summary: Event = {
                  type: "usage",
                  rounds: round,
                  calls: emitted,
                  files: read.files,
                  lines: read.lines,
                  bytes: read.bytes,
                  inputTokens: usage.inputTokens,
                  outputTokens: usage.outputTokens,
                }
                if (calls.length === 0) return Stream.make(summary)
                if (results.size !== calls.length)
                  return Stream.concat(
                    Stream.make(summary),
                    Stream.fail(new Error("Side read did not return a correlated result")),
                  )
                if (round >= MAX_ROUNDS)
                  return Stream.concat(
                    Stream.make(summary),
                    Stream.fail(new Error(`Side question provider round limit reached (${MAX_ROUNDS})`)),
                  )
                const assistant: ModelMessage = {
                  role: "assistant",
                  content: calls.map((call) => ({
                    type: "tool-call" as const,
                    toolCallId: call.id,
                    toolName: call.name,
                    input: call.input,
                  })),
                }
                const tool: ModelMessage = {
                  role: "tool",
                  content: calls.map((call) => {
                    const result = results.get(call.id)
                    if (!result || result.type === "error") {
                      return {
                        type: "tool-result" as const,
                        toolCallId: call.id,
                        toolName: call.name,
                        output: {
                          type: "error-text" as const,
                          value: result?.message ?? "Read did not return a correlated result",
                        },
                      }
                    }
                    return {
                      type: "tool-result" as const,
                      toolCallId: call.id,
                      toolName: call.name,
                      output: { type: "json" as const, value: result.value as never },
                    }
                  }),
                }
                return Stream.concat(
                  Stream.make(summary, { type: "status", status: "generating", round: round + 1 }),
                  run([...messages, assistant, tool], round + 1),
                )
              }),
            )
            return Stream.concat(stream, next)
          }

          return run(initial, 1)
        }),
      ).pipe(Stream.prepend([{ type: "status", status: "generating", round: 1 } satisfies Event]), Stream.scoped)

    return Service.of({ ask })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(Agent.defaultLayer),
  Layer.provide(Database.defaultLayer),
  Layer.provide(Provider.defaultLayer),
  Layer.provide(Session.defaultLayer),
  Layer.provide(Plugin.defaultLayer),
  Layer.provide(SystemPrompt.defaultLayer),
  Layer.provide(Instruction.defaultLayer),
  Layer.provide(LLM.defaultLayer),
  Layer.provide(Config.defaultLayer),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Permission.defaultLayer),
  Layer.provide(LocationServiceMap.layer),
)

export const node = LayerNode.make(layer, [
  Agent.node,
  Database.node,
  Provider.node,
  Session.node,
  Plugin.node,
  SystemPrompt.node,
  Instruction.node,
  LLM.node,
  Config.node,
  FSUtil.node,
  Permission.node,
  locationServiceMapNode,
])

export * as SessionSideQuestion from "./side-question"
