import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { ModelsDev } from "@slopcode-ai/core/models-dev"

const decode = Schema.decodeUnknownSync(ModelsDev.Model)
const model = {
  id: "gpt-5.6",
  name: "GPT-5.6",
  release_date: "2026-01-01",
  attachment: false,
  reasoning: true,
  temperature: true,
  tool_call: true,
  limit: { context: 128_000, output: 16_384 },
}

describe("ModelsDev.Model", () => {
  test("decodes and preserves reasoning options", () => {
    const reasoning_options = [
      { type: "effort", values: ["none", "low", "medium", "high", "xhigh", "max"] },
    ]

    expect(decode({ ...model, reasoning_options }).reasoning_options).toEqual(reasoning_options)
  })

  test("accepts a model without reasoning options", () => {
    expect(decode(model)).toEqual(model)
  })
})
