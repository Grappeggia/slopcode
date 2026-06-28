import { Effect } from "effect"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider"

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
          if (hasKey) continue
          if (id === ProviderV2.ID.slopcode) {
            for (const model of item.models.values()) {
              if (!model.cost.some((cost) => cost.input > 0)) continue
              evt.model.update(item.provider.id, model.id, (draft) => {
                draft.enabled = false
              })
            }
          }
        }
      }),
    }
  }),
})
