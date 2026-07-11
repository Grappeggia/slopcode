import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Context, Effect, Equal, Exit, Hash, Layer, Schema, Scope } from "effect"
import { Tool } from "@slopcode-ai/core/public"
import { Catalog } from "@slopcode-ai/core/catalog"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { Location } from "@slopcode-ai/core/location"
import { PluginBoot } from "@slopcode-ai/core/plugin/boot"
import { PluginV2 } from "@slopcode-ai/core/plugin"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { tmpdir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"
import { toolDefinitions } from "./lib/tool"
import { FSUtil } from "../src/fs-util"
import { Credential } from "../src/credential"
import { Database } from "../src/database/database"
import { EventV2 } from "../src/event"
import { Global } from "../src/global"
import { ModelsDev } from "../src/models-dev"
import { Npm } from "../src/npm"
import { Project } from "../src/project"
import { Reference } from "../src/reference"
import { ToolRegistry } from "../src/tool/registry"
import { ApplicationTools } from "../src/tool/application-tools"

const applicationTools = ApplicationTools.layer
const it = testEffect(
  Layer.merge(
    Layer.mergeAll(applicationTools, Database.defaultLayer, EventV2.defaultLayer),
    LocationServiceMap.layer.pipe(
      Layer.provide(applicationTools),
      Layer.provide(
        Layer.mergeAll(
          Project.defaultLayer,
          EventV2.defaultLayer,
          Credential.defaultLayer,
          Credential.layer.pipe(Layer.provide(Database.layerFromPath(":memory:").pipe(Layer.fresh))),
          Npm.defaultLayer,
          ModelsDev.defaultLayer,
          FSUtil.defaultLayer,
          Global.defaultLayer,
        ),
      ),
    ),
  ),
)

describe("LocationServiceMap", () => {
  it.live("disposes a programmatic plugin exactly once on Location shutdown", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          const ref = Location.Ref.make({ directory: AbsolutePath.make(dir.path) })
          const scope = yield* Scope.make()
          const context = yield* Layer.buildWithScope(LocationServiceMap.get(ref), scope)
          yield* Context.get(context, PluginBoot.Service).wait()
          let disposed = 0
          yield* Context.get(context, PluginV2.Service).add({
            id: PluginV2.ID.make("location-dispose"),
            effect: Effect.succeed({
              tool: { location_dispose: { description: "location", args: {}, execute: async () => "location" } },
              dispose: () => {
                disposed++
              },
            }),
          })
          expect(
            (yield* Context.get(context, ToolRegistry.Service).materialize()).definitions.some(
              (tool) => tool.name === "location_dispose",
            ),
          ).toBe(true)
          yield* Scope.close(scope, Exit.void)
          yield* LocationServiceMap.invalidate(ref)
          expect(disposed).toBe(1)
        }),
      ),
    ),
  )

  it.live("completes PluginBoot after a bad local tool and keeps later healthy tools", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          const tools = path.join(dir.path, ".slopcode", "tool")
          yield* Effect.promise(() => fs.mkdir(tools, { recursive: true }))
          yield* Effect.promise(() =>
            Promise.all([
              fs.writeFile(
                path.join(tools, "bad.ts"),
                `export default { description: "bad", args: { value: { type: "string", invalid: undefined } }, execute: async () => "bad" }`,
              ),
              fs.writeFile(
                path.join(tools, "healthy.ts"),
                `export default { description: "healthy", args: {}, execute: async () => "healthy" }`,
              ),
            ]),
          )
          const result = yield* Effect.gen(function* () {
            yield* (yield* PluginBoot.Service).wait()
            return yield* toolDefinitions(yield* ToolRegistry.Service)
          }).pipe(
            Effect.scoped,
            Effect.provide(LocationServiceMap.get(Location.Ref.make({ directory: AbsolutePath.make(dir.path) }))),
          )
          expect(result.some((tool) => tool.name === "bad")).toBe(false)
          expect(result.some((tool) => tool.name === "healthy")).toBe(true)
        }),
      ),
    ),
  )

  it.live("completes PluginBoot after a failed configured plugin and loads the next package", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (dir) => Effect.promise(() => dir[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((dir) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            Promise.all([
              Bun.write(
                path.join(dir.path, "slopcode.json"),
                JSON.stringify({ plugins: ["./failed.ts", "./healthy.ts"] }),
              ),
              Bun.write(path.join(dir.path, "failed.ts"), `export default async () => { throw new Error("failed") }`),
              Bun.write(
                path.join(dir.path, "healthy.ts"),
                `export default async () => ({
                  tool: { configured_healthy: { description: "healthy", args: {}, execute: async () => "healthy" } }
                })`,
              ),
            ]),
          )
          const result = yield* Effect.gen(function* () {
            yield* (yield* PluginBoot.Service).wait()
            return yield* toolDefinitions(yield* ToolRegistry.Service)
          }).pipe(
            Effect.scoped,
            Effect.provide(LocationServiceMap.get(Location.Ref.make({ directory: AbsolutePath.make(dir.path) }))),
          )
          expect(result.some((tool) => tool.name === "configured_healthy")).toBe(true)
        }),
      ),
    ),
  )

  it.effect("compares equivalent location refs by value", () =>
    Effect.sync(() => {
      const directory = AbsolutePath.make("/project")
      expect(Equal.equals(Location.Ref.make({ directory }), Location.Ref.make({ directory }))).toBe(true)
      expect(Hash.hash(Location.Ref.make({ directory }))).toBe(
        Hash.hash(Location.Ref.make({ directory, workspaceID: undefined })),
      )
    }),
  )

  it.live("isolates location state while sharing location policy with catalog", () =>
    Effect.acquireRelease(
      Effect.promise(() => Promise.all([tmpdir(), tmpdir()])),
      (dirs) => Effect.promise(() => Promise.all(dirs.map((dir) => dir[Symbol.asyncDispose]())).then(() => undefined)),
    ).pipe(
      Effect.flatMap(([blocked, allowed]) =>
        Effect.gen(function* () {
          yield* (yield* ApplicationTools.Service).register({
            application_context: Tool.make({
              description: "Read application context",
              input: Schema.Struct({}),
              output: Schema.Struct({ ok: Schema.Boolean }),
              execute: () => Effect.succeed({ ok: true }),
            }),
          })
          yield* Effect.promise(() =>
            fs.writeFile(
              path.join(blocked.path, "slopcode.json"),
              JSON.stringify({
                experimental: { policies: [{ effect: "deny", action: "provider.use", resource: "test" }] },
              }),
            ),
          )

          const update = (directory: string) =>
            Effect.gen(function* () {
              yield* PluginBoot.Service.use((boot) => boot.wait())
              yield* Reference.Service
              const catalog = yield* Catalog.Service
              yield* catalog.transform((editor) => editor.provider.update(ProviderV2.ID.make("test"), () => {}))
              return {
                providers: yield* catalog.provider.all(),
                tools: yield* toolDefinitions(yield* ToolRegistry.Service),
              }
            }).pipe(
              Effect.scoped,
              Effect.provide(LocationServiceMap.get(Location.Ref.make({ directory: AbsolutePath.make(directory) }))),
            )

          const blockedState = yield* update(blocked.path)
          expect(blockedState.providers.some((provider) => provider.id === ProviderV2.ID.make("test"))).toBe(false)
          expect(blockedState.tools.map((tool) => tool.name).sort()).toEqual([
            "application_context",
            "apply_patch",
            "bash",
            "edit",
            "glob",
            "grep",
            "question",
            "read",
            "skill",
            "task",
            "todowrite",
            "webfetch",
            "websearch",
            "write",
          ])
          const allowedState = yield* update(allowed.path)
          expect(allowedState.providers.some((provider) => provider.id === ProviderV2.ID.make("test"))).toBe(true)
          expect(allowedState.tools.map((tool) => tool.name).sort()).toEqual([
            "application_context",
            "apply_patch",
            "bash",
            "edit",
            "glob",
            "grep",
            "question",
            "read",
            "skill",
            "task",
            "todowrite",
            "webfetch",
            "websearch",
            "write",
          ])
        }),
      ),
    ),
  )
})
