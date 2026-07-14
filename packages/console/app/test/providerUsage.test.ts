import { describe, expect, test } from "bun:test"
import type { ZenData } from "@slopcode-ai/console-core/model.js"
import { createResponseConverter, type ProviderHelper } from "../src/routes/zen/util/provider/provider"
import { anthropicHelper } from "../src/routes/zen/util/provider/anthropic"
import { googleHelper } from "../src/routes/zen/util/provider/google"
import { fromOaCompatibleRequest, oaCompatHelper } from "../src/routes/zen/util/provider/openai-compatible"
import { openaiHelper } from "../src/routes/zen/util/provider/openai"
import { calculateUsageCost } from "../src/routes/zen/util/cost"
import { sanitizeSafety } from "../src/routes/zen/util/safety"

const providers = {
  anthropic: anthropicHelper({ reqModel: "claude-haiku-4-5", providerModel: "claude-haiku-4-5" }),
  google: googleHelper({ reqModel: "gemini-3-flash", providerModel: "gemini-3-flash" }),
  openai: openaiHelper({ reqModel: "gpt-5", providerModel: "gpt-5" }),
  "oa-compat": oaCompatHelper({ reqModel: "gpt-5-nano", providerModel: "gpt-5-nano" }),
} satisfies Record<ZenData.Format, ReturnType<ProviderHelper>>

describe("provider usage extraction", () => {
  test("extracts Google non-stream usage metadata", () => {
    const usage = providers.google.extractUsage({
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 3,
        thoughtsTokenCount: 2,
        cachedContentTokenCount: 4,
      },
    })

    expect(providers.google.normalizeUsage(usage)).toEqual({
      inputTokens: 6,
      outputTokens: 3,
      reasoningTokens: 2,
      cacheReadTokens: 4,
      cacheWrite5mTokens: undefined,
      cacheWrite1hTokens: undefined,
    })
  })

  test("parses Google stream usage metadata", () => {
    const usageParser = providers.google.createUsageParser()
    usageParser.parse(
      'data: {"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":3,"thoughtsTokenCount":2,"cachedContentTokenCount":4}}',
    )

    expect(providers.google.normalizeUsage(usageParser.retrieve())).toEqual({
      inputTokens: 6,
      outputTokens: 3,
      reasoningTokens: 2,
      cacheReadTokens: 4,
      cacheWrite5mTokens: undefined,
      cacheWrite1hTokens: undefined,
    })
  })

  test("extracts nested OpenAI Responses usage", () => {
    expect(
      providers.openai.extractUsage({
        response: {
          usage: {
            input_tokens: 5,
            output_tokens: 7,
          },
        },
      }),
    ).toEqual({
      input_tokens: 5,
      output_tokens: 7,
    })
  })

  test("normalizes OpenAI cache writes once", () => {
    expect(
      providers.openai.normalizeUsage({
        input_tokens: 10,
        output_tokens: 2,
        input_tokens_details: { cached_tokens: 3, cache_write_tokens: 4 },
      }),
    ).toMatchObject({ inputTokens: 3, cacheReadTokens: 3, cacheWrite5mTokens: 4 })
  })

  test("overwrites authenticated managed identity and omits anonymous hostile identity", async () => {
    const hostile = { model: "gpt-5.6", safety_identifier: "raw-user", user: "raw-client" }
    const authenticated = await sanitizeSafety(hostile, "wrk_private", "test-secret")
    expect(authenticated.safety_identifier).toMatch(/^sc_[A-Za-z0-9_-]{43}$/)
    expect(authenticated.safety_identifier).not.toContain("wrk_private")
    expect(authenticated.user).toBeUndefined()
    expect(await sanitizeSafety(hostile, undefined, "test-secret")).toEqual({ model: "gpt-5.6" })
  })

  test("charges Gemini thinking tokens at the output rate", () => {
    const result = calculateUsageCost({ input: 0.000001, output: 0.000004 }, undefined, {
      inputTokens: 10,
      outputTokens: 3,
      reasoningTokens: 2,
    })

    expect(result.outputCost).toBe(0.002)
    expect(result.totalCostInCent).toBe(0.003)
  })

  test("normalizes OpenAI reasoning as a subset of provider output", () => {
    expect(
      providers.openai.normalizeUsage({
        input_tokens: 5,
        output_tokens: 7,
        output_tokens_details: { reasoning_tokens: 2 },
      }),
    ).toMatchObject({ outputTokens: 5, reasoningTokens: 2 })
    expect(
      providers["oa-compat"].normalizeUsage({
        prompt_tokens: 5,
        completion_tokens: 7,
        completion_tokens_details: { reasoning_tokens: 2 },
      }),
    ).toMatchObject({ outputTokens: 5, reasoningTokens: 2 })
  })

  test("preserves max_completion_tokens during provider conversion", () => {
    expect(fromOaCompatibleRequest({ messages: [], max_completion_tokens: 4_000 }).max_tokens).toBe(4_000)
  })

  test("preserves cost across non-stream response formats", () => {
    const anthropic = createResponseConverter(
      "anthropic",
      "oa-compat",
    )({
      id: "msg_cost",
      type: "message",
      model: "claude-haiku-4-5",
      content: [{ type: "text", text: "hello" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
      cost: "0.00002000",
    })
    const compatible = createResponseConverter(
      "oa-compat",
      "anthropic",
    )({
      id: "chatcmpl_cost",
      object: "chat.completion",
      model: "gpt-5-nano",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "hello" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      cost: "0.00003000",
    })

    expect(anthropic.cost).toBe("0.00002000")
    expect(compatible.cost).toBe("0.00003000")
  })
})
