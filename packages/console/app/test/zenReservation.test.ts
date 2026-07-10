import { describe, expect, test } from "bun:test"
import { DEFAULT_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS, prepareReservation } from "../src/routes/zen/util/reservation"

const cost = {
  input: 0.000001,
  output: 0.000002,
  cacheRead: 0.0000005,
  cacheWrite5m: 0.00000125,
}

describe("Zen reservation bound", () => {
  test("applies a documented default output bound to every request format", () => {
    const anthropic: Record<string, unknown> = { messages: [] }
    const openai: Record<string, unknown> = { input: [] }
    const compatible: Record<string, unknown> = { messages: [] }
    const google: Record<string, unknown> = { contents: [] }

    expect(prepareReservation(anthropic, "anthropic", cost).outputTokens).toBe(DEFAULT_OUTPUT_TOKENS)
    expect(prepareReservation(openai, "openai", cost).outputTokens).toBe(DEFAULT_OUTPUT_TOKENS)
    expect(prepareReservation(compatible, "oa-compat", cost).outputTokens).toBe(DEFAULT_OUTPUT_TOKENS)
    expect(prepareReservation(google, "google", cost).outputTokens).toBe(DEFAULT_OUTPUT_TOKENS)
    expect(anthropic.max_tokens).toBe(DEFAULT_OUTPUT_TOKENS)
    expect(openai.max_output_tokens).toBe(DEFAULT_OUTPUT_TOKENS)
    expect(compatible.max_tokens).toBe(DEFAULT_OUTPUT_TOKENS)
    expect((google.generationConfig as Record<string, unknown>).maxOutputTokens).toBe(DEFAULT_OUTPUT_TOKENS)
  })

  test("uses an explicit output bound and rejects an unreservable request", () => {
    expect(prepareReservation({ max_tokens: 1_000 }, "oa-compat", cost).outputTokens).toBe(1_000)
    expect(() => prepareReservation({ max_tokens: MAX_OUTPUT_TOKENS + 1 }, "oa-compat", cost)).toThrow(
      `max output tokens must be at most ${MAX_OUTPUT_TOKENS}`,
    )
  })

  test("holds worst-case input/cache and output pricing in integer microcents", () => {
    const result = prepareReservation(
      { messages: [{ role: "user", content: "hello" }], max_tokens: 100 },
      "oa-compat",
      cost,
      { input: 0.000002, output: 0.000003, cacheWrite1h: 0.000004 },
    )
    const expected = Math.ceil((result.inputTokens * 0.000004 + result.outputTokens * 0.000003) * 100_000_000)

    expect(result.inputTokens).toBeGreaterThan(4_096)
    expect(result.amount).toBe(expected)
    expect(Number.isSafeInteger(result.amount)).toBe(true)
  })

  test("adds a bounded token allowance for remote media whose size is not in the request", () => {
    const text = prepareReservation({ messages: [], max_tokens: 100 }, "oa-compat", cost)
    const image = prepareReservation(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "image_url", image_url: { url: "https://example.com/image.png" } }],
          },
        ],
        max_tokens: 100,
      },
      "oa-compat",
      cost,
    )

    expect(image.inputTokens - text.inputTokens).toBeGreaterThan(64_000)
  })

  test("recognizes completion and model-specific output limits", () => {
    const body: Record<string, unknown> = { messages: [], max_completion_tokens: 4_000 }
    expect(prepareReservation(body, "oa-compat", cost, undefined, { limit: { output: 8_000 } }).outputTokens).toBe(
      4_000,
    )
    expect(body.max_tokens).toBeUndefined()
    expect(() =>
      prepareReservation({ messages: [], max_completion_tokens: 8_001 }, "oa-compat", cost, undefined, {
        limit: { output: 8_000 },
      }),
    ).toThrow("max output tokens must be at most 8000")
  })

  test("bounds both original and provider-converted payload bytes", () => {
    const body = { messages: [{ role: "user", content: "small" }], max_tokens: 100 }
    const converted = { input: [{ role: "user", content: "x".repeat(20_000) }], max_output_tokens: 100 }
    const result = prepareReservation(body, "oa-compat", cost, undefined, { payloads: [converted] })

    expect(result.inputTokens).toBeGreaterThan(20_000)
  })

  test("holds the available context when prior response state hides input", () => {
    const result = prepareReservation(
      { previous_response_id: "resp_123", input: "continue", max_output_tokens: 1_000 },
      "openai",
      cost,
      undefined,
      { limit: { context: 200_000, output: 16_000 } },
    )

    expect(result.inputTokens).toBe(199_000)
  })

  test("uses UTF-8 byte length rather than JavaScript character count", () => {
    const ascii = prepareReservation({ messages: [{ content: "a" }], max_tokens: 100 }, "oa-compat", cost)
    const unicode = prepareReservation({ messages: [{ content: "é" }], max_tokens: 100 }, "oa-compat", cost)

    expect(unicode.inputTokens - ascii.inputTokens).toBe(1)
  })
})
