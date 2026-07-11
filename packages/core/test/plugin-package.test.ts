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

  it.effect("isolates every module stage, skips deprecated packages, and keeps healthy exports", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          published.length = 0
          yield* Effect.promise(() =>
            Promise.all([
              Bun.write(path.join(dir.path, "import.ts"), `throw new Error("import failed")`),
              Bun.write(
                path.join(dir.path, "factory.ts"),
                `export default async () => { throw new Error("factory failed") }`,
              ),
              Bun.write(path.join(dir.path, "shape.ts"), `export default async () => ({ tool: false })`),
              Bun.write(
                path.join(dir.path, "mixed.ts"),
                `export const invalid = 1
                 export const healthy = async () => ({
                   tool: { continued_tool: { description: "continued", args: {}, execute: async () => "ok" } }
                 })`,
              ),
            ]),
          )
          const location = Location.Service.of({
            directory: AbsolutePath.make(dir.path),
            project: { id: "project" as never, directory: AbsolutePath.make(dir.path) },
          })
          const config = Config.Service.of({
            entries: () =>
              Effect.succeed([
                new Config.Document({
                  type: "document",
                  path: path.join(dir.path, "slopcode.json"),
                  info: new Config.Info({
                    plugins: ["slopcode-openai-codex-auth", "./import.ts", "./factory.ts", "./shape.ts", "./mixed.ts"],
                  }),
                }),
              ]),
          })
          const added: string[] = []
          const npm = Npm.Service.of({
            install: () => Effect.void,
            add: (spec) =>
              Effect.sync(() => {
                added.push(spec)
                return { directory: dir.path, entrypoint: Option.none<string>() }
              }),
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
          )

          expect(added).toEqual([])
          expect(
            published
              .filter((item) => item.type === PluginV2.Event.Failed.type)
              .map((item) => (item.data as { stage: string }).stage),
          ).toEqual(["import", "factory", "hook-shape", "hook-shape"])
          expect(published).toContainEqual({
            type: PluginV2.Event.Warning.type,
            data: expect.objectContaining({
              package: "slopcode-openai-codex-auth",
              message: expect.stringContaining("deprecated"),
            }),
          })
          expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((item) => item.name)).toContain(
            "continued_tool",
          )
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

  test("resolves nested directory entrypoints and rejects symlink directory escapes", async () => {
    await using dir = await tmpdir()
    const server = path.join(dir.path, "server")
    const main = path.join(dir.path, "main")
    const escape = path.join(dir.path, "escape")
    const outside = path.join(dir.path, "outside")
    await Promise.all([server, main, escape, outside].map((item) => fs.mkdir(item)))
    await Promise.all([
      fs.mkdir(path.join(server, "src")),
      fs.mkdir(path.join(main, "dist")),
      Bun.write(path.join(server, "package.json"), JSON.stringify({ exports: { "./server": "./src" } })),
      Bun.write(path.join(main, "package.json"), JSON.stringify({ main: "./dist" })),
      Bun.write(path.join(escape, "package.json"), JSON.stringify({ main: "./linked" })),
      Bun.write(path.join(outside, "index.ts"), "export default async () => ({})"),
    ])
    await Promise.all([
      Bun.write(path.join(server, "src", "index.ts"), "export default async () => ({})"),
      Bun.write(path.join(main, "dist", "index.js"), "export default async () => ({})"),
      fs.symlink(outside, path.join(escape, "linked")),
    ])
    const npm = Npm.Service.of({
      add: () => Effect.die("unused"),
      install: () => Effect.die("unused"),
      which: () => Effect.succeed(Option.none()),
    })
    const resolve = (root: string) => PluginPackage.resolve({ spec: root, source: "config", directory: dir.path, npm })
    expect((await resolve(server)).entry).toBe(path.join(server, "src", "index.ts"))
    expect((await resolve(main)).entry).toBe(path.join(main, "dist", "index.js"))
    await expect(resolve(escape)).rejects.toMatchObject({ stage: "entrypoint" })
  })

  test("classifies malformed package metadata as entrypoint inspection", async () => {
    await using dir = await tmpdir()
    await Bun.write(path.join(dir.path, "package.json"), "{")
    const npm = Npm.Service.of({
      add: () => Effect.die("unused"),
      install: () => Effect.die("unused"),
      which: () => Effect.succeed(Option.none()),
    })
    await expect(
      PluginPackage.resolve({ spec: dir.path, source: "/config/slopcode.json", directory: dir.path, npm }),
    ).rejects.toMatchObject({ stage: "entrypoint" })
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
    await expect(
      PluginPackage.resolve({
        spec: "test-plugin",
        source: "config",
        directory: dir.path,
        npm,
        version: "2.0.0-beta.1",
      }),
    ).resolves.toMatchObject({ local: false })
    await expect(
      PluginPackage.resolve({ spec: "test-plugin", source: "config", directory: dir.path, npm, version: "3.0.0" }),
    ).resolves.toMatchObject({ local: false })
  })

  test("matches deprecated npm identities exactly", () => {
    expect(PluginPackage.isDeprecated("slopcode-openai-codex-auth")).toBe(true)
    expect(PluginPackage.isDeprecated("slopcode-openai-codex-auth@1.2.3")).toBe(true)
    expect(PluginPackage.isDeprecated("alias@npm:slopcode-openai-codex-auth@1.2.3")).toBe(true)
    expect(PluginPackage.isDeprecated("not-slopcode-openai-codex-auth")).toBe(false)
    expect(PluginPackage.isDeprecated("./slopcode-openai-codex-auth.ts")).toBe(false)
  })

  it.effect("does not let an invalid modern alias suppress a later valid alias", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            Bun.write(
              path.join(dir.path, "aliases.ts"),
              `const server = async () => ({
                tool: { alias_tool: { description: "alias", args: {}, execute: async () => "ok" } }
              })
              export const invalid = { id: "", server }
              export const valid = { id: "valid-alias", server }`,
            ),
          )
          const location = Location.Service.of({
            directory: AbsolutePath.make(dir.path),
            project: { id: "project" as never, directory: AbsolutePath.make(dir.path) },
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
            Effect.provideService(
              Config.Service,
              Config.Service.of({
                entries: () =>
                  Effect.succeed([
                    new Config.Document({
                      type: "document",
                      path: path.join(dir.path, "slopcode.json"),
                      info: new Config.Info({ plugins: ["./aliases.ts"] }),
                    }),
                  ]),
              }),
            ),
            Effect.provideService(Location.Service, location),
            Effect.provideService(
              Npm.Service,
              Npm.Service.of({
                install: () => Effect.void,
                add: () => Effect.die("unused"),
                which: () => Effect.die("unused"),
              }),
            ),
          )
          expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((item) => item.name)).toContain(
            "alias_tool",
          )
        }),
      ),
    ),
  )

  it.effect("retries one declared dependency import only and never retries sources, user errors, or factories", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          published.length = 0
          Object.assign(globalThis, { __h5c3b_factory: 0 })
          yield* Effect.promise(() =>
            Promise.all([
              Bun.write(
                path.join(dir.path, "package.json"),
                JSON.stringify({ dependencies: { "retry-dep": "1.0.0" } }),
              ),
              Bun.write(
                path.join(dir.path, "lookalike.ts"),
                `throw Object.assign(new Error("Cannot find package 'retry-dep'"), { code: "USER_ERROR" })`,
              ),
              Bun.write(
                path.join(dir.path, "factory-once.ts"),
                `export default async () => {
                  globalThis.__h5c3b_factory++
                  throw new Error("Cannot find package 'retry-dep'")
                }`,
              ),
              Bun.write(
                path.join(dir.path, "dependency.ts"),
                `import value from "retry-dep"
                 export default async () => ({
                   tool: { retry_tool: { description: "retry", args: {}, execute: async () => value } }
                 })`,
              ),
            ]),
          )
          const location = Location.Service.of({
            directory: AbsolutePath.make(dir.path),
            project: { id: "project" as never, directory: AbsolutePath.make(dir.path) },
          })
          const adapter = PluginTool.layer.pipe(
            Layer.provide(plugins),
            Layer.provide(registry),
            Layer.provide(permission),
            Layer.provide(Layer.succeed(Location.Service, location)),
            Layer.provide(events),
          )
          let installs = 0
          yield* PluginPackage.load.pipe(
            Effect.provide(adapter),
            Effect.provideService(
              Config.Service,
              Config.Service.of({
                entries: () =>
                  Effect.succeed([
                    new Config.Document({
                      type: "document",
                      path: path.join(dir.path, "slopcode.json"),
                      info: new Config.Info({
                        plugins: ["./missing.ts", "./lookalike.ts", "./factory-once.ts", "./dependency.ts"],
                      }),
                    }),
                  ]),
              }),
            ),
            Effect.provideService(Location.Service, location),
            Effect.provideService(
              Npm.Service,
              Npm.Service.of({
                install: () =>
                  Effect.promise(async () => {
                    installs++
                    if (installs !== 2) return
                    const root = path.join(dir.path, "node_modules", "retry-dep")
                    await fs.mkdir(root, { recursive: true })
                    await Bun.write(
                      path.join(root, "package.json"),
                      JSON.stringify({ type: "module", main: "index.js" }),
                    )
                    await Bun.write(path.join(root, "index.js"), `export default "retried"`)
                  }),
                add: () => Effect.die("unused"),
                which: () => Effect.die("unused"),
              }),
            ),
          )
          expect(installs).toBe(2)
          expect((globalThis as { __h5c3b_factory: number }).__h5c3b_factory).toBe(1)
          expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((item) => item.name)).toContain(
            "retry_tool",
          )
          expect(
            published
              .filter((item) => item.type === PluginV2.Event.Failed.type)
              .map((item) => (item.data as { package: string; stage: string }).package),
          ).toEqual(["./missing.ts", "./lookalike.ts", "./factory-once.ts"])
        }),
      ),
    ),
  )

  it.effect("reports dependency preparation against the declaring config source", () =>
    Effect.gen(function* () {
      published.length = 0
      const source = "/config/slopcode.json"
      yield* PluginPackage.load.pipe(
        Effect.provideService(
          Config.Service,
          Config.Service.of({
            entries: () =>
              Effect.succeed([
                new Config.Document({
                  type: "document",
                  path: source,
                  info: new Config.Info({ plugins: ["slopcode-openai-codex-auth"] }),
                }),
              ]),
          }),
        ),
        Effect.provideService(Location.Service, {
          directory: AbsolutePath.make("/project"),
          project: { id: "project" as never, directory: AbsolutePath.make("/project") },
        }),
        Effect.provideService(
          Npm.Service,
          Npm.Service.of({
            install: () => Effect.fail(new Npm.InstallFailedError({ dir: "/config" })),
            add: () => Effect.die("unused"),
            which: () => Effect.die("unused"),
          }),
        ),
      )
      expect(published[0]).toEqual({
        type: PluginV2.Event.Failed.type,
        data: expect.objectContaining({ package: source, source, stage: "install" }),
      })
    }),
  )

  it.effect("loads npm packages with stable IDs, replacement order, hooks, and configured disposal", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          published.length = 0
          Object.assign(globalThis, { __h5c3b_npm: [] as string[] })
          const roots = Object.fromEntries(
            ["first-plugin", "second-plugin", "default-plugin"].map((name) => [name, path.join(dir.path, name)]),
          )
          yield* Effect.promise(() => Promise.all(Object.values(roots).map((root) => fs.mkdir(root))))
          yield* Effect.promise(() =>
            Promise.all([
              ...Object.entries(roots).map(([name, root]) =>
                Bun.write(path.join(root, "package.json"), JSON.stringify({ name, main: "index.ts" })),
              ),
              Bun.write(
                path.join(roots["first-plugin"], "index.ts"),
                `export default { id: "shared-npm", server: async () => {
                  globalThis.__h5c3b_npm.push("first")
                  return {
                    tool: { npm_tool: { description: "first", args: {}, execute: async () => "first" } },
                    dispose: () => globalThis.__h5c3b_npm.push("dispose-first")
                  }
                } }`,
              ),
              Bun.write(
                path.join(roots["second-plugin"], "index.ts"),
                `export default { id: "shared-npm", server: async () => {
                  globalThis.__h5c3b_npm.push("second")
                  return {
                    tool: { npm_tool: { description: "second", args: {}, execute: async () => "second" } },
                    "tool.execute.before": async (_input, output) => { output.args = { changed: true } },
                    "tool.execute.after": async (_input, output) => { output.output += ":after" },
                    dispose: () => globalThis.__h5c3b_npm.push("dispose-second")
                  }
                } }`,
              ),
              Bun.write(
                path.join(roots["default-plugin"], "index.ts"),
                `export default async () => {
                  globalThis.__h5c3b_npm.push("default")
                  return {}
                }`,
              ),
            ]),
          )
          const location = Location.Service.of({
            directory: AbsolutePath.make(dir.path),
            project: { id: "project" as never, directory: AbsolutePath.make(dir.path) },
          })
          const adapter = PluginTool.layer.pipe(
            Layer.provide(plugins),
            Layer.provide(registry),
            Layer.provide(permission),
            Layer.provide(Layer.succeed(Location.Service, location)),
            Layer.provide(events),
          )
          const added: string[] = []
          yield* PluginPackage.load.pipe(
            Effect.provide(adapter),
            Effect.provideService(
              Config.Service,
              Config.Service.of({
                entries: () =>
                  Effect.succeed([
                    new Config.Document({
                      type: "document",
                      path: path.join(dir.path, "slopcode.json"),
                      info: new Config.Info({ plugins: ["first-plugin", "second-plugin", "default-plugin"] }),
                    }),
                  ]),
              }),
            ),
            Effect.provideService(Location.Service, location),
            Effect.provideService(
              Npm.Service,
              Npm.Service.of({
                install: () => Effect.void,
                add: (spec) =>
                  Effect.sync(() => {
                    added.push(spec)
                    return { directory: roots[spec], entrypoint: Option.none<string>() }
                  }),
                which: () => Effect.die("unused"),
              }),
            ),
          )
          const plugin = yield* PluginV2.Service
          expect(added).toEqual(["first-plugin", "second-plugin", "default-plugin"])
          expect((globalThis as { __h5c3b_npm: string[] }).__h5c3b_npm).toEqual([
            "first",
            "second",
            "dispose-first",
            "default",
          ])
          expect(
            (yield* (yield* ToolRegistry.Service).materialize()).definitions.find((item) => item.name === "npm_tool")
              ?.description,
          ).toBe("second")
          expect(
            yield* plugin.triggerFor(
              PluginV2.ID.make("shared-npm"),
              "tool.execute.before",
              { tool: "npm_tool", sessionID: "session", callID: "call" },
              { args: {} },
            ),
          ).toMatchObject({ args: { changed: true } })
          expect(
            yield* plugin.triggerFor(
              PluginV2.ID.make("shared-npm"),
              "tool.execute.after",
              { tool: "npm_tool", sessionID: "session", callID: "call", args: {} },
              { output: "result" },
            ),
          ).toMatchObject({ output: "result:after" })
          expect(published.filter((item) => item.type === PluginV2.Event.Added.type).map((item) => item.data)).toEqual([
            { id: PluginV2.ID.make("shared-npm") },
            { id: PluginV2.ID.make("shared-npm") },
            { id: PluginV2.ID.make("default-plugin#default") },
          ])
          yield* plugin.remove(PluginV2.ID.make("shared-npm"))
          expect((globalThis as { __h5c3b_npm: string[] }).__h5c3b_npm).toContain("dispose-second")
        }),
      ),
    ),
  )

  test("uses a typed unavailable transport instead of ambient network fetch", async () => {
    await expect(PluginPackage.unavailable(new Request("http://unavailable.invalid/project"))).rejects.toBeInstanceOf(
      PluginPackage.ClientUnavailableError,
    )
  })

  it.effect("fails an actual embedded SDK client call through the typed unavailable transport", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          published.length = 0
          yield* Effect.promise(() =>
            Bun.write(
              path.join(dir.path, "client.ts"),
              `export default async (input) => {
                await input.client.project.list()
                return {}
              }`,
            ),
          )
          yield* PluginPackage.load.pipe(
            Effect.provideService(
              Config.Service,
              Config.Service.of({
                entries: () =>
                  Effect.succeed([
                    new Config.Document({
                      type: "document",
                      path: path.join(dir.path, "slopcode.json"),
                      info: new Config.Info({ plugins: ["./client.ts"] }),
                    }),
                  ]),
              }),
            ),
            Effect.provideService(Location.Service, {
              directory: AbsolutePath.make(dir.path),
              project: { id: "project" as never, directory: AbsolutePath.make(dir.path) },
            }),
            Effect.provideService(
              Npm.Service,
              Npm.Service.of({
                install: () => Effect.void,
                add: () => Effect.die("unused"),
                which: () => Effect.die("unused"),
              }),
            ),
          )
          expect(published).toContainEqual({
            type: PluginV2.Event.Failed.type,
            data: expect.objectContaining({
              package: "./client.ts",
              stage: "factory",
              message: expect.stringContaining("No local plugin SDK transport is installed"),
            }),
          })
        }),
      ),
    ),
  )
})
