import path from "path"
import { describe, expect } from "bun:test"
import { LLM } from "@slopcode-ai/llm"
import { LLMClient } from "@slopcode-ai/llm/route"
import { Deferred, Effect, Layer, Schema } from "effect"
import { Catalog } from "@slopcode-ai/core/catalog"
import { Integration } from "@slopcode-ai/core/integration"
import { Credential } from "@slopcode-ai/core/credential"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { Flag } from "@slopcode-ai/core/flag/flag"
import { Location } from "@slopcode-ai/core/location"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ModelsDev } from "@slopcode-ai/core/models-dev"
import { PluginV2 } from "@slopcode-ai/core/plugin"
import { ModelsDevPlugin } from "@slopcode-ai/core/plugin/models-dev"
import { Policy } from "@slopcode-ai/core/policy"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionRunnerModel } from "@slopcode-ai/core/session/runner/model"
import { location } from "../fixture/location"
import { testEffect } from "../lib/effect"

const events = EventV2.defaultLayer
const locationLayer = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make(import.meta.dir) })),
)
const plugins = PluginV2.layer.pipe(Layer.provide(events))
const policy = Policy.layer.pipe(Layer.provide(locationLayer))
const connections = Credential.layer.pipe(
  Layer.fresh,
  Layer.provide(Database.layerFromPath(":memory:").pipe(Layer.fresh)),
  Layer.provide(events),
)
const catalog = Catalog.layer.pipe(Layer.provide(Layer.mergeAll(events, locationLayer, plugins, policy, connections)))
const integrations = Integration.locationLayer.pipe(Layer.provide(events), Layer.provide(connections))
const layer = Layer.mergeAll(
  catalog.pipe(Layer.provide(connections)),
  integrations,
  connections,
  events,
  locationLayer,
  plugins,
)
const it = testEffect(layer)

const provider = (id: string, model: string, version = id) =>
  Schema.decodeUnknownSync(ModelsDev.Provider)({
    id,
    name: `${id}-${version}`,
    env: [`${id.toUpperCase()}_API_KEY`],
    npm: "@ai-sdk/openai",
    models: {
      [model]: {
        id: model,
        name: `${model}-${version}`,
        release_date: "2026-07-09",
        attachment: false,
        reasoning: false,
        temperature: true,
        tool_call: true,
        limit: { context: 100, output: 20 },
      },
    },
  })

