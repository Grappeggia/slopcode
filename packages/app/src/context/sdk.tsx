import type { Event } from "@slopcode-ai/sdk/v2/client"
import { createSimpleContext } from "@slopcode-ai/ui/context"
import { createGlobalEmitter } from "@solid-primitives/event-bus"
import { useParams } from "@solidjs/router"
import { type Accessor, createEffect, createMemo, onCleanup } from "solid-js"
import { useGlobalSDK } from "./global-sdk"

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type SDKEventMap = {
  [key in Event["type"]]: Extract<Event, { type: key }>
}

export const { use: useSDK, provider: SDKProvider } = createSimpleContext({
  name: "SDK",
  init: (props: { directory: Accessor<string> }) => {
    const globalSDK = useGlobalSDK()
    const params = useParams()

    const directory = createMemo(props.directory)
    const session = createMemo(() => params.id)
    const client = createMemo(() =>
      globalSDK.createClient({
        directory: directory(),
        throwOnError: true,
      }),
    )

    const emitter = createGlobalEmitter<SDKEventMap>()

    createEffect(() => {
      const sdk = client()
      const abort = new AbortController()
      void (async () => {
        while (!abort.signal.aborted) {
          const attempt = new AbortController()
          const stop = () => {
            attempt.abort()
          }
          abort.signal.addEventListener("abort", stop)
          try {
            const events = await sdk.event.subscribe(
              { sessionID: session() },
              {
                signal: attempt.signal,
                onSseError(error: unknown) {
                  if (error instanceof Error && error.name === "AbortError") return
                  console.error("[sdk] event stream error", error)
                },
              },
            )
            for await (const event of events.stream) {
              emitter.emit(event.type, event)
            }
          } catch (error) {
            if (!(error instanceof Error) || error.name !== "AbortError") {
              console.error("[sdk] event stream failed", error)
            }
          } finally {
            abort.signal.removeEventListener("abort", stop)
          }
          if (abort.signal.aborted) return
          await wait(250)
        }
      })()
      onCleanup(() => abort.abort())
    })

    return {
      get directory() {
        return directory()
      },
      get client() {
        return client()
      },
      event: emitter,
      get url() {
        return globalSDK.url
      },
      createClient(opts: Parameters<typeof globalSDK.createClient>[0]) {
        return globalSDK.createClient(opts)
      },
    }
  },
})
