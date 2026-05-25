import { Platform, usePlatform } from "@/context/platform"
import { makePersisted, type AsyncStorage, type SyncStorage } from "@solid-primitives/storage"
import { checksum } from "@slopcode-ai/util/encode"
import { createResource, onCleanup, type Accessor } from "solid-js"
import { reconcile, type SetStoreFunction, type Store } from "solid-js/store"

type InitType = Promise<string> | string | null
type PersistedWithReady<T> = [Store<T>, SetStoreFunction<T>, InitType, Accessor<boolean>]

type PersistTarget = {
  storage?: string
  key: string
  legacy?: string[]
  migrate?: (value: unknown) => unknown
  scope?: string
  sync?: boolean
}

const LEGACY_STORAGE = "default.dat"
const GLOBAL_STORAGE = "slopcode.global.dat"
const LOCAL_PREFIX = "slopcode."
const fallback = new Map<string, boolean>()

const CACHE_MAX_ENTRIES = 500
const CACHE_MAX_BYTES = 8 * 1024 * 1024

type CacheEntry = { value: string; bytes: number }
const cache = new Map<string, CacheEntry>()
const cacheTotal = { bytes: 0 }

function cacheDelete(key: string) {
  const entry = cache.get(key)
  if (!entry) return
  cacheTotal.bytes -= entry.bytes
  cache.delete(key)
}

function cachePrune() {
  for (;;) {
    if (cache.size <= CACHE_MAX_ENTRIES && cacheTotal.bytes <= CACHE_MAX_BYTES) return
    const oldest = cache.keys().next().value as string | undefined
    if (!oldest) return
    cacheDelete(oldest)
  }
}

function cacheSet(key: string, value: string) {
  const bytes = value.length * 2
  if (bytes > CACHE_MAX_BYTES) {
    cacheDelete(key)
    return
  }

  const entry = cache.get(key)
  if (entry) cacheTotal.bytes -= entry.bytes
  cache.delete(key)
  cache.set(key, { value, bytes })
  cacheTotal.bytes += bytes
  cachePrune()
}

function cacheGet(key: string) {
  const entry = cache.get(key)
  if (!entry) return
  cache.delete(key)
  cache.set(key, entry)
  return entry.value
}

function fallbackDisabled(scope: string) {
  return fallback.get(scope) === true
}

function fallbackSet(scope: string) {
  fallback.set(scope, true)
}

function quota(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "QuotaExceededError") return true
    if (error.name === "NS_ERROR_DOM_QUOTA_REACHED") return true
    if (error.name === "QUOTA_EXCEEDED_ERR") return true
    if (error.code === 22 || error.code === 1014) return true
    return false
  }

  if (!error || typeof error !== "object") return false
  const name = (error as { name?: string }).name
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") return true
  if (name && /quota/i.test(name)) return true

  const code = (error as { code?: number }).code
  if (code === 22 || code === 1014) return true

  const message = (error as { message?: string }).message
  if (typeof message !== "string") return false
  if (/quota/i.test(message)) return true
  return false
}

type Evict = { key: string; size: number }

function evict(storage: Storage, keep: string, value: string) {
  const total = storage.length
  const indexes = Array.from({ length: total }, (_, index) => index)
  const items: Evict[] = []

  for (const index of indexes) {
    const name = storage.key(index)
    if (!name) continue
    if (!name.startsWith(LOCAL_PREFIX)) continue
    if (name === keep) continue
    const stored = storage.getItem(name)
    items.push({ key: name, size: stored?.length ?? 0 })
  }

  items.sort((a, b) => b.size - a.size)

  for (const item of items) {
    storage.removeItem(item.key)
    cacheDelete(item.key)

    try {
      storage.setItem(keep, value)
      cacheSet(keep, value)
      return true
    } catch (error) {
      if (!quota(error)) throw error
    }
  }

  return false
}

function write(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value)
    cacheSet(key, value)
    return true
  } catch (error) {
    if (!quota(error)) throw error
  }

  try {
    storage.removeItem(key)
    cacheDelete(key)
    storage.setItem(key, value)
    cacheSet(key, value)
    return true
  } catch (error) {
    if (!quota(error)) throw error
  }

  const ok = evict(storage, key, value)
  return ok
}

