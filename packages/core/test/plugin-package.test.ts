import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Effect, Layer, Option } from "effect"
import { ApplicationTools } from "@slopcode-ai/core/tool/application-tools"
import { Config } from "@slopcode-ai/core/config"
import { ConfigPlugin } from "@slopcode-ai/core/config/plugin"
import { EventV2 } from "@slopcode-ai/core/event"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { Location } from "@slopcode-ai/core/location"
import { Npm } from "@slopcode-ai/core/npm"
import { PermissionV2 } from "@slopcode-ai/core/permission"
import { PluginV2 } from "@slopcode-ai/core/plugin"
import { PluginPackage } from "@slopcode-ai/core/plugin/package"
import { PluginTool } from "@slopcode-ai/core/plugin/tool"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { ToolOutputStore } from "@slopcode-ai/core/tool-output-store"
import { tmpdir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"

const published: Array<{ type: string; data: unknown }> = []
const events = Layer.mock(EventV2.Service, {
  publish: (definition, data) =>
    Effect.sync(() => published.push({ type: definition.type, data })).pipe(
      Effect.as({ id: EventV2.ID.make(`evt_package_${published.length}`), type: definition.type, data }),
    ),
})
const permission = Layer.mock(PermissionV2.Service, {
  assert: () => Effect.void,
  ask: () => Effect.die("unused"),
  reply: () => Effect.die("unused"),
  get: () => Effect.die("unused"),
  forSession: () => Effect.die("unused"),
  list: () => Effect.die("unused"),
})
const output = Layer.mock(ToolOutputStore.Service, {
  limits: () => Effect.succeed({ maxLines: 2_000, maxBytes: 50 * 1024 }),
  bound: (input) => Effect.succeed({ output: input.output, outputPaths: [] }),
  cleanup: () => Effect.void,
})
const plugins = PluginV2.layer.pipe(Layer.provide(events))
const registry = ToolRegistry.layer.pipe(Layer.provide(ApplicationTools.layer), Layer.provide(output))

describe("PluginPackage", () => {
  const it = testEffect(Layer.mergeAll(plugins, registry, permission, events, FSUtil.defaultLayer))

  it.effect("loads origin-relative modern and legacy exports sequentially with unchanged options", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          published.length = 0
          const root = path.join(dir.path, "config")
          yield* Effect.promise(() => fs.mkdir(root))
          yield* Effect.promise(() =>
            Promise.all([
              Bun.write(
                path.join(root, "modern.ts"),
                `export default { id: "same", server: async (input, options) => {
                  await input.client.project.list()
                  globalThis.__h5c3b.push(["modern", options, input.directory, input.serverUrl.href])
                  return {
                    tool: { package_tool: { description: "package", args: {}, execute: async () => "raw" } },
                    "tool.execute.after": async (_input, output) => { output.output += ":after" },
                    unsupported: async () => {}
                  }
                } }`,
              ),
              Bun.write(
                path.join(root, "legacy.ts"),
                `export const first = async (_input, options) => {
                  globalThis.__h5c3b.push(["legacy", options])
                  return { tool: { legacy_tool: { description: "legacy", args: {}, execute: async () => "legacy" } } }
                }
                export { first as duplicate }`,
              ),
            ]),
          )
          const order: unknown[] = []
          Object.assign(globalThis, { __h5c3b: order })
          const location = Location.Service.of({
            directory: AbsolutePath.make(dir.path),
            project: { id: "project" as never, directory: AbsolutePath.make(dir.path) },
          })
          const config = Config.Service.of({
            entries: () =>
              Effect.succeed([
                new Config.Document({
                  type: "document",
                  path: path.join(root, "slopcode.json"),
                  info: new Config.Info({
                    plugins: [
                      new ConfigPlugin.Entry({ package: "./modern.ts", options: { nested: { value: 1 } } }),
                      new ConfigPlugin.Entry({ package: "./legacy.ts", options: { value: 2 } }),
                    ],
                  }),
                }),
              ]),
          })
          const installed: string[] = []
          const requests: Request[] = []
          const npm = Npm.Service.of({
            install: (directory) => Effect.sync(() => installed.push(directory)),
            add: () => Effect.die("unused"),
            which: () => Effect.die("unused"),
          })
          const adapter = PluginTool.layer.pipe(
            Layer.provide(plugins),
            Layer.provide(registry),
            Layer.provide(permission),
            Layer.provide(Layer.succeed(Location.Service, location)),
            Layer.provide(events),
          )
          yield* PluginPackage.load.pipe(
            Effect.provide(adapter),
            Effect.provideService(Config.Service, config),
            Effect.provideService(Location.Service, location),
            Effect.provideService(Npm.Service, npm),
            Effect.provideService(
              PluginPackage.Host,
              PluginPackage.Host.of({
                baseUrl: new URL("http://local.test:1234"),
                fetch: async (request) => {
                  requests.push(request instanceof Request ? request : new Request(request))
                  return Response.json([])
                },
                register: () => {},
              }),
            ),
          )

          expect(installed).toEqual([root])
          expect(requests).toHaveLength(1)
          expect(requests[0].url).toContain(`directory=${encodeURIComponent(dir.path)}`)
          expect(order).toEqual([
            ["modern", { nested: { value: 1 } }, dir.path, "http://local.test:1234/"],
            ["legacy", { value: 2 }],
          ])
          const tools = yield* (yield* ToolRegistry.Service).materialize()
          expect(tools.definitions.map((item) => item.name)).toEqual(
            expect.arrayContaining(["package_tool", "legacy_tool"]),
          )
          expect(published).toContainEqual({
            type: PluginV2.Event.Warning.type,
            data: expect.objectContaining({ package: "./modern.ts", message: expect.stringContaining("unsupported") }),
          })
        }),
      ),
    ),
  )

  test("selects server, main, and index entrypoints and rejects package-root escapes", async () => {
    await using dir = await tmpdir()
    const roots = await Promise.all(
      ["server", "main", "index", "escape"].map(async (name) => {
        const root = path.join(dir.path, name)
        await fs.mkdir(root)
        return root
      }),
    )
    await Promise.all([
      Bun.write(path.join(roots[0], "package.json"), JSON.stringify({ exports: { "./server": "./server.ts" } })),
      Bun.write(path.join(roots[0], "server.ts"), "export default async () => ({})"),
      Bun.write(path.join(roots[1], "package.json"), JSON.stringify({ main: "./main.ts" })),
      Bun.write(path.join(roots[1], "main.ts"), "export default async () => ({})"),
      Bun.write(path.join(roots[2], "index.ts"), "export default async () => ({})"),
      Bun.write(path.join(roots[3], "package.json"), JSON.stringify({ exports: { "./server": "../outside.ts" } })),
      Bun.write(path.join(dir.path, "outside.ts"), "export default async () => ({})"),
    ])
    const npm = Npm.Service.of({
      add: () => Effect.die("unused"),
      install: () => Effect.die("unused"),
      which: () => Effect.succeed(Option.none()),
    })
    const resolve = (root: string) => PluginPackage.resolve({ spec: root, source: "config", directory: dir.path, npm })
    expect((await resolve(roots[0])).entry).toBe(path.join(roots[0], "server.ts"))
    expect((await resolve(roots[1])).entry).toBe(path.join(roots[1], "main.ts"))
    expect((await resolve(roots[2])).entry).toBe(path.join(roots[2], "index.ts"))
    await expect(resolve(roots[3])).rejects.toMatchObject({ stage: "entrypoint" })
  })

  test("checks stable npm engine compatibility but skips local compatibility", async () => {
    await using dir = await tmpdir()
    await Bun.write(
      path.join(dir.path, "package.json"),
      JSON.stringify({ name: "test-plugin", main: "./index.ts", engines: { slopcode: ">=3" } }),
    )
    await Bun.write(path.join(dir.path, "index.ts"), "export default async () => ({})")
    const npm = Npm.Service.of({
      add: () => Effect.succeed({ directory: dir.path, entrypoint: Option.none() }),
      install: () => Effect.die("unused"),
      which: () => Effect.succeed(Option.none()),
    })
    await expect(
      PluginPackage.resolve({ spec: "test-plugin", source: "config", directory: dir.path, npm, version: "2.0.0" }),
    ).rejects.toMatchObject({ stage: "compatibility" })
    expect(
      (
        await PluginPackage.resolve({
          spec: dir.path,
          source: "config",
          directory: dir.path,
          npm,
          version: "2.0.0",
        })
      ).local,
    ).toBe(true)
  })

  test("uses a typed unavailable transport instead of ambient network fetch", async () => {
    await expect(PluginPackage.unavailable(new Request("http://unavailable.invalid/project"))).rejects.toBeInstanceOf(
      PluginPackage.ClientUnavailableError,
    )
  })
})
