import { describe, expect } from "bun:test"
import { DateTime, Effect, Layer, Option } from "effect"
import { Catalog } from "@slopcode-ai/core/catalog"
import { Credential } from "@slopcode-ai/core/credential"
import { EventV2 } from "@slopcode-ai/core/event"
import { Location } from "@slopcode-ai/core/location"
import { ModelV2 } from "@slopcode-ai/core/model"
import { PluginV2 } from "@slopcode-ai/core/plugin"
import { SlopcodePlugin } from "@slopcode-ai/core/plugin/provider/slopcode"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { location } from "../fixture/location"
import { it, model, provider, withEnv } from "./provider-helper"

const cost = (input: number, output = 0) => [{ input, output, cache: { read: 0, write: 0 } }]
const locationLayer = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make("test") })),
)

describe("SlopcodePlugin", () => {
  it.effect("uses a public key and disables paid models without credentials", () =>
    withEnv({ SLOPCODE_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(SlopcodePlugin)
        yield* catalog.transform((catalog) => {
          const item = provider("slopcode")
          catalog.provider.update(item.id, () => {})
          const paid = model("slopcode", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.slopcode)).request.body.apiKey).toBe("public")
        expect((yield* catalog.model.get(ProviderV2.ID.slopcode, ModelV2.ID.make("paid"))).enabled).toBe(false)
      }),
    ),
  )

  it.effect("keeps free models without credentials", () =>
    withEnv({ SLOPCODE_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(SlopcodePlugin)
        yield* catalog.transform((catalog) => {
          const item = provider("slopcode")
          catalog.provider.update(item.id, () => {})
          const free = model("slopcode", "free", { cost: cost(0) })
          catalog.model.update(item.id, free.id, (draft) => {
            draft.cost = [...free.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.slopcode)).request.body.apiKey).toBe("public")
        expect((yield* catalog.model.get(ProviderV2.ID.slopcode, ModelV2.ID.make("free"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("treats output-only cost as free without credentials", () =>
    withEnv({ SLOPCODE_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(SlopcodePlugin)
        yield* catalog.transform((catalog) => {
          const item = provider("slopcode")
          catalog.provider.update(item.id, () => {})
          const outputOnly = model("slopcode", "output-only", { cost: cost(0, 1) })
          catalog.model.update(item.id, outputOnly.id, (draft) => {
            draft.cost = [...outputOnly.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.slopcode)).request.body.apiKey).toBe("public")
        expect((yield* catalog.model.get(ProviderV2.ID.slopcode, ModelV2.ID.make("output-only"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("uses SLOPCODE_API_KEY as credentials", () =>
    withEnv({ SLOPCODE_API_KEY: "secret" }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(SlopcodePlugin)
        yield* catalog.transform((catalog) => {
          const item = provider("slopcode")
          catalog.provider.update(item.id, () => {})
          const paid = model("slopcode", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.slopcode)).request.body.apiKey).toBeUndefined()
        expect((yield* catalog.model.get(ProviderV2.ID.slopcode, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("uses configured provider env vars as credentials", () =>
    withEnv({ SLOPCODE_API_KEY: undefined, CUSTOM_SLOPCODE_API_KEY: "secret" }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(SlopcodePlugin)
        yield* catalog.transform((catalog) => {
          const item = provider("slopcode", { env: ["CUSTOM_SLOPCODE_API_KEY"] })
          catalog.provider.update(item.id, (draft) => {
            draft.env = [...item.env]
          })
          const paid = model("slopcode", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.slopcode)).request.body.apiKey).toBeUndefined()
        expect((yield* catalog.model.get(ProviderV2.ID.slopcode, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("uses configured apiKey as credentials", () =>
    withEnv({ SLOPCODE_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(SlopcodePlugin)
        yield* catalog.transform((catalog) => {
          const item = provider("slopcode", {
            request: {
              headers: {},
              body: { apiKey: "configured" },
            },
          })
          catalog.provider.update(item.id, (draft) => {
            draft.request = item.request
          })
          const paid = model("slopcode", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.slopcode)).request.body.apiKey).toBe("configured")
        expect((yield* catalog.model.get(ProviderV2.ID.slopcode, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("uses auth-enabled providers as credentials", () =>
    withEnv({ SLOPCODE_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(SlopcodePlugin)
        yield* catalog.transform((catalog) => {
          const item = provider("slopcode", {
            enabled: { via: "credential", credentialID: Credential.ID.make("credential") },
          })
          catalog.provider.update(item.id, (draft) => {
            draft.enabled = item.enabled
          })
          const paid = model("slopcode", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.slopcode)).request.body.apiKey).toBeUndefined()
        expect((yield* catalog.model.get(ProviderV2.ID.slopcode, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("ignores non-slopcode providers and models", () =>
    withEnv({ SLOPCODE_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(SlopcodePlugin)
        yield* catalog.transform((catalog) => {
          const item = provider("openai")
          catalog.provider.update(item.id, () => {})
          const paid = model("openai", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.openai)).request.body.apiKey).toBeUndefined()
        expect((yield* catalog.model.get(ProviderV2.ID.openai, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("defaults SlopCode to GPT-5.6 Sol Fast when available", () =>
    withEnv({ SLOPCODE_API_KEY: "secret" }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(SlopcodePlugin)
        yield* catalog.transform((catalog) => {
          const item = provider("slopcode", {
            enabled: { via: "env", name: "SLOPCODE_API_KEY" },
            env: ["SLOPCODE_API_KEY"],
          })
          catalog.provider.update(item.id, (draft) => {
            draft.enabled = item.enabled
            draft.env = [...item.env]
          })
          catalog.model.update(item.id, ModelV2.ID.make("gpt-5.6-sol-fast"), () => {})
        })

        const selected = Option.getOrUndefined(yield* catalog.model.default())
        expect(selected?.id).toBe(ModelV2.ID.make("gpt-5.6-sol-fast"))
        expect(selected?.request.variant).toBeUndefined()
      }),
    ),
  )

  it.effect("prefers gpt-5-nano as the slopcode small model", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const providerID = ProviderV2.ID.slopcode

      yield* catalog.transform((catalog) => {
        catalog.provider.update(providerID, () => {})
        catalog.model.update(providerID, ModelV2.ID.make("cheap-mini"), (model) => {
          model.capabilities.input = ["text"]
          model.capabilities.output = ["text"]
          model.cost = [...cost(1, 1)]
          model.time.released = DateTime.makeUnsafe(Date.now())
        })
        catalog.model.update(providerID, ModelV2.ID.make("gpt-5-nano"), (model) => {
          model.capabilities.input = ["text"]
          model.capabilities.output = ["text"]
          model.cost = [...cost(10, 10)]
          model.time.released = DateTime.makeUnsafe(Date.now())
        })
      })

      const selected = yield* catalog.model.small(providerID)

      expect(Option.getOrUndefined(selected)?.id).toBe(ModelV2.ID.make("gpt-5-nano"))
    }).pipe(
      Effect.provide(Catalog.locationLayer.pipe(Layer.provide(EventV2.defaultLayer), Layer.provide(locationLayer))),
    ),
  )
})
