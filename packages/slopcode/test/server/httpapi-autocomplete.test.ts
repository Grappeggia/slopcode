import { afterEach, describe, expect } from "bun:test"
import type { LanguageModelV3, LanguageModelV3CallOptions } from "@ai-sdk/provider"
import { CrossSpawnSpawner } from "@slopcode-ai/core/cross-spawn-spawner"
import { Database } from "@slopcode-ai/core/database/database"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { createSlopcodeClient } from "@slopcode-ai/sdk/v2"
import { Effect, Layer } from "effect"
import { HttpServer } from "effect/unstable/http"
import { InstanceBootstrap } from "../../src/project/bootstrap-service"
import { InstanceStore } from "../../src/project/instance-store"
import { createRoutes } from "../../src/server/routes/instance/httpapi/server"
import { disposeAllInstances, tmpdirScoped } from "../fixture/fixture"
import { resetDatabase } from "../fixture/db"
import { testEffect } from "../lib/effect"
import { TestLLMServer } from "../lib/llm-server"
import { testProviderConfig } from "../lib/test-provider"
import { ProviderTest } from "../fake/provider"
import { httpApiLayer, makeHttpApiLayer } from "./httpapi-layer"

const noop = Layer.succeed(InstanceBootstrap.Service, InstanceBootstrap.Service.of({ run: Effect.void }))
const dependencies = (http: typeof httpApiLayer) =>
  Layer.mergeAll(
    FSUtil.defaultLayer,
    CrossSpawnSpawner.defaultLayer,
    InstanceStore.defaultLayer.pipe(Layer.provide(noop)),
    Database.defaultLayer,
    http,
  )
const it = testEffect(dependencies(httpApiLayer))
let aborts = 0
let done = () => {}
let aborted = Promise.resolve()
const model = ProviderTest.model({
  id: ModelV2.ID.make("test-model"),
  providerID: ProviderV2.ID.make("test"),
})
const language = {
  specificationVersion: "v3",
  provider: "test",
  modelId: "test-model",
  supportedUrls: {},
  doGenerate() {
    throw new Error("unexpected generate")
  },
  doStream(options: LanguageModelV3CallOptions) {
    return new Promise<never>((_, reject) => {
      options.abortSignal?.addEventListener(
        "abort",
        () => {
          aborts += 1
          done()
          reject(options.abortSignal?.reason)
        },
        { once: true },
      )
    })
  },
} satisfies LanguageModelV3
const provider = ProviderTest.fake({ model, getLanguage: () => Effect.succeed(language) })
const abortIt = testEffect(
  dependencies(
    makeHttpApiLayer(createRoutes(undefined, undefined, undefined, undefined, { provider: provider.layer })),
  ),
)

function client(directory: string) {
  return HttpServer.HttpServer.use((server) =>
    Effect.sync(() => {
      const baseUrl = HttpServer.formatAddress(server.address)
      return createSlopcodeClient({ baseUrl, directory })
    }),
  )
}

afterEach(async () => {
  delete process.env.SLOPCODE_DISABLE_AUTOCOMPLETE
  await disposeAllInstances()
  await resetDatabase()
})

