import { expect, test } from "bun:test"
import { createSseClient } from "../src/v2/gen/core/serverSentEvents.gen"
import { abortableSleep } from "../src/sse"

test("abort interrupts capped SSE retry backoff without detaching the stream", async () => {
  const abort = new AbortController()
  const waiting = Promise.withResolvers<void>()
  const delays: number[] = []
  const state = { active: 0, signaled: true }
  const result = createSseClient({
    url: "http://127.0.0.1/events",
    signal: abort.signal,
    fetch: Object.assign(
      async () => {
        throw new Error("offline")
      },
      { preconnect: () => undefined },
    ),
    sseDefaultRetryDelay: 10_000,
    sseMaxRetryDelay: 30_000,
    sseSleepFn: async (ms, signal?: AbortSignal) => {
      delays.push(ms)
      state.signaled &&= signal === abort.signal
      if (delays.length < 3) return
      state.active++
      waiting.resolve()
      await abortableSleep(ms, signal ?? abort.signal)
      state.active--
    },
  })

  const next = result.stream.next()
  await waiting.promise
  abort.abort()

  expect(await next).toEqual({ done: true, value: undefined })
  expect(delays).toEqual([10_000, 20_000, 30_000])
  expect(state.signaled).toBe(true)
  expect(state.active).toBe(0)
})
