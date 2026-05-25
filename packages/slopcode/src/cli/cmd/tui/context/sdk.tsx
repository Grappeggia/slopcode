import { createSlopcodeClient, type Event } from "@slopcode-ai/sdk/v2"
import { createSimpleContext } from "./helper"
import { createGlobalEmitter } from "@solid-primitives/event-bus"
import { batch, createEffect, on, onCleanup, onMount } from "solid-js"
import { nextSDKFlushDelay, queueSDKEvent } from "./sdk-event-queue"
import { useRoute } from "./route"

export type EventSource = {
  on: (handler: (event: Event) => void) => () => void
}

export const { use: useSDK, provider: SDKProvider } = createSimpleContext({
  name: "SDK",
  init: (props: {
    url: string
    directory?: string
    viewID?: string
    fetch?: typeof fetch
    headers?: RequestInit["headers"]
    events?: EventSource
  }) => {
    const route = useRoute()
    const abort = new AbortController()
    const clients = new Map<string, ReturnType<typeof createSlopcodeClient>>()

    const clientFor = (workspaceID?: string) => {
      const key = workspaceID ?? ""
      const hit = clients.get(key)
      if (hit) return hit
      const client = createSlopcodeClient({
        baseUrl: props.url,
        signal: abort.signal,
        directory: props.directory,
        viewID: props.viewID,
        workspaceID,
        fetch: props.fetch,
        headers: props.headers,
      } as any)
      clients.set(key, client)
      return client
    }

    const emitter = createGlobalEmitter<{
      [key in Event["type"]]: Extract<Event, { type: key }>
    }>()

    let queue: Event[] = []
    let timer: Timer | undefined
    let last = 0

    const flush = () => {
      if (queue.length === 0) return
      const events = queue
      queue = []
      timer = undefined
      last = Date.now()
      batch(() => {
        for (const event of events) {
          emitter.emit(event.type, event)
        }
      })
    }

    const handleEvent = (event: Event) => {
      queueSDKEvent(queue, event)
      const delay = nextSDKFlushDelay({
        event,
        hasTimer: !!timer,
        elapsed: Date.now() - last,
      })

      if (delay === undefined) return
      if (timer) clearTimeout(timer)
      if (delay === 0) {
        flush()
        return
      }
      timer = setTimeout(flush, delay)
    }

    onMount(() => {
      if (props.events) {
        const unsub = props.events.on(handleEvent)
        onCleanup(unsub)
      }
    })

    createEffect(
      on(
        () => route.data.workspaceID,
        (workspaceID) => {
          if (props.events) return
          const stop = new AbortController()
          const signal = AbortSignal.any([abort.signal, stop.signal])

          void (async () => {
            while (!signal.aborted) {
              const events = await clientFor(workspaceID)
                .event.subscribe({}, { signal })
                .catch(() => undefined)
              if (!events) {
                if (signal.aborted) break
                await Bun.sleep(250)
                continue
              }

              try {
                for await (const event of events.stream) {
                  if (signal.aborted) break
                  handleEvent(event)
                }
              } catch {
                if (signal.aborted) break
              }

              if (signal.aborted) break
              if (timer) clearTimeout(timer)
              if (queue.length > 0) flush()
              await Bun.sleep(250)
            }
          })()

          onCleanup(() => {
            stop.abort()
            if (timer) clearTimeout(timer)
            if (queue.length > 0) flush()
          })
        },
      ),
    )

    onCleanup(() => {
      abort.abort()
      if (timer) clearTimeout(timer)
    })

    return {
      get client() {
        return clientFor(route.data.workspaceID)
      },
      clientFor,
      event: emitter,
      url: props.url,
      fetch: props.fetch,
      directory: props.directory,
      headers: props.headers,
      viewID: props.viewID,
      get workspaceID() {
        return route.data.workspaceID
      },
    }
  },
})
