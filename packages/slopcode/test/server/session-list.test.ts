import { describe, expect, test } from "bun:test"
import { mkdir } from "fs/promises"
import path from "path"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

const projectRoot = path.join(__dirname, "../..")
Log.init({ print: false })

describe("Session.list", () => {
  test("filters by directory", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const first = await Session.create({})

        const otherDir = path.join(projectRoot, "..", "__session_list_other")
        const second = await Instance.provide({
          directory: otherDir,
          fn: async () => Session.create({}),
        })

        const sessions = [...Session.list({ directory: projectRoot })]
        const ids = sessions.map((s) => s.id)

        expect(ids).toContain(first.id)
        expect(ids).not.toContain(second.id)
      },
    })
  })

  test("filters root sessions", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const root = await Session.create({ title: "root-session" })
        const child = await Session.create({ title: "child-session", parentID: root.id })

        const sessions = [...Session.list({ roots: true })]
        const ids = sessions.map((s) => s.id)

        expect(ids).toContain(root.id)
        expect(ids).not.toContain(child.id)
      },
    })
  })

  test("filters by start time", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({ title: "new-session" })
        const futureStart = Date.now() + 86400000

        const sessions = [...Session.list({ start: futureStart })]
        expect(sessions.length).toBe(0)
      },
    })
  })

  test("filters by search term", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        await Session.create({ title: "unique-search-term-abc" })
        await Session.create({ title: "other-session-xyz" })

        const sessions = [...Session.list({ search: "unique-search" })]
        const titles = sessions.map((s) => s.title)

        expect(titles).toContain("unique-search-term-abc")
        expect(titles).not.toContain("other-session-xyz")
      },
    })
  })

  test("respects limit parameter", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        await Session.create({ title: "session-1" })
        await Session.create({ title: "session-2" })
        await Session.create({ title: "session-3" })

        const sessions = [...Session.list({ limit: 2 })]
        expect(sessions.length).toBe(2)
      },
    })
  })

  test("filters sessions by project-relative path", async () => {
    await using tmp = await tmpdir({ git: true })
    await mkdir(path.join(tmp.path, "packages", "slopcode", "src"), { recursive: true })
    await mkdir(path.join(tmp.path, "packages", "app"), { recursive: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const root = await Session.create({ title: "root-path" })
        const parent = await Instance.provide({
          directory: path.join(tmp.path, "packages", "slopcode"),
          fn: async () => Session.create({ title: "parent-path" }),
        })
        const current = await Instance.provide({
          directory: path.join(tmp.path, "packages", "slopcode", "src"),
          fn: async () => Session.create({ title: "current-path" }),
        })
        const sibling = await Instance.provide({
          directory: path.join(tmp.path, "packages", "app"),
          fn: async () => Session.create({ title: "sibling-path" }),
        })

        const ids = [
          ...Session.list({
            directory: path.join(tmp.path, "packages", "slopcode", "src"),
            path: "packages/slopcode",
          }),
        ].map((session) => session.id)

        expect(ids).toContain(parent.id)
        expect(ids).toContain(current.id)
        expect(ids).not.toContain(root.id)
        expect(ids).not.toContain(sibling.id)
      },
    })
  })

  test("lists all project sessions when scope is project", async () => {
    await using tmp = await tmpdir({ git: true })
    await mkdir(path.join(tmp.path, "packages", "slopcode"), { recursive: true })
    await mkdir(path.join(tmp.path, "packages", "app"), { recursive: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const root = await Session.create({ title: "root-project" })
        const current = await Instance.provide({
          directory: path.join(tmp.path, "packages", "slopcode"),
          fn: async () => Session.create({ title: "current-project" }),
        })
        const sibling = await Instance.provide({
          directory: path.join(tmp.path, "packages", "app"),
          fn: async () => Session.create({ title: "sibling-project" }),
        })

        const ids = [
          ...Session.list({
            directory: path.join(tmp.path, "packages", "slopcode"),
            scope: "project",
          }),
        ].map((session) => session.id)

        expect(ids).toContain(root.id)
        expect(ids).toContain(current.id)
        expect(ids).toContain(sibling.id)
      },
    })
  })

  test("filters sessions by workspace", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const local = await Session.create({ title: "local-workspace" })
        const workspaceID = Identifier.ascending("workspace")
        const warped = await Session.create({
          title: "workspace-only",
          workspaceID,
        })

        const localIDs = [...Session.list({ workspaceID: null })].map((session) => session.id)
        const workspaceIDs = [...Session.list({ workspaceID })].map((session) => session.id)

        expect(localIDs).toContain(local.id)
        expect(localIDs).not.toContain(warped.id)
        expect(workspaceIDs).toContain(warped.id)
        expect(workspaceIDs).not.toContain(local.id)
      },
    })
  })

  test("filters workspace sessions by directory", async () => {
    await using tmp = await tmpdir({ git: true })
    await mkdir(path.join(tmp.path, "packages", "slopcode"), { recursive: true })
    await mkdir(path.join(tmp.path, "packages", "app"), { recursive: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const workspaceID = Identifier.ascending("workspace")
        const current = await Instance.provide({
          directory: path.join(tmp.path, "packages", "slopcode"),
          fn: async () => Session.create({ title: "workspace-current", workspaceID }),
        })
        const sibling = await Instance.provide({
          directory: path.join(tmp.path, "packages", "app"),
          fn: async () => Session.create({ title: "workspace-sibling", workspaceID }),
        })

        const ids = [
          ...Session.list({
            workspaceID,
            directory: path.join(tmp.path, "packages", "slopcode"),
          }),
        ].map((session) => session.id)

        expect(ids).toContain(current.id)
        expect(ids).not.toContain(sibling.id)
      },
    })
  })

  test("supports cursor pagination", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const first = await Session.create({ title: "page-one" })
        await new Promise((resolve) => setTimeout(resolve, 5))
        const second = await Session.create({ title: "page-two" })

        const page = [...Session.list({ directory: tmp.path, limit: 1 })]
        expect(page.length).toBe(1)
        expect(page[0].id).toBe(second.id)

        const next = [...Session.list({ directory: tmp.path, limit: 10, cursor: page[0].time.updated })]
        const ids = next.map((session) => session.id)

        expect(ids).toContain(first.id)
        expect(ids).not.toContain(second.id)
      },
    })
  })
})
