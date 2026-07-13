import { describe, expect, test } from "bun:test"
import type { AssistantMessage, Message, Provider } from "@slopcode-ai/sdk/v2"
import {
  OPENAI_LOADING,
  accountLabel,
  clamp,
  creditsLabel,
  hasUsageLimits,
  latestContext,
  loadOpenAIUsage,
  sessionTokens,
  statusLabel,
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
  test("formats OAuth account labels without exposing more than optional email", () => {
    expect(accountLabel({ status: "oauth", email: "dev@example.com", plan: "pro", capturedAt: 1 })).toBe(
      "dev@example.com (Pro)",
    )
    expect(accountLabel({ status: "oauth", plan: "team_plan", capturedAt: 1 })).toBe("Team Plan")
  })

  test("uses exact ChatGPT Codex state wording", () => {
    expect(OPENAI_LOADING).toBe("Loading ChatGPT Codex usage...")
    expect(statusLabel({ status: "disconnected" })).toBe("No ChatGPT account connected.")
    expect(statusLabel({ status: "api_key" })).toBe(
      "OpenAI API key configured. ChatGPT Codex plan limits do not apply.",
    )
    expect(statusLabel({ status: "unavailable" })).toBe("ChatGPT Codex usage is currently unavailable.")
  })

  test("keeps V2 OAuth authoritative", async () => {
    let calls = 0
    const usage = await loadOpenAIUsage(
      async () => ({ status: "oauth", plan: "plus", capturedAt: 1 }),
      async () => {
        calls++
        return { status: "api_key" }
      },
    )
    expect(usage).toEqual({ status: "oauth", plan: "plus", capturedAt: 1 })
    expect(calls).toBe(0)
  })

  test("keeps V2 API key and unavailable states authoritative", async () => {
    for (const status of ["api_key", "unavailable"] as const) {
      let calls = 0
      expect(
        await loadOpenAIUsage(
          async () => ({ status }),
          async () => {
            calls++
            return { status: "oauth", plan: "plus", capturedAt: 1 }
          },
        ),
      ).toEqual({ status })
      expect(calls).toBe(0)
    }
  })

  test("invokes V2 before legacy when V2 is disconnected", async () => {
    const calls: string[] = []
    expect(
      await loadOpenAIUsage(
        async () => {
          calls.push("v2")
          return { status: "disconnected" }
        },
        async () => {
          calls.push("legacy")
          return { status: "oauth", plan: "plus", capturedAt: 1 }
        },
      ),
    ).toEqual({ status: "oauth", plan: "plus", capturedAt: 1 })
    expect(calls).toEqual(["v2", "legacy"])
  })

  test("falls back to legacy when V2 transport fails", async () => {
    expect(
      await loadOpenAIUsage(
        async () => {
          throw new Error("unsupported route")
        },
        async () => ({ status: "api_key" }),
      ),
    ).toEqual({ status: "api_key" })
  })

  test("falls back to legacy when the V2 method throws synchronously", async () => {
    expect(
      await loadOpenAIUsage(
        () => {
          throw new Error("missing method")
        },
        async () => ({ status: "api_key" }),
      ),
    ).toEqual({ status: "api_key" })
  })

  test("preserves a legacy disconnected result", async () => {
    expect(
      await loadOpenAIUsage(
        async () => {
          throw new Error("unsupported route")
        },
        async () => ({ status: "disconnected" }),
      ),
    ).toEqual({ status: "disconnected" })
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
