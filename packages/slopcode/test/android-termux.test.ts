import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import { DaemonLauncher } from "@/daemon/launcher"
import { native } from "@/cli/cmd/tui/platform"

const entry = process.env.SLOPCODE_ENTRYPOINT

afterEach(() => {
  if (entry === undefined) delete process.env.SLOPCODE_ENTRYPOINT
  else process.env.SLOPCODE_ENTRYPOINT = entry
})

describe("Android Termux runtime", () => {
  test("marks native Android TUI unavailable unless explicitly overridden", () => {
    expect(native({ platform: "linux", override: undefined })).toBe(true)
    expect(native({ platform: "android", override: undefined })).toBe(false)
    expect(native({ platform: "android", override: "1" })).toBe(true)
  })

  test("daemon children reuse bundled entrypoint", () => {
    process.env.SLOPCODE_ENTRYPOINT = "/tmp/slopcode-bundle/index.js"

    expect(DaemonLauncher.command()).toEqual({
      args: [process.execPath, "/tmp/slopcode-bundle/index.js"],
      cwd: undefined,
    })
  })

  test("Android wrapper preserves entrypoint and no-native renderer mode", async () => {
    const build = await Bun.file(path.join(import.meta.dir, "..", "script", "build.ts")).text()

    expect(build).toContain("SLOPCODE_ENTRYPOINT: bundle")
    expect(build).toContain("OTUI_NO_NATIVE_RENDER")
    expect(build).toContain("process.exit(typeof result.status ===")
  })
})
