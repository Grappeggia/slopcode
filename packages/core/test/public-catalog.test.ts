import { describe, expect, it } from "bun:test"
import { DateTime } from "effect"
import { Credential } from "@slopcode-ai/core/credential"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"

describe("public catalog projection", () => {
  it("redacts auth material without mutating executable provider and model data", () => {
    const provider = new ProviderV2.Info({
      id: ProviderV2.ID.openai,
      name: "OpenAI",
      enabled: { via: "credential", credentialID: Credential.ID.make("cred_secret") },
      env: ["OPENAI_API_KEY"],
      api: {
        type: "aisdk",
        package: "@ai-sdk/openai",
        url: "https://user:password@api.openai.com/v1?api_key=query-secret#secret",
        settings: { apiKey: "settings-secret", accountID: "account-secret" },
      },
      request: {
        headers: { authorization: "Bearer header-secret" },
        body: { apiKey: "projected-secret", token: "body-secret" },
      },
    })
    const model = new ModelV2.Info({
      id: ModelV2.ID.make("gpt-5.6"),
      providerID: provider.id,
      name: "GPT-5.6",
      api: { id: ModelV2.ID.make("gpt-5.6"), ...provider.api },
      capabilities: { tools: true, input: ["text"], output: ["text"] },
      request: {
        headers: { authorization: "Bearer model-secret" },
        body: { apiKey: "model-secret" },
        generation: {},
        options: { apiKey: "model-option-secret" },
      },
      variants: [
        {
          id: ModelV2.VariantID.make("high"),
          headers: { authorization: "Bearer variant-secret" },
          body: { apiKey: "variant-secret" },
          generation: {},
          options: { token: "variant-option-secret" },
        },
      ],
      time: { released: DateTime.makeUnsafe(0) },
      cost: [],
      status: "active",
      enabled: true,
      limit: { context: 1_050_000, output: 128_000 },
    })

    const publicProvider = ProviderV2.publicInfo(provider)
    const publicModel = ModelV2.publicInfo(model)

    expect(publicProvider.enabled).toEqual({ via: "custom", data: {} })
    expect(publicProvider.api).toEqual({
      type: "aisdk",
      package: "@ai-sdk/openai",
      url: "https://api.openai.com/v1",
      settings: {},
    })
    expect(publicProvider.request).toEqual({ headers: {}, body: {} })
    expect(publicModel.api.settings).toEqual({})
    expect(publicModel.request).toMatchObject({ headers: {}, body: {}, options: {} })
    expect(publicModel.variants[0]).toMatchObject({ headers: {}, body: {}, options: {} })

    expect(provider.enabled).toEqual({ via: "credential", credentialID: "cred_secret" })
    expect(provider.request.body.apiKey).toBe("projected-secret")
    expect(model.request.body.apiKey).toBe("model-secret")
    expect(model.variants[0]?.body.apiKey).toBe("variant-secret")
  })
})
