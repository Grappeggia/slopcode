import { expect, test } from "bun:test"
import { AgentSideConnection, PROTOCOL_VERSION, type Agent as ACPAgent } from "@agentclientprotocol/sdk"
import { once } from "node:events"
import { PassThrough } from "node:stream"
import { Duration, Effect } from "effect"
import { createTransport, runConnection } from "@/cli/cmd/acp"
import { Agent } from "@/acp/agent"
import type { Interface } from "@/acp/service"

const timeout = <T>(promise: Promise<T>) =>
  Effect.runPromise(Effect.promise(() => promise).pipe(Effect.timeout(Duration.seconds(1))))

const agent = (): ACPAgent => ({
  initialize: async () => ({ protocolVersion: PROTOCOL_VERSION, agentCapabilities: {} }),
  newSession: async () => ({ sessionId: "test" }),
  authenticate: async () => {},
  prompt: async () => ({ stopReason: "end_turn" }),
  cancel: async () => {},
})

test("ACP transport observes stdin EOF emitted before listener setup", async () => {
  const input = new PassThrough()
  input.end()
  input.resume()
  await once(input, "end")

  const output = new PassThrough()
  const transport = createTransport(input, output)
  await timeout(transport.closed)

  expect(input.readableEnded).toBe(true)
  expect(await transport.stream.readable.getReader().read()).toEqual({ done: true, value: undefined })
  transport.dispose()
})

test("ACP transport closes when stdout closes while stdin remains open", async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  const state = { stops: 0 }
  const running = runConnection({
    input,
    output,
    create: () => ({
      connect: (stream) => new AgentSideConnection(() => agent(), stream),
      cleanup: () => Promise.resolve(),
    }),
    stop: async () => {
      state.stops++
    },
  })
  output.destroy()

  await timeout(running)
  expect(input.readableEnded).toBe(false)
  expect(state.stops).toBe(1)
})

test("ACP transport removes process stream listeners on close", async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  const before = {
    data: input.listenerCount("data"),
    end: input.listenerCount("end"),
    inputError: input.listenerCount("error"),
    close: output.listenerCount("close"),
    outputError: output.listenerCount("error"),
  }
  const transport = createTransport(input, output)

  expect(input.listenerCount("data")).toBe(before.data + 1)
  expect(input.listenerCount("end")).toBe(before.end + 1)
  expect(input.listenerCount("error")).toBe(before.inputError + 1)
  expect(output.listenerCount("close")).toBe(before.close + 1)
  expect(output.listenerCount("error")).toBe(before.outputError + 1)

  transport.close()
  await timeout(transport.closed)
  expect(input.listenerCount("data")).toBe(before.data)
  expect(input.listenerCount("end")).toBe(before.end)
  expect(input.listenerCount("error")).toBe(before.inputError)
  expect(output.listenerCount("close")).toBe(before.close)
  expect(output.listenerCount("error")).toBe(before.outputError)
})

test("ACP lifecycle awaits in-flight cleanup and stops the server once", async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  const cleanup = Promise.withResolvers<void>()
  const stopped = Promise.withResolvers<void>()
  const state = { stops: 0, settled: false }
  const running = runConnection({
    input,
    output,
    create: () => ({
      connect: (stream) => new AgentSideConnection(() => agent(), stream),
      cleanup: () => cleanup.promise,
    }),
    stop: async () => {
      state.stops++
      stopped.resolve()
    },
  }).then(() => {
    state.settled = true
  })

  input.end()
  await timeout(stopped.promise)
  expect(state.stops).toBe(1)
  expect(state.settled).toBe(false)

  cleanup.resolve()
  await timeout(running)
  expect(state.settled).toBe(true)
  expect(state.stops).toBe(1)
})

test("ACP agent cleanup waits for in-flight handlers and is idempotent", async () => {
  const request = Promise.withResolvers<Awaited<ReturnType<ACPAgent["initialize"]>>>()
  const stopped = Promise.withResolvers<void>()
  const state = { stops: 0, settled: false }
  const unused = () => Effect.die("unused")
  const instance = new Agent(
    {
      initialize: () => Effect.promise(() => request.promise),
      authenticate: unused,
      newSession: unused,
      loadSession: unused,
      listSessions: unused,
      resumeSession: unused,
      closeSession: unused,
      forkSession: unused,
      setSessionConfigOption: unused,
      setSessionMode: unused,
      setSessionModel: unused,
      prompt: unused,
      cancel: unused,
    } satisfies Interface,
    async () => {
      state.stops++
      stopped.resolve()
    },
  )
  const pending = instance.initialize({
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: {},
    clientInfo: { name: "test", version: "1" },
  })
  const closing = instance.close().then(() => {
    state.settled = true
  })

  await timeout(stopped.promise)
  expect(state.stops).toBe(1)
  expect(state.settled).toBe(false)

  request.resolve({ protocolVersion: PROTOCOL_VERSION, agentCapabilities: {} })
  await timeout(Promise.all([pending, closing]).then(() => undefined))
  await instance.close()
  expect(state.settled).toBe(true)
  expect(state.stops).toBe(1)
})
