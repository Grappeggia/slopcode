import { describe, expect } from "bun:test"
import { Effect, Fiber } from "effect"
import { Catalog } from "@slopcode-ai/core/catalog"
import { Integration } from "@slopcode-ai/core/integration"
import { ModelV2 } from "@slopcode-ai/core/model"
import { PluginV2 } from "@slopcode-ai/core/plugin"
import { OpenAIPlugin } from "@slopcode-ai/core/plugin/provider/openai"
import { browser } from "@slopcode-ai/core/plugin/provider/openai-auth"
import { getUsage } from "@slopcode-ai/core/plugin/provider/openai-usage"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { Credential } from "@slopcode-ai/core/credential"
import { fakeSelectorSdk, it, model, provider } from "./provider-helper"

function add(plugin: PluginV2.Interface, integrations: Integration.Interface) {
  return plugin.add({
    ...OpenAIPlugin,
    effect: OpenAIPlugin.effect.pipe(Effect.provideService(Integration.Service, integrations)),
  })
}

describe("OpenAIPlugin", () => {
  it.live("refreshes V2 OAuth while preserving method and metadata", () =>
    Effect.gen(function* () {
      const original = globalThis.fetch
      globalThis.fetch = async () =>
        Response.json({
          access_token: `e30.${Buffer.from(JSON.stringify({ chatgpt_account_id: "account-new" })).toString("base64url")}.signature`,
          expires_in: 60,
        })
      yield* Effect.addFinalizer(() => Effect.sync(() => void (globalThis.fetch = original)))
      const methodID = Integration.MethodID.make("chatgpt-browser")
      const refreshed = yield* browser.refresh!(
        new Credential.OAuth({
          type: "oauth",
          methodID,
          access: "expired",
          refresh: "refresh-preserved",
          expires: 0,
          metadata: { accountID: "account-old", workspace: "work" },
        }),
      )

      expect(refreshed).toMatchObject({
        type: "oauth",
        methodID,
        access: expect.any(String),
        refresh: "refresh-preserved",
        metadata: { accountID: "account-new", workspace: "work" },
      })
    }),
  )

  it.live("aborts interrupted V2 OAuth refreshes and retries", () =>
    Effect.gen(function* () {
      const original = globalThis.fetch
      let started: (() => void) | undefined
      const ready = new Promise<void>((resolve) => {
        started = resolve
      })
      let calls = 0
      let aborts = 0
      globalThis.fetch = async (_input, init) => {
        calls++
        if (calls > 1) return Response.json({ access_token: "access-retried", expires_in: 60 })
        return new Promise((_resolve, reject) => {
          started!()
          init?.signal?.addEventListener(
            "abort",
            () => {
              aborts++
              reject(init.signal?.reason)
            },
            { once: true },
          )
        })
      }
      yield* Effect.addFinalizer(() => Effect.sync(() => void (globalThis.fetch = original)))
      const value = new Credential.OAuth({
        type: "oauth",
        methodID: Integration.MethodID.make("chatgpt-browser"),
        access: "expired",
        refresh: "refresh-aborted",
        expires: 0,
      })
      const interrupted = yield* browser.refresh!(value).pipe(Effect.forkChild)
      yield* Effect.promise(() => ready)
      yield* Fiber.interrupt(interrupted)

      expect(aborts).toBe(1)
      expect((yield* browser.refresh!(value)).access).toBe("access-retried")
      expect(calls).toBe(2)
    }),
  )

  it.live("keeps a shared refresh alive when one waiter cancels", () =>
    Effect.gen(function* () {
      const original = globalThis.fetch
      let started: (() => void) | undefined
      const ready = new Promise<void>((resolve) => {
        started = resolve
      })
      let release: ((response: Response) => void) | undefined
      let calls = 0
      let aborts = 0
      globalThis.fetch = async (input, init) => {
        if (!String(input).endsWith("/oauth/token")) return Response.json({ plan_type: "plus" })
        calls++
        return new Promise((resolve, reject) => {
          release = resolve
          started!()
          init?.signal?.addEventListener(
            "abort",
            () => {
              aborts++
              reject(init.signal?.reason)
            },
            { once: true },
          )
        })
      }
      yield* Effect.addFinalizer(() => Effect.sync(() => void (globalThis.fetch = original)))
      const value = new Credential.OAuth({
        type: "oauth",
        methodID: Integration.MethodID.make("chatgpt-browser"),
        access: "expired",
        refresh: "refresh-shared-cancel",
        expires: 0,
      })
      const interrupted = yield* browser.refresh!(value).pipe(Effect.forkChild)
      yield* Effect.promise(() => ready)
      const saved: unknown[] = []
      const usage = getUsage(
        { type: "oauth", access: "expired", refresh: value.refresh, expires: 0 },
        async (auth) => void saved.push(auth),
        { now: () => 1000 },
      )
      yield* Fiber.interrupt(interrupted)

      expect(aborts).toBe(0)
      release!(Response.json({ access_token: "access-shared", refresh_token: "refresh-next", expires_in: 60 }))
      expect((yield* Effect.promise(() => usage)).status).toBe("oauth")
      expect(calls).toBe(1)
      expect(saved).toEqual([{ type: "oauth", access: "access-shared", refresh: "refresh-next", expires: 61_000 }])
    }),
  )

  it.effect("registers browser and headless ChatGPT OAuth methods", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* add(plugin, yield* Integration.Service)
      expect((yield* (yield* Integration.Service).get(Integration.ID.make("openai")))?.methods).toEqual([
        new Integration.OAuthMethod({
          id: Integration.MethodID.make("chatgpt-browser"),
          type: "oauth",
          label: "ChatGPT Pro/Plus (browser)",
        }),
        new Integration.OAuthMethod({
          id: Integration.MethodID.make("chatgpt-headless"),
          type: "oauth",
          label: "ChatGPT Pro/Plus (headless)",
        }),
      ])
    }),
  )

  it.effect("creates an OpenAI SDK for @ai-sdk/openai using the provider ID as SDK name", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* add(plugin, yield* Integration.Service)
      const result = yield* plugin.trigger(
        "aisdk.sdk",
        {
          model: model("custom-openai", "gpt-5"),
          package: "@ai-sdk/openai",
          options: { name: "custom-openai", apiKey: "test" },
        },
        {},
      )
      expect(result.sdk?.responses("gpt-5").provider).toBe("custom-openai.responses")
    }),
  )

  it.effect("ignores non-OpenAI SDK packages", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* add(plugin, yield* Integration.Service)
      const result = yield* plugin.trigger(
        "aisdk.sdk",
        { model: model("openai", "gpt-5"), package: "@ai-sdk/openai-compatible", options: { name: "openai" } },
        {},
      )
      expect(result.sdk).toBeUndefined()
    }),
  )

  it.effect("uses the Responses API for language models", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const calls: string[] = []
      yield* add(plugin, yield* Integration.Service)
      const result = yield* plugin.trigger(
        "aisdk.language",
        {
          model: model("openai", "alias", {
            api: { id: ModelV2.ID.make("gpt-5"), type: "aisdk", package: "test-provider" },
          }),
          sdk: fakeSelectorSdk(calls),
          options: {},
        },
        {},
      )
      expect(calls).toEqual(["responses:gpt-5"])
      expect(result.language).toBeDefined()
    }),
  )

  it.effect("ignores non-OpenAI providers", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const calls: string[] = []
      yield* add(plugin, yield* Integration.Service)
      const result = yield* plugin.trigger(
        "aisdk.language",
        { model: model("anthropic", "gpt-5"), sdk: fakeSelectorSdk(calls), options: {} },
        {},
      )
      expect(calls).toEqual([])
      expect(result.language).toBeUndefined()
    }),
  )

  it.effect("disables gpt-5-chat-latest during catalog transforms", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const catalog = yield* Catalog.Service
      yield* add(plugin, yield* Integration.Service)
      yield* catalog.transform((catalog) => {
        const item = provider("openai", { api: { type: "aisdk", package: "@ai-sdk/openai" } })
        catalog.provider.update(item.id, (draft) => {
          draft.api = item.api
        })
        catalog.model.update(item.id, ModelV2.ID.make("gpt-5"), () => {})
        catalog.model.update(item.id, ModelV2.ID.make("gpt-5-chat-latest"), () => {})
      })
      expect((yield* catalog.model.get(ProviderV2.ID.openai, ModelV2.ID.make("gpt-5"))).enabled).toBe(true)
      expect((yield* catalog.model.get(ProviderV2.ID.openai, ModelV2.ID.make("gpt-5-chat-latest"))).enabled).toBe(false)
    }),
  )

  it.effect("does not disable gpt-5-chat-latest for non-OpenAI providers", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const catalog = yield* Catalog.Service
      yield* add(plugin, yield* Integration.Service)
      yield* catalog.transform((catalog) => {
        const item = provider("custom-openai")
        catalog.provider.update(item.id, () => {})
        catalog.model.update(item.id, ModelV2.ID.make("gpt-5-chat-latest"), () => {})
      })
      expect(
        (yield* catalog.model.get(ProviderV2.ID.make("custom-openai"), ModelV2.ID.make("gpt-5-chat-latest"))).enabled,
      ).toBe(true)
    }),
  )
})
