import { describe, expect, test } from "bun:test"
import { Env } from "../../src/env"
import { Instance } from "../../src/project/instance"
import { Pty } from "../../src/pty"
import { tmpdir } from "../fixture/fixture"
import { setTimeout as sleep } from "node:timers/promises"

describe("pty", () => {
  test("does not leak output when websocket objects are reused", async () => {
    await using dir = await tmpdir({ git: true })

    await Instance.provide({
      directory: dir.path,
      fn: async () => {
        const a = await Pty.create({ command: "cat", title: "a", sessionID: "ses_a" })
        const b = await Pty.create({ command: "cat", title: "b", sessionID: "ses_b" })
        try {
          const outA: string[] = []
          const outB: string[] = []

          const ws = {
            readyState: 1,
            data: { events: { connection: "a" } },
            send: (data: unknown) => {
              outA.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
            },
            close: () => {
              // no-op (simulate abrupt drop)
            },
          }

          // Connect "a" first with ws.
          Pty.connect(a.id, ws as any, undefined, { sessionID: "ses_a" })

          // Now "reuse" the same ws object for another connection.
          ws.data = { events: { connection: "b" } }
          ws.send = (data: unknown) => {
            outB.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
          }
          Pty.connect(b.id, ws as any, undefined, { sessionID: "ses_b" })

          // Clear connect metadata writes.
          outA.length = 0
          outB.length = 0

          // Output from a must never show up in b.
          Pty.write(a.id, "AAA\n")
          await sleep(100)

          expect(outB.join("")).not.toContain("AAA")
        } finally {
          await Pty.remove(a.id, { sessionID: "ses_a" })
          await Pty.remove(b.id, { sessionID: "ses_b" })
        }
      },
    })
  })

  test("does not leak output when Bun recycles websocket objects before re-connect", async () => {
    await using dir = await tmpdir({ git: true })

    await Instance.provide({
      directory: dir.path,
      fn: async () => {
        const a = await Pty.create({ command: "cat", title: "a", sessionID: "ses_a" })
        try {
          const outA: string[] = []
          const outB: string[] = []

          const ws = {
            readyState: 1,
            data: { events: { connection: "a" } },
            send: (data: unknown) => {
              outA.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
            },
            close: () => {
              // no-op (simulate abrupt drop)
            },
          }

          // Connect "a" first.
          Pty.connect(a.id, ws as any, undefined, { sessionID: "ses_a" })
          outA.length = 0

          // Simulate Bun reusing the same websocket object for another
          // connection before the next onOpen calls Pty.connect.
          ws.data = { events: { connection: "b" } }
          ws.send = (data: unknown) => {
            outB.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
          }

          Pty.write(a.id, "AAA\n")
          await sleep(100)

          expect(outB.join("")).not.toContain("AAA")
        } finally {
          await Pty.remove(a.id, { sessionID: "ses_a" })
        }
      },
    })
  })

  test("treats in-place socket data mutation as the same connection", async () => {
    await using dir = await tmpdir({ git: true })

    await Instance.provide({
      directory: dir.path,
      fn: async () => {
        const a = await Pty.create({ command: "cat", title: "a", sessionID: "ses_a" })
        try {
          const out: string[] = []

          const ctx = { connId: 1 }
          const ws = {
            readyState: 1,
            data: ctx,
            send: (data: unknown) => {
              out.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
            },
            close: () => {
              // no-op
            },
          }

          Pty.connect(a.id, ws as any, undefined, { sessionID: "ses_a" })
          out.length = 0

          // Mutating fields on ws.data should not look like a new
          // connection lifecycle when the object identity stays stable.
          ctx.connId = 2

          Pty.write(a.id, "AAA\n")
          await sleep(100)

          expect(out.join("")).toContain("AAA")
        } finally {
          await Pty.remove(a.id, { sessionID: "ses_a" })
        }
      },
    })
  })

  test("requires session ownership for pty access", async () => {
    await using dir = await tmpdir({ git: true })

    await Instance.provide({
      directory: dir.path,
      fn: async () => {
        const a = await Pty.create({
          command: "cat",
          title: "a",
          sessionID: "ses_a",
        })
        const b = await Pty.create({
          command: "cat",
          title: "b",
          sessionID: "ses_b",
          env: { SESSION_FLAG: "1" },
        })
        try {
          expect(Env.get("SESSION_FLAG", { sessionID: "ses_b" })).toBe("1")
          expect(Pty.list({ sessionID: "ses_a" }).map((item) => item.id)).toEqual([a.id])
          expect(Pty.list({ sessionID: "ses_b" }).map((item) => item.id)).toEqual([b.id])
          expect(Pty.get(b.id, { sessionID: "ses_a" })).toBeUndefined()
          expect(Pty.get(b.id, { sessionID: "ses_b" })?.sessionID).toBe("ses_b")

          let closed = false
          const denied = {
            readyState: 1,
            data: { id: "denied" },
            send: () => {},
            close: () => {
              closed = true
            },
          }

          const handle = Pty.connect(b.id, denied as any, undefined, { sessionID: "ses_a" })
          expect(handle).toBeUndefined()
          expect(closed).toBe(true)

          await Pty.remove(b.id, { sessionID: "ses_a" })
          expect(Pty.get(b.id, { sessionID: "ses_b" })?.id).toBe(b.id)

          await Pty.remove(b.id, { sessionID: "ses_b" })
          expect(Pty.get(b.id, { sessionID: "ses_b" })).toBeUndefined()
        } finally {
          await Pty.remove(a.id, { sessionID: "ses_a" })
          await Pty.remove(b.id, { sessionID: "ses_b" })
        }
      },
    })
  })
})

