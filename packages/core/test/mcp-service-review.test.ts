import { expect } from "bun:test"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { Config } from "@slopcode-ai/core/config"
import { ConfigMCP } from "@slopcode-ai/core/config/mcp"
import { EventV2 } from "@slopcode-ai/core/event"
import { Location } from "@slopcode-ai/core/location"
import { MCP } from "@slopcode-ai/core/mcp"
import { MCPClient } from "@slopcode-ai/core/mcp/client"
import { MCPOAuth } from "@slopcode-ai/core/mcp/oauth"
import { MCPOAuthStore } from "@slopcode-ai/core/mcp/oauth-store"
import { PermissionV2 } from "@slopcode-ai/core/permission"
import { PluginV2 } from "@slopcode-ai/core/plugin"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionEvent } from "@slopcode-ai/core/session/event"
import { ApplicationTools } from "@slopcode-ai/core/tool/application-tools"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { Tools } from "@slopcode-ai/core/tool/tools"
import { ToolOutputStore } from "@slopcode-ai/core/tool-output-store"
import { Cause, Effect, Exit, Fiber, Layer, Schema, Scope } from "effect"
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
  readonly registering?: (
    tools: Readonly<Record<string, unknown>>,
    registry: ToolRegistry.Interface,
  ) => Effect.Effect<void>
  readonly oauth?: MCPOAuth.Interface
  readonly oauthStore?: MCPOAuthStore.Interface
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
  const tools = Layer.effect(
    Tools.Service,
    Effect.gen(function* () {
      const service = yield* ToolRegistry.Service
      return Tools.Service.of({
        register: (registered, options) =>
          service
            .register(registered, options)
            .pipe(Effect.tap(() => input.registering?.(registered, service) ?? Effect.void)),
      })
    }),
  ).pipe(Layer.provide(registry))
  const source = input.oauth && input.oauthStore
    ? MCP.locationLayer.pipe(
        Layer.provide(Layer.succeed(MCPOAuth.Service, MCPOAuth.Service.of(input.oauth))),
        Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(input.oauthStore))),
      )
    : MCP.layer
  const mcp = source.pipe(
    Layer.provide(config),
    Layer.provide(Layer.succeed(MCPClient.Service, { connect: input.connect })),
    Layer.provide(location),
    Layer.provide(tools),
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

let contentHook: "metadata" | "title" | "output" | "attachments" = "metadata"
const contentEvents: Array<{ type: string; data: unknown }> = []
const image = Buffer.from("image").toString("base64")
const blob = Buffer.from("blob").toString("base64")
fixture({
  events: contentEvents,
  documents: [
    new ConfigMCP.Info({ servers: { content: new ConfigMCP.Local({ type: "local", command: ["content"] }) } }),
  ],
  connect: () =>
    Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {} },
        list: () => Promise.resolve({ tools: [{ name: "mixed", inputSchema: { type: "object" } }] }),
        call: () =>
          Promise.resolve({
            content: [
              { type: "text", text: "first" },
              { type: "image", data: image, mimeType: "image/png" },
              { type: "resource", resource: { uri: "text://resource", text: "resource" } },
              {
                type: "resource",
                resource: { uri: "file:///blob.bin", blob, mimeType: "application/octet-stream" },
              },
              { type: "text", text: "last" },
            ],
            structuredContent: { structured: true },
            _meta: { source: "mcp" },
            isError: false,
          }),
        close: () => Promise.resolve(),
      }),
    ),
}).effect("preserves mixed content for metadata/title hooks and reconstructs explicit replacements", () =>
  Effect.gen(function* () {
    yield* (yield* PluginV2.Service).add({
      id: PluginV2.ID.make("content-hook"),
      effect: Effect.succeed({
        "tool.execute.after": (event) =>
          Effect.sync(() => {
            if (contentHook === "metadata") event.metadata = { ...event.metadata, hook: true }
            if (contentHook === "title") event.title = "MCP progress"
            if (contentHook === "output") event.output = "replacement"
            if (contentHook === "attachments")
              event.attachments = [
                {
                  type: "file",
                  mime: "application/json",
                  url: `data:application/json;base64,${Buffer.from("{}").toString("base64")}`,
                  filename: "replacement.json",
                },
              ]
          }),
      }),
    })
    const registry = yield* ToolRegistry.Service
    const settle = () =>
      registry.materialize().pipe(
        Effect.flatMap((tools) =>
          tools.settle({
            ...identity,
            call: { type: "tool-call", id: `call-content-${contentHook}`, name: "content_mixed", input: {} },
          }),
        ),
      )
    const original = [
      { type: "text", text: "first" },
      { type: "file", uri: `data:image/png;base64,${image}`, mime: "image/png", name: undefined },
      { type: "text", text: "resource" },
      {
        type: "file",
        uri: `data:application/octet-stream;base64,${blob}`,
        mime: "application/octet-stream",
        name: "blob.bin",
      },
      { type: "text", text: "last" },
    ]
    contentHook = "metadata"
    const metadata = yield* settle()
    expect(metadata.output?.content).toEqual(original)
    expect(metadata.output?.structured).toEqual({
      structuredContent: { structured: true },
      _meta: { source: "mcp", hook: true },
      isError: false,
    })
    contentHook = "title"
    contentEvents.length = 0
    const title = yield* settle()
    expect(title.output?.content).toEqual(original)
    expect(title.output?.structured).toEqual({
      structuredContent: { structured: true },
      _meta: { source: "mcp" },
      isError: false,
    })
    expect(contentEvents.find((event) => event.type === SessionEvent.Tool.Progress.type)?.data).toMatchObject({
      sessionID: identity.sessionID,
      assistantMessageID: identity.assistantMessageID,
      content: [{ type: "text", text: "MCP progress" }],
      structured: { source: "mcp" },
    })
    contentHook = "output"
    expect((yield* settle()).output?.content).toEqual([
      { type: "text", text: "replacement" },
      { type: "file", uri: `data:image/png;base64,${image}`, mime: "image/png", name: undefined },
      {
        type: "file",
        uri: `data:application/octet-stream;base64,${blob}`,
        mime: "application/octet-stream",
        name: "blob.bin",
      },
    ])
    contentHook = "attachments"
    expect((yield* settle()).output?.content).toEqual([
      { type: "text", text: "first\nresource\nlast" },
      {
        type: "file",
        uri: `data:application/json;base64,${Buffer.from("{}").toString("base64")}`,
        mime: "application/json",
        name: "replacement.json",
      },
    ])
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

const contentConfig = [
  new ConfigMCP.Info({
    servers: {
      "same server": new ConfigMCP.Local({
        type: "local",
        command: ["old"],
        timeout: 111,
        environment: { TOKEN: "old-secret" },
      }),
    },
  }),
]
let contentRound = 0
const contentClosed: string[] = []
let oldRequestFails = false
let oldRequestTimeout = 0
let stagedToolTimeout = 0
fixture({
  documents: contentConfig,
  connect: (input) => {
    const version = input.config.type === "local" ? input.config.command.at(-1)! : "remote"
    return Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {}, prompts: {} },
        list: (_cursor, timeout) => {
          if (version === "broken") stagedToolTimeout = timeout
          return Promise.resolve({ tools: [{ name: version, inputSchema: { type: "object" } }] })
        },
        call: () => Promise.resolve({ content: [] }),
        listPrompts: async () => {
          if (version === "broken") throw new Error("replacement discovery failed")
          if (version !== "old") await Bun.sleep((version === "left") === (contentRound % 2 === 0) ? 20 : 1)
          return { prompts: [{ name: version === "old" ? "stable" : "same" }] }
        },
        getPrompt: ({ name }, options) => {
          if (version === "old") oldRequestTimeout = options.timeout
          return oldRequestFails && version === "old"
            ? Promise.reject(new Error("old-secret request failed"))
            : Promise.resolve({ messages: [{ role: "user", content: { type: "text", text: `${version}:${name}` } }] })
        },
        close: async () => {
          contentClosed.push(version)
        },
      }),
    )
  },
}).effect("retains the complete prior replacement snapshot on timing-independent batch content collision", () =>
  Effect.gen(function* () {
    const mcp = yield* MCP.Service
    const registry = yield* ToolRegistry.Service
    for (contentRound = 0; contentRound < 2; contentRound++) {
      contentConfig.splice(
        0,
        1,
        new ConfigMCP.Info({
          servers: {
            "same server": new ConfigMCP.Local({ type: "local", command: ["left"] }),
            "same@server": new ConfigMCP.Local({ type: "local", command: ["right"] }),
          },
        }),
      )
      yield* mcp.reload()
      expect((yield* mcp.prompts()).map((item) => item.name)).toEqual(["same_server:stable"])
      expect((yield* mcp.getPrompt({ name: "same_server:stable" })).text).toBe("[user]\nold:stable")
      expect((yield* registry.materialize()).definitions.map((item) => item.name)).toContain("same_server_old")
      expect(contentClosed).toContain("left")
      expect((yield* mcp.status())["same server"]).toEqual({ status: "connected", transport: "local" })
      contentConfig.splice(
        0,
        1,
        new ConfigMCP.Info({
          servers: {
            "same server": new ConfigMCP.Local({
              type: "local",
              command: ["old"],
              timeout: 111,
              environment: { TOKEN: "old-secret" },
            }),
          },
        }),
      )
      yield* mcp.reload()
    }
    contentConfig.splice(
      0,
      1,
      new ConfigMCP.Info({
        servers: {
          "same server": new ConfigMCP.Local({
            type: "local",
            command: ["broken"],
            timeout: 222,
            environment: { TOKEN: "new-secret" },
          }),
        },
      }),
    )
    yield* mcp.reload()
    expect((yield* mcp.prompts()).map((item) => item.name)).toEqual(["same_server:stable"])
    expect((yield* mcp.getPrompt({ name: "same_server:stable" })).text).toBe("[user]\nold:stable")
    expect(oldRequestTimeout).toBe(111)
    expect(stagedToolTimeout).toBe(222)
    expect((yield* registry.materialize()).definitions.map((item) => item.name)).toContain("same_server_old")
    oldRequestFails = true
    const failure = yield* mcp.getPrompt({ name: "same_server:stable" }).pipe(Effect.flip)
    expect(failure).toMatchObject({ message: "[REDACTED] request failed" })
    expect(JSON.stringify(failure)).not.toContain("old-secret")
  }),
)

