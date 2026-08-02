import type { Session } from "@slopcode-ai/sdk/v2/client"
import { createSimpleContext } from "@slopcode-ai/ui/context"
import { base64Encode } from "@slopcode-ai/core/util/encode"
import { createStore, produce } from "solid-js/store"
import { Persist, persisted, removePersisted, draftPersistedKeys } from "@/utils/persist"
import { ServerConnection, useServer } from "./server"
import { createEffect, startTransition } from "solid-js"
import { useLocation, useNavigate, useParams } from "@solidjs/router"
import { usePlatform } from "./platform"
import { uuid } from "@/utils/uuid"
import { SessionTabsRemovedDetail } from "@/components/titlebar-session-events"
import { migrateClosedTabs, pruneClosedTabs, removeClosedTabs, type ClosedTab } from "./closed-tabs"
import { createTabController } from "./tab-controller"
import { migrateTabs } from "./tab-migration"
import { decodeSessionTabDirectory, draftHref, tabHref } from "./tab-route"
import {
  createRecentTabMemory,
  createDraftTab,
  homeToggle,
  pruneRecentTabs,
  rememberRecentTab,
  reorderTabs,
  replaceRecentTab,
} from "./tab-state"
import { tabKey } from "./tab-key"

export type PromptModel = {
  providerID: string
  modelID: string
  variant?: string | null
}

export type SessionTab = {
  type: "session"
  server: ServerConnection.Key
  dirBase64: string
  sessionId: string
}

export type DraftTab = {
  type: "draft"
  draftID: string
  server: ServerConnection.Key
  directory: string
  worktree?: string
  model?: PromptModel
}

export type Tab = SessionTab | DraftTab

export { draftHref, tabHref }

export { tabKey }

export function sessionHasOpenTab(tabs: Tab[], server: ServerConnection.Key, session: Session) {
  const dirBase64 = base64Encode(session.directory)
  return tabs.some(
    (tab) =>
      tab.type === "session" && tab.server === server && tab.dirBase64 === dirBase64 && tab.sessionId === session.id,
  )
}

