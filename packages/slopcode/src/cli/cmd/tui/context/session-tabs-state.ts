import type { SessionRouteSource } from "./route"

export const DRAFT_TAB_ID = "__draft__"

export type SessionTab =
  | {
      type: "session"
      id: string
      pendingTitle?: boolean
      workspaceID?: string
    }
  | {
      type: "draft"
      id: typeof DRAFT_TAB_ID
    }

export type SessionTabsState = {
  tabs: SessionTab[]
  active?: string
}

type PendingMap = Record<string, unknown[] | undefined>
type SessionFamilyMember = {
  id: string
  parentID?: string
}

const isDraft = (tab: SessionTab): tab is Extract<SessionTab, { type: "draft" }> => tab.type === "draft"
const isSession = (tab: SessionTab): tab is Extract<SessionTab, { type: "session" }> => tab.type === "session"

const root = (id: string, sessions: SessionFamilyMember[]) => {
  const by = new Map(sessions.map((session) => [session.id, session]))
  const seen = new Set<string>()
  let current = id
  while (!seen.has(current)) {
    seen.add(current)
    const parent = by.get(current)?.parentID
    if (!parent) return current
    current = parent
  }
  return current
}

export function sessionWaiting(input: {
  sessionID?: string
  sessions: SessionFamilyMember[]
  permission: PendingMap
  question: PendingMap
}) {
  if (!input.sessionID) return false
  const root = input.sessions.find((session) => session.id === input.sessionID)?.parentID ?? input.sessionID
  return Array.from(
    new Set(
      input.sessions
        .filter((session) => session.id === root || session.parentID === root)
        .map((session) => session.id)
        .concat(root),
    ),
  ).some((id) => (input.permission[id]?.length ?? 0) > 0 || (input.question[id]?.length ?? 0) > 0)
}

export function tabStatus(input: {
  draft?: boolean
  pending?: boolean
  waiting?: boolean
  working: boolean
  count: number
}) {
  if (input.working) return "working" as const
  if (input.waiting || input.draft) return "waiting" as const
  if (input.pending) return "ready" as const
  if (input.count > 0) return "done" as const
  return "none" as const
}

export function activateTab(state: SessionTabsState, id: string): SessionTabsState {
  if (state.active === id) return state
  return {
    tabs: state.tabs,
    active: id,
  }
}

export function adjacentTab(ids: string[], active: string | undefined, offset: 1 | -1) {
  if (ids.length < 2) return
  const index = active ? ids.indexOf(active) : -1
  if (index === -1) return ids[0]
  return ids[(index + offset + ids.length) % ids.length]
}

export function sessionStripVisible(input: { home: boolean; draft: boolean; count: number }) {
  if (input.home) return input.draft
  return input.count > 0
}

export function sessionTabsSwitchable(ids: string[]) {
  return ids.length > 1
}

export function hasDraftTab(state: SessionTabsState) {
  return state.tabs.some(isDraft)
}

export function openDraftTab(state: SessionTabsState): SessionTabsState {
  if (hasDraftTab(state)) return activateTab(state, DRAFT_TAB_ID)
  return {
    tabs: [...state.tabs, { type: "draft", id: DRAFT_TAB_ID }],
    active: DRAFT_TAB_ID,
  }
}

export function promoteDraftTab(
  state: SessionTabsState,
  input: {
    sessionID: string
    workspaceID?: string
  },
): SessionTabsState {
  const existing = state.tabs.findIndex((tab) => isSession(tab) && tab.id === input.sessionID)
  if (existing !== -1) {
    return {
      tabs: state.tabs
        .filter((tab) => !isDraft(tab))
        .map((tab) =>
          isSession(tab) && tab.id === input.sessionID
            ? { ...tab, pendingTitle: true, workspaceID: input.workspaceID }
            : tab,
        ),
      active: input.sessionID,
    }
  }

  const index = state.tabs.findIndex(isDraft)
  if (index === -1) {
    return {
      tabs: [
        ...state.tabs,
        { type: "session", id: input.sessionID, pendingTitle: true, workspaceID: input.workspaceID },
      ],
      active: input.sessionID,
    }
  }

  const tabs = state.tabs.slice()
  tabs[index] = { type: "session", id: input.sessionID, pendingTitle: true, workspaceID: input.workspaceID }
  return {
    tabs,
    active: input.sessionID,
  }
}

export function visitSessionTabs(
  state: SessionTabsState,
  input: {
    sessionID: string
    source?: SessionRouteSource
    root?: boolean
    workspaceID?: string
  },
): SessionTabsState {
  const pendingTitle = input.source === "new"
  if (state.tabs.some((tab) => isSession(tab) && tab.id === input.sessionID)) {
    return {
      tabs: state.tabs.map((tab) => {
        if (!isSession(tab) || tab.id !== input.sessionID) return tab
        return {
          ...tab,
          pendingTitle: pendingTitle || tab.pendingTitle,
          workspaceID: input.workspaceID ?? tab.workspaceID,
        }
      }),
      active: input.sessionID,
    }
  }
  return {
    tabs: [
      ...state.tabs,
      pendingTitle
        ? { type: "session", id: input.sessionID, pendingTitle: true, workspaceID: input.workspaceID }
        : { type: "session", id: input.sessionID, workspaceID: input.workspaceID },
    ],
    active: input.sessionID,
  }
}

export function closeSessionTab(state: SessionTabsState, id: string): SessionTabsState {
  const index = state.tabs.findIndex((tab) => tab.id === id)
  if (index === -1) return state
  const tabs = state.tabs.filter((tab) => tab.id !== id)
  if (state.active && state.active !== id && tabs.some((tab) => tab.id === state.active)) {
    return {
      tabs,
      active: state.active,
    }
  }
  return {
    tabs,
    active: tabs[index]?.id ?? tabs[index - 1]?.id,
  }
}

export function shouldArchiveSessionTab(input: {
  state: SessionTabsState
  sessionID: string
  sessions: SessionFamilyMember[]
}) {
  const family = root(input.sessionID, input.sessions)
  return !input.state.tabs.some(
    (tab) => isSession(tab) && tab.id !== input.sessionID && root(tab.id, input.sessions) === family,
  )
}

export function pruneSessionTabs(state: SessionTabsState, keep: Set<string>): SessionTabsState {
  const tabs = state.tabs.filter((tab) => isDraft(tab) || keep.has(tab.id))
  if (tabs.length === state.tabs.length) return state
  if (state.active && tabs.some((tab) => tab.id === state.active)) {
    return {
      tabs,
      active: state.active,
    }
  }
  return {
    tabs,
    active: tabs.at(-1)?.id,
  }
}
