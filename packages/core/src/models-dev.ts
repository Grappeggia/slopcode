import path from "path"
import { Context, Duration, Effect, Layer, Option, Schedule, Schema } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http"
import { Global } from "./global"
import { Flag } from "./flag/flag"
import { Flock } from "./util/flock"
import { Hash } from "./util/hash"
import { FSUtil } from "./fs-util"
import { InstallationChannel, InstallationVersion } from "./installation/version"
import { EventV2 } from "./event"
import { LayerNode } from "./effect/layer-node"
import { httpClient } from "./effect/layer-node-platform"
import { fallback as bundledFallback } from "./models-dev-fallback"

export const CatalogModelStatus = Schema.Literals(["alpha", "beta", "deprecated"])
export type CatalogModelStatus = typeof CatalogModelStatus.Type

const USER_AGENT = `slopcode/${InstallationChannel}/${InstallationVersion}/${Flag.SLOPCODE_CLIENT}`

const CostTier = Schema.Struct({
  input: Schema.Finite,
  output: Schema.Finite,
  cache_read: Schema.optional(Schema.Finite),
  cache_write: Schema.optional(Schema.Finite),
  tier: Schema.Struct({
    type: Schema.Literal("context"),
    size: Schema.Finite,
  }),
})

const Cost = Schema.Struct({
  input: Schema.Finite,
  output: Schema.Finite,
  cache_read: Schema.optional(Schema.Finite),
  cache_write: Schema.optional(Schema.Finite),
  tiers: Schema.optional(Schema.Array(CostTier)),
  context_over_200k: Schema.optional(
    Schema.Struct({
      input: Schema.Finite,
      output: Schema.Finite,
      cache_read: Schema.optional(Schema.Finite),
      cache_write: Schema.optional(Schema.Finite),
    }),
  ),
})

export const Model = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  family: Schema.optional(Schema.String),
  release_date: Schema.String,
  attachment: Schema.Boolean,
  reasoning: Schema.Boolean,
  reasoning_options: Schema.optional(
    Schema.Array(
      Schema.Union([
        Schema.Struct({
          type: Schema.Literal("effort"),
          values: Schema.Array(Schema.NullOr(Schema.String)),
        }),
        Schema.Struct({
          type: Schema.Literal("budget_tokens"),
          min: Schema.optional(Schema.Finite),
          max: Schema.optional(Schema.Finite),
        }),
        Schema.Struct({
          type: Schema.Literal("toggle"),
        }),
      ]),
    ),
  ),
  temperature: Schema.Boolean,
  tool_call: Schema.Boolean,
  interleaved: Schema.optional(
    Schema.Union([
      Schema.Literal(true),
      Schema.Struct({
        field: Schema.Literals(["reasoning", "reasoning_content", "reasoning_details"]),
      }),
    ]),
  ),
  cost: Schema.optional(Cost),
  limit: Schema.Struct({
    context: Schema.Finite,
    input: Schema.optional(Schema.Finite),
    output: Schema.Finite,
  }),
  modalities: Schema.optional(
    Schema.Struct({
      input: Schema.Array(Schema.Literals(["text", "audio", "image", "video", "pdf"])),
      output: Schema.Array(Schema.Literals(["text", "audio", "image", "video", "pdf"])),
    }),
  ),
  experimental: Schema.optional(
    Schema.Struct({
      modes: Schema.optional(
        Schema.Record(
          Schema.String,
          Schema.Struct({
            cost: Schema.optional(Cost),
            provider: Schema.optional(
              Schema.Struct({
                body: Schema.optional(Schema.Record(Schema.String, Schema.MutableJson)),
                headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
              }),
            ),
          }),
        ),
      ),
    }),
  ),
  status: Schema.optional(CatalogModelStatus),
  provider: Schema.optional(
    Schema.Struct({ npm: Schema.optional(Schema.String), api: Schema.optional(Schema.String) }),
  ),
})
export type Model = Schema.Schema.Type<typeof Model>

export const Provider = Schema.Struct({
  api: Schema.optional(Schema.String),
  name: Schema.String,
  env: Schema.Array(Schema.String),
  id: Schema.String,
  npm: Schema.optional(Schema.String),
  models: Schema.Record(Schema.String, Model),
})

export type Provider = Schema.Schema.Type<typeof Provider>

export const Event = {
  Refreshed: EventV2.define({
    type: "models-dev.refreshed",
    schema: {},
  }),
}

declare const SLOPCODE_MODELS_DEV: Record<string, Provider> | undefined

export interface Interface {
  readonly get: () => Effect.Effect<Record<string, Provider>>
  readonly refresh: (force?: boolean) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/ModelsDev") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const events = yield* EventV2.Service
    const http = HttpClient.filterStatusOk(
      (yield* HttpClient.HttpClient).pipe(
        HttpClient.retryTransient({
          retryOn: "errors-and-responses",
          times: 2,
          schedule: Schedule.exponential(200).pipe(Schedule.jittered),
        }),
      ),
    )

    const source = Flag.SLOPCODE_MODELS_URL || "https://models.dev"
    const filepath = path.join(
      Global.Path.cache,
      source === "https://models.dev" ? "models.json" : `models-${Hash.fast(source)}.json`,
    )
    const ttl = Duration.minutes(5)
    const lockKey = `models-dev:${filepath}`

    const fresh = Effect.fnUntraced(function* () {
      const stat = yield* fs.stat(filepath).pipe(Effect.catch(() => Effect.succeed(undefined)))
      if (!stat) return false
      const mtime = Option.getOrElse(stat.mtime, () => new Date(0)).getTime()
      return Date.now() - mtime < Duration.toMillis(ttl)
    })

