import { createStore, produce } from "solid-js/store"
import { createSimpleContext } from "@slopcode-ai/ui/context"
import { batch, createEffect, createMemo, createRoot, onCleanup } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSDK } from "./sdk"
import type { Platform } from "./platform"
import { Persist, persisted, removePersisted } from "@/utils/persist"

export type LocalPTY = {
  id: string
  title: string
  titleNumber: number
  sessionID?: string
  rows?: number
  cols?: number
  buffer?: string
  scrollY?: number
  cursor?: number
}

const WORKSPACE_KEY = "__workspace__"
const MAX_TERMINAL_SESSIONS = 20

export function getWorkspaceTerminalCacheKey(dir: string) {
  return `${dir}:${WORKSPACE_KEY}`
}

export function getTerminalCacheKey(dir: string, sessionID?: string) {
  if (!sessionID) return getWorkspaceTerminalCacheKey(dir)
  return `${dir}:session:${sessionID}`
}

export function getLegacyTerminalStorageKeys(dir: string, legacySessionID?: string) {
  if (!legacySessionID) return [`${dir}/terminal.v1`]
  return [`${dir}/terminal/${legacySessionID}.v1`]
}

type TerminalSession = ReturnType<typeof createTerminalSession>

type TerminalCacheEntry = {
  value: TerminalSession
  dispose: VoidFunction
}

const caches = new Set<Map<string, TerminalCacheEntry>>()

type TerminalSDK = Pick<ReturnType<typeof useSDK>, "client" | "event">

function createTerminalCache(sdk: TerminalSDK) {
  const cache = new Map<string, TerminalCacheEntry>()

  const disposeAll = () => {
    for (const entry of cache.values()) {
      entry.dispose()
    }
    cache.clear()
  }

  const prune = () => {
    while (cache.size > MAX_TERMINAL_SESSIONS) {
      const first = cache.keys().next().value
      if (!first) return
      const entry = cache.get(first)
      entry?.dispose()
      cache.delete(first)
    }
  }

  const loadTerminal = (dir: string, sessionID?: string, legacySessionID?: string) => {
    const key = getTerminalCacheKey(dir, sessionID)
    const existing = cache.get(key)
    if (existing) {
      cache.delete(key)
      cache.set(key, existing)
      void existing.value.sync()
      return existing.value
    }

    const entry = createRoot((dispose) => ({
      value: createTerminalSession(sdk, dir, sessionID, legacySessionID),
      dispose,
    }))

    cache.set(key, entry)
    prune()
    return entry.value
  }

  return {
    cache,
    loadTerminal,
    disposeAll,
  }
}

export function createTerminalManagerForTest(sdk: TerminalSDK) {
  const terminals = createTerminalCache(sdk)
  return {
    session: terminals.loadTerminal,
    cacheKeys() {
      return [...terminals.cache.keys()]
    },
    dispose() {
      terminals.disposeAll()
    },
  }
}

export function clearWorkspaceTerminals(dir: string, sessionIDs?: string[], platform?: Platform) {
  const keys = [getWorkspaceTerminalCacheKey(dir), ...(sessionIDs ?? []).map((id) => getTerminalCacheKey(dir, id))]
  for (const cache of caches) {
    for (const key of keys) {
      const entry = cache.get(key)
      entry?.value.clear()
    }
  }

  removePersisted(Persist.workspace(dir, "terminal"), platform)
  for (const id of sessionIDs ?? []) {
    removePersisted(Persist.session(dir, id, "terminal"), platform)
  }

  const legacy = new Set(getLegacyTerminalStorageKeys(dir))
  for (const id of sessionIDs ?? []) {
    for (const key of getLegacyTerminalStorageKeys(dir, id)) {
      legacy.add(key)
    }
  }
  for (const key of legacy) {
    removePersisted({ key }, platform)
  }
}

