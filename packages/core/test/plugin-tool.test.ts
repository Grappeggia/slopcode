import { describe, expect } from "bun:test"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { EventV2 } from "@slopcode-ai/core/event"
import { Config } from "@slopcode-ai/core/config"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { Location } from "@slopcode-ai/core/location"
import { Npm } from "@slopcode-ai/core/npm"
import { PermissionV2 } from "@slopcode-ai/core/permission"
import { PluginV2 } from "@slopcode-ai/core/plugin"
import { PluginTool } from "@slopcode-ai/core/plugin/tool"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionEvent } from "@slopcode-ai/core/session/event"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionV2 } from "@slopcode-ai/core/session"
import { ApplicationTools } from "@slopcode-ai/core/tool/application-tools"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { ToolOutputStore } from "@slopcode-ai/core/tool-output-store"
import { Cause, Context, Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect"
import z from "zod"
import path from "node:path"
import fs from "node:fs/promises"
import { testEffect } from "./lib/effect"
import { tmpdir } from "./fixture/tmpdir"

const published: Array<{ type: string; data: unknown }> = []
const asked: PermissionV2.AssertInput[] = []
const events = Layer.mock(EventV2.Service, {
  publish: (definition, data) =>
    Effect.sync(() => published.push({ type: definition.type, data })).pipe(
      Effect.as({ id: EventV2.ID.make(`evt_plugin_tool_${published.length}`), type: definition.type, data }),
    ),
})
const permission = Layer.mock(PermissionV2.Service, {
  assert: (input) => Effect.sync(() => asked.push(input)),
  ask: () => Effect.die("unused"),
  reply: () => Effect.die("unused"),
  get: () => Effect.die("unused"),
  forSession: () => Effect.die("unused"),
  list: () => Effect.die("unused"),
})
const location = Layer.succeed(Location.Service, {
  directory: AbsolutePath.make("/work/project/src"),
  project: { id: "project" as never, directory: AbsolutePath.make("/work/project") },
})
const output = Layer.mock(ToolOutputStore.Service, {
  limits: () => Effect.succeed({ maxLines: 2_000, maxBytes: 50 * 1024 }),
  bound: (input) => Effect.succeed({ output: input.output, outputPaths: [] }),
  cleanup: () => Effect.void,
})
const plugins = PluginV2.layer.pipe(Layer.provide(events))
const registry = ToolRegistry.layer.pipe(Layer.provide(ApplicationTools.layer), Layer.provide(output))
const adapter = PluginTool.layer.pipe(
  Layer.provide(plugins),
  Layer.provide(registry),
  Layer.provide(permission),
  Layer.provide(location),
  Layer.provide(events),
)
const layer = Layer.mergeAll(plugins, registry, adapter, permission, location, events, FSUtil.defaultLayer)
const it = testEffect(layer)
const identity = {
  sessionID: SessionV2.ID.make("ses_plugin_tool"),
  agent: AgentV2.ID.make("build"),
  assistantMessageID: SessionMessage.ID.make("msg_plugin_tool"),
}

const settle = (materialized: ToolRegistry.Materialization, name: string, input: unknown = {}) =>
  materialized.settle({
    ...identity,
    call: { type: "tool-call", id: `call-${name}`, name, input },
  })

describe("PluginTool", () => {
  it.effect("adapts Zod and legacy arguments and normalizes object output", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const seen: unknown[] = []
      yield* plugin.add({
        id: PluginV2.ID.make("schemas"),
        effect: Effect.succeed({
          tool: {
            zod: {
              description: "zod tool",
              args: { value: z.string().trim().min(2).describe("value") },
              execute: async (input) => {
                seen.push(input)
                return {
                  title: "complete",
                  output: input.value,
                  metadata: { source: "zod" },
                  attachments: [
                    { type: "file", mime: "text/plain", url: "data:text/plain;base64,aGVsbG8=", filename: "a.txt" },
                  ],
                }
              },
            },
            legacy: {
              description: "legacy tool",
              args: { count: { type: "integer", minimum: 1 } },
              execute: async (input) => String(input.count),
            },
            no_args: { description: "no args", execute: async () => "none" },
          },
        }),
      })
      const registry = yield* ToolRegistry.Service
      const tools = yield* registry.materialize()
      expect(tools.definitions.find((item) => item.name === "zod")?.inputSchema).toMatchObject({
        type: "object",
        properties: { value: { type: "string", minLength: 2, description: "value" } },
        required: ["value"],
      })
      expect((yield* settle(tools, "zod", { value: " xy " })).result).toEqual({
        type: "content",
        value: [
          { type: "text", text: "xy" },
          { type: "file", uri: "data:text/plain;base64,aGVsbG8=", mime: "text/plain", name: "a.txt" },
        ],
      })
      expect(seen).toEqual([{ value: "xy" }])
      expect((yield* settle(tools, "legacy", { count: 0 })).result).toMatchObject({ type: "error" })
      expect((yield* settle(tools, "legacy", { count: 2 })).output?.structured).toBe("2")
      expect((yield* settle(tools, "no_args")).result).toEqual({ type: "text", value: "none" })
    }),
  )

  it.effect("runs hooks in order, revalidates mutations, asks permission, and publishes ordered progress", () =>
    Effect.gen(function* () {
      published.length = 0
      asked.length = 0
      const plugin = yield* PluginV2.Service
      yield* plugin.add({
        id: PluginV2.ID.make("hooks"),
        effect: Effect.succeed({
          "tool.execute.before": (event) => Effect.sync(() => (event.args = { value: String(event.args.value).trim() })),
          "tool.execute.after": (event) =>
            Effect.sync(() => {
              event.title = "after"
              event.output = event.output.toUpperCase()
              event.metadata = { ...event.metadata, after: true }
            }),
          tool: {
            hooked: {
              description: "hooked",
              args: { value: z.string().min(2) },
              execute: async (input, context) => {
                await context.ask({ permission: "network", patterns: ["host"], always: ["host"], metadata: { port: 443 } })
                context.metadata({ title: "one", metadata: { step: 1 } })
                context.metadata({ title: "two", metadata: { step: 2 } })
                return { output: input.value, metadata: { original: true } }
              },
            },
          },
        }),
      })
      const tools = yield* (yield* ToolRegistry.Service).materialize()
      const result = yield* settle(tools, "hooked", { value: " ok " })
      expect(result.result).toEqual({ type: "text", value: "OK" })
      expect(result.output?.structured).toEqual({ original: true, after: true })
      expect(asked).toEqual([
        expect.objectContaining({
          action: "network",
          resources: ["host"],
          save: ["host"],
          metadata: { port: 443 },
          sessionID: identity.sessionID,
          agent: identity.agent,
          source: { type: "tool", messageID: identity.assistantMessageID, callID: "call-hooked" },
        }),
      ])
      expect(
        published.filter((item) => item.type === SessionEvent.Tool.Progress.type).map((item) => item.data),
      ).toEqual([
        expect.objectContaining({ structured: { step: 1 }, content: [{ type: "text", text: "one" }] }),
        expect.objectContaining({ structured: { step: 2 }, content: [{ type: "text", text: "two" }] }),
      ])
    }),
  )

  it.effect("rejects invalid hook output and malformed attachments as tool failures", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add({
        id: PluginV2.ID.make("invalid"),
        effect: Effect.succeed({
          "tool.execute.before": (event) => Effect.sync(() => (event.args = { value: 1 })),
          tool: {
            bad_input: { description: "bad", args: { value: z.string() }, execute: async () => "never" },
            bad_file: {
              description: "bad file",
              args: {},
              execute: async () => ({
                output: "bad",
                attachments: [{ type: "file", mime: "text/plain", url: "data:text/plain;base64,***" }],
              }),
            },
          },
        }),
      })
      const tools = yield* (yield* ToolRegistry.Service).materialize()
      expect((yield* settle(tools, "bad_input", { value: "ok" })).result).toMatchObject({ type: "error" })
      expect((yield* settle(tools, "bad_file")).result).toMatchObject({
        type: "error",
        value: expect.stringContaining("attachment"),
      })
    }),
  )

  it.effect("atomically replaces and removes registrations while preserving captured identities", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const define = (value: string, dispose: () => void) =>
        Effect.succeed({
          dispose: async () => dispose(),
          tool: { shared: { description: value, args: {}, execute: async () => value } },
        })
      const disposed: string[] = []
      const id = PluginV2.ID.make("replace")
      yield* plugin.add({ id, effect: define("first", () => disposed.push("first")) })
      const registry = yield* ToolRegistry.Service
      const stale = yield* registry.materialize()
      yield* plugin.add({ id, effect: define("second", () => disposed.push("second")) })
      expect(disposed).toEqual(["first"])
      expect((yield* settle(stale, "shared")).result).toEqual({ type: "error", value: "Stale tool call: shared" })
      expect((yield* settle(yield* registry.materialize(), "shared")).result).toEqual({ type: "text", value: "second" })
      yield* plugin.remove(id)
      expect(disposed).toEqual(["first", "second"])
      expect((yield* registry.materialize()).definitions.find((item) => item.name === "shared")).toBeUndefined()
    }),
  )

  it.effect("aborts interrupted executions, waits for cleanup, and preserves interruption", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const started = yield* Deferred.make<void>()
      let cleaned = false
      yield* plugin.add({
        id: PluginV2.ID.make("interrupt"),
        effect: Effect.succeed({
          tool: {
            waiting: {
              description: "waiting",
              args: {},
              execute: (_, context) =>
                new Promise((resolve) => {
                  context.abort.addEventListener("abort", () => setTimeout(() => {
                    cleaned = true
                    resolve("stopped")
                  }, 5))
                  Effect.runSync(Deferred.succeed(started, undefined))
                }),
            },
          },
        }),
      })
      const tools = yield* (yield* ToolRegistry.Service).materialize()
      const fiber = yield* settle(tools, "waiting").pipe(Effect.forkChild)
      yield* Deferred.await(started)
      yield* Fiber.interrupt(fiber)
      const exit = yield* Fiber.await(fiber)
      expect(cleaned).toBe(true)
      expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
    }),
  )

  it.effect("discovers namespaced files in directory order and isolates load failures in CodeMode", () =>
    Effect.gen(function* () {
      published.length = 0
      const roots = yield* Effect.promise(() => Promise.all([tmpdir(), tmpdir()]))
      yield* Effect.addFinalizer(() => Effect.promise(() => Promise.all(roots.map((root) => root[Symbol.asyncDispose]()))).pipe(Effect.asVoid))
      yield* Effect.promise(async () => {
        await Promise.all([fs.mkdir(path.join(roots[0].path, "tools")), fs.mkdir(path.join(roots[1].path, "tool"))])
        await Bun.write(
          path.join(roots[0].path, "tools/local.ts"),
          `
const make = (value: string) => ({ description: value, args: {}, execute: async () => value })
export default make("low")
export const extra = make("extra")
export const ignored = 1
export const invalid = { description: "invalid", args: {} }
`,
        )
        await Bun.write(
          path.join(roots[1].path, "tool/local.ts"),
          `export default { description: "high", args: {}, execute: async () => "high" }`,
        )
        await Bun.write(path.join(roots[1].path, "tool/broken.ts"), `throw new Error("broken local tool")`)
        await Bun.write(
          path.join(roots[1].path, "tool/bad name.ts"),
          `export default { description: "bad", args: {}, execute: async () => "bad" }`,
        )
      })
      const installed: string[] = []
      const config = Config.Service.of({
        entries: () =>
          Effect.succeed(
            roots.map((root) => new Config.Directory({ type: "directory", path: AbsolutePath.make(root.path) })),
          ),
      })
      const npm = Npm.Service.of({
        install: (directory) => Effect.sync(() => installed.push(directory)),
        add: () => Effect.die("unused"),
        which: () => Effect.die("unused"),
      })
      yield* PluginTool.discover.pipe(
        Effect.provideService(Config.Service, config),
        Effect.provideService(Npm.Service, npm),
      )

      expect(installed).toEqual(roots.map((root) => root.path))
      const registry = yield* ToolRegistry.Service
      const materialized = yield* registry.materialize([], { mode: "code-only" })
      expect(materialized.definitions[0]?.description).toContain("- local")
      expect(materialized.definitions[0]?.description).toContain("- local_extra")
      const result = yield* materialized.settle({
        ...identity,
        call: {
          type: "tool-call",
          toolType: "custom",
          id: "call-discovered-code",
          name: "exec",
          input: "return { local: await tools.local({}), extra: await tools.local_extra({}) }",
        },
      })
      expect(result.output?.structured).toMatchObject({ ok: true, value: { local: "high", extra: "extra" } })
      expect(published.filter((item) => item.type === PluginV2.Event.Failed.type)).toHaveLength(3)
    }),
  )
})