const disabledConfig = [
  new ConfigMCP.Info({ servers: { disabled: new ConfigMCP.Local({ type: "local", command: ["enabled"] }) } }),
]
const disabledClose = Promise.withResolvers<void>()
const disabledRelease = Promise.withResolvers<void>()
fixture({
  documents: disabledConfig,
  connect: () =>
    Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {}, prompts: {}, resources: {} },
        list: () => Promise.resolve({ tools: [{ name: "tool", inputSchema: { type: "object" } }] }),
        call: () => Promise.resolve({ content: [] }),
        listPrompts: () => Promise.resolve({ prompts: [{ name: "prompt" }] }),
        getPrompt: () => Promise.resolve({ messages: [] }),
        listResources: () => Promise.resolve({ resources: [{ name: "resource", uri: "file:///resource" }] }),
        readResource: () => Promise.resolve({ contents: [] }),
        close: async () => {
          disabledClose.resolve()
          await disabledRelease.promise
        },
      }),
    ),
}).effect("atomically hides an enabled runtime before slow disabled replacement cleanup", () =>
  Effect.gen(function* () {
    const mcp = yield* MCP.Service
    disabledConfig.splice(
      0,
      1,
      new ConfigMCP.Info({
        servers: { disabled: new ConfigMCP.Local({ type: "local", command: ["disabled"], disabled: true }) },
      }),
    )
    const reload = yield* mcp.reload().pipe(Effect.forkChild)
    const started = yield* Effect.promise(() =>
      Promise.race([disabledClose.promise.then(() => true), Bun.sleep(50).then(() => false)]),
    )
    const definitions = (yield* (yield* ToolRegistry.Service).materialize()).definitions
    const prompts = yield* mcp.prompts()
    const resources = yield* mcp.resources()
    const status = (yield* mcp.status()).disabled
    disabledRelease.resolve()
    yield* Fiber.join(reload)
    expect(started).toBe(true)
    expect(definitions).toEqual([])
    expect(prompts).toEqual([])
    expect(resources).toEqual([])
    expect(status).toEqual({ status: "disabled" })
  }),
)