function createTerminalSession(sdk: TerminalSDK, dir: string, sessionID?: string, legacySessionID?: string) {
  const legacy = getLegacyTerminalStorageKeys(dir, legacySessionID)

  const numberFromTitle = (title: string) => {
    const match = title.match(/^Terminal (\d+)$/)
    if (!match) return
    const value = Number(match[1])
    if (!Number.isFinite(value) || value <= 0) return
    return value
  }

  const [store, setStore, _, ready] = persisted(
    Persist.session(dir, sessionID ?? WORKSPACE_KEY, "terminal", legacy),
    createStore<{
      active?: string
      all: LocalPTY[]
    }>({
      all: [],
    }),
  )

  const pickNextTerminalNumber = () => {
    const existingTitleNumbers = new Set(
      store.all.flatMap((pty) => {
        const direct = Number.isFinite(pty.titleNumber) && pty.titleNumber > 0 ? pty.titleNumber : undefined
        if (direct !== undefined) return [direct]
        const parsed = numberFromTitle(pty.title)
        if (parsed === undefined) return []
        return [parsed]
      }),
    )

    return (
      Array.from({ length: existingTitleNumbers.size + 1 }, (_, index) => index + 1).find(
        (number) => !existingTitleNumbers.has(number),
      ) ?? 1
    )
  }

  const mergeRemote = (items: { id: string; title: string; sessionID?: string }[]) => {
    const current = new Map(store.all.map((pty) => [pty.id, pty]))
    const next = items.map((pty) => {
      const existing = current.get(pty.id)
      return {
        ...existing,
        id: pty.id,
        title: pty.title,
        titleNumber: existing?.titleNumber ?? numberFromTitle(pty.title) ?? pickNextTerminalNumber(),
        sessionID: pty.sessionID,
      } satisfies LocalPTY
    })
    const active = next.some((pty) => pty.id === store.active) ? store.active : next[0]?.id
    batch(() => {
      setStore("all", next)
      setStore("active", active)
    })
  }

  const sync = async () => {
    if (!sessionID) {
      mergeRemote([])
      return
    }
    const result = await sdk.client.pty.list({ sessionID }).catch((error: unknown) => {
      console.error("Failed to sync terminals", error)
      return undefined
    })
    if (!result?.data) return
    mergeRemote(result.data)
  }

  const unsubs = [
    sdk.event.on("pty.created", sync),
    sdk.event.on("pty.updated", sync),
    sdk.event.on("pty.deleted", sync),
    sdk.event.on("pty.exited", sync),
  ]
  onCleanup(() => unsubs.forEach((unsub) => unsub()))

  createEffect(() => {
    if (!ready()) return
    void sync()
  })

  const meta = { migrated: false }

  createEffect(() => {
    if (!ready()) return
    if (meta.migrated) return
    meta.migrated = true

    setStore("all", (all) => {
      const next = all.map((pty) => {
        const direct = Number.isFinite(pty.titleNumber) && pty.titleNumber > 0 ? pty.titleNumber : undefined
        if (direct !== undefined) return pty
        const parsed = numberFromTitle(pty.title)
        if (parsed === undefined) return pty
        return { ...pty, titleNumber: parsed }
      })
      if (next.every((pty, index) => pty === all[index])) return all
      return next
    })
  })

  return {
    ready,
    sync,
    snapshot() {
      return {
        active: store.active,
        all: store.all,
      }
    },
    all: createMemo(() => store.all),
    active: createMemo(() => store.active),
    clear() {
      batch(() => {
        setStore("active", undefined)
        setStore("all", [])
      })
    },
    new() {
      if (!sessionID) return
      const nextNumber = pickNextTerminalNumber()

      sdk.client.pty
        .create({ title: `Terminal ${nextNumber}`, sessionID })
        .then((pty: { data?: { id?: string; title?: string; sessionID?: string } }) => {
          const id = pty.data?.id
          if (!id) return
          const newTerminal = {
            id,
            title: pty.data?.title ?? "Terminal",
            titleNumber: nextNumber,
            sessionID: pty.data?.sessionID,
          }
          setStore("all", store.all.length, newTerminal)
          setStore("active", id)
        })
        .catch((error: unknown) => {
          console.error("Failed to create terminal", error)
        })
    },
    update(pty: Partial<LocalPTY> & { id: string }) {
      if (!sessionID) return
      const index = store.all.findIndex((x) => x.id === pty.id)
      const previous = index >= 0 ? store.all[index] : undefined
      if (index >= 0) {
        setStore("all", index, (item) => ({ ...item, ...pty }))
      }
      sdk.client.pty
        .update({
          ptyID: pty.id,
          sessionID,
          title: pty.title,
          size: pty.cols && pty.rows ? { rows: pty.rows, cols: pty.cols } : undefined,
        })
        .catch((error: unknown) => {
          if (previous) {
            const currentIndex = store.all.findIndex((item) => item.id === pty.id)
            if (currentIndex >= 0) setStore("all", currentIndex, previous)
          }
          console.error("Failed to update terminal", error)
        })
    },
    async clone(id: string) {
      if (!sessionID) return
      const index = store.all.findIndex((x) => x.id === id)
      const pty = store.all[index]
      if (!pty) return
      const clone = await sdk.client.pty
        .create({
          title: pty.title,
          sessionID,
        })
        .catch((error: unknown) => {
          console.error("Failed to clone terminal", error)
          return undefined
        })
      if (!clone?.data) return

      const active = store.active === pty.id

      batch(() => {
        setStore("all", index, {
          id: clone.data.id,
          title: clone.data.title ?? pty.title,
          titleNumber: pty.titleNumber,
          sessionID,
          // New PTY process, so start clean.
          buffer: undefined,
          cursor: undefined,
          scrollY: undefined,
          rows: undefined,
          cols: undefined,
        })
        if (active) {
          setStore("active", clone.data.id)
        }
      })
    },
    open(id: string) {
      setStore("active", id)
    },
    next() {
      const index = store.all.findIndex((x) => x.id === store.active)
      if (index === -1) return
      const nextIndex = (index + 1) % store.all.length
      setStore("active", store.all[nextIndex]?.id)
    },
    previous() {
      const index = store.all.findIndex((x) => x.id === store.active)
      if (index === -1) return
      const prevIndex = index === 0 ? store.all.length - 1 : index - 1
      setStore("active", store.all[prevIndex]?.id)
    },
    async close(id: string) {
      if (!sessionID) return
      const index = store.all.findIndex((f) => f.id === id)
      if (index !== -1) {
        batch(() => {
          if (store.active === id) {
            const next = index > 0 ? store.all[index - 1]?.id : store.all[1]?.id
            setStore("active", next)
          }
          setStore(
            "all",
            produce((all) => {
              all.splice(index, 1)
            }),
          )
        })
      }

      await sdk.client.pty.remove({ ptyID: id, sessionID }).catch((error: unknown) => {
        console.error("Failed to close terminal", error)
      })
    },
    move(id: string, to: number) {
      const index = store.all.findIndex((f) => f.id === id)
      if (index === -1) return
      setStore(
        "all",
        produce((all) => {
          all.splice(to, 0, all.splice(index, 1)[0])
        }),
      )
    },
  }
}

export const { use: useTerminal, provider: TerminalProvider } = createSimpleContext({
  name: "Terminal",
  gate: false,
  init: () => {
    const sdk = useSDK()
    const params = useParams()
    const terminals = createTerminalCache(sdk)

    caches.add(terminals.cache)
    onCleanup(() => caches.delete(terminals.cache))
    onCleanup(terminals.disposeAll)

    const workspace = createMemo(() => terminals.loadTerminal(params.dir!, params.id, params.id))

    return {
      ready: () => workspace().ready(),
      all: () => workspace().all(),
      active: () => workspace().active(),
      new: () => workspace().new(),
      update: (pty: Partial<LocalPTY> & { id: string }) => workspace().update(pty),
      clone: (id: string) => workspace().clone(id),
      open: (id: string) => workspace().open(id),
      close: (id: string) => workspace().close(id),
      move: (id: string, to: number) => workspace().move(id, to),
      next: () => workspace().next(),
      previous: () => workspace().previous(),
    }
  },
})
