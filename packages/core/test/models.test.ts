import { describe, expect, beforeAll, beforeEach, afterAll } from "bun:test"
import { Effect, Layer, Ref } from "effect"
import { HttpClient, HttpClientResponse } from "effect/unstable/http"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { Flag } from "@slopcode-ai/core/flag/flag"
import { Global } from "@slopcode-ai/core/global"
import { ModelsDev } from "@slopcode-ai/core/models-dev"
import { EventV2 } from "@slopcode-ai/core/event"
import { it } from "./lib/effect"
import { readFile, rm, writeFile, utimes, mkdir } from "fs/promises"
import path from "path"

// test/preload.ts pins SLOPCODE_MODELS_PATH to a fixture so other tests can
// resolve providers without network. These tests need to drive the on-disk
// cache themselves and silence the eager refresh fork. Save/restore around
// the suite — never leak the mutation to subsequent test files in the same
// bun process.
const ORIGINAL_MODELS_PATH = Flag.SLOPCODE_MODELS_PATH
const ORIGINAL_DISABLE_FETCH = Flag.SLOPCODE_DISABLE_MODELS_FETCH
beforeAll(() => {
  Flag.SLOPCODE_MODELS_PATH = undefined
  Flag.SLOPCODE_DISABLE_MODELS_FETCH = true
})
afterAll(() => {
  Flag.SLOPCODE_MODELS_PATH = ORIGINAL_MODELS_PATH
  Flag.SLOPCODE_DISABLE_MODELS_FETCH = ORIGINAL_DISABLE_FETCH
})

const cacheFile = path.join(Global.Path.cache, "models.json")

const fixture: Record<string, ModelsDev.Provider> = {
  acme: {
    id: "acme",
    name: "Acme",
    env: ["ACME_API_KEY"],
    models: {
      "acme-1": {
        id: "acme-1",
        name: "Acme One",
        release_date: "2026-01-01",
        attachment: false,
        reasoning: false,
        temperature: true,
        tool_call: true,
        limit: { context: 128000, output: 8192 },
      },
    },
  },
}

const fixture2: Record<string, ModelsDev.Provider> = {
  beta: {
    id: "beta",
    name: "Beta",
    env: ["BETA_API_KEY"],
    models: {
      "beta-1": {
        id: "beta-1",
        name: "Beta One",
        release_date: "2026-02-01",
        attachment: false,
        reasoning: true,
        temperature: false,
        tool_call: false,
        limit: { context: 64000, output: 4096 },
      },
    },
  },
}

const managedModel = (api: string): ModelsDev.Model => ({
  id: "gpt-5.6",
  name: "GPT-5.6",
  release_date: "2026-05-01",
  attachment: true,
  reasoning: true,
  temperature: true,
  tool_call: true,
  limit: { context: 1_050_000, input: 922_000, output: 128_000 },
  modalities: { input: ["text", "image", "pdf"], output: ["text"] },
  provider: { npm: "@ai-sdk/openai", api },
})

const managed = (domain = "slopcode.ai"): Record<string, ModelsDev.Provider> => ({
  slopcode: {
    id: "slopcode",
    name: "SlopCode Zen",
    env: ["SLOPCODE_API_KEY"],
    npm: "@ai-sdk/openai-compatible",
    api: `https://${domain}/zen/v1`,
    models: { "gpt-5.6": managedModel(`https://${domain}/zen/v1`) },
  },
  "slopcode-go": {
    id: "slopcode-go",
    name: "SlopCode Go",
    env: ["SLOPCODE_API_KEY"],
    npm: "@ai-sdk/openai-compatible",
    api: `https://${domain}/zen/go/v1`,
    models: { "gpt-5.6": managedModel(`https://${domain}/zen/go/v1`) },
  },
})

interface MockState {
  body: string
  status: number
  calls: Array<{ url: string; userAgent: string | null }>
}

const makeMockClient = (state: Ref.Ref<MockState>) =>
  HttpClient.make((request) =>
    Effect.gen(function* () {
      yield* Ref.update(state, (s) => ({
        ...s,
        calls: [...s.calls, { url: request.url, userAgent: request.headers["user-agent"] ?? null }],
      }))
      const s = yield* Ref.get(state)
      return HttpClientResponse.fromWeb(request, new Response(s.body, { status: s.status }))
    }),
  )

