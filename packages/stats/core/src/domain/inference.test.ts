import { describe, expect, test } from "bun:test"
import { buildStatsQuery, toGeoAggregate, toModelAggregate, toProviderAggregate } from "./inference"
import { modelAuthor, normalizeInferenceModel, statModel, statProvider } from "./model-normalization"

process.env.SST_RESOURCES_JSON ??= JSON.stringify({
  App: { name: "stats-test", stage: "test" },
  InferenceEvent: { catalog: "catalog", database: "database", table: "inference" },
  StatsSyncConfig: { dataset: "zen" },
})

describe("inference stat normalization", () => {
  test("normalizes model suffixes used by router/provider variants", () => {
    expect(normalizeInferenceModel("deepseek-v4-flash-free")).toBe("deepseek-v4-flash")
    expect(normalizeInferenceModel("deepseek-v4-flash:global")).toBe("deepseek-v4-flash")
    expect(normalizeInferenceModel("mimo-v2.5-free")).toBe("mimo-v2.5")
    expect(normalizeInferenceModel("nemotron-3-super-free")).toBe("nemotron-3-super")
    expect(normalizeInferenceModel("mimo-v2.5-free:global")).toBe("mimo-v2.5")
  })

  test("maps normalized model ids to public authors", () => {
    expect(modelAuthor("big-pickle")).toBe("unknown")
    expect(modelAuthor("claude-sonnet-4-5")).toBe("anthropic")
    expect(modelAuthor("deepseek-v4-pro")).toBe("deepseek")
    expect(modelAuthor("gemini-3.5-flash")).toBe("google")
    expect(modelAuthor("glm-5.1")).toBe("zhipu")
    expect(modelAuthor("gpt-5.5-pro")).toBe("openai")
    expect(modelAuthor("grok-build-0.1")).toBe("xai")
    expect(modelAuthor("hy3-preview")).toBe("tencent")
    expect(modelAuthor("kimi-k2.6")).toBe("moonshot")
    expect(modelAuthor("mimo-v2-omni")).toBe("xiaomi")
    expect(modelAuthor("minimax-m2.7")).toBe("minimax")
    expect(modelAuthor("nemotron-3-super-free")).toBe("nvidia")
    expect(modelAuthor("qwen3.7-max")).toBe("qwen")
    expect(modelAuthor("alpha-gpt-next")).toBeUndefined()
  })

  test("uses provider.model and model authors to resolve router providers", () => {
    expect(statModel("big-pickle", "claude-sonnet-4-5")).toBe("claude-sonnet-4-5")
    expect(statModel("big-pickle", "gpt-5-free")).toBe("gpt-5")
    expect(statModel("big-pickle", "")).toBe("unknown")
    for (const provider of ["slopcode", "opencode"]) {
      expect(statProvider("big-pickle", "claude-sonnet-4-5", provider)).toBe("anthropic")
      expect(statProvider("gpt-5", "", provider)).toBe("openai")
      expect(statProvider("big-pickle", "", provider)).toBe("unknown")
    }
    expect(statProvider("unknown", "", "custom-provider")).toBe("custom-provider")
  })

  test("model aggregates prefer provider.model without exposing router providers", () => {
    expect(toModelAggregate(aggregate("alpha-gpt-next", "openai"))).toEqual([])

    expect(toModelAggregate(aggregate("deepseek-v4-flash-free", "not-public-provider"))).toMatchObject([
      {
        period_key: "2026-05-20",
        provider: "deepseek",
        model: "deepseek-v4-flash",
      },
    ])

    for (const provider of ["slopcode", "opencode"]) {
      expect(
        toModelAggregate({ ...aggregate("big-pickle", provider), provider_model: "claude-sonnet-4-5" }),
      ).toMatchObject([
        {
          provider: "anthropic",
          model: "claude-sonnet-4-5",
          provider_model: "claude-sonnet-4-5",
        },
      ])
      expect(toModelAggregate(aggregate("big-pickle", provider))).toMatchObject([
        { provider: "unknown", model: "unknown" },
      ])
    }
  })

  test("provider aggregates never expose router providers", () => {
    for (const provider of ["slopcode", "opencode"]) {
      expect(toProviderAggregate({ ...aggregate("big-pickle", provider), provider_model: "gpt-5" })).toMatchObject([
        { provider: "openai" },
      ])
      expect(toProviderAggregate(aggregate("big-pickle", provider))).toMatchObject([{ provider: "unknown" }])
    }
  })

  test("geo aggregates never expose router provider or model dimensions", () => {
    for (const provider of ["slopcode", "opencode"]) {
      expect(toGeoAggregate({ ...aggregate("big-pickle", provider), country: "US" })).toMatchObject([
        { provider: "unknown", model: "unknown", country: "US" },
      ])
    }
  })

  test("keeps Go tier and normalizes Paid tier to Zen", () => {
    expect(toModelAggregate({ ...aggregate("gpt-5", "openai"), tier: "Go" })).toMatchObject([{ tier: "Go" }])
    expect(toModelAggregate(aggregate("gpt-5", "openai"))).toMatchObject([{ tier: "Zen" }])
  })

  test("buildStatsQuery remains constrained to lite inference events", () => {
    const query = buildStatsQuery(new Date("2026-05-20T00:00:00.000Z"), new Date("2026-05-21T00:00:00.000Z"), "model")

    expect(query).toContain("\n    AND source = 'lite'\n")
  })

  test("model aggregates use ISO week period keys", () => {
    expect(
      toModelAggregate({
        ...aggregate("gpt-5.5-pro", "openai"),
        grain: "week",
        period_key: "2026-W20",
      }),
    ).toMatchObject([{ period_key: "2026-W20" }])
  })
})

function aggregate(model: string, provider: string) {
  return {
    grain: "day",
    period_key: "2026-05-20",
    dataset: "zen",
    tier: "Paid",
    provider,
    model,
    sessions: "1",
    requests: "1",
    sample_count: "1",
  }
}
