import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { createSurfaceFrame, type TuiSurfaceSnapshot } from "@/cli/cmd/tui/surface"
import stripAnsi from "strip-ansi"
import { frame as terminalFrame } from "./cli/tui/editor-e2e"

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
  const roots = [
    "/Library/Developer/CommandLineTools/SDKs",
    "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs",
  ]
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

function fitLine(text: string, width: number) {
  const chars = Array.from(text)
  if (chars.length > width) return chars.slice(0, width).join("")
  return text + " ".repeat(width - chars.length)
}

function centerLine(text: string, width: number) {
  const left = Math.floor((width - Array.from(text).length) / 2)
  return fitLine(" ".repeat(Math.max(0, left)) + text, width)
}

function homeFooterLine(width: number, directory: string, mcp: number, failed = false, version = "9.9.9") {
  const left = [directory, mcp > 0 || failed ? `${mcp} MCP${failed ? "!" : ""}` : undefined, mcp > 0 || failed ? "/status" : undefined]
    .filter(Boolean)
    .join(" | ")
  if (!left) return fitLine(version, width)
  if (Array.from(left).length + 1 + Array.from(version).length >= width) return fitLine(`${left} | ${version}`, width)
  return fitLine(left + " ".repeat(width - Array.from(left).length - Array.from(version).length) + version, width)
}

