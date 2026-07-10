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
})
