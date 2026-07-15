export const DRAFT_TAB_ID = "__draft__"

export type SessionTabStatus = "working" | "retrying" | "waiting" | "ready" | "idle" | "disconnected" | "unknown"
export type SessionStatusType = "idle" | "busy" | "retry"

export type SessionTabDescriptor = {
  id: string
  title?: string
  workspaceID?: string
  status?: SessionStatusType
}

export type SessionTab =
  | ({ type: "session"; pendingTitle?: boolean } & SessionTabDescriptor)
  | { type: "draft"; id: typeof DRAFT_TAB_ID }

export type SessionTabsState = {
  tabs: SessionTab[]
  active?: string
}

type SessionFamilyMember = {
  id: string
  parentID?: string
}

function session(input: SessionTabDescriptor, pendingTitle?: boolean): Extract<SessionTab, { type: "session" }> {
  return {
    type: "session",
    id: input.id,
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.workspaceID === undefined ? {} : { workspaceID: input.workspaceID }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(pendingTitle ? { pendingTitle: true } : {}),
  }
}

function merge(
  tab: Extract<SessionTab, { type: "session" }>,
  input: SessionTabDescriptor,
  pendingTitle = tab.pendingTitle,
) {
  return session(
    {
      id: input.id,
      title: input.title ?? tab.title,
      workspaceID: input.workspaceID ?? tab.workspaceID,
      status: input.status ?? tab.status,
    },
    pendingTitle,
  )
}

export function sessionFamilyIndex(sessions: SessionFamilyMember[]) {
  const byID = new Map(sessions.map((item) => [item.id, item]))
  const roots = new Map<string, string>()

  function resolve(id: string) {
    const cached = roots.get(id)
    if (cached) return cached
    const path: string[] = []
    const seen = new Set<string>()
    let current = id
    let root = id

    while (true) {
      const known = roots.get(current)
      if (known) {
        root = known
        break
      }
      if (seen.has(current)) {
        root = current
        break
      }
      seen.add(current)
      path.push(current)
      const parent = byID.get(current)?.parentID
      if (!parent) {
        root = current
        break
      }
      current = parent
    }

    path.forEach((item) => roots.set(item, root))
    return root
  }

  sessions.forEach((item) => resolve(item.id))
  const families = new Map<string, SessionFamilyMember[]>()
  sessions.forEach((item) => {
    const root = roots.get(item.id) ?? item.id
    const family = families.get(root)
    if (family) {
      family.push(item)
      return
    }
    families.set(root, [item])
  })
  return { roots, families }
}

export function sessionRoot(id: string, sessions: SessionFamilyMember[]) {
  return sessionFamilyIndex(sessions).roots.get(id) ?? id
}

export function sessionFamilyStatus(
  family: SessionFamilyMember[],
  statuses: Record<string, { type: SessionStatusType } | undefined>,
) {
  const values = family.map((item) => statuses[item.id]?.type)
  if (values.includes("retry")) return "retry" as const
  if (values.includes("busy")) return "busy" as const
  if (values.includes("idle")) return "idle" as const
  return undefined
}

export function activateSessionTab(state: SessionTabsState, id: string): SessionTabsState {
  if (state.active === id) return state
  return { tabs: state.tabs, active: id }
}

export function adjacentSessionTab(ids: string[], active: string | undefined, offset: 1 | -1) {
  if (ids.length < 2) return undefined
  const index = active ? ids.indexOf(active) : -1
  if (index === -1) return ids[0]
  return ids[(index + offset + ids.length) % ids.length]
}

export function openDraftTab(state: SessionTabsState): SessionTabsState {
  if (state.tabs.some((tab) => tab.type === "draft")) return activateSessionTab(state, DRAFT_TAB_ID)
  return {
    tabs: [...state.tabs, { type: "draft", id: DRAFT_TAB_ID }],
    active: DRAFT_TAB_ID,
  }
}

export function promoteDraftTab(state: SessionTabsState, input: SessionTabDescriptor): SessionTabsState {
  const existing = state.tabs.findIndex((tab) => tab.type === "session" && tab.id === input.id)
  if (existing !== -1) {
    return {
      tabs: state.tabs
        .filter((tab) => tab.type !== "draft")
        .map((tab) => (tab.id === input.id && tab.type === "session" ? merge(tab, input, true) : tab)),
      active: input.id,
    }
  }

  const index = state.tabs.findIndex((tab) => tab.type === "draft")
  if (index === -1) {
    return {
      tabs: [...state.tabs, session(input, true)],
      active: input.id,
    }
  }

  const tabs = state.tabs.slice()
  tabs[index] = session(input, true)
  return { tabs, active: input.id }
}

export function visitSessionTab(state: SessionTabsState, input: SessionTabDescriptor): SessionTabsState {
  const index = state.tabs.findIndex((tab) => tab.type === "session" && tab.id === input.id)
  if (index === -1) {
    return {
      tabs: [...state.tabs, session(input)],
      active: input.id,
    }
  }

  return {
    tabs: state.tabs.map((tab, current) => {
      if (current !== index || tab.type !== "session") return tab
      return merge(tab, input)
    }),
    active: input.id,
  }
}

export function replaceSessionTab(
  state: SessionTabsState,
  from: string,
  input: SessionTabDescriptor,
): SessionTabsState {
  if (from === input.id) return state
  const index = state.tabs.findIndex((tab) => tab.type === "session" && tab.id === from)
  if (index === -1) return state
  const existing = state.tabs.findIndex((tab) => tab.type === "session" && tab.id === input.id)
  if (existing !== -1) {
    return {
      tabs: state.tabs
        .filter((_, current) => current !== index)
        .map((tab) => (tab.id === input.id && tab.type === "session" ? merge(tab, input) : tab)),
      active: state.active === from ? input.id : state.active,
    }
  }

  const tabs = state.tabs.slice()
  const previous = tabs[index]
  tabs[index] = previous?.type === "session" ? merge(previous, input) : session(input)
  return {
    tabs,
    active: state.active === from ? input.id : state.active,
  }
}

export function closeSessionTab(state: SessionTabsState, id: string): SessionTabsState {
  const index = state.tabs.findIndex((tab) => tab.id === id)
  if (index === -1) return state
  const tabs = state.tabs.filter((tab) => tab.id !== id)
  if (state.active !== id && state.active && tabs.some((tab) => tab.id === state.active)) {
    return { tabs, active: state.active }
  }
  return {
    tabs,
    active: tabs[index]?.id ?? tabs[index - 1]?.id,
  }
}

export function refreshSessionTabs(state: SessionTabsState, sessions: SessionTabDescriptor[]): SessionTabsState {
  const index = new Map(sessions.map((item) => [item.id, item]))
  const tabs = state.tabs.map((tab) => {
    if (tab.type === "draft") return tab
    const item = index.get(tab.id)
    if (!item) return tab
    return merge(tab, item)
  })
  return { tabs, active: state.active }
}

export function sessionTabStatus(input: {
  draft?: boolean
  pending?: boolean
  waiting?: boolean
  status?: "idle" | "busy" | "retry"
  fallback?: "idle" | "working" | "compacting"
  known: boolean
  connected?: boolean
}): SessionTabStatus {
  if (input.waiting) return "waiting"
  if (input.connected === false) return "disconnected"
  if (input.status === "retry") return "retrying"
  if (input.status === "busy" || input.fallback === "working" || input.fallback === "compacting") return "working"
  if (input.draft || input.pending) return "ready"
  if (input.status === "idle" || input.fallback === "idle" || input.known) return "idle"
  return "unknown"
}