const contentOnlyConfig = [
  new ConfigMCP.Info({ servers: { contentOnly: new ConfigMCP.Local({ type: "local", command: ["tools"] }) } }),
]
fixture({
  documents: contentOnlyConfig,
  connect: (input) => {
    const contentOnly = input.config.type === "local" && input.config.command.at(-1) === "content"
    return Effect.succeed(
      MCPClient.make({
        capabilities: contentOnly ? { prompts: {} } : { tools: {}, prompts: {} },
        list: () => Promise.resolve({ tools: [{ name: "old", inputSchema: { type: "object" } }] }),
        call: () => Promise.resolve({ content: [] }),
        listPrompts: () => Promise.resolve({ prompts: [{ name: contentOnly ? "new" : "old" }] }),
        getPrompt: ({ name }) =>
          Promise.resolve({ messages: [{ role: "user", content: { type: "text", text: name } }] }),
        close: () => Promise.resolve(),
      }),
    )
  },
}).effect("removes stale tools when replacing a tool server with content-only", () =>
  Effect.gen(function* () {
    const mcp = yield* MCP.Service
    contentOnlyConfig.splice(
      0,
      1,
      new ConfigMCP.Info({ servers: { contentOnly: new ConfigMCP.Local({ type: "local", command: ["content"] }) } }),
    )
    yield* mcp.reload()
    expect((yield* (yield* ToolRegistry.Service).materialize()).definitions).toEqual([])
    expect((yield* mcp.prompts()).map((item) => item.rawName)).toEqual(["new"])
    expect((yield* mcp.getPrompt({ name: "contentOnly:new" })).text).toBe("[user]\nnew")
  }),
)

