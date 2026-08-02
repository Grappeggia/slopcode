import { expect, mock, beforeEach } from "bun:test"
import { EventEmitter } from "events"
import { Deferred, Effect, Layer, Option } from "effect"
import { awaitWithTimeout, testEffect } from "../lib/effect"
import { provideInstance, TestInstance, tmpdirScoped } from "../fixture/fixture"
import type { MCP as MCPNS } from "../../src/mcp/index"

// Track open() calls and control failure behavior
let openShouldFail = false
let openCalledWith: string | undefined
let openDeferred: Deferred.Deferred<string> | undefined

void mock.module("open", () => ({
  default: async (url: string) => {
    openCalledWith = url
    if (openDeferred) Effect.runSync(Deferred.succeed(openDeferred, url).pipe(Effect.ignore))

    // Return a mock subprocess that emits an error if openShouldFail is true
    const subprocess = new EventEmitter()
    if (openShouldFail) {
      // Emit error asynchronously like a real subprocess would
      setTimeout(() => {
        subprocess.emit("error", new Error("spawn xdg-open ENOENT"))
      }, 10)
    }
    return subprocess
  },
}))

// Mock UnauthorizedError
class MockUnauthorizedError extends Error {
  constructor() {
    super("Unauthorized")
    this.name = "UnauthorizedError"
  }
}

// Track what options were passed to each transport constructor
const transportCalls: Array<{
  type: "streamable" | "sse"
  url: string
  options: { authProvider?: unknown; requestInit?: RequestInit }
}> = []
const finished: Array<{ url: string; code: string }> = []
let finishShouldFail = false

// Mock the transport constructors
void mock.module("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: class MockStreamableHTTP {
    url: string
    authProvider:
      | {
          state?: () => Promise<string>
          saveCodeVerifier?: (value: string) => Promise<void>
          redirectToAuthorization?: (url: URL) => Promise<void>
        }
      | undefined
    constructor(
      url: URL,
      options?: {
        authProvider?: {
          state?: () => Promise<string>
          saveCodeVerifier?: (value: string) => Promise<void>
          redirectToAuthorization?: (url: URL) => Promise<void>
        }
        requestInit?: RequestInit
      },
    ) {
      this.url = url.toString()
      this.authProvider = options?.authProvider
      transportCalls.push({
        type: "streamable",
        url: url.toString(),
        options: options ?? {},
      })
    }
    async start() {
      // Simulate OAuth redirect by calling the authProvider's redirectToAuthorization
      const state = await this.authProvider?.state?.()
      if (state) await this.authProvider?.saveCodeVerifier?.(`verifier-${state}`)
      if (this.authProvider?.redirectToAuthorization) {
        await this.authProvider.redirectToAuthorization(new URL("https://auth.example.com/authorize?client_id=test"))
      }
      throw new MockUnauthorizedError()
    }
    async finishAuth(code: string) {
      if (finishShouldFail) throw new Error("OAuth token exchange failed")
      finished.push({ url: this.url, code })
    }
  },
}))

void mock.module("@modelcontextprotocol/sdk/client/sse.js", () => ({
  SSEClientTransport: class MockSSE {
    constructor(url: URL) {
      transportCalls.push({
        type: "sse",
        url: url.toString(),
        options: {},
      })
    }
    async start() {
      throw new Error("Mock SSE transport cannot connect")
    }
  },
}))

// Mock the MCP SDK Client to trigger OAuth flow
void mock.module("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class MockClient {
    async connect(transport: { start: () => Promise<void> }) {
      await transport.start()
    }

    getServerCapabilities() {
      return { tools: {} }
    }
  },
}))

// Mock UnauthorizedError in the auth module
void mock.module("@modelcontextprotocol/sdk/client/auth.js", () => ({
  UnauthorizedError: MockUnauthorizedError,
}))

beforeEach(() => {
  openShouldFail = false
  openCalledWith = undefined
  openDeferred = undefined
  transportCalls.length = 0
  finished.length = 0
  finishShouldFail = false
})

