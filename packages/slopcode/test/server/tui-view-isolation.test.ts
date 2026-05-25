import { describe, expect, test } from "bun:test"
import type { Context } from "hono"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { callTui } from "../../src/server/routes/tui"
import { tmpdir } from "../fixture/fixture"

type TuiEvent = { type: string; properties: Record<string, unknown> }

async function next(reader: ReadableStreamDefaultReader<Uint8Array>, type: string, timeout = 1_000) {
  const decoder = new TextDecoder()
  let text = ""
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = await Promise.race([reader.read(), Bun.sleep(25).then(() => undefined)])
    if (!value) continue
    if (value.done) throw new Error("event stream closed")
    text += decoder.decode(value.value, { stream: true })
    while (true) {
      const end = text.indexOf("\n\n")
      if (end === -1) break
      const chunk = text.slice(0, end)
      text = text.slice(end + 2)
      const line = chunk.split("\n").find((item) => item.startsWith("data: "))
      if (!line) continue
      const event = JSON.parse(line.slice(6)) as TuiEvent
      if (event.type === type) return event
    }
  }
  throw new Error(`timed out waiting for ${type}`)
}

function ctx(path: string, body: unknown) {
  return {
    req: {
      path,
      json: async () => body,
    },
  } as Context
}

describe("tui view isolation", () => {
  test("control queues are isolated by view id", async () => {
    await using tmp = await tmpdir({ git: true })
    const app = Server.App()
    const headers = (viewID: string, json = false) => ({
      "x-slopcode-directory": tmp.path,
      "x-slopcode-view-id": viewID,
      ...(json ? { "content-type": "application/json" } : {}),
    })

    const a = Instance.provide({
      directory: tmp.path,
      viewID: "view-a",
      fn: async () => callTui(ctx("/tui/submit-prompt", { value: "a" })),
    })
    const b = Instance.provide({
      directory: tmp.path,
      viewID: "view-b",
      fn: async () => callTui(ctx("/tui/submit-prompt", { value: "b" })),
    })

    const nextA = await app.request("/tui/control/next", { headers: headers("view-a") })
    const nextB = await app.request("/tui/control/next", { headers: headers("view-b") })
    expect(await nextA.json()).toEqual({ path: "/tui/submit-prompt", body: { value: "a" } })
    expect(await nextB.json()).toEqual({ path: "/tui/submit-prompt", body: { value: "b" } })

    await app.request("/tui/control/response", {
      method: "POST",
      headers: headers("view-a", true),
      body: JSON.stringify({ ok: "a" }),
    })
    await app.request("/tui/control/response", {
      method: "POST",
      headers: headers("view-b", true),
      body: JSON.stringify({ ok: "b" }),
    })

    await expect(a).resolves.toEqual({ ok: "a" })
    await expect(b).resolves.toEqual({ ok: "b" })
  })

  test("tui events only stream to the matching view", async () => {
    await using tmp = await tmpdir({ git: true })
    const app = Server.App()
    const headers = (viewID: string, json = false) => ({
      "x-slopcode-directory": tmp.path,
      "x-slopcode-view-id": viewID,
      ...(json ? { "content-type": "application/json" } : {}),
    })

    const stopA = new AbortController()
    const stopB = new AbortController()
    const responseA = await app.request("/event", { headers: headers("view-a"), signal: stopA.signal })
    const responseB = await app.request("/event", { headers: headers("view-b"), signal: stopB.signal })
    if (!responseA.body || !responseB.body) throw new Error("missing event stream")
    const readerA = responseA.body.getReader()
    const readerB = responseB.body.getReader()

    expect((await next(readerA, "server.connected")).type).toBe("server.connected")
    expect((await next(readerB, "server.connected")).type).toBe("server.connected")

    await app.request("/tui/show-toast", {
      method: "POST",
      headers: headers("view-a", true),
      body: JSON.stringify({ message: "toast-a", variant: "info" }),
    })

    const eventA = await next(readerA, "tui.toast.show")
    expect(eventA.properties.message).toBe("toast-a")
    await expect(next(readerB, "tui.toast.show", 250)).rejects.toThrow(/timed out/)

    stopA.abort()
    stopB.abort()
  })
})
