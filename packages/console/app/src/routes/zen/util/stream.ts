export const PROVIDER_DRAIN_TIMEOUT = 20_000

export function forwardProviderStream(input: {
  source: ReadableStream<Uint8Array> | null
  chunk: (value: Uint8Array, emit: (value: Uint8Array) => void) => void
  finalize: (error?: unknown) => Promise<Uint8Array | undefined | void>
  waitUntil: (promise: Promise<void>) => unknown
  drained?: () => boolean
  drainTimeout?: number
  abort?: () => void
}) {
  let canceled = false
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let output!: ReadableStreamDefaultController<Uint8Array>
  let timer: ReturnType<typeof setTimeout> | undefined
  let resolve!: () => void
  const completed = new Promise<void>((done) => {
    resolve = done
  })
  const drained = () => {
    try {
      return input.drained?.() ?? false
    } catch {
      return false
    }
  }
  let finalizing: Promise<void> | undefined
  const finish = (controller: ReadableStreamDefaultController<Uint8Array>, error?: unknown) => {
    if (finalizing) return finalizing
    if (timer) clearTimeout(timer)
    finalizing = Promise.resolve()
      .then(() => input.finalize(error))
      .then((final) => {
        if (canceled) return
        if (error) {
          controller.error(error)
          return
        }
        if (final) controller.enqueue(final)
        controller.close()
      })
      .catch((failure) => {
        if (!canceled) controller.error(failure)
      })
      .finally(resolve)
    return finalizing
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      output = controller
      reader = input.source?.getReader()
      void (async () => {
        let failure: unknown = reader ? undefined : new Error("Provider response body is missing")

        if (reader) {
          while (true) {
            const result = await reader.read().catch((error) => {
              failure = error
              return { done: true as const, value: undefined }
            })
            if (result.done) break

            try {
              input.chunk(result.value, (value) => {
                if (canceled || failure) return
                controller.enqueue(value)
              })
            } catch (error) {
              failure ??= error
            }
            if (canceled && drained()) {
              void reader
                .cancel(new Error("Provider usage captured after downstream cancellation"))
                .catch(() => undefined)
              await finish(controller)
              return
            }
          }
        }

        await finish(controller, failure)
      })()
      input.waitUntil(completed)
    },
    cancel() {
      canceled = true
      if (drained()) {
        void reader?.cancel(new Error("Provider usage captured before downstream cancellation")).catch(() => undefined)
        void finish(output)
        return
      }
      timer = setTimeout(() => {
        const error = new Error("Provider drain timed out after downstream cancellation")
        try {
          input.abort?.()
        } catch {}
        void reader?.cancel(error).catch(() => undefined)
        void finish(output, error)
      }, input.drainTimeout ?? PROVIDER_DRAIN_TIMEOUT)
    },
  })

  return { stream, completed }
}
