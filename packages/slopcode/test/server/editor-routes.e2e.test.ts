import { afterEach, describe, expect, test } from "bun:test"
import * as path from "node:path"
import { DaemonAuth } from "../../src/daemon/auth"
import { Server } from "../../src/server/server"
import { tmpdir } from "../fixture/fixture"

type Snapshot = {
  file: string
  dirty: boolean
  diagnostics: { line: number; column: number; severity: string; message: string }[]
}

const token = "editor-e2e-token"
const active: Array<{ stop(force?: boolean): Promise<void> | void }> = []

afterEach(async () => {
  await Promise.all(active.splice(0).map((server) => server.stop(true)))
})

async function eventually<T>(check: () => T | Promise<T>, timeout = 2_000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = await check()
    if (value) return value
    await Bun.sleep(25)
  }
  throw new Error("condition not met")
}

function headers(directory: string, json = false) {
  return {
    [DaemonAuth.Header]: token,
    "x-slopcode-directory": directory,
    ...(json ? { "content-type": "application/json" } : {}),
  }
}

async function open(server: URL, directory: string, sessionID: string, file: string) {
  const response = await fetch(new URL("/editor", server), {
    method: "POST",
    headers: headers(directory, true),
    body: JSON.stringify({ sessionID, file, size: { rows: 8, cols: 40 } }),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<{ id: string; file: string; dirty: boolean; sessionID: string }>
}

async function connect(server: URL, directory: string, id: string, sessionID: string) {
  const url = new URL(`/editor/${id}/connect?sessionID=${sessionID}`, server)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  const Socket = WebSocket as unknown as {
    new (url: URL | string, options: { headers: Record<string, string> }): WebSocket
  }
  const ws = new Socket(url, {
    headers: headers(directory),
  })
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true })
    ws.addEventListener("error", () => reject(new Error("websocket failed")), { once: true })
  })
  return ws
}

async function next(ws: WebSocket, timeout = 2_000) {
  return new Promise<Snapshot>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for snapshot")), timeout)
    const done = (value?: Snapshot, error?: Error) => {
      clearTimeout(timer)
      ws.removeEventListener("message", onMessage)
      ws.removeEventListener("error", onError)
      if (error) reject(error)
      else resolve(value!)
    }
    const onError = () => done(undefined, new Error("websocket errored"))
    const onMessage = (event: MessageEvent) => {
      const payload = JSON.parse(String(event.data)) as { type: string; snapshot?: Snapshot }
      if (payload.type !== "snapshot" || !payload.snapshot) return
      done(payload.snapshot)
    }
    ws.addEventListener("message", onMessage)
    ws.addEventListener("error", onError)
  })
}

describe("editor routes e2e", () => {
  test("edits and saves through the real server and websocket", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "editor.ts"), "const a = 1\n")
      },
    })
    const server = Server.listen({ hostname: "127.0.0.1", port: 0, daemonToken: token })
    active.push(server)

    const info = await open(server.url, tmp.path, "ses_test0000000000000000000", "editor.ts")
    const ws = await connect(server.url, tmp.path, info.id, info.sessionID)
    try {
      const first = await next(ws)
      expect(first.file).toBe("editor.ts")
      expect(first.dirty).toBe(false)

      ws.send(JSON.stringify({ type: "input", keys: ";" }))
      const second = await next(ws)
      expect(second.dirty).toBe(true)

      const save = await fetch(new URL(`/editor/${info.id}/save?sessionID=${info.sessionID}`, server.url), {
        method: "POST",
        headers: headers(tmp.path),
      })
      expect(save.status).toBe(200)
      expect((await Bun.file(path.join(tmp.path, "editor.ts")).text()).trimEnd()).toBe(";const a = 1")
    } finally {
      ws.close()
    }
  })

  test("publishes diagnostics for invalid files over the real websocket", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "bad.json"), '{"foo": ]')
      },
    })
    const server = Server.listen({ hostname: "127.0.0.1", port: 0, daemonToken: token })
    active.push(server)

    const info = await open(server.url, tmp.path, "ses_test0000000000000000001", "bad.json")
    const ws = await connect(server.url, tmp.path, info.id, info.sessionID)
    try {
      const snap = await next(ws)
      expect(snap.diagnostics.length).toBeGreaterThan(0)
      expect(snap.diagnostics[0]?.severity).toBe("error")
    } finally {
      ws.close()
    }
  })
})
