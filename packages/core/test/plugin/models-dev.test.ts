import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
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
import { AbsolutePath } from "@slopcode-ai/core/schema"
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
                options: { serviceTier: "priority" },
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
})