describe("session autocomplete HttpApi", () => {
  it.live("is disabled by default and exposed by the generated SDK", () =>
    Effect.gen(function* () {
      const directory = yield* tmpdirScoped({ git: true, config: testProviderConfig("http://127.0.0.1:1/v1") })
      const sdk = yield* client(directory)
      const session = yield* Effect.promise(() => sdk.session.create({ title: "autocomplete" }))
      const response = yield* Effect.promise(() =>
        sdk.session.autocomplete({
          sessionID: session.data!.id,
          model: { providerID: "test", modelID: "test-model" },
          prefix: "a sufficiently long prefix",
        }),
      )

      expect(response.response.status).toBe(200)
      expect(response.data).toEqual({ completion: "", model: "test/test-model" })
    }),
  )

  it.live(
    "sends only fixed instructions and the prefix without persisting endpoint activity",
    Effect.gen(function* () {
      const llm = yield* TestLLMServer
      yield* llm.text("Write focused tests\nand explain them")
      const directory = yield* tmpdirScoped({
        git: true,
        config: {
          ...testProviderConfig(llm.url),
          autocomplete: { enabled: true, min_prefix_chars: 1 },
          instructions: ["PRIVATE_PROJECT_INSTRUCTIONS"],
        },
      })
      const sdk = yield* client(directory)
      const session = yield* Effect.promise(() => sdk.session.create({ title: "autocomplete" }))
      yield* Effect.promise(() =>
        sdk.session.prompt({
          sessionID: session.data!.id,
          model: { providerID: "test", modelID: "test-model" },
          agent: "build",
          noReply: true,
          parts: [{ type: "text", text: "PRIVATE_TRANSCRIPT" }],
        }),
      )
      const before = yield* Effect.promise(() => sdk.session.messages({ sessionID: session.data!.id }))

      const response = yield* Effect.promise(() =>
        sdk.session.autocomplete({
          sessionID: session.data!.id,
          model: { providerID: "test", modelID: "test-model" },
          prefix: "write focused ",
        }),
      )
      const after = yield* Effect.promise(() => sdk.session.messages({ sessionID: session.data!.id }))
      const inputs = yield* llm.inputs
      const sent = JSON.stringify(inputs[0])

      expect(response.data).toEqual({ completion: "tests", model: "test/test-model" })
      expect(after.data).toEqual(before.data)
      expect(inputs[0]?.messages).toEqual([
        { role: "system", content: expect.any(String) },
        { role: "user", content: "write focused " },
      ])
      expect(inputs[0]).not.toHaveProperty("tools")
      expect(sent).not.toContain("PRIVATE_TRANSCRIPT")
      expect(sent).not.toContain("PRIVATE_PROJECT_INSTRUCTIONS")
      expect(sent).not.toContain(session.data!.id)
    }).pipe(Effect.provide(TestLLMServer.layer)),
    15_000,
  )

  it.live("honors the server kill switch", () =>
    Effect.gen(function* () {
      const llm = yield* TestLLMServer
      const directory = yield* tmpdirScoped({
        git: true,
        config: { ...testProviderConfig(llm.url), autocomplete: { enabled: true } },
      })
      const sdk = yield* client(directory)
      const session = yield* Effect.promise(() => sdk.session.create({ title: "autocomplete" }))
      process.env.SLOPCODE_DISABLE_AUTOCOMPLETE = "1"

      const response = yield* Effect.promise(() =>
        sdk.session.autocomplete({
          sessionID: session.data!.id,
          model: { providerID: "test", modelID: "test-model" },
          prefix: "a sufficiently long prefix",
        }),
      )

      expect(response.data?.completion).toBe("")
      expect(yield* llm.calls).toBe(0)
    }).pipe(Effect.provide(TestLLMServer.layer)),
  )

  abortIt.live(
    "propagates generated SDK aborts through the endpoint to provider generation",
    Effect.gen(function* () {
      aborts = 0
      aborted = new Promise<void>((resolve) => {
        done = resolve
      })
      const directory = yield* tmpdirScoped({
        git: true,
        config: {
          ...testProviderConfig("http://127.0.0.1:1/v1"),
          autocomplete: { enabled: true, min_prefix_chars: 1, timeout_ms: 10_000 },
        },
      })
      const sdk = yield* client(directory)
      const session = yield* Effect.promise(() => sdk.session.create({ title: "autocomplete abort" }))
      const ctrl = new AbortController()
      const request = sdk.session.autocomplete(
        {
          sessionID: session.data!.id,
          model: { providerID: "test", modelID: "test-model" },
          prefix: "abort this completion",
        },
        { signal: ctrl.signal, throwOnError: true },
      )

      yield* Effect.sleep("50 millis")
      const start = Date.now()
      ctrl.abort()
      expect(
        yield* Effect.promise(() =>
          request.then(
            () => false,
            () => true,
          ),
        ),
      ).toBe(true)
      yield* Effect.promise(() => aborted)
      expect(aborts).toBe(1)
      expect(Date.now() - start).toBeLessThan(2_000)
    }),
    15_000,
  )
})