function expectedHomeFrame(width: number, height: number, directory: string) {
  const lines = Array.from({ length: height }, () => " ".repeat(width))
  const logo = [
    "                                  ",
    "█▀▀ █   █▀█ █▀█  █▀▀ █▀█ █▀▄ █▀▀",
    "▀▀█ █   █ █ █▀▀  █   █ █ █ █ █▀▀",
    "▀▀▀ ▀▀▀ ▀▀▀ ▀    ▀▀▀ ▀▀▀ ▀▀  ▀▀▀",
  ]
  const logoStart = Math.max(1, Math.floor((height - 8) / 2))
  for (let index = 0; index < logo.length; index++) {
    const row = logoStart + index
    if (row >= lines.length) break
    lines[row] = centerLine(logo[index]!, width)
  }
  const promptWidth = Math.min(width, 75)
  const promptLeft = Math.floor((width - promptWidth) / 2)
  const promptY = Math.min(lines.length - 2, logoStart + logo.length + 2)
  lines[promptY] = fitLine(" ".repeat(promptLeft) + fitLine("> ", promptWidth), width)
  lines[height - 1] = homeFooterLine(width, directory, 1)
  return lines
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

  test("bootstraps the daemon from Rust when launched without a preconnected URL", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-android-bootstrap-"))
    clean.push(dir)
    const marker = path.join(dir, "seen.json")
    const entrypoint = path.join(dir, "daemon.js")
    await Bun.write(
      entrypoint,
      `
const args = process.argv.slice(2)
const seen = []
function option(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}
function fitLine(text, width) {
  const raw = String(text ?? "")
  if (raw.length >= width) return raw.slice(0, width)
  return raw + " ".repeat(width - raw.length)
}
async function mark(item) {
  seen.push(item)
  if (process.env.SLOPCODE_BOOTSTRAP_MARKER) {
    await Bun.write(process.env.SLOPCODE_BOOTSTRAP_MARKER, JSON.stringify(seen))
  }
}
if (args[0] !== "daemon" || args[1] !== "run") {
  throw new Error("unexpected bootstrap args " + JSON.stringify(args))
}
const port = Number(option("--port"))
const directory = option("--directory") || process.cwd()
const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(req) {
    const url = new URL(req.url)
    await mark(req.method + " " + url.pathname)
    if (url.pathname === "/daemon/status") return Response.json({ ok: true, directory })
    if (url.pathname === "/tui/manifest") return Response.json({
      version: 2,
      renderer: { linux: "opentui/solid", android: "ratatui/crossterm", frame: "shared/terminal-frame" },
      commands: [],
      keybinds: {},
      capabilities: { "android.runtime": true },
    })
    if (url.pathname === "/command") return Response.json([])
    if (url.pathname === "/tui/snapshot") return Response.json({
      version: 2,
      title: "Bootstrap Surface",
      status: "idle",
      header: { title: "Bootstrap Surface" },
      footer: { directory, workspaceID: undefined, lsp: 0, mcp: 1, mcpFailed: false, permissions: 0 },
      tabs: [],
      transcript: [],
      sidebar: { mode: "files", rows: [] },
    })
    if (url.pathname === "/tui/frame") {
      const width = Math.max(20, Math.min(120, Number(url.searchParams.get("width") || 80)))
      const height = Math.max(8, Math.min(60, Number(url.searchParams.get("height") || 24)))
      const lines = Array.from({ length: height }, () => fitLine("", width))
      lines[2] = fitLine("Bootstrap Surface", width)
      lines[3] = fitLine("Rust daemon bootstrap ready", width)
      lines[height - 1] = fitLine(directory + " | stale bundle footer", width)
      return Response.json({
        version: 2,
        renderer: "shared/terminal-frame",
        width,
        height,
        title: "Bootstrap Surface",
        status: "idle",
        lines,
        rows: lines.map((line, y) => ({ y, spans: [{ x: 0, text: line }] })),
      })
    }
    if (url.pathname === "/event") return new Response('data: {"type":"server.connected"}\\n\\n')
    return Response.json({})
  },
})
setTimeout(() => {
  server.stop(true)
  process.exit(0)
}, 12_000)
`,
    )

    const width = 90
    const height = 24
    const proc = Bun.spawn([bin], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        COLUMNS: String(width),
        LINES: String(height),
        SLOPCODE_ENTRYPOINT: entrypoint,
        SLOPCODE_ANDROID_BOOTSTRAP_RUNNER: process.execPath,
        SLOPCODE_BOOTSTRAP_MARKER: marker,
        SLOPCODE_VERSION: "9.9.9",
      },
    })
    await eventually(async () => {
      if (!(await Bun.file(marker).exists())) return false
      const seen = await Bun.file(marker)
        .json()
        .catch(() => undefined as string[] | undefined)
      if (!seen) return false
      return seen.includes("GET /daemon/status") && seen.includes("GET /tui/frame")
    }, 10_000)
    await Bun.sleep(250)
    proc.stdin.write("\x04")
    proc.stdin.end()
    const [code, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    expect(code).toBe(0)
    expect(stderr).toBe("")
    const screen = terminalFrame(stdout, width, height)
    const expected = expectedHomeFrame(width, height, root)
    expect(screen[8]).toBe(expected[8])
    expect(screen[9]).toBe(expected[9])
    expect(screen[10]).toBe(expected[10])
    expect(screen[11]).toBe(expected[11])
    expect(screen[13]).toBe(expected[13])
    expect(screen[23]).toBe(expected[23])
    const text = stripAnsi(stdout)
    const normalized = text.replace(/\s+/g, "")
    expect(text).toContain("█▀▀")
    expect(normalized).not.toContain("BootstrapSurface")
    expect(normalized).not.toContain("Rustdaemonbootstrapready")
    expect(normalized).not.toContain("stalebundlefooter")
    expect(text).toContain("9.9.9")
    expect(normalized).toContain("1MCP|/status")
    expect(text).not.toContain("missing --url")
    const seen = (await Bun.file(marker).json()) as string[]
    expect(seen).toContain("GET /daemon/status")
    expect(seen).toContain("GET /tui/manifest")
    expect(seen).toContain("GET /tui/snapshot")
    expect(seen).toContain("GET /tui/frame")
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
      await Bun.sleep(300)
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

  test("keeps partial slash command matches open instead of dispatching raw text", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const seen: string[] = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
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
      await eventually(() => seen.includes("GET /tui/frame") && seen.includes("GET /command"))
      proc.stdin.write("/se\r")
      await Bun.sleep(200)
      proc.stdin.write("\x04")
      proc.stdin.end()
      const [code, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      expect(stderr).toBe("")
      expect(code).toBe(0)
      const normalized = stripAnsi(stdout).replace(/\s+/g, "")
      expect(normalized).toContain("CommandMatches")
      expect(normalized).toContain("/session")
      expect(normalized).toContain("/se")
      expect(seen).not.toContain("POST /session/ses_surface/command")
      expect(seen).not.toContain("POST /session/ses_surface/prompt_async")
    } finally {
      server.stop(true)
    }
  })

  test("opens the command palette with the Linux Ctrl-P keybind", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const seen: string[] = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
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
      await eventually(() => seen.includes("GET /tui/frame") && seen.includes("GET /command"))
      proc.stdin.write("\x10")
      await Bun.sleep(200)
      proc.stdin.write("\x04")
      proc.stdin.end()
      const [code, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      expect(stderr).toBe("")
      expect(code).toBe(0)
      expect(stdout).toContain("Command")
      expect(stdout).toContain("Palette")
      expect(stdout).toContain("/files")
      expect(stdout).toContain("/help")
      expect(seen).not.toContain("POST /session/ses_surface/command")
      expect(seen).not.toContain("POST /session/ses_surface/prompt_async")
    } finally {
      server.stop(true)
    }
  })

  test("runs common Linux leader keybinds through Android command handlers", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const cases = [
      {
        keys: "\x18f",
        endpoint: "GET /file",
        tokens: ["Open", "Files", "src/app.ts"],
      },
      {
        keys: "\x18l",
        endpoint: "GET /session",
        tokens: ["Sessions", "Session One"],
      },
      {
        keys: "\x18m",
        endpoint: "GET /v2/model",
        tokens: ["Models", "openai", "gpt-4.1"],
      },
      {
        keys: "\x18s",
        endpoint: "GET /session/status",
        tokens: ["Status", "ready"],
      },
      {
        keys: "\x1a",
        endpoint: undefined,
        tokens: ["Suspend", "Android app switching"],
      },
    ] as const

    for (const item of cases) {
      const seen: string[] = []
      const server = Bun.serve({
        port: 0,
        async fetch(req) {
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
          if (url.pathname === "/file")
            return json([{ path: "src/app.ts", name: "app.ts", type: "file" }])
          if (url.pathname === "/session" && req.method === "GET")
            return json([{ id: "ses_surface", title: "Session One" }])
          if (url.pathname === "/v2/model")
            return json([{ providerID: "openai", id: "gpt-4.1", name: "GPT 4.1" }])
          if (url.pathname === "/session/status") return json({ health: "ready" })
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
        proc.stdin.write(item.keys)
        await Bun.sleep(250)
        proc.stdin.write("\x04")
        proc.stdin.end()
        const [code, stdout, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ])
        expect(stderr).toBe("")
        expect(code).toBe(0)
        const normalized = stripAnsi(stdout).replace(/\s+/g, "")
        for (const token of item.tokens) {
          expect(normalized).toContain(token.replace(/\s+/g, ""))
        }
        if (item.endpoint) expect(seen).toContain(item.endpoint)
        expect(seen).not.toContain("POST /session/ses_surface/command")
        expect(seen).not.toContain("POST /session/ses_surface/prompt_async")
      } finally {
        server.stop(true)
      }
    }
  })

  test("shows last-tab close notice on the Android home frame", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const seen: string[] = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
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
      const width = 100
      const height = 30
      const proc = Bun.spawn([bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test"], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, COLUMNS: String(width), LINES: String(height) },
      })
      await eventually(() => seen.includes("GET /tui/frame") && seen.includes("GET /command"))
      proc.stdin.write("/close\r")
      await Bun.sleep(250)
      proc.stdin.write("\x04")
      proc.stdin.end()
      const [code, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      expect(stderr).toBe("")
      expect(code).toBe(0)
      const screen = terminalFrame(stdout, width, height).join("\n")
      expect(screen).toContain("closed last tab")
      expect(screen).toContain("█▀▀")
      expect(screen).not.toContain("Parity Surface")
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
      const [code, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      expect(code).toBe(0)
      const text = stripAnsi(stdout)
      expect(text).toContain("█▀▀")
      expect(text).toContain("dev")
      expect(text).not.toContain("/help")
      expect(text).not.toContain("Rust-native Termux TUI")
      expect(text).not.toContain("Fix a TODO in the codebase")
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
