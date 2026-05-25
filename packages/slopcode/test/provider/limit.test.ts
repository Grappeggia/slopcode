import { describe, expect, test } from "bun:test"
import { ProviderLimit } from "../../src/provider/limit"

describe("provider.limit", () => {
  test("parses generic token limit headers", () => {
    const result = ProviderLimit.parse({
      "x-ratelimit-limit-tokens": "1000",
      "x-ratelimit-remaining-tokens": "370",
    })

    expect(result).toEqual({
      kind: "tokens",
      limit: 1000,
      remaining: 370,
      consumed: 630,
      consumedPct: 63,
    })
  })

  test("prefers the most consumed token bucket", () => {
    const result = ProviderLimit.parse({
      "anthropic-ratelimit-input-tokens-limit": "1000",
      "anthropic-ratelimit-input-tokens-remaining": "400",
      "anthropic-ratelimit-output-tokens-limit": "500",
      "anthropic-ratelimit-output-tokens-remaining": "50",
    })

    expect(result).toEqual({
      kind: "output",
      limit: 500,
      remaining: 50,
      consumed: 450,
      consumedPct: 90,
    })
  })

  test("returns undefined when token headers are missing", () => {
    expect(
      ProviderLimit.parse({
        "x-ratelimit-limit-requests": "10",
        "x-ratelimit-remaining-requests": "2",
      }),
    ).toBeUndefined()
  })
})