const buildLayer = (state: Ref.Ref<MockState>) =>
  // Layer.fresh is required: ModelsDev.layer is a module-level Layer constant,
  // and Effect.provide uses a process-global MemoMap by default — without fresh,
  // every test would reuse the cachedInvalidateWithTTL state from the first run.
  Layer.fresh(ModelsDev.layer).pipe(
    Layer.provide(Layer.succeed(HttpClient.HttpClient, makeMockClient(state))),
    Layer.provide(FSUtil.defaultLayer),
    Layer.provide(EventV2.defaultLayer),
  )

const writeCacheText = (text: string, mtimeMs?: number) =>
  Effect.promise(async () => {
    await mkdir(Global.Path.cache, { recursive: true })
    await writeFile(cacheFile, text)
    if (mtimeMs !== undefined) {
      const t = mtimeMs / 1000
      await utimes(cacheFile, t, t)
    }
  })

const writeCache = (data: object, mtimeMs?: number) => writeCacheText(JSON.stringify(data), mtimeMs)

const provided = <A, E>(state: Ref.Ref<MockState>, eff: Effect.Effect<A, E, ModelsDev.Service>) =>
  eff.pipe(Effect.provide(buildLayer(state)))

function expectCatalog(result: Record<string, ModelsDev.Provider>, expected: Record<string, ModelsDev.Provider>) {
  for (const [id, provider] of Object.entries(expected)) expect(result[id]).toEqual(provider)
  expect(result.slopcode?.models["big-pickle"]).toBeDefined()
}

beforeEach(async () => {
  await rm(cacheFile, { force: true })
})

afterAll(async () => {
  await rm(cacheFile, { force: true })
})

const initialState: MockState = {
  body: JSON.stringify(fixture),
  status: 200,
  calls: [],
}

