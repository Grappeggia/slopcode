import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { expect, test } from "bun:test"
import { Context, DateTime, Effect, Exit, Layer, Scope } from "effect"
import { EventV2 } from "@slopcode-ai/core/event"
import { Location } from "@slopcode-ai/core/location"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionEvent } from "@slopcode-ai/core/session/event"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionV2 } from "@slopcode-ai/core/session"
import { webHandler } from "../src/routes"

test("standalone SSE publishes function V1 and excludes internal custom V2", async () => {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-server-event-")))
  const scope = await Effect.runPromise(Scope.make())
  const context = await Effect.runPromise(Layer.buildWithScope(EventV2.defaultLayer, scope))
  const events = Context.get(context, EventV2.Service)
  const app = webHandler({ events })
  const controller = new AbortController()
  try {
    const response = await app.handler(
      new Request(`http://localhost/api/event?location[directory]=${encodeURIComponent(directory)}`, {
        signal: controller.signal,
      }),
      undefined as never,
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/event-stream")
    const reader = response.body!.getReader()
    expect((await read(reader)).type).toBe("server.connected")
    const next = readUntil(reader, "session.next.tool.called")
    await Bun.sleep(10)
    const base = {
      timestamp: await Effect.runPromise(DateTime.now),
      sessionID: SessionV2.ID.make("ses_server_public_event"),
      assistantMessageID: SessionMessage.ID.make("msg_server_public_event"),
      callID: "call-server-public-event",
      tool: "tool",
      provider: { executed: false },
    }
    const location = Location.Ref.make({ directory: AbsolutePath.make(directory) })
    await Effect.runPromise(
      events.publish(SessionEvent.Tool.CalledV2, { ...base, input: "raw", toolType: "custom" }, { location }),
    )
    await Bun.sleep(20)
    await Effect.runPromise(events.publish(SessionEvent.Tool.Called, { ...base, input: { value: true } }, { location }))

    expect(await Promise.race([next, Bun.sleep(500).then(() => ({ type: "timeout" }))])).toMatchObject({
      type: "session.next.tool.called",
      version: 1,
      data: { input: { value: true } },
    })
    expect(await Promise.race([reader.cancel().then(() => true), Bun.sleep(500).then(() => false)])).toBe(true)
  } finally {
    controller.abort()
    await app.dispose()
    await Effect.runPromise(Scope.close(scope, Exit.void)).catch(() => undefined)
    await fs.rm(directory, { recursive: true, force: true })
  }
})

async function read(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder()
  let text = ""
  for (;;) {
    const result = await reader.read()
    if (result.done) throw new Error("event stream closed")
    text += decoder.decode(result.value, { stream: true })
    const end = text.indexOf("\n\n")
    if (end < 0) continue
    const data = text
      .slice(0, end)
      .split("\n")
      .find((line) => line.startsWith("data: "))
    if (data) return JSON.parse(data.slice(6)) as Record<string, unknown>
    text = text.slice(end + 2)
  }
}

async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, type: string) {
  for (;;) {
    const event = await read(reader)
    if (event.type === type) return event
  }
}
