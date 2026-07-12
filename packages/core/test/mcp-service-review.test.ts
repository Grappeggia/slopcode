import { expect } from "bun:test"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { Config } from "@slopcode-ai/core/config"
import { ConfigMCP } from "@slopcode-ai/core/config/mcp"
import { EventV2 } from "@slopcode-ai/core/event"
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
import { Cause, Effect, Exit, Fiber, Layer, Scope } from "effect"
import { testEffect } from "./lib/effect"

const location = Layer.succeed(Location.Service, {
  directory: AbsolutePath.make("/work/review"),
  project: { id: "project" as never, directory: AbsolutePath.make("/work") },
})
const output = Layer.mock(ToolOutputStore.Service, {
  limits: () => Effect.succeed({ maxLines: 2_000, maxBytes: 50 * 1024 }),
  bound: (input) => Effect.succeed({ output: input.output, outputPaths: [] }),
  cleanup: () => Effect.void,
})
const identity = {
  sessionID: SessionV2.ID.make("ses_mcp_review"),
  agent: AgentV2.ID.make("build"),
  assistantMessageID: SessionMessage.ID.make("msg_mcp_review"),
}

function fixture(input: {
  readonly documents: ReadonlyArray<ConfigMCP.Info>
  readonly connect: MCPClient.Interface["connect"]
  readonly events?: Array<{ type: string; data: unknown }>
  readonly deny?: boolean
  readonly wait?: boolean
}) {
  const config = Layer.succeed(Config.Service, {
    entries: () =>
      Effect.succeed(input.documents.map((mcp) => new Config.Document({ type: "document", info: { mcp } }))),
  })
  const events = Layer.mock(EventV2.Service, {
    publish: (definition, data) =>
      Effect.sync(() => input.events?.push({ type: definition.type, data })).pipe(
        Effect.as({ id: EventV2.ID.make("evt_mcp_review"), type: definition.type, data }),
      ) as never,
  })
  const permission = Layer.mock(PermissionV2.Service, {
    assert: () => (input.deny ? Effect.fail(new PermissionV2.DeniedError({ rules: [] })) : Effect.void),
  })
  const plugins = PluginV2.layer.pipe(Layer.provide(events))
  const registry = ToolRegistry.layer.pipe(Layer.provide(ApplicationTools.layer), Layer.provide(output))
  const mcp = MCP.layer.pipe(
    Layer.provide(config),
    Layer.provide(Layer.succeed(MCPClient.Service, { connect: input.connect })),
    Layer.provide(location),
    Layer.provide(registry),
    Layer.provide(permission),
    Layer.provide(plugins),
    Layer.provide(events),
  )
  const ready =
    input.wait === false
      ? Layer.empty
      : Layer.effectDiscard(MCP.Service.use((service) => service.ready())).pipe(Layer.provide(mcp))
  return testEffect(Layer.mergeAll(mcp, ready, registry, permission, plugins, events, location, output))
}

const discoveryStarted = Promise.withResolvers<void>()
const discoveryRelease = Promise.withResolvers<void>()
let discoveryClosed: (() => void) | undefined
let discoveryCleanup = 0
fixture({
  wait: false,
  documents: [new ConfigMCP.Info({ servers: { race: new ConfigMCP.Local({ type: "local", command: ["race"] }) } })],
  connect: () =>
    Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {} },
        list: async () => {
          discoveryStarted.resolve()
          await discoveryRelease.promise
          return { tools: [{ name: "late", inputSchema: { type: "object" } }] }
        },
        call: () => Promise.resolve({ content: [] }),
        closed: (handler) => {
          discoveryClosed = handler
        },
        close: async () => {
          discoveryCleanup++
        },
      }),
    ),
}).effect("does not activate a connection closed after discovery starts", () =>
  Effect.gen(function* () {
    yield* Effect.promise(() => discoveryStarted.promise)
    const observed = discoveryClosed !== undefined
    discoveryClosed?.()
    discoveryRelease.resolve()
    const mcp = yield* MCP.Service
    yield* mcp.ready()
    expect(observed).toBe(true)
    expect((yield* mcp.status()).race).not.toMatchObject({ status: "connected" })
    expect((yield* (yield* ToolRegistry.Service).materialize()).definitions).toEqual([])
    expect(discoveryCleanup).toBe(1)
  }),
)

