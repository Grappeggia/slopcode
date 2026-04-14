import { afterEach, describe, expect, mock, test } from "bun:test"
import z from "zod"
import { tmpdir } from "../fixture/fixture"

const calls: string[] = []

mock.module("../../src/project/bootstrap", () => ({
  InstanceBootstrap: async () => {},
}))

mock.module("../../src/editor", () => ({
  EditorSession: {
    Info: z.object({
      id: z.string(),
      sessionID: z.string(),
      file: z.string(),
      cwd: z.string(),
      status: z.enum(["running", "exited"]),
      dirty: z.boolean(),
      diff: z.boolean(),
      mode: z.string(),
      pid: z.number(),
    }),
    OpenInput: z.object({
      sessionID: z.string(),
      file: z.string(),
      size: z.object({ rows: z.number(), cols: z.number() }),
    }),
    ScopedInput: z.object({
      sessionID: z.string(),
    }),
    open: async (input: any) => {
      calls.push(`open:${input.file}`)
      return {
        id: "pty_editor_test",
        sessionID: input.sessionID,
        file: input.file,
        cwd: "/tmp",
        status: "running",
        dirty: false,
        diff: true,
        mode: "NORMAL",
        pid: 1,
      }
    },
    get: (id: string) => {
      calls.push(`get:${id}`)
      return {
        id,
        sessionID: "ses_test0000000000000000000",
        file: "test.ts",
        cwd: "/tmp",
        status: "running",
        dirty: false,
        diff: true,
        mode: "NORMAL",
        pid: 1,
      }
    },
    save: async (id: string) => {
      calls.push(`save:${id}`)
      return {
        id,
        sessionID: "ses_test0000000000000000000",
        file: "test.ts",
        cwd: "/tmp",
        status: "running",
        dirty: false,
        diff: true,
        mode: "NORMAL",
        pid: 1,
      }
    },
    dismiss: async (id: string) => {
      calls.push(`dismiss:${id}`)
      return {
        id,
        sessionID: "ses_test0000000000000000000",
        file: "test.ts",
        cwd: "/tmp",
        status: "running",
        dirty: false,
        diff: false,
        mode: "NORMAL",
        pid: 1,
      }
    },
    close: async (id: string) => {
      calls.push(`close:${id}`)
      return true
    },
    connect: () => undefined,
  },
}))

afterEach(() => {
  calls.length = 0
  mock.restore()
})

describe("editor routes", () => {
  test("opens, saves, dismisses, and closes editor sessions", async () => {
    await using tmp = await tmpdir({ git: true })
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

    const save = await app.request("/editor/pty_editor_test/save?sessionID=ses_test0000000000000000000", {
      method: "POST",
      headers: { "x-slopcode-directory": tmp.path },
    })
    expect(save.status).toBe(200)

    const dismiss = await app.request("/editor/pty_editor_test/diff/dismiss?sessionID=ses_test0000000000000000000", {
      method: "POST",
      headers: { "x-slopcode-directory": tmp.path },
    })
    expect(dismiss.status).toBe(200)

    const close = await app.request("/editor/pty_editor_test?sessionID=ses_test0000000000000000000", {
      method: "DELETE",
      headers: { "x-slopcode-directory": tmp.path },
    })
    expect(close.status).toBe(200)
    expect(calls).toContain("open:test.ts")
    expect(calls).toContain("save:pty_editor_test")
    expect(calls).toContain("dismiss:pty_editor_test")
    expect(calls).toContain("close:pty_editor_test")
  })
})
