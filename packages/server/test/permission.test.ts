import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { expect, test } from "bun:test"
import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { Location } from "@slopcode-ai/core/location"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { Project } from "@slopcode-ai/core/project"
import { ProjectTable } from "@slopcode-ai/core/project/sql"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { Context, Effect, Exit, Layer, Scope } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { createRoutes } from "../src/routes"

test("saved permission HTTP routes enforce current Git and directory ownership", async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-server-permission-")))
  const first = await fs.realpath(await fs.mkdtemp(path.join(root, "first-")))
  const second = await fs.realpath(await fs.mkdtemp(path.join(root, "second-")))
  const gitA = await fs.realpath(await fs.mkdtemp(path.join(root, "git-a-")))
  const gitB = await fs.realpath(await fs.mkdtemp(path.join(root, "git-b-")))
  const database = Database.layerFromPath(path.join(root, "permissions.db"))
  const projectID = Project.ID.make("project_http_scope")
  const services = PermissionSaved.layer.pipe(Layer.provideMerge(database))
  const scope = await Effect.runPromise(Scope.make())
  const context = await Effect.runPromise(Layer.buildWithScope(services, scope))
  const saved = Context.get(context, PermissionSaved.Service)
  const db = Context.get(context, Database.Service).db
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* db
        .insert(ProjectTable)
        .values([
          { id: Project.ID.global, worktree: AbsolutePath.make("/"), sandboxes: [] },
          { id: projectID, worktree: AbsolutePath.make(gitA), vcs: "git", sandboxes: [] },
        ])
        .run()
        .pipe(Effect.orDie)
      yield* saved.add({
        scope: "directory",
        directoryID: PermissionSaved.DirectoryID.create(first),
        action: "bash",
        resources: ["first", "first"],
      })
      yield* saved.add({
        scope: "directory",
        directoryID: PermissionSaved.DirectoryID.create(second),
        action: "bash",
        resources: ["second"],
      })
      yield* saved.add({ scope: "project", projectID, action: "bash", resources: ["shared"] })
    }).pipe(Effect.provide(services)),
  )
  const locations = Layer.mock(LocationServiceMap, {
    get: (ref: Location.Ref) => {
      const git = ref.directory === gitA || ref.directory === gitB
      return Layer.succeed(
        Location.Service,
        Location.Service.of({
          directory: ref.directory,
          project: {
            id: git ? projectID : Project.ID.global,
            directory: git ? AbsolutePath.make(gitA) : AbsolutePath.make("/"),
          },
          vcs: git ? { type: "git", store: AbsolutePath.make(path.join(gitA, ".git")) } : undefined,
        }),
      )
    },
  } as never)
  const app = HttpRouter.toWebHandler(
    createRoutes(
      undefined,
      undefined,
      locations,
      EventV2.defaultLayer,
      database,
      Layer.succeed(PermissionSaved.Service, saved),
    ).pipe(Layer.provide(HttpServer.layerServices)),
    { disableLogger: true },
  )
  const request = (route: string, directory: string, init?: RequestInit) =>
    app.handler(
      new Request(`http://localhost${route}`, {
        ...init,
        headers: { ...init?.headers, "x-slopcode-directory": directory },
      }),
      Context.empty() as Context.Context<unknown>,
    )
  const list = async (directory: string) => {
    const response = await request("/api/permission/saved", directory)
    expect(response.status).toBe(200)
    return (await response.json()) as { data: PermissionSaved.Info[] }
  }

  try {
    const one = await list(first)
    expect(one.data.map((item) => item.resource)).toEqual(["first"])
    expect((await list(second)).data.map((item) => item.resource)).toEqual(["second"])
    expect((await list(gitA)).data.map((item) => item.resource)).toEqual(["shared"])
    expect((await list(gitB)).data.map((item) => item.resource)).toEqual(["shared"])

    expect((await request(`/api/permission/saved/${one.data[0].id}`, second, { method: "DELETE" })).status).toBe(204)
    expect((await list(first)).data).toHaveLength(1)
    expect((await request(`/api/permission/saved/${one.data[0].id}`, gitA, { method: "DELETE" })).status).toBe(204)
    expect((await list(first)).data).toHaveLength(1)
    expect((await request(`/api/permission/saved/${one.data[0].id}`, first, { method: "DELETE" })).status).toBe(204)
    expect((await list(first)).data).toEqual([])
    expect((await list(second)).data.map((item) => item.resource)).toEqual(["second"])

    expect((await request("/api/permission/saved?scope=project&projectID=other", first)).status).toBe(200)
    expect(
      (
        (await (await request("/api/permission/saved?scope=project&projectID=other", first)).json()) as {
          data: unknown[]
        }
      ).data,
    ).toEqual([])
  } finally {
    await app.dispose()
    await Effect.runPromise(Scope.close(scope, Exit.void))
    await fs.rm(root, { recursive: true, force: true })
  }
})
