import { createEffect, createMemo, createSignal } from "solid-js"
import { createSimpleContext } from "./helper"
import { useProject } from "./project"
import { useRoute } from "./route"
import { useSync } from "./sync"
import { isDefaultTitle } from "../util/session"
import {
  DRAFT_TAB_ID,
  activateSessionTab,
  adjacentSessionTab,
  closeSessionTab,
  openDraftTab,
  promoteDraftTab,
  refreshSessionTabs,
  replaceSessionTab,
  sessionRoot,
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
    const roots = new Map<string, string>()

    createEffect(() => {
      const sessions = sync.data.session
        .filter((item) => item.parentID === undefined)
        .map((item) => ({ id: item.id, title: item.title, workspaceID: item.workspaceID }))
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
      const resolved = sessionRoot(current.sessionID, sync.data.session)
      if (sync.session.get(current.sessionID)) roots.set(current.sessionID, resolved)
      const id = roots.get(current.sessionID) ?? resolved
      const info = sync.session.get(id)
      const descriptor = {
        id,
        title: info?.title,
        workspaceID: info?.workspaceID,
      }
      setState((value) => visitSessionTab(replaceSessionTab(value, current.sessionID, descriptor), descriptor))
    })

    const tabs = createMemo(() =>
      state().tabs.map((tab) => {
        if (tab.type === "draft") {
          return { id: tab.id, title: "New Session", status: sessionTabStatus({ draft: true, known: false }) }
        }

        const info = sync.session.get(tab.id)
        const title = info?.title ?? tab.title
        const pending = tab.pendingTitle && (!title || isDefaultTitle(title))
        const workspace = tab.workspaceID ? project.workspace.status(tab.workspaceID) : undefined
        const family = sync.data.session.filter((item) => sessionRoot(item.id, sync.data.session) === tab.id)
        const waiting = family.some(
          (item) => (sync.data.permission[item.id]?.length ?? 0) > 0 || (sync.data.question[item.id]?.length ?? 0) > 0,
        )
        const statuses = family.map((item) => sync.data.session_status[item.id]?.type)
        const status = statuses.includes("retry") ? "retry" : statuses.includes("busy") ? "busy" : statuses[0]
        return {
          id: tab.id,
          title: pending ? "New Session" : (title ?? tab.id),
          status: sessionTabStatus({
            pending,
            waiting,
            status,
            fallback: info ? sync.session.status(tab.id) : undefined,
            known: info !== undefined || tab.title !== undefined,
            connected: workspace === undefined ? undefined : workspace === "connected",
          }),
        }
      }),
    )
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
        setState((value) => openDraftTab(value))
        route.navigate({ type: "home" })
      },
      promoteDraft(input: SessionTabDescriptor) {
        setState((value) => promoteDraftTab(value, input))
      },
    }
  },
})
