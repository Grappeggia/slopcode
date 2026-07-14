import { DateTime, Effect, Scope, Stream } from "effect"
import { Catalog } from "../catalog"
import { Integration } from "../integration"
import { EventV2 } from "../event"
import { ModelV2 } from "../model"
import { ModelRequest } from "../model-request"
import { ModelsDev } from "../models-dev"
import { PluginV2 } from "../plugin"
import { ProviderV2 } from "../provider"
import { State } from "../state"

const managed = new Set(["gpt-5.6", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"])

function packageName(providerID: ProviderV2.ID, model: ModelsDev.Model, provider: ModelsDev.Provider) {
  if ((providerID === ProviderV2.ID.slopcode || providerID === ProviderV2.ID.slopcodeGo) && managed.has(model.id))
    return "@ai-sdk/openai"
  return model.provider?.npm ?? provider.npm
}

function released(date: string) {
  const time = Date.parse(date)
  return DateTime.makeUnsafe(Number.isFinite(time) ? time : 0)
}

function cost(input: ModelsDev.Model["cost"]) {
  const base = {
    input: input?.input ?? 0,
    output: input?.output ?? 0,
    cache: {
      read: input?.cache_read ?? 0,
      write: input?.cache_write ?? 0,
    },
  }
  if (!input?.context_over_200k) return [base]
  return [
    base,
    {
      tier: {
        type: "context" as const,
        size: 200_000,
      },
      input: input.context_over_200k.input,
      output: input.context_over_200k.output,
      cache: {
        read: input.context_over_200k.cache_read ?? 0,
        write: input.context_over_200k.cache_write ?? 0,
      },
    },
  ]
}

function variants(model: ModelsDev.Model, packageName?: string) {
  const effort = model.reasoning_options?.find((item) => item.type === "effort")
  if (effort)
    return effort.values
      .filter((id): id is string => typeof id === "string")
      .map((id) => ({
        id: ModelV2.VariantID.make(id),
        headers: {},
        ...ModelRequest.normalizeAiSdkOptions(packageName, { reasoningEffort: id }),
      }))
  return Object.entries(model.experimental?.modes ?? {}).map(([id, item]) => {
    const request = ModelRequest.normalizeAiSdkOptions(packageName, item.provider?.body ?? {})
    return {
      id: ModelV2.VariantID.make(id),
      headers: { ...(item.provider?.headers ?? {}) },
      ...request,
    }
  })
}

function effort(model: ModelsDev.Model) {
  if (!model.reasoning_options) return "medium"
  const option = model.reasoning_options.find((item) => item.type === "effort")
  if (!option) return
  const values = option.values.filter((item): item is string => typeof item === "string")
  if (values.includes("medium")) return "medium"
  if (values.includes("high")) return "high"
  return values[0]
}

function defaults(model: ModelsDev.Model, packageName?: string) {
  const reasoning = packageName === "@ai-sdk/openai" && model.reasoning
  const level = reasoning ? effort(model) : undefined
  return ModelRequest.normalizeAiSdkOptions(
    packageName,
    reasoning
      ? {
          store: false,
          ...(level ? { reasoningEffort: level } : {}),
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        }
      : {},
  )
}

export const ModelsDevPlugin = PluginV2.define({
  id: PluginV2.ID.make("models-dev"),
  effect: Effect.gen(function* () {
    const catalog = yield* Catalog.Service
    const integrations = yield* Integration.Service
    const modelsDev = yield* ModelsDev.Service
    const events = yield* EventV2.Service
    const scope = yield* Scope.Scope
    const current = { data: yield* modelsDev.get() }
    const auth = (integrations: Integration.Editor) => {
      for (const item of Object.values(current.data)) {
        if (item.env.length === 0) continue
        const integrationID = Integration.ID.make(item.id)
        integrations.update(integrationID, (integration) => (integration.name = item.name))
        integrations.method.update({
          integrationID,
          method: new Integration.KeyMethod({
            type: "key",
          }),
        })
        integrations.method.update({
          integrationID,
          method: new Integration.EnvMethod({
            type: "env",
            names: [...item.env],
          }),
        })
      }
    }
    const models = (catalog: Catalog.Editor) => {
      for (const item of Object.values(current.data)) {
        const providerID = ProviderV2.ID.make(item.id)
        catalog.provider.update(providerID, (provider) => {
          provider.name = item.name
          provider.env = [...item.env]
          provider.api = item.npm
            ? {
                type: "aisdk",
                package: item.npm,
                url: item.api,
              }
            : {
                type: "native",
                url: item.api,
                settings: {},
              }
        })
        for (const model of Object.values(item.models)) {
          const modelID = ModelV2.ID.make(model.id)
          const npm = packageName(providerID, model, item)
          const override = model.provider?.npm !== undefined || npm !== item.npm
          catalog.model.update(providerID, modelID, (draft) => {
            draft.name = model.name
            draft.family = model.family ? ModelV2.Family.make(model.family) : undefined
            draft.api = override
              ? {
                  id: draft.api.id,
                  type: "aisdk",
                  package: npm!,
                  url: model.provider?.api,
                }
              : {
                  id: draft.api.id,
                  type: "native",
                  url: model.provider?.api,
                  settings: {},
                }
            draft.capabilities = {
              tools: model.tool_call,
              input: [...(model.modalities?.input ?? [])],
              output: [...(model.modalities?.output ?? [])],
            }
            draft.request = {
              headers: {},
              ...defaults(model, npm),
            }
            draft.variants = variants(model, npm)
            draft.time.released = released(model.release_date)
            draft.cost = cost(model.cost)
            draft.status = model.status ?? "active"
            draft.enabled = true
            draft.limit = {
              context: model.limit.context,
              input: model.limit.input,
              output: model.limit.output,
            }
          })

          const fast = model.reasoning_options?.some((item) => item.type === "effort")
            ? model.experimental?.modes?.fast
            : undefined
          if (!fast) continue
          const request = ModelRequest.normalizeAiSdkOptions(npm, fast.provider?.body ?? {})
          catalog.model.update(providerID, ModelV2.ID.make(`${model.id}-fast`), (draft) => {
            draft.name = `${model.name} Fast`
            draft.family = model.family ? ModelV2.Family.make(model.family) : undefined
            draft.api = override
              ? {
                  id: modelID,
                  type: "aisdk",
                  package: npm!,
                  url: model.provider?.api,
                }
              : {
                  id: modelID,
                  type: "native",
                  url: model.provider?.api,
                  settings: {},
                }
            draft.capabilities = {
              tools: model.tool_call,
              input: [...(model.modalities?.input ?? [])],
              output: [...(model.modalities?.output ?? [])],
            }
            draft.request = ModelRequest.merge(
              { headers: {}, ...defaults(model, npm) },
              { headers: { ...(fast.provider?.headers ?? {}) }, ...request },
            )
            draft.variants = variants(model, npm)
            draft.time.released = released(model.release_date)
            draft.cost = cost(fast.cost ?? model.cost)
            draft.status = model.status ?? "active"
            draft.enabled = true
            draft.limit = {
              context: model.limit.context,
              input: model.limit.input,
              output: model.limit.output,
            }
          })
        }
      }
    }
    yield* State.batch(
      Effect.gen(function* () {
        yield* integrations.transform(auth)
        yield* catalog.transform(models)
      }),
    )
    const refresh = Effect.fn("ModelsDevPlugin.refresh")(function* () {
      current.data = yield* modelsDev.get()
      yield* integrations.reload()
      yield* catalog.reload()
    })
    yield* events.subscribe(ModelsDev.Event.Refreshed).pipe(
      Stream.runForEach(() => refresh()),
      Effect.forkScoped({ startImmediately: true }),
    )
  }),
})
