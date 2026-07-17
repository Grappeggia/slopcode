import type { Session } from "@slopcode-ai/sdk/v2/client"
import { createSimpleContext } from "@slopcode-ai/ui/context"
import { base64Encode } from "@slopcode-ai/core/util/encode"
import { createStore, produce } from "solid-js/store"
import { Persist, persisted, removePersisted, draftPersistedKeys } from "@/utils/persist"
import { ServerConnection, useServer } from "./server"
import { createEffect, createSignal, startTransition } from "solid-js"
import { useLocation, useNavigate, useParams } from "@solidjs/router"
import { usePlatform } from "./platform"
import { uuid } from "@/utils/uuid"
import { SessionTabsRemovedDetail } from "@/components/titlebar-session-events"
import type { ContextItem, Prompt } from "./prompt"
import type { PreparedPrompt } from "@/components/prompt-input/build-request-parts"

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
}

export type Tab = SessionTab | DraftTab

export type DraftRequest = {
  sessionID: string
  sessionDirectory: string
  prompt: Prompt
  context: (ContextItem & { key: string })[]
  agent: string
  model: { providerID: string; modelID: string }
  variant?: string
}

export type DraftSnapshot = {
  prompt: Prompt
  cursor: number | undefined
  context: (ContextItem & { key: string })[]
  mode: "normal" | "shell"
  worktree: string
}

export type DraftSubmission = {
  directory: string
  worktree: string
  creating?: boolean
  session?: Session
  autoAccept?: boolean
  autoAccepted?: boolean
  accepted?: boolean
  finalizing?: boolean
  abandoned?: boolean
  dispose?: () => void
  cleanedSessionID?: string
  cleanedMessageID?: string
  lastMessageID?: string
  delivery?: {
    messageID: string
    request: DraftRequest
    snapshot: DraftSnapshot
    prepared: PreparedPrompt
    sending: boolean
  }
}

export function draftSubmissionOwner(server: ServerConnection.Key, draftID: string | undefined, directory: string) {
  return `${server}\n${draftID ? `draft:${draftID}` : `legacy:${directory}`}`
}

export function createDraftSubmissionStore() {
  const state = new Map<string, DraftSubmission>()
  const [version, setVersion] = createSignal(0)
  const touch = () => setVersion((value) => value + 1)
  const invalidate = (owner: string) => {
    const current = state.get(owner)
    if (!current) return false
    const dispose = current.dispose
    current.dispose = undefined
    dispose?.()
    state.delete(owner)
    touch()
    return true
  }
  const release = (owner: string) => {
    const current = state.get(owner)
    if (!current) return false
    current.dispose = undefined
    state.delete(owner)
    touch()
    return true
  }
  return {
    get(owner: string) {
      version()
      return state.get(owner)
    },
    set(owner: string, value: DraftSubmission) {
      state.set(owner, value)
      touch()
      return value
    },
    touch,
    clear: invalidate,
    release,
    clearDraft(server: ServerConnection.Key, draftID: string) {
      invalidate(draftSubmissionOwner(server, draftID, ""))
    },
    releaseDraft(server: ServerConnection.Key, draftID: string) {
      release(draftSubmissionOwner(server, draftID, ""))
    },
    clearServer(server: ServerConnection.Key) {
      const prefix = `${server}\n`
      let removed = false
      for (const owner of [...state.keys()]) {
        if (!owner.startsWith(prefix)) continue
        removed = invalidate(owner) || removed
      }
      return removed
    },
  }
}

export const draftHref = (draftID: string) => `/new-session?draftId=${encodeURIComponent(draftID)}`

export const tabHref = (tab: Tab) =>
  tab.type === "draft" ? draftHref(tab.draftID) : `/${tab.dirBase64}/session/${tab.sessionId}`

