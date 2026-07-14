import { Effect, Schema } from "effect"
import { Route } from "../route/client"
import { Auth } from "../route/auth"
import { Endpoint } from "../route/endpoint"
import { HttpTransport, WebSocketTransport } from "../route/transport"
import { Protocol } from "../route/protocol"
import {
  isCustomToolDefinition,
  LLMEvent,
  Usage,
  type AnyToolDefinition,
  type FinishReason,
  type LLMRequest,
  type ProviderMetadata,
  type ReasoningPart,
  type TextPart,
  type ToolCallPart,
  type ToolDefinition,
  type ToolContent,
  type ToolResultPart,
} from "../schema"
import { JsonObject, optionalArray, optionalNull, ProviderShared } from "./shared"
import { isContextOverflow } from "../provider-error"
import { OpenAIOptions } from "./utils/openai-options"
import { Lifecycle } from "./utils/lifecycle"
import { ToolStream } from "./utils/tool-stream"

const ADAPTER = "openai-responses"
export const DEFAULT_BASE_URL = "https://api.openai.com/v1"
export const PATH = "/responses"

// =============================================================================
// Request Body Schema
// =============================================================================
const OpenAIResponsesInputText = Schema.Struct({
  type: Schema.tag("input_text"),
  text: Schema.String,
  prompt_cache_breakpoint: Schema.optional(Schema.Struct({ mode: Schema.Literal("explicit") })),
})
const OpenAIResponsesInputImage = Schema.Struct({
  type: Schema.tag("input_image"),
  image_url: Schema.String,
})
const OpenAIResponsesInputContent = Schema.Union([OpenAIResponsesInputText, OpenAIResponsesInputImage])
type OpenAIResponsesInputContent = Schema.Schema.Type<typeof OpenAIResponsesInputContent>

const OpenAIResponsesDeveloperMessage = Schema.Struct({
  type: Schema.tag("message"),
  role: Schema.tag("developer"),
  content: Schema.Array(OpenAIResponsesInputText),
})

const OpenAIResponsesOutputText = Schema.Struct({
  type: Schema.tag("output_text"),
  text: Schema.String,
})

const OpenAIResponsesReasoningSummaryText = Schema.Struct({
  type: Schema.tag("summary_text"),
  text: Schema.String,
})

const OpenAIResponsesReasoningItem = Schema.Struct({
  type: Schema.tag("reasoning"),
  id: Schema.String,
  summary: Schema.Array(OpenAIResponsesReasoningSummaryText),
  encrypted_content: optionalNull(Schema.String),
})

const OpenAIResponsesItemReference = Schema.Struct({
  type: Schema.tag("item_reference"),
  id: Schema.String,
})

// `function_call_output.output` accepts either a plain string or an ordered
// array of content items so tools can return images in addition to text.
// https://platform.openai.com/docs/api-reference/responses/object
const OpenAIResponsesFunctionCallOutputContent = Schema.Union([OpenAIResponsesInputText, OpenAIResponsesInputImage])

const OpenAIResponsesFunctionCallOutput = Schema.Union([
  Schema.String,
  Schema.Array(OpenAIResponsesFunctionCallOutputContent),
])

const OpenAIResponsesHistoryItem = Schema.Union([
  Schema.Struct({
    role: Schema.tag("system"),
    content: Schema.Union([Schema.String, Schema.Array(OpenAIResponsesInputText)]),
  }),
  Schema.Struct({ role: Schema.tag("user"), content: Schema.Array(OpenAIResponsesInputContent) }),
  Schema.Struct({ role: Schema.tag("assistant"), content: Schema.Array(OpenAIResponsesOutputText) }),
  OpenAIResponsesReasoningItem,
  OpenAIResponsesItemReference,
  Schema.Struct({
    type: Schema.tag("function_call"),
    call_id: Schema.String,
    name: Schema.String,
    arguments: Schema.String,
  }),
  Schema.Struct({
    type: Schema.tag("function_call_output"),
    call_id: Schema.String,
    output: OpenAIResponsesFunctionCallOutput,
  }),
  Schema.Struct({
    type: Schema.tag("custom_tool_call"),
    id: Schema.optional(Schema.String),
    call_id: Schema.String,
    name: Schema.String,
    input: Schema.String,
  }),
  Schema.Struct({
    type: Schema.tag("custom_tool_call_output"),
    call_id: Schema.String,
    output: OpenAIResponsesFunctionCallOutput,
  }),
])
type OpenAIResponsesInputItem = Schema.Schema.Type<typeof OpenAIResponsesHistoryItem>

// Mutable counterpart of the schema reasoning item so `lowerMessages` can fold
// multiple streamed summary parts into the same item before flushing.
type OpenAIResponsesReasoningInput = {
  type: "reasoning"
  id: string
  summary: Array<{ type: "summary_text"; text: string }>
  encrypted_content?: string | null
}

const OpenAIResponsesFunctionTool = Schema.Struct({
  type: Schema.tag("function"),
  name: Schema.String,
  description: Schema.String,
  parameters: JsonObject,
  strict: Schema.optional(Schema.Boolean),
})
const OpenAIResponsesCustomTool = Schema.Struct({
  type: Schema.tag("custom"),
  name: Schema.String,
  description: Schema.String,
  format: Schema.optional(
    Schema.Struct({
      type: Schema.tag("grammar"),
      syntax: Schema.Literal("lark"),
      definition: Schema.String,
    }),
  ),
})
const OpenAIResponsesTool = Schema.Union([OpenAIResponsesFunctionTool, OpenAIResponsesCustomTool])
type OpenAIResponsesTool = Schema.Schema.Type<typeof OpenAIResponsesTool>

const OpenAIResponsesAdditionalTools = Schema.Struct({
  type: Schema.tag("additional_tools"),
  role: Schema.tag("developer"),
  tools: Schema.Array(OpenAIResponsesTool),
})

const OpenAIResponsesInputItem = Schema.Union([
  OpenAIResponsesAdditionalTools,
  OpenAIResponsesDeveloperMessage,
  OpenAIResponsesHistoryItem,
])

const OpenAIResponsesToolChoice = Schema.Union([
  Schema.Literals(["auto", "none", "required"]),
  Schema.Struct({ type: Schema.tag("function"), name: Schema.String }),
  Schema.Struct({ type: Schema.tag("custom"), name: Schema.String }),
])