let hookResult: "error" | "success" | "replace" | "invalid" = "error"
fixture({
  documents: [new ConfigMCP.Info({ servers: { hooks: new ConfigMCP.Local({ type: "local", command: ["hooks"] }) } })],
  connect: () =>
    Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {} },
        list: () =>
          Promise.resolve({
            tools: [{ name: "result", inputSchema: { type: "object" }, outputSchema: { type: "object" } }],
          }),
        call: () =>
          Promise.resolve({
            content: [{ type: "text", text: "original" }],
            structuredContent: { original: true },
            _meta: { source: "mcp" },
            isError: hookResult === "error",
          }),
        close: () => Promise.resolve(),
      }),
    ),
}).effect("preserves MCP error and canonical structure across after-hook edits", () =>
  Effect.gen(function* () {
    yield* (yield* PluginV2.Service).add({
      id: PluginV2.ID.make("review-hook"),
      effect: Effect.succeed({
        "tool.execute.after": (event) =>
          Effect.sync(() => {
            event.title = "changed title"
            event.output = "changed text"
            event.metadata =
              hookResult === "replace"
                ? { structuredContent: { replacement: true }, _meta: { hook: true } }
                : hookResult === "invalid"
                  ? { structuredContent: "invalid" }
                  : hookResult === "success"
                    ? { ...event.metadata, hook: true }
                    : { hook: true }
          }),
      }),
    })
    const registry = yield* ToolRegistry.Service
    const settle = () =>
      registry.materialize().pipe(
        Effect.flatMap((tools) =>
          tools.settle({
            ...identity,
            call: { type: "tool-call", id: `call-${hookResult}`, name: "hooks_result", input: {} },
          }),
        ),
      )
    hookResult = "error"
    expect((yield* settle()).result).toEqual({ type: "error", value: "changed text" })
    hookResult = "success"
    expect((yield* settle()).output).toEqual({
      structured: { structuredContent: { original: true }, _meta: { source: "mcp", hook: true }, isError: false },
      content: [{ type: "text", text: "changed text" }],
    })
    hookResult = "replace"
    expect((yield* settle()).output?.structured).toEqual({
      structuredContent: { replacement: true },
      _meta: { hook: true },
      isError: false,
    })
    hookResult = "invalid"
    expect((yield* settle()).result).toMatchObject({
      type: "error",
      value: expect.stringContaining("invalid hook structuredContent"),
    })
  }),
)

let callFailure: "sync" | "async" = "sync"
fixture({
  documents: [
    new ConfigMCP.Info({ servers: { failure: new ConfigMCP.Local({ type: "local", command: ["failure"] }) } }),
  ],
  connect: () =>
    Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {} },
        list: () => Promise.resolve({ tools: [{ name: "call", inputSchema: { type: "object" } }] }),
        call: () => {
          if (callFailure === "sync") throw new Error("sync invariant")
          return Promise.reject(new Error("async transport"))
        },
        close: () => Promise.resolve(),
      }),
    ),
}).effect("keeps synchronous call invariants as defects and maps promise rejection to ToolFailure", () =>
  Effect.gen(function* () {
    const tools = yield* (yield* ToolRegistry.Service).materialize()
    const settle = () =>
      tools.settle({
        ...identity,
        call: { type: "tool-call", id: `call-${callFailure}`, name: "failure_call", input: {} },
      })
    callFailure = "sync"
    const defect = yield* Effect.exit(settle())
    expect(Exit.isFailure(defect) && Cause.pretty(defect.cause)).toContain("sync invariant")
    callFailure = "async"
    expect((yield* settle()).result).toEqual({ type: "error", value: "MCP tool failed: async transport" })
  }),
)

let refreshFails = false
const refreshEvents: Array<{ type: string; data: unknown }> = []
fixture({
  documents: [
    new ConfigMCP.Info({
      servers: {
        refresh: new ConfigMCP.Local({ type: "local", command: ["refresh"], environment: { TOKEN: "secret" } }),
      },
    }),
  ],
  events: refreshEvents,
  connect: () =>
    Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {} },
        list: () =>
          refreshFails
            ? Promise.reject(new Error("refresh secret"))
            : Promise.resolve({ tools: [{ name: "stable", inputSchema: { type: "object" } }] }),
        call: () => Promise.resolve({ content: [] }),
        close: () => Promise.resolve(),
      }),
    ),
}).effect("preserves active tools and connected replay status after failed refresh", () =>
  Effect.gen(function* () {
    refreshEvents.length = 0
    const mcp = yield* MCP.Service
    refreshFails = true
    expect(yield* Effect.flip(mcp.refresh("refresh"))).toBeInstanceOf(MCP.DiscoveryError)
    expect((yield* mcp.status()).refresh).toEqual({ status: "connected", transport: "local" })
    expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((tool) => tool.name)).toEqual([
      "refresh_stable",
    ])
    expect(refreshEvents.some((event) => event.type === MCP.Event.DiscoveryFailed.type)).toBe(true)
    expect(JSON.stringify(refreshEvents)).not.toContain("secret")
  }),
)

