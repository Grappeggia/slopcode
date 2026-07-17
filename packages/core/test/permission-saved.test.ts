import fs from "node:fs/promises"
import path from "node:path"
import { describe, expect } from "bun:test"
import { Database } from "@slopcode-ai/core/database/database"
import { PermissionTable } from "@slopcode-ai/core/permission/sql"
import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { Project } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionTable } from "@slopcode-ai/core/session/sql"
import { Effect, Exit, Layer, Schema } from "effect"
import { eq, sql } from "drizzle-orm"
import { testEffect } from "./lib/effect"
import { tmpdir } from "./fixture/tmpdir"

const database = Database.layerFromPath(":memory:")
const layer = PermissionSaved.layer.pipe(Layer.provideMerge(database))
const it = testEffect(layer)
const projectID = Project.ID.make("project_saved")
const first = SessionV2.ID.make("ses_saved_first")
const second = SessionV2.ID.make("ses_saved_second")

function setup() {
  return Effect.gen(function* () {
    const { db } = yield* Database.Service
    yield* db
      .insert(ProjectTable)
      .values([
        { id: Project.ID.global, worktree: AbsolutePath.make("/"), sandboxes: [] },
        { id: projectID, worktree: AbsolutePath.make("/project"), vcs: "git", sandboxes: [] },
      ])
      .run()
      .pipe(Effect.orDie)
    yield* db
      .insert(SessionTable)
      .values(
        [first, second].map((id) => ({
          id,
          project_id: projectID,
          slug: id,
          directory: "/project",
          title: id,
          version: "test",
        })),
      )
      .run()
      .pipe(Effect.orDie)
  })
}

