import { Effect } from "effect"
import { ModelV2 } from "../../model"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider"

const DEFAULT_MODEL = ModelV2.ID.make("gpt-5.5")
const DEFAULT_VARIANT = ModelV2.VariantID.make("fast")

export const SlopcodePlugin = PluginV2.define({
  id: PluginV2.ID.make("slopcode"),
  effect: Effect.gen(function* () {
    return {
      "catalog.transform": Effect.fn(function* (evt) {
        const ids = [ProviderV2.ID.slopcode, ProviderV2.ID.slopcodeGo]
        for (const id of ids) {
          const item = evt.provider.get(id)
          if (!item) continue
          const hasKey = Boolean(
            process.env.SLOPCODE_API_KEY ||
              item.provider.env.some((env) => process.env[env]) ||
              (item.provider.request.body as Record<string, unknown>)?.apiKey ||
              (item.provider.enabled &&
                typeof item.provider.enabled === "object" &&
                (item.provider.enabled as Record<string, unknown>)?.via === "credential"),
          )
          evt.provider.update(item.provider.id, (provider) => {
            if (!hasKey) {
              provider.request.body.apiKey = "public"
              if (id === ProviderV2.ID.slopcode) provider.enabled = { via: "custom", data: {} }
            }
          })
          if (!hasKey && id === ProviderV2.ID.slopcode) {
            for (const model of item.models.values()) {
              if (!model.cost.some((cost) => cost.input > 0)) continue
              evt.model.update(item.provider.id, model.id, (draft) => {
                draft.enabled = false
              })
            }
          }

          const model = evt.model.get(id, DEFAULT_MODEL)
          if (id !== ProviderV2.ID.slopcode || !model?.enabled) continue
          if (model.variants.some((variant) => variant.id === DEFAULT_VARIANT)) {
            evt.model.update(id, DEFAULT_MODEL, (draft) => {
              draft.request.variant ??= DEFAULT_VARIANT
            })
          }
          if (!evt.model.default.get()) evt.model.default.set(id, DEFAULT_MODEL)
        }
      }),
    }
  }),
})
