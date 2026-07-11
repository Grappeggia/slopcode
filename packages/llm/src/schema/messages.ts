import { Schema } from "effect"
import { JsonSchema, MessageRole, ProviderMetadata, ToolType } from "./ids"
import { CacheHint, CachePolicy, GenerationOptions, HttpOptions, ModelSchema, ProviderOptions } from "./options"
import { isRecord } from "../utils/record"

const systemPartSchema = Schema.Struct({
  type: Schema.Literal("text"),
  text: Schema.String,
  cache: Schema.optional(CacheHint),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
}).annotate({ identifier: "LLM.SystemPart" })
export type SystemPart = Schema.Schema.Type<typeof systemPartSchema>

const makeSystemPart = (text: string): SystemPart => ({ type: "text", text })

export const SystemPart = Object.assign(systemPartSchema, {
  make: makeSystemPart,
  content: (input?: string | SystemPart | ReadonlyArray<SystemPart>) => {
    if (input === undefined) return []
    return typeof input === "string" ? [makeSystemPart(input)] : Array.isArray(input) ? [...input] : [input]
  },
})

export const TextPart = Schema.Struct({
  type: Schema.Literal("text"),
  text: Schema.String,
  cache: Schema.optional(CacheHint),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  providerMetadata: Schema.optional(ProviderMetadata),
}).annotate({ identifier: "LLM.Content.Text" })
export type TextPart = Schema.Schema.Type<typeof TextPart>

export const MediaPart = Schema.Struct({
  type: Schema.Literal("media"),
  mediaType: Schema.String,
  data: Schema.Union([Schema.String, Schema.Uint8Array]),
  filename: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
}).annotate({ identifier: "LLM.Content.Media" })
export type MediaPart = Schema.Schema.Type<typeof MediaPart>

export const ToolTextContent = Schema.Struct({
  type: Schema.Literal("text"),
  text: Schema.String,
}).annotate({ identifier: "Tool.TextContent" })
export type ToolTextContent = typeof ToolTextContent.Type

export const ToolFileContent = Schema.Struct({
  type: Schema.Literal("file"),
  uri: Schema.String,
  mime: Schema.String,
  name: Schema.optional(Schema.String),
}).annotate({ identifier: "Tool.FileContent" })
export type ToolFileContent = typeof ToolFileContent.Type

/** Ordered, provider-independent content shown to models and UIs after a tool succeeds. */
export const ToolContent = Schema.Union([ToolTextContent, ToolFileContent]).pipe(Schema.toTaggedUnion("type"))
export type ToolContent = Schema.Schema.Type<typeof ToolContent>

const isToolResultValue = (value: unknown): value is ToolResultValue =>
  isRecord(value) &&
  (value.type === "text" || value.type === "json" || value.type === "error" || value.type === "content") &&
  "value" in value

export const ToolResultValue = Object.assign(
  Schema.Union([
    Schema.Struct({
      type: Schema.Literal("json"),
      value: Schema.Unknown,
    }),
    Schema.Struct({
      type: Schema.Literal("text"),
      value: Schema.Unknown,
    }),
    Schema.Struct({
      type: Schema.Literal("error"),
      value: Schema.Unknown,
    }),
    Schema.Struct({
      type: Schema.Literal("content"),
      value: Schema.Array(ToolContent),
    }),
  ]).annotate({ identifier: "LLM.ToolResult" }),
  {
    is: isToolResultValue,
    make: (value: unknown, type: ToolResultValue["type"] = "json"): ToolResultValue => {
      if (isToolResultValue(value)) return value
      if (type === "content") return { type, value: Array.isArray(value) ? value : [] }
      return { type, value }
    },
  },
)
export type ToolResultValue = Schema.Schema.Type<typeof ToolResultValue>

export interface ToolOutput {
  readonly structured: unknown
  readonly content: ReadonlyArray<ToolContent>
}