describe("ModelsDevPlugin", () => {
  it.effect("registers key methods for providers with environment variables", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => {
        const previous = {
          path: Flag.SLOPCODE_MODELS_PATH,
          disabled: Flag.SLOPCODE_DISABLE_MODELS_FETCH,
        }
        Flag.SLOPCODE_MODELS_PATH = path.join(import.meta.dir, "fixtures", "models-dev.json")
        Flag.SLOPCODE_DISABLE_MODELS_FETCH = true
        return previous
      }),
      () =>
        Effect.gen(function* () {
          yield* ModelsDevPlugin.effect
          const integrations = yield* Integration.Service
          expect(yield* integrations.list()).toEqual([
            new Integration.Info({
              id: Integration.ID.make("acme"),
              name: "Acme",
              methods: [
                new Integration.KeyMethod({ type: "key" }),
                new Integration.EnvMethod({
                  type: "env",
                  names: ["ACME_API_KEY"],
                }),
              ],
              connections: [],
            }),
            new Integration.Info({
              id: Integration.ID.make("openai"),
              name: "OpenAI",
              methods: [
                new Integration.KeyMethod({ type: "key" }),
                new Integration.EnvMethod({
                  type: "env",
                  names: ["OPENAI_API_KEY"],
                }),
              ],
              connections: [],
            }),
          ])
        }).pipe(Effect.provide(ModelsDev.defaultLayer)),
      (previous) =>
        Effect.sync(() => {
          Flag.SLOPCODE_MODELS_PATH = previous.path
          Flag.SLOPCODE_DISABLE_MODELS_FETCH = previous.disabled
        }),
    ),
  )

  it.effect("registers effort variants and independent Fast catalog models", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => {
        const previous = {
          path: Flag.SLOPCODE_MODELS_PATH,
          disabled: Flag.SLOPCODE_DISABLE_MODELS_FETCH,
        }
        Flag.SLOPCODE_MODELS_PATH = path.join(import.meta.dir, "fixtures", "models-dev.json")
        Flag.SLOPCODE_DISABLE_MODELS_FETCH = true
        return previous
      }),
      () =>
        Effect.gen(function* () {
          yield* ModelsDevPlugin.effect
          const catalog = yield* Catalog.Service
          const providerID = ProviderV2.ID.make("openai")
          const efforts = ["none", "low", "medium", "high", "xhigh", "max"]
          const ids = ["gpt-5.6", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]

          for (const id of ids) {
            const base = yield* catalog.model.get(providerID, ModelV2.ID.make(id))
            const fast = yield* catalog.model.get(providerID, ModelV2.ID.make(`${id}-fast`))
            expect(base.request).toMatchObject({
              body: {},
              generation: {},
              options: {
                store: false,
                reasoningEffort: "medium",
                reasoningSummary: "auto",
                include: ["reasoning.encrypted_content"],
              },
            })
            expect(base.variants).toEqual(
              efforts.map((effort) => ({
                id: ModelV2.VariantID.make(effort),
                headers: {},
                body: {},
                generation: {},
                options: { reasoningEffort: effort },
              })),
            )
            expect(base.variants.map((variant) => variant.id)).not.toContain("fast")
            expect(base.variants.map((variant) => variant.id)).not.toContain("pro")
            expect(fast).toMatchObject({
              id: `${id}-fast`,
              name: `${base.name} Fast`,
              api: { id },
              request: {
                headers: { "x-openai-mode": "fast" },
                body: {},
                generation: {},
                options: {
                  store: false,
                  reasoningEffort: "medium",
                  reasoningSummary: "auto",
                  include: ["reasoning.encrypted_content"],
                  serviceTier: "priority",
                },
              },
              variants: base.variants,
            })
          }

          const fast = yield* catalog.model.get(providerID, ModelV2.ID.make("gpt-5.6-fast"))
          expect(fast.cost).toEqual([
            { input: 10, output: 60, cache: { read: 1, write: 12.5 } },
            {
              tier: { type: "context", size: 200_000 },
              input: 20,
              output: 90,
              cache: { read: 2, write: 25 },
            },
          ])

          const session = SessionV2.Info.make({
            id: SessionV2.ID.make("ses_models_dev_fast_max"),
            projectID: ProjectV2.ID.global,
            title: "test",
            model: {
              id: fast.id,
              providerID: fast.providerID,
              variant: ModelV2.VariantID.make("max"),
            },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            time: { created: fast.time.released, updated: fast.time.released },
            location: { directory: AbsolutePath.make("/project") },
          })
          const resolved = yield* SessionRunnerModel.resolve(session, fast)
          const prepared = yield* LLMClient.prepare(LLM.request({ model: resolved, prompt: "Hello" }))

          expect(prepared.body).toMatchObject({
            model: "gpt-5.6",
            store: false,
            service_tier: "priority",
            reasoning: { effort: "max", summary: "auto" },
            include: ["reasoning.encrypted_content"],
          })

          const models = yield* catalog.model.all()
          expect(
            models
              .map((model) => model.id)
              .filter((id) => id.startsWith("gpt-5.6"))
              .sort(),
          ).toEqual(ids.flatMap((id) => [id, `${id}-fast`]).sort())

          const legacy = yield* catalog.model.get(providerID, ModelV2.ID.make("gpt-5.5"))
          expect(legacy.variants.map((variant) => variant.id)).toEqual(["fast", "pro"])
          expect(models.map((model) => model.id)).not.toContain("gpt-5.5-fast")
        }).pipe(Effect.provide(ModelsDev.defaultLayer)),
      (previous) =>
        Effect.sync(() => {
          Flag.SLOPCODE_MODELS_PATH = previous.path
          Flag.SLOPCODE_DISABLE_MODELS_FETCH = previous.disabled
        }),
    ),
  )

  it.effect("preserves later config transforms across models.dev refreshes", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const integrations = yield* Integration.Service
      const events = yield* EventV2.Service
      const modelRefresh = [yield* Deferred.make<void>(), yield* Deferred.make<void>()]
      const configRefresh = [yield* Deferred.make<void>(), yield* Deferred.make<void>()]
      const snapshots = [
        {
          shared: provider("shared", "shared-model", "one"),
          old: provider("old", "old-model"),
        },
        {
          shared: provider("shared", "shared-model", "two"),
          middle: provider("middle", "middle-model"),
        },
        {
          shared: provider("shared", "shared-model", "three"),
          current: provider("current", "current-model"),
        },
      ]
      let reads = 0
      let catalogRegistrations = 0
      let catalogRuns = 0
      let configRuns = 0
      let integrationRegistrations = 0
      let integrationRuns = 0
      const models = ModelsDev.Service.of({
        get: () => Effect.sync(() => snapshots[Math.min(reads++, snapshots.length - 1)]!),
        refresh: () => Effect.void,
      })
      const pluginCatalog = Catalog.Service.of({
        ...catalog,
        transform: (update) => {
          catalogRegistrations++
          return catalog.transform((draft) => {
            catalogRuns++
            const result = update(draft)
            const refreshed = modelRefresh[catalogRuns - 3]
            if (!refreshed) return result
            return Effect.suspend(() =>
              Effect.isEffect(result)
                ? result.pipe(Effect.andThen(Deferred.succeed(refreshed, undefined)), Effect.asVoid)
                : Deferred.succeed(refreshed, undefined).pipe(Effect.asVoid),
            )
          })
        },
      })
      const pluginIntegrations = Integration.Service.of({
        ...integrations,
        transform: (update) => {
          integrationRegistrations++
          return integrations.transform((draft) => {
            integrationRuns++
            return update(draft)
          })
        },
      })

      yield* ModelsDevPlugin.effect.pipe(
        Effect.provideService(ModelsDev.Service, models),
        Effect.provideService(Catalog.Service, pluginCatalog),
        Effect.provideService(Integration.Service, pluginIntegrations),
      )
      const providerID = ProviderV2.ID.make("shared")
      const modelID = ModelV2.ID.make("shared-model")
      yield* catalog.transform((draft) => {
        configRuns++
        draft.provider.update(providerID, (provider) => {
          provider.name = "Configured provider"
          provider.api = {
            type: "aisdk",
            package: "configured-provider",
            url: "https://configured-provider.test",
          }
          provider.request.headers["x-provider"] = "configured"
          provider.request.body.provider = "configured"
        })
        draft.model.update(providerID, modelID, (model) => {
          model.name = "Configured model"
          model.api = {
            id: ModelV2.ID.make("configured-model"),
            type: "aisdk",
            package: "configured-model",
            url: "https://configured-model.test",
          }
          model.request.headers["x-model"] = "configured"
          model.request.body.model = "configured"
          model.request.generation = { temperature: 0.25 }
          model.request.options = { reasoningEffort: "high" }
          model.variants = [
            {
              id: ModelV2.VariantID.make("configured"),
              headers: { "x-variant": "configured" },
              body: { variant: "configured" },
              generation: {},
              options: {},
            },
          ]
          model.limit = { context: 999, input: 888, output: 777 }
        })
        const refreshed = configRefresh[configRuns - 2]
        if (refreshed) return Deferred.succeed(refreshed, undefined).pipe(Effect.asVoid)
      })

      for (const index of [0, 1]) {
        yield* events.publish(ModelsDev.Event.Refreshed, {})
        yield* Effect.all([Deferred.await(modelRefresh[index]!), Deferred.await(configRefresh[index]!)], {
          discard: true,
        })
        yield* Effect.yieldNow
      }

      const configuredProvider = yield* catalog.provider.get(providerID)
      const configuredModel = yield* catalog.model.get(providerID, modelID)

      expect(configuredProvider).toMatchObject({
        name: "Configured provider",
        api: {
          type: "aisdk",
          package: "configured-provider",
          url: "https://configured-provider.test",
        },
        request: {
          headers: { "x-provider": "configured" },
          body: { provider: "configured" },
        },
      })
      expect(configuredModel).toMatchObject({
        name: "Configured model",
        api: {
          id: "configured-model",
          type: "aisdk",
          package: "configured-model",
          url: "https://configured-model.test",
        },
        request: {
          headers: { "x-provider": "configured", "x-model": "configured" },
          body: { provider: "configured", model: "configured" },
          generation: { temperature: 0.25 },
          options: { reasoningEffort: "high" },
        },
        variants: [
          {
            id: "configured",
            headers: { "x-variant": "configured" },
            body: { variant: "configured" },
          },
        ],
        limit: { context: 999, input: 888, output: 777 },
      })
      expect(reads).toBe(3)
      expect(catalogRegistrations).toBe(1)
      expect(integrationRegistrations).toBe(1)
      expect(catalogRuns).toBe(4)
      expect(configRuns).toBe(3)
      expect(integrationRuns).toBe(3)
      expect((yield* catalog.provider.all()).map((item) => item.id).sort()).toEqual(["current", "shared"])
      expect((yield* catalog.model.all()).map((item) => item.id).sort()).toEqual(["current-model", "shared-model"])
      expect((yield* integrations.list()).map((item) => item.id).sort()).toEqual(["current", "shared"])
    }),
  )
})
