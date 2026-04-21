import { afterEach, describe, expect, test } from "bun:test"
import * as path from "node:path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"

const basic = process.env.SLOPCODE_EDITOR_FORCE_BASIC

afterEach(() => {
  process.env.SLOPCODE_EDITOR_FORCE_BASIC = basic
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
