import { afterEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"

const env = {
  root: process.env.SLOPCODE_NVIM_ROOT,
  bin: process.env.SLOPCODE_NVIM_BIN_PATH,
  runtime: process.env.SLOPCODE_VIMRUNTIME,
}

afterEach(() => {
  process.env.SLOPCODE_NVIM_ROOT = env.root
  process.env.SLOPCODE_NVIM_BIN_PATH = env.bin
  process.env.SLOPCODE_VIMRUNTIME = env.runtime
})

describe("nvim bundle", () => {
  test("resolves from an explicit binary path", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-nvim-bundle-"))
    const bin = path.join(root, "bin")
    const share = path.join(root, "share", "nvim", "runtime")
    await fs.mkdir(bin, { recursive: true })
    await fs.mkdir(share, { recursive: true })
    await Bun.write(path.join(bin, process.platform === "win32" ? "nvim.exe" : "nvim"), "")
    process.env.SLOPCODE_NVIM_ROOT = undefined
    process.env.SLOPCODE_NVIM_BIN_PATH = path.join(bin, process.platform === "win32" ? "nvim.exe" : "nvim")
    process.env.SLOPCODE_VIMRUNTIME = path.join(root, "share", "nvim", "runtime")
    const { NvimBundle } = await import("../../src/editor/nvim-bundle")
    const hit = await NvimBundle.resolve()
    expect(hit?.bin).toBe(process.env.SLOPCODE_NVIM_BIN_PATH)
    expect(hit?.runtime).toBe(process.env.SLOPCODE_VIMRUNTIME)
    await fs.rm(root, { recursive: true, force: true })
  })
})
