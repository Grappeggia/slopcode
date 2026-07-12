import { describe, expect } from "bun:test"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { Config } from "@slopcode-ai/core/config"
import { ConfigMCP } from "@slopcode-ai/core/config/mcp"
import { ConfigToolOutput } from "@slopcode-ai/core/config/tool-output"
import { EventV2 } from "@slopcode-ai/core/event"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { Global } from "@slopcode-ai/core/global"
import { Location } from "@slopcode-ai/core/location"
import { MCP } from "@slopcode-ai/core/mcp"
import { MCPClient } from "@slopcode-ai/core/mcp/client"
import { PermissionV2 } from "@slopcode-ai/core/permission"
import { PluginV2 } from "@slopcode-ai/core/plugin"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionV2 } from "@slopcode-ai/core/session"
import { ApplicationTools } from "@slopcode-ai/core/tool/application-tools"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { ToolOutputStore } from "@slopcode-ai/core/tool-output-store"
import { Cause, Effect, Exit, Fiber, Layer } from "effect"
import { testEffect } from "./lib/effect"

const location = Layer.succeed(Location.Service, {
  directory: AbsolutePath.make("/work/project/src"),
  project: { id: "project" as never, directory: AbsolutePath.make("/work/project") },
})
const output = Layer.mock(ToolOutputStore.Service, {
  limits: () => Effect.succeed({ maxLines: 2_000, maxBytes: 50 * 1024 }),
  bound: (input) => Effect.succeed({ output: input.output, outputPaths: [] }),
  cleanup: () => Effect.void,
})
const asked: PermissionV2.AssertInput[] = []
const permission = Layer.mock(PermissionV2.Service, {
  assert: (input) => Effect.sync(() => asked.push(input)),
})
const events = Layer.mock(EventV2.Service, {
  publish: (definition, data) =>
    Effect.succeed({ id: EventV2.ID.make("evt_mcp"), type: definition.type, data }) as never,
})
const plugins = PluginV2.layer.pipe(Layer.provide(events))
const registry = ToolRegistry.layer.pipe(Layer.provide(ApplicationTools.layer), Layer.provide(output))
const identity = {
  sessionID: SessionV2.ID.make("ses_mcp"),
  agent: AgentV2.ID.make("build"),
  assistantMessageID: SessionMessage.ID.make("msg_mcp"),
}