let serialConnections = 0
const reconnectStarted = Promise.withResolvers<void>()
const reconnectRelease = Promise.withResolvers<void>()
const serialLists: number[] = []
const serialClosed: number[] = []
fixture({
  documents: [new ConfigMCP.Info({ servers: { serial: new ConfigMCP.Local({ type: "local", command: ["serial"] }) } })],
  connect: () => {
    const id = ++serialConnections
    return Effect.tryPromise({
      try: async () => {
        if (id === 2) {
          reconnectStarted.resolve()
          await reconnectRelease.promise
        }
        return MCPClient.make({
          capabilities: { tools: {} },
          list: () => {
            serialLists.push(id)
            return Promise.resolve({ tools: [{ name: `client_${id}`, inputSchema: { type: "object" } }] })
          },
          call: () => Promise.resolve({ content: [] }),
          close: async () => {
            serialClosed.push(id)
          },
        })
      },
      catch: (cause) => new MCPClient.ConnectionError({ message: String(cause) }),
    })
  },
}).effect("serializes refresh behind reconnect and binds definitions to the active client", () =>
  Effect.gen(function* () {
    const mcp = yield* MCP.Service
    const reconnect = yield* mcp.reconnect("serial").pipe(Effect.forkChild)
    yield* Effect.promise(() => reconnectStarted.promise)
    const refresh = yield* mcp.refresh("serial").pipe(Effect.forkChild)
    reconnectRelease.resolve()
    yield* Fiber.join(reconnect)
    yield* Fiber.join(refresh)
    expect(serialClosed).toContain(1)
    expect(serialLists).toEqual([1, 2, 2])
    expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((tool) => tool.name)).toEqual([
      "serial_client_2",
    ])
  }),
)

testEffect(Layer.empty).effect("closes a delayed connect result when the Location scope shuts down", () =>
  Effect.gen(function* () {
    const pending = Promise.withResolvers<MCPClient.Connection>()
    const started = Promise.withResolvers<void>()
    let closed = 0
    const config = Layer.succeed(Config.Service, {
      entries: () =>
        Effect.succeed([
          new Config.Document({
            type: "document",
            info: {
              mcp: new ConfigMCP.Info({
                servers: { delayed: new ConfigMCP.Local({ type: "local", command: ["delayed"] }) },
              }),
            },
          }),
        ]),
    })
    const events = Layer.mock(EventV2.Service, {
      publish: (definition, data) =>
        Effect.succeed({ id: EventV2.ID.make("evt_delayed"), type: definition.type, data }) as never,
    })
    const permission = Layer.mock(PermissionV2.Service, { assert: () => Effect.void })
    const plugins = PluginV2.layer.pipe(Layer.provide(events))
    const registry = ToolRegistry.layer.pipe(Layer.provide(ApplicationTools.layer), Layer.provide(output))
    const mcp = MCP.layer.pipe(
      Layer.provide(config),
      Layer.provide(
        Layer.succeed(MCPClient.Service, {
          connect: () =>
            MCPClient.interruptible(async () => {
              started.resolve()
              return pending.promise
            }),
        }),
      ),
      Layer.provide(location),
      Layer.provide(registry),
      Layer.provide(permission),
      Layer.provide(plugins),
      Layer.provide(events),
    )
    const scope = yield* Scope.make()
    yield* Layer.buildWithScope(Layer.mergeAll(mcp, registry, permission, plugins, events, location, output), scope)
    yield* Effect.promise(() => started.promise)
    const shutdown = yield* Scope.close(scope, Exit.void).pipe(Effect.forkChild)
    pending.resolve(
      MCPClient.make({
        capabilities: {},
        list: () => Promise.resolve({ tools: [] }),
        call: () => Promise.resolve({ content: [] }),
        close: async () => {
          closed++
        },
      }),
    )
    yield* Fiber.join(shutdown)
    expect(closed).toBe(1)
  }),
)

