import type { Event } from "@slopcode-ai/sdk/v2"

const DEFAULT_BATCH_MS = 16
export const STREAM_BATCH_MS = 48

type DeltaEvent = Extract<Event, { type: "message.part.delta" }>

function isDeltaEvent(event: Event | undefined): event is DeltaEvent {
  return event?.type === "message.part.delta"
}

function sameDeltaTarget(a: DeltaEvent, b: DeltaEvent) {
  return (
    a.properties.sessionID === b.properties.sessionID &&
    a.properties.messageID === b.properties.messageID &&
    a.properties.partID === b.properties.partID &&
    a.properties.field === b.properties.field
  )
}

export function queueSDKEvent(queue: Event[], event: Event) {
  const last = queue.at(-1)
  if (!isDeltaEvent(last) || !isDeltaEvent(event) || !sameDeltaTarget(last, event)) {
    queue.push(event)
    return
  }

  queue[queue.length - 1] = {
    ...last,
    properties: {
      ...last.properties,
      delta: last.properties.delta + event.properties.delta,
    },
  }
}

export function nextSDKFlushDelay(input: { event: Event; hasTimer: boolean; elapsed: number }) {
  if (input.hasTimer) {
    if (isDeltaEvent(input.event)) return
    return 0
  }

  if (isDeltaEvent(input.event)) return STREAM_BATCH_MS
  if (input.elapsed < DEFAULT_BATCH_MS) return DEFAULT_BATCH_MS
  return 0
}
