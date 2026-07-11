import { expect, test } from "bun:test"
import { Context, Effect, Exit, Layer, Scope } from "effect"
import { PluginPackage } from "@slopcode-ai/core/plugin/package"
import { Location } from "@slopcode-ai/core/location"
import { LocationServiceMap, withPluginHost } from "@slopcode-ai/core/location-layer"
import { PluginBoot } from "@slopcode-ai/core/plugin/boot"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { PluginServer } from "../src/plugin"
import { webHandler } from "../src/routes"

test("configured plugins use the in-process server client and register workspaces", async () => {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-server-plugin-")))
  try {
    await fs.mkdir(path.join(directory, "node_modules"))
    await Promise.all([
      Bun.write(path.join(directory, "package.json"), JSON.stringify({ dependencies: {} })),
      Bun.write(path.join(directory, "slopcode.json"), JSON.stringify({ plugins: ["./plugin.ts"] })),
      Bun.write(
        path.join(directory, "plugin.ts"),
        `export default async (input) => {
          globalThis.__h5c3b_factories = (globalThis.__h5c3b_factories || 0) + 1
          const health = await input.client._client.get({ url: "/api/health" })
          input.experimental_workspace.register("server-test", {
            name: "server-test",
            description: "server-test",
            configure: (value) => value,
            create: async () => {},
            remove: async () => {},
            target: async () => ({ type: "local", directory: input.directory })
          })
          globalThis.__h5c3b_server = { health: health.data, url: input.serverUrl.href }
          globalThis.__h5c3b_location = new Promise((resolve) => setTimeout(async () => {
            resolve(await input.client._client.get({
              url: "/api/location?location[directory]=" + encodeURIComponent(input.directory)
            }))
          }, 0))
          return { dispose: () => { globalThis.__h5c3b_disposed = (globalThis.__h5c3b_disposed || 0) + 1 } }
        }`,
      ),
    ])
    const app = webHandler({ baseUrl: new URL("http://configured.test:7777") })
    const response = await app.handler(
      new Request(`http://configured.test:7777/api/location?location[directory]=${encodeURIComponent(directory)}`),
      undefined as never,
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { project: { id: string } }
    for (let i = 0; i < 100 && !(globalThis as { __h5c3b_server?: unknown }).__h5c3b_server; i++) {
      await Bun.sleep(20)
    }
    expect((globalThis as { __h5c3b_server?: unknown }).__h5c3b_server).toEqual({
      health: { healthy: true },
      url: "http://configured.test:7777/",
    })
    expect(PluginServer.workspace(body.project.id, "server-test")).toBeDefined()
    const state = globalThis as typeof globalThis & {
      __h5c3b_location: Promise<{ data: unknown }>
      __h5c3b_factories: number
      __h5c3b_disposed: number
    }
    const location = await state.__h5c3b_location
    expect(location.data).toMatchObject({ directory })
    expect(state.__h5c3b_factories).toBe(1)
    await app.dispose()
    expect(state.__h5c3b_disposed).toBe(1)
    expect(PluginServer.workspace(body.project.id, "server-test")).toBeUndefined()
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("workspace registrations are token-owned across replacement and host disposal", async () => {
  const scope = await Effect.runPromise(Scope.make())
  const context = await Effect.runPromise(
    Layer.buildWithScope(
      PluginServer.layer({ baseUrl: new URL("http://test"), fetch: () => Promise.resolve(new Response()) }),
      scope,
    ),
  )
  const host = Context.get(context, PluginPackage.Host)
  const first = { name: "first" }
  const second = { name: "second" }
  const cleanFirst = host.register("project", "type", first)
  const cleanSecond = host.register("project", "type", second)

  expect(PluginServer.workspace("project", "type")).toBe(second)
  cleanFirst()
  expect(PluginServer.workspace("project", "type")).toBe(second)
  cleanSecond()
  expect(PluginServer.workspace("project", "type")).toBeUndefined()

  host.register("project", "type", first)
  await Effect.runPromise(Scope.close(scope, Exit.void))
  expect(PluginServer.workspace("project", "type")).toBeUndefined()
})

test("Location invalidation removes configured workspace registrations", async () => {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-server-location-plugin-")))
  const scope = await Effect.runPromise(Scope.make())
  try {
    await Promise.all([
      Bun.write(path.join(directory, "package.json"), JSON.stringify({ dependencies: {} })),
      Bun.write(path.join(directory, "slopcode.json"), JSON.stringify({ plugins: ["./plugin.ts"] })),
      Bun.write(
        path.join(directory, "plugin.ts"),
        `export default async (input) => { input.experimental_workspace.register("location-test", { name: "location-test" }); return {} }`,
      ),
    ])
    const context = await Effect.runPromise(
      Layer.buildWithScope(
        withPluginHost(
          PluginServer.layer({
            baseUrl: new URL("http://location.test"),
            fetch: () => Promise.resolve(new Response()),
          }),
        ),
        scope,
      ),
    )
    const locations = Context.get(context, LocationServiceMap)
    const ref = Location.Ref.make({ directory: AbsolutePath.make(directory) })
    const projectID = await Effect.runPromise(
      Effect.gen(function* () {
        yield* (yield* PluginBoot.Service).wait()
        return String((yield* Location.Service).project.id)
      }).pipe(Effect.scoped, Effect.provide(locations.get(ref))),
    )

    expect(PluginServer.workspace(projectID, "location-test")).toBeDefined()
    await Effect.runPromise(locations.invalidate(ref))
    expect(PluginServer.workspace(projectID, "location-test")).toBeUndefined()
  } finally {
    await Effect.runPromise(Scope.close(scope, Exit.void))
    await fs.rm(directory, { recursive: true, force: true })
  }
})
