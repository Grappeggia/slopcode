import { describe, expect, test } from "bun:test"
import { normalize } from "@slopcode-ai/core/models-dev-normalize"

describe("models.dev normalization", () => {
  test("maps legacy providers without mutating input or unrelated providers", () => {
    const data = {
      opencode: {
        id: "opencode",
        name: "OpenCode Zen",
        env: ["OPENCODE_API_KEY"],
        api: "https://opencode.ai/zen/v1",
        doc: "https://opencode.ai/docs/zen",
        npm: "@ai-sdk/openai-compatible",
        models: { legacy: { source: "legacy" } },
      },
      "opencode-go": {
        id: "opencode-go",
        name: "OpenCode Go",
        env: ["OPENCODE_API_KEY"],
        api: "https://opencode.ai/zen/go/v1",
        doc: "https://opencode.ai/docs/zen",
        models: { go: { source: "legacy" } },
      },
      acme: {
        id: "acme",
        name: "Acme",
        env: ["ACME_API_KEY"],
        api: "https://acme.test/v1",
        models: { model: { source: "acme" } },
      },
    }
    const before = structuredClone(data)
    const result = normalize(data)

    expect(result.opencode).toBeUndefined()
    expect(result["opencode-go"]).toBeUndefined()
    expect(result.slopcode).toMatchObject({
      id: "slopcode",
      name: "SlopCode Zen",
      env: ["SLOPCODE_API_KEY"],
      api: "https://slopcode.dev/zen/v1",
      doc: "https://slopcode.dev/docs/zen",
      npm: "@ai-sdk/openai-compatible",
      models: data.opencode.models,
    })
    expect(result["slopcode-go"]).toMatchObject({
      id: "slopcode-go",
      name: "SlopCode Go",
      env: ["SLOPCODE_API_KEY"],
      api: "https://slopcode.dev/zen/go/v1",
      doc: "https://slopcode.dev/docs/zen",
      models: data["opencode-go"].models,
    })
    expect(result.acme).toBe(data.acme)
    expect(result.acme).toEqual(before.acme)
    expect(data).toEqual(before)
  })

  test("merges legacy and canonical models with canonical precedence", () => {
    const result = normalize({
      opencode: {
        id: "opencode",
        name: "OpenCode",
        env: ["OPENCODE_API_KEY"],
        api: "https://opencode.ai/zen/v1",
        doc: "https://opencode.ai/docs/zen",
        models: {
          legacy: { source: "legacy" },
          shared: { source: "legacy" },
        },
      },
      slopcode: {
        id: "wrong",
        name: "Wrong",
        env: ["WRONG_API_KEY"],
        api: "https://wrong.test/v1",
        doc: "https://wrong.test/docs",
        models: {
          current: { source: "current" },
          shared: { source: "current" },
        },
      },
    })

    expect(result.slopcode.models).toEqual({
      legacy: { source: "legacy" },
      current: { source: "current" },
      shared: { source: "current" },
    })
    expect(result.slopcode).toMatchObject({
      id: "slopcode",
      name: "SlopCode Zen",
      env: ["SLOPCODE_API_KEY"],
      api: "https://slopcode.dev/zen/v1",
      doc: "https://slopcode.dev/docs/zen",
    })
    expect(result.opencode).toBeUndefined()
  })

  test("enforces canonical fields on current providers", () => {
    const result = normalize({
      "slopcode-go": {
        id: "opencode-go",
        name: "OpenCode Go",
        env: ["OPENCODE_API_KEY"],
        api: "https://opencode.ai/zen/go/v1",
        doc: "https://opencode.ai/docs/zen",
        models: {},
      },
    })

    expect(result["slopcode-go"]).toEqual({
      id: "slopcode-go",
      name: "SlopCode Go",
      env: ["SLOPCODE_API_KEY"],
      api: "https://slopcode.dev/zen/go/v1",
      doc: "https://slopcode.dev/docs/zen",
      models: {},
    })
  })
})