// Import modules after mocking
const { MCP } = await import("../../src/mcp/index")
const { EventV2Bridge } = await import("../../src/event-v2-bridge")
const { Config } = await import("../../src/config/config")
const { McpAuth } = await import("../../src/mcp/auth")
const { McpOAuthCallback } = await import("../../src/mcp/oauth-callback")
const { FSUtil } = await import("@slopcode-ai/core/fs-util")
const { CrossSpawnSpawner } = await import("@slopcode-ai/core/cross-spawn-spawner")
const mcpTest = testEffect(
  MCP.layer.pipe(
    Layer.provideMerge(McpAuth.defaultLayer),
    Layer.provideMerge(EventV2Bridge.defaultLayer),
    Layer.provide(Config.defaultLayer),
    Layer.provide(CrossSpawnSpawner.defaultLayer),
    Layer.provide(FSUtil.defaultLayer),
  ),
)
const service = MCP.Service as unknown as Effect.Effect<MCPNS.Interface, never, never>

const config = (name: string, headers?: Record<string, string>, url = "https://example.com/mcp") => ({
  mcp: {
    [name]: {
      type: "remote" as const,
      url,
      headers,
    },
  },
})

const withCallbackStop = Effect.addFinalizer(() => Effect.promise(() => McpOAuthCallback.stop()).pipe(Effect.ignore))

const trackBrowserOpen = Effect.gen(function* () {
  const opened = yield* Deferred.make<string>()
  openDeferred = opened
  yield* Effect.addFinalizer(() => Effect.sync(() => (openDeferred = undefined)))
  return opened
})

const trackBrowserOpenFailed = Effect.gen(function* () {
  const events = yield* EventV2Bridge.Service
  const event = yield* Deferred.make<{ mcpName: string; url: string }>()
  const unsubscribe = yield* events.listen((evt) => {
    if (evt.type === MCP.BrowserOpenFailed.type)
      Deferred.doneUnsafe(event, Effect.succeed(evt.data as { mcpName: string; url: string }))
    return Effect.void
  })
  yield* Effect.addFinalizer(() => unsubscribe)
  return event
})

const authenticateScoped = (name: string) =>
  Effect.gen(function* () {
    const mcp = yield* service
    yield* mcp.authenticate(name).pipe(
      Effect.ignore,
      Effect.catchCause(() => Effect.void),
      Effect.forkScoped,
    )
  })

mcpTest.instance(
  "BrowserOpenFailed event is published when open() throws",
  () =>
    Effect.gen(function* () {
      yield* withCallbackStop
      openShouldFail = true

      const event = yield* trackBrowserOpenFailed
      yield* authenticateScoped("test-oauth-server")

      const failure = yield* awaitWithTimeout(
        Deferred.await(event),
        "Timed out waiting for BrowserOpenFailed event",
        "5 seconds",
      )

      expect(failure.mcpName).toBe("test-oauth-server")
      expect(failure.url).toContain("https://")
    }),
  { config: config("test-oauth-server") },
)

mcpTest.instance(
  "BrowserOpenFailed event is NOT published when open() succeeds",
  () =>
    Effect.gen(function* () {
      yield* withCallbackStop
      openShouldFail = false

      const opened = yield* trackBrowserOpen
      const event = yield* trackBrowserOpenFailed
      yield* authenticateScoped("test-oauth-server-2")

      yield* awaitWithTimeout(Deferred.await(opened), "Timed out waiting for open()", "5 seconds")
      const failure = yield* Deferred.await(event).pipe(Effect.timeoutOption("700 millis"))

      expect(failure).toEqual(Option.none())
      expect(openCalledWith).toBeDefined()
    }),
  { config: config("test-oauth-server-2") },
)

mcpTest.instance(
  "open() is called with the authorization URL",
  () =>
    Effect.gen(function* () {
      yield* withCallbackStop
      openShouldFail = false
      openCalledWith = undefined

      const opened = yield* trackBrowserOpen
      const event = yield* trackBrowserOpenFailed
      yield* authenticateScoped("test-oauth-server-3")

      const url = yield* awaitWithTimeout(Deferred.await(opened), "Timed out waiting for open()", "5 seconds")
      const failure = yield* Deferred.await(event).pipe(Effect.timeoutOption("700 millis"))

      expect(failure).toEqual(Option.none())
      expect(typeof url).toBe("string")
      expect(url).toContain("https://")
      expect(transportCalls.at(-1)?.options.requestInit?.headers).toEqual({ "X-Custom-Header": "custom-value" })
    }),
  { config: config("test-oauth-server-3", { "X-Custom-Header": "custom-value" }) },
)