    const fetchApi = Effect.fn("ModelsDev.fetchApi")(function* () {
      return yield* HttpClientRequest.get(`${source}/api.json`).pipe(
        HttpClientRequest.setHeader("User-Agent", USER_AGENT),
        http.execute,
        Effect.flatMap((res) => res.text),
        Effect.timeout("10 seconds"),
      )
    })

    const loadFromDisk = Effect.gen(function* () {
      const file = Flag.SLOPCODE_MODELS_PATH ?? filepath
      const exists = yield* fs.stat(file).pipe(
        Effect.as(true),
        Effect.catch(() => Effect.succeed(false)),
      )
      if (!exists) return { data: undefined, exists }
      const data = yield* fs.readJson(file).pipe(
        Effect.catch((error) => {
          if (
            Flag.SLOPCODE_MODELS_PATH === undefined &&
            error._tag === "FileSystemError" &&
            error.method === "readJson"
          ) {
            return fs.remove(filepath, { force: true }).pipe(Effect.ignore, Effect.as(undefined))
          }
          return Effect.succeed(undefined)
        }),
        Effect.map((v) => v as Record<string, Provider> | undefined),
      )
      return { data, exists }
    })

    const loadSnapshot = Effect.sync(() =>
      typeof SLOPCODE_MODELS_DEV === "undefined" ? undefined : SLOPCODE_MODELS_DEV,
    )

    const fallback = bundledFallback as Record<string, Provider>
    const mergeFallback = (data?: Record<string, Provider>) => {
      if (Flag.SLOPCODE_MODELS_PATH !== undefined && !data) return data
      if (Object.keys(fallback).length === 0) return data
      const result = Flag.SLOPCODE_MODELS_PATH === undefined ? { ...fallback, ...(data ?? {}) } : { ...data }
      if (Flag.SLOPCODE_MODELS_PATH === undefined && data?.openai && fallback.openai) {
        result.openai = {
          ...fallback.openai,
          ...data.openai,
          models: {
            ...fallback.openai.models,
            ...data.openai.models,
          },
        }
      }
      for (const id of ["slopcode", "slopcode-go"]) {
        const provider = result[id]
        const api = fallback[id]?.api
        if (!provider || !api) continue
        result[id] = {
          ...provider,
          api,
          models: Object.fromEntries(
            Object.entries(provider.models).map(([id, model]) => [
              id,
              model.provider?.api !== undefined ? { ...model, provider: { ...model.provider, api } } : model,
            ]),
          ),
        }
      }
      return result
    }

    const fetchAndWrite = Effect.fn("ModelsDev.fetchAndWrite")(function* () {
      const text = yield* fetchApi()
      const tempfile = `${filepath}.${process.pid}.${Date.now()}.tmp`
      yield* fs.writeWithDirs(tempfile, text).pipe(
        Effect.andThen(fs.rename(tempfile, filepath)),
        Effect.catch((error) =>
          Effect.gen(function* () {
            yield* fs.remove(tempfile, { force: true }).pipe(Effect.ignore)
            return yield* Effect.fail(error)
          }),
        ),
      )
      return text
    })

    const populate = Effect.gen(function* () {
      const fromDisk = yield* loadFromDisk
      if (fromDisk.data) return mergeFallback(fromDisk.data)!
      const snapshot = mergeFallback(yield* loadSnapshot)
      if (snapshot && (!fromDisk.exists || Flag.SLOPCODE_DISABLE_MODELS_FETCH)) return snapshot
      if (!fromDisk.exists) {
        const fallbackOnly = mergeFallback()
        if (fallbackOnly) return fallbackOnly
      }
      if (Flag.SLOPCODE_DISABLE_MODELS_FETCH) return mergeFallback() ?? {}
      // Flock is cross-process: concurrent slopcode CLIs can race on this cache file.
      const text = yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Flock.effect(lockKey)
          return yield* fetchAndWrite()
        }),
      )
      return mergeFallback(JSON.parse(text) as Record<string, Provider>) ?? {}
    }).pipe(Effect.withSpan("ModelsDev.populate"), Effect.orDie)

    const [cachedGet, invalidate] = yield* Effect.cachedInvalidateWithTTL(populate, Duration.infinity)

    const get = (): Effect.Effect<Record<string, Provider>> => cachedGet

    const refresh = Effect.fn("ModelsDev.refresh")(function* (force = false) {
      if (!force && (yield* fresh())) return
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Flock.effect(lockKey)
          // Re-check under the lock: another process may have refreshed between
          // our outer check and lock acquisition.
          if (!force && (yield* fresh())) return
          yield* fetchAndWrite()
          yield* invalidate
          yield* events.publish(Event.Refreshed, {})
        }),
      ).pipe(
        Effect.tapCause((cause) => Effect.logError("Failed to fetch models.dev", { cause: cause })),
        Effect.ignore,
      )
    })

    if (!Flag.SLOPCODE_DISABLE_MODELS_FETCH && !process.argv.includes("--get-yargs-completions")) {
      // Schedule.spaced runs the effect once, then waits between completions.
      yield* Effect.forkScoped(refresh().pipe(Effect.repeat(Schedule.spaced("60 minutes")), Effect.ignore))
    }

    return Service.of({ get, refresh })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(EventV2.defaultLayer),
)
export const node = LayerNode.make(layer, [FSUtil.node, EventV2.node, httpClient])

export * as ModelsDev from "./models-dev"
