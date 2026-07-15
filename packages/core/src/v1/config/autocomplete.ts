export * as ConfigAutocompleteV1 from "./autocomplete"

import { Schema } from "effect"

export const Limits = {
  debounce_ms: { minimum: 0, maximum: 5_000 },
  min_prefix_chars: { minimum: 1, maximum: 512 },
  max_prefix_chars: { minimum: 64, maximum: 8_192 },
  timeout_ms: { minimum: 250, maximum: 10_000 },
  max_output_tokens: { minimum: 1, maximum: 128 },
  max_completion_chars: { minimum: 1, maximum: 512 },
} as const

export const Defaults = {
  enabled: false,
  debounce_ms: 180,
  min_prefix_chars: 12,
  max_prefix_chars: 2_000,
  timeout_ms: 2_000,
  max_output_tokens: 48,
  max_completion_chars: 96,
  provider_model_overrides: {},
} as const

const bounded = (range: { minimum: number; maximum: number }) => Schema.Int.check(Schema.isBetween(range))
const Model = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(256))

export const Info = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean).annotate({
    description: "Enable model-powered TUI prompt autocomplete (default: false)",
  }),
  debounce_ms: Schema.optional(bounded(Limits.debounce_ms)).annotate({
    description: "Debounce delay before requesting autocomplete in milliseconds (default: 180)",
  }),
  min_prefix_chars: Schema.optional(bounded(Limits.min_prefix_chars)).annotate({
    description: "Minimum non-whitespace prefix characters required for autocomplete (default: 12)",
  }),
  max_prefix_chars: Schema.optional(bounded(Limits.max_prefix_chars)).annotate({
    description: "Maximum trailing prefix characters sent for autocomplete (default: 2000)",
  }),
  timeout_ms: Schema.optional(bounded(Limits.timeout_ms)).annotate({
    description: "Total autocomplete request timeout in milliseconds (default: 2000)",
  }),
  max_output_tokens: Schema.optional(bounded(Limits.max_output_tokens)).annotate({
    description: "Maximum autocomplete output tokens (default: 48)",
  }),
  max_completion_chars: Schema.optional(bounded(Limits.max_completion_chars)).annotate({
    description: "Maximum autocomplete completion characters (default: 96)",
  }),
  provider_model_overrides: Schema.optional(Schema.Record(Schema.String, Model)).annotate({
    description: "Autocomplete model ID override by provider; overrides never route across providers",
  }),
}).annotate({ identifier: "AutocompleteConfig" })

export type Info = Schema.Schema.Type<typeof Info>

export type Resolved = {
  enabled: boolean
  debounce_ms: number
  min_prefix_chars: number
  max_prefix_chars: number
  timeout_ms: number
  max_output_tokens: number
  max_completion_chars: number
  provider_model_overrides: Record<string, string>
}

export function resolve(input?: Info): Resolved {
  return {
    enabled: input?.enabled ?? Defaults.enabled,
    debounce_ms: input?.debounce_ms ?? Defaults.debounce_ms,
    min_prefix_chars: input?.min_prefix_chars ?? Defaults.min_prefix_chars,
    max_prefix_chars: input?.max_prefix_chars ?? Defaults.max_prefix_chars,
    timeout_ms: input?.timeout_ms ?? Defaults.timeout_ms,
    max_output_tokens: input?.max_output_tokens ?? Defaults.max_output_tokens,
    max_completion_chars: input?.max_completion_chars ?? Defaults.max_completion_chars,
    provider_model_overrides: input?.provider_model_overrides ? { ...input.provider_model_overrides } : {},
  }
}