const closedReplacementConfig = [
  new ConfigMCP.Info({ servers: { closed: new ConfigMCP.Local({ type: "local", command: ["old"] }) } }),
]
let replacementClose: (() => void) | undefined
fixture({
  documents: closedReplacementConfig,
  connect: (input) => {
    const version = input.config.type === "local" ? input.config.command.at(-1)! : "remote"
    return Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {}, prompts: {} },
        list: () => {
          if (version === "old") return Promise.resolve({ tools: [{ name: "old", inputSchema: { type: "object" } }] })
          const tool = { name: "new" } as { name: string; inputSchema: Readonly<Record<string, unknown>> }
          Object.defineProperty(tool, "inputSchema", {
            enumerable: true,
            get: () => {
              replacementClose?.()
              return { type: "object" }
            },
          })
          return Promise.resolve({ tools: [tool] })
        },
        call: ({ name }) => Promise.resolve({ content: [{ type: "text", text: `${version}:${name}` }] }),
        listPrompts: () => Promise.resolve({ prompts: [{ name: version }] }),
        getPrompt: ({ name }) =>
          Promise.resolve({ messages: [{ role: "user", content: { type: "text", text: `${version}:${name}` } }] }),
        closed: (handler) => {
          if (version === "new") replacementClose = handler
        },
        close: () => Promise.resolve(),
      }),
    )
  },
}).effect("restores the complete old runtime when replacement closes during tool installation", () =>
  Effect.gen(function* () {
    const mcp = yield* MCP.Service
    closedReplacementConfig.splice(
      0,
      1,
      new ConfigMCP.Info({ servers: { closed: new ConfigMCP.Local({ type: "local", command: ["new"] }) } }),
    )
    yield* mcp.reload()
    expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((item) => item.name)).toEqual([
      "closed_old",
    ])
    expect((yield* mcp.prompts()).map((item) => item.rawName)).toEqual(["old"])
    expect((yield* mcp.getPrompt({ name: "closed:old" })).text).toBe("[user]\nold:old")
    expect((yield* mcp.status()).closed).toEqual({ status: "connected", transport: "local" })
  }),
)

