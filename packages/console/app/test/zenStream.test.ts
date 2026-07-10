import { describe, expect, test } from "bun:test"
import { forwardProviderStream } from "../src/routes/zen/util/stream"

const encoder = new TextEncoder()
const decoder = new TextDecoder()

describe("Zen provider stream accounting", () => {
  test("aborts upstream and finalizes immediately after downstream cancellation", async () => {
    let canceled: unknown
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("content"))
      },
      cancel(reason) {
        canceled = reason
      },
    })
    const chunks: string[] = []
    const errors: unknown[] = []
    let usage = 0
    let finalized = 0
    let aborted = 0
    let lifetime: Promise<void> | undefined
    const result = forwardProviderStream({
      source,
      chunk(value, emit) {
        const text = decoder.decode(value)
        chunks.push(text)
        if (text === "usage") usage++
        emit(value)
      },
      async finalize(error) {
        finalized++
        errors.push(error)
        return encoder.encode("cost")
      },
      waitUntil(promise) {
        lifetime = promise
      },
      abort() {
        aborted++
      },
    })
    const reader = result.stream.getReader()
    expect(lifetime).toBe(result.completed)

    expect(decoder.decode((await reader.read()).value)).toBe("content")
    await reader.cancel("client disconnected")
    await result.completed
    await lifetime

    expect(chunks).toEqual(["content"])
    expect(usage).toBe(0)
    expect(aborted).toBe(1)
    expect(canceled).toBe("client disconnected")
    expect(finalized).toBe(1)
    expect(errors[0]).toBeInstanceOf(Error)
  })

  test("settles once when the provider stream fails", async () => {
    const failure = new Error("provider stream failed")
    let finalized = 0
    let settled: unknown
    const result = forwardProviderStream({
      source: new ReadableStream({
        start(controller) {
          controller.error(failure)
        },
      }),
      chunk() {},
      async finalize(error) {
        finalized++
        settled = error
      },
      waitUntil() {},
    })

    await expect(result.stream.getReader().read()).rejects.toThrow("provider stream failed")
    await result.completed

    expect(finalized).toBe(1)
    expect(settled).toBe(failure)
  })

  test("does not wait for a provider cancellation that never resolves", async () => {
    let finalized = 0
    const result = forwardProviderStream({
      source: new ReadableStream({
        cancel() {
          return new Promise(() => {})
        },
      }),
      chunk() {},
      async finalize() {
        finalized++
      },
      waitUntil() {},
      abort() {},
    })

    await result.stream.cancel("disconnected")
    await Promise.race([
      result.completed,
      Bun.sleep(100).then(() => {
        throw new Error("settlement remained coupled to provider cancellation")
      }),
    ])
    expect(finalized).toBe(1)
  })

  test("preserves the final cost chunk for connected clients", async () => {
    let finalized = 0
    const result = forwardProviderStream({
      source: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("content"))
          controller.close()
        },
      }),
      chunk(value, emit) {
        emit(value)
      },
      async finalize() {
        finalized++
        return encoder.encode("cost")
      },
      waitUntil() {},
    })

    expect(await new Response(result.stream).text()).toBe("contentcost")
    await result.completed
    expect(finalized).toBe(1)
  })
})
