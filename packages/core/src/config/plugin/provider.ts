export * as ConfigProviderPlugin from "./provider"

import { Effect } from "effect"
import { Catalog } from "../../catalog"
import { Config } from "../../config"
import { ModelV2 } from "../../model"
import { ModelRequest } from "../../model-request"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider"

type ProviderConfig = Config.Info["providers"] extends Record<string, infer T> | undefined ? T : never

type Discovery = {
  baseURL: string
  npm: string
  models: { id: string; name: string }[]
  settings: Record<string, unknown>
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function string(value: unknown) {
  if (typeof value !== "string") return
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

function base(value: string) {
  try {
    const url = new URL(value)
    url.hash = ""
    url.search = ""
    return url.toString().replace(/\/+$/, "")
  } catch {
    return value.replace(/\/+$/, "")
  }
}

function urls(value: string) {
  const root = base(value)
  const candidates = [root]
  if (root.endsWith("/api")) candidates.push(`${root}/v1`)
  if (!root.endsWith("/api") && !root.endsWith("/api/v1") && !root.endsWith("/v1")) {
    candidates.push(`${root}/api`, `${root}/api/v1`, `${root}/v1`)
  }
  return [...new Set(candidates)].map((baseURL) => ({ baseURL, url: `${baseURL}/models` }))
}

function local(id: ProviderV2.ID, provider: ProviderConfig) {
  if (provider.api?.type === "aisdk" && provider.api.package.includes("openai-compatible")) return true
  return id === "openwebui" || id === "ollama" || id === "lmstudio" || id.includes("local")
}

function settings(provider: ProviderConfig) {
  const apiSettings = provider.api?.type === "aisdk" ? provider.api.settings : undefined
  const request = provider.request?.body
  return {
    ...(apiSettings ?? {}),
    ...(request?.apiKey !== undefined ? { apiKey: request.apiKey } : {}),
  }
}

function headers(provider: ProviderConfig) {
  const result: Record<string, string> = { Accept: "application/json" }
  Object.assign(result, provider.request?.headers)
  const key = string(settings(provider).apiKey)
  if (key && !Object.keys(result).some((item) => item.toLowerCase() === "authorization")) {
    result.Authorization = key.toLowerCase().startsWith("bearer ") ? key : `Bearer ${key}`
  }
  return result
}

function endpoint(provider: ProviderConfig) {
  if (provider.api?.type === "aisdk") return string(provider.api.url)
  if (provider.api?.type === "native") return string(provider.api.url)
  return string(provider.request?.body?.baseURL)
}

function models(input: unknown) {
  const list = Array.isArray(input)
    ? input
    : record(input) && Array.isArray(input.data)
      ? input.data
      : record(input) && Array.isArray(input.models)
        ? input.models
        : []
  return list.flatMap((item) => {
    if (typeof item === "string") return [{ id: item, name: item }]
    if (!record(item)) return []
    const id = string(item.id) ?? string(item.model) ?? string(item.name)
    if (!id) return []
    return [{ id, name: string(item.name) ?? id }]
  })
}

async function discover(id: ProviderV2.ID, provider: ProviderConfig): Promise<Discovery | undefined> {
  const root = endpoint(provider)
  if (!root || !local(id, provider)) return
  const npm = provider.api?.type === "aisdk" ? provider.api.package : "@ai-sdk/openai-compatible"
  for (const candidate of urls(root)) {
    try {
      const response = await fetch(candidate.url, {
        headers: headers(provider),
        signal: AbortSignal.timeout(2_000),
      })
      if (!response.ok) continue
      const discovered = models(await response.json())
      if (discovered.length === 0) continue
      return { baseURL: candidate.baseURL, npm, models: discovered, settings: settings(provider) }
    } catch {}
  }
}

export const Plugin = PluginV2.define({
  id: PluginV2.ID.make("config-provider"),
  effect: Effect.gen(function* () {
    const catalog = yield* Catalog.Service
    const config = yield* Config.Service

    const entries = yield* config.entries()
    const files = entries.filter((entry): entry is Config.Document => entry.type === "document")
    const discovered = new Map<ProviderV2.ID, Discovery>()
    for (const file of files) {
      for (const [id, item] of Object.entries(file.info.providers ?? {})) {
        const providerID = ProviderV2.ID.make(id)
        const result = yield* Effect.promise(() => discover(providerID, item))
        if (result) discovered.set(providerID, result)
      }
    }

    yield* catalog.transform((draft) => {
      const configuredDefault = Config.latest(entries, "model")
      if (configuredDefault !== undefined) {
        const model = ModelV2.parse(configuredDefault)
        draft.model.default.set(model.providerID, model.modelID)
      }
      for (const file of files) {
        for (const [id, item] of Object.entries(file.info.providers ?? {})) {
          const providerID = ProviderV2.ID.make(id)
          draft.provider.update(providerID, (provider) => {
            if (item.name !== undefined) provider.name = item.name
            if (item.env !== undefined) provider.env = [...item.env]
            provider.enabled = { via: "custom", data: {} }
            if (item.api !== undefined) provider.api = { ...item.api }
            if (item.request !== undefined) {
              Object.assign(provider.request.headers, item.request.headers)
              Object.assign(provider.request.body, item.request.body)
            }
          })
          const providerApi = draft.provider.get(providerID)?.provider.api
          const providerPackage = providerApi?.type === "aisdk" ? providerApi.package : undefined

          for (const [id, config] of Object.entries(item.models ?? {})) {
            draft.model.update(providerID, ModelV2.ID.make(id), (model) => {
              if (config.family !== undefined) model.family = config.family
              if (config.name !== undefined) model.name = config.name
              if (config.api !== undefined) model.api = { ...model.api, ...config.api }
              const packageName = model.api.type === "aisdk" ? model.api.package : providerPackage
              if (config.capabilities !== undefined) {
                model.capabilities = {
                  tools: config.capabilities.tools,
                  input: [...config.capabilities.input],
                  output: [...config.capabilities.output],
                }
              }
              if (config.request !== undefined) {
                ModelRequest.assign(model.request, {
                  headers: config.request.headers,
                  ...ModelRequest.normalizeAiSdkOptions(packageName, config.request.body ?? {}),
                })
                if (config.request.variant !== undefined) model.request.variant = config.request.variant
              }
              if (config.variants !== undefined) {
                for (const variant of config.variants) {
                  let existing = model.variants.find((item) => item.id === variant.id)
                  if (!existing) {
                    existing = {
                      id: variant.id,
                      headers: {},
                      body: {},
                      generation: {},
                      options: {},
                    }
                    model.variants.push(existing)
                  }
                  ModelRequest.assign(existing, {
                    headers: variant.headers,
                    ...ModelRequest.normalizeAiSdkOptions(packageName, variant.body ?? {}),
                  })
                }
              }
              if (config.cost !== undefined) {
                model.cost = (Array.isArray(config.cost) ? config.cost : [config.cost]).map((cost) => ({
                  tier: cost.tier && { ...cost.tier },
                  input: cost.input,
                  output: cost.output,
                  cache: {
                    read: cost.cache?.read ?? 0,
                    write: cost.cache?.write ?? 0,
                  },
                }))
              }
                if (config.disabled !== undefined) model.enabled = !config.disabled
              if (config.limit !== undefined) model.limit = { ...model.limit, ...config.limit }
            })
          }
          const found = discovered.get(providerID)
          if (found) {
            draft.provider.update(providerID, (provider) => {
              provider.api = { type: "aisdk", package: found.npm, url: found.baseURL, settings: found.settings }
            })
            for (const model of found.models) {
              const modelID = ModelV2.ID.make(model.id)
              if (draft.model.get(providerID, modelID)) continue
              draft.model.update(providerID, modelID, (draft) => {
                draft.name = model.name
                draft.api = {
                  id: modelID,
                  type: "aisdk",
                  package: found.npm,
                  url: found.baseURL,
                  settings: found.settings,
                }
                draft.capabilities = { tools: true, input: ["text"], output: ["text"] }
                draft.enabled = true
              })
            }
          }
        }
      }
    })
  }),
})