describe("ModelsDev Service", () => {
  it.live("get() returns providers from disk when cache file exists", () =>
    Effect.gen(function* () {
      yield* writeCache(fixture)
      const state = yield* Ref.make(initialState)
      const result = yield* provided(
        state,
        ModelsDev.Service.use((s) => s.get()),
      )
      expectCatalog(result, fixture)
      const final = yield* Ref.get(state)
      expect(final.calls).toEqual([])
    }),
  )

  it.live("get() returns bundled fallback when disk empty and fetch disabled", () =>
    Effect.gen(function* () {
      const state = yield* Ref.make(initialState)
      const result = yield* provided(
        state,
        ModelsDev.Service.use((s) => s.get()),
      )
      expect(result.slopcode?.models["big-pickle"]).toBeDefined()
      expect(result["slopcode-go"]?.models).toBeDefined()
      expect(result.slopcode?.models["gpt-5.6"]?.provider).toEqual({ npm: "@ai-sdk/openai" })
      expect(result["slopcode-go"]?.models["gpt-5.6"]?.provider).toEqual({ npm: "@ai-sdk/openai" })
      expect(result.slopcode?.api).toBe("https://slopcode.dev/zen/v1")
      expect(result["slopcode-go"]?.api).toBe("https://slopcode.dev/zen/go/v1")
      expect(Object.keys(result.openai?.models ?? {}).sort()).toEqual([
        "gpt-5.6",
        "gpt-5.6-luna",
        "gpt-5.6-sol",
        "gpt-5.6-terra",
      ])
      expect(result.openai?.models["gpt-5.6"]?.reasoning_options).toEqual([
        { type: "effort", values: ["none", "low", "medium", "high", "xhigh", "max"] },
      ])
      expect(result.openai?.models["gpt-5.6"]?.modalities?.input).toEqual(["text", "image", "pdf"])
      expect(result.openai?.models["gpt-5.6"]?.cost).toMatchObject({
        tiers: [{ input: 10, output: 45, tier: { type: "context", size: 272_000 } }],
        context_over_200k: { input: 10, output: 45 },
      })
      expect(result.openai?.models["gpt-5.6"]?.experimental?.modes?.fast?.provider).toEqual({
        body: { service_tier: "priority" },
      })
      const final = yield* Ref.get(state)
      expect(final.calls).toEqual([])
    }),
  )

  it.live("supplements a stale OpenAI cache with bundled GPT-5.6 models", () =>
    Effect.gen(function* () {
      yield* writeCache({
        openai: {
          id: "openai",
          name: "OpenAI",
          env: ["OPENAI_API_KEY"],
          npm: "@ai-sdk/openai",
          models: {
            "gpt-5.5": {
              id: "gpt-5.5",
              name: "GPT-5.5",
              release_date: "2026-04-23",
              attachment: true,
              reasoning: true,
              temperature: false,
              tool_call: true,
              limit: { context: 1_050_000, input: 922_000, output: 128_000 },
            },
          },
        },
      })
      const state = yield* Ref.make(initialState)
      const result = yield* provided(
        state,
        ModelsDev.Service.use((service) => service.get()),
      )

      expect(result.openai?.models["gpt-5.5"]).toBeDefined()
      expect(result.openai?.models["gpt-5.6"]).toBeDefined()
      expect((yield* Ref.get(state)).calls).toEqual([])
    }),
  )

  it.live("uses canonical request endpoints for stale cached managed records", () =>
    Effect.gen(function* () {
      yield* writeCache(managed(), Date.now() - 10 * 60 * 1000)
      const state = yield* Ref.make(initialState)
      const result = yield* provided(
        state,
        ModelsDev.Service.use((service) => service.get()),
      )

      expect(result.slopcode?.api).toBe("https://slopcode.dev/zen/v1")
      expect(result["slopcode-go"]?.api).toBe("https://slopcode.dev/zen/go/v1")
      expect(result.slopcode?.models["gpt-5.6"]?.provider?.api).toBe("https://slopcode.dev/zen/v1")
      expect(result["slopcode-go"]?.models["gpt-5.6"]?.provider?.api).toBe(
        "https://slopcode.dev/zen/go/v1",
      )
      expect((yield* Ref.get(state)).calls).toEqual([])
    }),
  )

  it.live("uses canonical request endpoints for fetched managed records", () =>
    Effect.gen(function* () {
      yield* writeCacheText("{")
      const state = yield* Ref.make({ ...initialState, body: JSON.stringify(managed()) })
      const result = yield* Effect.acquireUseRelease(
        Effect.sync(() => {
          Flag.SLOPCODE_DISABLE_MODELS_FETCH = false
        }),
        () =>
          provided(
            state,
            ModelsDev.Service.use((service) => service.get()),
          ),
        () => Effect.sync(() => (Flag.SLOPCODE_DISABLE_MODELS_FETCH = true)),
      )

      expect(result.slopcode?.api).toBe("https://slopcode.dev/zen/v1")
      expect(result["slopcode-go"]?.api).toBe("https://slopcode.dev/zen/go/v1")
      expect(result.slopcode?.models["gpt-5.6"]?.provider?.api).toBe("https://slopcode.dev/zen/v1")
      expect(result["slopcode-go"]?.models["gpt-5.6"]?.provider?.api).toBe(
        "https://slopcode.dev/zen/go/v1",
      )
      expect((yield* Ref.get(state)).calls).toHaveLength(1)
    }),
  )

  it.live("canonicalizes managed endpoints from an explicit models path without merging fallback providers", () =>
    Effect.gen(function* () {
      const file = path.join(Global.Path.cache, "models-explicit.json")
      yield* Effect.promise(() => writeFile(file, JSON.stringify(managed())))
      const state = yield* Ref.make(initialState)
      const result = yield* Effect.acquireUseRelease(
        Effect.sync(() => {
          const previous = Flag.SLOPCODE_MODELS_PATH
          Flag.SLOPCODE_MODELS_PATH = file
          return previous
        }),
        () =>
          provided(
            state,
            ModelsDev.Service.use((service) => service.get()),
          ),
        (previous) =>
          Effect.sync(() => {
            Flag.SLOPCODE_MODELS_PATH = previous
          }),
      )
      yield* Effect.promise(() => rm(file, { force: true }))

      expect(Object.keys(result).sort()).toEqual(["slopcode", "slopcode-go"])
      expect(result.slopcode?.models["gpt-5.6"]?.provider?.api).toBe("https://slopcode.dev/zen/v1")
      expect(result["slopcode-go"]?.models["gpt-5.6"]?.provider?.api).toBe(
        "https://slopcode.dev/zen/go/v1",
      )
    }),
  )

  it.live("get() recovers from a corrupted cache file by fetching a fresh catalog", () =>
    Effect.gen(function* () {
      yield* writeCacheText("{")
      const state = yield* Ref.make({ ...initialState, body: JSON.stringify(fixture2) })
      const result = yield* Effect.acquireUseRelease(
        Effect.sync(() => {
          Flag.SLOPCODE_DISABLE_MODELS_FETCH = false
        }),
        () =>
          provided(
            state,
            ModelsDev.Service.use((s) => s.get()),
          ),
        () =>
          Effect.sync(() => {
            Flag.SLOPCODE_DISABLE_MODELS_FETCH = true
          }),
      )
      expectCatalog(result, fixture2)
      expect(yield* Effect.promise(() => readFile(cacheFile, "utf8"))).toBe(JSON.stringify(fixture2))
      const final = yield* Ref.get(state)
      expect(final.calls.length).toBe(1)
    }),
  )

  it.live("get() is single-flight under concurrent calls", () =>
    Effect.gen(function* () {
      yield* writeCache(fixture)
      const state = yield* Ref.make(initialState)
      const results = yield* provided(
        state,
        Effect.gen(function* () {
          const svc = yield* ModelsDev.Service
          return yield* Effect.all([svc.get(), svc.get(), svc.get(), svc.get(), svc.get()], {
            concurrency: "unbounded",
          })
        }),
      )
      for (const result of results) expectCatalog(result, fixture)
    }),
  )

  it.live("get() caches across calls (later disk writes are ignored until invalidate)", () =>
    Effect.gen(function* () {
      yield* writeCache(fixture)
      const state = yield* Ref.make(initialState)
      const first = yield* provided(
        state,
        Effect.gen(function* () {
          const svc = yield* ModelsDev.Service
          const a = yield* svc.get()
          // mutate disk between calls — cache should mask the change
          yield* writeCache(fixture2)
          const b = yield* svc.get()
          return { a, b }
        }),
      )
      expectCatalog(first.a, fixture)
      expectCatalog(first.b, fixture)
    }),
  )

  it.live("refresh(true) fetches via HttpClient and updates the cache", () =>
    Effect.gen(function* () {
      yield* writeCache(fixture)
      const state = yield* Ref.make({ ...initialState, body: JSON.stringify(fixture2) })
      const result = yield* provided(
        state,
        Effect.gen(function* () {
          const svc = yield* ModelsDev.Service
          const before = yield* svc.get()
          yield* svc.refresh(true)
          const after = yield* svc.get()
          return { before, after }
        }),
      )
      expectCatalog(result.before, fixture)
      expectCatalog(result.after, fixture2)
      const final = yield* Ref.get(state)
      expect(final.calls.length).toBe(1)
      expect(final.calls[0].url).toContain("/api.json")
      expect(final.calls[0].userAgent).toContain("/cli")
    }),
  )

  it.live("refresh(false) skips fetch when on-disk file is fresh", () =>
    Effect.gen(function* () {
      // Fresh: mtime within the 5-minute TTL.
      yield* writeCache(fixture, Date.now() - 1000)
      const state = yield* Ref.make({ ...initialState, body: JSON.stringify(fixture2) })
      yield* provided(
        state,
        ModelsDev.Service.use((s) => s.refresh(false)),
      )
      const final = yield* Ref.get(state)
      expect(final.calls).toEqual([])
    }),
  )

  it.live("refresh(false) fetches when on-disk file is stale", () =>
    Effect.gen(function* () {
      // Stale: mtime 10 minutes ago, beyond the 5-minute TTL.
      yield* writeCache(fixture, Date.now() - 10 * 60 * 1000)
      const state = yield* Ref.make({ ...initialState, body: JSON.stringify(fixture2) })
      const after = yield* provided(
        state,
        Effect.gen(function* () {
          const svc = yield* ModelsDev.Service
          yield* svc.refresh(false)
          return yield* svc.get()
        }),
      )
      const final = yield* Ref.get(state)
      expect(final.calls.length).toBe(1)
      expectCatalog(after, fixture2)
    }),
  )

  it.live("refresh swallows HTTP errors and leaves cache intact", () =>
    Effect.gen(function* () {
      yield* writeCache(fixture)
      const state = yield* Ref.make({ ...initialState, status: 500, body: "boom" })
      const result = yield* provided(
        state,
        Effect.gen(function* () {
          const svc = yield* ModelsDev.Service
          yield* svc.refresh(true)
          return yield* svc.get()
        }),
      )
      expectCatalog(result, fixture)
      // retryTransient retries 5xx, so calls may be > 1.
      const final = yield* Ref.get(state)
      expect(final.calls.length).toBeGreaterThanOrEqual(1)
    }),
  )
})