const statusEvents: Array<{ type: string; data: unknown }> = []
fixture({
  events: statusEvents,
  documents: [
    new ConfigMCP.Info({
      servers: {
        status: new ConfigMCP.Remote({
          type: "remote",
          url: "https://example.test/mcp",
          headers: { Authorization: "Bearer status-secret" },
        }),
      },
    }),
  ],
  connect: () => Effect.fail(new MCPClient.ConnectionError({ message: "Bearer status-secret rejected" })),
}).effect("publishes replayable redacted status transitions", () =>
  Effect.gen(function* () {
    const mcp = yield* MCP.Service
    expect((yield* mcp.status()).status).toEqual({ status: "failed", error: "[REDACTED] rejected" })
    expect(
      statusEvents
        .filter((event) => event.type === MCP.Event.StatusChanged.type)
        .map((event) => (event.data as { status: { status: string } }).status.status),
    ).toEqual(["connecting", "failed"])
    expect(JSON.stringify(statusEvents)).not.toContain("status-secret")
  }),
)

let pages = 0
fixture({
  documents: [
    new ConfigMCP.Info({ servers: { overflow: new ConfigMCP.Local({ type: "local", command: ["overflow"] }) } }),
  ],
  connect: () =>
    Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {} },
        list: () => Promise.resolve({ tools: [], nextCursor: String(++pages) }),
        call: () => Promise.resolve({ content: [] }),
        close: () => Promise.resolve(),
      }),
    ),
}).effect("rejects tools/list page overflow", () =>
  Effect.gen(function* () {
    expect((yield* (yield* MCP.Service).status()).overflow).toMatchObject({
      status: "failed",
      error: expect.stringContaining("exceeded 1000 pages"),
    })
    expect(pages).toBe(1000)
  }),
)

fixture({
  documents: [
    new ConfigMCP.Info({
      servers: {
        collision: new ConfigMCP.Local({ type: "local", command: ["collision"] }),
        ["s".repeat(64)]: new ConfigMCP.Local({ type: "local", command: ["long"] }),
      },
    }),
  ],
  connect: (input) =>
    Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {} },
        list: () =>
          Promise.resolve({
            tools:
              input.name === "collision"
                ? [
                    { name: "same tool", inputSchema: { type: "object" } },
                    { name: "same@tool", inputSchema: { type: "object" } },
                  ]
                : [{ name: "tool", inputSchema: { type: "object" } }],
          }),
        call: () => Promise.resolve({ content: [] }),
        close: () => Promise.resolve(),
      }),
    ),
}).effect("fails sanitize collisions and overlength names before registration", () =>
  Effect.gen(function* () {
    const status = yield* (yield* MCP.Service).status()
    expect(status.collision).toMatchObject({ status: "failed", error: expect.stringContaining("collision") })
    expect(status["s".repeat(64)]).toMatchObject({
      status: "failed",
      error: expect.stringContaining("Invalid canonical MCP tool name"),
    })
    expect((yield* (yield* ToolRegistry.Service).materialize()).definitions).toEqual([])
  }),
)

let deniedCalls = 0
fixture({
  deny: true,
  documents: [new ConfigMCP.Info({ servers: { denied: new ConfigMCP.Local({ type: "local", command: ["denied"] }) } })],
  connect: () =>
    Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {} },
        list: () => Promise.resolve({ tools: [{ name: "tool", inputSchema: { type: "object" } }] }),
        call: () => {
          deniedCalls++
          return Promise.resolve({ content: [] })
        },
        close: () => Promise.resolve(),
      }),
    ),
}).effect("does not call MCP after permission denial", () =>
  Effect.gen(function* () {
    const tools = yield* (yield* ToolRegistry.Service).materialize()
    expect(
      (yield* tools.settle({
        ...identity,
        call: { type: "tool-call", id: "call-denied", name: "denied_tool", input: {} },
      })).result,
    ).toEqual({ type: "error", value: "Permission denied: denied_tool" })
    expect(deniedCalls).toBe(0)
  }),
)

