import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"
import z from "zod"
import { Installation } from "../installation"
import { Flag } from "../flag/flag"
import { lazy } from "@/util/lazy"
import { Filesystem } from "../util/filesystem"

// Try to import bundled snapshot (generated at build time)
// Falls back to undefined in dev mode when snapshot doesn't exist
/* @ts-ignore */

export namespace ModelsDev {
  const log = Log.create({ service: "models.dev" })
  const defaultURL = "https://models.dev"
  const ttl = 5 * 60 * 1000
  const locks = new Map<string, Promise<void>>()
  let current = ""

  export const Model = z.object({
    id: z.string(),
    name: z.string(),
    family: z.string().optional(),
    release_date: z.string(),
    attachment: z.boolean(),
    reasoning: z.boolean(),
    temperature: z.boolean(),
    tool_call: z.boolean(),
    interleaved: z
      .union([
        z.literal(true),
        z
          .object({
            field: z.enum(["reasoning_content", "reasoning_details"]),
          })
          .strict(),
      ])
      .optional(),
    cost: z
      .object({
        input: z.number(),
        output: z.number(),
        cache_read: z.number().optional(),
        cache_write: z.number().optional(),
        context_over_200k: z
          .object({
            input: z.number(),
            output: z.number(),
            cache_read: z.number().optional(),
            cache_write: z.number().optional(),
          })
          .optional(),
      })
      .optional(),
    limit: z.object({
      context: z.number(),
      input: z.number().optional(),
      output: z.number(),
    }),
    modalities: z
      .object({
        input: z.array(z.enum(["text", "audio", "image", "video", "pdf"])),
        output: z.array(z.enum(["text", "audio", "image", "video", "pdf"])),
      })
      .optional(),
    experimental: z.boolean().optional(),
    status: z.enum(["alpha", "beta", "deprecated"]).optional(),
    options: z.record(z.string(), z.any()),
    headers: z.record(z.string(), z.string()).optional(),
    provider: z.object({ npm: z.string().optional(), api: z.string().optional() }).optional(),
    variants: z.record(z.string(), z.record(z.string(), z.any())).optional(),
  })
  export type Model = z.infer<typeof Model>

  export const Provider = z.object({
    api: z.string().optional(),
    name: z.string(),
    env: z.array(z.string()),
    id: z.string(),
    npm: z.string().optional(),
    models: z.record(z.string(), Model),
  })

  export type Provider = z.infer<typeof Provider>

  export const Meta = z.object({
    fetched_at: z.number().int().nonnegative(),
    url: z.string(),
  })
  export type Meta = z.infer<typeof Meta>

  function url() {
    return Flag.SLOPCODE_MODELS_URL || defaultURL
  }

  function filepath() {
    const source = url()
    const file = source === defaultURL ? "models.json" : `models-${(Bun.hash.xxHash32(source) >>> 0).toString(16)}.json`
    return path.join(Global.Path.cache, file)
  }

  function metapath() {
    return filepath().replace(/\.json$/, ".meta.json")
  }

  function readpath() {
    return Flag.SLOPCODE_MODELS_PATH || filepath()
  }

  function canFetch() {
    if (Flag.SLOPCODE_DISABLE_MODELS_FETCH) return false
    if (Flag.SLOPCODE_MODELS_PATH) return false
    return true
  }

  function age(input = filepath()) {
    const stat = Filesystem.stat(input)
    if (!stat) return
    return Math.max(0, Date.now() - Number(stat.mtimeMs))
  }

  function fresh() {
    const value = age(filepath())
    if (value === undefined) return false
    return value < ttl
  }

  async function readMeta() {
    return Filesystem.readJson(metapath())
      .then((value) => Meta.parse(value))
      .catch(() => undefined)
  }

  async function snapshot() {
    return import("./models-snapshot").then((mod) => mod.snapshot as Record<string, unknown>).catch(() => undefined)
  }

