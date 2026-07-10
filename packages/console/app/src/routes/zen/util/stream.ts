export function forwardProviderStream(input: {
  source: ReadableStream<Uint8Array> | null
  chunk: (value: Uint8Array, emit: (value: Uint8Array) => void) => void
  finalize: (error?: unknown) => Promise<Uint8Array | undefined | void>
  waitUntil: (promise: Promise<void>) => unknown
}) {
  let canceled = false
  let completed!: Promise<void>
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      completed = (async () => {
        const reader = input.source?.getReader()
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

        const final = await input.finalize(failure).catch((error) => {
          failure ??= error
          return undefined
        })
        if (canceled) return
        if (failure) {
          controller.error(failure)
          return
        }
        if (final) controller.enqueue(final)
        controller.close()
      })()
      input.waitUntil(completed)
    },
    cancel() {
      canceled = true
    },
  })

  return { stream, completed }
}
