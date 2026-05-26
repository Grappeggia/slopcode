import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import fs from "fs"
import os from "os"
import { DaemonLauncher } from "@/daemon/launcher"
import { android, client, native } from "@/cli/cmd/tui/platform"
import { active, parity } from "../script/android-termux-parity"
import { e2eSource } from "../script/android-termux-e2e"

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
    expect(android({ platform: "android", override: undefined })).toBe(true)
    expect(android({ platform: "android", override: "1" })).toBe(false)
  })

  test("resolves bundled Termux client only when present", async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "slopcode-android-"))
    const bin = path.join(root, "bin")
    await fs.promises.mkdir(bin)
    expect(client(root)).toBeUndefined()
    await Bun.write(path.join(bin, "slopcode-termux"), "")
    expect(client(root)).toBe(path.join(bin, "slopcode-termux"))
    await fs.promises.rm(root, { recursive: true, force: true })
  })

  test("daemon children reuse bundled entrypoint", () => {
    process.env.SLOPCODE_ENTRYPOINT = "/tmp/slopcode-bundle/index.js"

    expect(DaemonLauncher.command()).toEqual({
      args: [process.execPath, "/tmp/slopcode-bundle/index.js"],
      cwd: undefined,
    })
  })

  test("Android wrapper preserves entrypoint and sidecar host mode", async () => {
    const build = await Bun.file(path.join(import.meta.dir, "..", "script", "build.ts")).text()
    const thread = await Bun.file(path.join(import.meta.dir, "..", "src", "cli", "cmd", "tui", "thread.ts")).text()

    expect(build).toContain("SLOPCODE_ENTRYPOINT: bundle")
    expect(build).toContain("@slopcode-ai/slopcode-android-${arch}")
    expect(build).toContain('@oven/bun-linux-${arch === "arm64" ? "aarch64" : "x64"}-android')
    expect(build).toContain("candidates.find((item) => fs.existsSync(item))")
    expect(build).not.toContain('item === "bun"')
    expect(build).toContain("native/android-client/main.rs")
    expect(build).toContain("SLOPCODE_ANDROID_ROOT")
    expect(build).toContain('"slopcode-termux"')
    expect(build).toContain("native/android-host/main.rs")
    expect(build).toContain("SLOPCODE_ANDROID_HOST_PATH")
    expect(build).toContain('SLOPCODE_ANDROID_HOST: process.env.SLOPCODE_ANDROID_HOST ?? "sidecar"')
    expect(build).toContain('"slopcode-android-host"')
    expect(build).toContain("process.exit(typeof result.status ===")
    expect(build).toContain("cwd(`dist/${key}`)")
    expect(build).toContain("cwd(`dist/${key}/bin`)")
    expect(thread).toContain('await import("./portable")')
    expect(thread).toContain("SLOPCODE_TERMUX_LEGACY")
    expect(thread).toContain('await import("./android-host")')
  })

  test("Android E2E declares parity coverage and phase 3 gaps", () => {
    const ids = parity.map((item) => item.id)

    expect(active("smoke").map((item) => item.id)).toEqual(["smoke.install"])
    expect(active("parity").map((item) => item.id)).toEqual([
      "smoke.install",
      "composer.submit",
      "composer.editing",
      "dialogs.question",
      "layout.capture",
      "commands.palette",
      "sessions.tabs",
      "models.panel",
      "files.panel",
      "render.tools",
      "permissions.preview",
    ])
    expect(ids).toContain("tabs.rich")
    expect(ids).toContain("sidebar.files")
    expect(ids).toContain("editor.diff")
    expect(parity.filter((item) => !item.active).every((item) => item.phase === 3 && !!item.missing)).toBe(true)
  })

  test("Android E2E generated Termux runner is valid JavaScript", async () => {
    const check = Bun.spawn(["node", "--version"], { stdout: "pipe", stderr: "pipe" })
    if ((await check.exited) !== 0) return

    const file = path.join(os.tmpdir(), `slopcode-android-termux-runner-${process.pid}.mjs`)
    await Bun.write(file, e2eSource("@slopcode-ai/slopcode-android-x64"))
    try {
      const proc = Bun.spawn(["node", "--check", file], { stdout: "pipe", stderr: "pipe" })
      const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
      expect(stderr).toBe("")
      expect(code).toBe(0)
    } finally {
      await fs.promises.rm(file, { force: true })
    }
  })
})