export const { use: useTabs, provider: TabsProvider } = createSimpleContext({
  name: "Tabs",
  gate: false,
  init: (props: { serverCatalogAuthoritative?: () => boolean }) => {
    const server = useServer()
    const platform = usePlatform()
    const serverCatalogAuthoritative = () => props.serverCatalogAuthoritative?.() ?? true
    const fallback = server.key
    const [store, setStore, , ready] = persisted(
      {
        ...Persist.global("tabs"),
        migrate: (value: unknown) => migrateTabs(value, fallback),
      },
      createStore<Tab[]>([]),
    )
    const [closed, setClosed, , closedReady] = persisted(
      {
        ...Persist.global("tabs.closed"),
        migrate: (value: unknown) =>
          migrateClosedTabs(
            value,
            fallback,
            new Set(server.list.map(ServerConnection.key)),
            !serverCatalogAuthoritative(),
          ),
      },
      createStore<ClosedTab[]>([]),
    )
    const [recent, setRecent, , recentReady] = persisted(
      {
        ...Persist.global("tabs.recent"),
        migrate: (value: unknown) => {
          if (!value || typeof value !== "object") return { keys: [] }
          if ("keys" in value && Array.isArray(value.keys)) {
            return { keys: value.keys.filter((key): key is string => typeof key === "string") }
          }
          if ("key" in value && typeof value.key === "string") return { keys: [value.key] }
          return { keys: [] }
        },
      },
      createStore<{ keys: string[] }>({ keys: [] }),
    )

    const params = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const controller = createTabController({
      activeServer: () => server.key,
      servers: () => server.list.map(ServerConnection.key),
      location: () => location,
    })

    const closing = new Set<string>()
    const models = new Map<string, PromptModel>()
    const memory = createRecentTabMemory(
      () => recent.keys,
      (keys) => setRecent("keys", keys),
      !!recentReady.promise,
    )
    if (recentReady.promise) void recentReady.promise.then(memory.hydrate)

    const recentKeys = memory.keys
    const updateRecentKeys = memory.update

    const openKeys = () => new Set(store.map(tabKey))

    const forget = (keys: string[]) => {
      const removed = new Set(keys)
      for (const key of removed) models.delete(key)
      updateRecentKeys((keys) => keys.filter((key) => !removed.has(key)))
    }

    const removeDraftPersisted = (draftID: string) => {
      for (const key of draftPersistedKeys()) removePersisted(Persist.draft(draftID, key), platform)
    }

    const updateClosed = (update: (stack: ClosedTab[]) => ClosedTab[]) => {
      const apply = () => setClosed((stack) => update(stack))
      if (closedReady()) {
        apply()
        return
      }
      void closedReady.promise?.then(apply)
    }

    createEffect(() => {
      if (!ready() || !serverCatalogAuthoritative()) return
      const servers = new Set(server.list.map(ServerConnection.key))
      if (store.every((tab) => servers.has(tab.server))) return
      const removed = store.filter((tab) => !servers.has(tab.server)).map(tabKey)
      setStore((tabs) => tabs.filter((tab) => servers.has(tab.server)))
      forget(removed)
    })

    createEffect(() => {
      if (!ready() || !recentReady()) return
      const current = recentKeys()
      const next = pruneRecentTabs(current, openKeys())
      if (next.length === current.length && next.every((key, index) => key === current[index])) return
      updateRecentKeys(() => next)
    })

    createEffect(() => {
      if (!closedReady() || !serverCatalogAuthoritative()) return
      const servers = new Set(server.list.map(ServerConnection.key))
      if (closed.every((entry) => servers.has(entry.tab.server))) return
      setClosed((stack) => pruneClosedTabs(stack, servers))
    })

    const navigateTab = (tab: Tab) => {
      const href = tabHref(tab)
      updateRecentKeys((keys) => rememberRecentTab(keys, tabKey(tab), openKeys()))
      if (tab.server === server.key) {
        navigate(href)
        return
      }
      void startTransition(() => {
        server.setActive(tab.server)
        navigate(href)
      })
    }

    const removeTab = (index: number, selected?: boolean) => {
      const result = controller.remove(store, index, selected)
      const tab = result.tab
      if (!tab) return
      const key = tabKey(tab)
      const draftID = tab.type === "draft" ? tab.draftID : undefined
      closing.add(key)
      void startTransition(() => {
        setStore(
          produce((tabs) => {
            tabs.splice(index, 1)
          }),
        )
        if (result.next === null) navigate("/")
        if (result.next) navigateTab(result.next)
      }).finally(() => closing.delete(key))
      forget([key])
      if (draftID) removeDraftPersisted(draftID)
    }

    const actions = {
      addSessionTab: (tab: Omit<SessionTab, "type">) => {
        const next = { type: "session" as const, ...tab }
        if (closing.has(tabKey(next))) return
        setStore(
          produce((tabs) => {
            if (tabs.some((item) => tabKey(item) === tabKey(next))) return
            tabs.push(next)
          }),
        )
      },
      reorder(keys: string[]) {
        setStore((tabs) => reorderTabs(tabs, keys, tabKey))
      },
      draft(draftID: string) {
        const tab = store.find((item) => item.type === "draft" && item.draftID === draftID)
        if (!tab || tab.type !== "draft") throw new Error(`Draft not found: ${draftID}`)
        return tab
      },
      newDraft(draft: Omit<DraftTab, "type" | "draftID" | "model">, prompt?: string, model?: PromptModel) {
        const draftID = uuid()
        const tab = createDraftTab(draftID, draft, model)
        setStore(
          produce((tabs) => {
            tabs.push(tab)
          }),
        )
        if (model) models.set(tabKey(tab), { ...model })
        navigate(prompt ? `${draftHref(draftID)}&prompt=${encodeURIComponent(prompt)}` : draftHref(draftID))
        return tab
      },
      updateDraft(draftID: string, draft: Partial<Omit<DraftTab, "type" | "draftID">>) {
        setStore(
          (tab) => tab.type === "draft" && tab.draftID === draftID,
          produce((tab) => Object.assign(tab, draft)),
        )
      },
      promoteDraft(draftID: string, session: Omit<SessionTab, "type">) {
        // We're viewing this draft when /new-session?draftId=… points at it. Promoting
        // replaces the draft tab with a session tab, so the draft route would stop resolving
        // and fall back home. Navigate to the new session first so we leave /new-session
        // before the draft is removed from the store.
        const active = location.pathname === "/new-session" && location.query.draftId === draftID
        const previous = `draft:${draftID}`
        const next = { type: "session" as const, ...session }
        startTransition(() => {
          setStore(
            produce((tabs) => {
              const index = tabs.findIndex((tab) => tab.type === "draft" && tab.draftID === draftID)
              if (index !== -1) tabs[index] = next
            }),
          )
          updateRecentKeys((keys) => replaceRecentTab(keys, previous, tabKey(next), openKeys()))
          const model = models.get(previous)
          models.delete(previous)
          if (model) models.set(tabKey(next), model)
          if (active) navigateTab(next)
        })
        removeDraftPersisted(draftID)
      },
      removeTab,
      closeTab(index: number, selected?: boolean) {
        const tab = store[index]
        if (!tab) return
        if (tab.type === "session") updateClosed((stack) => controller.close(store, stack, index, selected).closed)
        removeTab(index, selected)
      },
      reopenClosedTab() {
        if (!closedReady()) {
          void closedReady.promise?.then(() => actions.reopenClosedTab())
          return
        }
        const result = controller.reopen(store, closed)
        if (result.closed.length !== closed.length) setClosed(() => result.closed)
        const entry = result.entry
        if (!entry) return
        void startTransition(() => {
          setStore(() => result.tabs)
          navigateTab(entry.tab)
        })
      },
      removeServer(key: ServerConnection.Key) {
        updateClosed((stack) => stack.filter((entry) => entry.tab.server !== key))
        const drafts = store.flatMap((tab) => (tab.type === "draft" && tab.server === key ? [tab.draftID] : []))
        const removed = store.filter((tab) => tab.server === key).map(tabKey)
        setStore((tabs) => tabs.filter((tab) => tab.server !== key))
        forget(removed)
        for (const draftID of drafts) removeDraftPersisted(draftID)
        if (server.key === key) navigate("/")
      },
      removeSessions: (input: SessionTabsRemovedDetail) => {
        updateClosed((stack) => removeClosedTabs(stack, server.key, input.sessionIDs))
        const removed = store
          .filter(
            (tab) =>
              tab.type === "session" &&
              tab.server === server.key &&
              decodeSessionTabDirectory(tab) === input.directory &&
              input.sessionIDs.includes(tab.sessionId),
          )
          .map(tabKey)
        void startTransition(() => {
          setStore(
            produce((tabs) => {
              const sessionIDs = new Set(input.sessionIDs)
              const currentHref =
                params.dir && params.id
                  ? tabHref({
                      type: "session",
                      server: server.key,
                      dirBase64: params.dir,
                      sessionId: params.id,
                    })
                  : undefined
              const currentIndex = currentHref
                ? tabs.findIndex(
                    (tab) => tab.type === "session" && tab.server === server.key && tabHref(tab) === currentHref,
                  )
                : -1
              const currentTab = tabs[currentIndex]
              const removedCurrent =
                currentTab?.type === "session" &&
                currentTab.server === server.key &&
                decodeSessionTabDirectory(currentTab) === input.directory &&
                sessionIDs.has(currentTab.sessionId)

              for (let i = tabs.length - 1; i >= 0; i--) {
                const tab = tabs[i]
                if (!tab || tab.type !== "session") continue
                if (tab.server !== server.key) continue
                if (decodeSessionTabDirectory(tab) !== input.directory) continue
                if (!sessionIDs.has(tab.sessionId)) continue
                tabs.splice(i, 1)
              }

              if (!removedCurrent) return
              const nextTab =
                tabs.slice(currentIndex).find((tab) => tab.type === "session") ??
                tabs.slice(0, currentIndex).findLast((tab) => tab.type === "session")
              if (nextTab) navigateTab(nextTab)
              else navigate("/")
            }),
          )
        })
        forget(removed)
      },
      select: navigateTab,
      remember(tab: Tab) {
        updateRecentKeys((keys) => rememberRecentTab(keys, tabKey(tab), openKeys()))
      },
      toggleHome(input: { home: boolean; current?: Tab }) {
        const next = homeToggle(store, recentKeys(), input.home, input.current, tabKey)
        if ("tab" in next) {
          if (next.tab) navigateTab(next.tab)
          return
        }
        if (next.remember) actions.remember(next.remember)
        navigate("/")
      },
      rememberModel(tab: Tab, model: PromptModel | undefined) {
        const key = tabKey(tab)
        if (!model) {
          models.delete(key)
          return
        }
        if (
          tab.type === "draft" &&
          (tab.model?.providerID !== model.providerID ||
            tab.model.modelID !== model.modelID ||
            tab.model.variant !== model.variant)
        ) {
          setStore(
            (item) => item.type === "draft" && item.draftID === tab.draftID,
            produce((item) => Object.assign(item, { model: { ...model } })),
          )
        }
        models.delete(key)
        models.set(key, { ...model })
        while (models.size > 25) {
          const first = models.keys().next().value
          if (!first) return
          models.delete(first)
        }
      },
      model(tab: Tab) {
        const model = models.get(tabKey(tab)) ?? (tab.type === "draft" ? tab.model : undefined)
        return model ? { ...model } : undefined
      },
    }

    return { ...actions, store, ready, recentReady }
  },
})
