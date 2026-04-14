import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import * as net from "node:net"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { Packr, UnpackrStream } from "msgpackr"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { SessionSummary } from "../../src/session/summary"

const active: Array<{ close(): Promise<void> }> = []
const exits: Array<() => void> = []

mock.module("bun-pty", () => ({
  spawn(_command: string, args: string[]) {
    const sock = args[2]!
    const packr = new Packr({ useRecords: false })
    const state = {
      dirty: false,
      diff: true,
      mode: "n",
      rows: 10,
      cols: 40,
    }
    const redraw = (socket: net.Socket) => {
      socket.write(
        packr.pack([
          2,
          "redraw",
          [
            ["default_colors_set", [0xffffff, 0x111111, 0, 0, 0]],
            ["grid_resize", [1, state.cols, state.rows]],
            ["grid_line", [1, 0, 0, [["o"], ["k"]], false]],
            ["flush", []],
          ],
        ]),
      )
    }
    const sockets = new Set<net.Socket>()
    const server = net.createServer((socket) => {
      sockets.add(socket)
      socket.on("close", () => sockets.delete(socket))
      const stream = new UnpackrStream({ sequential: true })
      socket.pipe(stream)
      stream.on("data", (message: unknown) => {
        if (!Array.isArray(message) || message[0] !== 0) return
        const id = Number(message[1])
        const method = String(message[2])
        const params = Array.isArray(message[3]) ? message[3] : []
        if (method === "nvim_ui_attach") {
          state.cols = Number(params[0])
          state.rows = Number(params[1])
          socket.write(packr.pack([1, id, null, null]))
          redraw(socket)
          return
        }
        if (method === "nvim_ui_try_resize") {
          state.cols = Number(params[0])
          state.rows = Number(params[1])
          socket.write(packr.pack([1, id, null, null]))
          redraw(socket)
          return
        }
        if (method === "nvim_exec_lua") {
          socket.write(
            packr.pack([1, id, null, { dirty: state.dirty, mode: state.mode, file: path.join(process.cwd(), "test.ts") }]),
          )
          return
        }
        if (method === "nvim_eval") {
          socket.write(packr.pack([1, id, null, 1]))
          return
        }
        if (method === "nvim_input" || method === "nvim_paste") {
          state.dirty = true
          state.mode = "i"
          socket.write(packr.pack([1, id, null, null]))
          redraw(socket)
          return
        }
        if (method === "nvim_command") {
          const command = String(params[0] ?? "")
          if (command === "write") state.dirty = false
          if (command === "diffoff!") state.diff = false
          socket.write(packr.pack([1, id, null, null]))
          redraw(socket)
          return
        }
        socket.write(packr.pack([1, id, null, null]))
      })
    })
    void fs.rm(sock, { force: true }).catch(() => {})
    server.listen(sock)
    active.push({
      async close() {
        Array.from(sockets).forEach((socket) => socket.destroy())
        await new Promise<void>((resolve) => server.close(() => resolve()))
        await fs.rm(sock, { force: true }).catch(() => {})
      },
    })
    return {
      pid: 1234,
      kill() {
        exits.splice(0).forEach((fn) => fn())
        Array.from(sockets).forEach((socket) => socket.destroy())
        void server.close()
      },
      onExit(fn: () => void) {
        exits.push(fn)
      },
    }
  },
}))

afterEach(async () => {
  mock.restore()
  while (active.length > 0) {
    await active.pop()?.close()
  }
  exits.splice(0)
})

describe("editor session", () => {
  test("opens, streams, saves, dismisses diff, and closes", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.ts"), "const a = 1\n")
      },
    })
    const bin = path.join(tmp.path, "bin")
    await fs.mkdir(bin, { recursive: true })
    await Bun.write(path.join(bin, "nvim"), "#!/bin/sh\nexit 0\n")
    await fs.chmod(path.join(bin, "nvim"), 0o755)
    const prevPath = process.env.PATH
    process.env.PATH = `${bin}${path.delimiter}${prevPath ?? ""}`
    const diff = spyOn(SessionSummary, "diffChunk").mockResolvedValue([
      { file: "test.ts", before: "const before = true\n", additions: 1, deletions: 1, after: "", status: "modified" },
    ] as any)

    try {
      const { EditorSession } = await import("../../src/editor")
      await Instance.provide({
        directory: tmp.path,
        viewID: "view-a",
        fn: async () => {
          const info = await EditorSession.open({
            sessionID: "ses_test0000000000000000000",
            file: "test.ts",
            size: { rows: 12, cols: 48 },
          })
          expect(info.file).toBe("test.ts")
          expect(info.diff).toBe(true)

          const sent: string[] = []
          const ws = {
            readyState: 1,
            data: { id: "a" },
            send(value: string | Uint8Array | ArrayBuffer) {
              sent.push(typeof value === "string" ? value : Buffer.from(value as ArrayBuffer).toString("utf8"))
            },
            close() {},
          }
          const handle = EditorSession.connect(info.id, ws as any, { sessionID: "ses_test0000000000000000000" })
          expect(handle).toBeDefined()
          expect(sent.some((item) => item.includes('"snapshot"'))).toBe(true)

          const before = sent.length
          handle?.onMessage(JSON.stringify({ type: "input", keys: "a" }))
          await Bun.sleep(200)
          expect(sent.length).toBeGreaterThan(before)

          await EditorSession.save(info.id, { sessionID: "ses_test0000000000000000000" })
          expect(EditorSession.get(info.id, { sessionID: "ses_test0000000000000000000" })?.dirty).toBe(false)

          await EditorSession.dismiss(info.id, { sessionID: "ses_test0000000000000000000" })
          expect(EditorSession.get(info.id, { sessionID: "ses_test0000000000000000000" })?.diff).toBe(false)

          await EditorSession.close(info.id, { sessionID: "ses_test0000000000000000000" })
          expect(EditorSession.get(info.id, { sessionID: "ses_test0000000000000000000" })).toBeUndefined()
        },
      })
    } finally {
      process.env.PATH = prevPath
      diff.mockRestore()
    }
  })
})
