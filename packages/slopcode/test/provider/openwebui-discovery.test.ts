import { afterEach, expect } from "bun:test"
import { createServer, type Server } from "node:http"
import { Effect, Layer } from "effect"
import { CrossSpawnSpawner } from "@slopcode-ai/core/cross-spawn-spawner"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { disposeAllInstances, provideTmpdirInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { Env } from "@/env"
import { Plugin } from "@/plugin"
import { Provider } from "@/provider/provider"

afterEach(async () => {
  await disposeAllInstances()
})

const it = testEffect(
  Layer.mergeAll(Provider.defaultLayer, Env.defaultLayer, Plugin.defaultLayer, CrossSpawnSpawner.defaultLayer),
)

it.live("discovers OpenWebUI models from a configured local endpoint", () =>
  Effect.gen(function* () {
    const server = yield* Effect.acquireRelease(
      Effect.promise(() => modelsServer()),
      (server) => Effect.sync(() => server.server.close()),
    )

    yield* provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const providers = yield* Provider.use.list()
          const provider = providers[ProviderV2.ID.make("openwebui")]

          expect(provider).toBeDefined()
          expect(provider.options.baseURL).toBe(`${server.url}/api`)
          expect(provider.models["qwen2.5-coder:7b"]).toMatchObject({
            name: "Qwen2.5 Coder 7B",
            api: {
              id: "qwen2.5-coder:7b",
              npm: "@ai-sdk/openai-compatible",
              url: `${server.url}/api`,
            },
            capabilities: {
              toolcall: true,
            },
          })
          expect(provider.models["llama3.2:latest"]).toBeDefined()
          expect(provider.models["manual-model"].name).toBe("Manual Model")
          expect(provider.models["manual-model"].limit.context).toBe(4096)
          expect(provider.models["manual-model"].capabilities.toolcall).toBe(false)
          expect(server.requests).toContain("Bearer test-key")
        }),
      {
        config: {
          provider: {
            openwebui: {
              name: "OpenWebUI",
              env: [],
              options: {
                apiKey: "test-key",
                baseURL: server.url,
              },
              models: {
                "manual-model": {
                  name: "Manual Model",
                  tool_call: false,
                  limit: { context: 4096, output: 1024 },
                },
              },
            },
          },
        },
      },
    )
  }),
)

it.live("keeps OpenWebUI provider when all models are discovered", () =>
  Effect.gen(function* () {
    const server = yield* Effect.acquireRelease(
      Effect.promise(() => modelsServer()),
      (server) => Effect.sync(() => server.server.close()),
    )

    yield* provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const providers = yield* Provider.use.list()
          const provider = providers[ProviderV2.ID.make("openwebui")]

          expect(provider).toBeDefined()
          expect(Object.keys(provider.models).sort()).toEqual(["llama3.2:latest", "manual-model", "qwen2.5-coder:7b"])
        }),
      {
        config: {
          provider: {
            openwebui: {
              name: "OpenWebUI",
              env: [],
              options: {
                apiKey: "test-key",
                baseURL: `${server.url}/api`,
              },
            },
          },
        },
      },
    )
  }),
)

it.live("does not discover models or forward credentials to non-loopback endpoints", () =>
  Effect.gen(function* () {
    const server = yield* Effect.acquireRelease(
      Effect.promise(() => modelsServer("0.0.0.0")),
      (server) => Effect.sync(() => server.server.close()),
    )

    yield* provideTmpdirInstance(() => Provider.use.list(), {
      config: {
        provider: {
          openwebui: {
            env: [],
            options: {
              apiKey: "must-not-leak",
              baseURL: server.url,
            },
            models: {
              manual: { name: "Manual" },
            },
          },
        },
      },
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

    yield* provideTmpdirInstance(() => Provider.use.list(), {
      config: {
        provider: {
          openwebui: {
            env: [],
            options: {
              apiKey: "must-not-leak",
              baseURL: redirect.url,
              headers: { "x-api-key": "must-not-leak" },
            },
            models: { manual: { name: "Manual" } },
          },
        },
      },
    })

    expect(redirect.requests).toContain("must-not-leak")
    expect(target.requests).toEqual([])
  }),
)

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
        data: [
          { id: "manual-model", name: "Remote Manual" },
          { id: "qwen2.5-coder:7b", name: "Qwen2.5 Coder 7B" },
          { id: "llama3.2:latest" },
        ],
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
