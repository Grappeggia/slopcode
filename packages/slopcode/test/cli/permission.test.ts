import { expect } from "bun:test"
import { Database } from "@slopcode-ai/core/database/database"
import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { Effect, Layer, Schema } from "effect"
import fs from "fs/promises"
import path from "path"
import { cliIt } from "../lib/cli-process"

cliIt.live(
  "lists, revokes, and guarded-clears saved permissions for the current project",
  ({ home, slopcode }) =>
    Effect.gen(function* () {
      const db = path.join(home, "permissions.db")
      const env = { SLOPCODE_DB: db }
      const empty = yield* slopcode.spawn(["permission", "list", "--json"], { env })
      slopcode.expectExit(empty, 0)
      expect(JSON.parse(empty.stdout)).toEqual([])

      yield* Effect.gen(function* () {
        const saved = yield* PermissionSaved.Service
        yield* saved.add({
          projectID: yield* saved.scope({
            projectID: ProjectV2.ID.global,
            directory: AbsolutePath.make(home),
          }),
          action: "bash",
          resources: ["git status", "bun test"],
        })
      }).pipe(Effect.provide(PermissionSaved.layer.pipe(Layer.provide(Database.layerFromPath(db)))))

      const json = yield* slopcode.spawn(["permission", "list", "--json"], { env })
      slopcode.expectExit(json, 0)
      const items = Schema.decodeUnknownSync(Schema.Array(PermissionSaved.Info))(JSON.parse(json.stdout))
      expect(items).toHaveLength(2)
      expect(new Set(items.map((item) => item.projectID)).size).toBe(1)
      expect(items[0].projectID).not.toBe(ProjectV2.ID.global)
      expect(items.map((item) => [item.action, item.resource])).toEqual([
        ["bash", "git status"],
        ["bash", "bun test"],
      ])

      const table = yield* slopcode.spawn(["permission", "list"], { env })
      slopcode.expectExit(table, 0)
      expect(table.stdout).toContain("ID")
      expect(table.stdout).toContain(items[0].id)
      expect(table.stdout).toContain("git status")

      const revoked = yield* slopcode.spawn(["permission", "revoke", items[0].id], { env })
      slopcode.expectExit(revoked, 0)
      expect(revoked.stdout).toContain(`Revoked saved permission ${items[0].id}.`)

      const guarded = yield* slopcode.spawn(["permission", "clear"], { env })
      expect(guarded.exitCode).not.toBe(0)
      expect(guarded.stderr).toContain("Pass --all to clear saved permissions.")
      const remaining = yield* slopcode.spawn(["permission", "list", "--json"], { env })
      slopcode.expectExit(remaining, 0)
      expect(JSON.parse(remaining.stdout)).toHaveLength(1)

      const cleared = yield* slopcode.spawn(["permission", "clear", "--all"], { env })
      slopcode.expectExit(cleared, 0)
      expect(cleared.stdout).toContain("Cleared 1 saved permission.")
      const final = yield* slopcode.spawn(["permission", "list", "--json"], { env })
      slopcode.expectExit(final, 0)
      expect(JSON.parse(final.stdout)).toEqual([])

      const one = path.join(home, "non-git-one")
      const two = path.join(home, "non-git-two")
      yield* Effect.promise(() => Promise.all([fs.mkdir(one), fs.mkdir(two)]))
      yield* slopcode.spawn(["permission", "list", "--json"], { env, cwd: one })
      yield* slopcode.spawn(["permission", "list", "--json"], { env, cwd: two })
      yield* Effect.gen(function* () {
        const saved = yield* PermissionSaved.Service
        yield* saved.add({
          projectID: yield* saved.scope({
            projectID: ProjectV2.ID.global,
            directory: AbsolutePath.make(one),
          }),
          action: "read",
          resources: ["README.md"],
        })
      }).pipe(Effect.provide(PermissionSaved.layer.pipe(Layer.provide(Database.layerFromPath(db)))))
      const first = yield* slopcode.spawn(["permission", "list", "--json"], { env, cwd: one })
      const second = yield* slopcode.spawn(["permission", "list", "--json"], { env, cwd: two })
      expect(JSON.parse(first.stdout)).toHaveLength(1)
      expect(JSON.parse(second.stdout)).toEqual([])
    }),
  90_000,
)
