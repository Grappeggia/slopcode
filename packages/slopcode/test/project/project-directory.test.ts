import { describe, expect } from "bun:test"
import { $ } from "bun"
import path from "path"
import { eq, sql } from "drizzle-orm"
import { Effect, Layer } from "effect"
import { CrossSpawnSpawner } from "@slopcode-ai/core/cross-spawn-spawner"
import { Hash } from "@slopcode-ai/core/util/hash"
import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { Database } from "@slopcode-ai/core/database/database"
import { ProjectDirectoryTable, ProjectTable } from "@slopcode-ai/core/project/sql"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionTable } from "@slopcode-ai/core/session/sql"
import { Project } from "@/project/project"
import { tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const it = testEffect(
  Layer.mergeAll(
    Project.defaultLayer,
    Database.defaultLayer,
    CrossSpawnSpawner.defaultLayer,
    PermissionSaved.defaultLayer,
  ),
)

function directories(projectID: ProjectV2.ID) {
  return Database.Service.use(({ db }) =>
    db
      .select()
      .from(ProjectDirectoryTable)
      .where(eq(ProjectDirectoryTable.project_id, projectID))
      .all()
      .pipe(
        Effect.orDie,
        Effect.map((rows) =>
          rows
            .map((row) => ({ directory: row.directory, strategy: row.strategy ?? undefined }))
            .toSorted((a, b) => a.directory.localeCompare(b.directory)),
        ),
      ),
  )
}

describe("Project directory persistence", () => {
  it.live("stores the first opened checkout directory", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped({ git: true })
      const project = yield* Project.Service

      const result = yield* project.fromDirectory(tmp)

      expect(yield* directories(result.project.id)).toEqual([
        { directory: AbsolutePath.make(tmp), strategy: undefined },
      ])
    }),
  )

  it.live("stores a repeatedly opened checkout directory only once", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped({ git: true })
      const project = yield* Project.Service

      const result = yield* project.fromDirectory(tmp)
      const next = yield* project.fromDirectory(tmp)

      expect(next.project.id).toBe(result.project.id)
      expect(yield* directories(result.project.id)).toEqual([
        { directory: AbsolutePath.make(tmp), strategy: undefined },
      ])
    }),
  )

  it.live("stores an opened linked worktree directory", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped({ git: true })
      const project = yield* Project.Service
      const main = yield* project.fromDirectory(tmp)
      const worktree = path.join(tmp, "..", path.basename(tmp) + "-project-directory-worktree")
      yield* Effect.addFinalizer(() =>
        Effect.promise(() => $`git worktree remove ${worktree}`.cwd(tmp).quiet().nothrow()).pipe(Effect.ignore),
      )
      yield* Effect.promise(() => $`git worktree add ${worktree} -b project-directory-${Date.now()}`.cwd(tmp).quiet())

      yield* project.fromDirectory(worktree)

      expect(yield* directories(main.project.id)).toEqual(
        [
          { directory: AbsolutePath.make(tmp), strategy: undefined },
          { directory: AbsolutePath.make(worktree), strategy: undefined },
        ].toSorted((a, b) => a.directory.localeCompare(b.directory)),
      )
    }),
  )

  it.live("stores only the linked copy when first opened from an external linked worktree", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped({ git: true })
      const worktree = path.join(tmp, "..", path.basename(tmp) + "-project-directory-first-worktree")
      yield* Effect.addFinalizer(() =>
        Effect.promise(() => $`git worktree remove ${worktree}`.cwd(tmp).quiet().nothrow()).pipe(Effect.ignore),
      )
      yield* Effect.promise(() => $`git worktree add --detach ${worktree} HEAD`.cwd(tmp).quiet())
      const project = yield* Project.Service

      const result = yield* project.fromDirectory(worktree)

      expect(yield* directories(result.project.id)).toEqual([
        { directory: AbsolutePath.make(worktree), strategy: undefined },
      ])
    }),
  )

  it.live("stores a separately opened clone as a secondary directory", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped({ git: true })
      const bare = tmp + "-project-directory-bare"
      const clone = tmp + "-project-directory-clone"
      yield* Effect.addFinalizer(() =>
        Effect.promise(() => $`rm -rf ${bare} ${clone}`.quiet().nothrow()).pipe(Effect.ignore),
      )
      yield* Effect.promise(() => $`git clone --bare ${tmp} ${bare}`.quiet())
      yield* Effect.promise(() => $`git clone ${bare} ${clone}`.quiet())
      const project = yield* Project.Service
      const main = yield* project.fromDirectory(tmp)

      yield* project.fromDirectory(clone)

      expect(yield* directories(main.project.id)).toEqual(
        [
          { directory: AbsolutePath.make(tmp), strategy: undefined },
          { directory: AbsolutePath.make(clone), strategy: undefined },
        ].toSorted((a, b) => a.directory.localeCompare(b.directory)),
      )
    }),
  )

  it.live("stores only the materialized worktree for a bare repository", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped({ git: true })
      const bare = tmp + "-project-directory-bare-store.git"
      const worktree = tmp + "-project-directory-bare-worktree"
      yield* Effect.addFinalizer(() =>
        Effect.promise(() => $`rm -rf ${bare} ${worktree}`.quiet().nothrow()).pipe(Effect.ignore),
      )
      yield* Effect.promise(() => $`git clone --bare ${tmp} ${bare}`.quiet())
      yield* Effect.promise(() => $`git worktree add ${worktree} HEAD`.cwd(bare).quiet())
      const project = yield* Project.Service

      const result = yield* project.fromDirectory(worktree)

      expect(yield* directories(result.project.id)).toEqual([
        { directory: AbsolutePath.make(worktree), strategy: undefined },
      ])
    }),
  )

  it.live("records the active directory under its newly resolved project id", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped({ git: true })
      const project = yield* Project.Service
      yield* project.fromDirectory(tmp)
      const remoteID = ProjectV2.ID.make(Hash.fast("git-remote:github.com/project-directory-test/collision"))
      const { db } = yield* Database.Service
      yield* db
        .insert(ProjectTable)
        .values({
          id: remoteID,
          worktree: AbsolutePath.make("/tmp/existing"),
          vcs: "git",
          time_created: Date.now(),
          time_updated: Date.now(),
          sandboxes: [],
        })
        .run()
        .pipe(Effect.orDie)
      yield* Effect.promise(() =>
        $`git remote add origin git@github.com:project-directory-test/collision.git`.cwd(tmp).quiet(),
      )

      yield* project.fromDirectory(tmp)

      expect(yield* directories(remoteID)).toEqual([{ directory: AbsolutePath.make(tmp), strategy: undefined }])
    }),
  )

  it.live("clears stale directories when the project id changes", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped({ git: true })
      const project = yield* Project.Service
      const original = yield* project.fromDirectory(tmp)
      const stale = AbsolutePath.make(tmp + "-stale-checkout")
      const { db } = yield* Database.Service
      yield* db
        .insert(ProjectDirectoryTable)
        .values({ project_id: original.project.id, directory: stale })
        .run()
        .pipe(Effect.orDie)
      const remoteID = ProjectV2.ID.make(Hash.fast("git-remote:github.com/project-directory-test/migration"))
      yield* Effect.promise(() =>
        $`git remote add origin git@github.com:project-directory-test/migration.git`.cwd(tmp).quiet(),
      )

      yield* project.fromDirectory(tmp)

      expect(yield* directories(original.project.id)).toEqual([])
      expect(yield* directories(remoteID)).toEqual([{ directory: AbsolutePath.make(tmp), strategy: undefined }])
    }),
  )

  it.live("migrates saved permissions to a canonical project id without duplicate conflicts", () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped({ git: true })
      const project = yield* Project.Service
      const original = yield* project.fromDirectory(tmp)
      const remoteID = ProjectV2.ID.make(Hash.fast("git-remote:github.com/project-directory-test/permissions"))
      const { db } = yield* Database.Service
      yield* db
        .insert(ProjectTable)
        .values({
          id: remoteID,
          worktree: AbsolutePath.make("/tmp/existing-permission-project"),
          vcs: "git",
          time_created: Date.now(),
          time_updated: Date.now(),
          sandboxes: [],
        })
        .run()
        .pipe(Effect.orDie)
      const saved = yield* PermissionSaved.Service
      const sourceSession = SessionV2.ID.make("ses_project_permission_source")
      const targetSession = SessionV2.ID.make("ses_project_permission_target")
      yield* db
        .insert(SessionTable)
        .values([
          {
            id: sourceSession,
            project_id: original.project.id,
            slug: "source",
            directory: tmp,
            title: "source",
            version: "test",
          },
          {
            id: targetSession,
            project_id: remoteID,
            slug: "target",
            directory: "/tmp/existing-permission-project",
            title: "target",
            version: "test",
          },
        ])
        .run()
        .pipe(Effect.orDie)
      yield* saved.add({
        scope: "project",
        projectID: original.project.id,
        action: "bash",
        resources: ["git status", "bun test"],
      })
      yield* saved.add({ scope: "project", projectID: remoteID, action: "bash", resources: ["git status"] })
      yield* saved.add({
        scope: "session",
        sessionID: sourceSession,
        action: "bash",
        resources: ["git status", "bun test"],
      })
      yield* saved.add({ scope: "session", sessionID: targetSession, action: "bash", resources: ["git status"] })
      const retained = (yield* saved.list({ projectID: original.project.id })).find(
        (item) => item.resource === "bun test",
      )!
      expect(yield* db.get<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`)).toEqual({ foreign_keys: 1 })
      yield* Effect.promise(() =>
        $`git remote add origin git@github.com:project-directory-test/permissions.git`.cwd(tmp).quiet(),
      )

      const migrated = yield* project.fromDirectory(tmp)

      expect(migrated.project.id).toBe(remoteID)
      expect(yield* saved.list({ projectID: original.project.id })).toEqual([])
      expect(
        (yield* saved.list({ projectID: remoteID, scope: "project" })).toSorted((a, b) =>
          a.resource.localeCompare(b.resource),
        ),
      ).toMatchObject([
        { id: retained.id, action: "bash", resource: "bun test" },
        { action: "bash", resource: "git status" },
      ])
      expect(
        yield* db.select().from(ProjectTable).where(eq(ProjectTable.id, original.project.id)).get(),
      ).toBeUndefined()
      expect((yield* db.select().from(SessionTable).where(eq(SessionTable.id, sourceSession)).get())?.project_id).toBe(
        remoteID,
      )
      expect(
        (yield* saved.list({ scope: "session", sessionID: sourceSession })).map((item) => item.resource).toSorted(),
      ).toEqual(["bun test", "git status"])
      expect(yield* saved.list({ scope: "session", sessionID: targetSession })).toMatchObject([
        { projectID: remoteID, resource: "git status" },
      ])
    }),
  )
})