  async function fetchApi() {
    const result = await fetch(`${url()}/api.json`, {
      headers: {
        "User-Agent": Installation.USER_AGENT,
      },
      signal: AbortSignal.timeout(10 * 1000),
    }).catch((error) => {
      log.error("Failed to fetch models.dev", {
        error,
      })
    })
    if (!result) return
    return {
      ok: result.ok,
      text: await result.text(),
    }
  }

  async function withLock<T>(key: string, fn: () => Promise<T>) {
    const current = locks.get(key) ?? Promise.resolve()
    let release = () => {}
    const next = new Promise<void>((resolve) => {
      release = resolve
    })
    const chained = current.then(() => next)
    locks.set(key, chained)
    await current
    try {
      return await fn()
    } finally {
      release()
      if (locks.get(key) === chained) locks.delete(key)
    }
  }

  export function token() {
    const stat = Filesystem.stat(readpath())
    const stamp = stat
      ? `${Number(stat.mtimeMs)}:${typeof stat.size === "bigint" ? Number(stat.size) : stat.size}`
      : "missing"
    return [url(), readpath(), stamp, canFetch() ? "fetch" : "static"].join("|")
  }

  export async function info() {
    const source = Flag.SLOPCODE_MODELS_PATH
      ? "custom_path"
      : Filesystem.stat(filepath())
        ? "cache"
        : (await snapshot())
          ? "snapshot"
          : "remote"
    return {
      age_ms: age(filepath()),
      cache_path: filepath(),
      fetch_enabled: canFetch(),
      fetched_at: (await readMeta())?.fetched_at,
      path: readpath(),
      source,
      stale: !Flag.SLOPCODE_MODELS_PATH && !Flag.SLOPCODE_DISABLE_MODELS_FETCH ? !fresh() : false,
      ttl_ms: ttl,
      url: url(),
    }
  }

  export const Data = lazy(async () => {
    const cached = await Filesystem.readJson(readpath()).catch(() => {})
    if (cached) return cached
    const bundled = await snapshot()
    if (bundled) return bundled
    if (!canFetch()) return {}
    return withLock(filepath(), async () => {
      const existing = await Filesystem.readJson(readpath()).catch(() => {})
      if (existing) return existing
      const result = await fetchApi()
      if (!result?.ok) return {}
      await Filesystem.write(filepath(), result.text)
      await Filesystem.writeJson(metapath(), {
        fetched_at: Date.now(),
        url: url(),
      })
      return JSON.parse(result.text)
    })
  })

  export async function get() {
    const next = token()
    if (current && current !== next) Data.reset()
    current = next
    const result = await Data()
    current = token()
    return result as Record<string, Provider>
  }

  export async function refresh(force = false) {
    if (!canFetch()) {
      Data.reset()
      current = token()
      return { reason: Flag.SLOPCODE_MODELS_PATH ? "custom_path" : "disabled", refreshed: false } as const
    }
    if (!force && fresh()) {
      Data.reset()
      current = token()
      return { reason: "fresh", refreshed: false } as const
    }
    const result = await withLock(filepath(), async () => {
      if (!force && fresh()) {
        Data.reset()
        current = token()
        return { reason: "fresh", refreshed: false } as const
      }
      const value = await fetchApi()
      if (!value?.ok) return { reason: "failed", refreshed: false } as const
      await Filesystem.write(filepath(), value.text)
      await Filesystem.writeJson(metapath(), {
        fetched_at: Date.now(),
        url: url(),
      })
      Data.reset()
      current = token()
      return { reason: "updated", refreshed: true } as const
    }).catch((error) => {
      log.error("Failed to refresh models.dev", {
        error,
      })
      return { reason: "failed", refreshed: false } as const
    })
    return result
  }
}

if (
  !Flag.SLOPCODE_DISABLE_MODELS_FETCH &&
  !process.argv.includes("--get-yargs-completions") &&
  !Flag.SLOPCODE_MODELS_PATH
) {
  void ModelsDev.refresh()
  setInterval(
    async () => {
      await ModelsDev.refresh()
    },
    60 * 1000 * 60,
  ).unref()
}