function snapshot(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function merge(defaults: unknown, value: unknown): unknown {
  if (value === undefined) return defaults
  if (value === null) return value

  if (Array.isArray(defaults)) {
    if (Array.isArray(value)) return value
    return defaults
  }

  if (isRecord(defaults)) {
    if (!isRecord(value)) return defaults

    const result: Record<string, unknown> = { ...defaults }
    for (const key of Object.keys(value)) {
      if (key in defaults) {
        result[key] = merge((defaults as Record<string, unknown>)[key], (value as Record<string, unknown>)[key])
      } else {
        result[key] = (value as Record<string, unknown>)[key]
      }
    }
    return result
  }

  return value
}

function parse(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

function normalize(defaults: unknown, raw: string, migrate?: (value: unknown) => unknown) {
  const parsed = parse(raw)
  if (parsed === undefined) return
  const migrated = migrate ? migrate(parsed) : parsed
  const merged = merge(defaults, migrated)
  return JSON.stringify(merged)
}

function workspaceStorage(dir: string) {
  const head = dir.slice(0, 12) || "workspace"
  const sum = checksum(dir) ?? "0"
  return `slopcode.workspace.${head}.${sum}.dat`
}

function token(scope?: string) {
  if (!scope) return
  return checksum(scope) ?? "0"
}

function scopedStorage(config: { storage?: string; scope?: string }) {
  if (!config.storage) return
  const sum = token(config.scope)
  if (!sum) return config.storage
  if (config.storage.endsWith(".dat")) {
    return `${config.storage.slice(0, -4)}.${sum}.dat`
  }
  return `${config.storage}.${sum}`
}

function scopedKey(config: { key: string; scope?: string }) {
  const sum = token(config.scope)
  if (!sum) return config.key
  return `scope:${sum}:${config.key}`
}

function localStorageKey(config: PersistTarget) {
  const storage = scopedStorage(config)
  const key = scopedKey(config)
  if (!storage) return key
  return `${storage}:${key}`
}

function syncValue<T>(defaults: T, newValue: string | null, migrate?: (value: unknown) => unknown) {
  if (newValue === null) return snapshot(defaults)
  const next = normalize(defaults, newValue, migrate)
  if (next === undefined) return
  return JSON.parse(next) as T
}

function localStorageWithPrefix(prefix: string): SyncStorage {
  const base = `${prefix}:`
  const scope = `prefix:${prefix}`
  const item = (key: string) => base + key
  return {
    getItem: (key) => {
      const name = item(key)
      const cached = cacheGet(name)
      if (fallbackDisabled(scope)) return cached ?? null

      const stored = (() => {
        try {
          return localStorage.getItem(name)
        } catch {
          fallbackSet(scope)
          return null
        }
      })()
      if (stored === null) return cached ?? null
      cacheSet(name, stored)
      return stored
    },
    setItem: (key, value) => {
      const name = item(key)
      if (fallbackDisabled(scope)) return
      try {
        if (write(localStorage, name, value)) return
      } catch {
        fallbackSet(scope)
        return
      }
      fallbackSet(scope)
    },
    removeItem: (key) => {
      const name = item(key)
      cacheDelete(name)
      if (fallbackDisabled(scope)) return
      try {
        localStorage.removeItem(name)
      } catch {
        fallbackSet(scope)
      }
    },
  }
}

function localStorageDirect(): SyncStorage {
  const scope = "direct"
  return {
    getItem: (key) => {
      const cached = cacheGet(key)
      if (fallbackDisabled(scope)) return cached ?? null

      const stored = (() => {
        try {
          return localStorage.getItem(key)
        } catch {
          fallbackSet(scope)
          return null
        }
      })()
      if (stored === null) return cached ?? null
      cacheSet(key, stored)
      return stored
    },
    setItem: (key, value) => {
      if (fallbackDisabled(scope)) return
      try {
        if (write(localStorage, key, value)) return
      } catch {
        fallbackSet(scope)
        return
      }
      fallbackSet(scope)
    },
    removeItem: (key) => {
      cacheDelete(key)
      if (fallbackDisabled(scope)) return
      try {
        localStorage.removeItem(key)
      } catch {
        fallbackSet(scope)
      }
    },
  }
}

export const PersistTesting = {
  localStorageDirect,
  localStorageKey,
  localStorageWithPrefix,
  normalize,
  scopedKey,
  scopedStorage,
  syncValue,
}

export const Persist = {
  global(key: string, legacy?: string[]): PersistTarget {
    return { storage: GLOBAL_STORAGE, key, legacy }
  },
  workspace(dir: string, key: string, legacy?: string[]): PersistTarget {
    return { storage: workspaceStorage(dir), key: `workspace:${key}`, legacy }
  },
  session(dir: string, session: string, key: string, legacy?: string[]): PersistTarget {
    return { storage: workspaceStorage(dir), key: `session:${session}:${key}`, legacy }
  },
  scoped(dir: string, session: string | undefined, key: string, legacy?: string[]): PersistTarget {
    if (session) return Persist.session(dir, session, key, legacy)
    return Persist.workspace(dir, key, legacy)
  },
}

export function removePersisted(target: { storage?: string; key: string }, platform?: Platform) {
  const storage = scopedStorage(target)
  const key = scopedKey(target)
  const isDesktop = platform?.platform === "desktop" && !!platform.storage

  if (isDesktop) {
    return platform.storage?.(storage)?.removeItem(key)
  }

  if (!storage) {
    localStorageDirect().removeItem(key)
    return
  }

  localStorageWithPrefix(storage).removeItem(key)
}

export function persisted<T>(
  target: string | PersistTarget,
  store: [Store<T>, SetStoreFunction<T>],
): PersistedWithReady<T> {
  const platform = usePlatform()
  const config: PersistTarget = typeof target === "string" ? { key: target } : target

  const defaults = snapshot(store[0])
  const legacy = config.legacy ?? []
  const storageName = scopedStorage(config)
  const storageKey = scopedKey(config)

  const isDesktop = platform.platform === "desktop" && !!platform.storage

  const currentStorage = (() => {
    if (isDesktop) return platform.storage?.(storageName)
    if (!storageName) return localStorageDirect()
    return localStorageWithPrefix(storageName)
  })()

  const previousStorage = (() => {
    if (!config.scope) return
    if (isDesktop) return platform.storage?.(config.storage)
    if (!config.storage) return localStorageDirect()
    return localStorageWithPrefix(config.storage)
  })()

  const legacyStorage = (() => {
    if (!isDesktop) return localStorageDirect()
    if (!config.storage) return platform.storage?.()
    return platform.storage?.(LEGACY_STORAGE)
  })()

  const storage = (() => {
    if (!isDesktop) {
      const current = currentStorage as SyncStorage
      const legacyStore = legacyStorage as SyncStorage

      const api: SyncStorage = {
        getItem: (key) => {
          const raw = current.getItem(key)
          if (raw !== null) {
            const next = normalize(defaults, raw, config.migrate)
            if (next === undefined) {
              current.removeItem(key)
              return null
            }
            if (raw !== next) current.setItem(key, next)
            return next
          }

          if (previousStorage) {
            const previous = previousStorage as SyncStorage
            const previousRaw = previous.getItem(config.key)
            if (previousRaw !== null) {
              const next = normalize(defaults, previousRaw, config.migrate)
              if (next === undefined) {
                previous.removeItem(config.key)
              } else {
                current.setItem(key, next)
                previous.removeItem(config.key)
                return next
              }
            }
          }

          for (const legacyKey of legacy) {
            const legacyRaw = legacyStore.getItem(legacyKey)
            if (legacyRaw === null) continue

            const next = normalize(defaults, legacyRaw, config.migrate)
            if (next === undefined) {
              legacyStore.removeItem(legacyKey)
              continue
            }
            current.setItem(key, next)
            legacyStore.removeItem(legacyKey)
            return next
          }

          return null
        },
        setItem: (key, value) => {
          current.setItem(key, value)
        },
        removeItem: (key) => {
          current.removeItem(key)
        },
      }

      return api
    }

    const current = currentStorage as AsyncStorage
    const legacyStore = legacyStorage as AsyncStorage | undefined

    const api: AsyncStorage = {
      getItem: async (key) => {
        const raw = await current.getItem(key)
        if (raw !== null) {
          const next = normalize(defaults, raw, config.migrate)
          if (next === undefined) {
            await current.removeItem(key).catch(() => undefined)
            return null
          }
          if (raw !== next) await current.setItem(key, next)
          return next
        }

        if (previousStorage) {
          const previous = previousStorage as AsyncStorage
          const previousRaw = await previous.getItem(config.key)
          if (previousRaw !== null) {
            const next = normalize(defaults, previousRaw, config.migrate)
            if (next === undefined) {
              await previous.removeItem(config.key).catch(() => undefined)
            } else {
              await current.setItem(key, next)
              await previous.removeItem(config.key).catch(() => undefined)
              return next
            }
          }
        }

        if (!legacyStore) return null

        for (const legacyKey of legacy) {
          const legacyRaw = await legacyStore.getItem(legacyKey)
          if (legacyRaw === null) continue

          const next = normalize(defaults, legacyRaw, config.migrate)
          if (next === undefined) {
            await legacyStore.removeItem(legacyKey).catch(() => undefined)
            continue
          }
          await current.setItem(key, next)
          await legacyStore.removeItem(legacyKey)
          return next
        }

        return null
      },
      setItem: async (key, value) => {
        await current.setItem(key, value)
      },
      removeItem: async (key) => {
        await current.removeItem(key)
      },
    }

    return api
  })()

  const [state, setState, init] = makePersisted(store, { name: storageKey, storage })

  const isAsync = init instanceof Promise
  const [ready] = createResource(
    () => init,
    async (initValue) => {
      if (initValue instanceof Promise) await initValue
      return true
    },
    { initialValue: !isAsync },
  )

  if (!isDesktop && config.sync !== false && typeof window !== "undefined") {
    const key = localStorageKey(config)
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return
      if (event.key !== key) return
      const next = syncValue(defaults, event.newValue, config.migrate)
      if (next === undefined) return
      setState(next as T)
    }
    window.addEventListener("storage", sync)
    onCleanup(() => window.removeEventListener("storage", sync))
  }

  return [state, setState, init, () => ready() === true]
}
