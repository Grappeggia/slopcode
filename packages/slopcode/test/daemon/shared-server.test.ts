import { afterEach, describe, expect, test } from "bun:test"
import { DaemonAuth } from "../../src/daemon/auth"
import { DaemonRuntime } from "../../src/daemon/runtime"
import { InstanceBootstrap } from "../../src/project/bootstrap"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { SessionStatus } from "../../src/session/status"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

const token = "test-daemon-token"
const directoryHeader = "x-slopcode-directory"

async function event(url: string, directory: string, signal: AbortSignal, sessionID?: string) {
  const next = new URL("/event", url)
  if (sessionID) next.searchParams.set("sessionID", sessionID)
  const response = await fetch(next, {
    signal,
    headers: {
      [DaemonAuth.Header]: token,
      [directoryHeader]: directory,
    },
  })
  if (!response.ok) throw new Error(`event stream failed: ${response.status}`)
  if (!response.body) throw new Error("missing event body")
  return response.body.getReader()
}

async function next(reader: ReadableStreamDefaultReader<Uint8Array>, type?: string, timeout = 5_000) {
  const decoder = new TextDecoder()
  let text = ""
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = await Promise.race([reader.read(), Bun.sleep(100).then(() => undefined)])
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
      const event = JSON.parse(line.slice(6)) as { type: string; properties: Record<string, unknown> }
      if (!type || event.type === type) return event
    }
  }
  throw new Error(`timed out waiting for ${type ?? "event"}`)
}

afterEach(async () => {
  await DaemonRuntime.shutdown()
})

describe("shared daemon server", () => {
  test("requires daemon auth for daemon status", async () => {
    await using tmp = await tmpdir({ git: true })
    const server = await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        DaemonAuth.set(token)
        DaemonRuntime.configure({
          directory: tmp.path,
          idle_timeout_ms: 60_000,
          stop: async () => {
            await server.stop(true)
          },
        })
        return Server.listen({ hostname: "127.0.0.1", port: 0, daemonToken: token })
      },
    })

    const unauthorized = await fetch(new URL("/daemon/status", server.url))
    expect(unauthorized.status).toBe(401)

    await server.stop(true)
  })

  test("fans out shared events to concurrent clients", async () => {
    await using tmp = await tmpdir({ git: true })
    const server = await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        DaemonAuth.set(token)
        DaemonRuntime.configure({
          directory: tmp.path,
          idle_timeout_ms: 60_000,
          stop: async () => {
            await server.stop(true)
          },
        })
        return Server.listen({ hostname: "127.0.0.1", port: 0, daemonToken: token })
      },
    })

    const firstAbort = new AbortController()
    const secondAbort = new AbortController()
    const first = await event(server.url.toString(), tmp.path, firstAbort.signal)
    const second = await event(server.url.toString(), tmp.path, secondAbort.signal)

    expect((await next(first)).type).toBe("server.connected")
    expect((await next(second)).type).toBe("server.connected")

    const status = await fetch(new URL("/daemon/status", server.url), {
      headers: {
        [DaemonAuth.Header]: token,
      },
    }).then((x) => x.json() as Promise<{ clients: number }>)
    expect(status.clients).toBe(2)

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        SessionStatus.busy("session_test", "running")
      },
    })

    const one = await next(first, "session.status")
    const two = await next(second, "session.status")
    expect(one.properties.sessionID).toBe("session_test")
    expect(two.properties.sessionID).toBe("session_test")

    firstAbort.abort()
    secondAbort.abort()
    await Bun.sleep(50)
    await server.stop(true)
  })

  test("filters session events when a session id is provided", async () => {
    await using tmp = await tmpdir({ git: true })
    const server = await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        DaemonAuth.set(token)
        DaemonRuntime.configure({
          directory: tmp.path,
          idle_timeout_ms: 60_000,
          stop: async () => {
            await server.stop(true)
          },
        })
        return Server.listen({ hostname: "127.0.0.1", port: 0, daemonToken: token })
      },
    })

    const allAbort = new AbortController()
    const ownAbort = new AbortController()
    const all = await event(server.url.toString(), tmp.path, allAbort.signal)
    const own = await event(server.url.toString(), tmp.path, ownAbort.signal, "session_a")

    expect((await next(all)).type).toBe("server.connected")
    expect((await next(own)).type).toBe("server.connected")

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        SessionStatus.busy("session_b", "running")
        SessionStatus.busy("session_a", "running")
      },
    })

    expect((await next(all, "session.status")).properties.sessionID).toBe("session_b")
    expect((await next(own, "session.status")).properties.sessionID).toBe("session_a")

    allAbort.abort()
    ownAbort.abort()
    await Bun.sleep(50)
    await server.stop(true)
  })
})
