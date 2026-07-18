import { LayerNode } from "@slopcode-ai/core/effect/layer-node"
import { llmClient } from "@slopcode-ai/core/effect/layer-node-platform"
import { PermissionV1 } from "@slopcode-ai/core/v1/permission"
import { Provider } from "@/provider/provider"
import { SessionV1 } from "@slopcode-ai/core/v1/session"
import { serviceUse } from "@slopcode-ai/core/effect/service-use"
import { Context, Effect, Layer } from "effect"
import * as Stream from "effect/Stream"
import { streamText, wrapLanguageModel, type ModelMessage, type Tool } from "ai"
import type { LLMEvent } from "@slopcode-ai/llm"
import { LLMClient, RequestExecutor, WebSocketExecutor } from "@slopcode-ai/llm/route"
import type { LLMClientService } from "@slopcode-ai/llm/route"
import { GitLabWorkflowLanguageModel } from "gitlab-ai-provider"
import { ProviderTransform } from "@/provider/transform"
import { Config } from "@/config/config"
import type { Agent } from "@/agent/agent"
import type { MessageV2 } from "./message-v2"
import { Plugin } from "@/plugin"
import { Permission } from "@/permission"
import { EventV2Bridge } from "@/event-v2-bridge"
import { EventV2 } from "@slopcode-ai/core/event"
import { Wildcard } from "@/util/wildcard"
import { SessionID } from "@/session/schema"
import { Auth } from "@/auth"
import { EffectBridge } from "@/effect/bridge"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { Account } from "@/account/account"
import { SafetyIdentity } from "@slopcode-ai/core/safety-identity"
import * as Option from "effect/Option"
import * as OtelTracer from "@effect/opentelemetry/Tracer"
import { LLMAISDK } from "./llm/ai-sdk"
import { LLMNativeRuntime } from "./llm/native-runtime"
import { LLMRequestPrep } from "./llm/request"

export const OUTPUT_TOKEN_MAX = ProviderTransform.OUTPUT_TOKEN_MAX