const atomicConfig = [
  new ConfigMCP.Info({ servers: { atomic: new ConfigMCP.Local({ type: "local", command: ["old"] }) } }),
]
let atomicClose: (() => void) | undefined
const atomicObserved: string[][] = []
fixture({
  documents: atomicConfig,
  registering: (tools, registry) =>
    Object.hasOwn(tools, "atomic_new")
      ? Effect.sync(() => atomicClose?.()).pipe(
          Effect.andThen(registry.materialize()),
          Effect.tap((materialized) =>
            Effect.sync(() => atomicObserved.push(materialized.definitions.map((item) => item.name))),
          ),
          Effect.asVoid,
        )
      : Effect.void,
  connect: (input) => {
    const version = input.config.type === "local" ? input.config.command.at(-1)! : "remote"
    return Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {} },
        list: () => Promise.resolve({ tools: [{ name: version, inputSchema: { type: "object" } }] }),
        call: () => Promise.resolve({ content: [] }),
        closed: (handler) => {
          if (version === "new") atomicClose = handler
        },
        close: () => Promise.resolve(),
      }),
    )
  },
}).effect("never materializes candidate tools when replacement closes during registration", () =>
  Effect.gen(function* () {
    const mcp = yield* MCP.Service
    atomicConfig.splice(
      0,
      1,
      new ConfigMCP.Info({ servers: { atomic: new ConfigMCP.Local({ type: "local", command: ["new"] }) } }),
    )
    yield* mcp.reload()
    expect(atomicObserved).toEqual([["atomic_old"]])
    expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((item) => item.name)).toEqual([
      "atomic_old",
    ])
  }),
)

const orderedDisabledConfig = [
  new ConfigMCP.Info({
    servers: {
      orderedDisabled: new ConfigMCP.Local({ type: "local", command: ["enabled"] }),
      orderedSlow: new ConfigMCP.Local({ type: "local", command: ["old"] }),
    },
  }),
]
const orderedDiscovery = Promise.withResolvers<void>()
const orderedRelease = Promise.withResolvers<void>()
const orderedClose = Promise.withResolvers<void>()
fixture({
  documents: orderedDisabledConfig,
  connect: (input) => {
    const version = input.config.type === "local" ? input.config.command.at(-1)! : "remote"
    return Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {}, prompts: {}, resources: {} },
        list: async () => {
          if (version === "slow") {
            orderedDiscovery.resolve()
            await orderedRelease.promise
          }
          return { tools: [{ name: "tool", inputSchema: { type: "object" } }] }
        },
        call: () => Promise.resolve({ content: [] }),
        listPrompts: () => Promise.resolve({ prompts: [{ name: "prompt" }] }),
        getPrompt: () => Promise.resolve({ messages: [] }),
        listResources: () => Promise.resolve({ resources: [{ name: "resource", uri: "file:///resource" }] }),
        readResource: () => Promise.resolve({ contents: [] }),
        close: async () => {
          if (version === "enabled") orderedClose.resolve()
        },
      }),
    )
  },
}).effect("disables and hides a server before unrelated replacement discovery completes", () =>
  Effect.gen(function* () {
    const mcp = yield* MCP.Service
    orderedDisabledConfig.splice(
      0,
      1,
      new ConfigMCP.Info({
        servers: {
          orderedDisabled: new ConfigMCP.Local({ type: "local", command: ["disabled"], disabled: true }),
          orderedSlow: new ConfigMCP.Local({ type: "local", command: ["slow"] }),
        },
      }),
    )
    const reload = yield* mcp.reload().pipe(Effect.forkChild)
    yield* Effect.promise(() => orderedDiscovery.promise)
    const definitions = (yield* (yield* ToolRegistry.Service).materialize()).definitions.map((item) => item.name)
    const prompts = (yield* mcp.prompts()).map((item) => item.name)
    const resources = (yield* mcp.resources()).map((item) => item.name)
    const status = (yield* mcp.status()).orderedDisabled
    const closed = yield* Effect.promise(() =>
      Promise.race([orderedClose.promise.then(() => true), Bun.sleep(50).then(() => false)]),
    )
    orderedRelease.resolve()
    yield* Fiber.join(reload)
    expect(definitions).not.toContain("orderedDisabled_tool")
    expect(prompts).not.toContain("orderedDisabled:prompt")
    expect(resources).not.toContain("orderedDisabled:resource")
    expect(status).toEqual({ status: "disabled" })
    expect(closed).toBe(true)
  }),
)

