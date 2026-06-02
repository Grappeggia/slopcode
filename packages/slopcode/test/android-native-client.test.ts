import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { createSurfaceFrame, type TuiSurfaceSnapshot } from "@/cli/cmd/tui/surface"

const root = path.join(import.meta.dir, "..")
const clean: string[] = []

setDefaultTimeout(60_000)

afterEach(async () => {
  await Promise.all(clean.splice(0).map((item) => fs.rm(item, { recursive: true, force: true })))
})

async function command(command: string) {
  const proc = Bun.spawn([command, "--version"], { stdout: "pipe", stderr: "pipe" })
  return (await proc.exited) === 0
}

async function macosSdkEnv() {
  if (process.platform !== "darwin" || process.env.SDKROOT) return {}
  const roots = ["/Library/Developer/CommandLineTools/SDKs", "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs"]
  for (const root of roots) {
    const entries = await fs.readdir(root).catch(() => [])
    const sdk = entries
      .filter((item) => item.startsWith("MacOSX") && item.endsWith(".sdk"))
      .sort()
      .at(-1)
    if (!sdk) continue
    return {
      DEVELOPER_DIR: root.includes("CommandLineTools")
        ? "/Library/Developer/CommandLineTools"
        : "/Applications/Xcode.app/Contents/Developer",
      SDKROOT: path.join(root, sdk),
    }
  }
  return {}
}

async function binary() {
  if (!(await command("cargo"))) return
  const target = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-android-tui-target-"))
  clean.push(target)
  const build = Bun.spawn(["cargo", "build", "--quiet", "--manifest-path", "native/android-tui/Cargo.toml"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...(await macosSdkEnv()), CARGO_TARGET_DIR: target },
  })
  const [code, stderr] = await Promise.all([build.exited, new Response(build.stderr).text()])
  if (code !== 0 && stderr.includes("Xcode license")) return
  expect(stderr).not.toContain("error:")
  expect(code).toBe(0)
  return path.join(target, "debug", process.platform === "win32" ? "slopcode-android-tui.exe" : "slopcode-android-tui")
}

async function run(bin: string, args: string[], env: Record<string, string> = {}) {
  const proc = Bun.spawn([bin, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  })
  return {
    code: await proc.exited,
    stdout: await new Response(proc.stdout).text(),
    stderr: await new Response(proc.stderr).text(),
  }
}

async function eventually(check: () => boolean | Promise<boolean>, timeout = 5_000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await check()) return
    await Bun.sleep(25)
  }
  throw new Error("timed out waiting for condition")
}

function json(value: unknown) {
  return Response.json(value)
}

const manifest = {
  version: 2,
  renderer: { linux: "opentui/solid", android: "ratatui/crossterm", frame: "shared/terminal-frame" },
  commands: [
    {
      id: "sidebar.files",
      title: "Files",
      category: "Workspace",
      slash: { name: "files", aliases: ["open"], usage: "/files" },
      keybind: "session_files",
      description: "Open workspace files",
    },
  ],
  keybinds: { session_files: "ctrl+x+f" },
  capabilities: { "android.runtime": true, "terminal.mouse": false },
}

const snapshot: TuiSurfaceSnapshot = {
  version: 2,
  sessionID: "ses_surface",
  title: "Parity Surface",
  status: "idle",
  header: { title: "Parity Surface" },
  footer: {
    directory: "/data/data/com.termux/files/home",
    workspaceID: "wrk_surface",
    lsp: 1,
    mcp: 2,
    mcpFailed: false,
    permissions: 0,
  },
  tabs: [{ id: "ses_surface", title: "Parity Surface", active: true, status: "idle" }],
  transcript: [
    {
      id: "msg_surface",
      role: "assistant",
      text: "snapshot hello",
      tools: [
        {
          tool: "bash",
          id: "tool_bash",
          status: "completed",
          preview: ["done"],
          diff: ["+ changed"],
          expandable: true,
        },
      ],
    },
  ],
  sidebar: { mode: "files", rows: ["src/app.ts"] },
}

