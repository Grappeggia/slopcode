import { describe, expect, test } from "bun:test"
import type { Event } from "@slopcode-ai/sdk/v2"
import { nextSDKFlushDelay, queueSDKEvent, STREAM_BATCH_MS } from "../../../src/cli/cmd/tui/context/sdk-event-queue"

function delta(input: { sessionID?: string; messageID?: string; partID?: string; field?: string; delta: string }) {
  return {
    type: "message.part.delta",
    properties: {
      sessionID: input.sessionID ?? "ses_1",
      messageID: input.messageID ?? "msg_1",
      partID: input.partID ?? "part_1",
      field: input.field ?? "text",
      delta: input.delta,
    },
  } satisfies Extract<Event, { type: "message.part.delta" }>
}

function updated() {
  return {
    type: "message.part.updated",
    properties: {
      part: {
        id: "part_1",
        sessionID: "ses_1",
        messageID: "msg_1",
        type: "text",
        text: "done",
      },
    },
  } satisfies Extract<Event, { type: "message.part.updated" }>
}

describe("sdk event queue", () => {
  test("merges consecutive deltas for the same part field", () => {
    const queue: Event[] = []
    queueSDKEvent(queue, delta({ delta: "ab" }))
    queueSDKEvent(queue, delta({ delta: "cd" }))

    expect(queue).toHaveLength(1)
    expect((queue[0] as Extract<Event, { type: "message.part.delta" }>).properties.delta).toBe("abcd")
  })

  test("does not merge deltas for different parts", () => {
    const queue: Event[] = []
    queueSDKEvent(queue, delta({ delta: "ab" }))
    queueSDKEvent(queue, delta({ partID: "part_2", delta: "cd" }))

    expect(queue).toHaveLength(2)
  })

  test("keeps non-delta events separate", () => {
    const queue: Event[] = []
    queueSDKEvent(queue, delta({ delta: "ab" }))
    queueSDKEvent(queue, updated())

    expect(queue).toHaveLength(2)
    expect(queue[1]?.type).toBe("message.part.updated")
  })

  test("uses a longer batch window for streamed deltas", () => {
    expect(
      nextSDKFlushDelay({
        event: delta({ delta: "ab" }),
        hasTimer: false,
        elapsed: 100,
      }),
    ).toBe(STREAM_BATCH_MS)
  })

  test("flushes immediately when a non-delta arrives during a pending stream batch", () => {
    expect(
      nextSDKFlushDelay({
        event: updated(),
        hasTimer: true,
        elapsed: 5,
      }),
    ).toBe(0)
  })

  test("keeps the existing timer when another delta arrives mid-batch", () => {
    expect(
      nextSDKFlushDelay({
        event: delta({ delta: "ab" }),
        hasTimer: true,
        elapsed: 5,
      }),
    ).toBeUndefined()
  })
})
