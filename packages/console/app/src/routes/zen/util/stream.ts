export function forwardProviderStream(input: {
  source: ReadableStream<Uint8Array> | null
  chunk: (value: Uint8Array, emit: (value: Uint8Array) => void) => void
  finalize: (error?: unknown) => Promise<Uint8Array | undefined | void>
  waitUntil: (promise: Promise<void>) => unknown
  abort?: () => void
}) {
  let canceled = false
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let output!: ReadableStreamDefaultController<Uint8Array>
  let resolve!: () => void
  const completed = new Promise<void>((done) => {
    resolve = done
  })
  let finalizing: Promise<void> | undefined
  const finish = (controller: ReadableStreamDefaultController<Uint8Array>, error?: unknown) => {
    if (finalizing) return finalizing
    finalizing = input
      .finalize(error)
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
          }
        }

        await finish(controller, failure)
      })()
      input.waitUntil(completed)
    },
    cancel(reason) {
      canceled = true
      input.abort?.()
      void reader?.cancel(reason).catch(() => undefined)
      void finish(output, new Error("Downstream response canceled"))
    },
  })

  return { stream, completed }
}
