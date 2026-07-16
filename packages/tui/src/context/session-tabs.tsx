import { createEffect, createMemo, createSignal } from "solid-js"
import { createSimpleContext } from "./helper"
import { useProject } from "./project"
import { useRoute } from "./route"
import { useSync } from "./sync"
import { isDefaultTitle } from "../util/session"
import type { Session } from "@slopcode-ai/sdk/v2"
import type { PromptInfo } from "../prompt/history"
import {
  DRAFT_TAB_ID,
  activateSessionTab,
  adjacentSessionTab,
  closeSessionTab,
  openDraftTab,
  promoteDraftTab,
  refreshSessionTabs,
  replaceSessionTab,
  sessionFamilyIndex,
  sessionFamilyStatus,
  sessionTabStatus,
  visitSessionTab,
  type SessionTabDescriptor,
  type SessionTabsState,
} from "./session-tabs-state"

export const { use: useSessionTabs, provider: SessionTabsProvider } = createSimpleContext({
  name: "SessionTabs",
  init: () => {
    const route = useRoute()
    const sync = useSync()
    const project = useProject()
    const [state, setState] = createSignal<SessionTabsState>({ tabs: [] })
    const scope = crypto.randomUUID()
    const [draft, setDraft] = createSignal(crypto.randomUUID().toString())
    const [revision, setRevision] = createSignal(0)
    const roots = new Map<string, string>()
    const owners = new Map<
      string,
      {
        prompt?: { prompt: PromptInfo; cursor: number }
        provisional?: { directory: string; workspace?: string; session?: Session; move: boolean }
      }
    >()
    const families = createMemo(() => sessionFamilyIndex(sync.data.session))

    function update(
      owner: string,
      key: "prompt" | "provisional",
      value:
        | { prompt: PromptInfo; cursor: number }
        | { directory: string; workspace?: string; session?: Session; move: boolean }
        | undefined,
    ) {
      const current = owners.get(owner) ?? {}
      const next = { ...current, [key]: value }
      owners.delete(owner)
      if (next.prompt || next.provisional) owners.set(owner, next)
      while (owners.size > 32) owners.delete(owners.keys().next().value!)
    }

    function clear(owner: string) {
      owners.delete(owner)
    }

    function valid(owner: string) {
      if (owner === draft()) return true
      const prefix = `${scope}:`
      if (!owner.startsWith(prefix)) return false
      const id = owner.slice(prefix.length)
      return (
        state().tabs.some((tab) => tab.type === "session" && tab.id === id) ||
        (route.data.type === "session" && route.data.sessionID === id)
      )
    }

    createEffect(() => {
      const sessions = sync.data.session
        .filter((item) => item.parentID === undefined)
        .map((item) => ({
          id: item.id,
          title: item.title,
          workspaceID: item.workspaceID,
        }))
      setState((current) => refreshSessionTabs(current, sessions))
    })

    createEffect(() => {
      const current = route.data
      if (current.type === "home") {
        if (state().tabs.some((tab) => tab.type === "draft"))
          setState((value) => activateSessionTab(value, DRAFT_TAB_ID))
        return
      }
      if (current.type !== "session") return
      const index = families()
      const resolved = index.roots.get(current.sessionID) ?? current.sessionID
      if (sync.session.get(current.sessionID)) roots.set(current.sessionID, resolved)
      const id = roots.get(current.sessionID) ?? resolved
      const info = sync.session.get(id)
      const status = sessionFamilyStatus(index.families.get(id) ?? [], sync.data.session_status)
      const descriptor = {
        id,
        ...(info ? { title: info.title, workspaceID: info.workspaceID } : {}),
        ...(status ? { status } : {}),
      }
      setState((value) => visitSessionTab(replaceSessionTab(value, current.sessionID, descriptor), descriptor))
    })

    function activity(id: string, index: ReturnType<typeof sessionFamilyIndex>): SessionTabDescriptor {
      const family = index.families.get(id)
      const members = family ?? [{ id }]
      const authoritative = family !== undefined && sync.status === "complete"
      const status = sessionFamilyStatus(members, sync.data.session_status)
      const known = members.some(
        (item) => Object.hasOwn(sync.data.permission, item.id) || Object.hasOwn(sync.data.question, item.id),
      )
      const waiting = members.some(
        (item) => (sync.data.permission[item.id]?.length ?? 0) > 0 || (sync.data.question[item.id]?.length ?? 0) > 0,
      )
      return {
        id,
        ...(status ? { status } : authoritative ? { status: "idle" as const } : {}),
        ...(known || authoritative ? { waiting } : {}),
      }
    }

    createEffect(() => {
      const index = families()
      const updates = state().tabs.flatMap((tab) => (tab.type === "session" ? [activity(tab.id, index)] : []))
      setState((current) => refreshSessionTabs(current, updates))
    })

    const tabs = createMemo(() => {
      const index = families()
      return state().tabs.map((tab) => {
        if (tab.type === "draft") {
          return { id: tab.id, title: "New Session", status: sessionTabStatus({ draft: true, known: false }) }
        }

        const info = sync.session.get(tab.id)
        const title = info?.title ?? tab.title
        const pending = tab.pendingTitle && (!title || isDefaultTitle(title))
        const workspace = tab.workspaceID ? project.workspace.status(tab.workspaceID) : undefined
        const current = activity(tab.id, index)
        return {
          id: tab.id,
          title: pending ? "New Session" : (title ?? tab.id),
          status: sessionTabStatus({
            pending,
            waiting: current.waiting ?? tab.waiting,
            status: current.status ?? tab.status,
            fallback: info ? sync.session.status(tab.id) : undefined,
            known: info !== undefined,
            connected:
              workspace === "connected"
                ? true
                : workspace === "disconnected" || workspace === "error"
                  ? false
                  : undefined,
          }),
        }
      })
    })
    const ids = createMemo(() => state().tabs.map((tab) => tab.id))
    const active = createMemo(() => state().active)

    function open(id: string) {
      if (!state().tabs.some((tab) => tab.id === id)) return
      setState((value) => activateSessionTab(value, id))
      if (id === DRAFT_TAB_ID) {
        route.navigate({ type: "home" })
        return
      }
      route.navigate({ type: "session", sessionID: id })
    }

    function close(id: string) {
      const current = state()
      const next = closeSessionTab(current, id)
      if (next === current) return
      if (id === DRAFT_TAB_ID) {
        clear(draft())
        setDraft(crypto.randomUUID())
      } else {
        clear(`${scope}:${id}`)
      }
      setState(next)
      if (current.active !== id) return
      if (!next.active || next.active === DRAFT_TAB_ID) {
        route.navigate({ type: "home" })
        return
      }
      route.navigate({ type: "session", sessionID: next.active })
    }

    function move(offset: 1 | -1) {
      const id = adjacentSessionTab(ids(), active(), offset)
      if (!id) return false
      open(id)
      return true
    }

    return {
      tabs,
      ids,
      active,
      scope,
      draft,
      owner(sessionID?: string) {
        return sessionID ? `${scope}:${sessionID}` : draft()
      },
      prompt: {
        revision,
        take(owner: string) {
          const saved = owners.get(owner)?.prompt
          update(owner, "prompt", undefined)
          return saved
        },
        save(owner: string, value: { prompt: PromptInfo; cursor: number }) {
          if (!valid(owner)) return false
          update(owner, "prompt", value)
          setRevision((value) => value + 1)
          return true
        },
        clear(owner: string) {
          update(owner, "prompt", undefined)
        },
      },
      provisional: {
        get(owner: string) {
          return owners.get(owner)?.provisional
        },
        save(owner: string, value: { directory: string; workspace?: string; session?: Session; move: boolean }) {
          if (owner !== draft()) return false
          update(owner, "provisional", value)
          return true
        },
      },
      visible: createMemo(() => tabs().length > 0),
      switchable: createMemo(() => ids().length > 1),
      open,
      close,
      previous() {
        return move(-1)
      },
      next() {
        return move(1)
      },
      openDraft() {
        clear(draft())
        setDraft(crypto.randomUUID())
        setState((value) => openDraftTab(value))
        route.navigate({ type: "home" })
      },
      promoteDraft(input: SessionTabDescriptor, owner = draft()) {
        if (owner !== draft()) return false
        setState((value) => promoteDraftTab(value, input))
        clear(owner)
        return true
      },
    }
  },
})