describe("Android native TUI", () => {
  test("builds the current Rust runtime and reports the doctor contract", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const self = await run(bin, ["--self-test"])
    expect(self.code).toBe(0)
    expect(self.stderr).toBe("")
    expect(self.stdout).toContain("slopcode-android-tui ok")
    expect(self.stdout).toContain("slopcode-android-host ok")

    const version = await run(bin, ["--version"], { SLOPCODE_VERSION: "1.2.3" })
    expect(version.code).toBe(0)
    expect(version.stdout.trim()).toBe("1.2.3")

    const doctor = await run(bin, ["doctor", "android", "--json"], {
      SLOPCODE_ANDROID_HOST_PATH: bin,
      SLOPCODE_VERSION: "1.2.3",
      TERMUX_VERSION: "1",
    })
    expect(doctor.code).toBe(0)
    expect(JSON.parse(doctor.stdout)).toMatchObject({
      version: "1.2.3",
      termux: true,
      mode: "rust",
      strategy: "rust",
      renderer: "ratatui/crossterm",
      targetRenderer: "ratatui/crossterm",
      tuiCoreVersion: "rust-ratatui-1",
      sidecar: bin,
      sidecarExists: true,
      bun: null,
      ffiBlocked: false,
      mouse: false,
    })
  })

  test("hydrates shared manifest and snapshot before rendering", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const seen: string[] = []
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        if (url.pathname === "/tui/manifest") return json(manifest)
        if (url.pathname === "/command") return json([])
        if (url.pathname === "/tui/snapshot") return json(snapshot)
        if (url.pathname === "/tui/frame")
          return json(
            createSurfaceFrame({
              snapshot,
              width: Number(url.searchParams.get("width") ?? 100),
              height: Number(url.searchParams.get("height") ?? 30),
            }),
          )
        if (url.pathname === "/event") return new Response('data: {"type":"server.connected"}\n\n')
        return json({})
      },
    })
    try {
      const proc = Bun.spawn([bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test"], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, COLUMNS: "100", LINES: "30" },
      })
      await eventually(() => seen.includes("GET /tui/frame"))
      proc.stdin.write("\x04")
      proc.stdin.end()
      const [code, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      expect(stderr).toBe("")
      expect(code).toBe(0)
      expect(seen).toContain("GET /tui/manifest")
      expect(seen).toContain("GET /tui/snapshot")
      expect(seen).toContain("GET /tui/frame")
      expect(stdout).toContain("Parity")
      expect(stdout).toContain("Surface")
      expect(stdout).toContain("snapshot")
      expect(stdout).toContain("hello")
      expect(stdout).toContain("tool")
      expect(stdout).toContain("bash")
      expect(stdout).toContain("completed")
      expect(stdout).not.toContain("shared manifest fallback")
    } finally {
      server.stop(true)
    }
  })

  test("submits prompts against the snapshot-backed session", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const bodies: Array<{ messageID?: string; parts?: Array<{ id?: string; type?: string; text?: string }> }> = []
    const seen: string[] = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        if (url.pathname === "/tui/manifest") return json(manifest)
        if (url.pathname === "/tui/snapshot") return json(snapshot)
        if (url.pathname === "/tui/frame")
          return json(
            createSurfaceFrame({
              snapshot,
              width: Number(url.searchParams.get("width") ?? 100),
              height: Number(url.searchParams.get("height") ?? 30),
            }),
          )
        if (url.pathname === "/session/ses_surface/prompt_async" && req.method === "POST") {
          bodies.push(
            (await req.json()) as {
              messageID?: string
              parts?: Array<{ id?: string; type?: string; text?: string }>
            },
          )
          return new Response(null, { status: 204 })
        }
        if (url.pathname === "/event") return new Response('data: {"type":"server.connected"}\n\n')
        return json({})
      },
    })
    try {
      const proc = Bun.spawn([bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test"], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, COLUMNS: "100", LINES: "30" },
      })
      await eventually(() => seen.includes("GET /tui/frame"))
      proc.stdin.write("hello android\r")
      await Bun.sleep(150)
      proc.stdin.write("\x04")
      proc.stdin.end()
      const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
      expect(stderr).toBe("")
      expect(code).toBe(0)
      expect(seen).toContain("POST /session/ses_surface/prompt_async")
      expect(seen).not.toContain("POST /session")
      expect(bodies.length).toBe(1)
      expect(bodies[0]?.messageID?.startsWith("msg_")).toBe(true)
      expect(bodies[0]?.parts?.[0]?.id?.startsWith("prt_")).toBe(true)
      expect(bodies[0]?.parts?.[0]?.type).toBe("text")
      expect(bodies[0]?.parts?.[0]?.text).toBe("hello android")
    } finally {
      server.stop(true)
    }
  })

  test("routes daemon slash commands through the session command endpoint", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const commandBodies: Array<{ command?: string; arguments?: string; messageID?: string }> = []
    const seen: string[] = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        if (url.pathname === "/tui/manifest") return json(manifest)
        if (url.pathname === "/command")
          return json([
            { name: "init", description: "create/update AGENTS.md", source: "command", hints: [] },
            { name: "review", description: "review changes", source: "command", hints: [] },
          ])
        if (url.pathname === "/tui/snapshot") return json(snapshot)
        if (url.pathname === "/tui/frame")
          return json(
            createSurfaceFrame({
              snapshot,
              width: Number(url.searchParams.get("width") ?? 100),
              height: Number(url.searchParams.get("height") ?? 30),
            }),
          )
        if (url.pathname === "/session/ses_surface/command" && req.method === "POST") {
          commandBodies.push((await req.json()) as { command?: string; arguments?: string; messageID?: string })
          return json({
            info: { id: "msg_result", sessionID: "ses_surface", role: "assistant" },
            parts: [],
          })
        }
        if (url.pathname === "/event") return new Response('data: {"type":"server.connected"}\n\n')
        return json({})
      },
    })
    try {
      const proc = Bun.spawn([bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test"], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, COLUMNS: "100", LINES: "30" },
      })
      await eventually(() => seen.includes("GET /tui/frame") && seen.includes("GET /command"))
      proc.stdin.write("/init android parity\r")
      await Bun.sleep(150)
      proc.stdin.write("\x04")
      proc.stdin.end()
      const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
      expect(stderr).toBe("")
      expect(code).toBe(0)
      expect(seen).toContain("GET /command")
      expect(seen).toContain("POST /session/ses_surface/command")
      expect(seen).not.toContain("POST /session/ses_surface/prompt_async")
      expect(commandBodies).toHaveLength(1)
      expect(commandBodies[0]?.command).toBe("init")
      expect(commandBodies[0]?.arguments).toBe("android parity")
      expect(commandBodies[0]?.messageID?.startsWith("msg_")).toBe(true)
    } finally {
      server.stop(true)
    }
  })

  test("emits opt-in startup telemetry with first frame before hydration", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === "/tui/manifest") return json(manifest)
        if (url.pathname === "/tui/snapshot") {
          await Bun.sleep(150)
          return json(snapshot)
        }
        if (url.pathname === "/tui/frame")
          return json(
            createSurfaceFrame({
              snapshot,
              width: Number(url.searchParams.get("width") ?? 100),
              height: Number(url.searchParams.get("height") ?? 30),
            }),
          )
        if (url.pathname === "/event") return new Response('data: {"type":"server.connected"}\n\n')
        return json({})
      },
    })
    try {
      const proc = Bun.spawn([bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test"], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, COLUMNS: "100", LINES: "30", SLOPCODE_ANDROID_STARTUP_LOG: "1" },
      })
      await Bun.sleep(75)
      proc.stdin.write("\x04")
      proc.stdin.end()
      const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
      expect(code).toBe(0)
      const events = stderr
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { event: string; phase: string; ms: number; hydrated?: boolean })
      expect(events.map((item) => item.phase)).toContain("rust.start")
      const first = events.find((item) => item.phase === "first_frame")
      const snapshotDone = events.find((item) => item.phase === "snapshot.done")
      expect(first?.event).toBe("android.startup")
      expect(first?.hydrated).toBe(false)
      expect(snapshotDone ? first!.ms < snapshotDone.ms : true).toBe(true)
    } finally {
      server.stop(true)
    }
  })
})