let contentPages = 0
let resourcePages = 0
fixture({
  documents: [
    new ConfigMCP.Info({
      servers: {
        repeated: new ConfigMCP.Local({ type: "local", command: ["repeated"] }),
        overflow: new ConfigMCP.Local({ type: "local", command: ["overflow"] }),
        duplicate: new ConfigMCP.Local({ type: "local", command: ["duplicate"] }),
        sanitized: new ConfigMCP.Local({ type: "local", command: ["sanitized"] }),
      },
    }),
  ],
  connect: (input) =>
    Effect.succeed(
      MCPClient.make({
        capabilities: { tools: {}, prompts: {}, resources: {} },
        list: () => Promise.resolve({ tools: [{ name: "tool", inputSchema: { type: "object" } }] }),
        call: () => Promise.resolve({ content: [] }),
        listPrompts: () => {
          if (input.name === "repeated") return Promise.resolve({ prompts: [], nextCursor: "same" })
          if (input.name === "overflow") {
            contentPages++
            return Promise.resolve({ prompts: [], nextCursor: String(contentPages) })
          }
          if (input.name === "duplicate") return Promise.resolve({ prompts: [{ name: "same" }, { name: "same" }] })
          return Promise.resolve({ prompts: [{ name: "same name" }, { name: "same@name" }] })
        },
        getPrompt: () => Promise.resolve({ messages: [] }),
        listResources: () => {
          if (input.name === "repeated") return Promise.resolve({ resources: [], nextCursor: "resource-same" })
          if (input.name === "overflow") {
            resourcePages++
            return Promise.resolve({ resources: [], nextCursor: String(resourcePages) })
          }
          if (input.name === "duplicate")
            return Promise.resolve({
              resources: [
                { name: "same", uri: "file:///one" },
                { name: "same", uri: "file:///two" },
              ],
            })
          return Promise.resolve({
            resources: [
              { name: "same name", uri: "file:///one" },
              { name: "same@name", uri: "file:///two" },
            ],
          })
        },
        readResource: () => Promise.resolve({ contents: [] }),
        close: () => Promise.resolve(),
      }),
    ),
}).effect(
  "rejects content cursor repetition, overflow, duplicate raw names, and sanitize collisions without tools",
  () =>
    Effect.gen(function* () {
      const mcp = yield* MCP.Service
      expect(yield* mcp.prompts()).toEqual([])
      expect(yield* mcp.resources()).toEqual([])
      expect(contentPages).toBe(1000)
      expect(resourcePages).toBe(1000)
      expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((item) => item.name)).toEqual([
        "repeated_tool",
        "overflow_tool",
        "duplicate_tool",
        "sanitized_tool",
      ])
      expect(Object.values(yield* mcp.status()).every((status) => status.status === "connected")).toBe(true)
    }),
)

let staleConnection = 0
const staleHandlers: Array<() => void | Promise<void>> = []
const staleResourceHandlers: Array<() => void | Promise<void>> = []
fixture({
  documents: [new ConfigMCP.Info({ servers: { stale: new ConfigMCP.Local({ type: "local", command: ["stale"] }) } })],
  connect: () => {
    const id = ++staleConnection
    return Effect.succeed(
      MCPClient.make({
        capabilities: { prompts: { listChanged: true }, resources: { listChanged: true } },
        list: () => Promise.resolve({ tools: [] }),
        call: () => Promise.resolve({ content: [] }),
        listPrompts: () => Promise.resolve({ prompts: [{ name: `prompt_${id}` }] }),
        getPrompt: () => Promise.resolve({ messages: [] }),
        listResources: () => Promise.resolve({ resources: [{ name: `resource_${id}`, uri: `file:///${id}` }] }),
        readResource: () => Promise.resolve({ contents: [] }),
        promptsChanged: (handler) => staleHandlers.push(handler),
        resourcesChanged: (handler) => staleResourceHandlers.push(handler),
        close: () => Promise.resolve(),
      }),
    )
  },
}).effect("fences stale prompt and resource list-changed callbacks after reconnect", () =>
  Effect.gen(function* () {
    const mcp = yield* MCP.Service
    const stale = staleHandlers[0]!
    const staleResource = staleResourceHandlers[0]!
    yield* mcp.reconnect("stale")
    expect((yield* mcp.prompts()).map((item) => item.rawName)).toEqual(["prompt_2"])
    expect((yield* mcp.resources()).map((item) => item.rawName)).toEqual(["resource_2"])
    yield* Effect.promise(() => Promise.resolve(stale()))
    yield* Effect.promise(() => Promise.resolve(staleResource()))
    expect((yield* mcp.prompts()).map((item) => item.rawName)).toEqual(["prompt_2"])
    expect((yield* mcp.resources()).map((item) => item.rawName)).toEqual(["resource_2"])
  }),
)

