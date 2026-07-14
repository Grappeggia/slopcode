import { expect, test } from "bun:test"
import { Catalog } from "@slopcode-ai/core/catalog"
import { Location } from "@slopcode-ai/core/location"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { ModelV2 } from "@slopcode-ai/core/model"
import { PluginBoot } from "@slopcode-ai/core/plugin/boot"
import { Project } from "@slopcode-ai/core/project"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { DateTime, Effect, Layer, Option } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { createRoutes } from "../src/routes"

const provider = new ProviderV2.Info({
  id: ProviderV2.ID.openai,
  name: "OpenAI",
  enabled: { via: "credential", credentialID: "cred_public_leak" as never },
  env: ["OPENAI_API_KEY"],
  api: {
    type: "aisdk",
    package: "@ai-sdk/openai",
    url: "https://api.cloudflare.com/client/v4/accounts/account-path-secret/ai/run",
    settings: { apiKey: "settings-secret", accountID: "account-settings" },
  },
  request: {
    headers: { authorization: "Bearer header-secret", "ChatGPT-Account-Id": "account-header" },
    body: { apiKey: "projected-access-secret", token: "body-secret" },
  },
})

const model = new ModelV2.Info({
  id: ModelV2.ID.make("gpt-5.6"),
  providerID: provider.id,
  name: "GPT-5.6",
  api: {
    id: ModelV2.ID.make("gpt-5.6"),
    ...provider.api,
    url: "https://gateway.example/v1/path-token-secret/responses",
  },
  capabilities: { tools: true, input: ["text"], output: ["text"] },
  request: {
    headers: { authorization: "Bearer model-header-secret" },
    body: { apiKey: "model-access-secret", accountID: "model-account" },
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

test("public V2 provider and model routes redact internal authentication material", async () => {
  const catalog = Layer.mock(Catalog.Service, {
    provider: {
      get: () => Effect.succeed(provider),
      all: () => Effect.succeed([provider]),
      available: () => Effect.succeed([provider]),
    },
    model: {
      get: () => Effect.succeed(model),
      all: () => Effect.succeed([model]),
      available: () => Effect.succeed([model]),
      default: () => Effect.succeed(Option.some(model)),
      small: () => Effect.succeed(Option.some(model)),
    },
  } as never)
  const location = Layer.mergeAll(
    Layer.succeed(
      Location.Service,
      Location.Service.of({
        directory: AbsolutePath.make("/tmp/catalog-public"),
        project: { id: Project.ID.make("project"), directory: AbsolutePath.make("/tmp/catalog-public") },
      }),
    ),
    Layer.succeed(PluginBoot.Service, PluginBoot.Service.of({ wait: () => Effect.void })),
    catalog,
  )
  const locations = Layer.mock(LocationServiceMap, { get: () => location } as never)
  const app = HttpRouter.toWebHandler(
    createRoutes(undefined, undefined, locations).pipe(Layer.provide(HttpServer.layerServices)),
    { disableLogger: true },
  )

  try {
    for (const path of ["/api/provider", "/api/provider/openai", "/api/model"]) {
      const response = await app.handler(new Request(`http://localhost${path}`), undefined as never)
      expect(response.status).toBe(200)
      const text = await response.text()
      for (const secret of [
        "cred_public_leak",
        "projected-access-secret",
        "settings-secret",
        "header-secret",
        "body-secret",
        "account-settings",
        "account-header",
        "model-access-secret",
        "model-account",
        "variant-secret",
        "model-option-secret",
        "variant-option-secret",
        "account-path-secret",
        "path-token-secret",
      ]) {
        expect(text).not.toContain(secret)
      }
      expect(text).not.toContain('"url"')
      expect(text).not.toContain("PublicInfo")
    }
  } finally {
    await app.dispose()
  }
})
