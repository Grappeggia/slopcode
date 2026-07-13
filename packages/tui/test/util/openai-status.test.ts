import { describe, expect, test } from "bun:test"
import type { AssistantMessage, Message, Provider } from "@slopcode-ai/sdk/v2"
import {
  accountLabel,
  clamp,
  creditsLabel,
  hasUsageLimits,
  latestContext,
  sessionTokens,
  statusBodyHeight,
  tokens,
  resetAt,
  windowLabel,
} from "../../src/util/openai-status"

function assistant(input: Partial<AssistantMessage> = {}) {
  return {
    role: "assistant",
    providerID: "openai",
    modelID: "gpt-test",
    tokens: { input: 10, output: 5, reasoning: 2, cache: { read: 3, write: 1 } },
    ...input,
  } as AssistantMessage
}

const providers = [
  {
    id: "openai",
    name: "OpenAI",
    source: "api",
    env: [],
    options: {},
    models: { "gpt-test": { limit: { context: 100 } } },
  },
] as unknown as Provider[]

describe("OpenAI status helpers", () => {
  test("distinguishes OAuth, API key, and disconnected accounts", () => {
    expect(accountLabel({ status: "oauth", email: "dev@example.com", plan: "pro" })).toBe("dev@example.com (Pro)")
    expect(accountLabel({ status: "oauth", plan: "plus" })).toBe("Plus")
    expect(accountLabel({ status: "api_key" })).toBe("API key configured")
    expect(accountLabel({ status: "disconnected" })).toBe("ChatGPT disconnected")
  })

  test("labels known and generic windows", () => {
    expect([300, 1_440, 10_080, 43_200, 525_600, 120, 45].map(windowLabel)).toEqual([
      "5h",
      "Daily",
      "Weekly",
      "Monthly",
      "Annual",
      "2h",
      "45m",
    ])
  })

  test("uses a generic label and omits reset text for partial windows", () => {
    expect(windowLabel(undefined)).toBe("Usage limit")
    expect(resetAt(undefined)).toBe("")
  })

  test("clamps percentages", () => {
    expect([clamp(-2), clamp(44), clamp(105)]).toEqual([0, 44, 100])
  })

  test("credit visibility follows hasCredits even when unlimited contradicts it", () => {
    expect(creditsLabel({ hasCredits: false, unlimited: true, balance: "10" })).toBeUndefined()
    expect(creditsLabel({ hasCredits: true, unlimited: true })).toBe("Unlimited")
    expect(creditsLabel({ hasCredits: true, unlimited: false, balance: "10.00" })).toBe("10.00 credits")
  })

  test("reports whether any account limit is available", () => {
    expect(hasUsageLimits({ credits: { hasCredits: false } })).toBe(false)
    expect(hasUsageLimits({ primary: {}, credits: { hasCredits: false } })).toBe(true)
    expect(hasUsageLimits({ credits: { hasCredits: true } })).toBe(true)
  })

  test("uses total when provided and otherwise sums all token fields", () => {
    expect(
      tokens(assistant({ tokens: { total: 50, input: 10, output: 5, reasoning: 2, cache: { read: 3, write: 1 } } })),
    ).toBe(50)
    expect(tokens(assistant())).toBe(21)
  })

  test("uses the latest assistant model's actual context limit", () => {
    expect(
      latestContext(
        [
          assistant({ tokens: { total: 25, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } }),
        ] as Message[],
        providers,
        "openai",
      ),
    ).toMatchObject({
      used: 25,
      full: 100,
      leftPercent: 75,
    })
  })

  test("ignores foreign and empty assistant messages", () => {
    expect(
      latestContext(
        [
          assistant({ tokens: { total: 25, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } }),
          assistant({
            providerID: "anthropic",
            tokens: { total: 50, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          }),
          assistant({ tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } }),
        ] as Message[],
        providers,
        "openai",
      ),
    ).toMatchObject({ used: 25, full: 100, leftPercent: 75 })
  })

  test("treats non-positive context limits as unavailable", () => {
    const invalid = structuredClone(providers)
    invalid[0].models["gpt-test"].limit.context = 0
    expect(latestContext([assistant()] as Message[], invalid, "openai")).toBeUndefined()
  })

  test("bounds status body height to the terminal viewport", () => {
    expect([statusBodyHeight(4), statusBodyHeight(12), statusBodyHeight(40)]).toEqual([1, 5, 26])
  })

  test("session totals distinguish OpenAI API-key usage from other providers", () => {
    expect(
      sessionTokens([assistant(), assistant({ providerID: "anthropic" }), assistant()] as Message[], "openai"),
    ).toBe(42)
  })
})
