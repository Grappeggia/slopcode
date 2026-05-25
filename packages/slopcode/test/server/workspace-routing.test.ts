import { afterEach, expect, test } from "bun:test"
import { Server } from "../../src/server/server"
import { WorkspaceTable } from "../../src/control-plane/workspace.sql"
import { Database } from "../../src/storage/db"
import { Project } from "../../src/project/project"
import { Identifier } from "../../src/id/id"
import { resetDatabase } from "../fixture/db"
import { tmpdir } from "../fixture/fixture"

afterEach(async () => {
  await resetDatabase()
})

test("server routes honor the workspace header", async () => {
  await using root = await tmpdir({ git: true })
  await using worktree = await tmpdir({ git: true })
  const { project } = await Project.fromDirectory(root.path)
  const id = Identifier.ascending("workspace")

  Database.use((db) => {
    db.insert(WorkspaceTable)
      .values({
        id,
        branch: null,
        project_id: project.id,
        config: {
          type: "worktree",
          directory: worktree.path,
        },
      })
      .run()
  })

  const app = Server.App()
  const response = await app.request("/project/current", {
    headers: {
      "x-slopcode-directory": root.path,
      "x-slopcode-workspace": id,
    },
  })
  expect(response.status).toBe(200)
  const data = (await response.json()) as { worktree: string }
  expect(data.worktree).toBe(worktree.path)
})
