import { describe, expect } from "bun:test"
import { LLM, Model } from "@slopcode-ai/llm"
import { HttpTransport, LLMClient } from "@slopcode-ai/llm/route"
import * as OpenAIResponses from "@slopcode-ai/llm/protocols/openai-responses"
import { ConfigProvider, DateTime, Effect } from "effect"
import { Headers, HttpClientRequest } from "effect/unstable/http"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { SessionRunnerModel } from "@slopcode-ai/core/session/runner/model"
import { SessionV2 } from "@slopcode-ai/core/session"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { ModelHarness } from "@slopcode-ai/core/model-harness"
import { Credential } from "@slopcode-ai/core/credential"
import { Integration } from "@slopcode-ai/core/integration"
import { it } from "./lib/effect"

type Api =
  | {
      readonly type: "aisdk"
      readonly package: string
      readonly url?: string
      readonly settings?: Record<string, unknown>
    }
  | { readonly type: "native"; readonly url?: string; readonly settings: Record<string, unknown> }

const model = (api: Api, variants: ModelV2.Info["variants"] = []) =>
  new ModelV2.Info({
    id: ModelV2.ID.make("test-model"),
    providerID: ProviderV2.ID.make("test-provider"),
    name: "Test model",
    api: { id: ModelV2.ID.make("api-test-model"), ...api },
    capabilities: { tools: true, input: ["text"], output: ["text"] },
    request: {
      headers: { "x-test": "header" },
      body: { apiKey: "secret", custom_extension: { enabled: true } },
      generation: { temperature: 0.7 },
      options: { store: false, serviceTier: "priority" },
    },
    variants,
    time: { released: DateTime.makeUnsafe(0) },
    cost: [],
    status: "active",
    enabled: true,
    limit: { context: 100, output: 20 },
  })

const provider = (api: ProviderV2.Info["api"]) =>
  new ProviderV2.Info({
    id: ProviderV2.ID.make("test-provider"),
    name: "Test provider",
    enabled: { via: "env", name: "TEST_PROVIDER_API_KEY" },
    env: ["TEST_PROVIDER_API_KEY"],
    api,
    request: { headers: {}, body: {} },
  })

const credential = (
  type: "oauth" | "key",
  integrationID = "openai",
  methodID = "chatgpt-browser",
) =>
  new Credential.Stored({
    id: Credential.ID.make(`cred_${type}`),
    integrationID: Integration.ID.make(integrationID),
    label: type,
    value:
      type === "oauth"
        ? new Credential.OAuth({
            type,
            methodID: Integration.MethodID.make(methodID),
            refresh: "refresh",
            access: "oauth-secret",
            expires: Date.now() + 60_000,
            metadata: { accountID: "account-123" },
          })
        : new Credential.Key({ type, key: "api-secret" }),
  })

const harnessModel = (api: Api = { type: "aisdk", package: "@ai-sdk/openai", url: "https://openai.example/v1" }) => {
  const base = model(api)
  return new ModelV2.Info({
    ...base,
    id: ModelV2.ID.make("gpt-5.6-sol"),
    api: { ...base.api, id: ModelV2.ID.make("gpt-5.6-sol") },
    limit: { context: 1_050_000, output: 128_000 },
  })
}

const session = (catalog: ModelV2.Info) =>
  SessionV2.Info.make({
    id: SessionV2.ID.make("ses_route"),
    projectID: ProjectV2.ID.global,
    title: "test",
    model: { id: catalog.id, providerID: catalog.providerID },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: DateTime.makeUnsafe(0), updated: DateTime.makeUnsafe(0) },
    location: { directory: AbsolutePath.make("/project") },
  })

