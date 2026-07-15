import { expect } from "bun:test"
import { $ } from "bun"
import { Database } from "@slopcode-ai/core/database/database"
import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
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
      const unavailable = yield* slopcode.spawn(["permission", "list"], { env })
      slopcode.expectExit(unavailable, 0)
      expect(unavailable.stdout).toContain("Saved permissions are unavailable outside a Git project.")

      yield* Effect.gen(function* () {
        const saved = yield* PermissionSaved.Service
        yield* saved.add({
          projectID: ProjectV2.ID.global,
          action: "bash",
          resources: ["git status", "bun test"],
        })
      }).pipe(Effect.provide(PermissionSaved.layer.pipe(Layer.provide(Database.layerFromPath(db)))))
      expect(JSON.parse((yield* slopcode.spawn(["permission", "list", "--json"], { env })).stdout)).toEqual([])

      const one = path.join(home, "non-git-one")
      const two = path.join(home, "non-git-two")
      yield* Effect.promise(() => Promise.all([fs.mkdir(one), fs.mkdir(two)]))
      const first = yield* slopcode.spawn(["permission", "list", "--json"], { env, cwd: one })
      const second = yield* slopcode.spawn(["permission", "list", "--json"], { env, cwd: two })
      expect(JSON.parse(first.stdout)).toEqual([])
      expect(JSON.parse(second.stdout)).toEqual([])

      const repo = path.join(home, "repo")
      yield* Effect.promise(() => fs.mkdir(repo))
      yield* Effect.promise(() => $`git init`.cwd(repo).quiet())
      yield* Effect.promise(() => $`git config user.name "Test"`.cwd(repo).quiet())
      yield* Effect.promise(() => $`git config user.email "test@slopcode.test"`.cwd(repo).quiet())
      yield* Effect.promise(() => $`git config commit.gpgsign false`.cwd(repo).quiet())
      yield* Effect.promise(() => $`git commit --allow-empty -m "root"`.cwd(repo).quiet())
      yield* slopcode.spawn(["permission", "list", "--json"], { env, cwd: repo })
      const project = yield* Effect.gen(function* () {
        const { db: database } = yield* Database.Service
        const projects = yield* database.select().from(ProjectTable).all()
        expect(projects.filter((item) => item.id === ProjectV2.ID.global)).toHaveLength(1)
        expect(projects).toHaveLength(2)
        return projects.find((item) => item.id !== ProjectV2.ID.global)!.id
      }).pipe(Effect.provide(Database.layerFromPath(db)))
      yield* Effect.gen(function* () {
        yield* (yield* PermissionSaved.Service).add({
          projectID: project,
          action: "bash",
          resources: ["git status", "bun test"],
        })
      }).pipe(Effect.provide(PermissionSaved.layer.pipe(Layer.provide(Database.layerFromPath(db)))))

      const json = yield* slopcode.spawn(["permission", "list", "--json"], { env, cwd: repo })
      slopcode.expectExit(json, 0)
      const items = Schema.decodeUnknownSync(Schema.Array(PermissionSaved.Info))(JSON.parse(json.stdout))
      expect(items).toHaveLength(2)
      expect(items.every((item) => item.projectID === project)).toBe(true)
      expect(items.map((item) => [item.action, item.resource])).toEqual([
        ["bash", "git status"],
        ["bash", "bun test"],
      ])

      const blocked = yield* slopcode.spawn(["permission", "revoke", items[0].id], { env })
      expect(blocked.exitCode).not.toBe(0)
      const globalClear = yield* slopcode.spawn(["permission", "clear", "--all"], { env })
      slopcode.expectExit(globalClear, 0)
      expect(globalClear.stdout).toContain("Saved permissions are unavailable outside a Git project.")
      expect(
        JSON.parse((yield* slopcode.spawn(["permission", "list", "--json"], { env, cwd: repo })).stdout),
      ).toHaveLength(2)

      const table = yield* slopcode.spawn(["permission", "list"], { env, cwd: repo })
      slopcode.expectExit(table, 0)
      expect(table.stdout).toContain("ID")
      expect(table.stdout).toContain(items[0].id)
      expect(table.stdout).toContain("git status")

      const revoked = yield* slopcode.spawn(["permission", "revoke", items[0].id], { env, cwd: repo })
      slopcode.expectExit(revoked, 0)
      expect(revoked.stdout).toContain(`Revoked saved permission ${items[0].id}.`)

      const guarded = yield* slopcode.spawn(["permission", "clear"], { env, cwd: repo })
      expect(guarded.exitCode).not.toBe(0)
      expect(guarded.stderr).toContain("Pass --all to clear saved permissions.")
      const remaining = yield* slopcode.spawn(["permission", "list", "--json"], { env, cwd: repo })
      slopcode.expectExit(remaining, 0)
      expect(JSON.parse(remaining.stdout)).toHaveLength(1)

      const cleared = yield* slopcode.spawn(["permission", "clear", "--all"], { env, cwd: repo })
      slopcode.expectExit(cleared, 0)
      expect(cleared.stdout).toContain("Cleared 1 saved permission.")
      const final = yield* slopcode.spawn(["permission", "list", "--json"], { env, cwd: repo })
      slopcode.expectExit(final, 0)
      expect(JSON.parse(final.stdout)).toEqual([])
    }),
  90_000,
)
