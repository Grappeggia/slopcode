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

function homeFooterLine(
  width: number,
  directory: string,
  version = "9.9.9",
  mcp = 1,
  failed = false,
  workspace?: string,
) {
  const left = [
    directory,
    workspace ? `workspace ${workspace}` : undefined,
    mcp > 0 || failed ? `${mcp} MCP${failed ? "!" : ""}` : undefined,
    mcp > 0 || failed ? "/status" : undefined,
  ]
    .filter(Boolean)
    .join(" | ")
  if (!left) return fitLine(version, width)
  if (Array.from(left).length + 1 + Array.from(version).length >= width) return fitLine(`${left} | ${version}`, width)
  return fitLine(left + " ".repeat(width - Array.from(left).length - Array.from(version).length) + version, width)
}

function expectedHomeFrame(width: number, height: number, directory: string, version = "9.9.9", workspace?: string) {
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
  lines[height - 1] = homeFooterLine(width, directory, version, 1, false, workspace)
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
      lines[height - 1] = fitLine(directory + " | shared daemon footer", width)
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
    expect(screen[2]).toBe(fitLine("Bootstrap Surface", width))
    expect(screen[3]).toBe(fitLine("Rust daemon bootstrap ready", width))
    expect(screen[23]).toBe(fitLine(root + " | shared daemon footer", width))
    const text = stripAnsi(stdout)
    const normalized = text.replace(/\s+/g, "")
    expect(normalized).toContain("BootstrapSurface")
    expect(normalized).toContain("Rustdaemonbootstrapready")
    expect(normalized).toContain("shareddaemonfooter")
    expect(text).not.toContain("█▀▀")
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

  test("renders Android fallback tool cards with code clipping and diff previews", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const codeBlock =
      "```ts\n" + Array.from({ length: 20 }, (_, index) => `const item${index} = true`).join("\n") + "\n```"
    const renderSnapshot: TuiSurfaceSnapshot = {
      ...snapshot,
      title: "Render Gate",
      header: { title: "Render Gate" },
      tabs: [{ id: "ses_surface", title: "Render Gate", active: true, status: "idle" }],
      transcript: [
        {
          id: "msg_gate",
          role: "assistant",
          text: codeBlock,
          tools: [
            {
              id: "tool_gate",
              tool: "edit",
              status: "completed",
              preview: Array.from({ length: 10 }, (_, index) => `line ${index}`),
              diff: [
                "--- a/src/app.ts",
                "+++ b/src/app.ts",
                "@@ -1 +1 @@",
                "-old",
                "+new",
                "+next",
                "+again",
                "+extra",
                "+more",
                "+tail",
                "+tail2",
                "+tail3",
                "+tail4",
                "+tail5",
              ],
              expandable: true,
            },
          ],
        },
      ],
      sidebar: { mode: "summary", rows: [] },
    }
    const seen: string[] = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        if (url.pathname === "/tui/manifest") return json(manifest)
        if (url.pathname === "/command") return json([])
        if (url.pathname === "/tui/snapshot") return json(renderSnapshot)
        if (url.pathname === "/tui/frame") return new Response("frame unavailable", { status: 503 })
        if (url.pathname === "/event") return new Response('data: {"type":"server.connected"}\n\n')
        return json({})
      },
    })
    try {
      const proc = Bun.spawn(
        [bin, "--url", `http://127.0.0.1:${server.port}`, "--token", "test", "--session", "ses_surface"],
        {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
          env: { ...process.env, COLUMNS: "120", LINES: "60" },
        },
      )
      await eventually(() => seen.includes("GET /tui/snapshot") && seen.includes("GET /tui/frame"))
      await Bun.sleep(1_000)
      proc.stdin.write("\x04")
      proc.stdin.end()
      const [code, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      expect(stderr).toBe("")
      expect(code).toBe(0)
      expect(seen).toContain("GET /tui/snapshot")
      expect(seen).toContain("GET /tui/frame")
      const normalized = terminalFrame(stdout, 120, 60).join("\n").replace(/\s+/g, "")
      expect(normalized).toContain("RenderGate")
      expect(normalized).toContain("Assistant:```ts")
      expect(normalized).toContain("10morecodeline(s)")
      expect(normalized).toContain("+--tooleditcompleted[expanded]")
      expect(normalized).toContain("|outputline0")
      expect(normalized).toContain("|moreline(s)")
      expect(normalized).toContain("|diffpreview")
      expect(normalized).toContain("|diff+new")
    } finally {
      server.stop(true)
    }
  })

  test("renders canonical no-session landing and lazily creates the first session", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const width = 100
    const height = 30
    const directory = "/data/data/com.termux/files/home"
    const version = "9.9.9"
    const workspaceID = "wrk_surface"
    const expected = expectedHomeFrame(width, height, directory, version, workspaceID)
    const homeSnapshot: TuiSurfaceSnapshot = {
      ...snapshot,
      sessionID: undefined,
      title: "Home Landing",
      status: "idle",
      header: { title: "Home Landing" },
      footer: {
        directory,
        version,
        workspaceID,
        lsp: 0,
        mcp: 1,
        mcpFailed: false,
        permissions: 0,
      },
      tabs: [],
      transcript: [],
      sidebar: { mode: "summary", rows: [] },
    }
    const homeSessionSnapshot: TuiSurfaceSnapshot = {
      ...snapshot,
      sessionID: "ses_home",
      title: "Home Session",
      header: { title: "Home Session" },
      tabs: [{ id: "ses_home", title: "Home Session", active: true, status: "idle" }],
    }
    const homeFrame = {
      version: 2,
      renderer: "shared/terminal-frame",
      width,
      height,
      title: "Home Landing",
      status: "idle",
      lines: expected,
      rows: expected.map((line, y) => ({ y, spans: [{ x: 0, text: line }] })),
    }
    const bodies: Array<{ parts?: Array<{ text?: string }> }> = []
    const seen: string[] = []
    const seenFull: string[] = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        if (url.pathname !== "/event") seenFull.push(`${req.method} ${url.pathname}${url.search}`)
        if (url.pathname === "/tui/manifest") return json(manifest)
        if (url.pathname === "/command") return json([])
        if (url.pathname === "/tui/snapshot")
          return json(url.searchParams.get("sessionID") === "ses_home" ? homeSessionSnapshot : homeSnapshot)
        if (url.pathname === "/tui/frame")
          return json(
            url.searchParams.get("sessionID") === "ses_home"
              ? createSurfaceFrame({ snapshot: homeSessionSnapshot, width, height })
              : homeFrame,
          )
        if (url.pathname === "/session" && req.method === "POST") return json({ id: "ses_home", title: "Home Session" })
        if (url.pathname === "/session/ses_home/prompt_async" && req.method === "POST") {
          bodies.push((await req.json()) as { parts?: Array<{ text?: string }> })
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
        env: { ...process.env, COLUMNS: String(width), LINES: String(height), SLOPCODE_VERSION: version },
      })
      await eventually(() => seen.includes("GET /event") && seenFull.includes("GET /tui/frame?width=100&height=30"))
      await Bun.sleep(750)
      proc.stdin.write("hello from home\r")
      await eventually(() => seen.includes("POST /session"), 10_000).catch(async () => {
        proc.stdin.write("\x04")
        proc.stdin.end()
        const [code, stdout, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ])
        throw new Error(
          [
            "home prompt did not lazily create a session",
            `code ${code}`,
            `seen ${JSON.stringify(seenFull)}`,
            `stdout ${stripAnsi(stdout)}`,
            `stderr ${stderr}`,
          ].join("\n"),
        )
      })
      await eventually(() => bodies.length === 1, 10_000).catch(async () => {
        proc.stdin.write("\x04")
        proc.stdin.end()
        const [code, stdout, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ])
        throw new Error(
          [
            "home prompt did not submit after lazy session creation",
            `code ${code}`,
            `seen ${JSON.stringify(seenFull)}`,
            `bodies ${JSON.stringify(bodies)}`,
            `stdout ${stripAnsi(stdout)}`,
            `stderr ${stderr}`,
          ].join("\n"),
        )
      })
      proc.stdin.write("\x04")
      proc.stdin.end()
      const [code, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      expect(stderr).toBe("")
      expect(code).toBe(0)
      const text = stripAnsi(stdout)
      for (const row of [11, 12, 13, 14, 17, 29]) {
        const needle = expected[row].replace(/\s+/g, "")
        if (needle) expect(text.replace(/\s+/g, "")).toContain(needle)
      }
      expect(stdout).not.toContain("SlopCode Android |")
      expect(stdout).not.toContain("Rust-native Termux TUI")
      expect(text).not.toContain("Fix a TODO in the codebase")
      expect(seen).toContain("POST /session")
      expect(seenFull).toContain("GET /tui/snapshot?sessionID=ses_home")
      expect(seen).toContain("POST /session/ses_home/prompt_async")
      expect(bodies[0]?.parts?.[0]?.text).toBe("hello from home")
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

  test("drives advanced composer stash, autocomplete, paste, shell mode, and queue through Android native routes", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const bodies: Array<{ parts?: Array<{ text?: string }> }> = []
    const shells: Array<{ command?: string }> = []
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
        if (url.pathname === "/session/ses_surface/prompt_async" && req.method === "POST") {
          bodies.push((await req.json()) as { parts?: Array<{ text?: string }> })
          return new Response(null, { status: 204 })
        }
        if (url.pathname === "/session/ses_surface/shell" && req.method === "POST") {
          shells.push((await req.json()) as { command?: string })
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
      await eventually(() => seen.includes("GET /tui/frame") && seen.includes("GET /command"))
      proc.stdin.write("/cl\t\u0015")
      await Bun.sleep(150)
      proc.stdin.write("draft\x1b[24~")
      await Bun.sleep(100)
      proc.stdin.write("/stash\r")
      await Bun.sleep(150)
      proc.stdin.write("/pop\r")
      await Bun.sleep(100)
      proc.stdin.write("\x1b[200~ paste\nblock\x1b[201~\r")
      await eventually(() => bodies.length === 1)
      proc.stdin.write("/shell-mode\r")
      await Bun.sleep(100)
      proc.stdin.write("ls -la\r")
      await eventually(() => shells.length === 1)
      proc.stdin.write("/queue\r")
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
      expect(seen).toContain("POST /session/ses_surface/prompt_async")
      expect(seen).toContain("POST /session/ses_surface/shell")
      expect(bodies[0]?.parts?.[0]?.text).toBe("draft paste\nblock")
      expect(shells).toEqual([{ command: "ls -la" }])
      const rendered = stripAnsi(stdout)
      const normalized = rendered.replace(/\s+/g, "")
      expect(normalized).toContain("CommandMatches")
      expect(normalized).toContain("/clipboard")
      expect(normalized).toContain("draft")
      expect(normalized).toContain("queueempty")
      expect(normalized).toContain("shellmod")
    } finally {
      server.stop(true)
    }
  })

  test("sends the selected provider model with prompt submissions", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const bodies: Array<{ model?: { providerID?: string; modelID?: string }; parts?: Array<{ text?: string }> }> = []
    const seen: string[] = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        if (url.pathname === "/tui/manifest") return json(manifest)
        if (url.pathname === "/command") return json([])
        if (url.pathname === "/v2/model")
          return json([
            { providerID: "openai", id: "gpt-5", name: "GPT 5" },
            { providerID: "anthropic", id: "claude-sonnet", name: "Claude Sonnet" },
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
        if (url.pathname === "/session/ses_surface/prompt_async" && req.method === "POST") {
          bodies.push(
            (await req.json()) as {
              model?: { providerID?: string; modelID?: string }
              parts?: Array<{ text?: string }>
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
      proc.stdin.write("/models\r")
      await eventually(() => seen.includes("GET /v2/model"))
      proc.stdin.write("/model openai/gpt-5\r")
      await Bun.sleep(100)
      proc.stdin.write("model prompt\r")
      await eventually(() => bodies.length === 1)
      proc.stdin.write("\x04")
      proc.stdin.end()
      const [code, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      expect(stderr).toBe("")
      expect(code).toBe(0)
      expect(stripAnsi(stdout)).toContain("Models")
      expect(seen).toContain("POST /session/ses_surface/prompt_async")
      expect(bodies[0]?.model).toEqual({ providerID: "openai", modelID: "gpt-5" })
      expect(bodies[0]?.parts?.[0]?.text).toBe("model prompt")
    } finally {
      server.stop(true)
    }
  })

  test("drives Linux-aligned command panels through Android native handlers", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const configPatches: Array<{
      autocomplete?: { provider_model_overrides?: Record<string, string> }
      shell?: { program?: string }
    }> = []
    const seen: string[] = []
    const providers = [
      {
        id: "openai",
        name: "OpenAI",
        models: {
          "gpt-5": {
            id: "gpt-5",
            name: "GPT 5",
            variants: { fast: {}, thoughtful: {} },
          },
        },
      },
      {
        id: "anthropic",
        name: "Anthropic",
        models: {
          "claude-sonnet": {
            id: "claude-sonnet",
            name: "Claude Sonnet",
            variants: { haiku: {} },
          },
        },
      },
    ]
    const models = [
      { providerID: "openai", id: "gpt-5", name: "GPT 5", variants: { fast: {}, thoughtful: {} } },
      { providerID: "anthropic", id: "claude-sonnet", name: "Claude Sonnet", variants: { haiku: {} } },
    ]
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        if (url.pathname === "/tui/manifest") return json(manifest)
        if (url.pathname === "/command")
          return json([{ name: "sample-skill", source: "skill", description: "Sample skill command" }])
        if (url.pathname === "/config")
          return json({
            model: "openai/gpt-5",
            provider: { openai: { id: "openai" } },
            plugin_origins: [{ scope: "workspace", spec: "sample.js", source: "local" }],
          })
        if (url.pathname === "/v2/provider") return json(providers)
        if (url.pathname === "/v2/model") return json(models)
        if (url.pathname === "/pty/shells")
          return json([
            { name: "zsh", path: "/data/data/com.termux/files/usr/bin/zsh", acceptable: true },
            { name: "bash", path: "/data/data/com.termux/files/usr/bin/bash", acceptable: true },
            { name: "bad", path: "/bad", acceptable: false },
          ])
        if (url.pathname === "/global/config" && req.method === "PATCH") {
          configPatches.push(await req.json())
          return json(true)
        }
        if (url.pathname === "/global/dispose" && req.method === "POST") return json(true)
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
        env: { ...process.env, COLUMNS: "120", LINES: "40" },
      })
      await eventually(() => seen.includes("GET /tui/frame") && seen.includes("GET /command"))
      proc.stdin.write("/models-completion\r")
      await eventually(() => seen.includes("GET /v2/provider") && seen.includes("GET /v2/model"))
      proc.stdin.write("/models-completion openai/gpt-5\r")
      await eventually(() =>
        configPatches.some((item) => item.autocomplete?.provider_model_overrides?.openai === "gpt-5"),
      )
      proc.stdin.write("/variants\r")
      await Bun.sleep(200)
      proc.stdin.write("/shells\r")
      await eventually(() => seen.includes("GET /pty/shells"))
      proc.stdin.write("/shell /data/data/com.termux/files/usr/bin/zsh\r")
      await eventually(() => configPatches.some((item) => item.shell?.program?.includes("zsh")))
      proc.stdin.write("/orgs\r")
      await Bun.sleep(150)
      proc.stdin.write("/plugins\r")
      await Bun.sleep(150)
      proc.stdin.write("/skills\r")
      await Bun.sleep(150)
      proc.stdin.write("/history\r")
      await Bun.sleep(100)
      proc.stdin.write("/timestamps\r")
      await Bun.sleep(100)
      proc.stdin.write("/thinking\r")
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
      expect(seen).toContain("GET /config")
      expect(seen).toContain("GET /v2/provider")
      expect(seen).toContain("GET /v2/model")
      expect(seen).toContain("GET /pty/shells")
      expect(seen).toContain("GET /command")
      expect(seen.filter((item) => item === "PATCH /global/config").length).toBeGreaterThanOrEqual(2)
      expect(seen).toContain("POST /global/dispose")
      expect(configPatches).toContainEqual({ autocomplete: { provider_model_overrides: { openai: "gpt-5" } } })
      expect(configPatches).toContainEqual({ shell: { program: "/data/data/com.termux/files/usr/bin/zsh" } })
      const normalized = stripAnsi(stdout).replace(/\s+/g, "")
      expect(normalized).toContain("AutocompleteModel")
      expect(normalized).toContain("OpenAIprovideropenai")
      expect(normalized).toContain("Variants")
      expect(normalized).toContain("Variantfast")
      expect(normalized).toContain("Shells")
      expect(normalized).toContain("zsh")
      expect(normalized).toContain("ConsoleOrgs")
      expect(normalized).toContain("OpenAIprovideropenai")
      expect(normalized).toContain("Plugins")
      expect(normalized).toContain("sample.js")
      expect(normalized).toContain("Skills")
      expect(normalized).toContain("/sample-skill")
      expect(normalized).toContain("Historymode")
      expect(normalized).toContain("Prompt/shells")
      expect(normalized).toContain("Prompt/models-completion")
    } finally {
      server.stop(true)
    }
  })

  test("drives terminal polish panels and title updates through Android native handlers", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const titlePatches: Array<{ title?: string }> = []
    const seen: string[] = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        if (url.pathname === "/tui/manifest") return json(manifest)
        if (url.pathname === "/command") return json([])
        if (url.pathname === "/config")
          return json({
            plugin_origins: [{ scope: "workspace", spec: "sample.js", source: "local" }],
            plugin: ["fallback-plugin.js"],
          })
        if (url.pathname === "/session/ses_surface" && req.method === "PATCH") {
          titlePatches.push((await req.json()) as { title?: string })
          return json({ id: "ses_surface", title: titlePatches.at(-1)?.title ?? "Parity Surface" })
        }
        if (url.pathname === "/tui/snapshot") return json(snapshot)
        if (url.pathname === "/tui/frame")
          return json(
            createSurfaceFrame({
              snapshot,
              width: Number(url.searchParams.get("width") ?? 120),
              height: Number(url.searchParams.get("height") ?? 40),
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
        env: { ...process.env, COLUMNS: "120", LINES: "40" },
      })
      await eventually(() => seen.includes("GET /tui/frame") && seen.includes("GET /command"))
      proc.stdin.write("/themes\r")
      await Bun.sleep(150)
      proc.stdin.write("/themes dracula\r")
      await Bun.sleep(150)
      proc.stdin.write("/keybinds\r")
      await Bun.sleep(150)
      proc.stdin.write("/clipboard\r")
      await Bun.sleep(150)
      proc.stdin.write("/title Android Title\r")
      await eventually(() => titlePatches.some((item) => item.title === "Android Title"))
      proc.stdin.write("/suspend\r")
      await Bun.sleep(150)
      proc.stdin.write("/plugins\r")
      await eventually(() => seen.includes("GET /config"))
      proc.stdin.write("/doctor\r")
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
      expect(seen).toContain("GET /config")
      expect(seen).toContain("PATCH /session/ses_surface")
      expect(titlePatches).toContainEqual({ title: "Android Title" })
      const normalized = stripAnsi(stdout).replace(/\s+/g, "")
      expect(normalized).toContain("Themes")
      expect(normalized).toContain("Themedracula")
      expect(normalized).toContain("Keybinds")
      expect(normalized).toContain("ctrl+x+t/themesThemes")
      expect(normalized).toContain("Clipboard")
      expect(normalized).toContain("clipboard-get")
      expect(normalized).toContain("Suspend")
      expect(normalized).toMatch(/Andro\w*app\w*sw/)
      expect(normalized).toMatch(/Plugi\w*/)
      expect(normalized).toContain(".jslocal")
      expect(normalized).toContain("AndroidRuntime")
      expect(normalized).toContain("rendererratatui/crossterm")
      expect(normalized).toContain("termuxclipboard")
    } finally {
      server.stop(true)
    }
  })

  test("answers question dialogs through the daemon question route", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const replies: Array<{ answers?: string[][] }> = []
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
        if (url.pathname === "/question/que_surface/reply" && req.method === "POST") {
          replies.push((await req.json()) as { answers?: string[][] })
          return json(true)
        }
        if (url.pathname === "/event")
          return new Response(
            'data: {"type":"server.connected"}\n\n' +
              'data: {"type":"question.asked","properties":{"id":"que_surface","sessionID":"ses_surface","questions":[{"header":"Mode","question":"Pick mode","custom":false,"options":[{"label":"Yes","description":"ok"},{"label":"No","description":"skip"}]}]}}\n\n',
          )
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
      await eventually(() => seen.includes("GET /event"))
      await Bun.sleep(300)
      proc.stdin.write("2")
      await eventually(() => replies.length === 1)
      proc.stdin.write("\x04")
      proc.stdin.end()
      const [code, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      expect(stderr).toBe("")
      expect(code).toBe(0)
      expect(seen).toContain("POST /question/que_surface/reply")
      expect(replies).toEqual([{ answers: [["No"]] }])
      const normalized = stripAnsi(stdout).replace(/\s+/g, "")
      expect(normalized).toContain("QuestionDialog")
      expect(normalized).toContain("Pickmode")
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
      const text = stripAnsi(stdout)
      expect(text).toContain("Command")
      expect(text).toMatch(/Palet(te)?/)
      expect(text).toContain("/files")
      expect(text).toContain("/help")
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
          if (url.pathname === "/file") return json([{ path: "src/app.ts", name: "app.ts", type: "file" }])
          if (url.pathname === "/session" && req.method === "GET")
            return json([{ id: "ses_surface", title: "Session One" }])
          if (url.pathname === "/v2/model") return json([{ providerID: "openai", id: "gpt-4.1", name: "GPT 4.1" }])
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

  test("renders modified and workspace file panels through Android native routes", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const bodies: Array<{ parts?: Array<{ path?: string; text?: string; type?: string }> }> = []
    const editorCreates: Array<{ file?: string; sessionID?: string }> = []
    const seen: string[] = []
    const seenFull: string[] = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        seenFull.push(`${req.method} ${url.pathname}${url.search}`)
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
        if (url.pathname === "/file/status")
          return json([{ path: "src/app.ts", status: "modified", additions: 2, deletions: 1 }])
        if (url.pathname === "/file")
          return json(
            url.searchParams.get("path") === "app"
              ? [{ path: "src/app.ts", name: "app.ts", type: "file" }]
              : [{ path: "src", name: "src", type: "directory" }],
          )
        if (url.pathname === "/file/content") return json({ content: "console.log('ok')" })
        if (url.pathname === "/editor" && req.method === "POST") {
          editorCreates.push((await req.json()) as { file?: string; sessionID?: string })
          return json({ id: "edt_surface", sessionID: "ses_surface", file: "src/app.ts", dirty: true, diff: true })
        }
        if (url.pathname === "/editor/edt_surface/snapshot")
          return json({ file: "src/app.ts", dirty: true, diff: true, content: "console.log('ok')" })
        if (url.pathname === "/session/ses_surface/prompt_async" && req.method === "POST") {
          bodies.push((await req.json()) as { parts?: Array<{ path?: string; text?: string; type?: string }> })
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
      await eventually(() => seen.includes("GET /tui/frame") && seen.includes("GET /command"))
      proc.stdin.write("/summary\r")
      await eventually(() => seen.includes("GET /file/status"))
      proc.stdin.write("/files app\r")
      await eventually(() => seenFull.includes("GET /file?path=app"))
      proc.stdin.write("/open src/app.ts\r")
      await eventually(() => seen.includes("POST /editor"))
      proc.stdin.write("/attach src/app.ts\r")
      await Bun.sleep(100)
      proc.stdin.write("use it\r")
      await eventually(() => bodies.length === 1)
      proc.stdin.write("\x04")
      proc.stdin.end()
      const [code, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      expect(stderr).toBe("")
      expect(code).toBe(0)
      expect(seen).toContain("GET /file/status")
      expect(seenFull).toContain("GET /file?path=app")
      expect(seenFull).toContain("GET /file/content?path=src/app.ts")
      expect(seen).toContain("POST /editor")
      expect(seenFull).toContain("GET /editor/edt_surface/snapshot?sessionID=ses_surface")
      expect(seen).toContain("POST /session/ses_surface/prompt_async")
      expect(editorCreates).toEqual([{ sessionID: "ses_surface", file: "src/app.ts" }])
      expect(bodies[0]?.parts?.map((item) => item.type)).toEqual(["file", "text"])
      expect(bodies[0]?.parts?.[0]?.path).toBe("src/app.ts")
      expect(bodies[0]?.parts?.[1]?.text).toBe("use it")
      const normalized = stripAnsi(stdout).replace(/\s+/g, "")
      expect(normalized).toMatch(/Sidebar\w*Files/)
      expect(normalized).toContain("statusmodified")
      expect(normalized).toContain("OpenFiles")
      expect(normalized).toContain("src/app.ts")
      expect(normalized).toContain("[open]")
      expect(normalized).toContain("[attach]")
    } finally {
      server.stop(true)
    }
  })

  test("drives editor open, dirty guard, diagnostics, save, and diff dismissal through Android native routes", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const editorCreates: Array<{ file?: string; sessionID?: string }> = []
    const editorInputs: Array<{ keys?: string; type?: string }> = []
    const seen: string[] = []
    const seenFull: string[] = []
    const editorState = {
      dirty: true,
      diff: true,
      content: "console.log('ok')",
      diagnostics: ["error line 1: expected semicolon"],
    }
    const server = Bun.serve({
      port: 0,
      async fetch(req, server) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        seenFull.push(`${req.method} ${url.pathname}${url.search}`)
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
        if (url.pathname === "/file/content") return json({ content: editorState.content })
        if (url.pathname === "/editor" && req.method === "POST") {
          editorCreates.push((await req.json()) as { file?: string; sessionID?: string })
          return json({ id: "edt_surface", sessionID: "ses_surface", file: "src/app.ts", dirty: true, diff: true })
        }
        if (url.pathname === "/editor/edt_surface/snapshot")
          return json({
            file: "src/app.ts",
            dirty: editorState.dirty,
            diff: editorState.diff,
            content: editorState.content,
            diagnostics: editorState.diagnostics,
          })
        if (url.pathname === "/session/ses_surface/diff/index")
          return json([{ file: "src/app.ts", added: 2, removed: 1 }])
        if (url.pathname === "/editor/edt_surface/save" && req.method === "POST") {
          editorState.dirty = false
          return json({
            id: "edt_surface",
            sessionID: "ses_surface",
            file: "src/app.ts",
            dirty: false,
            diff: editorState.diff,
          })
        }
        if (url.pathname === "/editor/edt_surface/diff/dismiss" && req.method === "POST") {
          editorState.diff = false
          return json({
            id: "edt_surface",
            sessionID: "ses_surface",
            file: "src/app.ts",
            dirty: editorState.dirty,
            diff: false,
          })
        }
        if (url.pathname === "/editor/edt_surface" && req.method === "DELETE") return json(true)
        if (url.pathname === "/editor/edt_surface/connect") {
          if (server.upgrade(req)) return undefined
          return new Response("upgrade failed", { status: 400 })
        }
        if (url.pathname === "/event") return new Response('data: {"type":"server.connected"}\n\n')
        return json({})
      },
      websocket: {
        message(_ws, message) {
          const text = typeof message === "string" ? message : new TextDecoder().decode(message)
          const parsed = JSON.parse(text) as { keys?: string; type?: string }
          editorInputs.push(parsed)
          if (parsed.type === "input" && parsed.keys) {
            editorState.content += parsed.keys
            editorState.dirty = true
          }
        },
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
      proc.stdin.write("/open src/app.ts\r")
      await eventually(() => seen.includes("POST /editor"))
      proc.stdin.write("/close-editor\r")
      await Bun.sleep(250)
      const deleteCountAfterDirtyClose = seen.filter((item) => item === "DELETE /editor/edt_surface").length
      proc.stdin.write("/diagnostics\r")
      await eventually(() => seen.filter((item) => item === "GET /editor/edt_surface/snapshot").length >= 3)
      proc.stdin.write("/diff\r")
      await eventually(() => seen.includes("GET /session/ses_surface/diff/index"))
      proc.stdin.write("/edit\r")
      await Bun.sleep(100)
      proc.stdin.write("x\x13\x04\x11")
      await eventually(() => editorInputs.some((item) => item.type === "input" && item.keys === "x"))
      await eventually(() => seen.includes("POST /editor/edt_surface/save"))
      await eventually(() => seen.includes("POST /editor/edt_surface/diff/dismiss"))
      proc.stdin.write("/close-editor\r")
      await eventually(() => seen.includes("DELETE /editor/edt_surface"))
      proc.stdin.write("\x04")
      proc.stdin.end()
      const [code, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      expect(stderr).toBe("")
      expect(code).toBe(0)
      expect(editorCreates).toEqual([{ sessionID: "ses_surface", file: "src/app.ts" }])
      expect(seenFull).toContain("GET /file/content?path=src/app.ts")
      expect(seenFull).toContain("GET /editor/edt_surface/snapshot?sessionID=ses_surface")
      expect(seen).toContain("GET /session/ses_surface/diff/index")
      expect(seen).toContain("POST /editor/edt_surface/save")
      expect(seen).toContain("POST /editor/edt_surface/diff/dismiss")
      expect(seen).toContain("DELETE /editor/edt_surface")
      expect(deleteCountAfterDirtyClose).toBe(0)
      expect(seen.filter((item) => item === "DELETE /editor/edt_surface")).toHaveLength(1)
      expect(editorInputs).toEqual([{ type: "input", keys: "x" }])
      const normalized = stripAnsi(stdout).replace(/\s+/g, "")
      expect(normalized).toContain("Editor")
      expect(normalized).toContain("expectedsemicolon")
      expect(normalized).toContain("console.log('ok')")
      expect(normalized).toContain("dirtyno")
      expect(normalized).toContain("diffdismissed")
    } finally {
      server.stop(true)
    }
  })

  test("renders rich chat and editor tab rows with active and dirty markers", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const editorByID = new Map<string, { file: string; content: string; dirty: boolean }>()
    const deletes: string[] = []
    const seen: string[] = []
    const seenFull: string[] = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        seenFull.push(`${req.method} ${url.pathname}${url.search}`)
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
        if (url.pathname === "/file/content") {
          const file = url.searchParams.get("path") ?? ""
          return json({
            content: file.endsWith("other.ts") ? "export const other = true" : "export const app = true",
          })
        }
        if (url.pathname === "/editor" && req.method === "POST") {
          const body = (await req.json()) as { file?: string }
          const file = body.file ?? "src/app.ts"
          const id = file.endsWith("other.ts") ? "edt_other" : "edt_app"
          const state = {
            file,
            content: file.endsWith("other.ts") ? "export const other = true" : "export const app = true",
            dirty: file.endsWith("other.ts"),
          }
          editorByID.set(id, state)
          return json({ id, sessionID: "ses_surface", file, dirty: state.dirty, diff: false })
        }
        const snapshotMatch = url.pathname.match(/^\/editor\/([^/]+)\/snapshot$/)
        if (snapshotMatch) {
          const id = snapshotMatch[1]!
          const state = editorByID.get(id) ?? { file: "src/app.ts", content: "export const app = true", dirty: false }
          return json({ id, file: state.file, dirty: state.dirty, diff: false, content: state.content })
        }
        const deleteMatch = url.pathname.match(/^\/editor\/([^/]+)$/)
        if (deleteMatch && req.method === "DELETE") {
          deletes.push(deleteMatch[1]!)
          return json(true)
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
        env: { ...process.env, COLUMNS: "120", LINES: "36" },
      })
      await eventually(() => seen.includes("GET /tui/frame") && seen.includes("GET /command"))
      proc.stdin.write("/open src/app.ts\r")
      await eventually(() => seenFull.includes("GET /editor/edt_app/snapshot?sessionID=ses_surface"))
      proc.stdin.write("/open src/other.ts\r")
      await eventually(() => seenFull.includes("GET /editor/edt_other/snapshot?sessionID=ses_surface"))
      proc.stdin.write("/tabs\r")
      await Bun.sleep(250)
      proc.stdin.write("/open src/app.ts\r")
      await eventually(
        () => seenFull.filter((item) => item === "GET /editor/edt_app/snapshot?sessionID=ses_surface").length >= 2,
      )
      proc.stdin.write("/tabs\r")
      await Bun.sleep(250)
      proc.stdin.write("/close-editor!\r")
      await eventually(() => deletes.includes("edt_app"))
      proc.stdin.write("/tabs\r")
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
      expect(deletes).toContain("edt_app")
      const normalized = stripAnsi(stdout).replace(/\s+/g, "")
      expect(normalized).toContain("Tabs")
      expect(normalized).toContain("ParitySurface")
      expect(normalized).toContain("Editorsrc/app.ts")
      expect(normalized).toContain("other.ts*")
      expect(normalized).toContain("[tab:/opensrc/app.ts]")
      expect(normalized).toContain("[tab:/opensrc/other.ts]")
      expect(normalized).toContain("[close:/close-editor]")
      expect(normalized).toMatch(/>\w+\/other\.ts\*/)
    } finally {
      server.stop(true)
    }
  })

  test("routes session panels and controls through Android native command handlers", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const summaries: Array<{ providerID?: string; modelID?: string }> = []
    const reverts: Array<{ messageID?: string }> = []
    const seen: string[] = []
    const seenFull: string[] = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        seenFull.push(`${req.method} ${url.pathname}${url.search}`)
        if (url.pathname === "/tui/manifest") return json(manifest)
        if (url.pathname === "/command") return json([])
        if (url.pathname === "/tui/snapshot")
          return json(
            url.searchParams.get("sessionID") === "ses_fork" ? { ...snapshot, sessionID: "ses_fork" } : snapshot,
          )
        if (url.pathname === "/tui/frame")
          return json(
            createSurfaceFrame({
              snapshot:
                url.searchParams.get("sessionID") === "ses_fork" ? { ...snapshot, sessionID: "ses_fork" } : snapshot,
              width: Number(url.searchParams.get("width") ?? 100),
              height: Number(url.searchParams.get("height") ?? 30),
            }),
          )
        if (url.pathname === "/session/status") return json({ health: "ready", mode: "native" })
        if (url.pathname === "/session/ses_surface/children") return json([{ id: "ses_child", title: "Child Session" }])
        if (url.pathname === "/session/ses_surface/message/index")
          return json([{ id: "msg_route", sessionID: "ses_surface", role: "user" }])
        if (url.pathname === "/session/ses_surface/revert" && req.method === "POST") {
          reverts.push((await req.json()) as { messageID?: string })
          return json({ id: "ses_surface", title: "Parity Surface" })
        }
        if (url.pathname === "/session/ses_surface/unrevert" && req.method === "POST")
          return json({ id: "ses_surface", title: "Parity Surface" })
        if (url.pathname === "/session/ses_surface/share" && req.method === "POST")
          return json({
            id: "ses_surface",
            title: "Parity Surface",
            share: { url: "https://share.example/ses_surface" },
          })
        if (url.pathname === "/session/ses_surface/share" && req.method === "DELETE")
          return json({ id: "ses_surface", title: "Parity Surface" })
        if (url.pathname === "/session/ses_surface/pause" && req.method === "POST") return json(true)
        if (url.pathname === "/session/ses_surface/resume" && req.method === "POST") return json(true)
        if (url.pathname === "/session/ses_surface/summarize" && req.method === "POST") {
          summaries.push((await req.json()) as { providerID?: string; modelID?: string })
          return json(true)
        }
        if (url.pathname === "/session/ses_surface/abort" && req.method === "POST") return json(true)
        if (url.pathname === "/session/ses_surface/fork" && req.method === "POST")
          return json({ id: "ses_fork", title: "Forked Session" })
        if (url.pathname === "/session/ses_fork") return json({ id: "ses_fork", title: "Forked Session" })
        if (url.pathname === "/session/ses_fork/message/index") return json([])
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
      proc.stdin.write("/children\r")
      await eventually(() => seen.includes("GET /session/ses_surface/children"))
      proc.stdin.write("/messages\r")
      await eventually(() => seen.includes("GET /session/ses_surface/message/index"))
      proc.stdin.write("/timeline\r")
      await eventually(() => seen.filter((item) => item === "GET /session/ses_surface/message/index").length >= 2)
      proc.stdin.write("/revert msg_route\r")
      await eventually(() => seen.includes("POST /session/ses_surface/revert"))
      proc.stdin.write("/unrevert\r")
      await eventually(() => seen.includes("POST /session/ses_surface/unrevert"))
      proc.stdin.write("/status\r")
      await eventually(() => seen.includes("GET /session/status"))
      proc.stdin.write("/share\r")
      await eventually(() => seen.includes("POST /session/ses_surface/share"))
      proc.stdin.write("/unshare\r")
      await eventually(() => seen.includes("DELETE /session/ses_surface/share"))
      proc.stdin.write("/pause\r")
      await eventually(() => seen.includes("POST /session/ses_surface/pause"))
      proc.stdin.write("/resume-session\r")
      await eventually(() => seen.includes("POST /session/ses_surface/resume"))
      proc.stdin.write("/model openai/gpt-5\r")
      await Bun.sleep(100)
      proc.stdin.write("/compact\r")
      await eventually(() => seen.includes("POST /session/ses_surface/summarize"))
      proc.stdin.write("/interrupt\r")
      await eventually(() => seen.includes("POST /session/ses_surface/abort"))
      proc.stdin.write("/fork\r")
      await eventually(() => seenFull.includes("GET /tui/snapshot?sessionID=ses_fork"))
      proc.stdin.write("\x04")
      proc.stdin.end()
      const [code, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      expect(stderr).toBe("")
      expect(code).toBe(0)
      expect(seen).toContain("GET /session/ses_surface/children")
      expect(seen.filter((item) => item === "GET /session/ses_surface/message/index").length).toBeGreaterThanOrEqual(2)
      expect(seen).toContain("POST /session/ses_surface/revert")
      expect(seen).toContain("POST /session/ses_surface/unrevert")
      expect(seen).toContain("GET /session/status")
      expect(seen).toContain("POST /session/ses_surface/share")
      expect(seen).toContain("DELETE /session/ses_surface/share")
      expect(seen).toContain("POST /session/ses_surface/pause")
      expect(seen).toContain("POST /session/ses_surface/resume")
      expect(seen).toContain("POST /session/ses_surface/summarize")
      expect(seen).toContain("POST /session/ses_surface/abort")
      expect(seen).toContain("POST /session/ses_surface/fork")
      expect(seenFull).toContain("GET /tui/snapshot?sessionID=ses_fork")
      expect(reverts).toEqual([{ messageID: "msg_route" }])
      expect(summaries).toEqual([{ providerID: "openai", modelID: "gpt-5" }])
      expect(stripAnsi(stdout)).toContain("Status")
    } finally {
      server.stop(true)
    }
  })

  test("switches and closes session tabs through Android native tab commands", async () => {
    if (process.platform === "win32") return
    const bin = await binary()
    if (!bin) return

    const tabbedSnapshot = (active: "ses_surface" | "ses_other"): TuiSurfaceSnapshot => ({
      ...snapshot,
      sessionID: active,
      title: active === "ses_other" ? "Other Session" : "Parity Surface",
      header: { title: active === "ses_other" ? "Other Session" : "Parity Surface" },
      tabs: [
        { id: "ses_surface", title: "Parity Surface", active: active === "ses_surface", status: "idle" },
        { id: "ses_other", title: "Other Session", active: active === "ses_other", status: "busy" },
      ],
    })
    const seen: string[] = []
    const seenFull: string[] = []
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url)
        seen.push(`${req.method} ${url.pathname}`)
        seenFull.push(`${req.method} ${url.pathname}${url.search}`)
        if (url.pathname === "/tui/manifest") return json(manifest)
        if (url.pathname === "/command") return json([])
        if (url.pathname === "/session" && req.method === "GET")
          return json([
            { id: "ses_surface", title: "Parity Surface" },
            { id: "ses_other", title: "Other Session" },
          ])
        if (url.pathname === "/tui/snapshot") {
          const active = url.searchParams.get("sessionID") === "ses_other" ? "ses_other" : "ses_surface"
          return json(tabbedSnapshot(active))
        }
        if (url.pathname === "/tui/frame") {
          const active = url.searchParams.get("sessionID") === "ses_other" ? "ses_other" : "ses_surface"
          return json(
            createSurfaceFrame({
              snapshot: tabbedSnapshot(active),
              width: Number(url.searchParams.get("width") ?? 100),
              height: Number(url.searchParams.get("height") ?? 30),
            }),
          )
        }
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
      proc.stdin.write("/sessions\r")
      await eventually(() => seenFull.includes("GET /session?roots=true&limit=20"))
      proc.stdin.write("/tabs\r")
      await Bun.sleep(200)
      proc.stdin.write("/session ses_other\r")
      await eventually(() => seenFull.includes("GET /tui/snapshot?sessionID=ses_other"))
      await Bun.sleep(500)
      proc.stdin.write("/tabs\r")
      await Bun.sleep(200)
      proc.stdin.write("/close\r")
      await Bun.sleep(200)
      proc.stdin.write("/tabs\r")
      await Bun.sleep(200)
      proc.stdin.write("/close\r")
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
      expect(seenFull).toContain("GET /session?roots=true&limit=20")
      expect(seenFull).toContain("GET /tui/snapshot?sessionID=ses_other")
      const normalized = stripAnsi(stdout).replace(/\s+/g, "")
      expect(normalized).toContain("Sessions")
      expect(normalized).toContain("ParitySurface")
      expect(normalized).toContain("OtherSession")
      expect(normalized).toContain("Tabs")
      expect(normalized).toContain("1>ParitySurface")
      expect(normalized).toContain("[*]OtherSession")
      expect(normalized).toContain("[tab:/sessionses_other]")
      expect(normalized).toContain("[close:/close]")
      expect(normalized).toMatch(/closedcurrenttab|losedcu/)
      expect(normalized).toContain("closedlasttab")
      const screen = terminalFrame(stdout, width, height).join("\n")
      expect(screen).toContain("closed last tab")
      expect(screen).toContain("█▀▀")
    } finally {
      server.stop(true)
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
