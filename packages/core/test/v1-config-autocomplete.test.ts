import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { ConfigV1 } from "@slopcode-ai/core/v1/config/config"

describe("ConfigV1 autocomplete", () => {
  test("accepts the bounded opt-in configuration", () => {
    const config = Schema.decodeUnknownSync(ConfigV1.Info)({
      autocomplete: {
        enabled: true,
        debounce_ms: 180,
        min_prefix_chars: 12,
        max_prefix_chars: 2_000,
        timeout_ms: 2_000,
        max_output_tokens: 48,
        max_completion_chars: 96,
        provider_model_overrides: {
          anthropic: "claude-haiku-4-5",
        },
      },
    })

    expect(config.autocomplete).toEqual({
      enabled: true,
      debounce_ms: 180,
      min_prefix_chars: 12,
      max_prefix_chars: 2_000,
      timeout_ms: 2_000,
      max_output_tokens: 48,
      max_completion_chars: 96,
      provider_model_overrides: {
        anthropic: "claude-haiku-4-5",
      },
    })
  })

  test("rejects values outside every numeric bound", () => {
    const invalid = [
      { debounce_ms: -1 },
      { debounce_ms: 5_001 },
      { min_prefix_chars: 0 },
      { min_prefix_chars: 513 },
      { max_prefix_chars: 63 },
      { max_prefix_chars: 8_193 },
      { timeout_ms: 249 },
      { timeout_ms: 10_001 },
      { max_output_tokens: 0 },
      { max_output_tokens: 129 },
      { max_completion_chars: 0 },
      { max_completion_chars: 513 },
    ]

    invalid.forEach((autocomplete) => {
      expect(() => Schema.decodeUnknownSync(ConfigV1.Info)({ autocomplete })).toThrow()
    })
  })
})
