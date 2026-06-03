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
    expect(entry).not.toContain("session_id.is_none()")
    expect(entry).toContain("locked.surface_frame = Some(lines);")
    expect(entry).toContain('left.push(String::from("/status"))')
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
    expect(publish).toContain("Object.fromEntries(npmBinaries.map")
    expect(publish).toContain("for (const binary of npmBinaries)")
    expect(publish).not.toContain('binaries.filter((item) => !item.name.includes("-android-"))')
    expect(build).toContain("slopcode-bin-android-")
    expect(publish).toContain('"android-runtime"')
    expect(publish).toContain('"@oven/bun-linux-x64-android": "1.3.14"')
    expect(verify).toContain("did not embed the Rust TUI runtime")
    expect(verify).toContain("must not depend on unpublished runtime npm packages")
    expect(verify).not.toContain("SLOPCODE_ANDROID_ASSET_PATH: android")
    expect(verify).toContain('"@oven/bun-linux-x64-android": "1.3.14"')
    expect(e2e).toContain('"@oven/bun-linux-x64-android": "1.3.14"')
    expect(e2e).toContain('node "$(npm root -g)/slopcode/postinstall.mjs"')
    expect(e2e).toContain('"android-runtime"')
    expect(e2e).toContain('path.join(root, "slopcode", "android-runtime"')
    expect(e2e).not.toContain("slopcode-android-runtime.tgz")
    expect(e2e).not.toContain("[androidJson.name]")
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
    expect(e2e).toContain("core-android-x64")
    const nativeTest = await Bun.file(path.join(import.meta.dir, "android-native-client.test.ts")).text()
    expect(nativeTest).toContain("terminalFrame(stdout, width, height)")
    expect(nativeTest).toContain("shared daemon footer")
    expect(nativeTest).toContain('expect(screen[23]).toBe(fitLine(root + " | shared daemon footer", width))')
    expect(nativeTest).toContain(
      "drives advanced composer stash, autocomplete, paste, shell mode, and queue through Android native routes",
    )
    expect(nativeTest).toContain("POST /session/ses_surface/shell")
    expect(nativeTest).toContain('expect(bodies[0]?.parts?.[0]?.text).toBe("draft paste\\nblock")')
    expect(nativeTest).toContain("CommandMatches")
    expect(nativeTest).toContain("queueempty")
    expect(nativeTest).toContain("renders Android fallback tool cards with code clipping and diff previews")
    expect(nativeTest).toContain("frame unavailable")
    expect(nativeTest).toContain("10morecodeline(s)")
    expect(nativeTest).toContain("|diff+new")
    expect(nativeTest).toContain("drives Linux-aligned command panels through Android native handlers")
    expect(nativeTest).toContain("/models-completion openai/gpt-5")
    expect(nativeTest).toContain("GET /pty/shells")
    expect(nativeTest).toContain("POST /global/dispose")
    expect(nativeTest).toContain("Variantfast")
    expect(nativeTest).toContain("/sample-skill")
    expect(nativeTest).toContain("sends the selected provider model with prompt submissions")
    expect(nativeTest).toContain("/model openai/gpt-5")
    expect(nativeTest).toContain('modelID: "gpt-5"')
    expect(nativeTest).toContain("routes session panels and controls through Android native command handlers")
    expect(nativeTest).toContain("POST /session/ses_surface/summarize")
    expect(nativeTest).toContain("GET /tui/snapshot?sessionID=ses_fork")
    expect(nativeTest).toContain("switches and closes session tabs through Android native tab commands")
    expect(nativeTest).toContain("GET /session?roots=true&limit=20")
    expect(nativeTest).toContain("GET /tui/snapshot?sessionID=ses_other")
    expect(nativeTest).toContain("[tab:/sessionses_other]")
    expect(nativeTest).toContain("[close:/close]")
    expect(nativeTest).toContain("renders rich chat and editor tab rows with active and dirty markers")
    expect(nativeTest).toContain("Editorsrc/app.ts")
    expect(nativeTest).toContain("[tab:/opensrc/other.ts]")
    expect(nativeTest).toContain("[close:/close-editor]")
    expect(nativeTest).toContain("drives terminal polish panels and title updates through Android native handlers")
    expect(nativeTest).toContain("/themes dracula")
    expect(nativeTest).toContain("PATCH /session/ses_surface")
    expect(nativeTest).toContain("ctrl+x+t/themesThemes")
    expect(nativeTest).toContain("rendererratatui/crossterm")
    expect(nativeTest).toContain("termuxclipboard")
    expect(nativeTest).toContain("renders modified and workspace file panels through Android native routes")
    expect(nativeTest).toContain("GET /file?path=app")
    expect(nativeTest).toContain("Sidebar\\w*Files")
    expect(nativeTest).toContain("GET /file/content?path=src/app.ts")
    expect(nativeTest).toContain("POST /session/ses_surface/prompt_async")
    expect(nativeTest).toContain('["file", "text"]')
    expect(nativeTest).toContain("renders canonical no-session landing and lazily creates the first session")
    expect(nativeTest).toContain("hello from home")
    expect(nativeTest).toContain("GET /tui/snapshot?sessionID=ses_home")
    expect(nativeTest).toContain(
      "drives editor open, dirty guard, diagnostics, save, and diff dismissal through Android native routes",
    )
    expect(nativeTest).toContain("GET /session/ses_surface/diff/index")
    expect(nativeTest).toContain("POST /editor/edt_surface/diff/dismiss")
    expect(nativeTest).toContain("server.upgrade(req)")
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
    expect(entry).toContain("LineHome")
    expect(entry).toContain("LineEnd")
    expect(entry).toContain("WordForward")
    expect(entry).toContain("WordBackward")
    expect(entry).toContain("DeleteWordForward")
    expect(entry).toContain("'\\u{1}' => out.push(InputAction::LineHome)")
    expect(entry).toContain("'\\u{2}' => out.push(InputAction::Left)")
    expect(entry).toContain("'\\u{5}' => out.push(InputAction::LineEnd)")
    expect(entry).toContain("'\\u{6}' => out.push(InputAction::Right)")
    expect(entry).toContain("'\\n' if !self.paste => out.push(InputAction::Newline)")
    expect(entry).toContain("locked.input.word_forward()")
    expect(entry).toContain("locked.input.word_backward()")
    expect(entry).toContain("locked.input.delete_word_after()")
    expect(entry).toContain("locked.input.kill_to_line_start()")
    expect(entry).toContain("locked.input.kill_to_line_end()")
    expect(entry).toContain("locked.input.delete();")
    expect(entry).toContain("selected: usize")
    expect(entry).toContain("editing: bool")
    expect(entry).toContain("question_pick_index")
    expect(entry).toContain("question_commit_custom")
    expect(entry).toContain("question_reject(&mut locked)")
    expect(entry).toContain('"/question/{id}/reply?sessionID={}"')
    expect(entry).toContain('"/question/{id}/reject?sessionID={}"')
    expect(entry).toContain('title("Question Dialog")')
    expect(entry).toContain("Enter submit | Tab switch | Esc reject")
    expect(entry).toContain("selected: bool")
    expect(entry).toContain("kind: Option<String>")
    expect(entry).toContain("permission_reply_targets")
    expect(entry).toContain("permission_toggle_focused")
    expect(entry).toContain("permission_move_focus")
    expect(entry).toContain('body["message"]')
    expect(entry).toContain('title("Permission required")')
    expect(entry).toContain("Space toggles selection")
    expect(entry).toContain("planned for build")
    expect(entry).toContain('kind.as_deref() == Some("forecast")')
    expect(entry).toContain("render_tool_cards")
    expect(entry).toContain("+-- {row}")
    expect(entry).toContain("| output {output}")
    expect(entry).toContain("| diff {diff}")
    expect(entry).toContain("InputAction::Command")
    expect(entry).toContain("struct CommandPalette")
    expect(entry).toContain("command_palette: Option<CommandPalette>")
    expect(entry).toContain("render_command_palette")
    expect(entry).toContain("leader: bool")
    expect(entry).toContain("'\\u{18}' if !self.paste => self.leader = true")
    expect(entry).toContain("'\\u{1a}' if !self.paste")
    expect(entry).toContain("open_palette = true")
    expect(entry).toContain("locked.command_palette()")
    expect(entry).toContain("InputAction::Up | InputAction::CtrlP")
    expect(entry).toContain("InputAction::Down | InputAction::CtrlN")
    expect(entry).toContain('format!("filter: {}", palette.query)')
    expect(entry).toContain('InputAction::Command(String::from("/files"))')
    expect(entry).toContain('InputAction::Command(String::from("/sessions"))')
    expect(entry).toContain('InputAction::Command(String::from("/models"))')
    expect(entry).toContain('InputAction::Command(String::from("/status"))')
    expect(entry).toContain('InputAction::Command(String::from("/suspend"))')
    expect(entry).toContain('InputAction::Command(String::from("/timeline"))')
    expect(entry).toContain('InputAction::Command(String::from("/compact"))')
    expect(entry).toContain('"session.children"')
    expect(entry).toContain('"session.timeline"')
    expect(entry).toContain('"session.status" | "slopcode.status"')
    expect(entry).toContain('"session.share" => session_action(client, state, "share", "POST")')
    expect(entry).toContain('"session.unshare" => session_action(client, state, "share", "DELETE")')
    expect(entry).toContain('"session.pause" => session_action(client, state, "pause", "POST")')
    expect(entry).toContain('"session.resume" => session_action(client, state, "resume", "POST")')
    expect(entry).toContain('"session.interrupt" => session_action(client, state, "abort", "POST")')
    expect(entry).toContain('"session.fork" =>')
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
      "commands.linux-parity",
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
    expect(report().overclaims.map((item) => item.id)).toEqual([])
    expect(report().overclaims.map((item) => item.id)).not.toContain("home.landing")
    expect(report().overclaims.map((item) => item.id)).not.toContain("composer.advanced")
    expect(report().overclaims.map((item) => item.id)).not.toContain("composer.editing")
    expect(report().overclaims.map((item) => item.id)).not.toContain("dialogs.question")
    expect(report().overclaims.map((item) => item.id)).not.toContain("commands.palette")
    expect(report().overclaims.map((item) => item.id)).not.toContain("commands.linux-parity")
    expect(report().overclaims.map((item) => item.id)).not.toContain("permissions.preview")
    expect(report().overclaims.map((item) => item.id)).not.toContain("render.tools")
    expect(report().overclaims.map((item) => item.id)).not.toContain("permissions.parity-gates")
    expect(report().overclaims.map((item) => item.id)).not.toContain("models.panel")
    expect(report().overclaims.map((item) => item.id)).not.toContain("sessions.tabs")
    expect(report().overclaims.map((item) => item.id)).not.toContain("sessions.routes")
    expect(report().overclaims.map((item) => item.id)).not.toContain("sessions.controls")
    expect(report().overclaims.map((item) => item.id)).not.toContain("files.panel")
    expect(report().overclaims.map((item) => item.id)).not.toContain("sidebar.files")
    expect(report().overclaims.map((item) => item.id)).not.toContain("editor.diff")
    expect(report().overclaims.map((item) => item.id)).not.toContain("native.rust-tui")
    expect(report().overclaims.map((item) => item.id)).not.toContain("render.parity-gates")
    expect(report().overclaims.map((item) => item.id)).not.toContain("tabs.rich")
    expect(report().overclaims.map((item) => item.id)).not.toContain("terminal.polish")
    expect(parity.find((item) => item.id === "composer.editing")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "composer.advanced")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "dialogs.question")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "commands.palette")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "commands.linux-parity")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "permissions.preview")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "render.tools")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "permissions.parity-gates")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "models.panel")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "sessions.tabs")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "sessions.routes")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "sessions.controls")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "files.panel")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "home.landing")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "sidebar.files")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "editor.diff")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "native.rust-tui")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "render.parity-gates")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "tabs.rich")?.level).toBe("true-parity")
    expect(parity.find((item) => item.id === "terminal.polish")?.level).toBe("true-parity")
    expect(report().totals.blocked).toBe(0)
    const e2e = e2eSource("x64")
    for (const item of parity.filter((item) => item.active)) {
      expect(e2e).toContain(`${JSON.stringify(item.id)}: async`)
    }
    expect(e2e).toContain("/se")
    expect(e2e).toContain("/shell-mode")
    expect(e2e).toContain("/resume-session")
    expect(e2e).toContain("\\x10")
    expect(e2e).toContain("\\x01START")
    expect(e2e).toContain("\\x05 END")
    expect(e2e).toContain("\\x1bf!")
    expect(e2e).toContain("\\x1bdomega")
    expect(e2e).toContain("START alpha beta gamma EN!D?")
    expect(e2e).toContain("alpha! beta omega")
    expect(e2e).toContain("/model openai/gpt-5")
    expect(e2e).toContain("missing selected model")
    expect(e2e).toContain("missing children route")
    expect(e2e).toContain("missing timeline/history routes")
    expect(e2e).toContain("missing revert route")
    expect(e2e).toContain("missing share route")
    expect(e2e).toContain("missing compact route")
    expect(e2e).toContain("compact did not send selected model")
    expect(e2e).toContain("/files app")
    expect(e2e).toContain("missing file row")
    expect(e2e).toContain("missing modified files")
    expect(e2e).toContain("missing overlay sidebar")
    expect(e2e).toContain("missing open files")
    expect(e2e).toContain("missing attached file part")
    expect(e2e).toContain("missing sidebar frame")
    expect(e2e).toContain("missing editor open")
    expect(e2e).toContain("missing editor input websocket")
    expect(e2e).toContain("missing editor snapshot")
    expect(e2e).toContain("missing editor save")
    expect(e2e).toContain("missing diff dismiss")
    expect(e2e).toContain("missing editor key input")
    expect(e2e).toContain("Question Dialog")
    expect(e2e).toContain("Question Multi")
    expect(e2e).toContain('CLI", "Termux')
    expect(e2e).toContain("Question Reject")
    expect(e2e).toContain("rejected.rejects")
    expect(e2e).toContain("perm_edit")
    expect(e2e).toContain("perm_bash")
    expect(e2e).toContain("Permission required")
    expect(e2e).toContain('message: "needs context"')
    expect(e2e).toContain("+-- tool edit completed")
    expect(e2e).toContain("| output patched")
    expect(e2e).toContain("| diff +next")
    expect(e2e).toContain("perm_block")
    expect(e2e).toContain("perm_plan")
    expect(e2e).toContain("1 need approval now - 1 planned for build")
    expect(e2e).toContain("source build plan")
    expect(e2e).toContain("filter: commands")
    expect(e2e).toContain("filter: keybinds")
    expect(e2e).toContain("\\x18f")
    expect(e2e).toContain("\\x18m")
    expect(e2e).toContain("\\x18s")
    expect(e2e).toContain("\\x1a")
    expect(e2e).toContain("partial slash submit did not keep command matches open")
    expect(e2e).toContain("expectedHomeFrame(width, height")
    expect(e2e).toContain("expectedHomeFrame(100, 30")
    expect(e2e).toContain("plain home row")
    expect(e2e).toContain('home row " + row + " diverged from canonical landing')
    expect(e2e).toContain("home diverged from shared landing frame")
    expect(e2e).toContain("home prompt did not lazily create a session")
    expect(e2e).toContain("home prompt did not submit")
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
    await Bun.write(file, e2eSource("x64"))
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
