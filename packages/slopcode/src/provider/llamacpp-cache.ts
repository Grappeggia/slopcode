import { rm } from "fs/promises"
import path from "path"
import { Global } from "@/global"
import { Log } from "@/util/log"
import { Filesystem } from "@/util/filesystem"
import { Instance } from "@/project/instance"

type RawConfig =
  | boolean
  | {
      enabled?: boolean
      fixedSlot?: number
      slotCount?: number
      cachePrompt?: boolean
      cacheReuse?: number
      persistent?: boolean
      saveAfterStep?: boolean
      slotSavePath?: string
    }

type Config = {
  fixedSlot?: number
  slotCount: number
  cachePrompt: boolean
  cacheReuse?: number
  persistent: boolean
  saveAfterStep: boolean
  slotSavePath?: string
}

type StoredEntry = {
  sessionID: string
  providerID: string
  modelID: string
  baseURL: string
  slotId: number
  filename: string
  slotSavePath?: string
  updatedAt: number
}

type State = {
  loaded: boolean
  entries: Record<string, StoredEntry>
  slotOwners: Record<number, string>
}

function stateFile() {
  return path.join(Global.Path.state, "llamacpp-session-cache", `${Instance.project.id}.json`)
}

function cleanCacheReuse(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined
  return Math.floor(value)
}

function cleanSlot(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined
  return Math.floor(value)
}

export namespace LlamaCppSessionCache {
  const log = Log.create({ service: "provider.llamacpp-cache" })
  const state = Instance.state<State>(() => ({
    loaded: false,
    entries: {},
    slotOwners: {},
  }))

  export function controlBaseURL(baseURL: string) {
    const url = new URL(baseURL)
    url.pathname = url.pathname.replace(/\/v1\/?$/, "") || "/"
    return url.toString().replace(/\/$/, "")
  }

  export function slotFilename(input: { sessionID: string; providerID: string; modelID: string; baseURL: string }) {
    const hash =
      Bun.hash.xxHash32(
        JSON.stringify({
          providerID: input.providerID,
          modelID: input.modelID,
          baseURL: controlBaseURL(input.baseURL),
        }),
      ) >>> 0
    return `${input.sessionID}-${hash.toString(16).padStart(8, "0")}.bin`
  }

  export function config(providerOptions?: Record<string, any>): Config | undefined {
    const raw = providerOptions?.llamaCppSessionCache as RawConfig | undefined
    if (!raw) return undefined
    if (raw === true) {
      return {
        slotCount: 1,
        cachePrompt: true,
        persistent: true,
        saveAfterStep: true,
      }
    }
    if (typeof raw !== "object") return undefined
    if (raw.enabled === false) return undefined
    return {
      fixedSlot: cleanSlot(raw.fixedSlot),
      slotCount: cleanSlot(raw.slotCount) ?? 1,
      cachePrompt: raw.cachePrompt ?? true,
      cacheReuse: cleanCacheReuse(raw.cacheReuse),
      persistent: raw.persistent ?? true,
      saveAfterStep: raw.saveAfterStep ?? true,
      slotSavePath: typeof raw.slotSavePath === "string" && raw.slotSavePath.trim() ? raw.slotSavePath : undefined,
    }
  }

  export function isEnabled(providerOptions?: Record<string, any>) {
    return !!config(providerOptions)
  }

  function slotID(sessionID: string, cfg: Config) {
    if (cfg.fixedSlot !== undefined) return cfg.fixedSlot
    return (Bun.hash.xxHash32(sessionID) >>> 0) % Math.max(1, cfg.slotCount)
  }

  function authHeader(apiKey: unknown) {
    if (typeof apiKey !== "string" || !apiKey.trim()) return undefined
    return `Bearer ${apiKey}`
  }

  function filePath(entry: Pick<StoredEntry, "filename" | "slotSavePath">) {
    if (!entry.slotSavePath) return undefined
    return path.join(entry.slotSavePath, entry.filename)
  }

  function isAbort(error: unknown) {
    return error instanceof DOMException && error.name === "AbortError"
  }

  async function ensureLoaded() {
    const current = state()
    if (current.loaded) return current
    const persisted = await Filesystem.readJson<{ entries?: Record<string, StoredEntry> }>(stateFile()).catch(
      () => undefined,
    )
    current.entries = persisted?.entries ?? {}
    current.slotOwners = Object.fromEntries(
      Object.values(current.entries).map((entry) => [entry.slotId, entry.sessionID] as const),
    )
    current.loaded = true
    return current
  }

  async function persist() {
    const current = state()
    await Filesystem.writeJson(stateFile(), { entries: current.entries })
  }

  async function removeLocalFile(entry?: Pick<StoredEntry, "filename" | "slotSavePath">) {
    const target = entry ? filePath(entry) : undefined
    if (!target) return
    await rm(target, { force: true }).catch(() => {})
  }

