import { describe, expect, spyOn, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { SessionSummary } from "../../src/session/summary"

async function eventually(check: () => boolean | Promise<boolean>, timeout = 1000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await check()) return
    await Bun.sleep(25)
  }
  throw new Error("condition not met")
}

describe("editor session", () => {
  test("opens, saves, dismisses diff, and closes", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.ts"), "const a = 1\n")
      },
    })
    const bin = path.join(tmp.path, "bin")
    const nvim = path.join(bin, "nvim")
    const msgpack = path.resolve(import.meta.dir, "../../node_modules/msgpackr/node-index.js")
    await fs.mkdir(bin, { recursive: true })
    await Bun.write(
      nvim,
      `#!/usr/bin/env bun
import * as net from "node:net"
import * as fs from "node:fs/promises"
import { Packr, UnpackrStream } from ${JSON.stringify(msgpack)}

const args = process.argv.slice(2)
const sock = args[args.indexOf("--listen") + 1]
const packr = new Packr({ useRecords: false })
const state = { dirty: false, diff: true, mode: "n", rows: 10, cols: 40 }

const redraw = (socket) => {
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

await fs.rm(sock, { force: true }).catch(() => {})
const server = net.createServer((socket) => {
  const stream = new UnpackrStream({ sequential: true })
  socket.pipe(stream)
  stream.on("data", (message) => {
    if (!Array.isArray(message) || message[0] !== 0) return
    const id = Number(message[1])
    const method = String(message[2])
    const params = Array.isArray(message[3]) ? message[3] : []
    if (method === "nvim_ui_attach" || method === "nvim_ui_try_resize") {
      state.cols = Number(params[0]) || state.cols
      state.rows = Number(params[1]) || state.rows
      socket.write(packr.pack([1, id, null, null]))
      redraw(socket)
      return
    }
    if (method === "nvim_exec_lua") {
      socket.write(packr.pack([1, id, null, { dirty: state.dirty, mode: state.mode, file: "test.ts" }]))
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
await new Promise((resolve) => server.listen(sock, resolve))
process.on("SIGTERM", () => server.close(() => process.exit(0)))
process.on("SIGINT", () => server.close(() => process.exit(0)))
`,
    )
    await fs.chmod(nvim, 0o755)

    const prevPath = process.env.PATH
    process.env.PATH = `${bin}${path.delimiter}${prevPath ?? ""}`
    const diff = spyOn(SessionSummary, "diffChunk").mockResolvedValue([
      { file: "test.ts", before: "const before = true\n", additions: 1, deletions: 1, after: "", status: "modified" },
    ] as any)

    try {
      const { EditorSession } = await import("../../src/editor/session")
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

          const current = () =>
            Instance.provide({
              directory: tmp.path,
              viewID: "view-a",
              fn: async () => EditorSession.get(info.id),
            })

          await eventually(async () => !!(await current()))
          await Instance.provide({
            directory: tmp.path,
            viewID: "view-a",
            fn: async () => EditorSession.save(info.id),
          })
          await eventually(async () => (await current())?.dirty === false)

          await Instance.provide({
            directory: tmp.path,
            viewID: "view-a",
            fn: async () => EditorSession.dismiss(info.id),
          })
          await eventually(async () => (await current())?.diff === false)

          await Instance.provide({
            directory: tmp.path,
            viewID: "view-a",
            fn: async () => EditorSession.close(info.id),
          })
          await eventually(async () => (await current()) === undefined)
        },
      })
    } finally {
      process.env.PATH = prevPath
      diff.mockRestore()
    }
  })
})
