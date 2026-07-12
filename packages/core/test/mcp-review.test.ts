import { expect } from "bun:test"
import { MCPClient } from "@slopcode-ai/core/mcp/client"
import { Cause, Deferred, Effect, Exit, Fiber } from "effect"
import { it } from "./lib/effect"

const connection = (close: () => Promise<void>) =>
  MCPClient.make({
    capabilities: {},
    list: () => Promise.resolve({ tools: [] }),
    call: () => Promise.resolve({ content: [] }),
    close,
  })

it.effect("aborts an interrupted connect and closes a client that resolves late", () =>
  Effect.gen(function* () {
    const pending = Promise.withResolvers<MCPClient.Connection>()
    const closed = yield* Deferred.make<void>()
    const started = Promise.withResolvers<void>()
    let signal: AbortSignal | undefined
    const fiber = yield* MCPClient.interruptible((abort) => {
      signal = abort
      started.resolve()
      return pending.promise
    }).pipe(Effect.forkChild)
    yield* Effect.promise(() => started.promise)
    const aborted = Promise.withResolvers<void>()
    signal!.addEventListener("abort", () => aborted.resolve())
    yield* Fiber.interrupt(fiber).pipe(Effect.forkChild)
    yield* Effect.promise(() => aborted.promise)
    expect(signal?.aborted).toBe(true)
    pending.resolve(connection(() => Effect.runPromise(Deferred.succeed(closed, undefined))))
    yield* Deferred.await(closed)
    const exit = yield* Fiber.await(fiber)
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
  }),
)

it.effect("closes a connect result when interruption races immediately after resolution", () =>
  Effect.gen(function* () {
    const resolved = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const closed = Promise.withResolvers<void>()
    let signal: AbortSignal | undefined
    const fiber = yield* MCPClient.interruptible(async (abort) => {
      signal = abort
      resolved.resolve()
      await release.promise
      return connection(async () => closed.resolve())
    }).pipe(Effect.forkChild)
    yield* Effect.promise(() => resolved.promise)
    const aborted = Promise.withResolvers<void>()
    signal!.addEventListener("abort", () => aborted.resolve())
    const interrupt = yield* Fiber.interrupt(fiber).pipe(Effect.forkChild)
    yield* Effect.promise(() => aborted.promise)
    release.resolve()
    yield* Effect.promise(() => closed.promise)
    yield* Fiber.join(interrupt)
  }),
)

it.effect("always performs bounded process-tree escalation when SDK close rejects", () =>
  Effect.gen(function* () {
    const signals: Array<{ pids: ReadonlyArray<number>; signal: "SIGTERM" | "SIGKILL" }> = []
    let scans = 0
    const error = yield* Effect.flip(
      Effect.tryPromise({
        try: () =>
          MCPClient.cleanup(
            10,
            async () => {
              throw new Error("close failed")
            },
            {
              platform: "linux",
              tree: async () => (++scans === 1 ? [11] : [11, 12]),
              signal: async (pids, signal) => signals.push({ pids, signal }),
              alive: async (pids) => pids.filter((pid) => pid === 12),
              sleep: async () => {},
            },
          ),
        catch: (cause) => cause,
      }),
    )
    expect(String(error)).toContain("close failed")
    expect(signals).toEqual([
      { pids: [12, 11, 10], signal: "SIGTERM" },
      { pids: [12], signal: "SIGKILL" },
    ])
    expect(scans).toBeGreaterThan(1)
  }),
)

it.effect("uses awaited Windows tree termination and preserves generated SSE headers", () =>
  Effect.gen(function* () {
    const windows: number[] = []
    yield* Effect.promise(() =>
      MCPClient.cleanup(20, async () => {}, {
        platform: "win32",
        tree: async () => [21],
        signal: async () => {},
        alive: async () => [],
        windows: async (pid) => windows.push(pid),
        sleep: async () => {},
      }),
    )
    expect(windows).toEqual([20])
    const configured = { Authorization: "configured", "X-Test": "yes" }
    expect(Object.fromEntries(MCPClient.headers({ Accept: "text/event-stream" }, configured))).toEqual({
      accept: "text/event-stream",
      authorization: "configured",
      "x-test": "yes",
    })
    expect(
      Object.fromEntries(
        MCPClient.headers(
          { Accept: "text/event-stream", "Last-Event-ID": "event-2", Authorization: "generated" },
          configured,
        ),
      ),
    ).toEqual({
      accept: "text/event-stream",
      "last-event-id": "event-2",
      authorization: "configured",
      "x-test": "yes",
    })
  }),
)

it.effect("continues awaited process cleanup when the waiting Effect is interrupted", () =>
  Effect.gen(function* () {
    const closeStarted = Promise.withResolvers<void>()
    const closeRelease = Promise.withResolvers<void>()
    const cleaned = Promise.withResolvers<void>()
    const fiber = yield* Effect.promise(() =>
      MCPClient.cleanup(
        30,
        async () => {
          closeStarted.resolve()
          await closeRelease.promise
        },
        {
          platform: "linux",
          tree: async () => [31],
          signal: async (_pids, signal) => {
            if (signal === "SIGTERM") cleaned.resolve()
          },
          alive: async () => [],
          sleep: async () => {},
        },
      ),
    ).pipe(Effect.forkChild)
    yield* Effect.promise(() => closeStarted.promise)
    yield* Fiber.interrupt(fiber)
    closeRelease.resolve()
    yield* Effect.promise(() => cleaned.promise)
  }),
)

it.effect("tracks close from acquisition and replays it exactly once to late handlers", () =>
  Effect.sync(() => {
    let notify: (() => void) | undefined
    const client = MCPClient.make({
      capabilities: {},
      list: () => Promise.resolve({ tools: [] }),
      call: () => Promise.resolve({ content: [] }),
      closed: (handler) => {
        notify = handler
      },
      close: () => Promise.resolve(),
    })
    expect(notify).toBeDefined()
    notify!()
    let first = 0
    let second = 0
    client.closed(() => first++)
    client.closed(() => second++)
    notify!()
    expect(first).toBe(1)
    expect(second).toBe(1)
  }),
)

it.effect("bounds a never-settling SDK close and still escalates a stubborn grandchild", () =>
  Effect.gen(function* () {
    const signals: Array<{ pids: ReadonlyArray<number>; signal: "SIGTERM" | "SIGKILL" }> = []
    let scans = 0
    yield* Effect.promise(() =>
      MCPClient.cleanup(40, () => new Promise(() => {}), {
        platform: "linux",
        tree: async () => (++scans === 1 ? [41] : [41, 42]),
        signal: async (pids, signal) => signals.push({ pids, signal }),
        alive: async (pids) => pids.filter((pid) => pid === 42),
        sleep: async () => {},
      }),
    )
    expect(signals).toEqual([
      { pids: [42, 41, 40], signal: "SIGTERM" },
      { pids: [42], signal: "SIGKILL" },
    ])
    expect(scans).toBeGreaterThan(1)
  }),
)
