import { LayerNode } from "@slopcode-ai/core/effect/layer-node"
import { Database } from "@slopcode-ai/core/database/database"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { Context, Effect, Layer, Schema } from "effect"
import * as Stream from "effect/Stream"
import { Agent } from "@/agent/agent"
import { Plugin } from "@/plugin"
import { Provider } from "@/provider/provider"
import { LLM } from "./llm"
import { MessageV2 } from "./message-v2"
import { MessageID, SessionID } from "./schema"
import { Session } from "./session"
import { SystemPrompt } from "./system"
import { LLMEvent } from "@slopcode-ai/llm"

const PROMPT = `You are answering a side question in SlopCode.

Rules:
- Answer only from the current conversation context provided here.
- You do not have tool access and cannot inspect files, run commands, or search.
- If the answer is not available from context, say you do not have enough context.
- Keep the answer concise.`

export const Input = Schema.Struct({
  sessionID: SessionID,
  question: Schema.String,
  agent: Schema.String,
  model: Schema.Struct({
    providerID: ProviderV2.ID,
    modelID: ModelV2.ID,
  }),
  variant: Schema.optional(Schema.String),
}).annotate({ identifier: "SessionSideQuestion.Input" })
export type Input = typeof Input.Type

export const Event = Schema.Union([
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
    const llm = yield* LLM.Service
    const database = yield* Database.Service

    const ask: Interface["ask"] = (input) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const question = input.question.trim()
          if (!question) throw new Error("Side question cannot be empty")

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

          const messages = yield* MessageV2.filterCompactedEffect(input.sessionID).pipe(
            Effect.provideService(Database.Service, database),
          )
          yield* plugin.trigger("experimental.chat.messages.transform", {}, { messages })

          const system = [...(yield* sys.environment(model)), PROMPT]
          const modelMessages = yield* MessageV2.toModelMessagesEffect(messages, model)

          return llm
            .stream({
              user,
              agent,
              sessionID: input.sessionID,
              parentSessionID: session.parentID,
              system,
              messages: [...modelMessages, { role: "user", content: question }],
              tools: {},
              toolChoice: "none",
              model,
            })
            .pipe(
              Stream.filter(LLMEvent.is.textDelta),
              Stream.map((event): Event => ({ type: "text", text: event.text })),
            )
        }),
      )

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
  Layer.provide(LLM.defaultLayer),
)

export const node = LayerNode.make(layer, [
  Agent.node,
  Database.node,
  Provider.node,
  Session.node,
  Plugin.node,
  SystemPrompt.node,
  LLM.node,
])

export * as SessionSideQuestion from "./side-question"
