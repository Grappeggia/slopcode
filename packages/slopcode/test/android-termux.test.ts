import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import fs from "fs"
import os from "os"
import { DaemonLauncher } from "@/daemon/launcher"
import { android, client, native } from "@/cli/cmd/tui/platform"
import { active, parity, phases, report } from "../script/android-termux-parity"
import { androidTargets, e2eSource } from "../script/android-termux-e2e"

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
    expect(build).toContain("slopcode-bin-android-${arch}")
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

  test("Android release and E2E targets cover arm64 and x64", async () => {
    const build = await Bun.file(path.join(import.meta.dir, "..", "script", "build.ts")).text()
    const verify = await Bun.file(path.join(import.meta.dir, "..", "script", "verify-artifacts.ts")).text()

    expect(androidTargets.map((item) => item.arch)).toEqual(["arm64", "x64"])
    expect(build).toContain('os: "android"')
    expect(build).toContain('arch: "arm64"')
    expect(build).toContain('arch: "x64"')
    expect(verify).toContain('asset: "slopcode-android-arm64.tar.gz"')
    expect(verify).toContain('asset: "slopcode-android-x64.tar.gz"')
  })

  test("Android E2E declares normalized parity coverage and blockers", async () => {
    const ids = parity.map((item) => item.id)
    const snapshot = await Bun.file(
      path.join(import.meta.dir, "..", "script", "android-termux-parity.snapshot.json"),
    ).json()

    expect(phases.map((item) => item.phase)).toEqual([0, 1, 2, 3, 4, 5])
    expect(active("smoke").map((item) => item.id)).toEqual(["smoke.install"])
    expect(active("parity").map((item) => item.id)).toEqual([
      "smoke.install",
      "home.landing",
      "composer.submit",
      "composer.editing",
      "composer.advanced",
      "dialogs.question",
      "layout.capture",
      "commands.palette",
      "sessions.tabs",
      "sessions.routes",
      "models.panel",
      "files.panel",
      "render.tools",
      "permissions.preview",
      "sidebar.files",
      "editor.diff",
      "terminal.polish",
      "render.parity-gates",
      "permissions.parity-gates",
    ])
    expect(report()).toEqual(snapshot)
    expect(parity.filter((item) => item.active).every((item) => item.android.length > 0)).toBe(true)
    expect(active("release").map((item) => item.id)).toEqual(["release.sidecar-smoke"])
    expect(report().overclaims.map((item) => item.id)).toEqual(
      expect.arrayContaining(["home.landing", "commands.palette", "editor.diff", "terminal.polish"]),
    )
    expect(parity.find((item) => item.id === "native.opentui")?.level).toBe("blocked")
    expect(parity.filter((item) => item.status === "blocked").every((item) => !item.active && !!item.missing)).toBe(
      true,
    )
    expect(ids).toEqual(
      expect.arrayContaining([
        "tabs.rich",
        "sidebar.files",
        "editor.diff",
        "terminal.polish",
        "native.opentui",
        "release.sidecar-smoke",
        "render.parity-gates",
        "permissions.parity-gates",
      ]),
    )
  })

  test("Android E2E generated Termux runner is valid JavaScript", async () => {
    const check = Bun.spawn(["node", "--version"], { stdout: "pipe", stderr: "pipe" })
    if ((await check.exited) !== 0) return

    const file = path.join(os.tmpdir(), `slopcode-android-termux-runner-${process.pid}.mjs`)
    await Bun.write(file, e2eSource("slopcode-bin-android-x64"))
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