describe("pty idle cleanup", () => {
  test("removes orphaned PTYs after the configured idle timeout", async () => {
    await using dir = await tmpdir({ git: true, config: { pty: { idle_timeout_ms: 50 } } })

    await Instance.provide({
      directory: dir.path,
      fn: async () => {
        const pty = await Pty.create({ command: "cat", title: "idle", sessionID: "ses_idle" })
        const ws = {
          readyState: 1,
          data: { id: "idle" },
          send: () => {},
          close: () => {},
        }
        const handle = Pty.connect(pty.id, ws as any, undefined, { sessionID: "ses_idle" })
        if (!handle) throw new Error("expected websocket handle")
        handle.onClose()
        await sleep(125)
        expect(Pty.get(pty.id, { sessionID: "ses_idle" })).toBeUndefined()
      },
    })
  })

  test("clears pending PTY cleanup when a client reconnects", async () => {
    await using dir = await tmpdir({ git: true, config: { pty: { idle_timeout_ms: 50 } } })

    await Instance.provide({
      directory: dir.path,
      fn: async () => {
        const pty = await Pty.create({ command: "cat", title: "reconnect", sessionID: "ses_idle" })
        const first = {
          readyState: 1,
          data: { id: "first" },
          send: () => {},
          close: () => {},
        }
        const one = Pty.connect(pty.id, first as any, undefined, { sessionID: "ses_idle" })
        if (!one) throw new Error("expected first websocket handle")
        one.onClose()
        await sleep(25)
        const second = {
          readyState: 1,
          data: { id: "second" },
          send: () => {},
          close: () => {},
        }
        const two = Pty.connect(pty.id, second as any, undefined, { sessionID: "ses_idle" })
        if (!two) throw new Error("expected second websocket handle")
        await sleep(60)
        expect(Pty.get(pty.id, { sessionID: "ses_idle" })?.id).toBe(pty.id)
        two.onClose()
        await sleep(125)
        expect(Pty.get(pty.id, { sessionID: "ses_idle" })).toBeUndefined()
      },
    })
  })
})
