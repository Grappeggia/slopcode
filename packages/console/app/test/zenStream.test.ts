import { describe, expect, test } from "bun:test"
import { forwardProviderStream } from "../src/routes/zen/util/stream"

const encoder = new TextEncoder()
const decoder = new TextDecoder()

describe("Zen provider stream accounting", () => {
  test("drains a usage trailer after downstream cancellation", async () => {
    let canceled: unknown
    let release = () => {}
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("content"))
        release = () => controller.enqueue(encoder.encode("usage"))
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
      drained() {
        return usage > 0
      },
      drainTimeout: 100,
      abort() {
        aborted++
      },
    })
    const reader = result.stream.getReader()
    expect(lifetime).toBe(result.completed)

    expect(decoder.decode((await reader.read()).value)).toBe("content")
    await reader.cancel("client disconnected")
    release()
    await result.completed
    await lifetime

    expect(chunks).toEqual(["content", "usage"])
    expect(usage).toBe(1)
    expect(aborted).toBe(0)
    expect(canceled).toBeDefined()
    expect(finalized).toBe(1)
    expect(errors).toEqual([undefined])
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

  test("aborts and finalizes unknown when the bounded drain times out", async () => {
    let finalized = 0
    let failure: unknown
    let aborted = 0
    const result = forwardProviderStream({
      source: new ReadableStream({
        cancel() {
          return new Promise(() => {})
        },
      }),
      chunk() {},
      async finalize(error) {
        finalized++
        failure = error
      },
      waitUntil() {},
      drainTimeout: 20,
      abort() {
        aborted++
      },
    })

    await result.stream.cancel("disconnected")
    await Promise.race([
      result.completed,
      Bun.sleep(200).then(() => {
        throw new Error("settlement remained coupled to provider cancellation")
      }),
    ])
    expect(finalized).toBe(1)
    expect(aborted).toBe(1)
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toContain("drain timed out")
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

  test("rejects the waitUntil lifetime when canceled-stream finalization fails", async () => {
    let release = () => {}
    let lifetime: Promise<void> | undefined
    let usage = 0
    const failure = new Error("settlement exhausted")
    const result = forwardProviderStream({
      source: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("content"))
          release = () => controller.enqueue(encoder.encode("usage"))
        },
        cancel() {},
      }),
      chunk(value, emit) {
        if (decoder.decode(value) === "usage") usage++
        emit(value)
      },
      async finalize() {
        throw failure
      },
      waitUntil(promise) {
        lifetime = promise
      },
      drained() {
        return usage > 0
      },
      drainTimeout: 100,
      abort() {},
    })
    const reader = result.stream.getReader()
    await reader.read()
    const rejected = result.completed.then(
      () => undefined,
      (error) => error,
    )
    await reader.cancel("client disconnected")
    release()

    expect(lifetime).toBe(result.completed)
    expect(await rejected).toBe(failure)
  })

  test("errors a connected stream and rejects completion when finalization fails", async () => {
    const result = forwardProviderStream({
      source: new ReadableStream({
        start(controller) {
          controller.close()
        },
      }),
      chunk() {},
      async finalize() {
        throw new Error("settlement failed")
      },
      waitUntil() {},
    })

    const completed = result.completed.catch((error) => error)
    await expect(new Response(result.stream).text()).rejects.toThrow("settlement failed")
    expect(await completed).toBeInstanceOf(Error)
  })
})
