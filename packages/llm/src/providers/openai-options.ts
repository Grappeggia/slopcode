import type { ProviderOptions, ReasoningEffort, TextVerbosity } from "../schema"
import { mergeProviderOptions } from "../schema"
import type {
  OpenAIReasoningContext,
  OpenAIResponseIncludable,
  OpenAIResponsesMode,
  OpenAIServiceTier,
  OpenAITruncation,
} from "../protocols/utils/openai-options"

export type {
  OpenAIReasoningContext,
  OpenAIResponseIncludable,
  OpenAIResponsesMode,
  OpenAIServiceTier,
  OpenAITruncation,
} from "../protocols/utils/openai-options"

export interface OpenAIOptionsInput {
  readonly [key: string]: unknown
  readonly store?: boolean
  readonly promptCacheKey?: string
  readonly safetyIdentifier?: string
  readonly promptCacheOptions?: OpenAIPromptCacheOptions
  readonly instructions?: string
  readonly reasoningEffort?: ReasoningEffort
  readonly reasoningSummary?: "auto" | "none"
  readonly reasoningContext?: OpenAIReasoningContext
  // OpenAI Responses `include` wire field. Mirrors the official SDK's
  // `ResponseIncludable[]` union exactly so AI SDK callers and direct
  // native-SDK callers share one shape and no translation is required.
  readonly include?: ReadonlyArray<OpenAIResponseIncludable>
  readonly textVerbosity?: TextVerbosity
  readonly serviceTier?: OpenAIServiceTier
  readonly parallelToolCalls?: boolean
  readonly truncation?: OpenAITruncation
  readonly responsesMode?: OpenAIResponsesMode
  readonly reasoningSummaryDelivery?: "sequential_cutoff"
}

export interface OpenAIPromptCacheOptions {
  readonly mode: "explicit"
  readonly ttl: "30m"
}

export type OpenAIProviderOptionsInput = ProviderOptions & {
  readonly openai?: OpenAIOptionsInput
}

const definedEntries = (input: Record<string, unknown>) =>
  Object.entries(input).filter((entry) => entry[1] !== undefined)

export const make = (options: OpenAIOptionsInput | undefined): ProviderOptions | undefined => {
  const openai = Object.fromEntries(
    definedEntries({
      store: options?.store,
      promptCacheKey: options?.promptCacheKey,
      safetyIdentifier: options?.safetyIdentifier,
      promptCacheOptions: options?.promptCacheOptions,
      instructions: options?.instructions,
      reasoningEffort: options?.reasoningEffort,
      reasoningSummary: options?.reasoningSummary,
      reasoningContext: options?.reasoningContext,
      include: options?.include,
      textVerbosity: options?.textVerbosity,
      serviceTier: options?.serviceTier,
      parallelToolCalls: options?.parallelToolCalls,
      truncation: options?.truncation,
      responsesMode: options?.responsesMode,
      reasoningSummaryDelivery: options?.reasoningSummaryDelivery,
    }),
  )
  if (Object.keys(openai).length === 0) return undefined
  return { openai }
}

export const gpt5DefaultOptions = (
  modelID: string,
  options: { readonly textVerbosity?: boolean } = {},
): ProviderOptions | undefined => {
  const id = modelID.toLowerCase()
  if (!id.includes("gpt-5") || id.includes("gpt-5-chat") || id.includes("gpt-5-pro")) return undefined
  return make({
    reasoningEffort: "medium",
    reasoningSummary: "auto",
    // GPT-5 reasoning models are configured stateless (`store: false`) by
    // `openAIDefaultOptions` below, so the only way a follow-up turn can
    // carry reasoning state is via the encrypted reasoning include. Without
    // this, callers using the default model facade get reasoning summaries
    // they cannot replay statelessly.
    include: ["reasoning.encrypted_content"],
    textVerbosity:
      options.textVerbosity === true && id.includes("gpt-5.") && !id.includes("codex") && !id.includes("-chat")
        ? "low"
        : undefined,
  })
}

export const openAIDefaultOptions = (
  modelID: string,
  options: { readonly textVerbosity?: boolean } = {},
): ProviderOptions | undefined => mergeProviderOptions(make({ store: false }), gpt5DefaultOptions(modelID, options))

export const withOpenAIOptions = <Options extends { readonly providerOptions?: OpenAIProviderOptionsInput }>(
  modelID: string,
  options: Options,
  defaults: { readonly textVerbosity?: boolean } = {},
): Omit<Options, "providerOptions"> & { readonly providerOptions?: ProviderOptions } => {
  return {
    ...options,
    providerOptions: mergeProviderOptions(openAIDefaultOptions(modelID, defaults), options.providerOptions),
  }
}

export * as OpenAIProviderOptions from "./openai-options"
