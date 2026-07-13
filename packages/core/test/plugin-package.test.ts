import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Context, Deferred, Effect, Exit, Fiber, Layer, Option, Scope } from "effect"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { ApplicationTools } from "@slopcode-ai/core/tool/application-tools"
import { Config } from "@slopcode-ai/core/config"
import { ConfigPlugin } from "@slopcode-ai/core/config/plugin"
import { ConfigToolOutput } from "@slopcode-ai/core/config/tool-output"
import { EventV2 } from "@slopcode-ai/core/event"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { Global } from "@slopcode-ai/core/global"
import { Location } from "@slopcode-ai/core/location"
import { Npm } from "@slopcode-ai/core/npm"
import { PermissionV2 } from "@slopcode-ai/core/permission"
import { PluginV2 } from "@slopcode-ai/core/plugin"
import { PluginPackage } from "@slopcode-ai/core/plugin/package"
import { PluginTool } from "@slopcode-ai/core/plugin/tool"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionEvent } from "@slopcode-ai/core/session/event"
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
const identity = {
  sessionID: SessionV2.ID.make("ses_configured_package"),
  agent: AgentV2.ID.make("build"),
  assistantMessageID: SessionMessage.ID.make("msg_configured_package"),
}

const settle = (tools: ToolRegistry.Materialization, name: string, input: unknown = {}) =>
  tools.settle({ ...identity, call: { type: "tool-call", id: `call-${name}`, name, input } })

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
                register: () => () => {},
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

  test("contains direct and root-index symlinks while accepting absolute paths and file URLs", async () => {
    await using dir = await tmpdir()
    const config = path.join(dir.path, "config")
    const outside = path.join(dir.path, "outside.ts")
    const indexed = path.join(config, "indexed")
    await fs.mkdir(config)
    await fs.mkdir(indexed)
    await Bun.write(outside, "export default async () => ({})")
    await fs.symlink(outside, path.join(config, "direct.ts"))
    await fs.symlink(outside, path.join(indexed, "index.ts"))
    const npm = Npm.Service.of({
      add: () => Effect.die("unused"),
      install: () => Effect.die("unused"),
      which: () => Effect.succeed(Option.none()),
    })
    const resolve = (spec: string) =>
      PluginPackage.resolve({ spec, source: path.join(config, "slopcode.json"), directory: config, npm })
    await expect(resolve("./direct.ts")).rejects.toMatchObject({ stage: "entrypoint" })
    await expect(resolve("./indexed")).rejects.toMatchObject({ stage: "entrypoint" })
    await expect(resolve(outside)).resolves.toMatchObject({ entry: outside })
    await expect(resolve(pathToFileURL(outside).href)).resolves.toMatchObject({ entry: outside })
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
          Object.assign(globalThis, { __h5c3b_factory: 0, __h5c3b_retry_factory: 0 })
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
                `import value from "./dependency-child"
                 export default async () => {
                   globalThis.__h5c3b_retry_factory++
                   return { tool: { retry_tool: { description: "retry", args: {}, execute: async () => value } } }
                 }`,
              ),
              Bun.write(path.join(dir.path, "dependency-child.ts"), `export { default } from "retry-dep/subpath"`),
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
                      JSON.stringify({ type: "module", exports: { "./subpath": "./subpath.js" } }),
                    )
                    await Bun.write(path.join(root, "subpath.js"), `export default "retried"`)
                  }),
                add: () => Effect.die("unused"),
                which: () => Effect.die("unused"),
              }),
            ),
          )
          expect(installs).toBe(2)
          expect((globalThis as { __h5c3b_factory: number }).__h5c3b_factory).toBe(1)
          expect((globalThis as { __h5c3b_retry_factory: number }).__h5c3b_retry_factory).toBe(1)
          expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((item) => item.name)).toContain(
            "retry_tool",
          )
          expect(
            (yield* Effect.promise(() => fs.readdir(dir.path))).some((name) => name.includes("slopcode-retry")),
          ).toBe(false)
          expect(
            published
              .filter((item) => item.type === PluginV2.Event.Failed.type)
              .map((item) => (item.data as { package: string; stage: string }).package),
          ).toEqual(["./missing.ts", "./lookalike.ts", "./factory-once.ts"])
        }),
      ),
    ),
  )

  it.effect("retries scoped dependency subpaths by root package identity", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            Promise.all([
              Bun.write(
                path.join(dir.path, "package.json"),
                JSON.stringify({ dependencies: { "@scope/retry": "1.0.0" } }),
              ),
              Bun.write(path.join(dir.path, "plugin.ts"), `export { default } from "./child"`),
              Bun.write(
                path.join(dir.path, "child.ts"),
                `import value from "@scope/retry/subpath"
                 export default async () => ({ tool: { scoped_retry: { description: "scoped", args: {}, execute: async () => value } } })`,
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
                      info: new Config.Info({ plugins: ["./plugin.ts"] }),
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
                    const root = path.join(dir.path, "node_modules", "@scope", "retry")
                    await fs.mkdir(root, { recursive: true })
                    await Bun.write(
                      path.join(root, "package.json"),
                      JSON.stringify({ type: "module", exports: { "./subpath": "./subpath.js" } }),
                    )
                    await Bun.write(path.join(root, "subpath.js"), `export default "scoped"`)
                  }),
                add: () => Effect.die("unused"),
                which: () => Effect.die("unused"),
              }),
            ),
          )
          expect(installs).toBe(2)
          expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((item) => item.name)).toContain(
            "scoped_retry",
          )
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

  it.effect("does not retry an eligible import after retry dependency installation fails", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          published.length = 0
          yield* Effect.promise(() =>
            Promise.all([
              Bun.write(path.join(dir.path, "package.json"), JSON.stringify({ dependencies: { absent: "1" } })),
              Bun.write(path.join(dir.path, "plugin.ts"), `import "absent"; export default async () => ({})`),
            ]),
          )
          let installs = 0
          yield* PluginPackage.load.pipe(
            Effect.provideService(
              Config.Service,
              Config.Service.of({
                entries: () =>
                  Effect.succeed([
                    new Config.Document({
                      type: "document",
                      path: path.join(dir.path, "slopcode.json"),
                      info: new Config.Info({ plugins: ["./plugin.ts"] }),
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
                install: () => {
                  installs++
                  return installs === 1 ? Effect.void : Effect.fail(new Npm.InstallFailedError({ dir: dir.path }))
                },
                add: () => Effect.die("unused"),
                which: () => Effect.die("unused"),
              }),
            ),
          )
          expect(installs).toBe(2)
          expect(published.filter((item) => item.type === PluginV2.Event.Failed.type).map((item) => item.data)).toEqual(
            [expect.objectContaining({ package: "./plugin.ts", stage: "install" })],
          )
        }),
      ),
    ),
  )

  it.effect("publishes one attributed configured registration failure", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          published.length = 0
          yield* Effect.promise(() =>
            Bun.write(
              path.join(dir.path, "plugin.ts"),
              `export default async () => ({ tool: { "bad name": { description: "bad", args: {}, execute: async () => "bad" } } })`,
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
                      info: new Config.Info({ plugins: ["./plugin.ts"] }),
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
          expect(published.filter((item) => item.type === PluginV2.Event.Failed.type)).toEqual([
            expect.objectContaining({
              data: expect.objectContaining({
                package: "./plugin.ts",
                source: path.join(dir.path, "slopcode.json"),
                stage: "hook-shape",
              }),
            }),
          ])
        }),
      ),
    ),
  )

  it.effect("contains hostile hook enumeration as one attributed failure and continues", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          published.length = 0
          Object.assign(globalThis, { __h5c3b_hostile_dispose: [] as string[] })
          yield* Effect.promise(() =>
            Promise.all([
              Bun.write(
                path.join(dir.path, "hostile.ts"),
                `export default async () => new Proxy({
                  dispose() { globalThis.__h5c3b_hostile_dispose.push("ownKeys"); throw new Error("cleanup defect") }
                }, { ownKeys() { throw new Error("hostile ownKeys") } })`,
              ),
              Bun.write(
                path.join(dir.path, "getter.ts"),
                `export default async () => new Proxy({
                  dispose() { globalThis.__h5c3b_hostile_dispose.push("getter") }
                }, { get(target, key) { if (key === "tool") throw new Error("hostile getter"); return Reflect.get(target, key) } })`,
              ),
              Bun.write(
                path.join(dir.path, "healthy.ts"),
                `export default async () => ({ tool: { proxy_healthy: { description: "healthy", args: {}, execute: async () => "healthy" } } })`,
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
                      info: new Config.Info({ plugins: ["./hostile.ts", "./getter.ts", "./healthy.ts"] }),
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
          expect(published.filter((item) => item.type === PluginV2.Event.Failed.type)).toEqual([
            expect.objectContaining({
              data: expect.objectContaining({
                package: "./hostile.ts",
                stage: "hook-shape",
                message: "hostile ownKeys",
              }),
            }),
            expect.objectContaining({
              data: expect.objectContaining({ package: "./getter.ts", stage: "hook-shape", message: "hostile getter" }),
            }),
          ])
          expect((globalThis as { __h5c3b_hostile_dispose: string[] }).__h5c3b_hostile_dispose).toEqual([
            "ownKeys",
            "getter",
          ])
          expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((item) => item.name)).toContain(
            "proxy_healthy",
          )
        }),
      ),
    ),
  )

  it.effect("isolates modern export inspection traps and loads later aliases in the same module", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          published.length = 0
          yield* Effect.promise(() =>
            Bun.write(
              path.join(dir.path, "exports.ts"),
              `const server = async () => ({ tool: { export_healthy: { description: "healthy", args: {}, execute: async () => "ok" } } })
               export const inTrap = new Proxy({}, { has() { throw new Error("server in trap") } })
               export const getTrap = new Proxy({}, { has(_target, key) { return key === "server" }, get() { throw new Error("server get trap") } })
               export const idTrap = { server, get id() { throw new Error("id get trap") } }
               export const healthy = { id: "export-healthy", server }`,
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
                      info: new Config.Info({ plugins: ["./exports.ts"] }),
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
          expect(
            published
              .filter((item) => item.type === PluginV2.Event.Failed.type)
              .map((item) => (item.data as { message: string }).message),
          ).toEqual(["server get trap", "id get trap", "server in trap"])
          expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((item) => item.name)).toContain(
            "export_healthy",
          )
        }),
      ),
    ),
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

  it.effect(
    "runs configured tools through function and nested CodeMode with lifecycle, permission, progress, and bounding",
    () =>
      Effect.acquireRelease(
        Effect.promise(() => tmpdir()),
        (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
      ).pipe(
        Effect.flatMap((dir) =>
          Effect.gen(function* () {
            published.length = 0
            const asked: PermissionV2.AssertInput[] = []
            const started = yield* Deferred.make<void>()
            const release = yield* Deferred.make<void>()
            Object.assign(globalThis, {
              __h5c3b_dispose: () =>
                Effect.runPromise(Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(release)))),
            })
            yield* Effect.promise(() =>
              Bun.write(
                path.join(dir.path, "plugin.ts"),
                `export default { id: "configured-seam", server: async () => ({
                tool: { configured_seam: {
                  description: "configured seam",
                  args: { value: { type: "string" } },
                  execute: async (args, context) => {
                    await context.ask({ permission: "network", patterns: ["host"], always: ["host"], metadata: {} })
                    context.metadata({ title: "working", metadata: { phase: "work" } })
                    return { output: args.value.repeat(500), metadata: { complete: true } }
                  }
                } },
                "tool.execute.before": async (_input, output) => { output.args.value = output.args.value.trim() },
                "tool.execute.after": async (_input, output) => { output.title = "finished" },
                dispose: () => globalThis.__h5c3b_dispose()
              }) }`,
              ),
            )
            const config = Layer.succeed(Config.Service, {
              entries: () =>
                Effect.succeed([
                  new Config.Document({
                    type: "document",
                    path: path.join(dir.path, "slopcode.json"),
                    info: new Config.Info({
                      plugins: ["./plugin.ts"],
                      tool_output: new ConfigToolOutput.Info({ max_lines: 4, max_bytes: 200 }),
                    }),
                  }),
                ]),
            })
            const localPermission = Layer.mock(PermissionV2.Service, {
              assert: (input) => Effect.sync(() => asked.push(input)),
              ask: () => Effect.die("unused"),
              reply: () => Effect.die("unused"),
              get: () => Effect.die("unused"),
              forSession: () => Effect.die("unused"),
              list: () => Effect.die("unused"),
            })
            const store = ToolOutputStore.layer.pipe(
              Layer.provide(FSUtil.defaultLayer),
              Layer.provide(Global.layerWith({ data: dir.path })),
              Layer.provide(config),
            )
            const localRegistry = ToolRegistry.layer.pipe(Layer.provide(ApplicationTools.layer), Layer.provide(store))
            const localPlugins = PluginV2.layer.pipe(Layer.provide(events))
            const localLocation = Layer.succeed(Location.Service, {
              directory: AbsolutePath.make(dir.path),
              project: { id: "project" as never, directory: AbsolutePath.make(dir.path) },
            })
            const localAdapter = PluginTool.layer.pipe(
              Layer.provide(localPlugins),
              Layer.provide(localRegistry),
              Layer.provide(localPermission),
              Layer.provide(localLocation),
              Layer.provide(events),
            )
            const scope = yield* Scope.make()
            const context = yield* Layer.buildWithScope(
              Layer.fresh(
                Layer.mergeAll(
                  localPlugins,
                  localRegistry,
                  localAdapter,
                  localPermission,
                  localLocation,
                  events,
                  store,
                  config,
                  FSUtil.defaultLayer,
                ),
              ),
              scope,
            )
            const plugin = Context.get(context, PluginV2.Service)
            const tools = Context.get(context, ToolRegistry.Service)
            yield* PluginPackage.load.pipe(
              Effect.provideService(PluginV2.Service, plugin),
              Effect.provideService(EventV2.Service, Context.get(context, EventV2.Service)),
              Effect.provideService(Config.Service, Context.get(context, Config.Service)),
              Effect.provideService(Location.Service, Context.get(context, Location.Service)),
              Effect.provideService(
                Npm.Service,
                Npm.Service.of({
                  install: () => Effect.void,
                  add: () => Effect.die("unused"),
                  which: () => Effect.die("unused"),
                }),
              ),
            )
            const direct = yield* settle(yield* tools.materialize(), "configured_seam", { value: " x " })
            expect(direct.outputPaths).toHaveLength(1)
            expect(direct.output?.content[0]).toMatchObject({
              type: "text",
              text: expect.stringContaining("truncated"),
            })
            expect(yield* Context.get(context, FSUtil.Service).readFileString(direct.outputPaths![0])).toBe(
              "x".repeat(500),
            )
            const code = yield* (yield* tools.materialize([], { mode: "code-only" })).settle({
              ...identity,
              call: {
                type: "tool-call",
                toolType: "custom",
                id: "call-code",
                name: "exec",
                input: `return await tools.configured_seam({ value: " y " })`,
              },
            })
            expect(code.output?.structured).toMatchObject({ ok: true })
            expect(asked).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  action: "network",
                  source: expect.objectContaining({ type: "tool" }),
                }),
              ]),
            )
            expect(
              published.filter((item) => item.type === SessionEvent.Tool.Progress.type).map((item) => item.data),
            ).toEqual(
              expect.arrayContaining([expect.objectContaining({ content: [{ type: "text", text: "working" }] })]),
            )
            const removing = yield* plugin.remove(PluginV2.ID.make("configured-seam")).pipe(Effect.forkChild)
            yield* Deferred.await(started)
            expect((yield* tools.materialize()).definitions.some((item) => item.name === "configured_seam")).toBe(false)
            yield* Deferred.succeed(release, undefined)
            yield* Fiber.join(removing)
            yield* Scope.close(scope, Exit.void)
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

  it.effect("cleans workspace registrations on failure, replacement, empty replacement, and slow removal", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            Promise.all([
              Bun.write(
                path.join(dir.path, "first.ts"),
                `export default { id: "adapter-shared", server: async (input) => { input.experimental_workspace.register("shared", { name: "first" }); return {} } }`,
              ),
              Bun.write(
                path.join(dir.path, "second.ts"),
                `export default { id: "adapter-shared", server: async (input) => { input.experimental_workspace.register("shared", { name: "second" }); return {} } }`,
              ),
              Bun.write(
                path.join(dir.path, "failed.ts"),
                `export default { id: "adapter-failed", server: async (input) => { input.experimental_workspace.register("failed", { name: "failed" }); throw new Error("factory failed") } }`,
              ),
              Bun.write(
                path.join(dir.path, "empty.ts"),
                `export default { id: "adapter-shared", server: async () => ({}) }`,
              ),
              Bun.write(
                path.join(dir.path, "slow.ts"),
                `export default { id: "adapter-slow", server: async (input) => { input.experimental_workspace.register("slow", { name: "slow" }); return { dispose: () => globalThis.__adapter_slow() } } }`,
              ),
            ]),
          )
          const location = Location.Service.of({
            directory: AbsolutePath.make(dir.path),
            project: { id: "adapter-project" as never, directory: AbsolutePath.make(dir.path) },
          })
          const active = new Map<string, Array<{ token: symbol; adapter: unknown }>>()
          const host = PluginPackage.Host.of({
            baseUrl: new URL("http://adapter.test"),
            fetch: async () => Response.json([]),
            register: (_projectID, type, adapter) => {
              const token = Symbol(type)
              active.set(type, [...(active.get(type) ?? []), { token, adapter }])
              return () => {
                const entries = active.get(type)?.filter((entry) => entry.token !== token) ?? []
                if (entries.length) active.set(type, entries)
                if (!entries.length) active.delete(type)
              }
            },
          })
          const npm = Npm.Service.of({
            install: () => Effect.void,
            add: () => Effect.die("unused"),
            which: () => Effect.die("unused"),
          })
          const load = (spec: string) =>
            PluginPackage.load.pipe(
              Effect.provideService(
                Config.Service,
                Config.Service.of({
                  entries: () =>
                    Effect.succeed([
                      new Config.Document({
                        type: "document",
                        path: path.join(dir.path, "slopcode.json"),
                        info: new Config.Info({ plugins: [spec] }),
                      }),
                    ]),
                }),
              ),
              Effect.provideService(Location.Service, location),
              Effect.provideService(Npm.Service, npm),
              Effect.provideService(PluginPackage.Host, host),
            )
          const current = (type: string) => active.get(type)?.at(-1)?.adapter as { name?: string } | undefined

          yield* load("./first.ts")
          expect(current("shared")?.name).toBe("first")
          yield* load("./second.ts")
          expect(current("shared")?.name).toBe("second")
          yield* load("./failed.ts")
          expect(current("failed")).toBeUndefined()
          expect(current("shared")?.name).toBe("second")
          yield* load("./empty.ts")
          expect(current("shared")).toBeUndefined()

          const started = yield* Deferred.make<void>()
          const release = yield* Deferred.make<void>()
          Object.assign(globalThis, {
            __adapter_slow: () =>
              Effect.runPromise(Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(release)))),
          })
          yield* load("./slow.ts")
          expect(current("slow")?.name).toBe("slow")
          const removing = yield* (yield* PluginV2.Service)
            .remove(PluginV2.ID.make("adapter-slow"))
            .pipe(Effect.forkChild)
          yield* Deferred.await(started)
          expect(current("slow")).toBeUndefined()
          yield* Deferred.succeed(release, undefined)
          yield* Fiber.join(removing)
        }),
      ),
    ),
  )

  it.effect("closes workspace registration ownership when a factory is interrupted", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            Bun.write(
              path.join(dir.path, "cancelled.ts"),
              `export default { id: "adapter-cancelled", server: async (input) => {
                input.experimental_workspace.register("during", { name: "during" })
                globalThis.__adapter_started()
                await globalThis.__adapter_release
                input.experimental_workspace.register("late", { name: "late" })
                return { dispose: () => globalThis.__adapter_disposed() }
              } }`,
            ),
          )
          const started = yield* Deferred.make<void>()
          const release = yield* Deferred.make<void>()
          const disposed = yield* Deferred.make<void>()
          const active = new Map<string, unknown>()
          Object.assign(globalThis, {
            __adapter_started: () => Effect.runSync(Deferred.succeed(started, undefined)),
            __adapter_release: Effect.runPromise(Deferred.await(release)),
            __adapter_disposed: () => Effect.runSync(Deferred.succeed(disposed, undefined)),
          })
          const load = PluginPackage.load.pipe(
            Effect.provideService(
              Config.Service,
              Config.Service.of({
                entries: () =>
                  Effect.succeed([
                    new Config.Document({
                      type: "document",
                      path: path.join(dir.path, "slopcode.json"),
                      info: new Config.Info({ plugins: ["./cancelled.ts"] }),
                    }),
                  ]),
              }),
            ),
            Effect.provideService(Location.Service, {
              directory: AbsolutePath.make(dir.path),
              project: { id: "adapter-cancelled" as never, directory: AbsolutePath.make(dir.path) },
            }),
            Effect.provideService(
              Npm.Service,
              Npm.Service.of({
                install: () => Effect.void,
                add: () => Effect.die("unused"),
                which: () => Effect.die("unused"),
              }),
            ),
            Effect.provideService(
              PluginPackage.Host,
              PluginPackage.Host.of({
                baseUrl: new URL("http://adapter.test"),
                fetch: async () => Response.json([]),
                register: (_projectID, type, adapter) => {
                  active.set(type, adapter)
                  return () => active.delete(type)
                },
              }),
            ),
          )
          const fiber = yield* load.pipe(Effect.forkChild)
          yield* Deferred.await(started)
          expect(active.has("during")).toBe(true)
          yield* Fiber.interrupt(fiber)
          expect(active.size).toBe(0)
          yield* Deferred.succeed(release, undefined)
          yield* Deferred.await(disposed)
          expect(active.size).toBe(0)
        }),
      ),
    ),
  )

  it.effect("closes inspected registrations when warning publication is interrupted", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            Bun.write(
              path.join(dir.path, "warning.ts"),
              `export default { id: "adapter-warning", server: async (input) => ({
                get dispose() {
                  input.experimental_workspace.register("inspected", { name: "inspected" })
                  return () => globalThis.__adapter_warning_disposed()
                },
                unsupported() {}
              }) }`,
            ),
          )
          const warning = yield* Deferred.make<void>()
          const active = new Map<string, unknown>()
          let disposed = 0
          Object.assign(globalThis, { __adapter_warning_disposed: () => disposed++ })
          const load = PluginPackage.load.pipe(
            Effect.provideService(
              Config.Service,
              Config.Service.of({
                entries: () =>
                  Effect.succeed([
                    new Config.Document({
                      type: "document",
                      path: path.join(dir.path, "slopcode.json"),
                      info: new Config.Info({ plugins: ["./warning.ts"] }),
                    }),
                  ]),
              }),
            ),
            Effect.provideService(Location.Service, {
              directory: AbsolutePath.make(dir.path),
              project: { id: "adapter-warning" as never, directory: AbsolutePath.make(dir.path) },
            }),
            Effect.provideService(
              Npm.Service,
              Npm.Service.of({
                install: () => Effect.void,
                add: () => Effect.die("unused"),
                which: () => Effect.die("unused"),
              }),
            ),
            Effect.provideService(
              PluginPackage.Host,
              PluginPackage.Host.of({
                baseUrl: new URL("http://adapter.test"),
                fetch: async () => Response.json([]),
                register: (_projectID, type, adapter) => {
                  active.set(type, adapter)
                  return () => active.delete(type)
                },
              }),
            ),
            Effect.provideService(
              EventV2.Service,
              Context.get(
                yield* Layer.build(
                  Layer.mock(EventV2.Service, {
                    publish: (definition, data) =>
                      definition.type === PluginV2.Event.Warning.type
                        ? Deferred.succeed(warning, undefined).pipe(Effect.andThen(Effect.never))
                        : Effect.succeed({ id: EventV2.ID.make("evt_warning_test"), type: definition.type, data }),
                  }),
                ),
                EventV2.Service,
              ),
            ),
          )
          const fiber = yield* load.pipe(Effect.forkChild)
          yield* Deferred.await(warning)
          expect(active.has("inspected")).toBe(true)
          yield* Fiber.interrupt(fiber)
          expect(active.size).toBe(0)
          expect(disposed).toBe(1)
        }),
      ),
    ),
  )

  it.effect("cleans workspace ownership before blocked factory and hook-shape failure publication", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            Promise.all([
              Bun.write(
                path.join(dir.path, "factory-failure.ts"),
                `export default { id: "factory-failure", server: async (input) => {
                  input.experimental_workspace.register("factory", { name: "factory" })
                  setTimeout(() => input.experimental_workspace.register("factory-late", { name: "factory-late" }), 0)
                  throw new Error("factory failure")
                } }`,
              ),
              Bun.write(
                path.join(dir.path, "shape-failure.ts"),
                `export default { id: "shape-failure", server: async (input) => {
                  input.experimental_workspace.register("shape", { name: "shape" })
                  return { dispose: () => globalThis.__shape_disposed(), "tool.execute.before": "invalid" }
                } }`,
              ),
            ]),
          )
          const active = new Map<string, unknown>()
          const npm = Npm.Service.of({
            install: () => Effect.void,
            add: () => Effect.die("unused"),
            which: () => Effect.die("unused"),
          })
          const host = PluginPackage.Host.of({
            baseUrl: new URL("http://adapter.test"),
            fetch: async () => Response.json([]),
            register: (_projectID, type, adapter) => {
              active.set(type, adapter)
              return () => active.delete(type)
            },
          })
          const load = (spec: string, service: EventV2.Service) =>
            PluginPackage.load.pipe(
              Effect.provideService(
                Config.Service,
                Config.Service.of({
                  entries: () =>
                    Effect.succeed([
                      new Config.Document({
                        type: "document",
                        path: path.join(dir.path, "slopcode.json"),
                        info: new Config.Info({ plugins: [spec] }),
                      }),
                    ]),
                }),
              ),
              Effect.provideService(Location.Service, {
                directory: AbsolutePath.make(dir.path),
                project: { id: "failure-project" as never, directory: AbsolutePath.make(dir.path) },
              }),
              Effect.provideService(Npm.Service, npm),
              Effect.provideService(PluginPackage.Host, host),
              Effect.provideService(EventV2.Service, service),
            )
          for (const spec of ["./factory-failure.ts", "./shape-failure.ts"]) {
            const started = yield* Deferred.make<void>()
            const release = yield* Deferred.make<void>()
            let failures = 0
            let disposed = 0
            Object.assign(globalThis, { __shape_disposed: () => disposed++ })
            const service = Context.get(
              yield* Layer.build(
                Layer.mock(EventV2.Service, {
                  publish: (definition, data) => {
                    if (definition.type !== PluginV2.Event.Failed.type)
                      return Effect.succeed({ id: EventV2.ID.make("evt_failure_test"), type: definition.type, data })
                    failures++
                    return Deferred.succeed(started, undefined).pipe(
                      Effect.andThen(Deferred.await(release)),
                      Effect.as({ id: EventV2.ID.make("evt_failure_test"), type: definition.type, data }),
                    )
                  },
                }),
              ),
              EventV2.Service,
            )
            const fiber = yield* load(spec, service).pipe(Effect.forkChild)
            yield* Deferred.await(started).pipe(
              Effect.timeout("1 second"),
              Effect.tapError(() => Deferred.succeed(release, undefined)),
            )
            yield* Effect.promise(() => Bun.sleep(10))
            const visible = active.size
            const cleaned = disposed
            const reported = failures
            yield* Deferred.succeed(release, undefined)
            yield* Fiber.join(fiber).pipe(Effect.timeout("1 second"))
            expect(visible).toBe(0)
            expect(cleaned).toBe(spec.includes("shape") ? 1 : 0)
            expect(reported).toBe(1)
            expect(failures).toBe(1)
          }
        }),
      ),
    ),
  )
})
