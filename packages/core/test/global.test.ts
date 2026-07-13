import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { Global } from "@slopcode-ai/core/global"

describe("global paths", () => {
  test("uses isolated test paths and an in-memory database", () => {
    const root = path.dirname(process.env.XDG_DATA_HOME ?? "")
    expect(root.startsWith(os.tmpdir() + path.sep)).toBe(true)
    expect(path.basename(root).startsWith("slopcode-core-test-")).toBe(true)
    expect(process.env.SLOPCODE_DB).toBe(":memory:")
    expect(process.env.SLOPCODE_TEST_HOME).toBe(path.join(root, "home"))
    expect(Global.Path.data).toBe(path.join(root, "data", "slopcode"))
    expect(Global.Path.cache).toBe(path.join(root, "cache", "slopcode"))
    expect(Global.Path.config).toBe(path.join(root, "config", "slopcode"))
    expect(Global.Path.state).toBe(path.join(root, "state", "slopcode"))
  })

  test("tmp path is under the system temp directory", () => {
    expect(Global.Path.tmp).toBe(path.join(os.tmpdir(), "slopcode"))
    expect(Global.make().tmp).toBe(Global.Path.tmp)
  })

  test("tmp path is created on module load", async () => {
    expect((await fs.stat(Global.Path.tmp)).isDirectory()).toBe(true)
  })
})
