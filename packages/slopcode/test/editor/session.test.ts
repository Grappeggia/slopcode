import { afterEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"

const env = {
  basic: process.env.SLOPCODE_EDITOR_FORCE_BASIC,
  root: process.env.SLOPCODE_NVIM_ROOT,
  bin: process.env.SLOPCODE_NVIM_BIN_PATH,
  runtime: process.env.SLOPCODE_VIMRUNTIME,
}

const set = (key: string, value?: string) => {
  if (value === undefined) {
    delete process.env[key]
    return
  }
  process.env[key] = value
}

afterEach(() => {
  set("SLOPCODE_EDITOR_FORCE_BASIC", env.basic)
  set("SLOPCODE_NVIM_ROOT", env.root)
  set("SLOPCODE_NVIM_BIN_PATH", env.bin)
  set("SLOPCODE_VIMRUNTIME", env.runtime)
})

async function eventually(check: () => boolean | Promise<boolean>, timeout = 1500) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await check()) return
    await Bun.sleep(25)
  }
  throw new Error("condition not met")
}

describe("editor session", () => {
  test("processes websocket input outside the instance context", async () => {
    process.env.SLOPCODE_EDITOR_FORCE_BASIC = "true"
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "outside.ts"), "const a = 1\n")
      },
    })
    const { EditorSession } = await import("../../src/editor/session")
    const handle = await Instance.provide({
      directory: tmp.path,
      viewID: "view-a",
      fn: async () => {
        const info = await EditorSession.open({
          sessionID: "ses_test0000000000000000002",
          file: "outside.ts",
          size: { rows: 8, cols: 40 },
        })
        const ws = {
          readyState: 1,
          data: { id: "c" },
          send() {},
          close() {},
        }
        return {
          info,
          handle: EditorSession.connect(info.id, ws as never, { sessionID: info.sessionID }),
        }
      },
    })
    handle.handle?.onMessage(JSON.stringify({ type: "input", keys: ";" }))
    await eventually(async () =>
      Instance.provide({
        directory: tmp.path,
        viewID: "view-a",
        fn: async () => EditorSession.get(handle.info.id, { sessionID: handle.info.sessionID })?.dirty === true,
      }),
    )
  })

  test("falls back to the basic editor when bundled Neovim is not runnable", async () => {
    if (process.platform === "win32") return
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "fallback.ts"), "const a = 1\n")
        await fs.mkdir(path.join(dir, "nvim", "bin"), { recursive: true })
        await fs.mkdir(path.join(dir, "nvim", "share", "nvim", "runtime"), { recursive: true })
        await Bun.write(
          path.join(dir, "nvim", "bin", "nvim"),
          "#!/bin/sh\necho 'GLIBC_2.34 not found' 1>&2\nexit 127\n",
        )
      },
    })
    await Bun.$`chmod 755 ${path.join(tmp.path, "nvim", "bin", "nvim")}`
    set("SLOPCODE_NVIM_ROOT", path.join(tmp.path, "nvim"))
    set("SLOPCODE_NVIM_BIN_PATH", path.join(tmp.path, "nvim", "bin", "nvim"))
    set("SLOPCODE_VIMRUNTIME", path.join(tmp.path, "nvim", "share", "nvim", "runtime"))
    const { EditorSession } = await import("../../src/editor/session")
    await Instance.provide({
      directory: tmp.path,
      viewID: "view-a",
      fn: async () => {
        const info = await EditorSession.open({
          sessionID: "ses_test0000000000000000003",
          file: "fallback.ts",
          size: { rows: 8, cols: 40 },
        })
        expect(info.mode).toBe("EDIT")
        expect(info.pid).toBe(0)
      },
    })
  })

  test("opens, edits, saves, and closes", async () => {
    process.env.SLOPCODE_EDITOR_FORCE_BASIC = "true"
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.ts"), "const a = 1\n")
      },
    })
    const { EditorSession } = await import("../../src/editor/session")
    await Instance.provide({
      directory: tmp.path,
      viewID: "view-a",
      fn: async () => {
        const info = await EditorSession.open({
          sessionID: "ses_test0000000000000000000",
          file: "test.ts",
          size: { rows: 8, cols: 40 },
        })
        expect(info.mode).toBe("EDIT")

        const sent: string[] = []
        const ws = {
          readyState: 1,
          data: { id: "a" },
          send(value: string | Uint8Array | ArrayBuffer) {
            sent.push(typeof value === "string" ? value : Buffer.from(value as ArrayBuffer).toString("utf8"))
          },
          close() {},
        }
        const handle = EditorSession.connect(info.id, ws as never, { sessionID: info.sessionID })
        expect(handle).toBeDefined()

        handle?.onMessage(JSON.stringify({ type: "input", keys: ";" }))
        await eventually(async () => EditorSession.get(info.id)?.dirty === true)

        await EditorSession.save(info.id, { sessionID: info.sessionID })
        expect((await Bun.file(path.join(tmp.path, "test.ts")).text()).trimEnd()).toBe(";const a = 1")

        await EditorSession.close(info.id, { sessionID: info.sessionID })
        expect(EditorSession.get(info.id, { sessionID: info.sessionID })).toBeUndefined()
      },
    })
  })

  test("publishes lint diagnostics in snapshots", async () => {
    process.env.SLOPCODE_EDITOR_FORCE_BASIC = "true"
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "bad.json"), '{"foo": ]')
      },
    })
    const { EditorSession } = await import("../../src/editor/session")
    await Instance.provide({
      directory: tmp.path,
      viewID: "view-a",
      fn: async () => {
        const info = await EditorSession.open({
          sessionID: "ses_test0000000000000000001",
          file: "bad.json",
          size: { rows: 6, cols: 30 },
        })
        const sent: string[] = []
        const ws = {
          readyState: 1,
          data: { id: "b" },
          send(value: string | Uint8Array | ArrayBuffer) {
            sent.push(typeof value === "string" ? value : Buffer.from(value as ArrayBuffer).toString("utf8"))
          },
          close() {},
        }
        EditorSession.connect(info.id, ws as never, { sessionID: info.sessionID })
        await eventually(() => sent.length > 0)
        const snapshot = JSON.parse(sent.at(-1)!) as { snapshot: { diagnostics: { message: string }[] } }
        expect(snapshot.snapshot.diagnostics.length).toBeGreaterThan(0)
        expect(snapshot.snapshot.diagnostics[0]?.message.length).toBeGreaterThan(0)
      },
    })
  })
})
