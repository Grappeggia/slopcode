import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import { Buffer } from "node:buffer"
import { EventEmitter } from "node:events"
import * as fs from "node:fs"
import * as path from "node:path"
import { PassThrough } from "node:stream"
import { Packr, UnpackrStream } from "msgpackr"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { SessionSummary } from "../../src/session/summary"

const active: Array<{ exit(): void }> = []
const env = {
  root: process.env.SLOPCODE_NVIM_ROOT,
  bin: process.env.SLOPCODE_NVIM_BIN_PATH,
  runtime: process.env.SLOPCODE_VIMRUNTIME,
}

mock.module("node:child_process", () => ({
  spawn(_bin: string, args: string[]) {
    const file = String(args[2] ?? "")
    let text = fs.readFileSync(file, "utf8")
    let dirty = false
    let mode = "n"
    const packr = new Packr({ useRecords: false })
    const proc = new EventEmitter() as EventEmitter & {
      stdin: PassThrough
      stdout: PassThrough
      stderr: PassThrough
      pid: number
      kill(): void
    }
    proc.stdin = new PassThrough()
    proc.stdout = new PassThrough()
    proc.stderr = new PassThrough()
    proc.pid = 1234
    proc.kill = () => proc.emit("exit", 0)
    const redraw = () => {
      proc.stdout.write(
        packr.pack([
          2,
          "redraw",
          [
            ["default_colors_set", [0xffffff, 0x111111, 0, 0, 0]],
            ["grid_resize", [1, 40, 12]],
            ["grid_line", [1, 0, 0, [["o"], ["k"]], false]],
            ["flush", []],
          ],
        ]),
      )
    }
    const stream = new UnpackrStream({ sequential: true })
    proc.stdin.pipe(stream)
    stream.on("data", (message: unknown) => {
      if (!Array.isArray(message) || message[0] !== 0) return
      const id = Number(message[1])
      const method = String(message[2])
      const params = Array.isArray(message[3]) ? message[3] : []
      if (method === "nvim_ui_attach" || method === "nvim_ui_try_resize") {
        proc.stdout.write(packr.pack([1, id, null, null]))
        redraw()
        return
      }
      if (method === "nvim_exec_lua") {
        proc.stdout.write(packr.pack([1, id, null, { dirty, mode, file }]))
        return
      }
      if (method === "nvim_get_current_buf") {
        proc.stdout.write(packr.pack([1, id, null, 1]))
        return
      }
      if (method === "nvim_buf_get_lines") {
        proc.stdout.write(packr.pack([1, id, null, text.replace(/\r/g, "").split("\n")]))
        return
      }
      if (method === "nvim_eval") {
        proc.stdout.write(packr.pack([1, id, null, 1]))
        return
      }
      if (method === "nvim_input" || method === "nvim_paste") {
        text = ";" + text
        dirty = true
        mode = "i"
        proc.stdout.write(packr.pack([1, id, null, method === "nvim_input" ? 1 : null]))
        redraw()
        return
      }
      if (method === "nvim_command") {
        const cmd = String(params[0] ?? "")
        if (cmd === "write") {
          fs.writeFileSync(file, text)
          dirty = false
        }
        proc.stdout.write(packr.pack([1, id, null, null]))
        redraw()
        return
      }
      proc.stdout.write(packr.pack([1, id, null, null]))
    })
    active.push({
      exit() {
        proc.emit("exit", 0)
      },
    })
    return proc
  },
}))

afterEach(() => {
  mock.restore()
  active.splice(0).forEach((item) => item.exit())
  process.env.SLOPCODE_NVIM_ROOT = env.root
  process.env.SLOPCODE_NVIM_BIN_PATH = env.bin
  process.env.SLOPCODE_VIMRUNTIME = env.runtime
})

async function eventually(check: () => boolean | Promise<boolean>, timeout = 1500) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await check()) return
    await Bun.sleep(25)
  }
  throw new Error("condition not met")
}

describe("nvim editor session", () => {
  test("opens, edits, saves, dismisses diff, and closes", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.ts"), "const a = 1\n")
        await fs.promises.mkdir(path.join(dir, "nvim", "bin"), { recursive: true })
        await fs.promises.mkdir(path.join(dir, "nvim", "share", "nvim", "runtime"), { recursive: true })
      },
    })
    process.env.SLOPCODE_NVIM_ROOT = path.join(tmp.path, "nvim")
    process.env.SLOPCODE_NVIM_BIN_PATH = path.join(
      tmp.path,
      "nvim",
      "bin",
      process.platform === "win32" ? "nvim.exe" : "nvim",
    )
    process.env.SLOPCODE_VIMRUNTIME = path.join(tmp.path, "nvim", "share", "nvim", "runtime")
    fs.writeFileSync(process.env.SLOPCODE_NVIM_BIN_PATH, "")
    const diff = spyOn(SessionSummary, "diffChunk").mockResolvedValue([
      { file: "test.ts", before: "const before = true\n", additions: 1, deletions: 1, after: "", status: "modified" },
    ] as never)
    try {
      const { EditorSessionNvim } = await import("../../src/editor/session-nvim")
      await Instance.provide({
        directory: tmp.path,
        viewID: "view-a",
        fn: async () => {
          const info = await EditorSessionNvim.open({
            sessionID: "ses_test0000000000000000000",
            file: "test.ts",
            size: { rows: 12, cols: 48 },
          })
          expect(info?.file).toBe("test.ts")
          expect(info?.diff).toBe(true)
          const sent: string[] = []
          const ws = {
            readyState: 1,
            data: { id: "a" },
            send(value: string | Uint8Array | ArrayBuffer) {
              sent.push(typeof value === "string" ? value : Buffer.from(value as ArrayBuffer).toString("utf8"))
            },
            close() {},
          }
          const handle = EditorSessionNvim.connect(info!.id, ws as never, { sessionID: info!.sessionID })
          expect(handle).toBeDefined()
          handle?.onMessage(JSON.stringify({ type: "input", keys: ";" }))
          await eventually(async () => EditorSessionNvim.get(info!.id, { sessionID: info!.sessionID })?.dirty === true)
          await EditorSessionNvim.save(info!.id, { sessionID: info!.sessionID })
          expect((await Bun.file(path.join(tmp.path, "test.ts")).text()).trimEnd()).toBe(";const a = 1")
          await EditorSessionNvim.dismiss(info!.id, { sessionID: info!.sessionID })
          expect(EditorSessionNvim.get(info!.id, { sessionID: info!.sessionID })?.diff).toBe(false)
          await EditorSessionNvim.close(info!.id, { sessionID: info!.sessionID })
          expect(EditorSessionNvim.get(info!.id, { sessionID: info!.sessionID })).toBeUndefined()
        },
      })
    } finally {
      diff.mockRestore()
    }
  })
})