describe("MCP", () => {
  const fixture = (input: {
    readonly documents: ReadonlyArray<ConfigMCP.Info>
    readonly connect: MCPClient.Interface["connect"]
  }) => {
    const config = Layer.succeed(Config.Service, {
      entries: () =>
        Effect.succeed(input.documents.map((mcp) => new Config.Document({ type: "document", info: { mcp } }))),
    })
    const clients = Layer.succeed(MCPClient.Service, MCPClient.Service.of({ connect: input.connect }))
    const mcp = MCP.layer.pipe(
      Layer.provide(config),
      Layer.provide(clients),
      Layer.provide(location),
      Layer.provide(registry),
      Layer.provide(permission),
      Layer.provide(plugins),
      Layer.provide(events),
    )
    const ready = Layer.effectDiscard(MCP.Service.use((mcp) => mcp.ready())).pipe(Layer.provide(mcp))
    return testEffect(
      Layer.mergeAll(mcp, ready, registry, plugins, permission, location, events, ApplicationTools.layer, output),
    )
  }

  fixture({
    documents: [
      new ConfigMCP.Info({
        timeout: 10,
        servers: {
          unavailable: new ConfigMCP.Local({ type: "local", command: ["missing"] }),
          disabled: new ConfigMCP.Local({ type: "local", command: ["disabled"], disabled: true }),
          healthy: new ConfigMCP.Local({ type: "local", command: ["old"] }),
        },
      }),
      new ConfigMCP.Info({
        timeout: 20,
        servers: {
          healthy: new ConfigMCP.Local({ type: "local", command: ["new"], timeout: 30 }),
          second: new ConfigMCP.Remote({ type: "remote", url: "https://example.test/mcp" }),
        },
      }),
    ],
    connect: (input) =>
      input.name === "unavailable"
        ? Effect.fail(new MCPClient.ConnectionError({ message: "offline" }))
        : Effect.succeed(
            MCPClient.make({
              transport: input.config.type === "remote" ? "remote" : "local",
              capabilities: { tools: {} },
              list: () =>
                Promise.resolve({
                  tools: [
                    {
                      name: input.name === "healthy" ? "echo value" : "other",
                      description: input.name,
                      inputSchema: {
                        type: "object",
                        properties: { value: { type: "string" } },
                        required: ["value"],
                      },
                    },
                  ],
                }),
              call: ({ name, arguments: args }) =>
                Promise.resolve({ content: [{ type: "text", text: `${name}:${String(args?.value)}` }] }),
              close: () => Promise.resolve(),
            }),
          ),
  }).effect("connects concurrently and registers successful servers in deterministic effective config order", () =>
    Effect.gen(function* () {
      const mcp = yield* MCP.Service
      const status = yield* mcp.status()
      expect(status).toEqual({
        unavailable: { status: "failed", error: "offline" },
        disabled: { status: "disabled" },
        healthy: { status: "connected", transport: "local" },
        second: { status: "connected", transport: "remote" },
      })

      const tools = yield* (yield* ToolRegistry.Service).materialize()
      expect(tools.definitions.map((item) => item.name)).toEqual(["healthy_echo_value", "second_other"])
      expect(tools.definitions[0]).toMatchObject({
        description: "healthy",
        inputSchema: { properties: { value: { type: "string" } }, required: ["value"] },
      })
      expect(
        (yield* tools.settle({
          ...identity,
          call: { type: "tool-call", id: "call-mcp", name: "healthy_echo_value", input: { value: "ok" } },
        })).result,
      ).toEqual({ type: "text", value: "echo value:ok" })
      const code = yield* (yield* ToolRegistry.Service).materialize([], { mode: "code-only" })
      const executed = yield* code.settle({
        ...identity,
        call: {
          type: "tool-call",
          toolType: "custom",
          id: "call-code-mcp",
          name: "exec",
          input: 'return await tools.healthy_echo_value({ value: "code" })',
        },
      })
      expect(executed.output?.structured).toMatchObject({ ok: true, value: {} })
    }),
  )

  let changed: (() => void | Promise<void>) | undefined
  let revision = 0
  fixture({
    documents: [
      new ConfigMCP.Info({ servers: { server: new ConfigMCP.Local({ type: "local", command: ["server"] }) } }),
    ],
    connect: () =>
      Effect.succeed(
        MCPClient.make({
          capabilities: { tools: { listChanged: true } },
          list: () =>
            Promise.resolve({
              tools: [
                {
                  name: "echo",
                  description: `revision-${revision}`,
                  inputSchema: {
                    type: "object",
                    properties: { value: { type: "string" } },
                    required: ["value"],
                  },
                },
              ],
            }),
          call: ({ arguments: args }) => Promise.resolve({ content: [{ type: "text", text: String(args?.value) }] }),
          changed: (handler) => {
            changed = handler
          },
          close: () => Promise.resolve(),
        }),
      ),
  }).effect("refreshes atomically, fences stale tools, revalidates hooks, and asserts canonical permission", () =>
    Effect.gen(function* () {
      asked.length = 0
      yield* (yield* PluginV2.Service).add({
        id: PluginV2.ID.make("mcp-hooks"),
        effect: Effect.succeed({
          "tool.execute.before": (event) =>
            Effect.sync(() => (event.args = { value: String(event.args.value).trim() })),
          "tool.execute.after": (event) => Effect.sync(() => (event.output = `${event.output}!`)),
        }),
      })
      const registry = yield* ToolRegistry.Service
      const stale = yield* registry.materialize()
      revision = 1
      yield* Effect.promise(() => Promise.resolve(changed?.()))
      expect((yield* registry.materialize()).definitions[0]?.description).toBe("revision-1")
      expect(
        (yield* stale.settle({
          ...identity,
          call: { type: "tool-call", id: "call-stale", name: "server_echo", input: { value: "old" } },
        })).result,
      ).toEqual({ type: "error", value: "Stale tool call: server_echo" })
      const current = yield* registry.materialize()
      expect(
        (yield* current.settle({
          ...identity,
          call: { type: "tool-call", id: "call-current", name: "server_echo", input: { value: " ok " } },
        })).result,
      ).toEqual({ type: "text", value: "ok!" })
      expect(asked).toEqual([
        expect.objectContaining({
          action: "server_echo",
          resources: ["*"],
          source: { type: "tool", messageID: identity.assistantMessageID, callID: "call-current" },
        }),
      ])
    }),
  )

  fixture({
    documents: [
      new ConfigMCP.Info({
        servers: {
          "same server": new ConfigMCP.Local({ type: "local", command: ["one"] }),
          "same@server": new ConfigMCP.Local({ type: "local", command: ["two"] }),
        },
      }),
    ],
    connect: () =>
      Effect.succeed(
        MCPClient.make({
          capabilities: { tools: {} },
          list: () => Promise.resolve({ tools: [{ name: "tool", inputSchema: { type: "object" } }] }),
          call: () => Promise.resolve({ content: [] }),
          close: () => Promise.resolve(),
        }),
      ),
  }).effect("fails closed before registering cross-server sanitized name collisions", () =>
    Effect.gen(function* () {
      const status = yield* (yield* MCP.Service).status()
      expect(status["same server"]).toMatchObject({ status: "failed", error: expect.stringContaining("collision") })
      expect(status["same@server"]).toMatchObject({ status: "failed", error: expect.stringContaining("collision") })
      expect((yield* (yield* ToolRegistry.Service).materialize()).definitions).toEqual([])
    }),
  )

  let calls = 0
  fixture({
    documents: [
      new ConfigMCP.Info({ servers: { content: new ConfigMCP.Local({ type: "local", command: ["content"] }) } }),
    ],
    connect: () =>
      Effect.succeed(
        MCPClient.make({
          capabilities: { tools: {} },
          list: () =>
            Promise.resolve({
              tools: ["all", "structured", "error", "malformed"].map((name) => ({
                name,
                inputSchema: {
                  type: "object",
                  properties: { value: { type: "string" } },
                  required: ["value"],
                },
                outputSchema: { type: "object" },
              })),
            }),
          call: ({ name }) => {
            calls++
            if (name === "structured")
              return Promise.resolve({ content: [], structuredContent: { z: 1, a: 2 }, _meta: { request: "id" } })
            if (name === "error")
              return Promise.resolve({ content: [{ type: "text", text: "remote error" }], isError: true })
            if (name === "malformed")
              return Promise.resolve({ content: [{ type: "image", data: "***", mimeType: "image/png" }] })
            return Promise.resolve({
              content: [
                { type: "text", text: "text" },
                { type: "image", data: "aGVsbG8=", mimeType: "image/png" },
                { type: "resource", resource: { uri: "file:///text.txt", text: "embedded" } },
                {
                  type: "resource",
                  resource: { uri: "file:///blob.bin", blob: "aGVsbG8=", mimeType: "application/octet-stream" },
                },
              ],
              structuredContent: { ok: true },
              _meta: { request: "id" },
            })
          },
          close: () => Promise.resolve(),
        }),
      ),
  }).effect("validates input and normalizes all MCP result content, errors, and malformed data", () =>
    Effect.gen(function* () {
      calls = 0
      const tools = yield* (yield* ToolRegistry.Service).materialize()
      const settle = (name: string, value: unknown = { value: "ok" }) =>
        tools.settle({
          ...identity,
          call: { type: "tool-call", id: `call-${name}`, name: `content_${name}`, input: value },
        })
      expect((yield* settle("all")).result).toEqual({
        type: "content",
        value: [
          { type: "text", text: "text" },
          { type: "file", uri: "data:image/png;base64,aGVsbG8=", mime: "image/png" },
          { type: "text", text: "embedded" },
          {
            type: "file",
            uri: "data:application/octet-stream;base64,aGVsbG8=",
            mime: "application/octet-stream",
            name: "blob.bin",
          },
        ],
      })
      expect((yield* settle("structured")).result).toEqual({ type: "text", value: '{"a":2,"z":1}' })
      expect((yield* settle("error")).result).toEqual({ type: "error", value: "remote error" })
      expect((yield* settle("malformed")).result).toMatchObject({
        type: "error",
        value: expect.stringContaining("base64"),
      })
      expect((yield* settle("all", { value: 1 })).result).toMatchObject({ type: "error" })
      expect(calls).toBe(4)
    }),
  )

  const started = Promise.withResolvers<void>()
  const aborted = Promise.withResolvers<void>()
  fixture({
    documents: [new ConfigMCP.Info({ servers: { slow: new ConfigMCP.Local({ type: "local", command: ["slow"] }) } })],
    connect: () =>
      Effect.succeed(
        MCPClient.make({
          capabilities: { tools: {} },
          list: () => Promise.resolve({ tools: [{ name: "wait", inputSchema: { type: "object" } }] }),
          call: (_input, options) =>
            new Promise((_resolve, reject) => {
              started.resolve()
              options.signal.addEventListener("abort", () => {
                aborted.resolve()
                reject(new DOMException("aborted", "AbortError"))
              })
            }),
          close: () => Promise.resolve(),
        }),
      ),
  }).effect("forwards Effect interruption to the MCP AbortSignal", () =>
    Effect.gen(function* () {
      const materialized = yield* (yield* ToolRegistry.Service).materialize()
      const fiber = yield* materialized
        .settle({
          ...identity,
          call: { type: "tool-call", id: "call-interrupt", name: "slow_wait", input: {} },
        })
        .pipe(Effect.forkChild)
      yield* Effect.promise(() => started.promise)
      yield* Fiber.interrupt(fiber)
      yield* Effect.promise(() => aborted.promise)
      const exit = yield* Fiber.await(fiber)
      expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
    }),
  )

  let fallback = 0
  fixture({
    documents: [
      new ConfigMCP.Info({
        servers: {
          pages: new ConfigMCP.Remote({
            type: "remote",
            url: "https://example.test/mcp",
            headers: { Authorization: "Bearer secret" },
          }),
          repeated: new ConfigMCP.Local({ type: "local", command: ["repeat"], environment: { TOKEN: "secret" } }),
        },
      }),
    ],
    connect: (input) =>
      Effect.succeed(
        MCPClient.make({
          transport: input.config.type === "remote" ? "sse" : "local",
          capabilities: { tools: {} },
          list: (cursor, _timeout, tolerant) => {
            if (input.name === "repeated") return Promise.resolve({ tools: [], nextCursor: "secret" })
            if (!tolerant && cursor === undefined) return Promise.reject(new Error("outputSchema reference failed"))
            fallback++
            return Promise.resolve(
              cursor === undefined
                ? {
                    tools: [{ name: "one", inputSchema: { type: "object" }, outputSchema: { $ref: "#/$defs/x" } }],
                    nextCursor: "next",
                  }
                : { tools: [{ name: "two", inputSchema: { type: "object" } }] },
            )
          },
          call: () => Promise.resolve({ content: [] }),
          close: () => Promise.resolve(),
        }),
      ),
  }).effect("uses output-schema-only tolerant pagination, rejects repeated cursors, and redacts secrets", () =>
    Effect.gen(function* () {
      const status = yield* (yield* MCP.Service).status()
      expect(status.pages).toEqual({ status: "connected", transport: "sse" })
      expect(status.repeated).toMatchObject({ status: "failed", error: expect.stringContaining("repeated cursor") })
      expect(JSON.stringify(status)).not.toContain("secret")
      const definitions = (yield* (yield* ToolRegistry.Service).materialize()).definitions
      expect(definitions.map((item) => item.name)).toEqual(["pages_one", "pages_two"])
      expect(definitions[0]?.outputSchema).toEqual({ $ref: "#/$defs/x" })
      expect(fallback).toBe(2)
    }),
  )

  const closing = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let connections = 0
  fixture({
    documents: [
      new ConfigMCP.Info({ servers: { lifecycle: new ConfigMCP.Local({ type: "local", command: ["life"] }) } }),
    ],
    connect: () => {
      connections++
      return Effect.succeed(
        MCPClient.make({
          capabilities: { tools: {} },
          list: () => Promise.resolve({ tools: [{ name: "tool", inputSchema: { type: "object" } }] }),
          call: () => Promise.resolve({ content: [] }),
          close: () => {
            closing.resolve()
            return release.promise
          },
        }),
      )
    },
  }).effect("hides tools before awaiting slow disconnect cleanup and reconnects in its stable slot", () =>
    Effect.gen(function* () {
      const mcp = yield* MCP.Service
      const disconnect = yield* mcp.disconnect("lifecycle").pipe(Effect.forkChild)
      yield* Effect.promise(() => closing.promise)
      expect((yield* (yield* ToolRegistry.Service).materialize()).definitions).toEqual([])
      release.resolve()
      yield* Fiber.join(disconnect)
      expect((yield* mcp.status()).lifecycle).toEqual({ status: "disconnected" })
      yield* mcp.reconnect("lifecycle")
      expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((item) => item.name)).toEqual([
        "lifecycle_tool",
      ])
      expect(connections).toBe(2)
    }),
  )

  const boundedConfig = Layer.succeed(Config.Service, {
    entries: () =>
      Effect.succeed([
        new Config.Document({
          type: "document",
          info: {
            mcp: new ConfigMCP.Info({
              servers: { bounded: new ConfigMCP.Local({ type: "local", command: ["bounded"] }) },
            }),
            tool_output: new ConfigToolOutput.Info({ max_lines: 10, max_bytes: 40 }),
          },
        }),
      ]),
  })
  const realOutput = ToolOutputStore.layer.pipe(
    Layer.provide(FSUtil.defaultLayer),
    Layer.provide(Global.layerWith({ data: `/tmp/slopcode-mcp-bound-${process.pid}` })),
    Layer.provide(boundedConfig),
  )
  const realRegistry = ToolRegistry.layer.pipe(Layer.provide(ApplicationTools.layer), Layer.provide(realOutput))
  const boundedMcp = MCP.layer.pipe(
    Layer.provide(boundedConfig),
    Layer.provide(
      Layer.succeed(MCPClient.Service, {
        connect: () =>
          Effect.succeed(
            MCPClient.make({
              capabilities: { tools: {} },
              list: () => Promise.resolve({ tools: [{ name: "large", inputSchema: { type: "object" } }] }),
              call: () => Promise.resolve({ content: [{ type: "text", text: "x".repeat(200) }] }),
              close: () => Promise.resolve(),
            }),
          ),
      }),
    ),
    Layer.provide(location),
    Layer.provide(realRegistry),
    Layer.provide(permission),
    Layer.provide(plugins),
    Layer.provide(events),
  )
  const boundedReady = Layer.effectDiscard(MCP.Service.use((mcp) => mcp.ready())).pipe(Layer.provide(boundedMcp))
  testEffect(
    Layer.mergeAll(
      boundedMcp,
      boundedReady,
      realRegistry,
      realOutput,
      FSUtil.defaultLayer,
      plugins,
      permission,
      location,
      events,
    ),
  ).effect("routes MCP output through the real bounding and full-output storage path", () =>
    Effect.gen(function* () {
      const materialized = yield* (yield* ToolRegistry.Service).materialize()
      const result = yield* materialized.settle({
        ...identity,
        call: { type: "tool-call", id: "call-bounded", name: "bounded_large", input: {} },
      })
      expect(result.outputPaths).toHaveLength(1)
      expect(result.result).toMatchObject({ type: "text", value: expect.stringContaining("output truncated") })
      expect(yield* FSUtil.Service.use((fs) => fs.readFileString(result.outputPaths![0]!))).toBe("x".repeat(200))
    }),
  )

  let promptChanged: (() => void | Promise<void>) | undefined
  let resourceChanged: (() => void | Promise<void>) | undefined
  let contentRevision = 0
  let contentFailure = false
  fixture({
    documents: [
      new ConfigMCP.Info({
        servers: { "content server": new ConfigMCP.Local({ type: "local", command: ["content"] }) },
      }),
    ],
    connect: () =>
      Effect.succeed(
        MCPClient.make({
          capabilities: { prompts: { listChanged: true }, resources: { listChanged: true } },
          list: () => Promise.resolve({ tools: [] }),
          call: () => Promise.resolve({ content: [] }),
          listPrompts: (cursor) => {
            if (contentFailure) return Promise.reject(new Error("refresh failed"))
            return Promise.resolve(
              cursor === undefined
                ? { prompts: [{ name: "same name", description: `revision-${contentRevision}` }], nextCursor: "p2" }
                : { prompts: [{ name: "second" }] },
            )
          },
          getPrompt: ({ name }, options) => {
            expect(options.timeout).toBe(30_000)
            return Promise.resolve({ messages: [{ role: "user", content: { type: "text", text: name } }] })
          },
          listResources: (cursor) =>
            Promise.resolve(
              cursor === undefined
                ? { resources: [{ name: "same name", uri: "file:///same.txt" }], nextCursor: "r2" }
                : { resources: [{ name: "second", uri: "https://example.test/second.bin" }] },
            ),
          readResource: (_input, options) => {
            expect(options.timeout).toBe(30_000)
            return Promise.resolve({ contents: [{ uri: "file:///same.txt", text: "resource" }] })
          },
          promptsChanged: (handler) => {
            promptChanged = handler
          },
          resourcesChanged: (handler) => {
            resourceChanged = handler
          },
          close: () => Promise.resolve(),
        }),
      ),
  }).effect("publishes paginated prompt and resource catalogs independently and retains failed refreshes", () =>
    Effect.gen(function* () {
      const mcp = yield* MCP.Service
      expect((yield* mcp.prompts()).map((item) => [item.name, item.rawName])).toEqual([
        ["content_server:same_name", "same name"],
        ["content_server:second", "second"],
      ])
      expect((yield* mcp.resources()).map((item) => item.name)).toEqual([
        "content_server:same_name",
        "content_server:second",
      ])
      expect((yield* mcp.getPrompt({ name: "content_server:same_name" })).text).toBe("[user]\nsame name")
      expect((yield* mcp.readResource("content_server:same_name")).text).toBe("resource")
      expect(promptChanged).toBeDefined()
      expect(resourceChanged).toBeDefined()
      contentRevision = 1
      yield* Effect.promise(() => Promise.resolve(promptChanged?.()))
      expect((yield* mcp.prompts())[0]?.description).toBe("revision-1")
      contentFailure = true
      yield* Effect.promise(() => Promise.resolve(promptChanged?.()))
      expect((yield* mcp.prompts())[0]?.description).toBe("revision-1")
      contentFailure = false
    }),
  )
})