mcpTest.instance(
  "finishes concurrent same-name OAuth transports in their originating instances",
  () =>
    Effect.gen(function* () {
      yield* withCallbackStop
      const mcp = yield* service
      const first = (yield* TestInstance).directory
      const second = yield* tmpdirScoped({
        config: config("shared-oauth", undefined, "https://b.example.com/mcp"),
      }).pipe(Effect.provide(CrossSpawnSpawner.defaultLayer))

      const started = yield* Effect.all(
        [
          mcp.startAuth("shared-oauth").pipe(provideInstance(first)),
          mcp.startAuth("shared-oauth").pipe(provideInstance(second)),
        ],
        { concurrency: "unbounded" },
      )
      expect(started.map((result) => Object.keys(result).sort())).toEqual([
        ["authorizationUrl", "oauthState"],
        ["authorizationUrl", "oauthState"],
      ])

      yield* Effect.all(
        [
          mcp.finishAuth("shared-oauth", started[0].oauthState, "code-a").pipe(provideInstance(first)),
          mcp.finishAuth("shared-oauth", started[1].oauthState, "code-b").pipe(provideInstance(second)),
        ],
        { concurrency: "unbounded" },
      )

      expect(finished).toEqual(
        expect.arrayContaining([
          { url: "https://a.example.com/mcp", code: "code-a" },
          { url: "https://b.example.com/mcp", code: "code-b" },
        ]),
      )
    }),
  { config: config("shared-oauth", undefined, "https://a.example.com/mcp") },
)

mcpTest.instance(
  "completes concurrent same-target flows by state and rejects replay",
  () =>
    Effect.gen(function* () {
      yield* withCallbackStop
      const mcp = yield* service
      const first = yield* mcp.startAuth("same-target")
      const second = yield* mcp.startAuth("same-target")

      yield* mcp.finishAuth("same-target", second.oauthState, "code-second")
      yield* mcp.finishAuth("same-target", first.oauthState, "code-first")

      expect(finished).toEqual(
        expect.arrayContaining([
          { url: "https://same.example.com/mcp", code: "code-first" },
          { url: "https://same.example.com/mcp", code: "code-second" },
        ]),
      )
      expect(yield* Effect.exit(mcp.finishAuth("same-target", first.oauthState, "replay"))).toMatchObject({
        _tag: "Failure",
      })
    }),
  { config: config("same-target", undefined, "https://same.example.com/mcp") },
)

mcpTest.instance(
  "rejects a state submitted for a different MCP name and invalidates the flow",
  () =>
    Effect.gen(function* () {
      yield* withCallbackStop
      const mcp = yield* service
      const auth = yield* McpAuth.Service
      const instance = (yield* TestInstance).directory
      const started = yield* mcp.startAuth("matched")

      expect(yield* Effect.exit(mcp.finishAuth("mismatched", started.oauthState, "code"))).toMatchObject({
        _tag: "Failure",
      })
      expect(yield* Effect.exit(mcp.finishAuth("matched", started.oauthState, "replay"))).toMatchObject({
        _tag: "Failure",
      })
      expect((yield* auth.get({ instance, name: "matched" }, "https://matched.example.com/mcp"))?.flows).toBeUndefined()
      expect(finished).toEqual([])
    }),
  { config: config("matched", undefined, "https://matched.example.com/mcp") },
)

mcpTest.instance(
  "clears state and PKCE after completion failure and cancellation",
  () =>
    Effect.gen(function* () {
      yield* withCallbackStop
      const mcp = yield* service
      const auth = yield* McpAuth.Service
      const instance = (yield* TestInstance).directory
      const identity = { instance, name: "cleanup" }
      const url = "https://cleanup.example.com/mcp"

      const failed = yield* mcp.startAuth("cleanup")
      expect((yield* auth.get(identity, url))?.flows?.[failed.oauthState]?.codeVerifier).toBe(
        `verifier-${failed.oauthState}`,
      )
      finishShouldFail = true
      expect((yield* mcp.finishAuth("cleanup", failed.oauthState, "bad-code")).status).toBe("failed")
      expect((yield* auth.get(identity, url))?.flows?.[failed.oauthState]).toBeUndefined()

      finishShouldFail = false
      const cancelled = yield* mcp.startAuth("cleanup")
      yield* mcp.removeAuth("cleanup")
      expect((yield* auth.get(identity, url))?.flows?.[cancelled.oauthState]).toBeUndefined()
    }),
  { config: config("cleanup", undefined, "https://cleanup.example.com/mcp") },
)
