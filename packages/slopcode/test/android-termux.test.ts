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
  test("keeps Android on the Rust runtime path", () => {
    expect(native({ platform: "linux", override: undefined })).toBe(true)
    expect(native({ platform: "android", override: undefined })).toBe(false)
    expect(native({ platform: "android", override: "1" })).toBe(false)
    expect(android({ platform: "android", override: undefined })).toBe(true)
    expect(android({ platform: "android", override: "1" })).toBe(true)
    const bionic = process.env.SLOPCODE_BIONIC
    try {
      process.env.SLOPCODE_BIONIC = "1"
      expect(native()).toBe(false)
      expect(android()).toBe(true)
    } finally {
      if (bionic === undefined) delete process.env.SLOPCODE_BIONIC
      else process.env.SLOPCODE_BIONIC = bionic
    }
  })

  test("resolves bundled Rust host only when present", async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "slopcode-android-"))
    const bin = path.join(root, "bin")
    await fs.promises.mkdir(bin)
    expect(client(root)).toBeUndefined()
    await Bun.write(path.join(bin, "slopcode-android-host"), "")
    expect(client(root)).toBe(path.join(bin, "slopcode-android-host"))
    await fs.promises.rm(root, { recursive: true, force: true })
  })

  test("daemon children reuse bundled entrypoint", () => {
    process.env.SLOPCODE_ENTRYPOINT = "/tmp/slopcode-bundle/index.js"

    expect(DaemonLauncher.command()).toEqual({
      args: [process.execPath, "/tmp/slopcode-bundle/index.js"],
      cwd: undefined,
    })
  })

  test("Android runtime stays Rust-only while root package ships the bootstrap bundle", async () => {
    const build = await Bun.file(path.join(import.meta.dir, "..", "script", "build.ts")).text()
    const publish = await Bun.file(path.join(import.meta.dir, "..", "script", "publish.ts")).text()
    const verify = await Bun.file(path.join(import.meta.dir, "..", "script", "verify-artifacts.ts")).text()
    const e2e = await Bun.file(path.join(import.meta.dir, "..", "script", "android-termux-e2e.ts")).text()
    const workflow = await Bun.file(
      path.join(import.meta.dir, "..", "..", "..", ".github", "workflows", "android-termux-e2e.yml"),
    ).text()
    const thread = await Bun.file(path.join(import.meta.dir, "..", "src", "cli", "cmd", "tui", "thread.ts")).text()
    const routes = await Bun.file(path.join(import.meta.dir, "..", "src", "server", "routes", "tui.ts")).text()
    const surface = await Bun.file(path.join(import.meta.dir, "..", "src", "cli", "cmd", "tui", "surface.ts")).text()
    const manifest = await Bun.file(path.join(import.meta.dir, "..", "native", "android-tui", "Cargo.toml")).text()
    const entry = await Bun.file(path.join(import.meta.dir, "..", "native", "android-tui", "src", "main.rs")).text()
    const launcher = await Bun.file(path.join(import.meta.dir, "..", "bin", "slopcode")).text()

    expect(build).toContain("androidRuntime")
    expect(build).toContain("androidBundle")
    expect(build).toContain("native/android-tui/Cargo.toml")
    expect(build).toContain("cargo build")
    expect(build).toContain("rustupTool")
    expect(build).toContain("macosSdkEnv")
    expect(build).toContain("RUSTC")
    expect(build).toContain("RUSTDOC")
    expect(build).toContain("SDKROOT")
    expect(build).toContain("slopcode-android-tui")
    expect(build).toContain('"slopcode-android-host"')
    expect(build).toContain('"./bin/slopcode"')
    expect(build).toContain("dist/android-bundle/index.js")
    expect(build).toContain("const androidModules = async")
    expect(build).toContain("SLOPCODE_BUILD_VERSION")
    expect(manifest).toContain("ratatui")
    expect(manifest).toContain("crossterm")
    expect(entry).toContain("ratatui")
    expect(entry).toContain("crossterm")
    expect(entry).toContain("TUI_CORE_VERSION")
    expect(entry).toContain("/tui/manifest?platform=android")
    expect(entry).toContain("/tui/snapshot")
    expect(entry).toContain("hydrate_surface_snapshot")
    expect(entry).toContain("bootstrap_daemon")
    expect(entry).toContain("SLOPCODE_ENTRYPOINT")
    expect(entry).toContain("SLOPCODE_ANDROID_BOOTSTRAP_RUNNER")
    expect(entry).toContain("SLOPCODE_DAEMON_URL")
    expect(entry).toContain("SurfaceManifest")
    expect(entry).toContain("snapshot-backed")
    expect(entry).toContain("shared manifest commands")
    expect(entry).toContain("initial_surface_frame")
    expect(entry).toContain("surface_hydrated")
    expect(entry).toContain("home_footer_line")
    expect(entry).toContain("lines = initial_surface_frame(")
    expect(entry).toContain("locked.footer_workspace.as_deref()")
    expect(entry).toContain("session_id.is_none()")
    expect(entry).toContain('left.push(String::from("/status"))')
    expect(entry).toContain("height = body")
    expect(entry).toContain("locked.surface_frame = None;")
    expect(entry).toContain('locked.notice("closed last tab")')
    expect(entry).not.toContain("Rust-native Termux TUI")
    expect(entry).not.toContain("Fix a TODO in the codebase")
    expect(entry).not.toContain("Explain the current directory")
    expect(routes).toContain('"/manifest"')
    expect(routes).toContain('"/snapshot"')
    expect(routes).toContain('"/action"')
    expect(surface).toContain("TUI_SURFACE_VERSION")
    expect(surface).toContain("createSurfaceManifest")
    expect(surface).toContain("createSurfaceSnapshot")
    expect(entry).not.toContain('include!("../../android-host/main.rs")')
    expect(build).not.toContain("@oven/bun-linux")
    expect(build).not.toContain("native/android-client/main.rs")
    expect(build).not.toContain('"slopcode-termux"')
    expect(launcher).toContain("androidRuntimeArgs")
    expect(launcher).toContain("launcher.android.rust_tui")
    expect(launcher).toContain("SLOPCODE_ANDROID_BOOTSTRAP_RUNNER")
    expect(launcher).not.toContain("launcher.android.legacy_bundle")
    expect(launcher).not.toContain("args: [androidBundle, ...args]")
    expect(publish).toContain("Object.fromEntries(binaries.map")
    expect(publish).toContain("for (const binary of binaries)")
    expect(publish).not.toContain('binaries.filter((item) => !item.name.includes("-android-"))')
    expect(build).toContain("@slopcode-ai/slopcode-android-")
    expect(publish).toContain('"@oven/bun-linux-x64-android": "1.3.14"')
    expect(verify).toContain("packed Android ${target.arch} npm runtime")
    expect(verify).toContain("did not install the scoped Rust TUI runtime")
    expect(verify).not.toContain("SLOPCODE_ANDROID_ASSET_PATH: android")
    expect(verify).toContain('"@oven/bun-linux-x64-android": "1.3.14"')
    expect(e2e).toContain('"@oven/bun-linux-x64-android": "1.3.14"')
    expect(e2e).toContain('node "$(npm root -g)/slopcode/postinstall.mjs"')
    expect(e2e).not.toContain("SLOPCODE_ANDROID_ASSET_PATH=${tmp}/slopcode-android-runtime.tgz")
    expect(e2e).toContain("const rootVersion = JSON.parse")
    expect(workflow).toContain("pull_request:")
    expect(workflow).toContain("default: parity")
    expect(workflow).toContain("SLOPCODE_ANDROID_E2E_MODE: ${{ github.event.inputs.mode || 'parity' }}")
    expect(workflow).toContain("script/android-termux-e2e.ts")
    expect(workflow).toContain("script/verify-artifacts.ts")
    expect(workflow).toContain("run script/build.ts --target=android")
    expect(workflow).toContain("run script/verify-artifacts.ts --android-only")
    expect(workflow).not.toContain("run script/build.ts --target=android-x64")
    expect(workflow).not.toContain("run script/build.ts --target=android-arm64")
    expect(verify).toContain("must not include Bun runtime")
    expect(verify).toContain("must not include legacy Termux client")
    expect(verify).toContain("launcher did not route through the Rust TUI bootstrap")
    expect(verify).toContain("launcher did not expose Android bootstrap modules")
    expect(verify).toContain("SLOPCODE_VERIFY_ANDROID_ONLY")
    expect(build).toContain('targetFlag === "android"')
    expect(build).toContain("archiveAndroidTargets")
    expect(e2e).toContain('url.pathname === "/tui/manifest"')
    expect(e2e).toContain('url.pathname === "/tui/snapshot"')
    expect(e2e).toContain('"surface.contract"')
    expect(e2e).toContain("noSession: true")
    expect(e2e).toContain('run.seen.includes("POST /session")')
    expect(e2e).toContain("Rust-native Termux TUI")
    expect(e2e).toContain('core-android-x64')
    const nativeTest = await Bun.file(path.join(import.meta.dir, "android-native-client.test.ts")).text()
    expect(nativeTest).toContain("terminalFrame(stdout, width, height)")
    expect(nativeTest).toContain("expectedHomeFrame(width, height, root)")
    expect(nativeTest).toContain("expect(screen[23]).toBe(expected[23])")
    expect(thread).toContain('await import("./android-host")')
    expect(thread).not.toContain('await import("./portable")')
    expect(thread).not.toContain("SLOPCODE_TERMUX_LEGACY")
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

  test("Android slash commands are daemon-backed and Linux-aligned", async () => {
    const entry = await Bun.file(path.join(import.meta.dir, "..", "native", "android-tui", "src", "main.rs")).text()

    expect(entry).toContain("CommandSource::Prompt")
    expect(entry).toContain("load_daemon_commands")
    expect(entry).toContain('client.json("GET", "/command", None)')
    expect(entry).toContain('"/session/{session}/command"')
    expect(entry).toContain("submit_prompt_command")
    expect(entry).toContain("apply_linux_command_parity")
    expect(entry).toContain("let mut manifest = fallback_manifest()")
    expect(entry).toContain("manifest.upsert(SurfaceCommand")
    expect(entry).toContain("CtrlP")
    expect(entry).toContain("'\\u{10}' => out.push(InputAction::CtrlP)")
    expect(entry).toContain("InputAction::Command")
    expect(entry).toContain("leader: bool")
    expect(entry).toContain("'\\u{18}' if !self.paste => self.leader = true")
    expect(entry).toContain("'\\u{1a}' if !self.paste")
    expect(entry).toContain('command_input = Some(String::from("/commands"))')
    expect(entry).toContain('InputAction::Command(String::from("/files"))')
    expect(entry).toContain('InputAction::Command(String::from("/sessions"))')
    expect(entry).toContain('InputAction::Command(String::from("/models"))')
    expect(entry).toContain('InputAction::Command(String::from("/status"))')
    expect(entry).toContain('InputAction::Command(String::from("/suspend"))')
    expect(entry).toContain("cmd.starts_with(&prefix)")
    expect(entry).toContain("locked.input.set(input.to_string())")
    expect(entry).toContain('&["rename", "title"]')
    expect(entry).toContain('&["undo", "revert"]')
    expect(entry).toContain('&["redo", "unrevert"]')
    expect(entry).toContain('&["files", "explorer"]')
    expect(entry).toContain('&["session", "sessions", "resume", "continue"]')
    expect(entry).toContain('"resume-session"')
    expect(entry).not.toContain("match name {")
  })

  test("Android keeps the shared frame during interactive slash states", async () => {
    const entry = await Bun.file(path.join(import.meta.dir, "..", "native", "android-tui", "src", "main.rs")).text()

    expect(entry).toContain("render_surface_frame(frame, area, lines);")
    expect(entry).toContain("render_panel(frame, panel_area, panel)")
    expect(entry).toContain("render_prompt(frame, prompt_area, state)")
    expect(entry).not.toContain("if state.input.text.is_empty()\n        && state.panel.is_none()")
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
      "sessions.controls",
      "models.panel",
      "files.panel",
      "render.tools",
      "permissions.preview",
      "tabs.rich",
      "sidebar.files",
      "editor.diff",
      "terminal.polish",
      "native.rust-tui",
      "surface.contract",
      "render.parity-gates",
      "permissions.parity-gates",
    ])
    expect(report()).toEqual(snapshot)
    expect(parity.filter((item) => item.active).every((item) => item.android.length > 0)).toBe(true)
    expect(active("release").map((item) => item.id)).toEqual(["release.rust-tui-smoke"])
    expect(report().overclaims.map((item) => item.id)).toEqual(
      expect.arrayContaining(["home.landing", "commands.palette", "editor.diff", "terminal.polish"]),
    )
    expect(parity.find((item) => item.id === "native.rust-tui")?.level).toBe("workflow-parity")
    expect(parity.find((item) => item.id === "tabs.rich")?.level).toBe("workflow-parity")
    expect(report().totals.blocked).toBe(0)
    const e2e = e2eSource("slopcode-bin-android-x64")
    for (const item of parity.filter((item) => item.active)) {
      expect(e2e).toContain(`${JSON.stringify(item.id)}: async`)
    }
    expect(e2e).toContain("/se")
    expect(e2e).toContain("/shell-mode")
    expect(e2e).toContain("/resume-session")
    expect(e2e).toContain("\\x10")
    expect(e2e).toContain("\\x18f")
    expect(e2e).toContain("\\x18m")
    expect(e2e).toContain("\\x18s")
    expect(e2e).toContain("\\x1a")
    expect(e2e).toContain("partial slash submit did not keep command matches open")
    expect(e2e).toContain("expectedHomeFrame(width, height")
    expect(e2e).toContain("expectedHomeFrame(100, 30")
    expect(e2e).toContain("plain home row")
    expect(e2e).toContain("stale daemon home frame")
    expect(e2e).toContain("home row \" + row + \" diverged from canonical landing")
    expect(e2e).toContain("home leaked stale daemon frame")
    expect(ids).toEqual(
      expect.arrayContaining([
        "sessions.controls",
        "tabs.rich",
        "sidebar.files",
        "editor.diff",
        "terminal.polish",
        "native.rust-tui",
        "surface.contract",
        "release.rust-tui-smoke",
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