let imageMime = "text/plain"
fixture({
  documents: [new ConfigMCP.Info({ servers: { image: new ConfigMCP.Local({ type: "local", command: ["image"] }) } })],
  connect: () =>
    Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {} },
        list: () => Promise.resolve({ tools: [{ name: "mime", inputSchema: { type: "object" } }] }),
        call: () =>
          Promise.resolve({
            content: [{ type: "image", data: Buffer.from("image").toString("base64"), mimeType: imageMime }],
          }),
        close: () => Promise.resolve(),
      }),
    ),
}).effect("rejects non-image MIME for MCP image content", () =>
  Effect.gen(function* () {
    const tools = yield* (yield* ToolRegistry.Service).materialize()
    for (const mime of ["text/plain", "application/octet-stream"]) {
      imageMime = mime
      expect(
        (yield* tools.settle({
          ...identity,
          call: { type: "tool-call", id: `call-image-${mime}`, name: "image_mime", input: {} },
        })).result,
      ).toEqual({ type: "error", value: "MCP tool returned invalid image MIME" })
    }
  }),
)

const mutable = [
  new ConfigMCP.Info({
    servers: {
      removed: new ConfigMCP.Local({ type: "local", command: ["removed"] }),
      kept: new ConfigMCP.Local({ type: "local", command: ["old"] }),
    },
  }),
]
const closeStarted = Promise.withResolvers<void>()
const closeRelease = Promise.withResolvers<void>()
fixture({
  documents: mutable,
  connect: (input) =>
    Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {} },
        list: () =>
          Promise.resolve({ tools: [{ name: input.config.command.at(-1)!, inputSchema: { type: "object" } }] }),
        call: () => Promise.resolve({ content: [] }),
        close: async () => {
          if (input.name !== "removed") return
          closeStarted.resolve()
          await closeRelease.promise
        },
      }),
    ),
}).effect("reloads add replace and remove while preserving unrelated slot order", () =>
  Effect.gen(function* () {
    mutable.splice(
      0,
      1,
      new ConfigMCP.Info({
        servers: {
          kept: new ConfigMCP.Local({ type: "local", command: ["new"] }),
          added: new ConfigMCP.Local({ type: "local", command: ["added"] }),
        },
      }),
    )
    const mcp = yield* MCP.Service
    const reload = yield* mcp.reload().pipe(Effect.forkChild)
    yield* Effect.promise(() => closeStarted.promise)
    expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((tool) => tool.name)).toEqual([
      "kept_old",
    ])
    closeRelease.resolve()
    yield* Fiber.join(reload)
    expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((tool) => tool.name)).toEqual([
      "kept_new",
      "added_added",
    ])
    expect(yield* mcp.status()).toEqual({
      kept: { status: "connected", transport: "local" },
      added: { status: "connected", transport: "local" },
    })
  }),
)

const collisionConfig = [
  new ConfigMCP.Info({
    servers: { keep: new ConfigMCP.Local({ type: "local", command: ["keep"] }) },
  }),
]
let collisionRound = 0
fixture({
  documents: collisionConfig,
  connect: (input) =>
    Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {} },
        list: async () => {
          if (input.name !== "keep") await Bun.sleep((input.name === "a b") === (collisionRound % 2 === 0) ? 20 : 1)
          return { tools: [{ name: input.name === "keep" ? "stable" : "same", inputSchema: { type: "object" } }] }
        },
        call: () => Promise.resolve({ content: [] }),
        close: () => Promise.resolve(),
      }),
    ),
}).effect("reload rejects every batch collision regardless of discovery completion order", () =>
  Effect.gen(function* () {
    const mcp = yield* MCP.Service
    for (collisionRound = 0; collisionRound < 2; collisionRound++) {
      collisionConfig.splice(
        0,
        1,
        new ConfigMCP.Info({
          servers: {
            keep: new ConfigMCP.Local({ type: "local", command: ["keep"] }),
            "a b": new ConfigMCP.Local({ type: "local", command: [`left-${collisionRound}`] }),
            "a@b": new ConfigMCP.Local({ type: "local", command: [`right-${collisionRound}`] }),
          },
        }),
      )
      yield* mcp.reload()
      expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((tool) => tool.name)).toEqual([
        "keep_stable",
      ])
      expect(yield* mcp.status()).toMatchObject({
        "a b": { status: "failed" },
        "a@b": { status: "failed" },
      })
      collisionConfig.splice(
        0,
        1,
        new ConfigMCP.Info({
          servers: { keep: new ConfigMCP.Local({ type: "local", command: ["keep"] }) },
        }),
      )
      yield* mcp.reload()
    }
  }),
)