// Fields shared between the HTTP body and the WebSocket `response.create`
// message. The HTTP body adds `stream: true`; the WebSocket message adds
// `type: "response.create"`. Defining the shared shape once keeps the two
// transports in sync without a destructure-and-strip dance.
const OpenAIResponsesCoreFields = {
  model: Schema.String,
  input: Schema.Array(OpenAIResponsesInputItem),
  instructions: Schema.optional(Schema.String),
  tools: optionalArray(OpenAIResponsesTool),
  tool_choice: Schema.optional(OpenAIResponsesToolChoice),
  parallel_tool_calls: Schema.optional(Schema.Boolean),
  truncation: Schema.optional(OpenAIOptions.OpenAITruncation),
  store: Schema.optional(Schema.Boolean),
  service_tier: Schema.optional(OpenAIOptions.OpenAIServiceTier),
  prompt_cache_key: Schema.optional(Schema.String),
  prompt_cache_options: Schema.optional(
    Schema.Struct({ mode: Schema.Literal("explicit"), ttl: Schema.Literal("30m") }),
  ),
  safety_identifier: Schema.optional(Schema.String),
  include: optionalArray(OpenAIOptions.OpenAIResponseIncludable),
  stream_options: Schema.optional(
    Schema.Struct({ reasoning_summary_delivery: Schema.Literal("sequential_cutoff") }),
  ),
  reasoning: Schema.optional(
    Schema.Struct({
      effort: Schema.optional(OpenAIOptions.OpenAIReasoningEffort),
      summary: Schema.optional(Schema.Literal("auto")),
      context: Schema.optional(OpenAIOptions.OpenAIReasoningContext),
    }),
  ),
  text: Schema.optional(
    Schema.Struct({
      verbosity: Schema.optional(OpenAIOptions.OpenAITextVerbosity),
    }),
  ),
  max_output_tokens: Schema.optional(Schema.Number),
  temperature: Schema.optional(Schema.Number),
  top_p: Schema.optional(Schema.Number),
}

const OpenAIResponsesBody = Schema.Struct({
  ...OpenAIResponsesCoreFields,
  stream: Schema.Literal(true),
})
export type OpenAIResponsesBody = Schema.Schema.Type<typeof OpenAIResponsesBody>

const OpenAIResponsesClientMetadata = Schema.Struct({
  ws_request_header_x_openai_internal_codex_responses_lite: Schema.Literal("true"),
})