  async function postSlot(input: {
    baseURL: string
    slotId: number
    action: "save" | "restore" | "erase"
    filename?: string
    apiKey?: unknown
    fetch: typeof fetch
    signal?: AbortSignal
  }) {
    const url = new URL(`/slots/${input.slotId}`, controlBaseURL(input.baseURL))
    url.searchParams.set("action", input.action)
    const headers = new Headers({
      "content-type": "application/json",
    })
    const auth = authHeader(input.apiKey)
    if (auth) headers.set("authorization", auth)
    const body = input.filename ? JSON.stringify({ filename: input.filename }) : "{}"
    const response = await input.fetch(url, {
      method: "POST",
      headers,
      body,
      signal: input.signal,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`slot ${input.action} failed: ${response.status} ${text}`.trim())
    }
    return response
  }

  export async function prepareRequest(input: {
    sessionID: string
    providerID: string
    modelID: string
    providerOptions?: Record<string, any>
    baseURL: string
    fetch: typeof fetch
    signal?: AbortSignal
  }) {
    const cfg = config(input.providerOptions)
    if (!cfg) return undefined

    const current = await ensureLoaded()
    const slotId = slotID(input.sessionID, cfg)
    const next: StoredEntry = {
      sessionID: input.sessionID,
      providerID: input.providerID,
      modelID: input.modelID,
      baseURL: controlBaseURL(input.baseURL),
      slotId,
      filename: slotFilename(input),
      slotSavePath: cfg.slotSavePath,
      updatedAt: Date.now(),
    }

    const existing = current.entries[input.sessionID]
    if (existing && (existing.filename !== next.filename || existing.slotSavePath !== next.slotSavePath)) {
      await removeLocalFile(existing)
    }

    current.entries[input.sessionID] = next
    const owner = current.slotOwners[slotId]
    if (owner !== input.sessionID) {
      let restored = false
      if (cfg.persistent) {
        const target = filePath(next)
        const shouldRestore = target ? await Filesystem.exists(target) : !!existing
        if (shouldRestore) {
          try {
            await postSlot({
              baseURL: next.baseURL,
              slotId,
              action: "restore",
              filename: next.filename,
              apiKey: input.providerOptions?.apiKey,
              fetch: input.fetch,
              signal: input.signal,
            })
            restored = true
          } catch (error) {
            if (isAbort(error)) throw error
            log.warn("slot restore failed", { sessionID: input.sessionID, slotId, error })
          }
        }
      }

      if (!restored) {
        try {
          await postSlot({
            baseURL: next.baseURL,
            slotId,
            action: "erase",
            apiKey: input.providerOptions?.apiKey,
            fetch: input.fetch,
            signal: input.signal,
          })
        } catch (error) {
          if (isAbort(error)) throw error
          log.warn("slot erase failed", { sessionID: input.sessionID, slotId, error })
        }
      }
    }

    current.slotOwners[slotId] = input.sessionID
    await persist()

    return {
      id_slot: slotId,
      cache_prompt: cfg.cachePrompt,
      ...(cfg.cacheReuse ? { n_cache_reuse: cfg.cacheReuse } : {}),
    }
  }

  export async function saveSession(input: {
    sessionID: string
    providerID: string
    modelID: string
    providerOptions?: Record<string, any>
    baseURL: string
    fetch: typeof fetch
    signal?: AbortSignal
  }) {
    const cfg = config(input.providerOptions)
    if (!cfg || !cfg.persistent || !cfg.saveAfterStep) return

    const current = await ensureLoaded()
    const slotId = slotID(input.sessionID, cfg)
    const entry: StoredEntry = {
      sessionID: input.sessionID,
      providerID: input.providerID,
      modelID: input.modelID,
      baseURL: controlBaseURL(input.baseURL),
      slotId,
      filename: slotFilename(input),
      slotSavePath: cfg.slotSavePath,
      updatedAt: Date.now(),
    }

    current.entries[input.sessionID] = entry
    current.slotOwners[slotId] = input.sessionID

    try {
      await postSlot({
        baseURL: entry.baseURL,
        slotId,
        action: "save",
        filename: entry.filename,
        apiKey: input.providerOptions?.apiKey,
        fetch: input.fetch,
        signal: input.signal,
      })
    } catch (error) {
      if (isAbort(error)) throw error
      log.warn("slot save failed", { sessionID: input.sessionID, slotId, error })
      return
    }

    await persist()
  }

  export async function removeSession(sessionID: string) {
    const current = await ensureLoaded()
    const entry = current.entries[sessionID]
    if (!entry) return
    delete current.entries[sessionID]
    if (current.slotOwners[entry.slotId] === sessionID) {
      delete current.slotOwners[entry.slotId]
    }
    await removeLocalFile(entry)
    await persist()
  }
}
