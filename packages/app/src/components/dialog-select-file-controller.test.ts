import { describe, expect, test } from "bun:test"
import type { CommandOption } from "@/context/command"
import type { ServerConnection } from "@/context/server"
import type { Tab } from "@/context/tabs"
import {
  commandPaletteEntries,
  createServerSessionSearch,
  searchPaletteEntries,
  selectPaletteSession,
  type PaletteEntry,
} from "./dialog-select-file-controller"

const server = "https://server.example.test" as ServerConnection.Key

describe("command palette search", () => {
  test("searches visible commands, workspace files, and server sessions", async () => {
    const commands = commandPaletteEntries(
      [
        { id: "session.new", title: "New session", description: "Start work" },
        { id: "terminal.toggle", title: "Toggle terminal" },
        { id: "hidden", title: "Hidden session", hidden: true },
      ] satisfies CommandOption[],
      "Commands",
    )
    const calls: string[] = []
    const sessions: PaletteEntry[] = [
      {
        id: `session:${server}:ses_1`,
        type: "session",
        title: "Session search result",
        category: "Sessions",
        server,
        directory: "/workspace/two",
        sessionID: "ses_1",
      },
    ]

    const result = await searchPaletteEntries({
      query: "session",
      commands,
      searchFiles: async (query) => {
        calls.push(`file:${query}`)
        return ["src/session.ts"]
      },
      searchSessions: async (query) => {
        calls.push(`session:${query}`)
        return sessions
      },
      fileCategory: "Files",
    })

    expect(calls).toEqual(["file:session", "session:session"])
    expect(result.map((entry) => entry.type)).toEqual(["command", "session", "file"])
    expect(result.map((entry) => entry.title)).toEqual(["New session", "Session search result", "src/session.ts"])
  })

  test("uses the server search API and labels sessions from opened and stored projects", async () => {
    const calls: Array<{ search: string; aborted: boolean }> = []
    const search = createServerSessionSearch({
      server,
      opened: () => [{ id: "project-open", name: "Opened", worktree: "/workspace/open" }],
      stored: () => [{ id: "project-stored", name: "Stored", worktree: "/workspace/stored" }],
      load: async (query, signal) => {
        calls.push({ search: query, aborted: signal.aborted })
        return [
          {
            id: "ses_open",
            projectID: "project-open",
            directory: "/workspace/open",
            title: "Open project",
            time: { updated: 4 },
          },
          {
            id: "ses_stored",
            projectID: "project-stored",
            directory: "/workspace/stored",
            title: "Stored project",
            time: { updated: 3 },
          },
          {
            id: "ses_child",
            projectID: "project-open",
            directory: "/workspace/open",
            parentID: "ses_open",
          },
          {
            id: "ses_archived",
            projectID: "project-stored",
            directory: "/workspace/stored",
            time: { archived: 2 },
          },
        ]
      },
      untitled: () => "Untitled",
      category: () => "Sessions",
    })

    const result = await search.search("  project  ")

    expect(calls).toEqual([{ search: "project", aborted: false }])
    expect(result.map((entry) => [entry.title, entry.description])).toEqual([
      ["Open project", "Opened"],
      ["Stored project", "Stored"],
    ])
    expect(result.every((entry) => entry.server === server)).toBe(true)
  })
})

describe("command palette session selection", () => {
  test("opens the server project and focuses one canonical session tab without duplicates", () => {
    const store: Tab[] = []
    const opened: string[] = []
    const touched: string[] = []
    const navigated: string[] = []
    const entry: PaletteEntry = {
      id: `session:${server}:ses_remote`,
      type: "session",
      title: "Remote session",
      category: "Sessions",
      server,
      directory: "/workspace/repo/sandbox",
      sessionID: "ses_remote",
      project: { id: "project", worktree: "/workspace/repo" },
    }
    const tabs = {
      store,
      addSessionTab(tab: Omit<Extract<Tab, { type: "session" }>, "type">) {
        store.push({ type: "session", ...tab })
      },
    }
    const projects = {
      open: (directory: string) => opened.push(directory),
      touch: (directory: string) => touched.push(directory),
    }
    const navigate = (href: string) => {
      navigated.push(href)
    }

    const selected = selectPaletteSession({ entry, tabs, projects, navigate })
    selectPaletteSession({ entry, tabs, projects, navigate })

    expect(store).toHaveLength(1)
    expect(selected).toMatchObject({ server, sessionId: "ses_remote" })
    expect(opened).toEqual(["/workspace/repo", "/workspace/repo"])
    expect(touched).toEqual(["/workspace/repo", "/workspace/repo"])
    expect(navigated).toHaveLength(2)
    expect(navigated[0]).toContain("/server/")
    expect(navigated[0]).toEndWith("/session/ses_remote")
  })
})
