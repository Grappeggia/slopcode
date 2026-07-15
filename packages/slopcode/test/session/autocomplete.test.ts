import { describe, expect, test } from "bun:test"
import type { LanguageModelV3, LanguageModelV3CallOptions } from "@ai-sdk/provider"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { Effect, Layer } from "effect"
import { SessionAutocomplete } from "../../src/session/autocomplete"
import { ProviderTest } from "../fake/provider"
import { testEffect } from "../lib/effect"

const selected = ProviderTest.model({
  id: ModelV2.ID.make("selected"),
  providerID: ProviderV2.ID.make("alpha"),
})
const override = ProviderTest.model({
  id: ModelV2.ID.make("override"),
  providerID: ProviderV2.ID.make("alpha"),
})
const small = ProviderTest.model({
  id: ModelV2.ID.make("small"),
  providerID: ProviderV2.ID.make("alpha"),
})

describe("session autocomplete helpers", () => {
  test("is disabled by default and resolves bounded defaults", () => {
    expect(SessionAutocomplete.settings()).toEqual({
      enabled: false,
      debounce_ms: 180,
      min_prefix_chars: 12,
      max_prefix_chars: 2_000,
      timeout_ms: 2_000,
      max_output_tokens: 48,
      max_completion_chars: 96,
      provider_model_overrides: {},
    })
  })

  test("routes override, small model, then selected without crossing providers", () => {
    const foreign = ProviderTest.model({
      id: ModelV2.ID.make("foreign"),
      providerID: ProviderV2.ID.make("beta"),
    })

    expect(SessionAutocomplete.route({ selected, override, small }).map((model) => model.id)).toEqual([
      ModelV2.ID.make("override"),
      ModelV2.ID.make("small"),
      ModelV2.ID.make("selected"),
    ])
    expect(SessionAutocomplete.route({ selected, override: foreign, small: foreign })).toEqual([selected])
  })

  test("normalizes echoed prefixes, spacing, newlines, and output length", () => {
    expect(
      SessionAutocomplete.normalize({
        prefix: "write focused ",
        completion: "Write focused tests\r\nand an explanation",
        max: 96,
      }),
    ).toBe("tests")
    expect(SessionAutocomplete.normalize({ prefix: "write", completion: "tests", max: 96 })).toBe(" tests")
    expect(SessionAutocomplete.normalize({ prefix: "write ", completion: "tests   ", max: 4 })).toBe("test")
    expect(SessionAutocomplete.normalize({ prefix: "", completion: "😀x", max: 2 })).toBe("😀")
    expect(SessionAutocomplete.normalize({ prefix: "", completion: "😀x", max: 1 })).toBe("")
  })

  test("builds exactly fixed instructions and the bounded prefix", () => {
    const messages = SessionAutocomplete.messages("current unsubmitted prefix")

    expect(messages).toEqual([
      { role: "system", content: SessionAutocomplete.INSTRUCTIONS },
      { role: "user", content: "current unsubmitted prefix" },
    ])
    expect(JSON.stringify(messages)).not.toContain("transcript")
    expect(JSON.stringify(messages)).not.toContain("related")
    expect(JSON.stringify(messages)).not.toContain("attachment")
  })
})

describe("session autocomplete cancellation", () => {
  let aborted = false
  const language = {
    specificationVersion: "v3",
    provider: "test",
    modelId: "selected",
    supportedUrls: {},
    doGenerate() {
      throw new Error("unexpected generate")
    },
    doStream(options: LanguageModelV3CallOptions) {
      return new Promise<never>((_, reject) => {
        options.abortSignal?.addEventListener(
          "abort",
          () => {
            aborted = true
            reject(options.abortSignal?.reason)
          },
          { once: true },
        )
      })
    },
  } satisfies LanguageModelV3
  const provider = ProviderTest.fake({
    model: selected,
    getLanguage: () => Effect.succeed(language),
  })
  const it = testEffect(SessionAutocomplete.layer.pipe(Layer.provide(provider.layer)))

  test("provider starts un-aborted", () => {
    aborted = false
    expect(aborted).toBe(false)
  })

  it.live("aborts provider generation when the request times out", () =>
    Effect.gen(function* () {
      aborted = false
      const service = yield* SessionAutocomplete.Service
      const result = yield* service.complete({
        model: { providerID: selected.providerID, modelID: selected.id },
        prefix: "a sufficiently long prefix",
        settings: { ...SessionAutocomplete.settings({ enabled: true }), timeout_ms: 10 },
      })

      expect(result.completion).toBe("")
      expect(aborted).toBe(true)
    }),
  )
})
