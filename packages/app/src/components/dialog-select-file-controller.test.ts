import { describe, expect, test } from "bun:test"
import { base64Encode } from "@slopcode-ai/core/util/encode"
import type { CommandOption } from "@/context/command"
import type { ServerConnection } from "@/context/server"
import type { Tab } from "@/context/tabs"
import { homeProjectNavigation } from "@/pages/layout/helpers"
import {
  commandPaletteEntries,
  createServerFileSearch,
  createServerSessionSearch,
  filePaletteEntries,
  searchPaletteEntries,
  selectPaletteFile,
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

  test("fans file search across unique server projects with scoped duplicate paths", async () => {
    const calls: Array<{ directory: string; query: string; limit: number; aborted: boolean }> = []
    const opened = { id: "project-one", name: "One", worktree: "/workspace/one" }
    const stored = { id: "project-two", name: "Two", worktree: "/workspace/two" }
    const search = createServerFileSearch({
      server,
      opened: () => [opened],
      stored: () => [{ ...opened }, stored],
      limit: 3,
      load: async (directory, query, limit, signal) => {
        calls.push({ directory, query, limit, aborted: signal.aborted })
        return ["src/index.ts", "src/index.ts", "src/other.ts", "src/overflow.ts"]
      },
      category: () => "Files",
    })

    const result = await search.search("  index  ")

    expect(calls).toEqual([
      { directory: "/workspace/one", query: "index", limit: 3, aborted: false },
      { directory: "/workspace/two", query: "index", limit: 3, aborted: false },
    ])
    expect(result).toHaveLength(4)
    expect(new Set(result.map((entry) => entry.id)).size).toBe(4)
    expect(result.map((entry) => [entry.path, entry.directory, entry.description])).toEqual([
      ["src/index.ts", "/workspace/one", "One"],
      ["src/other.ts", "/workspace/one", "One"],
      ["src/index.ts", "/workspace/two", "Two"],
      ["src/other.ts", "/workspace/two", "Two"],
    ])
    expect(result.some((entry) => entry.path === "src/overflow.ts")).toBe(false)
    expect(result.every((entry) => entry.server === server)).toBe(true)
  })

  test("keeps successful project files when another project fails", async () => {
    const search = createServerFileSearch({
      server,
      opened: () => [
        { name: "Working", worktree: "/workspace/working" },
        { name: "Broken", worktree: "/workspace/broken" },
      ],
      stored: () => [],
      load: async (directory) => {
        if (directory.endsWith("broken")) throw new Error("offline")
        return ["src/working.ts"]
      },
      category: () => "Files",
    })

    expect(await search.search("working")).toMatchObject([
      { type: "file", path: "src/working.ts", directory: "/workspace/working" },
    ])
  })

  test("cancels stale server file searches and preserves total failure", async () => {
    const signals: AbortSignal[] = []
    const search = createServerFileSearch({
      server,
      opened: () => [{ worktree: "/workspace/one" }],
      stored: () => [],
      load: async (_directory, query, _limit, signal) => {
        signals.push(signal)
        if (query === "broken") throw new Error("offline")
        if (query === "next") return ["src/next.ts"]
        return new Promise<string[]>((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }),
        )
      },
      category: () => "Files",
    })

    const stale = search.search("stale")
    const next = search.search("next")

    expect(await stale).toEqual([])
    expect(signals[0]?.aborted).toBe(true)
    expect((await next).map((entry) => entry.path)).toEqual(["src/next.ts"])
    expect(search.search("broken")).rejects.toThrow("offline")
  })

  test("keeps active-session file IDs unchanged without project scope", () => {
    expect(filePaletteEntries(["src/index.ts"], "Files")).toEqual([
      { id: "file:src/index.ts", type: "file", title: "src/index.ts", category: "Files", path: "src/index.ts" },
    ])
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

  test("routes a Home file to its owning project new-session context", () => {
    const opened: string[] = []
    const touched: string[] = []
    const activated: ServerConnection.Key[] = []
    const navigated: string[] = []
    const entry: PaletteEntry = {
      id: "file:scoped",
      type: "file",
      title: "src/index.ts",
      category: "Files",
      path: "src/index.ts",
      server,
      directory: "/workspace/repo",
      project: { id: "project", worktree: "/workspace/repo" },
    }

    const selected = selectPaletteFile({
      entry,
      projects: {
        open: (directory) => opened.push(directory),
        touch: (directory) => touched.push(directory),
      },
      activate: (key) => activated.push(key),
      navigate: (href) => {
        navigated.push(href)
      },
    })

    expect(opened).toEqual(["/workspace/repo"])
    expect(touched).toEqual(["/workspace/repo"])
    expect(activated).toEqual([server])
    expect(navigated).toHaveLength(1)
    expect(navigated[0]).toEndWith("/session")
    expect(selected).toMatchObject({ path: "src/index.ts", directory: "/workspace/repo", opened: false })
  })

  test("defers a cross-server Home file route until the target server is active", () => {
    const opened: string[] = []
    const touched: string[] = []
    const activated: ServerConnection.Key[] = []
    const navigated: string[] = []
    const deferred: Array<{ server: ServerConnection.Key; href: string }> = []
    const remote = "https://remote.example.test" as ServerConnection.Key
    const entry: PaletteEntry = {
      id: "file:remote",
      type: "file",
      title: "src/remote.ts",
      category: "Files",
      path: "src/remote.ts",
      server: remote,
      directory: "/workspace/remote",
      project: { id: "remote-project", worktree: "/workspace/remote" },
    }

    selectPaletteFile({
      entry,
      projects: {
        open: (directory) => opened.push(directory),
        touch: (directory) => touched.push(directory),
      },
      activate: (key) => activated.push(key),
      navigate: (href) => {
        navigated.push(href)
      },
      navigateOnServer: (target, href) => {
        const next = homeProjectNavigation(server, target, href)
        if (next.server) deferred.push(next)
        else navigated.push(next.href)
      },
    })

    expect(opened).toEqual(["/workspace/remote"])
    expect(touched).toEqual(["/workspace/remote"])
    expect(activated).toEqual([])
    expect(navigated).toEqual([])
    expect(deferred).toEqual([
      {
        server: remote,
        href: `/${base64Encode("/workspace/remote")}/session`,
      },
    ])
  })
})