export const tabKey = (tab: Tab) => (tab.type === "draft" ? `draft:${tab.draftID}` : `${tab.server}\n${tabHref(tab)}`)

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
  init: () => {
    const server = useServer()
    const platform = usePlatform()
    const fallback = server.key
    const [store, setStore, _, ready] = persisted(
      {
        ...Persist.global("tabs"),
        migrate: (value: unknown) => {
          if (!Array.isArray(value)) return value
          return value.map((tab) => {
            if (!tab || typeof tab !== "object" || "server" in tab) return tab
            return { ...tab, server: fallback }
          })
        },
      },
      createStore<Tab[]>([]),
    )

    const params = useParams()
    const navigate = useNavigate()
    const location = useLocation()

    const closing = new Set<string>()
    const submission = createDraftSubmissionStore()

    const removeDraftPersisted = (draftID: string) => {
      for (const key of draftPersistedKeys()) removePersisted(Persist.draft(draftID, key), platform)
    }

    createEffect(() => {
      if (!ready()) return
      const servers = new Set(server.list.map(ServerConnection.key))
      if (store.every((tab) => servers.has(tab.server))) return
      setStore((tabs) => tabs.filter((tab) => servers.has(tab.server)))
    })

    const navigateTab = (tab: Tab) => {
      const href = tabHref(tab)
      if (tab.server === server.key) {
        navigate(href)
        return
      }
      void startTransition(() => {
        server.setActive(tab.server)
        navigate(href)
      })
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
      draft(draftID: string) {
        const tab = store.find((item) => item.type === "draft" && item.draftID === draftID)
        if (!tab || tab.type !== "draft") throw new Error(`Draft not found: ${draftID}`)
        return tab
      },
      newDraft(draft: Omit<DraftTab, "type" | "draftID">, prompt?: string) {
        const draftID = uuid()
        setStore(
          produce((tabs) => {
            tabs.push({ type: "draft", draftID, ...draft })
          }),
        )
        navigate(prompt ? `${draftHref(draftID)}&prompt=${encodeURIComponent(prompt)}` : draftHref(draftID))
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
        submission.releaseDraft(server.key, draftID)
        removeDraftPersisted(draftID)
        void startTransition(() => {
          setStore(
            produce((tabs) => {
              const index = tabs.findIndex((tab) => tab.type === "draft" && tab.draftID === draftID)
              if (index !== -1) tabs[index] = { type: "session", ...session }
            }),
          )
          if (active) navigateTab({ type: "session", ...session })
        })
      },
      removeTab: (index: number) => {
        const tab = store[index]
        if (!tab) return
        const key = tabKey(tab)
        const draftID = tab.type === "draft" ? tab.draftID : undefined
        const nextTab = store[index + 1] ?? store[index - 1]
        closing.add(key)
        if (draftID) {
          submission.clearDraft(tab.server, draftID)
          removeDraftPersisted(draftID)
        }
        void startTransition(() => {
          setStore(
            produce((tabs) => {
              tabs.splice(index, 1)
            }),
          )
          if (nextTab) navigateTab(nextTab)
          else navigate("/")
        }).finally(() => closing.delete(key))
      },
      removeServer(key: ServerConnection.Key) {
        const drafts = store.flatMap((tab) => (tab.type === "draft" && tab.server === key ? [tab.draftID] : []))
        submission.clearServer(key)
        for (const draftID of drafts) removeDraftPersisted(draftID)
        setStore((tabs) => tabs.filter((tab) => tab.server !== key))
        if (server.key === key) navigate("/")
      },
      removeSessions: (input: SessionTabsRemovedDetail) => {
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
                atob(currentTab.dirBase64) === input.directory &&
                sessionIDs.has(currentTab.sessionId)

              for (let i = tabs.length - 1; i >= 0; i--) {
                const tab = tabs[i]
                if (!tab || tab.type !== "session") continue
                if (tab.server !== server.key) continue
                if (atob(tab.dirBase64) !== input.directory) continue
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
      },
    }

    return { ...actions, store, ready, submission }
  },
})
