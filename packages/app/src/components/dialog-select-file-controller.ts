import { base64Encode } from "@slopcode-ai/core/util/encode"
import { getFilename } from "@slopcode-ai/core/util/path"
import type { CommandOption } from "@/context/command"
import type { ServerConnection } from "@/context/server"
import type { SessionTab, Tab } from "@/context/tabs"
import { tabHref } from "@/context/tab-route"
import { displayName } from "@/pages/layout/helpers"
import { pathKey } from "@/utils/path-key"

export type PaletteProject = {
  id?: string
  name?: string
  worktree: string
  sandboxes?: string[]
}

export type PaletteSession = {
  id: string
  projectID: string
  directory: string
  parentID?: string
  title?: string
  time?: {
    archived?: number
    updated?: number
  }
}

export type PaletteEntry = {
  id: string
  type: "command" | "file" | "session"
  title: string
  description?: string
  keybind?: string
  category: string
  option?: CommandOption
  path?: string
  directory?: string
  sessionID?: string
  server?: ServerConnection.Key
  project?: PaletteProject
  archived?: number
  updated?: number
}

export function uniquePaletteEntries(items: PaletteEntry[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

export function commandPaletteEntries(options: CommandOption[], category: string) {
  return options
    .filter(
      (option) =>
        !option.disabled &&
        !option.hidden &&
        !option.id.startsWith("suggested.") &&
        option.id !== "file.open" &&
        option.id !== "command.palette",
    )
    .map(
      (option): PaletteEntry => ({
        id: "command:" + option.id,
        type: "command",
        title: option.title,
        description: option.description,
        keybind: option.keybind,
        category,
        option,
      }),
    )
}

export function filePaletteEntries(paths: string[], category: string) {
  return paths.map(
    (path): PaletteEntry => ({
      id: "file:" + path,
      type: "file",
      title: path,
      category,
      path,
    }),
  )
}

function projectForSession(session: PaletteSession, projects: PaletteProject[]) {
  const direct = projects.find((project) => project.id === session.projectID)
  if (direct) return direct
  const directory = pathKey(session.directory)
  return projects.find(
    (project) =>
      pathKey(project.worktree) === directory || project.sandboxes?.some((sandbox) => pathKey(sandbox) === directory),
  )
}

export function createServerSessionSearch(input: {
  server: ServerConnection.Key
  opened: () => PaletteProject[]
  stored: () => PaletteProject[]
  load: (search: string, signal: AbortSignal) => Promise<PaletteSession[]>
  untitled: () => string
  category: () => string
}) {
  let active: AbortController | undefined

  return {
    cancel() {
      active?.abort()
    },
    async search(text: string) {
      const query = text.trim()
      active?.abort()
      if (!query) return [] as PaletteEntry[]

      const current = new AbortController()
      active = current
      const opened = input.opened()
      const key = (project: PaletteProject) => project.id ?? pathKey(project.worktree)
      const keys = new Set(opened.map(key))
      const projects = [...opened, ...input.stored().filter((project) => !keys.has(key(project)))]
      const sessions = await input.load(query, current.signal).catch((error) => {
        if (current.signal.aborted) return []
        throw error
      })
      if (current.signal.aborted) return [] as PaletteEntry[]

      return sessions
        .filter((session) => !session.parentID && !session.time?.archived)
        .map((session): PaletteEntry => {
          const project = projectForSession(session, projects)
          return {
            id: `session:${input.server}:${session.id}`,
            type: "session",
            title: session.title || input.untitled(),
            description: project ? displayName(project) : getFilename(session.directory),
            category: input.category(),
            directory: session.directory,
            sessionID: session.id,
            server: input.server,
            project,
            updated: session.time?.updated,
          }
        })
    },
  }
}

export async function searchPaletteEntries(input: {
  query: string
  commands: PaletteEntry[]
  searchFiles: (query: string) => Promise<string[]>
  searchSessions: (query: string) => Promise<PaletteEntry[]>
  fileCategory: string
}) {
  const query = input.query.trim()
  if (!query) return [] as PaletteEntry[]
  const [files, sessions] = await Promise.all([input.searchFiles(query), input.searchSessions(query)])
  const value = query.toLowerCase()
  const commands = input.commands.filter((entry) =>
    [entry.title, entry.description, entry.category].some((text) => text?.toLowerCase().includes(value)),
  )
  return [...commands, ...sessions, ...filePaletteEntries(files, input.fileCategory)]
}

export function selectPaletteSession(input: {
  entry: PaletteEntry
  tabs: {
    store: Tab[]
    addSessionTab: (tab: Omit<SessionTab, "type">) => void
  }
  projects: {
    open: (directory: string) => void
    touch: (directory: string) => void
  }
  navigate: (href: string) => void | Promise<void>
}) {
  const entry = input.entry
  if (entry.type !== "session" || !entry.server || !entry.directory || !entry.sessionID) return

  const directory = entry.project?.worktree ?? entry.directory
  input.projects.open(directory)
  input.projects.touch(directory)

  const tab: SessionTab = {
    type: "session",
    server: entry.server,
    dirBase64: base64Encode(entry.directory),
    sessionId: entry.sessionID,
  }
  if (
    !input.tabs.store.some(
      (item) =>
        item.type === "session" &&
        item.server === tab.server &&
        item.dirBase64 === tab.dirBase64 &&
        item.sessionId === tab.sessionId,
    )
  ) {
    input.tabs.addSessionTab(tab)
  }
  void input.navigate(tabHref(tab))
  return tab
}