describe("PermissionSaved", () => {
  it.effect("accepts only lowercase SHA-256 directory owners", () =>
    Effect.sync(() => {
      expect(Schema.is(PermissionSaved.DirectoryID)("a".repeat(64))).toBe(true)
      for (const value of ["/tmp/project", "a".repeat(63), "A".repeat(64), "g".repeat(64)])
        expect(Schema.is(PermissionSaved.DirectoryID)(value)).toBe(false)
    }),
  )

  it.effect("shares Git ownership and isolates normalized non-Git directory ownership", () =>
    Effect.gen(function* () {
      yield* setup()
      const saved = yield* PermissionSaved.Service
      const root = yield* Effect.promise(() => tmpdir())
      yield* Effect.addFinalizer(() => Effect.promise(() => root[Symbol.asyncDispose]()))
      yield* Effect.promise(() =>
        Promise.all([fs.mkdir(path.join(root.path, "first")), fs.mkdir(path.join(root.path, "second"))]),
      )
      const first = AbsolutePath.make(yield* Effect.promise(() => fs.realpath(path.join(root.path, "first"))))
      const second = AbsolutePath.make(yield* Effect.promise(() => fs.realpath(path.join(root.path, "second"))))
      const alias = AbsolutePath.make(path.join(root.path, "first-alias"))
      const gitA = AbsolutePath.make(path.join(root.path, "git-a"))
      const gitB = AbsolutePath.make(path.join(root.path, "git-b"))
      yield* Effect.promise(() => fs.symlink(first, alias))

      const local = (directory: AbsolutePath): Location.Interface => ({
        directory,
        project: { id: Project.ID.global, directory },
      })
      const git = (directory: AbsolutePath): Location.Interface => ({
        directory,
        project: { id: projectID, directory: gitA },
        vcs: { type: "git", store: AbsolutePath.make(path.join(gitA, ".git")) },
      })

      yield* saved.add({
        scope: "directory",
        directoryID: PermissionSaved.DirectoryID.create(first),
        action: "bash",
        resources: ["pwd", "pwd"],
      })
      yield* saved.add({ scope: "project", projectID, action: "bash", resources: ["git status"] })

      expect(yield* saved.listCurrent(local(first))).toMatchObject([
        { scope: "directory", match: "pattern", action: "bash", resource: "pwd" },
      ])
      expect(yield* saved.listCurrent(local(alias))).toHaveLength(1)
      expect(yield* saved.listCurrent(local(second))).toEqual([])
      expect(yield* saved.listCurrent(git(gitA))).toMatchObject([
        { scope: "project", projectID, action: "bash", resource: "git status" },
      ])
      expect(yield* saved.listCurrent(git(gitB))).toHaveLength(1)

      const item = (yield* saved.listCurrent(local(first)))[0]
      expect(yield* saved.removeCurrent({ id: item.id, location: local(second) })).toBe(false)
      expect(yield* saved.removeCurrent({ id: item.id, location: git(gitA) })).toBe(false)
      expect(yield* saved.removeCurrent({ id: item.id, location: local(alias) })).toBe(true)
      expect(yield* saved.listCurrent(local(first))).toEqual([])
    }),
  )

  it.effect("stores exact session and global grants alongside legacy project patterns", () =>
    Effect.gen(function* () {
      yield* setup()
      const saved = yield* PermissionSaved.Service
      const resources = ["echo *", "file?.txt", "[abc]"]

      yield* saved.add({ scope: "session", sessionID: first, action: "bash", resources })
      yield* saved.add({ scope: "global", action: "read", resources: ["README[1].md"] })
      yield* saved.add({ scope: "project", projectID, action: "read", resources: ["src/**/*.ts"] })

      expect(
        (yield* saved.list({ scope: "session", sessionID: first })).toSorted((a, b) =>
          a.resource.localeCompare(b.resource),
        ),
      ).toMatchObject(
        resources
          .toSorted((a, b) => a.localeCompare(b))
          .map((resource) => ({ scope: "session", match: "exact", sessionID: first, action: "bash", resource })),
      )
      expect(yield* saved.list({ scope: "global" })).toMatchObject([
        { projectID: Project.ID.global, scope: "global", match: "exact", action: "read", resource: "README[1].md" },
      ])
      expect(yield* saved.list({ scope: "project", projectID })).toMatchObject([
        { projectID, scope: "project", match: "pattern", action: "read", resource: "src/**/*.ts" },
      ])
    }),
  )

  it.effect("isolates session rows and cascades them when their session is deleted", () =>
    Effect.gen(function* () {
      yield* setup()
      const saved = yield* PermissionSaved.Service
      const { db } = yield* Database.Service
      yield* saved.add({ scope: "session", sessionID: first, action: "bash", resources: ["bun test"] })

      expect(yield* saved.list({ scope: "session", sessionID: second })).toEqual([])
      yield* db.delete(SessionTable).where(eq(SessionTable.id, first)).run().pipe(Effect.orDie)
      expect(yield* saved.list({ scope: "session", sessionID: first })).toEqual([])
    }),
  )

  it.effect("revokes and guarded-clears only the selected scope", () =>
    Effect.gen(function* () {
      yield* setup()
      const saved = yield* PermissionSaved.Service
      yield* saved.add({ scope: "session", sessionID: first, action: "bash", resources: ["bun test"] })
      yield* saved.add({ scope: "global", action: "bash", resources: ["bun test"] })
      const item = (yield* saved.list({ scope: "session", sessionID: first }))[0]

      expect(yield* saved.remove({ id: item.id, scope: "global" })).toBe(false)
      expect(yield* saved.remove({ id: item.id, scope: "session", sessionID: first })).toBe(true)
      expect(yield* saved.clear({ scope: "global" })).toBe(1)
      expect(yield* saved.list()).toEqual([])
    }),
  )

  it.effect("rejects malformed scope match session and ownership combinations", () =>
    Effect.gen(function* () {
      yield* setup()
      const { db } = yield* Database.Service
      const insert = (id: string, owner: string, scope: string, match: string, session?: string) =>
        db.run(sql`
          INSERT INTO permission
            (id, project_id, action, resource, scope, match, session_id, time_created, time_updated)
          VALUES (${id}, ${owner}, 'bash', 'git status', ${scope}, ${match}, ${session ?? null}, 1, 1)
        `)

      for (const row of [
        ["psv_invalid_scope", projectID, "invalid", "pattern"],
        ["psv_invalid_match", projectID, "project", "invalid"],
        ["psv_project_exact", projectID, "project", "exact"],
        ["psv_project_session", projectID, "project", "pattern", first],
        ["psv_session_pattern", projectID, "session", "pattern", first],
        ["psv_session_missing", projectID, "session", "exact"],
        ["psv_session_owner", Project.ID.global, "session", "exact", first],
        ["psv_global_project", projectID, "global", "exact"],
        ["psv_global_session", Project.ID.global, "global", "exact", first],
      ] as const) {
        expect(Exit.isFailure(yield* insert(...row).pipe(Effect.exit))).toBe(true)
      }
      expect(yield* db.select().from(PermissionTable).all()).toEqual([])
    }),
  )

  it.effect("rejects malformed directory ownership combinations", () =>
    Effect.gen(function* () {
      yield* setup()
      const { db } = yield* Database.Service
      const directoryID = "a".repeat(64)
      const insert = (id: string, owner: string, scope: string, match: string, directory?: string) =>
        db.run(sql`
          INSERT INTO permission
            (id, project_id, action, resource, scope, match, session_id, directory_id, time_created, time_updated)
          VALUES (${id}, ${owner}, 'bash', 'pwd', ${scope}, ${match}, NULL, ${directory ?? null}, 1, 1)
        `)

      for (const row of [
        ["psv_directory_project", projectID, "directory", "pattern", directoryID],
        ["psv_directory_exact", Project.ID.global, "directory", "exact", directoryID],
        ["psv_directory_missing", Project.ID.global, "directory", "pattern"],
        ["psv_project_directory", projectID, "project", "pattern", directoryID],
        ["psv_global_directory", Project.ID.global, "global", "exact", directoryID],
        ["psv_directory_raw", Project.ID.global, "directory", "pattern", "/tmp/project"],
        ["psv_directory_short", Project.ID.global, "directory", "pattern", "a".repeat(63)],
        ["psv_directory_upper", Project.ID.global, "directory", "pattern", "A".repeat(64)],
        ["psv_directory_nonhex", Project.ID.global, "directory", "pattern", "g".repeat(64)],
      ] as const) {
        expect(Exit.isFailure(yield* insert(...row).pipe(Effect.exit))).toBe(true)
      }
      expect(yield* db.select().from(PermissionTable).all()).toEqual([])
    }),
  )

  it.effect("filters malformed legacy rows during runtime decoding", () =>
    Effect.gen(function* () {
      yield* setup()
      const { db } = yield* Database.Service
      yield* db.run(sql`PRAGMA ignore_check_constraints = ON`)
      yield* db.run(sql`
        INSERT INTO permission
          (id, project_id, action, resource, scope, match, session_id, time_created, time_updated)
        VALUES ('psv_malformed_runtime', ${projectID}, 'bash', 'git status', 'global', 'exact', NULL, 1, 1)
      `)
      yield* db.run(sql`PRAGMA ignore_check_constraints = OFF`)

      expect(yield* (yield* PermissionSaved.Service).list({ scope: "global" })).toEqual([])
    }),
  )
})