export const ToolOutput = Object.assign(
  Schema.Struct({
    structured: Schema.Unknown,
    content: Schema.Array(ToolContent),
  }).annotate({ identifier: "LLM.ToolOutput" }),
  {
    make: (structured: unknown, content: ReadonlyArray<ToolContent> = []): ToolOutput => ({ structured, content }),
    fromResultValue: (result: ToolResultValue): ToolOutput | undefined => {
      switch (result.type) {
        case "json":
          return { structured: result.value, content: [] }
        case "text":
          return { structured: {}, content: [{ type: "text", text: toolResultText(result.value) }] }
        case "content":
          return { structured: {}, content: result.value }
        case "error":
          return undefined
      }
    },
    toResultValue: (output: ToolOutput): ToolResultValue => {
      if (output.content.length === 0) return { type: "json", value: output.structured }
      if (output.content.length === 1 && output.content[0]?.type === "text")
        return { type: "text", value: output.content[0].text }
      return { type: "content", value: output.content }
    },
  },
)

const toolResultText = (value: unknown) => {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

const ToolCallPartFields = {
  type: Schema.Literal("tool-call"),
  id: Schema.String,
  name: Schema.String,
  providerExecuted: Schema.optional(Schema.Boolean),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  providerMetadata: Schema.optional(ProviderMetadata),
}

const ToolCallPartBase = Schema.Struct({
  ...ToolCallPartFields,
  input: Schema.Unknown,
  toolType: Schema.optional(ToolType),
})
type ToolCallPartBase = Schema.Schema.Type<typeof ToolCallPartBase>
export type ToolCallPart = Omit<ToolCallPartBase, "input" | "toolType"> &
  ({ readonly input: unknown; readonly toolType?: "function" } | { readonly input: string; readonly toolType: "custom" })
const ToolCallPartSchema = ToolCallPartBase.pipe(
  Schema.refine(
    (value): value is ToolCallPart => value.toolType !== "custom" || typeof value.input === "string",
    { message: "Custom tool call input must be a string" },
  ),
).annotate({ identifier: "LLM.Content.ToolCall" })

type ToolCallPartInput = ToolCallPart extends infer Part
  ? Part extends { readonly type: "tool-call" }
    ? Omit<Part, "type">
    : never
  : never

export const ToolCallPart = Object.assign(ToolCallPartSchema, {
  make: (input: ToolCallPartInput): ToolCallPart => {
    if (input.toolType === "custom" && typeof input.input !== "string")
      throw new TypeError("Custom tool call input must be a string")
    return { type: "tool-call", ...input } as ToolCallPart
  },
})

const ToolResultPartFields = {
  type: Schema.Literal("tool-result"),
  id: Schema.String,
  name: Schema.String,
  result: ToolResultValue,
  providerExecuted: Schema.optional(Schema.Boolean),
  cache: Schema.optional(CacheHint),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  providerMetadata: Schema.optional(ProviderMetadata),
}

const ToolResultPartBase = Schema.Struct({
  ...ToolResultPartFields,
  toolType: Schema.optional(ToolType),
})
type ToolResultPartBase = Schema.Schema.Type<typeof ToolResultPartBase>
export type ToolResultPart = Omit<ToolResultPartBase, "toolType"> &
  ({ readonly toolType?: "function" } | { readonly toolType: "custom" })
const ToolResultPartSchema = ToolResultPartBase.pipe(
  Schema.refine(
    (value): value is ToolResultPart =>
      value.toolType === undefined || value.toolType === "function" || value.toolType === "custom",
  ),
).annotate({ identifier: "LLM.Content.ToolResult" })

type ToolResultPartInput = ToolResultPart extends infer Part
  ? Part extends { readonly type: "tool-result" }
    ? Omit<Part, "type" | "result"> & {
        readonly result: unknown
        readonly resultType?: ToolResultValue["type"]
      }
    : never
  : never

export const ToolResultPart = Object.assign(ToolResultPartSchema, {
  make: (input: ToolResultPartInput): ToolResultPart =>
    ({
      type: "tool-result",
      id: input.id,
      name: input.name,
      result: ToolResultValue.make(input.result, input.resultType),
      toolType: input.toolType,
      providerExecuted: input.providerExecuted,
      cache: input.cache,
      metadata: input.metadata,
      providerMetadata: input.providerMetadata,
    }) as ToolResultPart,
})

export const ReasoningPart = Schema.Struct({
  type: Schema.Literal("reasoning"),
  text: Schema.String,
  encrypted: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  providerMetadata: Schema.optional(ProviderMetadata),
}).annotate({ identifier: "LLM.Content.Reasoning" })
export type ReasoningPart = Schema.Schema.Type<typeof ReasoningPart>

export const ContentPart = Schema.Union([TextPart, MediaPart, ToolCallPart, ToolResultPart, ReasoningPart]).pipe(
  Schema.toTaggedUnion("type"),
)
export type ContentPart = Schema.Schema.Type<typeof ContentPart>

export class Message extends Schema.Class<Message>("LLM.Message")({
  id: Schema.optional(Schema.String),
  role: MessageRole,
  content: Schema.Array(ContentPart),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  native: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
}) {}

export namespace Message {
  export type ContentInput = string | ContentPart | ReadonlyArray<ContentPart>
  export type SystemContentInput = string | TextPart | ReadonlyArray<TextPart>
  export type Input = Omit<ConstructorParameters<typeof Message>[0], "content"> & {
    readonly content: ContentInput
  }

  export const text = (value: string): ContentPart => ({ type: "text", text: value })

  export const content = (input: ContentInput) =>
    typeof input === "string" ? [text(input)] : Array.isArray(input) ? [...input] : [input]

  export const make = (input: Message | Input) => {
    if (input instanceof Message) return input
    return new Message({ ...input, content: content(input.content) })
  }

  export const user = (content: ContentInput) => make({ role: "user", content })

  export const assistant = (content: ContentInput) => make({ role: "assistant", content })

  /**
   * Add an operator-authored instruction at this chronological point in the
   * conversation. This is distinct from the initial `LLMRequest.system`
   * prompt. Keep raw retrieved, tool, and web content out of privileged system
   * updates; pass that untrusted content through ordinary user/tool channels.
   */
  export const system = (content: SystemContentInput) => make({ role: "system", content })

  export const tool = (result: ToolResultPart | Parameters<typeof ToolResultPart.make>[0]) =>
    make({ role: "tool", content: ["type" in result ? result : ToolResultPart.make(result)] })
}

export class ToolDefinition extends Schema.Class<ToolDefinition>("LLM.ToolDefinition")({
  name: Schema.String,
  description: Schema.String,
  inputSchema: JsonSchema,
  outputSchema: Schema.optional(JsonSchema),
  cache: Schema.optional(CacheHint),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  native: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
}) {}

export const CustomToolFormat = Schema.Struct({
  type: Schema.Literal("grammar"),
  syntax: Schema.Literal("lark"),
  definition: Schema.String,
}).annotate({ identifier: "LLM.CustomToolFormat" })
export type CustomToolFormat = Schema.Schema.Type<typeof CustomToolFormat>

export class CustomToolDefinition extends Schema.Class<CustomToolDefinition>("LLM.CustomToolDefinition")({
  type: Schema.tag("custom"),
  name: Schema.String,
  description: Schema.String,
  format: Schema.optional(CustomToolFormat),
  cache: Schema.optional(CacheHint),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  native: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
}) {}

export namespace CustomToolDefinition {
  export type Input = CustomToolDefinition | ConstructorParameters<typeof CustomToolDefinition>[0]
}

export const ToolDefinitionSchema = Schema.Union([ToolDefinition, CustomToolDefinition])
export type AnyToolDefinition = Schema.Schema.Type<typeof ToolDefinitionSchema>
export const isCustomToolDefinition = (tool: AnyToolDefinition): tool is CustomToolDefinition =>
  "type" in tool && tool.type === "custom"
export const isFunctionToolDefinition = (tool: AnyToolDefinition): tool is ToolDefinition =>
  !isCustomToolDefinition(tool)

export namespace ToolDefinition {
  export type Input =
    | ToolDefinition
    | ConstructorParameters<typeof ToolDefinition>[0]
    | CustomToolDefinition
    | ConstructorParameters<typeof CustomToolDefinition>[0]

  /** Normalize function or custom tool input into its canonical class. */
  export function make(
    input: ToolDefinition | ConstructorParameters<typeof ToolDefinition>[0],
  ): ToolDefinition
  export function make(
    input: CustomToolDefinition | ConstructorParameters<typeof CustomToolDefinition>[0],
  ): CustomToolDefinition
  export function make(input: Input): AnyToolDefinition {
    if (input instanceof ToolDefinition || input instanceof CustomToolDefinition) return input
    if ("inputSchema" in input) return new ToolDefinition(input)
    return new CustomToolDefinition(input)
  }
}

export class ToolChoice extends Schema.Class<ToolChoice>("LLM.ToolChoice")({
  type: Schema.Literals(["auto", "none", "required", "tool"]),
  name: Schema.optional(Schema.String),
  toolType: Schema.optional(ToolType),
}) {}

export namespace ToolChoice {
  export type Mode = Exclude<ToolChoice["type"], "tool">
  export type Input = ToolChoice | ConstructorParameters<typeof ToolChoice>[0] | AnyToolDefinition | string

  const isMode = (value: string): value is Mode => value === "auto" || value === "none" || value === "required"

  /** Select a specific named tool. */
  export const named = (value: string, toolType?: ToolType) => new ToolChoice({ type: "tool", name: value, toolType })

  /** Normalize ergonomic tool-choice inputs into the canonical `ToolChoice` class. */
  export const make = (input: Input) => {
    if (input instanceof ToolChoice) return input
    if (input instanceof CustomToolDefinition) return named(input.name, "custom")
    if (input instanceof ToolDefinition) return named(input.name)
    if (typeof input === "string") return isMode(input) ? new ToolChoice({ type: input }) : named(input)
    return new ToolChoice(input)
  }
}

export const ResponseFormat = Schema.Union([
  Schema.Struct({ type: Schema.Literal("text") }),
  Schema.Struct({ type: Schema.Literal("json"), schema: JsonSchema }),
  Schema.Struct({ type: Schema.Literal("tool"), tool: ToolDefinition }),
]).pipe(Schema.toTaggedUnion("type"))
export type ResponseFormat = Schema.Schema.Type<typeof ResponseFormat>

export class LLMRequest extends Schema.Class<LLMRequest>("LLM.Request")({
  id: Schema.optional(Schema.String),
  model: ModelSchema,
  system: Schema.Array(SystemPart),
  messages: Schema.Array(Message),
  tools: Schema.Array(ToolDefinitionSchema),
  toolChoice: Schema.optional(ToolChoice),
  generation: Schema.optional(GenerationOptions),
  providerOptions: Schema.optional(ProviderOptions),
  http: Schema.optional(HttpOptions),
  responseFormat: Schema.optional(ResponseFormat),
  cache: Schema.optional(CachePolicy),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
}) {}

export namespace LLMRequest {
  export type Input = ConstructorParameters<typeof LLMRequest>[0]

  export const input = (request: LLMRequest): Input => ({
    id: request.id,
    model: request.model,
    system: request.system,
    messages: request.messages,
    tools: request.tools,
    toolChoice: request.toolChoice,
    generation: request.generation,
    providerOptions: request.providerOptions,
    http: request.http,
    responseFormat: request.responseFormat,
    cache: request.cache,
    metadata: request.metadata,
  })

  export const update = (request: LLMRequest, patch: Partial<Input>) => {
    if (Object.keys(patch).length === 0) return request
    return new LLMRequest({
      ...input(request),
      ...patch,
      model: patch.model ?? request.model,
    })
  }
}