const OpenAIResponsesWebSocketMessage = Schema.StructWithRest(
  Schema.Struct({
    type: Schema.tag("response.create"),
    ...OpenAIResponsesCoreFields,
    client_metadata: Schema.optional(OpenAIResponsesClientMetadata),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
)
type OpenAIResponsesWebSocketMessage = Schema.Schema.Type<typeof OpenAIResponsesWebSocketMessage>
const encodeWebSocketMessage = Schema.encodeSync(Schema.fromJsonString(OpenAIResponsesWebSocketMessage))

const OpenAIResponsesUsage = Schema.Struct({
  input_tokens: Schema.optional(Schema.Number),
  input_tokens_details: optionalNull(
    Schema.Struct({
      cached_tokens: Schema.optional(Schema.Number),
      cache_write_tokens: Schema.optional(Schema.Number),
    }),
  ),
  output_tokens: Schema.optional(Schema.Number),
  output_tokens_details: optionalNull(Schema.Struct({ reasoning_tokens: Schema.optional(Schema.Number) })),
  total_tokens: Schema.optional(Schema.Number),
})
type OpenAIResponsesUsage = Schema.Schema.Type<typeof OpenAIResponsesUsage>

const OpenAIResponsesStreamItem = Schema.Struct({
  type: Schema.String,
  id: Schema.optional(Schema.String),
  call_id: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  arguments: Schema.optional(Schema.String),
  input: Schema.optional(Schema.String),
  // Hosted (provider-executed) tool fields. Each hosted tool item carries its
  // own subset of these — we capture them generically so we can surface the
  // call's typed input portion and round-trip the full result payload without
  // hand-rolling a per-tool schema.
  status: Schema.optional(Schema.String),
  action: Schema.optional(Schema.Unknown),
  queries: Schema.optional(Schema.Unknown),
  results: Schema.optional(Schema.Unknown),
  code: Schema.optional(Schema.String),
  container_id: Schema.optional(Schema.String),
  outputs: Schema.optional(Schema.Unknown),
  server_label: Schema.optional(Schema.String),
  output: Schema.optional(Schema.Unknown),
  error: Schema.optional(Schema.Unknown),
  encrypted_content: optionalNull(Schema.String),
})
type OpenAIResponsesStreamItem = Schema.Schema.Type<typeof OpenAIResponsesStreamItem>

// OpenAI Responses surfaces provider failures in two related shapes. The
// streaming `error` event carries the details at the top level
// (`{ type: "error", code, message, param, sequence_number }`), while
// `response.failed` carries them under `response.error`. We capture both so
// the parser can surface a useful provider-error message in either path.
const OpenAIResponsesErrorPayload = Schema.Struct({
  code: optionalNull(Schema.String),
  message: optionalNull(Schema.String),
  param: optionalNull(Schema.String),
})

const OpenAIResponsesEvent = Schema.Struct({
  type: Schema.String,
  delta: Schema.optional(Schema.String),
  text: Schema.optional(Schema.String),
  item_id: Schema.optional(Schema.String),
  summary_index: Schema.optional(Schema.Number),
  item: Schema.optional(OpenAIResponsesStreamItem),
  response: Schema.optional(
    Schema.StructWithRest(
      Schema.Struct({
        id: Schema.optional(Schema.String),
        service_tier: optionalNull(Schema.String),
        incomplete_details: optionalNull(Schema.Struct({ reason: Schema.String })),
        usage: optionalNull(OpenAIResponsesUsage),
        error: optionalNull(OpenAIResponsesErrorPayload),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
  ),
  code: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
  param: Schema.optional(Schema.String),
})
type OpenAIResponsesEvent = Schema.Schema.Type<typeof OpenAIResponsesEvent>

interface ParserState {
  readonly tools: ToolStream.State<string>
  readonly hasFunctionCall: boolean
  readonly lifecycle: Lifecycle.State
  readonly reasoningItems: Readonly<Record<string, ReasoningStreamItem>>
  readonly reasoningCutoffs: ReadonlySet<string>
  readonly store: boolean | undefined
  readonly sequentialCutoff: boolean
}

type ReasoningSummaryStatus = "active" | "can-conclude" | "concluded"

interface ReasoningStreamItem {
  readonly encryptedContent: string | null | undefined
  // Keyed by OpenAI's numeric `summary_index`. JS object keys coerce to
  // strings, but typing the map as `Record<number, ...>` documents intent
  // and matches the wire field.
  readonly summaryParts: Readonly<Record<number, ReasoningSummaryStatus>>
}

const invalid = ProviderShared.invalidRequest

// =============================================================================
// Request Lowering
// =============================================================================
const lowerTool = (tool: AnyToolDefinition): OpenAIResponsesTool => {
  if (isCustomToolDefinition(tool))
    return {
      type: "custom",
      name: tool.name,
      description: tool.description,
      format: tool.format,
    }
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: ProviderShared.openAiToolInputSchema(tool.inputSchema),
  }
}

const lowerToolChoice = (toolChoice: NonNullable<LLMRequest["toolChoice"]>) =>
  ProviderShared.matchToolChoice("OpenAI Responses", toolChoice, {
    auto: () => "auto" as const,
    none: () => "none" as const,
    required: () => "required" as const,
    tool: (name) => ({ type: toolChoice.toolType === "custom" ? ("custom" as const) : ("function" as const), name }),
  })

const isReplayItemID = (value: unknown): value is string => {
  if (typeof value !== "string") return false
  const separator = value.indexOf("_")
  return separator > 0 && separator < value.length - 1
}

const openAIItemID = (part: ToolCallPart | ToolResultPart) => {
  const openai = part.providerMetadata?.openai
  return ProviderShared.isRecord(openai) && isReplayItemID(openai.itemId) ? openai.itemId : undefined
}

const lowerToolCall = Effect.fn("OpenAIResponses.lowerToolCall")(function* (part: ToolCallPart) {
  if (part.toolType === "custom") {
    if (typeof part.input !== "string")
      return yield* invalid(`OpenAI Responses custom tool call ${part.name} input must be a string`)
    return {
      type: "custom_tool_call" as const,
      id: openAIItemID(part),
      call_id: part.id,
      name: part.name,
      input: part.input,
    }
  }
  return {
    type: "function_call" as const,
    call_id: part.id,
    name: part.name,
    arguments: ProviderShared.encodeJson(part.input),
  }
})

const lowerReasoning = (part: ReasoningPart): OpenAIResponsesReasoningInput | undefined => {
  const openai = part.providerMetadata?.openai
  if (!ProviderShared.isRecord(openai) || !isReplayItemID(openai.itemId)) return undefined
  const encryptedContent =
    typeof openai.reasoningEncryptedContent === "string" && openai.reasoningEncryptedContent.length > 0
      ? openai.reasoningEncryptedContent
      : openai.reasoningEncryptedContent === null
        ? null
        : undefined
  return {
    type: "reasoning",
    id: openai.itemId,
    summary: part.text.length > 0 ? [{ type: "summary_text", text: part.text }] : [],
    encrypted_content: encryptedContent,
  }
}

const hostedToolItemID = (part: ToolResultPart) => {
  return openAIItemID(part)
}

const lowerUserContent = Effect.fn("OpenAIResponses.lowerUserContent")(function* (
  part: LLMRequest["messages"][number]["content"][number],
  cache = false,
) {
  if (part.type === "text")
    return {
      type: "input_text" as const,
      text: part.text,
      ...(cache && part.cache?.ttlSeconds === 1800
        ? { prompt_cache_breakpoint: { mode: "explicit" as const } }
        : {}),
    }
  if (part.type === "media") {
    const media = yield* ProviderShared.validateMedia(
      "OpenAI Responses",
      part,
      new Set<string>(ProviderShared.IMAGE_MIMES),
    )
    return { type: "input_image" as const, image_url: media.dataUrl }
  }
  return yield* ProviderShared.unsupportedContent("OpenAI Responses", "user", ["text", "media"])
})

// Tool results may carry structured text/images. Keep media as provider-native
// content instead of JSON-stringifying base64 into a prompt string.
const lowerToolResultContentItem = Effect.fn("OpenAIResponses.lowerToolResultContentItem")(function* (
  item: ToolContent,
) {
  if (item.type === "text") return { type: "input_text" as const, text: item.text }
  const media = yield* ProviderShared.validateToolFile(
    "OpenAI Responses",
    item,
    new Set<string>(ProviderShared.IMAGE_MIMES),
  )
  return { type: "input_image" as const, image_url: media.dataUrl }
})

const lowerToolResultOutput = Effect.fn("OpenAIResponses.lowerToolResultOutput")(function* (part: ToolResultPart) {
  // Text/json/error results are encoded as a plain string for backward
  // compatibility with existing cassettes and provider expectations.
  if (part.result.type !== "content") return ProviderShared.toolResultText(part)
  // Preserve the narrowed array element type when compiled through a consumer package.
  const content: ReadonlyArray<ToolContent> = part.result.value
  return yield* Effect.forEach(content, lowerToolResultContentItem)
})

const lowerMessages = Effect.fn("OpenAIResponses.lowerMessages")(function* (request: LLMRequest, includeSystem = true) {
  const cache = eligible(request)
  const system: OpenAIResponsesInputItem[] =
    !includeSystem || request.system.length === 0
      ? []
      : [
          {
            role: "system",
            content: request.system.some((part) => cache && part.cache?.ttlSeconds === 1800)
              ? request.system.map((part) => ({
                  type: "input_text" as const,
                  text: part.text,
                  ...(cache && part.cache?.ttlSeconds === 1800
                    ? { prompt_cache_breakpoint: { mode: "explicit" as const } }
                    : {}),
                }))
              : ProviderShared.joinText(request.system),
          },
        ]
  const input: OpenAIResponsesInputItem[] = [...system]
  const store = OpenAIOptions.store(request)

  for (const message of request.messages) {
    if (message.role === "system") {
      const part = yield* ProviderShared.wrappedSystemUpdate("OpenAI Responses", message)
      const lowered = yield* lowerUserContent(part, cache)
      const previous = input.at(-1)
      if (previous && "role" in previous && previous.role === "user")
        input[input.length - 1] = {
          role: "user",
          content: [...previous.content, lowered],
        }
      else input.push({ role: "user", content: [lowered] })
      continue
    }

    if (message.role === "user") {
      input.push({
        role: "user",
        content: yield* Effect.forEach(message.content, (part) => lowerUserContent(part, cache)),
      })
      continue
    }

    if (message.role === "assistant") {
      const content: TextPart[] = []
      const reasoningItems: Record<string, OpenAIResponsesReasoningInput> = {}
      const reasoningReferences = new Set<string>()
      const hostedToolReferences = new Set<string>()
      const flushText = () => {
        if (content.length === 0) return
        input.push({ role: "assistant", content: content.map((part) => ({ type: "output_text", text: part.text })) })
        content.splice(0, content.length)
      }
      for (const part of message.content) {
        if (part.type === "text") {
          content.push(part)
          continue
        }
        if (part.type === "reasoning") {
          flushText()
          const reasoning = lowerReasoning(part)
          if (!reasoning) continue
          if (store !== false && reasoning.id) {
            if (!reasoningReferences.has(reasoning.id)) input.push({ type: "item_reference", id: reasoning.id })
            reasoningReferences.add(reasoning.id)
            continue
          }
          const existing = reasoningItems[reasoning.id]
          if (existing) {
            existing.summary.push(...reasoning.summary)
            if (typeof reasoning.encrypted_content === "string" && reasoning.encrypted_content.length > 0)
              existing.encrypted_content = reasoning.encrypted_content
            continue
          }
          reasoningItems[reasoning.id] = reasoning
          input.push(reasoning)
          continue
        }
        if (part.type === "tool-call") {
          flushText()
          if (part.providerExecuted === true) continue
          input.push(yield* lowerToolCall(part))
          continue
        }
        if (part.type === "tool-result" && part.providerExecuted === true) {
          flushText()
          const itemID = hostedToolItemID(part)
          if (store !== false && itemID && !hostedToolReferences.has(itemID))
            input.push({ type: "item_reference", id: itemID })
          if (itemID) hostedToolReferences.add(itemID)
          continue
        }
        return yield* ProviderShared.unsupportedContent("OpenAI Responses", "assistant", [
          "text",
          "reasoning",
          "tool-call",
          "tool-result",
        ])
      }
      flushText()
      continue
    }

    for (const part of message.content) {
      if (!ProviderShared.supportsContent(part, ["tool-result"]))
        return yield* ProviderShared.unsupportedContent("OpenAI Responses", "tool", ["tool-result"])
      input.push({
        type: part.toolType === "custom" ? "custom_tool_call_output" : "function_call_output",
        call_id: part.id,
        output: yield* lowerToolResultOutput(part),
      })
    }
  }

  // With store:false, OpenAI only accepts previous reasoning items when the
  // complete item has encrypted state. Summary blocks for one item may carry
  // that state only on the last block, so filter after they have been joined.
  return store === false
    ? input.filter(
        (item) =>
          !("type" in item) ||
          item.type !== "reasoning" ||
          (typeof item.encrypted_content === "string" && item.encrypted_content.length > 0),
      )
    : input
})

const GPT5_6 = new Set(["gpt-5.6", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"])
const eligible = (request: LLMRequest) =>
  GPT5_6.has(request.model.id.toLowerCase()) &&
  (request.model.provider === "openai" ||
    request.model.provider === "slopcode" ||
    request.model.provider === "slopcode-go") &&
  request.model.route.id !== "openai-responses-codex" &&
  OpenAIOptions.responsesMode(request) !== "lite"

const hasBreakpoint = (request: LLMRequest) =>
  request.system.some((part) => part.cache?.ttlSeconds === 1800) ||
  request.messages.some((message) =>
    message.content.some((part) => part.type === "text" && part.cache?.ttlSeconds === 1800),
  )

const lowerOptions = Effect.fn("OpenAIResponses.lowerOptions")(function* (request: LLMRequest) {
  const lite = OpenAIOptions.responsesMode(request) === "lite"
  const store = OpenAIOptions.store(request)
  const promptCacheKey = OpenAIOptions.promptCacheKey(request)
  const effort = OpenAIOptions.reasoningEffort(request)
  if (effort && !OpenAIOptions.isReasoningEffort(effort))
    return yield* invalid(`OpenAI Responses does not support reasoning effort ${effort}`)
  const summary = OpenAIOptions.reasoningSummary(request)
  const context = lite ? ("all_turns" as const) : OpenAIOptions.reasoningContext(request)
  const requested = OpenAIOptions.include(request) ?? []
  const include =
    store === false ? [...new Set([...requested, "reasoning.encrypted_content" as const])] : requested
  const verbosity = OpenAIOptions.textVerbosity(request)
  const instructions = OpenAIOptions.instructions(request)
  const serviceTier = OpenAIOptions.serviceTier(request)
  const parallelToolCalls = OpenAIOptions.parallelToolCalls(request)
  const truncation = OpenAIOptions.truncation(request)
  const requestedCache = OpenAIOptions.promptCacheOptions(request)
  const cache =
    eligible(request) &&
    hasBreakpoint(request) &&
    (!OpenAIOptions.hasPromptCacheOptions(request) || requestedCache !== undefined)
  const safety = eligible(request) ? OpenAIOptions.safetyIdentifier(request) : undefined
  return {
    ...(lite ? { instructions: "" } : instructions ? { instructions } : {}),
    ...(store !== undefined ? { store } : {}),
    ...(promptCacheKey ? { prompt_cache_key: promptCacheKey } : {}),
    ...(cache
      ? { prompt_cache_options: requestedCache ?? { mode: "explicit" as const, ttl: "30m" as const } }
      : {}),
    ...(safety ? { safety_identifier: safety } : {}),
    ...(include.length > 0 ? { include } : {}),
    ...(request.model.route.capabilities.includes("sequential-cutoff") &&
    OpenAIOptions.reasoningSummaryDelivery(request) === "sequential_cutoff"
      ? { stream_options: { reasoning_summary_delivery: "sequential_cutoff" as const } }
      : {}),
    ...(effort || summary === "auto" || context
      ? {
          reasoning: {
            ...(effort ? { effort: effort === "ultra" ? ("max" as const) : effort } : {}),
            ...(summary === "auto" ? { summary } : {}),
            ...(context ? { context } : {}),
          },
        }
      : {}),
    ...(verbosity ? { text: { verbosity } } : {}),
    ...(serviceTier ? { service_tier: serviceTier } : {}),
    ...(lite
      ? { parallel_tool_calls: false }
      : parallelToolCalls !== undefined
        ? { parallel_tool_calls: parallelToolCalls }
        : {}),
    ...(truncation ? { truncation } : {}),
  }
})

const fromRequest = Effect.fn("OpenAIResponses.fromRequest")(function* (request: LLMRequest) {
  const generation = request.generation
  const lite = OpenAIOptions.responsesMode(request) === "lite"
  if (lite && !request.model.route.capabilities.includes("responses-lite"))
    return yield* invalid(`${request.model.provider}/${request.model.route.id} does not support Responses Lite`)
  const custom =
    request.tools.some((tool) => "type" in tool && tool.type === "custom") ||
    request.messages.some((message) =>
      message.content.some(
        (part) => (part.type === "tool-call" || part.type === "tool-result") && part.toolType === "custom",
      ),
    ) ||
    request.toolChoice?.toolType === "custom"
  if (custom && !request.model.route.capabilities.includes("custom-tools"))
    return yield* invalid(`${request.model.provider}/${request.model.route.id} does not support custom tools`)
  const tools = request.tools.map(lowerTool)
  const messages = yield* lowerMessages(request, !lite)
  const instructions = OpenAIOptions.instructions(request)
  const developer = [instructions, ...request.system.map((part) => part.text)].filter(
    (part): part is string => part !== undefined && part.length > 0,
  )
  const options = yield* lowerOptions(request)
  return {
    model: request.model.id,
    input: lite
      ? [
          { type: "additional_tools" as const, role: "developer" as const, tools },
          ...(developer.length > 0
            ? [
                {
                  type: "message" as const,
                  role: "developer" as const,
                  content: developer.map((text) => ({ type: "input_text" as const, text })),
                },
              ]
            : []),
          ...messages,
        ]
      : messages,
    ...(!lite && tools.length > 0 ? { tools } : {}),
    tool_choice: request.toolChoice ? yield* lowerToolChoice(request.toolChoice) : undefined,
    stream: true as const,
    max_output_tokens: generation?.maxTokens,
    temperature: generation?.temperature,
    top_p: generation?.topP,
    ...options,
  }
})

// =============================================================================
// Stream Parsing
// =============================================================================
// OpenAI Responses reports `input_tokens` (inclusive total) with a
// `cached_tokens` subset, and `output_tokens` (inclusive total) with a
// `reasoning_tokens` subset. Pass the totals through and derive the
// non-cached breakdown.
const mapUsage = (usage: OpenAIResponsesUsage | null | undefined) => {
  if (!usage) return undefined
  const cached = usage.input_tokens_details?.cached_tokens
  const written = usage.input_tokens_details?.cache_write_tokens
  const reasoning = usage.output_tokens_details?.reasoning_tokens
  const nonCached = ProviderShared.subtractTokens(ProviderShared.subtractTokens(usage.input_tokens, cached), written)
  return new Usage({
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    nonCachedInputTokens: nonCached,
    cacheReadInputTokens: cached,
    cacheWriteInputTokens: written,
    reasoningTokens: reasoning,
    totalTokens: ProviderShared.totalTokens(usage.input_tokens, usage.output_tokens, usage.total_tokens),
    providerMetadata: { openai: usage },
  })
}

const mapFinishReason = (event: OpenAIResponsesEvent, hasFunctionCall: boolean): FinishReason => {
  const reason = event.response?.incomplete_details?.reason
  if (reason === undefined || reason === null) return hasFunctionCall ? "tool-calls" : "stop"
  if (reason === "max_output_tokens") return "length"
  if (reason === "content_filter") return "content-filter"
  return hasFunctionCall ? "tool-calls" : "unknown"
}

const openaiMetadata = (metadata: Record<string, unknown>): ProviderMetadata => ({ openai: metadata })

// Hosted tool items (provider-executed) ship their typed input + status +
// result fields all in one item. We expose them as a `tool-call` +
// `tool-result` pair so consumers can treat them uniformly with client tools,
// only differentiated by `providerExecuted: true`.
//
// One record per OpenAI Responses item type that represents a hosted
// (provider-executed) tool call: the common name we surface, plus an `input`
// extractor that picks the fields the model actually populated for that tool.
// Falling back to `{}` when an entry isn't fully typed keeps unknown tools
// observable without rolling a per-tool schema.
const HOSTED_TOOLS = {
  web_search_call: { name: "web_search", input: (item) => item.action ?? {} },
  web_search_preview_call: { name: "web_search_preview", input: (item) => item.action ?? {} },
  file_search_call: { name: "file_search", input: (item) => ({ queries: item.queries ?? [] }) },
  code_interpreter_call: {
    name: "code_interpreter",
    input: (item) => ({ code: item.code, container_id: item.container_id }),
  },
  computer_use_call: { name: "computer_use", input: (item) => item.action ?? {} },
  image_generation_call: { name: "image_generation", input: () => ({}) },
  mcp_call: {
    name: "mcp",
    input: (item) => ({ server_label: item.server_label, name: item.name, arguments: item.arguments }),
  },
  local_shell_call: { name: "local_shell", input: (item) => item.action ?? {} },
} as const satisfies Record<
  string,
  { readonly name: string; readonly input: (item: OpenAIResponsesStreamItem) => unknown }
>

type HostedToolType = keyof typeof HOSTED_TOOLS

const isHostedToolItem = (
  item: OpenAIResponsesStreamItem,
): item is OpenAIResponsesStreamItem & { type: HostedToolType; id: string } =>
  item.type in HOSTED_TOOLS && typeof item.id === "string" && item.id.length > 0

const isReasoningItem = (
  item: OpenAIResponsesStreamItem,
): item is OpenAIResponsesStreamItem & { type: "reasoning"; id: string } =>
  item.type === "reasoning" && typeof item.id === "string" && item.id.length > 0

// Round-trip the full item as the structured result so consumers can extract
// outputs / sources / status without re-decoding.
const hostedToolResult = (item: OpenAIResponsesStreamItem) => {
  const isError = typeof item.error !== "undefined" && item.error !== null
  return isError ? { type: "error" as const, value: item.error } : { type: "json" as const, value: item }
}

const hostedToolEvents = (
  item: OpenAIResponsesStreamItem & { type: HostedToolType; id: string },
): ReadonlyArray<LLMEvent> => {
  const tool = HOSTED_TOOLS[item.type]
  const providerMetadata = openaiMetadata({ itemId: item.id })
  return [
    LLMEvent.toolCall({
      id: item.id,
      name: tool.name,
      input: tool.input(item),
      providerExecuted: true,
      providerMetadata,
    }),
    LLMEvent.toolResult({
      id: item.id,
      name: tool.name,
      result: hostedToolResult(item),
      providerExecuted: true,
      providerMetadata,
    }),
  ]
}

type StepResult = readonly [ParserState, ReadonlyArray<LLMEvent>]

const NO_EVENTS: StepResult["1"] = []

// `response.completed` / `response.incomplete` are clean finishes that emit a
// `finish` event; `response.failed` is a hard failure that emits a
// `provider-error`. All three end the stream — kept in one set so `step` and
// the protocol's `terminal` predicate stay in sync.
const TERMINAL_TYPES = new Set(["response.completed", "response.incomplete", "response.failed"])

const onOutputTextDelta = (state: ParserState, event: OpenAIResponsesEvent): StepResult => {
  if (!event.delta) return [state, NO_EVENTS]
  const events: LLMEvent[] = []
  return [
    { ...state, lifecycle: Lifecycle.textDelta(state.lifecycle, events, event.item_id ?? "text-0", event.delta) },
    events,
  ]
}

const onReasoningDelta = (state: ParserState, event: OpenAIResponsesEvent): StepResult => {
  if (state.sequentialCutoff) return [state, NO_EVENTS]
  if (!event.delta) return [state, NO_EVENTS]
  const events: LLMEvent[] = []
  const itemID = event.item_id ?? "reasoning-0"
  const id =
    event.summary_index !== undefined || state.reasoningItems[itemID] ? `${itemID}:${event.summary_index ?? 0}` : itemID
  return [
    {
      ...state,
      lifecycle: Lifecycle.reasoningDelta(state.lifecycle, events, id, event.delta),
    },
    events,
  ]
}

const onReasoningDone = (state: ParserState, event: OpenAIResponsesEvent): StepResult => {
  if (!state.sequentialCutoff || !event.item_id || event.summary_index === undefined || !event.text)
    return [state, NO_EVENTS]
  if (state.reasoningCutoffs.has(event.item_id)) return [state, NO_EVENTS]
  const item = state.reasoningItems[event.item_id]
  if (!item || item.summaryParts[event.summary_index]) return [state, NO_EVENTS]
  const events: LLMEvent[] = []
  const closed = Object.entries(item.summaryParts).reduce(
    (lifecycle, entry) =>
      Lifecycle.reasoningEnd(lifecycle, events, `${event.item_id}:${entry[0]}`, openaiMetadata({ itemId: event.item_id })),
    state.lifecycle,
  )
  const id = `${event.item_id}:${event.summary_index}`
  return [
    {
      ...state,
      lifecycle: Lifecycle.reasoningDelta(closed, events, id, event.text),
      reasoningItems: {
        ...state.reasoningItems,
        [event.item_id]: {
          ...item,
          summaryParts: {
            ...Object.fromEntries(Object.keys(item.summaryParts).map((index) => [index, "concluded" as const])),
            [event.summary_index]: "active",
          },
        },
      },
    },
    events,
  ]
}

const reasoningMetadata = (item: OpenAIResponsesStreamItem & { id: string }) =>
  openaiMetadata({ itemId: item.id, reasoningEncryptedContent: item.encrypted_content ?? null })

const interruptReasoning = (state: ParserState): StepResult => {
  if (!state.sequentialCutoff || Object.keys(state.reasoningItems).length === 0) return [state, NO_EVENTS]
  const events: LLMEvent[] = []
  const lifecycle = Object.entries(state.reasoningItems).reduce(
    (current, entry) =>
      Object.keys(entry[1].summaryParts).reduce(
        (inner, index) => Lifecycle.reasoningEnd(inner, events, `${entry[0]}:${index}`),
        current,
      ),
    state.lifecycle,
  )
  return [
    {
      ...state,
      lifecycle,
      reasoningItems: {},
      reasoningCutoffs: new Set([...state.reasoningCutoffs, ...Object.keys(state.reasoningItems)]),
    },
    events,
  ]
}

// OpenAI Responses streams reasoning items in a stable order:
//   `output_item.added` (reasoning) →
//     `reasoning_summary_part.added` (index=0) →
//     `reasoning_summary_text.delta` →
//     `reasoning_summary_part.done` (index=0) →
//     (repeat for index>0) →
//   `output_item.done` (reasoning).
// The handlers below rely on this ordering: `onOutputItemAdded` seeds the
// per-item entry, `onReasoningSummaryPartAdded` for `summary_index === 0`
// short-circuits when the entry already exists, and higher-index handlers
// fold against the same entry. Behaviour for out-of-order events is
// best-effort, not guaranteed.
const onOutputItemAdded = (state: ParserState, event: OpenAIResponsesEvent): StepResult => {
  const item = event.item
  if (item && isReasoningItem(item)) {
    if (state.sequentialCutoff) {
      if (state.reasoningCutoffs.has(item.id) || state.reasoningItems[item.id]) return [state, NO_EVENTS]
      const [interrupted, events] = interruptReasoning(state)
      return [
        {
          ...interrupted,
          reasoningItems: {
            [item.id]: { encryptedContent: item.encrypted_content, summaryParts: {} },
          },
        },
        events,
      ]
    }
    const events: LLMEvent[] = []
    return [
      {
        ...state,
        lifecycle: Lifecycle.reasoningStart(state.lifecycle, events, `${item.id}:0`, reasoningMetadata(item)),
        reasoningItems: {
          ...state.reasoningItems,
          [item.id]: { encryptedContent: item.encrypted_content, summaryParts: { 0: "active" } },
        },
      },
      events,
    ]
  }
  const [interrupted, interruptionEvents] = interruptReasoning(state)
  if ((item?.type !== "function_call" && item?.type !== "custom_tool_call") || !item.id)
    return [interrupted, interruptionEvents]
  const providerMetadata = openaiMetadata({ itemId: item.id })
  const toolType = item.type === "custom_tool_call" ? ("custom" as const) : undefined
  const events: LLMEvent[] = [...interruptionEvents]
  const lifecycle = Lifecycle.stepStart(interrupted.lifecycle, events)
  events.push(
    LLMEvent.toolInputStart({
      id: item.call_id ?? item.id,
      name: item.name ?? "",
      toolType,
      providerMetadata,
    }),
  )
  return [
    {
      ...interrupted,
      lifecycle,
      tools: ToolStream.start(interrupted.tools, item.id, {
        id: item.call_id ?? item.id,
        name: item.name ?? "",
        input: item.type === "custom_tool_call" ? (item.input ?? "") : (item.arguments ?? ""),
        toolType,
        providerMetadata,
      }),
    },
    events,
  ]
}

const onReasoningSummaryPartAdded = (state: ParserState, event: OpenAIResponsesEvent): StepResult => {
  if (state.sequentialCutoff) return [state, NO_EVENTS]
  if (!event.item_id || event.summary_index === undefined) return [state, NO_EVENTS]
  const item = state.reasoningItems[event.item_id] ?? { encryptedContent: undefined, summaryParts: {} }
  if (event.summary_index === 0) {
    if (state.reasoningItems[event.item_id]) return [state, NO_EVENTS]
    const events: LLMEvent[] = []
    return [
      {
        ...state,
        lifecycle: Lifecycle.reasoningStart(
          state.lifecycle,
          events,
          `${event.item_id}:0`,
          openaiMetadata({ itemId: event.item_id, reasoningEncryptedContent: null }),
        ),
        reasoningItems: {
          ...state.reasoningItems,
          [event.item_id]: { ...item, summaryParts: { 0: "active" } },
        },
      },
      events,
    ]
  }

  const events: LLMEvent[] = []
  const closed = Object.entries(item.summaryParts)
    .filter((entry) => entry[1] === "can-conclude")
    .reduce(
      (lifecycle, entry) =>
        Lifecycle.reasoningEnd(
          lifecycle,
          events,
          `${event.item_id}:${entry[0]}`,
          openaiMetadata({ itemId: event.item_id }),
        ),
      state.lifecycle,
    )
  return [
    {
      ...state,
      lifecycle: Lifecycle.reasoningStart(
        closed,
        events,
        `${event.item_id}:${event.summary_index}`,
        openaiMetadata({ itemId: event.item_id, reasoningEncryptedContent: item.encryptedContent ?? null }),
      ),
      reasoningItems: {
        ...state.reasoningItems,
        [event.item_id]: {
          ...item,
          summaryParts: {
            ...Object.fromEntries(
              Object.entries(item.summaryParts).map((entry) =>
                entry[1] === "can-conclude" ? [entry[0], "concluded" as const] : entry,
              ),
            ),
            [event.summary_index]: "active",
          },
        },
      },
    },
    events,
  ]
}

const onReasoningSummaryPartDone = (state: ParserState, event: OpenAIResponsesEvent): StepResult => {
  if (state.sequentialCutoff) return [state, NO_EVENTS]
  if (!event.item_id || event.summary_index === undefined) return [state, NO_EVENTS]
  const item = state.reasoningItems[event.item_id]
  if (!item) return [state, NO_EVENTS]
  const events: LLMEvent[] = []
  return [
    {
      ...state,
      lifecycle:
        state.store !== false
          ? Lifecycle.reasoningEnd(
              state.lifecycle,
              events,
              `${event.item_id}:${event.summary_index}`,
              openaiMetadata({ itemId: event.item_id }),
            )
          : state.lifecycle,
      reasoningItems: {
        ...state.reasoningItems,
        [event.item_id]: {
          ...item,
          summaryParts: {
            ...item.summaryParts,
            [event.summary_index]: state.store !== false ? "concluded" : "can-conclude",
          },
        },
      },
    },
    events,
  ]
}

const onFunctionCallArgumentsDelta = Effect.fn("OpenAIResponses.onFunctionCallArgumentsDelta")(function* (
  state: ParserState,
  event: OpenAIResponsesEvent,
) {
  if (!event.item_id || !event.delta) return [state, NO_EVENTS] satisfies StepResult
  const result = ToolStream.appendExisting(
    ADAPTER,
    state.tools,
    event.item_id,
    event.delta,
    "OpenAI Responses tool argument delta is missing its tool call",
  )
  if (ToolStream.isError(result)) return yield* result
  const events: LLMEvent[] = []
  const lifecycle = result.events.length ? Lifecycle.stepStart(state.lifecycle, events) : state.lifecycle
  events.push(...result.events)
  return [{ ...state, lifecycle, tools: result.tools }, events] satisfies StepResult
})

const onOutputItemDone = Effect.fn("OpenAIResponses.onOutputItemDone")(function* (
  state: ParserState,
  event: OpenAIResponsesEvent,
) {
  const item = event.item
  if (!item) return [state, NO_EVENTS] satisfies StepResult

  if (item.type === "function_call" || item.type === "custom_tool_call") {
    if (!item.id || !item.call_id || !item.name) return [state, NO_EVENTS] satisfies StepResult
    const tools = state.tools[item.id]
      ? state.tools
      : ToolStream.start(state.tools, item.id, {
          id: item.call_id,
          name: item.name,
          toolType: item.type === "custom_tool_call" ? "custom" : undefined,
        })
    const input = item.type === "custom_tool_call" ? item.input : item.arguments
    const result =
      input === undefined
        ? yield* ToolStream.finish(ADAPTER, tools, item.id)
        : yield* ToolStream.finishWithInput(ADAPTER, tools, item.id, input)
    const events: LLMEvent[] = []
    const resultEvents = result.events ?? []
    const lifecycle = resultEvents.length ? Lifecycle.stepStart(state.lifecycle, events) : state.lifecycle
    events.push(...resultEvents)
    return [
      {
        ...state,
        lifecycle,
        hasFunctionCall: resultEvents.some(LLMEvent.is.toolCall) ? true : state.hasFunctionCall,
        tools: result.tools,
      },
      events,
    ] satisfies StepResult
  }

  if (isHostedToolItem(item)) {
    const events: LLMEvent[] = []
    const lifecycle = Lifecycle.stepStart(state.lifecycle, events)
    events.push(...hostedToolEvents(item))
    return [{ ...state, lifecycle }, events] satisfies StepResult
  }

  if (isReasoningItem(item)) {
    if (state.sequentialCutoff && state.reasoningCutoffs.has(item.id)) return [state, NO_EVENTS] satisfies StepResult
    const events: LLMEvent[] = []
    const providerMetadata = reasoningMetadata(item)
    const reasoningItem = state.reasoningItems[item.id]
    if (reasoningItem) {
      const lifecycle = Object.entries(reasoningItem.summaryParts)
        .filter((entry) => entry[1] === "active" || entry[1] === "can-conclude")
        .reduce(
          (lifecycle, entry) => Lifecycle.reasoningEnd(lifecycle, events, `${item.id}:${entry[0]}`, providerMetadata),
          state.lifecycle,
        )
      const { [item.id]: _removed, ...reasoningItems } = state.reasoningItems
      return [
        {
          ...state,
          lifecycle,
          reasoningItems,
          reasoningCutoffs: state.sequentialCutoff
            ? new Set([...state.reasoningCutoffs, item.id])
            : state.reasoningCutoffs,
        },
        events,
      ] satisfies StepResult
    }
    if (state.sequentialCutoff) return [state, NO_EVENTS] satisfies StepResult
    if (!state.lifecycle.reasoning.has(item.id)) {
      const lifecycle = Lifecycle.stepStart(state.lifecycle, events)
      events.push(LLMEvent.reasoningStart({ id: item.id, providerMetadata }))
      events.push(LLMEvent.reasoningEnd({ id: item.id, providerMetadata }))
      return [{ ...state, lifecycle }, events] satisfies StepResult
    }
    return [
      { ...state, lifecycle: Lifecycle.reasoningEnd(state.lifecycle, events, item.id, providerMetadata) },
      events,
    ] satisfies StepResult
  }

  return [state, NO_EVENTS] satisfies StepResult
})

const onResponseFinish = (state: ParserState, event: OpenAIResponsesEvent): StepResult => {
  const events: LLMEvent[] = []
  const lifecycle = Lifecycle.finish(state.lifecycle, events, {
    reason: mapFinishReason(event, state.hasFunctionCall),
    usage: mapUsage(event.response?.usage),
    providerMetadata:
      event.response?.id || event.response?.service_tier
        ? openaiMetadata({
            responseId: event.response.id,
            serviceTier: event.response.service_tier,
          })
        : undefined,
  })
  return [{ ...state, lifecycle }, events]
}

// Build a single human-readable message from whatever the provider supplied.
// When both code and message are present, prefix the code so consumers see
// the failure mode (e.g. `rate_limit_exceeded: Slow down`) instead of just
// the bare message — production rate limits and context-length failures used
// to be indistinguishable from generic stream drops.
const providerErrorMessage = (event: OpenAIResponsesEvent, fallback: string): string => {
  const nested = event.response?.error ?? undefined
  const message = event.message || nested?.message || undefined
  const code = event.code || nested?.code || undefined
  if (message && code) return `${code}: ${message}`
  return message || code || fallback
}

const providerError = (event: OpenAIResponsesEvent, fallback: string) => {
  const code = event.code || event.response?.error?.code || undefined
  const message = providerErrorMessage(event, fallback)
  return LLMEvent.providerError({
    message,
    classification: code === "context_length_exceeded" || isContextOverflow(message) ? "context-overflow" : undefined,
  })
}

const onResponseFailed = (state: ParserState, event: OpenAIResponsesEvent): StepResult => [
  state,
  [providerError(event, "OpenAI Responses response failed")],
]

const onError = (state: ParserState, event: OpenAIResponsesEvent): StepResult => [
  state,
  [providerError(event, "OpenAI Responses stream error")],
]

const step = (state: ParserState, event: OpenAIResponsesEvent) => {
  if (event.type === "response.output_text.delta") return Effect.succeed(onOutputTextDelta(state, event))
  if (
    event.type === "response.reasoning_text.delta" ||
    event.type === "response.reasoning_summary.delta" ||
    event.type === "response.reasoning_summary_text.delta"
  )
    return Effect.succeed(onReasoningDelta(state, event))
  if (
    event.type === "response.reasoning_text.done" ||
    event.type === "response.reasoning_summary.done" ||
    event.type === "response.reasoning_summary_text.done"
  )
    return Effect.succeed(onReasoningDone(state, event))
  if (event.type === "response.reasoning_summary_part.added")
    return Effect.succeed(onReasoningSummaryPartAdded(state, event))
  if (event.type === "response.reasoning_summary_part.done")
    return Effect.succeed(onReasoningSummaryPartDone(state, event))
  if (event.type === "response.output_item.added") return Effect.succeed(onOutputItemAdded(state, event))
  if (event.type === "response.function_call_arguments.delta" || event.type === "response.custom_tool_call_input.delta")
    return onFunctionCallArgumentsDelta(state, event)
  if (event.type === "response.output_item.done") return onOutputItemDone(state, event)
  if (event.type === "response.completed" || event.type === "response.incomplete")
    return Effect.succeed(onResponseFinish(state, event))
  if (event.type === "response.failed") return Effect.succeed(onResponseFailed(state, event))
  if (event.type === "error") return Effect.succeed(onError(state, event))
  return Effect.succeed<StepResult>([state, NO_EVENTS])
}

// =============================================================================
// Protocol And OpenAI Route
// =============================================================================
/**
 * The OpenAI Responses protocol — request body construction, body schema, and
 * the streaming-event state machine. Used by native OpenAI and (once
 * registered) Azure OpenAI Responses.
 */
export const protocol = Protocol.make({
  id: ADAPTER,
  body: {
    schema: OpenAIResponsesBody,
    from: fromRequest,
  },
  stream: {
    event: Protocol.jsonEvent(OpenAIResponsesEvent),
    initial: (request) => ({
      hasFunctionCall: false,
      tools: ToolStream.empty<string>(),
      lifecycle: Lifecycle.initial(),
      reasoningItems: {},
      reasoningCutoffs: new Set<string>(),
      store: OpenAIOptions.store(request),
      sequentialCutoff:
        request.model.route.capabilities.includes("sequential-cutoff") &&
        OpenAIOptions.reasoningSummaryDelivery(request) === "sequential_cutoff",
    }),
    step,
    terminal: (event) => TERMINAL_TYPES.has(event.type),
  },
})

const endpoint = Endpoint.path<OpenAIResponsesBody>(PATH, { baseURL: DEFAULT_BASE_URL })
const auth = Auth.none

export const httpTransport = HttpTransport.sseJson.with<OpenAIResponsesBody>()

const headers = ({ request }: { readonly request: LLMRequest }): Record<string, string> =>
  OpenAIOptions.responsesMode(request) === "lite" ? { "x-openai-internal-codex-responses-lite": "true" } : {}

export const route = Route.make({
  id: ADAPTER,
  provider: "openai",
  protocol,
  endpoint,
  auth,
  headers,
  transport: httpTransport,
  capabilities: ["code-mode", "responses-lite", "custom-tools"],
})

const decodeWebSocketMessage = ProviderShared.validateWith(Schema.decodeUnknownEffect(OpenAIResponsesWebSocketMessage))

const webSocketMessage = (body: OpenAIResponsesBody | Record<string, unknown>, request: LLMRequest) =>
  Effect.gen(function* () {
    if (!ProviderShared.isRecord(body))
      return yield* ProviderShared.invalidRequest("OpenAI Responses WebSocket body must be a JSON object")
    const { stream: _stream, ...message } = body
    return yield* decodeWebSocketMessage({
      ...message,
      type: "response.create",
      ...(OpenAIOptions.responsesMode(request) === "lite"
        ? {
            client_metadata: {
              ws_request_header_x_openai_internal_codex_responses_lite: "true",
            },
          }
        : {}),
    })
  })

export const webSocketTransport = WebSocketTransport.jsonTransport.with<
  OpenAIResponsesBody,
  OpenAIResponsesWebSocketMessage
>({
  toMessage: webSocketMessage,
  encodeMessage: encodeWebSocketMessage,
})

export const webSocketRoute = Route.make({
  id: `${ADAPTER}-websocket`,
  provider: "openai",
  protocol,
  endpoint,
  auth,
  headers,
  transport: webSocketTransport,
  capabilities: ["code-mode", "responses-lite", "custom-tools"],
})

export * as OpenAIResponses from "./openai-responses"
