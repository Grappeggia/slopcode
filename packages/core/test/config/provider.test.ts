import { describe, expect } from "bun:test"
import { createServer, type Server } from "node:http"
import { DateTime, Effect, Option, Schema } from "effect"
import { Catalog } from "@slopcode-ai/core/catalog"
import { Config } from "@slopcode-ai/core/config"
import { ConfigProviderPlugin } from "@slopcode-ai/core/config/plugin/provider"
import { ModelV2 } from "@slopcode-ai/core/model"
import { PluginV2 } from "@slopcode-ai/core/plugin"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionRunnerModel } from "@slopcode-ai/core/session/runner/model"
import { it } from "../plugin/provider-helper"

function request(headers: Record<string, string>, variant?: string) {
  return {
    headers,
    variant,
  }
}

const decode = Schema.decodeUnknownSync(Config.Info)

describe("ConfigProviderPlugin.Plugin", () => {
  it.effect("preserves a user-configured managed endpoint after catalog defaults", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const plugin = yield* PluginV2.Service
      const providerID = ProviderV2.ID.slopcode
      const modelID = ModelV2.ID.make("gpt-5.6")
      yield* catalog.transform((draft) => {
        draft.provider.update(providerID, (provider) => {
          provider.api = {
            type: "aisdk",
            package: "@ai-sdk/openai-compatible",
            url: "https://slopcode.dev/zen/v1",
          }
        })
        draft.model.update(providerID, modelID, (model) => {
          model.api = { id: modelID, type: "aisdk", package: "@ai-sdk/openai" }
          model.limit = { context: 1_050_000, output: 128_000 }
          model.time.released = DateTime.makeUnsafe(0)
        })
      })
      const config = Config.Service.of({
        entries: () =>
          Effect.succeed([
            new Config.Document({
              type: "document",
              info: decode({
                providers: {
                  slopcode: {
                    api: { type: "aisdk", package: "@ai-sdk/openai", url: "https://custom.example/managed/v1" },
                  },
                },
              }),
            }),
          ]),
      })
      yield* plugin.add({
        ...ConfigProviderPlugin.Plugin,
        effect: ConfigProviderPlugin.Plugin.effect.pipe(
          Effect.provideService(Config.Service, config),
          Effect.provideService(Catalog.Service, catalog),
        ),
      })

      const model = yield* catalog.model.get(providerID, modelID)
      const resolved = yield* SessionRunnerModel.resolve(
        SessionV2.Info.make({
          id: SessionV2.ID.make("ses_custom_managed"),
          projectID: ProjectV2.ID.global,
          title: "test",
          model: { id: modelID, providerID },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          time: { created: model.time.released, updated: model.time.released },
          location: { directory: AbsolutePath.make("/project") },
        }),
        model,
      )

      expect(model.api.url).toBe("https://custom.example/managed/v1")
      expect(resolved.model.route.endpoint).toMatchObject({
        baseURL: "https://custom.example/managed/v1",
        path: "/responses",
      })
    }),
  )

  it.effect("partitions existing model variant bodies without changing config shape", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const plugin = yield* PluginV2.Service
      const providerID = ProviderV2.ID.slopcode
      const modelID = ModelV2.ID.make("alpha-gpt-next")
      const config = Config.Service.of({
        entries: () =>
          Effect.succeed([
            new Config.Document({
              type: "document",
              info: decode({
                providers: {
                  slopcode: {
                    api: { type: "aisdk", package: "@ai-sdk/openai", url: "https://slopcode.test/v1" },
                    models: {
                      "alpha-gpt-next": {
                        variants: [
                          {
                            id: "high",
                            body: {
                              reasoningEffort: "high",
                              reasoningSummary: "auto",
                              include: ["reasoning.encrypted_content"],
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              }),
            }),
          ]),
      })

      yield* plugin.add({
        ...ConfigProviderPlugin.Plugin,
        effect: ConfigProviderPlugin.Plugin.effect.pipe(
          Effect.provideService(Config.Service, config),
          Effect.provideService(Catalog.Service, catalog),
        ),
      })

      const model = yield* catalog.model.get(providerID, modelID)
      expect(model.variants).toMatchObject([
        {
          id: "high",
          body: {},
          options: {
            reasoningEffort: "high",
            reasoningSummary: "auto",
            include: ["reasoning.encrypted_content"],
          },
        },
      ])
    }),
  )

  it.effect("uses the effective provider package across layered config", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const plugin = yield* PluginV2.Service
      const providerID = ProviderV2.ID.slopcode
      const modelID = ModelV2.ID.make("alpha-gpt-next")
      const config = Config.Service.of({
        entries: () =>
          Effect.succeed([
            new Config.Document({
              type: "document",
              info: decode({
                providers: {
                  slopcode: {
                    api: { type: "aisdk", package: "@ai-sdk/openai", url: "https://slopcode.test/v1" },
                  },
                },
              }),
            }),
            new Config.Document({
              type: "document",
              info: decode({
                providers: {
                  slopcode: {
                    models: {
                      "alpha-gpt-next": {
                        variants: [{ id: "high", body: { reasoningEffort: "high" } }],
                      },
                    },
                  },
                },
              }),
            }),
          ]),
      })

      yield* plugin.add({
        ...ConfigProviderPlugin.Plugin,
        effect: ConfigProviderPlugin.Plugin.effect.pipe(
          Effect.provideService(Config.Service, config),
          Effect.provideService(Catalog.Service, catalog),
        ),
      })

      const model = yield* catalog.model.get(providerID, modelID)
      expect(model.variants[0]).toMatchObject({
        id: "high",
        body: {},
        options: { reasoningEffort: "high" },
      })
    }),
  )

  it.effect("loads configured providers and applies later model overrides", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const plugin = yield* PluginV2.Service
      const providerID = ProviderV2.ID.make("custom")
      const modelID = ModelV2.ID.make("chat")
      const config = Config.Service.of({
        entries: () =>
          Effect.succeed([
            new Config.Document({
              type: "document",
              info: decode({
                model: "custom/first",
                providers: {
                  custom: {
                    name: "Configured",
                    env: ["CUSTOM_API_KEY"],
                    api: { type: "native", settings: {} },
                    request: request({ first: "first", shared: "first" }),
                    models: {
                      chat: {
                        name: "First",
                        capabilities: { tools: true, input: ["text"], output: ["text"] },
                        disabled: true,
                        limit: { context: 100, output: 50 },
                        cost: { input: 1, output: 2 },
                        request: request({ first: "first", shared: "first" }, "retained"),
                        variants: [
                          {
                            id: "fast",
                            headers: { first: "first", shared: "first" },
                          },
                        ],
                      },
                    },
                  },
                },
              }),
            }),
            new Config.Document({
              type: "document",
              info: decode({
                model: "custom/default",
                providers: {
                  custom: {
                    api: { type: "aisdk", package: "custom-sdk", url: "https://example.test" },
                    request: request({ last: "last", shared: "last" }),
                    models: {
                      default: {
                        name: "Default",
                      },
                      chat: {
                        api: { id: "api-chat" },
                        name: "Last",
                        limit: { output: 75 },
                        request: request({ last: "last", shared: "last" }),
                        variants: [
                          {
                            id: "fast",
                            headers: { last: "last", shared: "last" },
                          },
                          {
                            id: "slow",
                            headers: { slow: "slow" },
                          },
                        ],
                      },
                    },
                  },
                },
              }),
            }),
            new Config.Document({
              type: "document",
              info: decode({
                providers: {
                  custom: { name: "Renamed" },
                },
              }),
            }),
          ]),
      })

      yield* plugin.add({
        ...ConfigProviderPlugin.Plugin,
        effect: ConfigProviderPlugin.Plugin.effect.pipe(
          Effect.provideService(Config.Service, config),
          Effect.provideService(Catalog.Service, catalog),
        ),
      })

      const provider = yield* catalog.provider.get(providerID)
      const model = yield* catalog.model.get(providerID, modelID)
      expect(Option.getOrUndefined(yield* catalog.model.default())?.id).toBe(ModelV2.ID.make("default"))
      expect(provider.name).toBe("Renamed")
      expect(provider.env).toEqual(["CUSTOM_API_KEY"])
      expect(provider.enabled).toEqual({ via: "custom", data: {} })
      expect(provider.api).toEqual({ type: "aisdk", package: "custom-sdk", url: "https://example.test" })
      expect(provider.request.headers).toEqual({ first: "first", shared: "last", last: "last" })
      expect(model.api.id).toBe(ModelV2.ID.make("api-chat"))
      expect(model.name).toBe("Last")
      expect(model.capabilities).toEqual({ tools: true, input: ["text"], output: ["text"] })
      expect(model.enabled).toBe(false)
      expect(model.limit).toEqual({ context: 100, output: 75 })
      expect(model.cost).toEqual([{ input: 1, output: 2, cache: { read: 0, write: 0 }, tier: undefined }])
      expect(model.request.headers).toEqual({ first: "first", shared: "last", last: "last" })
      expect(model.request.variant).toBe("retained")
      expect(model.variants.map((variant) => variant.id)).toEqual([
        ModelV2.VariantID.make("fast"),
        ModelV2.VariantID.make("slow"),
      ])
      expect(model.variants[0]?.headers).toEqual({ first: "first", shared: "last", last: "last" })
      expect(model.variants[1]?.headers).toEqual({ slow: "slow" })
    }),
  )

  it.live("discovers OpenWebUI models for catalog-backed clients", () =>
    Effect.gen(function* () {
      const server = yield* Effect.acquireRelease(
        Effect.promise(() => modelsServer()),
        (server) => Effect.sync(() => server.server.close()),
      )
      const catalog = yield* Catalog.Service
      const plugin = yield* PluginV2.Service
      const config = Config.Service.of({
        entries: () =>
          Effect.succeed([
            new Config.Document({
              type: "document",
              info: decode({
                providers: {
                  openwebui: {
                    name: "OpenWebUI",
                    request: {
                      body: {
                        apiKey: "test-key",
                        baseURL: server.url,
                      },
                    },
                    models: {
                      "glm-5.2-q8:latest": {
                        name: "GLM 5.2 Q8",
                        capabilities: { tools: true, input: ["text"], output: ["text"] },
                        variants: [
                          { id: "camel", body: { reasoningEffort: "high" } },
                          { id: "snake", body: { reasoning_effort: "low" } },
                        ],
                      },
                    },
                  },
                },
              }),
            }),
          ]),
      })

      yield* plugin.add({
        ...ConfigProviderPlugin.Plugin,
        effect: ConfigProviderPlugin.Plugin.effect.pipe(
          Effect.provideService(Config.Service, config),
          Effect.provideService(Catalog.Service, catalog),
        ),
      })

      const provider = yield* catalog.provider.get(ProviderV2.ID.make("openwebui"))
      const model = yield* catalog.model.get(ProviderV2.ID.make("openwebui"), ModelV2.ID.make("glm-5.2-q8:latest"))

      expect(provider.api).toEqual({
        type: "aisdk",
        package: "@ai-sdk/openai-compatible",
        url: `${server.url}/api`,
        settings: { apiKey: "test-key" },
      })
      expect(model.name).toBe("GLM 5.2 Q8")
      expect(model.api).toEqual({
        id: ModelV2.ID.make("glm-5.2-q8:latest"),
        type: "aisdk",
        package: "@ai-sdk/openai-compatible",
        url: `${server.url}/api`,
        settings: { apiKey: "test-key" },
      })
      expect(model.capabilities).toEqual({ tools: true, input: ["text"], output: ["text"] })
      expect(model.variants).toMatchObject([
        { id: "camel", body: {}, options: { reasoningEffort: "high" } },
        { id: "snake", body: {}, options: { reasoningEffort: "low" } },
      ])
      expect(server.requests).toContain("Bearer test-key")
    }),
  )

  it.live("does not discover models or forward credentials to non-loopback endpoints", () =>
    Effect.gen(function* () {
      const server = yield* Effect.acquireRelease(
        Effect.promise(() => modelsServer("0.0.0.0")),
        (server) => Effect.sync(() => server.server.close()),
      )
      const catalog = yield* Catalog.Service
      const plugin = yield* PluginV2.Service
      const config = Config.Service.of({
        entries: () =>
          Effect.succeed([
            new Config.Document({
              type: "document",
              info: decode({
                providers: {
                  openwebui: {
                    request: { body: { apiKey: "must-not-leak", baseURL: server.url } },
                    models: { manual: { name: "Manual" } },
                  },
                },
              }),
            }),
          ]),
      })

      yield* plugin.add({
        ...ConfigProviderPlugin.Plugin,
        effect: ConfigProviderPlugin.Plugin.effect.pipe(
          Effect.provideService(Config.Service, config),
          Effect.provideService(Catalog.Service, catalog),
        ),
      })

      expect(server.requests).toEqual([])
    }),
  )

  it.live("does not follow model discovery redirects away from loopback", () =>
    Effect.gen(function* () {
      const target = yield* Effect.acquireRelease(
        Effect.promise(() => modelsServer("0.0.0.0")),
        (server) => Effect.sync(() => server.server.close()),
      )
      const redirect = yield* Effect.acquireRelease(
        Effect.promise(() => modelsServer("127.0.0.1", target.url)),
        (server) => Effect.sync(() => server.server.close()),
      )
      const catalog = yield* Catalog.Service
      const plugin = yield* PluginV2.Service
      const config = Config.Service.of({
        entries: () =>
          Effect.succeed([
            new Config.Document({
              type: "document",
              info: decode({
                providers: {
                  openwebui: {
                    request: {
                      headers: { "x-api-key": "must-not-leak" },
                      body: { apiKey: "must-not-leak", baseURL: redirect.url },
                    },
                    models: { manual: { name: "Manual" } },
                  },
                },
              }),
            }),
          ]),
      })

      yield* plugin.add({
        ...ConfigProviderPlugin.Plugin,
        effect: ConfigProviderPlugin.Plugin.effect.pipe(
          Effect.provideService(Config.Service, config),
          Effect.provideService(Catalog.Service, catalog),
        ),
      })

      expect(redirect.requests).toContain("must-not-leak")
      expect(target.requests).toEqual([])
    }),
  )
})

async function modelsServer(
  host = "127.0.0.1",
  redirect?: string,
): Promise<{ server: Server; url: string; requests: string[] }> {
  const requests: string[] = []
  const server = createServer((req, res) => {
    requests.push(String(req.headers.authorization ?? ""), String(req.headers["x-api-key"] ?? ""))
    if (redirect) {
      res.writeHead(302, { location: `${redirect}/api/models` })
      res.end()
      return
    }
    const url = new URL(req.url ?? "/", "http://localhost")
    if (url.pathname !== "/api/models") {
      res.writeHead(404)
      res.end()
      return
    }

    res.writeHead(200, { "content-type": "application/json" })
    res.end(
      JSON.stringify({
        data: [{ id: "glm-5.2-q8:latest", name: "GLM 5.2 Q8" }],
      }),
    )
  })

  return await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, host, () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("missing test server address"))
        return
      }
      resolve({ server, url: `http://${host}:${address.port}`, requests })
    })
  })
}
