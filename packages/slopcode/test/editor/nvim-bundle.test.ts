import { afterEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"

const env = {
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
  set("SLOPCODE_NVIM_ROOT", env.root)
  set("SLOPCODE_NVIM_BIN_PATH", env.bin)
  set("SLOPCODE_VIMRUNTIME", env.runtime)
})

describe("nvim bundle", () => {
  test("accepts an explicit binary that passes its startup probe", async () => {
    if (process.platform === "win32") return
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-nvim-bundle-"))
    const bin = path.join(root, "bin")
    const run = path.join(root, "share", "nvim", "runtime")
    const file = path.join(bin, "nvim")
    await fs.mkdir(bin, { recursive: true })
    await fs.mkdir(run, { recursive: true })
    await fs.writeFile(file, "#!/bin/sh\nexit 0\n")
    await fs.chmod(file, 0o755)
    set("SLOPCODE_NVIM_ROOT")
    set("SLOPCODE_NVIM_BIN_PATH", file)
    set("SLOPCODE_VIMRUNTIME", run)
    const { NvimBundle } = await import("../../src/editor/nvim-bundle")
    const hit = await NvimBundle.ready()
    expect(hit?.bin).toBe(file)
    expect(hit?.runtime).toBe(run)
    await fs.rm(root, { recursive: true, force: true })
  })

  test("rejects a binary that fails its startup probe", async () => {
    if (process.platform === "win32") return
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-nvim-bundle-"))
    const bin = path.join(root, "bin")
    const run = path.join(root, "share", "nvim", "runtime")
    const file = path.join(bin, "nvim")
    await fs.mkdir(bin, { recursive: true })
    await fs.mkdir(run, { recursive: true })
    await fs.writeFile(file, "#!/bin/sh\necho 'GLIBC_2.34 not found' 1>&2\nexit 127\n")
    await fs.chmod(file, 0o755)
    set("SLOPCODE_NVIM_ROOT")
    set("SLOPCODE_NVIM_BIN_PATH", file)
    set("SLOPCODE_VIMRUNTIME", run)
    const { NvimBundle } = await import("../../src/editor/nvim-bundle")
    expect(await NvimBundle.ready()).toBeUndefined()
    expect(await NvimBundle.problem()).toContain("GLIBC_2.34")
    await fs.rm(root, { recursive: true, force: true })
  })
})
