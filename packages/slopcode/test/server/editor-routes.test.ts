import { afterEach, describe, expect, test } from "bun:test"
import * as path from "node:path"
import { tmpdir } from "../fixture/fixture"

const basic = process.env.SLOPCODE_EDITOR_FORCE_BASIC

afterEach(() => {
  if (basic === undefined) {
    delete process.env.SLOPCODE_EDITOR_FORCE_BASIC
    return
  }
  process.env.SLOPCODE_EDITOR_FORCE_BASIC = basic
})

describe("editor routes", () => {
  test("opens, snapshots, saves, dismisses, and closes editor sessions", async () => {
    process.env.SLOPCODE_EDITOR_FORCE_BASIC = "true"
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.ts"), "const a = 1\n")
        await Bun.$`git add test.ts && git commit -m "add test"`.cwd(dir).quiet()
        await Bun.write(path.join(dir, "test.ts"), "const a = 2\n")
      },
    })
    const { Server } = await import("../../src/server/server")
    const app = Server.App()
    const headers = {
      "x-slopcode-directory": tmp.path,
      "content-type": "application/json",
    }

    const open = await app.request("/editor", {
      method: "POST",
      headers,
      body: JSON.stringify({
        sessionID: "ses_test0000000000000000000",
        file: "test.ts",
        size: { rows: 10, cols: 20 },
      }),
    })
    expect(open.status).toBe(200)
    const info = (await open.json()) as { id: string; sessionID: string; diff: boolean }
    expect(typeof info.diff).toBe("boolean")

    const snapshot = await app.request(`/editor/${info.id}/snapshot?sessionID=${info.sessionID}`, {
      method: "GET",
      headers: { "x-slopcode-directory": tmp.path },
    })
    expect(snapshot.status).toBe(200)

    const save = await app.request(`/editor/${info.id}/save?sessionID=${info.sessionID}`, {
      method: "POST",
      headers: { "x-slopcode-directory": tmp.path },
    })
    expect(save.status).toBe(200)

    const dismiss = await app.request(`/editor/${info.id}/diff/dismiss?sessionID=${info.sessionID}`, {
      method: "POST",
      headers: { "x-slopcode-directory": tmp.path },
    })
    expect(dismiss.status).toBe(200)

    const close = await app.request(`/editor/${info.id}?sessionID=${info.sessionID}`, {
      method: "DELETE",
      headers: { "x-slopcode-directory": tmp.path },
    })
    expect(close.status).toBe(200)
  })
})