describe("SessionRunnerModel", () => {
  it.effect("maps catalog OpenAI AI SDK models into native Responses routes", () =>
    Effect.gen(function* () {
      const resolved = yield* SessionRunnerModel.fromCatalogModel(
        model({ type: "aisdk", package: "@ai-sdk/openai", url: "https://openai.example/v1" }),
      )

      expect(resolved).toMatchObject({ id: "api-test-model", provider: "test-provider" })
      expect(resolved.route).toMatchObject({
        id: "openai-responses",
        endpoint: { baseURL: "https://openai.example/v1" },
        defaults: {
          headers: { "x-test": "header" },
          limits: { context: 100, output: 20 },
          generation: { temperature: 0.7 },
          providerOptions: { openai: { store: false, serviceTier: "priority" } },
          http: { body: { custom_extension: { enabled: true } } },
        },
      })
    }),
  )

  it.effect("uses catalog context for public GPT-5.6", () =>
    Effect.gen(function* () {
      const resolved = yield* SessionRunnerModel.fromCatalogModel(harnessModel())

      expect(resolved.route.defaults.limits).toEqual({ context: 1_050_000, output: 128_000 })
    }),
  )

  it.effect("allows public harness profiles on compatible non-Lite routes", () =>
    Effect.gen(function* () {
      const catalog = harnessModel({
        type: "aisdk",
        package: "@ai-sdk/openai-compatible",
        url: "https://api.openai.com/v1",
      })
      const resolved = yield* SessionRunnerModel.resolve(
        SessionV2.Info.make({
          id: SessionV2.ID.make("ses_harness_incompatible"),
          projectID: ProjectV2.ID.global,
          title: "test",
          model: { id: catalog.id, providerID: catalog.providerID },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          time: { created: DateTime.makeUnsafe(0), updated: DateTime.makeUnsafe(0) },
          location: { directory: AbsolutePath.make("/project") },
        }),
        catalog,
      )

      expect(resolved.harness?.route.id).toBe("public")
      expect(resolved.model.route.defaults.limits).toEqual({ context: 1_050_000, output: 128_000 })
    }),
  )

  const routes = [
    { name: "OpenAI OAuth", providerID: "openai", enabled: "credential", credential: credential("oauth"), codex: true },
    { name: "explicit API key", providerID: "openai", enabled: "credential", credential: credential("key"), codex: false },
    { name: "environment key", providerID: "openai", enabled: "env", codex: false },
    { name: "custom endpoint", providerID: "openai", enabled: "custom", url: "https://custom.example/v1", codex: false },
    { name: "Slopcode free", providerID: "slopcode", enabled: "custom", url: "https://slopcode.dev/zen/v1", codex: false },
    { name: "Slopcode Go", providerID: "slopcode-go", enabled: "custom", url: "https://slopcode.dev/zen/go/v1", codex: false },
  ] as const

  for (const item of routes) {
    it.effect(`resolves ${item.name} GPT-5.6 transport without route leakage`, () =>
      Effect.gen(function* () {
        const catalog = new ModelV2.Info({
          ...harnessModel(),
          providerID: ProviderV2.ID.make(item.providerID),
          api: { ...harnessModel().api, url: item.url ?? "https://api.openai.com/v1" },
        })
        const info = new ProviderV2.Info({
          id: ProviderV2.ID.make(item.providerID),
          name: item.name,
          enabled:
            item.enabled === "credential"
              ? { via: "credential", credentialID: item.credential!.id }
              : item.enabled === "env"
                ? { via: "env", name: "TEST_PROVIDER_API_KEY" }
                : { via: "custom", data: {} },
          env: item.enabled === "env" ? ["TEST_PROVIDER_API_KEY"] : [],
          api: { type: "aisdk", package: "@ai-sdk/openai", url: catalog.api.url },
          request: { headers: {}, body: {} },
        })
        const resolved = yield* SessionRunnerModel.resolve(
          session(catalog),
          catalog,
          info,
          undefined,
          item.credential,
        )

        expect(resolved.harness?.route.id).toBe(item.codex ? "codex" : "public")
        expect(resolved.model.route.endpoint).toMatchObject(
          item.codex
            ? { baseURL: "https://chatgpt.com/backend-api/codex", path: "/responses" }
            : { baseURL: item.url ?? "https://api.openai.com/v1", path: "/responses" },
        )
        expect(resolved.model.route.defaults.headers?.["ChatGPT-Account-Id"]).toBe(
          item.codex ? "account-123" : undefined,
        )
        expect(resolved.model.route.defaults.limits?.context).toBe(item.codex ? 372_000 : 1_050_000)
        expect(resolved.model.route.capabilities.includes("sequential-cutoff")).toBe(item.codex)
        expect(resolved.harness?.route.responses).toBe(item.codex ? "lite" : "full")
        expect(resolved.harness?.route.tools.mode).toBe(item.codex ? "code-only" : "function")
        expect(resolved.harness?.route.reasoning).toBe(item.codex ? "all_turns" : "default")

        const request = LLM.request({
          model: resolved.model,
          prompt: "Hello",
          tools: item.codex
            ? [{ type: "custom", name: "exec", description: "Run code" }]
            : [{ name: "lookup", description: "Lookup", inputSchema: { type: "object" } }],
          providerOptions: {
            openai: { responsesMode: item.codex ? "lite" : "full", reasoningEffort: "low" },
          },
          http: { headers: resolved.model.route.defaults.headers },
        })
        const body = yield* resolved.model.route.body.from(request)
        const transport = yield* resolved.model.route.prepareTransport(body, request).pipe(
          Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { TEST_PROVIDER_API_KEY: "env-secret" } }))),
        )
        const web = yield* HttpClientRequest.toWeb((transport as HttpTransport.HttpPrepared<string>).request)
        const json = body as OpenAIResponses.OpenAIResponsesBody

        expect(web.url).toBe(
          item.codex
            ? "https://chatgpt.com/backend-api/codex/responses"
            : `${item.url ?? "https://api.openai.com/v1"}/responses`,
        )
        expect(web.headers.get("ChatGPT-Account-Id")).toBe(item.codex ? "account-123" : null)
        expect(web.headers.get("x-openai-internal-codex-responses-lite")).toBe(item.codex ? "true" : null)
        expect(json.input.some((entry) => "type" in entry && entry.type === "additional_tools")).toBe(item.codex)
        expect(json.tools?.[0]?.type).toBe(item.codex ? undefined : "function")
        expect(json.reasoning?.context).toBe(item.codex ? "all_turns" : undefined)
      }),
    )
  }

  it.effect("keeps OpenAI-compatible OAuth routes public", () =>
    Effect.gen(function* () {
      const catalog = harnessModel({
        type: "aisdk",
        package: "@ai-sdk/openai-compatible",
        url: "https://api.openai.com/v1",
      })
      const resolved = yield* SessionRunnerModel.resolve(
        session(catalog),
        catalog,
        new ProviderV2.Info({
          ...provider({ type: "aisdk", package: "@ai-sdk/openai-compatible", url: "https://compatible.example/v1" }),
          id: ProviderV2.ID.openai,
          enabled: { via: "credential", credentialID: credential("oauth").id },
        }),
        undefined,
        credential("oauth"),
      )

      expect(resolved.harness?.route.id).toBe("public")
      expect(resolved.model.route.capabilities).not.toContain("responses-lite")
    }),
  )

  for (const item of [
    { name: "foreign integration", credential: credential("oauth", "github-copilot") },
    { name: "foreign OAuth method", credential: credential("oauth", "openai", "foreign-oauth") },
  ]) {
    it.effect(`never classifies ${item.name} credentials as Codex`, () =>
      Effect.gen(function* () {
        const catalog = harnessModel({ type: "aisdk", package: "@ai-sdk/openai", url: "https://api.openai.com/v1" })
        const resolved = yield* SessionRunnerModel.resolve(
          session(catalog),
          catalog,
          new ProviderV2.Info({
            ...provider({ type: "aisdk", package: "@ai-sdk/openai", url: "https://api.openai.com/v1" }),
            id: ProviderV2.ID.openai,
            enabled: { via: "credential", credentialID: item.credential.id },
          }),
          undefined,
          item.credential,
        )

        expect(resolved.harness?.route.id).toBe("public")
        expect(resolved.model.route.endpoint.baseURL).toBe("https://api.openai.com/v1")
        expect(resolved.model.route.defaults.headers?.["ChatGPT-Account-Id"]).toBeUndefined()
        const headers = yield* resolved.model.route.auth.apply({
          request: LLM.request({ model: resolved.model, prompt: "Hello" }),
          method: "POST",
          url: "https://api.openai.com/v1/responses",
          body: "{}",
          headers: Headers.empty,
        })
        expect(headers.authorization).not.toBe("Bearer oauth-secret")
      }),
    )
  }

  it.effect("fails Codex closed when its deployment does not advertise Code Mode", () =>
    Effect.gen(function* () {
      const catalog = harnessModel({ type: "aisdk", package: "@ai-sdk/openai", url: "https://api.openai.com/v1" })
      const resolved = yield* SessionRunnerModel.resolve(
        session(catalog),
        catalog,
        new ProviderV2.Info({
          ...provider({ type: "aisdk", package: "@ai-sdk/openai", url: "https://api.openai.com/v1" }),
          id: ProviderV2.ID.openai,
          enabled: { via: "credential", credentialID: credential("oauth").id },
        }),
        undefined,
        credential("oauth"),
      )
      const failure = yield* SessionRunnerModel.validate(
        resolved.harness!,
        new Model({
          ...resolved.model,
          route: resolved.model.route.with({ capabilities: ["responses-lite", "custom-tools"] }),
        }),
      ).pipe(Effect.flip)

      expect(failure).toEqual(
        new ModelHarness.IncompatibilityError({ profileID: "gpt-5.6-sol", missing: ["code-mode"] }),
      )
    }),
  )

  it.effect("keeps catalog apiKey credentials out of provider JSON", () =>
    Effect.gen(function* () {
      const resolved = yield* SessionRunnerModel.fromCatalogModel(
        model({ type: "aisdk", package: "@ai-sdk/openai", url: "https://openai.example/v1" }),
      )
      const prepared = yield* LLMClient.prepare(LLM.request({ model: resolved, prompt: "Hello" }))

      expect(JSON.stringify(prepared.body)).not.toContain("apiKey")
      expect(JSON.stringify(prepared.body)).not.toContain("secret")
    }),
  )

  it.effect("uses merged API settings for OpenAI-compatible auth and request defaults", () =>
    Effect.gen(function* () {
      const resolved = yield* SessionRunnerModel.fromCatalogModel(
        new ModelV2.Info({
          ...model({
            type: "aisdk",
            package: "@ai-sdk/openai-compatible",
            url: "https://compatible.example/v1",
            settings: { apiKey: "settings-secret", compatibility: "strict" },
          }),
          request: { headers: {}, body: {}, generation: {}, options: {} },
        }),
      )
      const request = LLM.request({ model: resolved, prompt: "Hello" })
      const headers = yield* resolved.route.auth.apply({
        request,
        method: "POST",
        url: "https://compatible.example/v1/chat/completions",
        body: "{}",
        headers: Headers.empty,
      })

      expect(headers.authorization).toBe("Bearer settings-secret")
      expect(resolved.route.defaults.http?.body).toEqual({})
    }),
  )

  it.effect("lowers selected OpenAI Session variants into Responses options", () =>
    Effect.gen(function* () {
      const base = model({ type: "aisdk", package: "@ai-sdk/openai", url: "https://openai.example/v1" }, [
        {
          id: ModelV2.VariantID.make("high"),
          headers: { "x-variant": "high" },
          body: {},
          generation: { temperature: 0.2 },
          options: { reasoningEffort: "high" },
        },
      ])
      const catalog = new ModelV2.Info({
        ...base,
        request: { ...base.request, options: { ...base.request.options, reasoningEffort: "medium" } },
      })
      const session = SessionV2.Info.make({
        id: SessionV2.ID.make("ses_model_variant"),
        projectID: ProjectV2.ID.global,
        title: "test",
        model: {
          id: catalog.id,
          providerID: catalog.providerID,
          variant: ModelV2.VariantID.make("high"),
        },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        time: { created: DateTime.makeUnsafe(0), updated: DateTime.makeUnsafe(0) },
        location: { directory: AbsolutePath.make("/project") },
      })

      const resolved = yield* SessionRunnerModel.resolve(session, catalog)
      const prepared = yield* LLMClient.prepare(LLM.request({ model: resolved.model, prompt: "Hello" }))

      expect(resolved.model.route.defaults.headers).toMatchObject({ "x-test": "header", "x-variant": "high" })
      expect(resolved.model.route.defaults.http?.body).toEqual({ custom_extension: { enabled: true } })
      expect(prepared.body).toMatchObject({
        store: false,
        service_tier: "priority",
        temperature: 0.2,
        reasoning: { effort: "high" },
      })
      expect(prepared.body).not.toHaveProperty("reasoningEffort")
    }),
  )

  it.effect("lowers selected OpenAI-compatible Session variants into Chat options", () =>
    Effect.gen(function* () {
      const catalog = model(
        { type: "aisdk", package: "@ai-sdk/openai-compatible", url: "https://compatible.example/v1" },
        [
          {
            id: ModelV2.VariantID.make("high"),
            headers: {},
            body: {},
            generation: {},
            options: { reasoningEffort: "high" },
          },
        ],
      )
      const session = SessionV2.Info.make({
        id: SessionV2.ID.make("ses_compatible_variant"),
        projectID: ProjectV2.ID.global,
        title: "test",
        model: { id: catalog.id, providerID: catalog.providerID, variant: ModelV2.VariantID.make("high") },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        time: { created: DateTime.makeUnsafe(0), updated: DateTime.makeUnsafe(0) },
        location: { directory: AbsolutePath.make("/project") },
      })

      const resolved = yield* SessionRunnerModel.resolve(session, catalog)
      const prepared = yield* LLMClient.prepare(LLM.request({ model: resolved.model, prompt: "Hello" }))

      expect(resolved.model.route.defaults.http?.body).toEqual({ custom_extension: { enabled: true } })
      expect(prepared.body).toMatchObject({
        store: false,
        reasoning_effort: "high",
      })
      expect(prepared.body).not.toHaveProperty("reasoningEffort")
    }),
  )

  it.effect("lowers selected Anthropic Session variants into Messages options", () =>
    Effect.gen(function* () {
      const catalog = model({ type: "aisdk", package: "@ai-sdk/anthropic", url: "https://anthropic.example/v1" }, [
        {
          id: ModelV2.VariantID.make("high"),
          headers: {},
          body: {},
          generation: {},
          options: { thinking: { type: "enabled", budgetTokens: 12000 } },
        },
      ])
      const session = SessionV2.Info.make({
        id: SessionV2.ID.make("ses_anthropic_variant"),
        projectID: ProjectV2.ID.global,
        title: "test",
        model: { id: catalog.id, providerID: catalog.providerID, variant: ModelV2.VariantID.make("high") },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        time: { created: DateTime.makeUnsafe(0), updated: DateTime.makeUnsafe(0) },
        location: { directory: AbsolutePath.make("/project") },
      })

      const resolved = yield* SessionRunnerModel.resolve(session, catalog)
      const prepared = yield* LLMClient.prepare(LLM.request({ model: resolved.model, prompt: "Hello" }))

      expect(resolved.model.route.defaults.http?.body).toEqual({ custom_extension: { enabled: true } })
      expect(prepared.body).toMatchObject({
        thinking: { type: "enabled", budget_tokens: 12000 },
      })
      expect(JSON.stringify(prepared.body)).not.toContain("budgetTokens")
    }),
  )

  it.effect("maps catalog Anthropic AI SDK models into native routes", () =>
    Effect.gen(function* () {
      const resolved = yield* SessionRunnerModel.fromCatalogModel(
        model({ type: "aisdk", package: "@ai-sdk/anthropic", url: "https://anthropic.example/v1" }),
      )

      expect(resolved.route).toMatchObject({
        id: "anthropic-messages",
        endpoint: { baseURL: "https://anthropic.example/v1" },
      })
    }),
  )

  it.effect("preserves environment-backed bearer auth", () =>
    Effect.gen(function* () {
      const resolved = yield* SessionRunnerModel.fromCatalogModel(
        new ModelV2.Info({
          ...model({ type: "aisdk", package: "@ai-sdk/openai", url: "https://openai.example/v1" }),
          request: { headers: {}, body: {}, generation: {}, options: {} },
        }),
        provider({ type: "aisdk", package: "@ai-sdk/openai", url: "https://openai.example/v1" }),
      )
      const request = LLM.request({ model: resolved, prompt: "Hello" })
      const headers = yield* resolved.route.auth
        .apply({
          request,
          method: "POST",
          url: "https://openai.example/v1/responses",
          body: "{}",
          headers: Headers.empty,
        })
        .pipe(
          Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { TEST_PROVIDER_API_KEY: "secret" } }))),
        )

      expect(headers.authorization).toBe("Bearer secret")
    }),
  )

  it.effect("rejects catalog APIs without a native route", () =>
    Effect.gen(function* () {
      const failure = yield* SessionRunnerModel.fromCatalogModel(
        model({ type: "aisdk", package: "@ai-sdk/google", url: "https://google.example/v1" }),
      ).pipe(Effect.flip)

      expect(failure).toMatchObject({
        _tag: "SessionRunnerModel.UnsupportedApiError",
        providerID: "test-provider",
        modelID: "test-model",
        api: "aisdk:@ai-sdk/google",
      })
    }),
  )

  it.effect("reports whether a catalog model has a supported native route", () =>
    Effect.sync(() => {
      expect(
        SessionRunnerModel.supported(
          model({ type: "aisdk", package: "@ai-sdk/openai", url: "https://openai.example/v1" }),
        ),
      ).toBe(true)
      expect(
        SessionRunnerModel.supported(
          model({ type: "aisdk", package: "@ai-sdk/google", url: "https://google.example/v1" }),
        ),
      ).toBe(false)
      expect(SessionRunnerModel.supported(model({ type: "native", settings: {} }))).toBe(false)
    }),
  )
})
