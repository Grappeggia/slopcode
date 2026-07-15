import { afterEach, describe, expect } from "bun:test"
import type { LanguageModelV3, LanguageModelV3CallOptions } from "@ai-sdk/provider"
import { CrossSpawnSpawner } from "@slopcode-ai/core/cross-spawn-spawner"
import { Database } from "@slopcode-ai/core/database/database"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { createSlopcodeClient } from "@slopcode-ai/sdk/v2"
import { createClient as createGeneratedClient } from "@slopcode-ai/sdk/v2/gen/client"
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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

type Generation = { signal: AbortSignal; aborted: Promise<void> }
const generations = (() => {
  const calls: Generation[] = []
  const waiting = new Map<number, (call: Generation) => void>()
  return {
    add(signal: AbortSignal) {
      const stopped = deferred<void>()
      const pending = deferred<never>()
      const call = { signal, aborted: stopped.promise }
      const abort = () => {
        stopped.resolve()
        pending.reject(signal.reason)
      }
      if (signal.aborted) abort()
      else signal.addEventListener("abort", abort, { once: true })
      calls.push(call)
      waiting.get(calls.length - 1)?.(call)
      waiting.delete(calls.length - 1)
      return pending.promise
    },
    wait(index: number) {
      const call = calls[index]
      if (call) return Promise.resolve(call)
      return new Promise<Generation>((resolve) => waiting.set(index, resolve))
    },
    count() {
      return calls.length
    },
    reset() {
      calls.splice(0)
      waiting.clear()
    },
  }
})()
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
    if (!options.abortSignal) throw new Error("missing generation abort signal")
    return generations.add(options.abortSignal)
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
    "cancels an active generation through the direct endpoint",
    Effect.gen(function* () {
      generations.reset()
      const directory = yield* tmpdirScoped({
        git: true,
        config: {
          ...testProviderConfig("http://127.0.0.1:1/v1"),
          autocomplete: { enabled: true, min_prefix_chars: 1, timeout_ms: 10_000 },
        },
      })
      const sdk = yield* client(directory)
      const session = yield* Effect.promise(() => sdk.session.create({ title: "autocomplete abort" }))
      const request = sdk.session.autocomplete({
        sessionID: session.data!.id,
        requestID: "active",
        model: { providerID: "test", modelID: "test-model" },
        prefix: "abort this completion",
      })

      const call = yield* Effect.promise(() => generations.wait(0))
      const canceled = yield* Effect.promise(() =>
        sdk.session.abortAutocomplete({ sessionID: session.data!.id, requestID: "active" }),
      )
      expect(canceled.data).toBe(true)
      yield* Effect.promise(() => call.aborted)
      expect((yield* Effect.promise(() => request)).data?.completion).toBe("")
    }),
    15_000,
  )

  abortIt.live(
    "consumes a scoped pre-cancel before generation starts",
    Effect.gen(function* () {
      generations.reset()
      const directory = yield* tmpdirScoped({
        git: true,
        config: {
          ...testProviderConfig("http://127.0.0.1:1/v1"),
          autocomplete: { enabled: true, min_prefix_chars: 1, timeout_ms: 10_000 },
        },
      })
      const sdk = yield* client(directory)
      const session = yield* Effect.promise(() => sdk.session.create({ title: "autocomplete pre-cancel" }))

      const canceled = yield* Effect.promise(() =>
        sdk.session.abortAutocomplete({ sessionID: session.data!.id, requestID: "early" }),
      )
      const response = yield* Effect.promise(() =>
        sdk.session.autocomplete({
          sessionID: session.data!.id,
          requestID: "early",
          model: { providerID: "test", modelID: "test-model" },
          prefix: "pre-cancel this completion",
        }),
      )
      expect(canceled.data).toBe(false)
      expect(response.data?.completion).toBe("")
      expect(generations.count()).toBe(0)
    }),
    15_000,
  )

  abortIt.live(
    "isolates active and pre-canceled IDs across sessions",
    Effect.gen(function* () {
      generations.reset()
      const directory = yield* tmpdirScoped({
        git: true,
        config: {
          ...testProviderConfig("http://127.0.0.1:1/v1"),
          autocomplete: { enabled: true, min_prefix_chars: 1, timeout_ms: 10_000 },
        },
      })
      const sdk = yield* client(directory)
      const first = yield* Effect.promise(() => sdk.session.create({ title: "autocomplete first" }))
      const second = yield* Effect.promise(() => sdk.session.create({ title: "autocomplete second" }))
      const request = sdk.session.autocomplete({
        sessionID: first.data!.id,
        requestID: "shared",
        model: { providerID: "test", modelID: "test-model" },
        prefix: "first session completion",
      })
      const call = yield* Effect.promise(() => generations.wait(0))

      const other = yield* Effect.promise(() =>
        sdk.session.abortAutocomplete({ sessionID: second.data!.id, requestID: "shared" }),
      )
      expect(other.data).toBe(false)
      expect(call.signal.aborted).toBe(false)
      const canceled = yield* Effect.promise(() =>
        sdk.session.abortAutocomplete({ sessionID: first.data!.id, requestID: "shared" }),
      )
      expect(canceled.data).toBe(true)
      yield* Effect.promise(() => call.aborted)
      yield* Effect.promise(() => request)

      const preCanceled = yield* Effect.promise(() =>
        sdk.session.autocomplete({
          sessionID: second.data!.id,
          requestID: "shared",
          model: { providerID: "test", modelID: "test-model" },
          prefix: "second session completion",
        }),
      )
      expect(preCanceled.data?.completion).toBe("")
      expect(generations.count()).toBe(1)
    }),
    15_000,
  )

  abortIt.live(
    "does not let a late abort poison a reused ID",
    Effect.gen(function* () {
      generations.reset()
      const directory = yield* tmpdirScoped({
        git: true,
        config: {
          ...testProviderConfig("http://127.0.0.1:1/v1"),
          autocomplete: { enabled: true, min_prefix_chars: 1, timeout_ms: 10_000 },
        },
      })
      const sdk = yield* client(directory)
      const session = yield* Effect.promise(() => sdk.session.create({ title: "autocomplete reuse" }))
      const first = sdk.session.autocomplete({
        sessionID: session.data!.id,
        requestID: "reused",
        model: { providerID: "test", modelID: "test-model" },
        prefix: "first reused completion",
      })
      const initial = yield* Effect.promise(() => generations.wait(0))
      yield* Effect.promise(() => sdk.session.abortAutocomplete({ sessionID: session.data!.id, requestID: "reused" }))
      yield* Effect.promise(() => initial.aborted)
      yield* Effect.promise(() => first)

      const late = yield* Effect.promise(() =>
        sdk.session.abortAutocomplete({ sessionID: session.data!.id, requestID: "reused" }),
      )
      expect(late.data).toBe(false)
      const second = sdk.session.autocomplete({
        sessionID: session.data!.id,
        requestID: "reused",
        model: { providerID: "test", modelID: "test-model" },
        prefix: "second reused completion",
      })
      const current = yield* Effect.promise(() => generations.wait(1))
      expect(current.signal.aborted).toBe(false)
      yield* Effect.promise(() => sdk.session.abortAutocomplete({ sessionID: session.data!.id, requestID: "reused" }))
      yield* Effect.promise(() => current.aborted)
      yield* Effect.promise(() => second)
    }),
    15_000,
  )

  abortIt.live(
    "cleans active cancellation state after completion",
    Effect.gen(function* () {
      generations.reset()
      const directory = yield* tmpdirScoped({
        git: true,
        config: {
          ...testProviderConfig("http://127.0.0.1:1/v1"),
          autocomplete: { enabled: true, min_prefix_chars: 1, timeout_ms: 10_000 },
        },
      })
      const sdk = yield* client(directory)
      const session = yield* Effect.promise(() => sdk.session.create({ title: "autocomplete cleanup" }))
      const request = sdk.session.autocomplete({
        sessionID: session.data!.id,
        requestID: "cleanup",
        model: { providerID: "test", modelID: "test-model" },
        prefix: "cleanup this completion",
      })
      const call = yield* Effect.promise(() => generations.wait(0))
      const active = yield* Effect.promise(() =>
        sdk.session.abortAutocomplete({ sessionID: session.data!.id, requestID: "cleanup" }),
      )
      expect(active.data).toBe(true)
      yield* Effect.promise(() => call.aborted)
      yield* Effect.promise(() => request)
      const cleaned = yield* Effect.promise(() =>
        sdk.session.abortAutocomplete({ sessionID: session.data!.id, requestID: "cleanup" }),
      )
      expect(cleaned.data).toBe(false)
    }),
    15_000,
  )

  abortIt.live(
    "preserves custom client options and bounds the SDK cancel request",
    Effect.gen(function* () {
      generations.reset()
      const directory = yield* tmpdirScoped({
        git: true,
        config: {
          ...testProviderConfig("http://127.0.0.1:1/v1"),
          autocomplete: { enabled: true, min_prefix_chars: 1, timeout_ms: 10_000 },
        },
      })
      const baseUrl = yield* HttpServer.HttpServer.use((server) =>
        Effect.succeed(HttpServer.formatAddress(server.address)),
      )
      const bootstrap = createSlopcodeClient({ baseUrl, directory })
      const session = yield* Effect.promise(() => bootstrap.session.create({ title: "autocomplete client" }))
      const requests: Request[] = []
      const timedOut = deferred<void>()
      const fetcher = Object.assign(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = input instanceof Request ? input : new Request(input, init)
          requests.push(request.clone())
          if (request.method === "DELETE") {
            if (request.signal.aborted) timedOut.resolve()
            else request.signal.addEventListener("abort", () => timedOut.resolve(), { once: true })
          }
          return fetch(request)
        },
        { preconnect: fetch.preconnect },
      ) satisfies typeof fetch
      const custom = createGeneratedClient({
        baseUrl,
        fetch: fetcher,
        headers: { authorization: "Bearer custom-auth", "x-client-header": "client" },
      })
      const sdk = createSlopcodeClient({ baseUrl: "http://127.0.0.1:1" })
      const ctrl = new AbortController()
      const request = sdk.session.autocomplete(
        {
          sessionID: session.data!.id,
          directory,
          requestID: "custom-client",
          model: { providerID: "test", modelID: "test-model" },
          prefix: "custom client completion",
        },
        {
          client: custom,
          signal: ctrl.signal,
          throwOnError: true,
          headers: { "x-request-header": "request" },
        },
      )
      const call = yield* Effect.promise(() => generations.wait(0))
      ctrl.abort()
      expect(
        yield* Effect.promise(() =>
          request.then(
            () => false,
            () => true,
          ),
        ),
      ).toBe(true)
      yield* Effect.promise(() => call.aborted)

      const canceled = requests.find((item) => item.method === "DELETE")
      expect(canceled).toBeDefined()
      expect(new URL(canceled!.url).origin).toBe(new URL(baseUrl).origin)
      expect(canceled!.headers.get("authorization")).toBe("Bearer custom-auth")
      expect(canceled!.headers.get("x-client-header")).toBe("client")
      expect(canceled!.headers.get("x-request-header")).toBe("request")
      yield* Effect.promise(() => timedOut.promise)
      expect(canceled!.signal.aborted).toBe(true)
    }),
    15_000,
  )
})