const requestStarted = Promise.withResolvers<void>()
const requestAborted = Promise.withResolvers<void>()
let requestMode: "abort" | "fail" = "abort"
fixture({
  documents: [
    new ConfigMCP.Info({
      servers: {
        request: new ConfigMCP.Remote({
          type: "remote",
          url: "https://example.test/mcp",
          headers: { Authorization: "Bearer content-secret" },
        }),
      },
    }),
  ],
  connect: () =>
    Effect.succeed(
      MCPClient.make({
        capabilities: { prompts: {}, resources: {} },
        list: () => Promise.resolve({ tools: [] }),
        call: () => Promise.resolve({ content: [] }),
        listPrompts: () => Promise.resolve({ prompts: [{ name: "prompt" }] }),
        listResources: () => Promise.resolve({ resources: [{ name: "resource", uri: "file:///resource" }] }),
        getPrompt: (_input, options) =>
          requestMode === "fail"
            ? Promise.reject(new Error("Bearer content-secret prompt failure"))
            : new Promise((_resolve, reject) => {
                requestStarted.resolve()
                options.signal.addEventListener("abort", () => {
                  requestAborted.resolve()
                  reject(new DOMException("aborted", "AbortError"))
                })
              }),
        readResource: () => Promise.reject(new Error("Bearer content-secret resource failure")),
        close: () => Promise.resolve(),
      }),
    ),
}).effect("types and redacts get/read failures and aborts interrupted requests", () =>
  Effect.gen(function* () {
    const mcp = yield* MCP.Service
    const fiber = yield* mcp.getPrompt({ name: "request:prompt" }).pipe(Effect.forkChild)
    yield* Effect.promise(() => requestStarted.promise)
    yield* Fiber.interrupt(fiber)
    yield* Effect.promise(() => requestAborted.promise)
    const exit = yield* Fiber.await(fiber)
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
    requestMode = "fail"
    const prompt = yield* mcp.getPrompt({ name: "request:prompt" }).pipe(Effect.flip)
    const resource = yield* mcp.readResource("request:resource").pipe(Effect.flip)
    expect(prompt).toBeInstanceOf(MCP.RequestError)
    expect(resource).toBeInstanceOf(MCP.RequestError)
    expect(JSON.stringify([prompt, resource])).not.toContain("content-secret")
  }),
)