const GPT5_6 = new Set(["gpt-5.6", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"])
const OFFICIAL = {
  openai: "https://api.openai.com/v1",
  slopcode: "https://www.slopcode.dev/zen/v1",
  "slopcode-go": "https://www.slopcode.dev/zen/go/v1",
} as const

const eligibleRoute = (model: Provider.Model, auth?: Auth.Info, provider?: Provider.Info) => {
  const target = OFFICIAL[model.providerID as keyof typeof OFFICIAL]
  if (!target || auth?.type === "oauth" || !GPT5_6.has(model.api.id.toLowerCase())) return false
  if (model.api.npm !== "@ai-sdk/openai") return false
  try {
    const url = new URL(
      typeof provider?.options.baseURL === "string" && provider.options.baseURL
        ? provider.options.baseURL
        : model.api.url,
    )
    if (url.username || url.password || url.search || url.hash || url.port) return false
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}` === target
  } catch {
    return false
  }
}

const cacheHint = (messages: readonly ModelMessage[]) =>
  messages.some(
    (message) =>
      (message.role === "system" || message.role === "user") &&
      Array.isArray(message.content) &&
      message.content.some(
        (part) =>
          !!part &&
          typeof part === "object" &&
          part.type === "text" &&
          "cache" in part &&
          !!part.cache &&
          typeof part.cache === "object" &&
          "type" in part.cache &&
          part.cache.type === "ephemeral" &&
          "ttlSeconds" in part.cache &&
          part.cache.ttlSeconds === 1800,
      ),
  )

export function sanitizeMessages(input: {
  model: Provider.Model
  auth?: Auth.Info
  provider?: Provider.Info
  messages: ModelMessage[]
}) {
  const openAI56 =
    Object.hasOwn(OFFICIAL, input.model.providerID) &&
    input.model.api.npm === "@ai-sdk/openai" &&
    GPT5_6.has(input.model.api.id.toLowerCase())
  if (!openAI56 || eligibleRoute(input.model, input.auth, input.provider)) return input.messages
  return input.messages.map((message): ModelMessage => {
    if (!Array.isArray(message.content)) return message
    if (message.role === "system")
      return {
        ...message,
        content: message.content
          .filter((part) => part && typeof part === "object" && part.type === "text")
          .map((part) => part.text)
          .join("\n"),
      } as ModelMessage
    return {
      ...message,
      content: message.content.map((part) => {
        if (!part || typeof part !== "object" || !("cache" in part)) return part
        const { cache: _, ...clean } = part
        return clean
      }),
    } as ModelMessage
  })
}

export function sanitizeOptions(input: {
  model: Provider.Model
  auth?: Auth.Info
  provider?: Provider.Info
  options: Record<string, any>
  safetyIdentifier?: string
  cacheHint: boolean
}) {
  const eligible = eligibleRoute(input.model, input.auth, input.provider)
  const options = Object.fromEntries(
    Object.entries(input.options).filter(([key]) => key !== "safetyIdentifier" && key !== "promptCacheOptions"),
  )
  if (eligible && input.cacheHint) options.promptCacheOptions = { mode: "explicit", ttl: "30m" }
  if (eligible && input.safetyIdentifier) options.safetyIdentifier = input.safetyIdentifier
  return options
}

export type StreamInput = {
  user: SessionV1.User
  sessionID: string
  parentSessionID?: string
  model: Provider.Model
  agent: Agent.Info
  permission?: PermissionV1.Ruleset
  system: string[]
  messages: ModelMessage[]
  small?: boolean
  tools: Record<string, Tool>
  retries?: number
  toolChoice?: "auto" | "required" | "none"
  runtime?: "side"
  maxInputTokens?: number
}

export type StreamRequest = StreamInput & {
  abort: AbortSignal
}

export interface Interface {
  readonly stream: (input: StreamInput) => Stream.Stream<LLMEvent, unknown>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/LLM") {}

export const use = serviceUse(Service)

export function contextTokens(input: { system: string[]; messages: ModelMessage[]; tools: Record<string, Tool> }) {
  const system = input.messages.some((message) => message.role === "system") ? [] : input.system
  const tools = Object.entries(input.tools).map(([name, item]) => ({
    name,
    description: item.description,
    inputSchema:
      item.inputSchema && typeof item.inputSchema === "object" && "jsonSchema" in item.inputSchema
        ? item.inputSchema.jsonSchema
        : item.inputSchema,
  }))
  return (
    Buffer.byteLength(JSON.stringify({ system, messages: input.messages, tools })) +
    256 +
    input.messages.length * 16 +
    tools.length * 32
  )
}

const live: Layer.Layer<
  Service,
  never,
  | Auth.Service
  | Config.Service
  | Provider.Service
  | Plugin.Service
  | Permission.Service
  | EventV2Bridge.Service
  | LLMClientService
  | RuntimeFlags.Service
  | Account.Service
  | SafetyIdentity.Service
> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const auth = yield* Auth.Service
    const config = yield* Config.Service
    const provider = yield* Provider.Service
    const plugin = yield* Plugin.Service
    const perm = yield* Permission.Service
    const events = yield* EventV2Bridge.Service
    const llmClient = yield* LLMClient.Service
    const flags = yield* RuntimeFlags.Service
    const account = yield* Account.Service
    const safety = yield* SafetyIdentity.Service

    const run = Effect.fn("LLM.run")(function* (input: StreamRequest) {
      yield* Effect.logInfo("stream", {
        providerID: input.model.providerID,
        modelID: input.model.id,
        "session.id": input.sessionID,
        small: (input.small ?? false).toString(),
        agent: input.agent.name,
        mode: input.agent.mode,
      })

      if (input.runtime === "side") {
        const tools = Object.keys(input.tools)
        if (tools.length !== 1 || tools[0] !== "read" || !input.tools.read?.execute || input.toolChoice !== "auto")
          return yield* Effect.fail(new Error("Side questions require exactly one executable private read tool"))
      }

      const [language, cfg, item, info] = yield* Effect.all(
        [
          provider.getLanguage(input.model),
          config.get(),
          provider.getProvider(input.model.providerID),
          auth.get(input.model.providerID),
        ],
        { concurrency: "unbounded" },
      )

      const isWorkflow = language instanceof GitLabWorkflowLanguageModel
      if (input.runtime === "side" && isWorkflow)
        return yield* Effect.fail(
          new Error(
            "Side questions are unavailable for GitLab workflow models because private local reads cannot be isolated",
          ),
        )
      const prepared = yield* LLMRequestPrep.prepare({
        ...input,
        provider: item,
        auth: info,
        plugin,
        flags,
        isWorkflow,
      })
      const eligible = eligibleRoute(input.model, info, item)
      const messages = sanitizeMessages({ model: input.model, auth: info, provider: item, messages: prepared.messages })
      const active = eligible
        ? Option.getOrUndefined(yield* account.active().pipe(Effect.catch(() => Effect.succeed(Option.none()))))
        : undefined
      const hint = cacheHint(messages)
      const options = sanitizeOptions({
        model: input.model,
        auth: info,
        provider: item,
        options: prepared.params.options,
        cacheHint: hint,
        safetyIdentifier: eligible
          ? safety.identifier({
              account: active?.id,
              openai: info?.type === "oauth" ? info.accountId : undefined,
            })
          : undefined,
      })
      const headers = Object.fromEntries(
        Object.entries(prepared.headers).filter(([key]) => key.toLowerCase() !== "x-slopcode-openai-cache-breakpoints"),
      )
      if (input.runtime === "side") {
        const hard =
          input.model.limit.context === 0
            ? Infinity
            : Math.min(
                input.model.limit.input ?? Infinity,
                Math.max(0, input.model.limit.context - (prepared.params.maxOutputTokens ?? 0)),
              )
        if (
          contextTokens({ system: prepared.system, messages, tools: prepared.tools }) >
          Math.min(input.maxInputTokens ?? Infinity, hard)
        )
          return yield* Effect.fail(new Error("Side question exceeds the selected model context limit"))
      }

      // Wire up toolExecutor for DWS workflow models so that tool calls
      // from the workflow service are executed via slopcode's tool system
      // and results sent back over the WebSocket.
      const bridge = yield* EffectBridge.make()
      if (language instanceof GitLabWorkflowLanguageModel) {
        const workflowModel = language as GitLabWorkflowLanguageModel & {
          sessionID?: string
          sessionPreapprovedTools?: string[]
          approvalHandler?: (approvalTools: { name: string; args: string }[]) => Promise<{ approved: boolean }>
        }
        workflowModel.sessionID = input.sessionID
        workflowModel.systemPrompt = prepared.system.join("\n")
        workflowModel.toolExecutor = async (toolName, argsJson, _requestID) => {
          const t = prepared.tools[toolName]
          if (!t || !t.execute) {
            return { result: "", error: `Unknown tool: ${toolName}` }
          }
          try {
            const result = await t.execute!(JSON.parse(argsJson), {
              toolCallId: _requestID,
              messages: input.messages,
              abortSignal: input.abort,
            })
            const output = typeof result === "string" ? result : (result?.output ?? JSON.stringify(result))
            return {
              result: output,
              metadata: typeof result === "object" ? result?.metadata : undefined,
              title: typeof result === "object" ? result?.title : undefined,
            }
          } catch (e: any) {
            return { result: "", error: e.message ?? String(e) }
          }
        }

        const ruleset = Permission.merge(input.agent.permission ?? [], input.permission ?? [])
        workflowModel.sessionPreapprovedTools = Object.keys(prepared.tools).filter((name) => {
          const match = ruleset.findLast((rule) => Wildcard.match(name, rule.permission))
          return !match || match.action !== "ask"
        })

        const approvedToolsForSession = new Set<string>()
        workflowModel.approvalHandler = bridge.bind(async (approvalTools) => {
          const uniqueNames = [...new Set(approvalTools.map((t: { name: string }) => t.name))] as string[]
          // Auto-approve tools that were already approved in this session
          // (prevents infinite approval loops for server-side MCP tools)
          if (uniqueNames.every((name) => approvedToolsForSession.has(name))) {
            return { approved: true }
          }

          const id = PermissionV1.ID.ascending()
          let unsub: EventV2.Unsubscribe | undefined
          try {
            unsub = await bridge.promise(
              events.listen((event) => {
                if (event.type !== Permission.Event.Replied.type) return Effect.void
                const data = event.data as EventV2.Data<typeof Permission.Event.Replied>
                if (data.requestID !== id) return Effect.void
                void data.reply
                return Effect.void
              }),
            )
            const toolPatterns = approvalTools.map((t: { name: string; args: string }) => {
              try {
                const parsed = JSON.parse(t.args) as Record<string, unknown>
                const title = (parsed?.title ?? parsed?.name ?? "") as string
                return title ? `${t.name}: ${title}` : t.name
              } catch {
                return t.name
              }
            })
            const uniquePatterns = [...new Set(toolPatterns)] as string[]
            await bridge.promise(
              perm.ask({
                id,
                sessionID: SessionID.make(input.sessionID),
                permission: "workflow_tool_approval",
                patterns: uniquePatterns,
                metadata: { tools: approvalTools },
                always: uniquePatterns,
                ruleset: [],
              }),
            )
            for (const name of uniqueNames) approvedToolsForSession.add(name)
            workflowModel.sessionPreapprovedTools = [...(workflowModel.sessionPreapprovedTools ?? []), ...uniqueNames]
            return { approved: true }
          } catch {
            return { approved: false }
          } finally {
            if (unsub) await bridge.promise(unsub)
          }
        })
      }

      const tracer = cfg.experimental?.openTelemetry
        ? Option.getOrUndefined(yield* Effect.serviceOption(OtelTracer.OtelTracer))
        : undefined
      const telemetryTracer = tracer
        ? new Proxy(tracer, {
            get(target, prop, receiver) {
              if (prop !== "startSpan") return Reflect.get(target, prop, receiver)
              return (...args: Parameters<typeof target.startSpan>) => {
                const span = target.startSpan(...args)
                span.setAttribute("session.id", input.sessionID)
                return span
              }
            },
          })
        : undefined

      // Explicit caching requires native lowering so CacheHint placement reaches
      // the exact Responses content part without AI SDK prompt conversion.
      const explicitCache = eligible && hint
      if (flags.experimentalNativeLlm || explicitCache) {
        const native = LLMNativeRuntime.stream({
          model: input.model,
          provider: item,
          auth: info,
          llmClient,
          messages,
          tools: prepared.tools,
          toolChoice: input.toolChoice,
          temperature: prepared.params.temperature,
          topP: prepared.params.topP,
          topK: prepared.params.topK,
          maxOutputTokens: prepared.params.maxOutputTokens,
          providerOptions: options,
          headers,
          retries: input.retries,
          abort: input.abort,
        })
        if (native.type === "supported") {
          yield* Effect.logInfo("llm runtime selected", {
            "llm.runtime": "native",
            "llm.provider": input.model.providerID,
            "llm.model": input.model.id,
          })
          return {
            type: "native" as const,
            stream: native.stream,
          }
        }
        if (explicitCache)
          return yield* Effect.fail(
            new Error(`Explicit GPT-5.6 caching requires native OpenAI Responses: ${native.reason}`),
          )
        yield* Effect.logInfo("llm runtime selected", {
          "llm.runtime": "ai-sdk",
          "llm.provider": input.model.providerID,
          "llm.model": input.model.id,
          "llm.native_unsupported_reason": native.reason,
        })
        yield* Effect.logInfo("native runtime unavailable; falling back to ai-sdk", {
          providerID: input.model.providerID,
          modelID: input.model.id,
          "session.id": input.sessionID,
          small: (input.small ?? false).toString(),
          agent: input.agent.name,
          mode: input.agent.mode,
          reason: native.reason,
        })
      }

      yield* Effect.logInfo("llm runtime selected", {
        "llm.runtime": "ai-sdk",
        "llm.provider": input.model.providerID,
        "llm.model": input.model.id,
      })
      // Default runtime path: AI SDK owns provider execution and tool dispatch;
      // LLMAISDK.toLLMEvents below normalizes fullStream parts for the processor.
      return {
        type: "ai-sdk" as const,
        result: streamText({
          onError(error) {
            bridge.fork(
              Effect.logError("stream error", {
                providerID: input.model.providerID,
                modelID: input.model.id,
                "session.id": input.sessionID,
                small: (input.small ?? false).toString(),
                agent: input.agent.name,
                mode: input.agent.mode,
                error,
              }),
            )
          },
          // Copilot returns the authoritative billed amount only in provider-specific response fields.
          includeRawChunks: input.model.providerID.includes("github-copilot"),
          async experimental_repairToolCall(failed) {
            const lower = failed.toolCall.toolName.toLowerCase()
            if (lower !== failed.toolCall.toolName && prepared.tools[lower]) {
              return {
                ...failed.toolCall,
                toolName: lower,
              }
            }
            return {
              ...failed.toolCall,
              input: JSON.stringify({
                tool: failed.toolCall.toolName,
                error: failed.error.message,
              }),
              toolName: "invalid",
            }
          },
          temperature: prepared.params.temperature,
          topP: prepared.params.topP,
          topK: prepared.params.topK,
          providerOptions: ProviderTransform.providerOptions(input.model, options),
          activeTools: Object.keys(prepared.tools).filter((x) => x !== "invalid"),
          tools: prepared.tools,
          toolChoice: input.toolChoice,
          maxOutputTokens: prepared.params.maxOutputTokens,
          abortSignal: input.abort,
          headers,
          maxRetries: input.retries ?? 0,
          messages,
          model: wrapLanguageModel({
            model: language,
            middleware: [
              {
                specificationVersion: "v3" as const,
                async transformParams(args) {
                  if (args.type === "stream") {
                    // @ts-expect-error
                    args.params.prompt = ProviderTransform.message(
                      args.params.prompt,
                      input.model,
                      prepared.messageTransformOptions,
                    )
                  }
                  return args.params
                },
              },
            ],
          }),
          experimental_telemetry: {
            isEnabled: cfg.experimental?.openTelemetry,
            functionId: "session.llm",
            tracer: telemetryTracer,
            metadata: {
              userId: cfg.username ?? "unknown",
              sessionId: input.sessionID,
            },
          },
        }),
      }
    })

    const stream: Interface["stream"] = (input) =>
      Stream.scoped(
        Stream.unwrap(
          Effect.gen(function* () {
            const ctrl = yield* Effect.acquireRelease(
              Effect.sync(() => new AbortController()),
              (ctrl) => Effect.sync(() => ctrl.abort()),
            )

            const result = yield* run({ ...input, abort: ctrl.signal })

            if (result.type === "native") return result.stream

            // Adapter seam: both runtimes expose the same LLMEvent stream. Native
            // already returns one; AI SDK streams are converted here.
            const state = LLMAISDK.adapterState()
            return Stream.fromAsyncIterable(result.result.fullStream, (e) =>
              e instanceof Error ? e : new Error(String(e)),
            ).pipe(
              Stream.mapEffect((event) => LLMAISDK.toLLMEvents(state, event)),
              Stream.flatMap((events) => Stream.fromIterable(events)),
            )
          }),
        ),
      )

    return Service.of({ stream })
  }),
)

export const layer = live.pipe(Layer.provide(Permission.defaultLayer), Layer.provide(EventV2Bridge.defaultLayer))

export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(Auth.defaultLayer),
    Layer.provide(Config.defaultLayer),
    Layer.provide(Provider.defaultLayer),
    Layer.provide(Plugin.defaultLayer),
    Layer.provide(
      LLMClient.layer.pipe(Layer.provide(Layer.mergeAll(RequestExecutor.defaultLayer, WebSocketExecutor.layer))),
    ),
    Layer.provide(RuntimeFlags.defaultLayer),
    Layer.provide(Account.defaultLayer),
    Layer.provide(SafetyIdentity.defaultLayer),
  ),
)

export const hasToolCalls = LLMRequestPrep.hasToolCalls

export const node = LayerNode.make(layer, [
  Auth.node,
  Config.node,
  Provider.node,
  Plugin.node,
  Permission.node,
  EventV2Bridge.node,
  llmClient,
  RuntimeFlags.node,
  Account.node,
  SafetyIdentity.node,
])

export * as LLM from "./llm"
