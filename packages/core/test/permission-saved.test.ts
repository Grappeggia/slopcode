import { describe, expect } from "bun:test"
import { Database } from "@slopcode-ai/core/database/database"
import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { Project } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionTable } from "@slopcode-ai/core/session/sql"
import { Effect, Layer } from "effect"
import { eq } from "drizzle-orm"
import { testEffect } from "./lib/effect"

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
})