const authDocuments = [
  new ConfigMCP.Info({
    servers: {
      staged: new ConfigMCP.Remote({ type: "remote", url: "https://old.example/mcp", oauth: { client_id: "old-client" } }),
    },
  }),
]
const authBegins: Array<{ target: MCPOAuthStore.Target; config: typeof ConfigMCP.OAuth.Type }> = []
const authRemoves: MCPOAuthStore.Target[] = []
const authEvents: Array<{ type: string; data: unknown }> = []
let authChange: Parameters<MCPOAuth.Interface["onChange"]>[0] | undefined
let authReset = (_target: MCPOAuthStore.Target) => Effect.void
const authStore: MCPOAuthStore.Interface = {
  get: () => Effect.succeed({}),
  update: (_target, change) => Effect.succeed(change({})),
  remove: () => Effect.void,
  saveTokens: () => Effect.void,
  invalidate: () => Effect.void,
  findAttempt: () => Effect.succeed(undefined),
  claimAttempt: () => Effect.succeed({ status: "missing" }),
  cancelAttempt: () => Effect.succeed({ status: "missing" }),
  readyAttempt: () => Effect.succeed(undefined),
  startExchange: () => Effect.succeed(undefined),
  finishExchange: () => Effect.succeed(false),
  finishAttempt: () => Effect.succeed(false),
  cancelTarget: () => Effect.void,
}
const stagedOAuth: MCPOAuth.Interface = {
  status: () => Effect.succeed({ status: "auth-required" }),
  begin: (input) =>
    Effect.sync(() => {
      authBegins.push(input)
      return {
        status: "authorizing" as const,
        attemptID: "mcp_auth_staged" as const,
        mode: "manual" as const,
        created: 1,
        expires: 2,
        authorizationUrl: "https://auth.example/authorize",
      }
    }),
  complete: () => Effect.fail(new MCPOAuth.AuthError({ code: "attempt-invalid", message: "unused" })),
  cancel: () => Effect.void,
  remove: (target) => Effect.sync(() => authRemoves.push(target)).pipe(Effect.asVoid),
  reset: (target) => authReset(target),
  stop: () => Effect.void,
  recover: () => Effect.void,
  onComplete: () => Effect.void,
  onChange: (handler) => Effect.sync(() => {
    authChange = handler
  }).pipe(Effect.asVoid),
}
fixture({
  documents: authDocuments,
  oauth: stagedOAuth,
  oauthStore: authStore,
  events: authEvents,
  connect: (input) =>
    input.config.type === "remote" && input.config.url === "https://new.example/mcp"
      ? Effect.fail(new MCPClient.ConnectionError({ message: "MCP authentication is required", code: "auth-required" }))
      : Effect.succeed(
          MCPClient.make({
            capabilities: { tools: {} },
            list: () => Promise.resolve({ tools: [{ name: "old", inputSchema: { type: "object" } }] }),
            call: () => Promise.resolve({ content: [] }),
            close: () => Promise.resolve(),
          }),
        ),
}).effect("keeps active runtime while auth controls own the failed replacement candidate", () =>
  Effect.gen(function* () {
    const mcp = yield* MCP.Service
    const resetStarted = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    authReset = (target) => Effect.promise(async () => {
      expect(target.endpoint).toBe("https://old.example/mcp")
      resetStarted.resolve()
      await release.promise
    })
    authDocuments[0] = new ConfigMCP.Info({
      servers: {
        staged: new ConfigMCP.Remote({
          type: "remote",
          url: "https://new.example/mcp",
          oauth: { client_id: "new-client", scope: "new-scope", redirect_uri: "https://client.example/new" },
        }),
      },
    })
    const reload = yield* mcp.reload().pipe(Effect.forkChild)
    yield* Effect.promise(() => resetStarted.promise)
    release.resolve()
    yield* Fiber.join(reload)
    authReset = () => Effect.void
    expect((yield* mcp.status()).staged).toMatchObject({ status: "connected" })
    expect((yield* (yield* ToolRegistry.Service).materialize()).definitions.map((item) => item.name)).toContain("staged_old")
    const started = yield* mcp.beginAuth({ name: "staged", mode: "manual" })
    expect(started.status).toBe("authorizing")
    expect(authBegins.at(-1)).toMatchObject({
      target: { endpoint: "https://new.example/mcp" },
      config: { client_id: "new-client", scope: "new-scope", redirect_uri: "https://client.example/new" },
    })
    authEvents.length = 0
    authChange?.(authBegins.at(-1)!.target, { status: "failed", code: "provider-error" })
    const changed = authEvents.filter((event) => event.type === MCP.Event.AuthChanged.type)
    expect(changed).toHaveLength(1)
    expect(changed[0]?.data).toEqual({ server: "staged", status: { status: "failed", code: "provider-error" } })
    expect(JSON.stringify(changed)).not.toContain("authorize")
    expect(JSON.stringify(changed)).not.toContain("new-client")
    yield* mcp.removeAuth("staged")
    expect(authRemoves.map((target) => target.endpoint).toSorted()).toEqual([
      "https://new.example/mcp",
      "https://old.example/mcp",
    ])
    let disabledReset = 0
    authReset = () => Effect.sync(() => disabledReset++)
    authDocuments[0] = new ConfigMCP.Info({
      servers: {
        staged: new ConfigMCP.Remote({
          type: "remote",
          url: "https://new.example/mcp",
          oauth: { client_id: "new-client", scope: "new-scope", redirect_uri: "https://client.example/new" },
          disabled: true,
        }),
      },
    })
    yield* mcp.reload()
    expect(disabledReset).toBeGreaterThan(0)
    expect((yield* mcp.status()).staged).toEqual({ status: "disabled" })
    authReset = () => Effect.void
    expect(() => Schema.decodeUnknownSync(MCP.AuthStatus)({ status: "failed", code: "remote-body" })).toThrow()
  }),
)
