import { expect } from "bun:test"
import { Context, DateTime, Effect, Layer } from "effect"
import { EventV2 } from "@slopcode-ai/core/event"
import { SessionEvent } from "@slopcode-ai/core/session/event"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionV2 } from "@slopcode-ai/core/session"
import { EventV2Bridge } from "../src/event-v2-bridge"
import { GlobalBus } from "../src/bus/global"
import { it } from "./lib/effect"

it.live("keeps custom tool calls internal while publishing function call V1 envelopes", () =>
  Effect.scoped(Effect.gen(function* () {
    const context = yield* Layer.build(EventV2Bridge.defaultLayer)
    const events = Context.get(context, EventV2Bridge.Service)
    const received: Array<{ payload: { type?: string; syncEvent?: { type: string } } }> = []
    const listener = (event: typeof received[number]) => received.push(event)
    GlobalBus.on("event", listener)
    yield* Effect.addFinalizer(() => Effect.sync(() => GlobalBus.off("event", listener)))
    const base = {
      timestamp: DateTime.makeUnsafe(Date.now()),
      sessionID: SessionV2.ID.make("ses_public_boundary"),
      assistantMessageID: SessionMessage.ID.make("msg_public_boundary"),
      callID: "call-public-boundary",
      tool: "tool",
      provider: { executed: false },
    }

    yield* events.publish(SessionEvent.Tool.CalledV2, { ...base, input: "raw", toolType: "custom" })
    expect(received).toEqual([])

    yield* events.publish(SessionEvent.Tool.Called, { ...base, input: { value: true } })
    expect(received.map((event) => event.payload.type ?? event.payload.syncEvent?.type)).toEqual([
      "session.next.tool.called",
      "sync",
    ])
    expect(received[1]?.payload.syncEvent?.type).toBe("session.next.tool.called.1")
  })),
)
