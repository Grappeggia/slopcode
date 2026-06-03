#!/usr/bin/env bun

import fs from "fs/promises"
import os from "os"
import path from "path"
import { fileURLToPath } from "url"

import pkg from "../package.json"
import { parity, report } from "./android-termux-parity"

const dir = fileURLToPath(new URL("..", import.meta.url))
const root = path.resolve(dir, "../..")
const sh = "/data/data/com.termux/files/usr/bin/sh"
const home = "/data/data/com.termux/files/home"
const tmp = "/data/local/tmp"
const mode = process.env.SLOPCODE_ANDROID_E2E_MODE ?? "smoke"

export const androidTargets = [
  { arch: "arm64", name: "slopcode-android-arm64", flag: "android-arm64" },
  { arch: "x64", name: "slopcode-android-x64", flag: "android-x64" },
] as const

process.chdir(dir)

type ExecOptions = {
  check?: boolean
}

async function exec(args: string[], options: ExecOptions = {}) {
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" })
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  if (options.check !== false && code !== 0) {
    throw new Error(`${args.join(" ")} failed (${code})\n${stdout}${stderr}`.trim())
  }
  return { code, stdout, stderr }
}

async function adbSerial() {
  if (process.env.SLOPCODE_ANDROID_SERIAL) return process.env.SLOPCODE_ANDROID_SERIAL
  const result = await exec(["adb", "devices"])
  const devices = result.stdout
    .split("\n")
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((item) => item[1] === "device")
    .map((item) => item[0])
  if (devices.length === 0) throw new Error("android e2e: no adb device")
  if (devices.length > 1)
    throw new Error(`android e2e: multiple adb devices (${devices.join(", ")}); set SLOPCODE_ANDROID_SERIAL`)
  return devices[0]
}

let serial: string | undefined
async function androidSerial() {
  serial ??= await adbSerial()
  return serial
}
const adbRun = async (args: string[], options?: ExecOptions) =>
  exec(["adb", "-s", await androidSerial(), ...args], options)
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
const adb = (...args: string[]) => adbRun(args)
const termux = (command: string, options?: ExecOptions) =>
  adbRun(
    [
      "shell",
      `run-as com.termux ${sh} -lc ${quote(`export PREFIX=/data/data/com.termux/files/usr HOME=${home} TMPDIR=/data/data/com.termux/files/usr/tmp PATH=/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin; cd ${home}; ${command}`)}`,
    ],
    options,
  )

async function exists(target: string) {
  return fs.access(target).then(
    () => true,
    () => false,
  )
}

function target() {
  const value = process.env.SLOPCODE_ANDROID_TARGET
  if (value) {
    const found = androidTargets.find((item) => item.name === value || item.flag === value || item.arch === value)
    if (found) return found
    throw new Error(
      `android e2e: unsupported SLOPCODE_ANDROID_TARGET=${value}; expected ${androidTargets.map((item) => item.name).join(" or ")}`,
    )
  }
  const arch = process.env.SLOPCODE_ANDROID_ARCH
  if (arch) {
    const found = androidTargets.find((item) => item.arch === arch)
    if (found) return found
    throw new Error(`android e2e: unsupported SLOPCODE_ANDROID_ARCH=${arch}; expected arm64 or x64`)
  }
  return androidTargets.find((item) => item.arch === (process.arch === "arm64" ? "arm64" : "x64")) ?? androidTargets[1]
}

async function pack(cwd: string, name: string) {
  const file = path.join(cwd, name)
  await fs.rm(file, { force: true })
  const result = Bun.spawn(["bun", "pm", "pack", "--filename", name], { cwd, stdout: "pipe", stderr: "pipe" })
  const [code, stdout, stderr] = await Promise.all([
    result.exited,
    new Response(result.stdout).text(),
    new Response(result.stderr).text(),
  ])
  if (code !== 0) throw new Error(`bun pm pack failed\n${stdout}${stderr}`.trim())
  return file
}

async function stage() {
  const version = (await import("@slopcode-ai/script")).Script.version
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-android-termux-e2e-"))
  const selected = target()
  const androidFrom = path.join(dir, "dist", selected.name)
  if (!(await exists(path.join(androidFrom, "package.json")))) {
    throw new Error(
      `android e2e: missing ${androidFrom}; run bun --cwd packages/slopcode run script/build.ts --target=${selected.flag}`,
    )
  }

  const bundle = path.join(dir, "dist", "android-bundle")
  const modules = path.join(dir, "dist", "android-modules")
  if (!(await exists(path.join(bundle, "index.js")))) {
    throw new Error(
      "android e2e: missing dist/android-bundle; run bun --cwd packages/slopcode run script/build.ts --target=android",
    )
  }
  if (
    !(await exists(path.join(modules, "@opentui", "core-android-arm64", "index.ts"))) ||
    !(await exists(path.join(modules, "@opentui", "core-android-x64", "index.ts")))
  ) {
    throw new Error("android e2e: missing dist/android-modules; rebuild the Android bundle")
  }

  const app = path.join(work, pkg.name)
  await fs.mkdir(app, { recursive: true })
  await fs.cp(path.join(dir, "bin"), path.join(app, "bin"), { recursive: true, force: true })
  await fs.cp(bundle, path.join(app, "bundle"), { recursive: true, force: true })
  await fs.cp(modules, path.join(app, "android-modules"), { recursive: true, force: true })
  for (const target of androidTargets) {
    const source = path.join(dir, "dist", target.name, "bin")
    if (!(await exists(path.join(source, pkg.name)))) {
      throw new Error(
        `android e2e: missing embedded ${target.arch} runtime; run bun --cwd packages/slopcode run script/build.ts --target=android`,
      )
    }
    if (!(await exists(path.join(source, `${pkg.name}-android-host`)))) {
      throw new Error(
        `android e2e: missing embedded ${target.arch} host; run bun --cwd packages/slopcode run script/build.ts --target=android`,
      )
    }
    await fs.mkdir(path.join(app, "android-runtime", target.arch), { recursive: true })
    await fs.cp(source, path.join(app, "android-runtime", target.arch, "bin"), { recursive: true, force: true })
  }
  await fs.copyFile(path.join(dir, "script", "postinstall.mjs"), path.join(app, "postinstall.mjs"))
  await fs.copyFile(path.join(root, "LICENSE"), path.join(app, "LICENSE"))
  await Bun.write(path.join(app, "README.md"), `${(await Bun.file(path.join(dir, "README.npm.md")).text()).trim()}\n`)
  await Bun.write(
    path.join(app, "package.json"),
    JSON.stringify(
      {
        name: pkg.name,
        version,
        license: pkg.license,
        description: "The open source AI slopcoding agent.",
        homepage: "https://slopcode.dev",
        repository: { type: "git", url: "git+https://github.com/teamslop/slopcode.git" },
        bugs: { url: "https://github.com/teamslop/slopcode/issues" },
        funding: { url: "https://github.com/sponsors/teamslop" },
        bin: { [pkg.name]: `./bin/${pkg.name}` },
        files: ["bin", "bundle", "android-modules", "android-runtime", "postinstall.mjs", "README.md", "LICENSE"],
        scripts: { postinstall: "bun ./postinstall.mjs || node ./postinstall.mjs" },
        optionalDependencies: {
          "@oven/bun-linux-aarch64-android": "1.3.14",
          "@oven/bun-linux-x64-android": "1.3.14",
        },
      },
      null,
      2,
    ),
  )
  const cli = await pack(app, "slopcode-root.tgz")
  return { work, cli, arch: selected.arch }
}

async function installTermux() {
  const packages = await adb("shell", "pm", "list", "packages", "com.termux")
  if (!packages.stdout.includes("package:com.termux")) throw new Error("android e2e: Termux is not installed")
  await adbRun(["shell", "monkey", "-p", "com.termux", "1"], { check: false })
  await Bun.sleep(5000)
  const check = await termux("node -v >/dev/null && npm -v >/dev/null", { check: false })
  if (check.code === 0) return
  if (process.env.SLOPCODE_ANDROID_BOOTSTRAP !== "1") {
    throw new Error("android e2e: Termux is missing node/npm; set SLOPCODE_ANDROID_BOOTSTRAP=1 to install them")
  }
  await termux(
    "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::=--force-confnew upgrade && DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::=--force-confnew install openssl nodejs npm",
  )
}

export function e2eSource(arch: "arm64" | "x64") {
  return `import { createServer } from "node:http"
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { setTimeout as sleep } from "node:timers/promises"

const matrix = ${JSON.stringify(parity, null, 2)}
const phaseReport = ${JSON.stringify(report(), null, 2)}
const mode = process.env.SLOPCODE_ANDROID_E2E_MODE || "smoke"
const root = spawnSync("npm", ["root", "-g"], { encoding: "utf8" }).stdout.trim()
const cliPath = path.join(root, "slopcode", "bin", "slopcode")
const androidRoot = path.join(root, "slopcode", "android-runtime", ${JSON.stringify(arch)})
const host = path.join(androidRoot, "bin", "slopcode-android-host")
const rootVersion = JSON.parse(fs.readFileSync(path.join(root, "slopcode", "package.json"), "utf8")).version
const resultPath = path.join(process.env.HOME || ".", "android-termux-e2e-result.json")
const results = []
const surfaceCommands = [
  { id: "help.show", title: "Help", category: "System", slash: { name: "help", aliases: ["commands"] }, keybind: "command_list" },
  { id: "session.new", title: "New Session", category: "Session", slash: { name: "new" }, keybind: "session_new" },
  { id: "session.list", title: "Sessions", category: "Session", slash: { name: "sessions", aliases: ["session"] }, keybind: "session_list" },
  { id: "session.tabs", title: "Tabs", category: "Session", slash: { name: "tabs" }, keybind: "session_tabs_next" },
  { id: "session.children", title: "Child Sessions", category: "Session", slash: { name: "children" }, keybind: "session_child_first" },
  { id: "session.timeline", title: "Timeline", category: "Session", slash: { name: "timeline", aliases: ["messages"] }, keybind: "session_timeline" },
  { id: "session.status", title: "Status", category: "Session", slash: { name: "status" }, keybind: "status_view" },
  { id: "session.share", title: "Share", category: "Session", slash: { name: "share" }, keybind: "session_share" },
  { id: "session.unshare", title: "Unshare", category: "Session", slash: { name: "unshare" }, keybind: "session_unshare" },
  { id: "session.compact", title: "Compact", category: "Session", slash: { name: "compact" }, keybind: "session_compact" },
  { id: "session.interrupt", title: "Interrupt", category: "Session", slash: { name: "interrupt", aliases: ["abort"] }, keybind: "session_interrupt" },
  { id: "session.fork", title: "Fork", category: "Session", slash: { name: "fork" }, keybind: "session_fork" },
  { id: "session.close", title: "Close Tab", category: "Session", slash: { name: "close" } },
  { id: "session.pause", title: "Pause", category: "Session", slash: { name: "pause" } },
  { id: "session.resume", title: "Resume", category: "Session", slash: { name: "resume" } },
  { id: "session.revert", title: "Revert", category: "Session", slash: { name: "revert", usage: "/revert <message-id>" }, keybind: "messages_undo" },
  { id: "session.unrevert", title: "Unrevert", category: "Session", slash: { name: "unrevert" }, keybind: "messages_redo" },
  { id: "session.title", title: "Rename", category: "Session", slash: { name: "title", usage: "/title <title>" }, keybind: "session_rename" },
  { id: "model.list", title: "Models", category: "Agent", slash: { name: "models", aliases: ["model"] }, keybind: "model_list" },
  { id: "provider.list", title: "Providers", category: "Agent", slash: { name: "providers", aliases: ["connect"] } },
  { id: "agent.list", title: "Agents", category: "Agent", slash: { name: "agents", aliases: ["agent"] }, keybind: "agent_list" },
  { id: "sidebar.summary", title: "Modified Files", category: "Workspace", slash: { name: "summary", aliases: ["sidebar"] }, keybind: "sidebar_toggle" },
  { id: "sidebar.files", title: "Files", category: "Workspace", slash: { name: "files" }, keybind: "session_files" },
  { id: "file.open", title: "Open File", category: "Workspace", slash: { name: "open", usage: "/open <file>" } },
  { id: "file.attach", title: "Attach File", category: "Workspace", slash: { name: "attach", usage: "/attach <file>" } },
  { id: "editor.focus", title: "Edit", category: "Editor", slash: { name: "edit" }, keybind: "editor_open" },
  { id: "editor.save", title: "Save Editor", category: "Editor", slash: { name: "save" } },
  { id: "editor.diagnostics", title: "Diagnostics", category: "Editor", slash: { name: "diagnostics" } },
  { id: "editor.diff", title: "Diff", category: "Editor", slash: { name: "diff", usage: "/diff [dismiss]" } },
  { id: "editor.close", title: "Close Editor", category: "Editor", slash: { name: "close-editor", aliases: ["close-editor!"] } },
  { id: "prompt.queue", title: "Prompt Queue", category: "Prompt", slash: { name: "queue" } },
  { id: "prompt.stash", title: "Prompt Stash", category: "Prompt", slash: { name: "stash", aliases: ["list", "pop"] } },
  { id: "prompt.shell", title: "Shell Mode", category: "Prompt", slash: { name: "shell" } },
  { id: "theme.list", title: "Themes", category: "System", slash: { name: "themes" }, keybind: "theme_list" },
  { id: "terminal.suspend", title: "Suspend", category: "System", slash: { name: "suspend" }, keybind: "terminal_suspend" },
  { id: "keybinds.list", title: "Keybinds", category: "System", slash: { name: "keybinds" } },
  { id: "clipboard.status", title: "Clipboard", category: "System", slash: { name: "clipboard" } },
  { id: "plugins.list", title: "Plugins", category: "System", slash: { name: "plugins", aliases: ["mcps"] }, keybind: "plugin_manager" },
  { id: "android.doctor", title: "Android Runtime", category: "System", slash: { name: "doctor" } },
]
const surfaceKeybinds = {
  command_list: "ctrl+p",
  session_new: "ctrl+x+n",
  session_list: "ctrl+x+l",
  session_tabs_next: "ctrl+x+]",
  session_child_first: "ctrl+x+down",
  session_timeline: "ctrl+x+g",
  status_view: "ctrl+x+s",
  session_compact: "ctrl+x+c",
  session_interrupt: "escape",
  messages_undo: "ctrl+x+u",
  messages_redo: "ctrl+x+r",
  session_rename: "ctrl+r",
  model_list: "ctrl+x+m",
  agent_list: "ctrl+x+a",
  sidebar_toggle: "ctrl+x+b",
  session_files: "ctrl+x+f",
  editor_open: "ctrl+x+e",
  theme_list: "ctrl+x+t",
  terminal_suspend: "ctrl+z",
  plugin_manager: "none",
}

function wide(char) {
  const code = char.codePointAt(0) || 0
  if ((code >= 0x2500 && code <= 0x259f) || (code >= 0x2800 && code <= 0x28ff)) return 1
  return code >= 0x1100 ? 2 : 1
}

function frame(raw, width, height) {
  const rows = Array.from({ length: height }, () => Array.from({ length: width }, () => " "))
  let x = 0
  let y = 0
  let saved = { x: 0, y: 0 }
  let best = ""
  const snapshot = () => {
    const value = rows.map((row) => row.join("")).join("\\n")
    if (value.trim()) best = value
    return value
  }
  const clear = () => rows.forEach((row) => row.fill(" "))
  const clearLine = (mode = 0) => {
    if (mode === 1) {
      for (let i = 0; i <= x && i < width; i++) rows[y][i] = " "
      return
    }
    if (mode === 2) {
      rows[y].fill(" ")
      return
    }
    for (let i = x; i < width; i++) rows[y][i] = " "
  }
  const put = (char) => {
    const cell = Math.max(1, wide(char))
    if (y >= height) return
    if (x >= width) {
      x = 0
      y++
      if (y >= height) return
    }
    rows[y][x] = char
    if (cell > 1 && x + 1 < width) rows[y][x + 1] = " "
    x += cell
    snapshot()
  }
  for (let i = 0; i < raw.length; ) {
    const char = raw[i]
    if (char === "\\u001b") {
      const next = raw[i + 1]
      if (next === "[") {
        let j = i + 2
        while (j < raw.length) {
          const code = raw.charCodeAt(j)
          if (code >= 0x40 && code <= 0x7e) break
          j++
        }
        const body = raw.slice(i + 2, j)
        const tail = raw[j]
        const value = Number(body) || 0
        if (tail === "H" || tail === "f") {
          const [row, col] = body.split(";").map((item) => Number(item) || 1)
          y = Math.max(0, Math.min(height - 1, row - 1))
          x = Math.max(0, Math.min(width - 1, col - 1))
        }
        if (tail === "A") y = Math.max(0, y - (value || 1))
        if (tail === "B") y = Math.min(height - 1, y + (value || 1))
        if (tail === "C") x = Math.min(width - 1, x + (value || 1))
        if (tail === "D") x = Math.max(0, x - (value || 1))
        if (tail === "G") x = Math.max(0, Math.min(width - 1, value - 1))
        if (tail === "d") y = Math.max(0, Math.min(height - 1, value - 1))
        if (tail === "J" && (value === 2 || value === 3)) clear()
        if (tail === "K") clearLine(value)
        if (tail === "s") saved = { x, y }
        if (tail === "u") {
          x = saved.x
          y = saved.y
        }
        if ((tail === "h" || tail === "l") && body === "?1049") {
          clear()
          x = 0
          y = 0
        }
        i = j + 1
        continue
      }
      if (next === "]") {
        let j = i + 2
        while (j < raw.length) {
          if (raw[j] === "\\u0007") {
            j++
            break
          }
          if (raw[j] === "\\u001b" && raw[j + 1] === "\\\\") {
            j += 2
            break
          }
          j++
        }
        i = j
        continue
      }
      i += 2
      continue
    }
    if (char === "\\r") {
      x = 0
      i++
      continue
    }
    if (char === "\\n") {
      y = Math.min(height - 1, y + 1)
      i++
      continue
    }
    if (char === "\\b") {
      x = Math.max(0, x - 1)
      i++
      continue
    }
    const code = raw.codePointAt(i)
    if (!code) {
      i++
      continue
    }
    put(String.fromCodePoint(code))
    i += code > 0xffff ? 2 : 1
  }
  const value = snapshot()
  return (value.trim() ? value : best).split("\\n")
}

function text(raw, width, height) {
  return frame(raw, width, height).join("\\n")
}

function json(res, value, status = 200) {
  res.writeHead(status, { "content-type": "application/json" })
  res.end(JSON.stringify(value))
}

function surfaceManifest() {
  return {
    version: 2,
    renderer: { linux: "opentui/solid", android: "ratatui/crossterm", frame: "shared/terminal-frame" },
    capabilities: {
      "android.runtime": true,
      clipboard: true,
      editor: true,
      "editor.websocket": true,
      "files.sidebar": true,
      "permissions.multi": true,
      "plugins.declarative": true,
      "prompt.fileParts": true,
      "prompt.history": true,
      "prompt.queue": true,
      "prompt.shell": true,
      "prompt.stash": true,
      "session.tabs": true,
      "terminal.mouse": false,
      "theme.switcher": false,
    },
    commands: surfaceCommands,
    keybinds: surfaceKeybinds,
    prompt: {
      maxHeight: 6,
      supportsFileParts: true,
      supportsShellMode: true,
      supportsHistory: true,
      supportsStash: true,
      supportsQueue: true,
    },
  }
}

function compact(value) {
  if (typeof value === "string") return value
  if (value == null) return ""
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function mergeDeep(target, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch
  const next = target && typeof target === "object" && !Array.isArray(target) ? { ...target } : {}
  for (const [key, value] of Object.entries(patch)) {
    next[key] = value && typeof value === "object" && !Array.isArray(value) ? mergeDeep(next[key], value) : value
  }
  return next
}

function partText(part) {
  if (part.type === "text" || part.type === "reasoning") return part.text || ""
  if (part.type === "file") return part.url || part.path || ""
  return ""
}

function toolPreview(part) {
  return compact(part.state && part.state.output)
    .split("\\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(0, 8)
}

function toolDiff(part) {
  const state = part.state || {}
  const diff = compact((part.metadata && part.metadata.diff) || (state.input && state.input.diff))
  return diff
    .split("\\n")
    .filter((line) => {
      return (
        line.startsWith("diff --git") ||
        line.startsWith("--- ") ||
        line.startsWith("+++ ") ||
        line.startsWith("@@") ||
        (line.startsWith("+") && !line.startsWith("+++")) ||
        (line.startsWith("-") && !line.startsWith("---"))
      )
    })
    .slice(0, 14)
}

function surfaceSnapshot(input, sessionID) {
  const home = input.noSession && !sessionID
  const activeID = home ? undefined : sessionID || "ses_termux"
  const title = activeID === "ses_fork" ? "Forked Session" : input.title
  const sessions = input.sessions || [{ id: "ses_termux", title: input.title }]
  const chunks = new Map((input.chunks || []).map((item) => [item.messageID, item.parts || []]))
  const transcript = (home ? [] : input.messages || []).map((message) => {
    const parts = chunks.get(message.id) || []
    return {
      id: message.id,
      role: message.role || "assistant",
      text: parts.map(partText).filter(Boolean).join("\\n") || undefined,
      tools: parts
        .filter((part) => part.type === "tool")
        .map((part) => {
          const preview = toolPreview(part)
          const diff = toolDiff(part)
          return {
            id: part.id || "prt_tool",
            tool: part.tool || "tool",
            status: compact(part.state && part.state.status) || "pending",
            preview,
            diff,
            expandable: preview.length >= 8 || diff.length >= 14,
          }
        }),
    }
  })
  return {
    version: 2,
    sessionID: activeID,
    title,
    status: "idle",
    header: { title },
    footer: {
      directory: process.env.HOME || "/data/data/com.termux/files/home",
      workspaceID: "wrk_termux",
      lsp: 1,
      mcp: 1,
      mcpFailed: false,
      permissions: input.permission ? 1 : 0,
    },
    tabs: home ? [] : sessions.slice(0, 8).map((item) => ({
      id: item.id,
      title: item.title || item.id,
      active: item.id === activeID,
      status: "idle",
    })),
    transcript,
    sidebar: {
      mode: "summary",
      rows: ["modified src/app.ts +2/-1", "added README.md +1/-0"],
    },
  }
}

function fitLine(text, width) {
  const raw = String(text || "").replace(/\\s+/g, " ")
  return raw.slice(0, width) + " ".repeat(Math.max(0, width - raw.length))
}

function rawFitLine(text, width) {
  const raw = String(text || "")
  const chars = Array.from(raw)
  return chars.slice(0, width).join("") + " ".repeat(Math.max(0, width - chars.length))
}

function drawCellLine(width, text, left = 0) {
  const row = Array.from({ length: width }, () => " ")
  let x = Math.max(0, left)
  for (const char of Array.from(String(text || ""))) {
    const cell = Math.max(1, wide(char))
    if (x >= width) break
    row[x] = char
    if (cell > 1 && x + 1 < width) row[x + 1] = " "
    x += cell
  }
  return row.join("")
}

function homeFooterLine(width, directory, version, mcp = 1, mcpFailed = false, workspace) {
  const left = [
    directory,
    workspace ? "workspace " + workspace : undefined,
    mcp > 0 || mcpFailed ? String(mcp) + " MCP" + (mcpFailed ? "!" : "") : undefined,
    mcp > 0 || mcpFailed ? "/status" : undefined,
  ].filter(Boolean).join(" | ")
  if (!left) return rawFitLine(version, width)
  if (Array.from(left).length + 1 + Array.from(version).length >= width) return rawFitLine(left + " | " + version, width)
  return rawFitLine(left + " ".repeat(width - Array.from(left).length - Array.from(version).length) + version, width)
}

function expectedHomeFrame(width, height, directory, version, mcp = 1, mcpFailed = false, workspace) {
  const lines = Array.from({ length: height }, () => " ".repeat(width))
  const logo = [
    "                                  ",
    "█▀▀ █   █▀█ █▀█  █▀▀ █▀█ █▀▄ █▀▀",
    "▀▀█ █   █ █ █▀▀  █   █ █ █ █ █▀▀",
    "▀▀▀ ▀▀▀ ▀▀▀ ▀    ▀▀▀ ▀▀▀ ▀▀  ▀▀▀",
  ]
  const logoStart = Math.max(1, Math.floor((height - 8) / 2))
  for (let index = 0; index < logo.length && logoStart + index < height; index++) {
    const left = Math.max(0, Math.floor((width - Array.from(logo[index]).length) / 2))
    lines[logoStart + index] = drawCellLine(width, logo[index], left)
  }
  const promptWidth = Math.min(75, width)
  const promptLeft = Math.max(0, Math.floor((width - promptWidth) / 2))
  const promptY = Math.min(height - 2, logoStart + logo.length + 2)
  lines[promptY] = rawFitLine(" ".repeat(promptLeft) + rawFitLine("> ", promptWidth), width)
  lines[height - 1] = homeFooterLine(width, directory, version, mcp, mcpFailed, workspace)
  return lines
}

function wrapLine(text, width) {
  const words = String(text || "").split(/\\s+/).filter(Boolean)
  const out = []
  let line = ""
  for (const word of words) {
    const next = line ? line + " " + word : word
    if (next.length <= width) {
      line = next
    } else {
      if (line) out.push(line)
      line = word.length <= width ? word : word.slice(0, width)
    }
  }
  if (line) out.push(line)
  return out.length ? out : [""]
}

function surfaceFrame(input, sessionID, width = 80, height = 24) {
  const snapshot = surfaceSnapshot(input, sessionID)
  width = Math.max(20, Math.min(240, Number(width) || 80))
  height = Math.max(8, Math.min(100, Number(height) || 24))
  if (!snapshot.sessionID && snapshot.transcript.length === 0) {
    const lines = expectedHomeFrame(
      width,
      height,
      snapshot.footer.directory,
      rootVersion,
      snapshot.footer.mcp,
      snapshot.footer.mcpFailed,
      snapshot.footer.workspaceID,
    )
    return {
      version: 2,
      renderer: "shared/terminal-frame",
      width,
      height,
      sessionID: snapshot.sessionID,
      title: snapshot.title,
      status: snapshot.status,
      lines,
      rows: lines.map((line, y) => ({ y, spans: [{ x: 0, text: line }] })),
    }
  }
  const transcript = []
  for (const message of snapshot.transcript) {
    const label = message.role === "user" ? "You" : "Assistant"
    if (message.text) transcript.push(...wrapLine(label + ": " + message.text, width))
    for (const tool of message.tools) {
      transcript.push(...wrapLine("tool " + tool.tool + " " + tool.status + (tool.expandable && tool.status === "completed" ? " [expanded]" : ""), width))
      for (const row of tool.preview) transcript.push(...wrapLine("output " + row, width))
      if (tool.expandable && tool.preview.length >= 8) transcript.push(...wrapLine("more line(s)", width))
      if (tool.diff.length > 0) transcript.push(...wrapLine("diff preview", width))
      for (const row of tool.diff) transcript.push(...wrapLine("diff " + row, width))
      if (tool.expandable && tool.diff.length >= 14) transcript.push(...wrapLine("more line(s)", width))
    }
    transcript.push("")
  }
  const sidebar = [snapshot.sidebar.mode === "files" ? "Files" : "Modified Files", ...snapshot.sidebar.rows]
  const body = [...transcript, "", ...sidebar]
  const footer = [snapshot.footer.directory, "workspace " + snapshot.footer.workspaceID, "lsp " + snapshot.footer.lsp, "mcp " + snapshot.footer.mcp]
    .filter(Boolean)
    .join(" | ")
  const lines = [
    fitLine("SlopCode | " + snapshot.header.title + " | " + snapshot.status, width),
    fitLine(snapshot.tabs.map((item) => (item.active ? "[*] " : "[ ] ") + item.title + " " + item.status).join("  "), width),
  ]
  while (lines.length < height - 2) lines.push(fitLine(body[lines.length - 2] || "", width))
  lines.push(fitLine("> ", width))
  lines.push(fitLine(footer, width))
  return {
    version: 2,
    renderer: "shared/terminal-frame",
    width,
    height,
    sessionID: snapshot.sessionID,
    title: snapshot.title,
    status: snapshot.status,
    lines,
    rows: lines.map((line, y) => ({ y, spans: [{ x: 0, text: line }] })),
  }
}

function selected() {
  return matrix.filter((item) => {
    if (!item.active) return false
    if (mode === "parity") return item.mode === "smoke" || item.mode === "parity"
    if (mode === "release") return item.mode === "release"
    return item.mode === "smoke"
  })
}

function read(req) {
  return new Promise((resolve) => {
    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", () => resolve(body ? JSON.parse(body) : {}))
  })
}

function websocketMessages(buffer) {
  const out = []
  for (let index = 0; index + 2 <= buffer.length; ) {
    const masked = (buffer[index + 1] & 0x80) !== 0
    let length = buffer[index + 1] & 0x7f
    index += 2
    if (length === 126) {
      length = buffer.readUInt16BE(index)
      index += 2
    } else if (length === 127) {
      length = Number(buffer.readBigUInt64BE(index))
      index += 8
    }
    const mask = masked ? buffer.subarray(index, index + 4) : undefined
    if (masked) index += 4
    const payload = buffer.subarray(index, index + length)
    index += length
    if (mask) {
      const decoded = Buffer.alloc(payload.length)
      for (let i = 0; i < payload.length; i++) decoded[i] = payload[i] ^ mask[i % 4]
      out.push(decoded.toString("utf8"))
    } else {
      out.push(payload.toString("utf8"))
    }
  }
  return out
}

async function runHost(input) {
  const state = { actions: [], bodies: [], replies: [], permissions: [], shells: [], summaries: [], editorInputs: [], configPatches: [], seen: [] }
  let config = {
    model: "openai/gpt-5",
    shell: { program: "/data/data/com.termux/files/usr/bin/bash", timeout_ms: 300000 },
    autocomplete: { provider_model_overrides: { anthropic: "claude-sonnet" } },
    provider: { openai: { apiKey: "test" } },
    plugin: ["file:///data/data/com.termux/files/home/.slopcode/plugin/sample.js"],
    plugin_origins: [
      { spec: "file:///data/data/com.termux/files/home/.slopcode/plugin/sample.js", scope: "local", source: ".slopcode/plugin/sample.js" },
    ],
  }
  const editorState = { dirty: true, diff: true, content: "console.log('ok')" }
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1")
    state.seen.push(req.method + " " + url.pathname)
    if (url.pathname === "/tui/manifest") return json(res, surfaceManifest())
    if (url.pathname === "/tui/snapshot") return json(res, surfaceSnapshot(input, url.searchParams.get("sessionID")))
    if (url.pathname === "/tui/frame") return json(res, surfaceFrame(input, url.searchParams.get("sessionID"), url.searchParams.get("width"), url.searchParams.get("height")))
    if (url.pathname === "/tui/action" && req.method === "POST") {
      state.actions.push(await read(req))
      return json(res, true)
    }
    if (url.pathname === "/config" && req.method === "GET") return json(res, config)
    if (url.pathname === "/global/config" && req.method === "GET") return json(res, config)
    if (url.pathname === "/global/config" && req.method === "PATCH") {
      const patch = await read(req)
      state.configPatches.push(patch)
      config = mergeDeep(config, patch)
      return json(res, config)
    }
    if (url.pathname === "/global/dispose" && req.method === "POST") return json(res, true)
    if (url.pathname === "/pty/shells") return json(res, [
      { path: "/data/data/com.termux/files/usr/bin/bash", name: "bash", acceptable: true },
      { path: "/data/data/com.termux/files/usr/bin/zsh", name: "zsh", acceptable: true },
      { path: "/system/bin/sh", name: "android-sh", acceptable: false },
    ])
    if (url.pathname === "/command") return json(res, [
      { name: "sample-skill", source: "skill", description: "Sample skill command" },
      { name: "sample-mcp", source: "mcp", description: "Sample MCP command" },
    ])
    if (url.pathname === "/session" && req.method === "POST") return json(res, { id: "ses_termux", title: input.title })
    if (url.pathname === "/session" && req.method === "GET") return json(res, input.sessions || [{ id: "ses_termux", title: input.title }])
    if (url.pathname === "/session/ses_termux" && req.method === "GET") return json(res, { id: "ses_termux", title: input.title })
    if (url.pathname === "/session/ses_termux" && req.method === "PATCH") {
      const body = await read(req)
      return json(res, { id: "ses_termux", title: body.title || input.title })
    }
    if (url.pathname === "/session/ses_termux/fork" && req.method === "POST") return json(res, { id: "ses_fork", title: "Forked Session" })
    if (url.pathname === "/session/ses_fork" && req.method === "GET") return json(res, { id: "ses_fork", title: "Forked Session" })
    if (url.pathname === "/session/ses_fork/message/index") return json(res, [])
    if (url.pathname === "/session/ses_termux/share" && req.method === "POST") return json(res, { id: "ses_termux", title: input.title, share: { url: "https://share.example/ses_termux" } })
    if (url.pathname === "/session/ses_termux/share" && req.method === "DELETE") return json(res, { id: "ses_termux", title: input.title })
    if (url.pathname === "/session/ses_termux/abort" && req.method === "POST") return json(res, true)
    if (url.pathname === "/session/ses_termux/pause" && req.method === "POST") return json(res, true)
    if (url.pathname === "/session/ses_termux/resume" && req.method === "POST") return json(res, true)
    if (url.pathname === "/session/ses_termux/summarize" && req.method === "POST") {
      state.summaries.push(await read(req))
      return json(res, true)
    }
    if (url.pathname === "/session/ses_termux/children") return json(res, [{ id: "ses_child", title: "Child Session" }])
    if (url.pathname === "/session/ses_termux/diff/index") return json(res, [{ file: "src/app.ts", added: 2, removed: 1 }])
    if (url.pathname === "/editor" && req.method === "POST") return json(res, { id: "edt_termux", sessionID: "ses_termux", file: "src/app.ts", dirty: true, diff: true })
    if (url.pathname === "/editor/edt_termux/snapshot") return json(res, { file: "src/app.ts", dirty: editorState.dirty, diff: editorState.diff, content: editorState.content, diagnostics: [{ line: 1, column: 1, severity: "error", message: "expected semicolon" }] })
    if (url.pathname === "/editor/edt_termux/save" && req.method === "POST") {
      editorState.dirty = false
      return json(res, { id: "edt_termux", sessionID: "ses_termux", file: "src/app.ts", dirty: false, diff: editorState.diff })
    }
    if (url.pathname === "/editor/edt_termux/diff/dismiss" && req.method === "POST") {
      editorState.diff = false
      return json(res, { id: "edt_termux", sessionID: "ses_termux", file: "src/app.ts", dirty: editorState.dirty, diff: false })
    }
    if (url.pathname === "/editor/edt_termux" && req.method === "DELETE") return json(res, true)
    if (url.pathname === "/session/ses_termux/message/index") return json(res, input.messages || [])
    if (url.pathname === "/session/ses_termux/message/chunk") return json(res, input.chunks || [])
    if (url.pathname === "/session/ses_termux/prompt_async" && req.method === "POST") {
      state.bodies.push(await read(req))
      res.writeHead(204)
      res.end()
      return
    }
    if (url.pathname === "/session/ses_termux/shell" && req.method === "POST") {
      state.shells.push(await read(req))
      return json(res, { id: "msg_shell", sessionID: "ses_termux", role: "assistant" })
    }
    if (url.pathname === "/session/ses_termux/revert" && req.method === "POST") return json(res, { id: "ses_termux", title: input.title })
    if (url.pathname === "/session/ses_termux/unrevert" && req.method === "POST") return json(res, { id: "ses_termux", title: input.title })
    if (url.pathname === "/question/que_termux/reply" && req.method === "POST") {
      state.replies.push(await read(req))
      return json(res, {})
    }
    if (url.pathname === "/permission/perm_termux/reply" && req.method === "POST") {
      state.permissions.push(await read(req))
      return json(res, {})
    }
    if (url.pathname === "/v2/model") return json(res, [
      { providerID: "openai", id: "gpt-5", name: "GPT 5", release_date: "2026-01-01", variants: { fast: {}, thoughtful: {} } },
      { providerID: "anthropic", id: "claude-sonnet", name: "Claude Sonnet", release_date: "2025-12-01", variants: { haiku: {} } },
    ])
    if (url.pathname === "/v2/provider") return json(res, [
      { id: "openai", name: "OpenAI", models: { "gpt-5": { id: "gpt-5", name: "GPT 5", modalities: { input: ["text"], output: ["text"] }, variants: { fast: {}, thoughtful: {} } } } },
      { id: "anthropic", name: "Anthropic", models: { "claude-sonnet": { id: "claude-sonnet", name: "Claude Sonnet", modalities: { input: ["text"], output: ["text"] }, variants: { haiku: {} } } } },
    ])
    if (url.pathname === "/file/status") return json(res, [
      { path: "src/app.ts", status: "modified" },
      { path: "README.md", status: "added" },
    ])
    if (url.pathname === "/file") return json(res, [
      { path: "src/app.ts", name: "app.ts", type: "file" },
      { path: "src/cli", name: "cli", type: "directory" },
    ])
    if (url.pathname === "/file/content") return json(res, { content: "console.log('ok')" })
    if (url.pathname === "/file/find/file") return json(res, ["src/app.ts", "src/cli/index.ts"])
    if (url.pathname === "/session/status") return json(res, { ses_termux: { type: "idle", phase: "idle" } })
    if (url.pathname === "/event") {
      res.writeHead(200, { "content-type": "text/event-stream" })
      res.write('data: {"type":"server.connected"}\\n\\n')
      if (input.question) {
        res.write('data: {"type":"question.asked","properties":{"id":"que_termux","sessionID":"ses_termux","questions":[{"header":"Mode","question":"Pick one","options":[{"label":"Yes","description":"ok"}]}]}}\\n\\n')
      }
      if (input.permission) {
        res.write('data: {"type":"permission.asked","properties":{"id":"perm_termux","sessionID":"ses_termux","permission":"edit","patterns":["src/app.ts"],"metadata":{"filepath":"src/app.ts","diff":"+hello\\\\n-world"}}}\\n\\n')
      }
      setTimeout(() => res.end(), 1000)
      return
    }
    return json(res, {})
  })
  server.on("upgrade", (req, socket) => {
    const url = new URL(req.url || "/", "http://127.0.0.1")
    state.seen.push("GET " + url.pathname)
    if (url.pathname !== "/editor/edt_termux/connect") {
      socket.destroy()
      return
    }
    socket.write("HTTP/1.1 101 Switching Protocols\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\n\\r\\n")
    socket.on("data", (chunk) => {
      for (const message of websocketMessages(chunk)) {
        const parsed = JSON.parse(message)
        state.editorInputs.push(parsed)
        if (parsed.type === "paste") {
          editorState.content += parsed.text || ""
          editorState.dirty = true
        }
        if (parsed.type === "input" && parsed.keys && !parsed.keys.startsWith("<")) {
          editorState.content += parsed.keys
          editorState.dirty = true
        }
      }
    })
  })


  try {
    await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", (error) => (error ? reject(error) : resolve())))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("missing mock server port")
    const child = spawn(host, ["--url", "http://127.0.0.1:" + address.port, "--token", "test", ...(input.args || [])], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, COLUMNS: String(input.width || 100), LINES: String(input.height || 30), TERM: "xterm-256color" },
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => (stdout += chunk))
    child.stderr.on("data", (chunk) => (stderr += chunk))
    const exit = new Promise((resolve, reject) => {
      child.on("error", reject)
      child.on("exit", (code) => resolve(code))
    })
    for (const step of input.steps || [{ delay: 150, text: "/exit\\r" }]) {
      await sleep(step.delay)
      child.stdin.write(step.text)
    }
    child.stdin.end()
    const code = await Promise.race([
      exit,
      sleep(input.timeout || 8000).then(() => {
        child.kill()
        throw new Error("host timed out")
      }),
    ])
    if (code !== 0) throw new Error(stderr || stdout || "sidecar exited " + code)
    return { ...state, stdout, stderr, screen: text(stdout, input.width || 100, input.height || 30) }
  } finally {
    server.close()
  }
}

function assert(value, message) {
  if (!value) throw new Error(message)
}

function semantic(run, tokens) {
  const value = run.screen + "\\n" + run.stdout
  for (const token of tokens) assert(value.includes(token), "missing semantic token " + token + "\\n" + value)
  return tokens
}


const actions = {
  "smoke.install": async () => {
    const cli = spawnSync(cliPath, ["--version"], { encoding: "utf8" })
    assert(cli.status === 0, cli.error?.message || cli.stderr || cli.stdout || "slopcode --version failed")
    const self = spawnSync(host, ["--self-test"], { encoding: "utf8" })
    assert(self.status === 0 && self.stdout.includes("slopcode-android-host ok"), self.stderr || self.stdout || "sidecar self-test failed")
    const doctor = spawnSync(cliPath, ["doctor", "android", "--json"], { encoding: "utf8", env: { ...process.env, SLOPCODE_ANDROID_HOST_PATH: host } })
    assert(doctor.status === 0, doctor.stderr || doctor.stdout || "slopcode doctor android failed")
    const info = JSON.parse(doctor.stdout)
    assert(info.sidecar === host && info.sidecarExists === true, "doctor did not report sidecar " + doctor.stdout)
    assert(info.strategy === "rust" && info.bun === null, "doctor did not report Rust runtime " + doctor.stdout)
    assert(fs.existsSync(path.join(root, "slopcode", "bundle", "index.js")), "root package missing Android bundle")
    assert(fs.existsSync(path.join(root, "slopcode", "node_modules", "@oven")), "root package missing Android Bun bootstrap")
    assert(!fs.existsSync(path.join(androidRoot, "bundle", "index.js")), "Android package includes JS bundle")
    assert(!fs.existsSync(path.join(androidRoot, "node_modules", "@oven")), "Android package includes Bun runtime")
    const boot = spawnSync("sh", ["-lc", "timeout 60 " + cliPath + " --print-logs || true"], {
      encoding: "utf8",
      env: { ...process.env, COLUMNS: "100", LINES: "30", TERM: "xterm-256color" },
    })
    const bootText = (boot.stdout || "") + (boot.stderr || "")
    assert(!bootText.includes("missing --url"), "plain slopcode still requires daemon args\\n" + bootText)
    const bootRows = frame(bootText, 100, 30)
    const expected = expectedHomeFrame(100, 30, process.env.HOME || "/data/data/com.termux/files/home", rootVersion, 0, false)
    for (const row of [12, 13, 14, 17, 29]) {
      assert(bootRows[row] === expected[row], "plain home row " + row + " diverged from canonical landing\\nexpected: " + expected[row] + "\\nactual:   " + bootRows[row] + "\\nraw:\\n" + bootText)
    }
  },
  "release.rust-tui-smoke": async () => actions["smoke.install"](),
  "native.rust-tui": async () => {
    const self = spawnSync(host, ["--self-test"], { encoding: "utf8" })
    assert(self.status === 0 && self.stdout.includes("slopcode-android-tui ok"), self.stderr || self.stdout || "native TUI self-test failed")
    const doctor = spawnSync(cliPath, ["doctor", "android", "--json"], { encoding: "utf8", env: { ...process.env, SLOPCODE_ANDROID_HOST_PATH: host } })
    assert(doctor.status === 0, doctor.stderr || doctor.stdout || "slopcode doctor android failed")
    const info = JSON.parse(doctor.stdout)
    assert(info.renderer === "ratatui/crossterm" && info.tuiCoreVersion === "rust-ratatui-1", "doctor did not report Rust TUI core " + doctor.stdout)
    const run = await runHost({
      title: "Native Rust",
      steps: [
        { delay: 150, text: "native" },
        { delay: 50, text: "\\x1b[200~ paste\\x1b[201~" },
        { delay: 100, text: "\\r" },
        { delay: 100, text: "\\x04" },
      ],
    })
    assert(run.bodies[0]?.parts?.[0]?.text === "native paste", "bracketed paste did not submit through Rust TUI " + JSON.stringify(run.bodies))
  },
  "surface.contract": async () => {
    const run = await runHost({
      title: "Surface Contract",
      width: 104,
      height: 32,
      sessions: [
        { id: "ses_termux", title: "Surface Contract" },
        { id: "ses_other", title: "Other Surface Session" },
      ],
      messages: [{ id: "msg_surface", sessionID: "ses_termux", role: "assistant" }],
      chunks: [
        {
          messageID: "msg_surface",
          parts: [
            { id: "prt_surface_text", type: "text", text: "surface transcript" },
            {
              id: "prt_surface_tool",
              type: "tool",
              tool: "edit",
              state: { status: "completed", output: "surface output" },
              metadata: { diff: "--- a/src/app.ts\\n+++ b/src/app.ts\\n@@ -1 +1 @@\\n-old\\n+surface" },
            },
          ],
        },
      ],
      steps: [
        { delay: 250, text: "/doctor\\r" },
        { delay: 200, text: "/commands files\\r" },
        { delay: 150, text: "\\x04" },
      ],
    })
    const rendered = run.screen + "\\n" + run.stdout
    assert(run.seen.includes("GET /tui/manifest"), "missing shared manifest route " + JSON.stringify(run.seen))
    assert(run.seen.includes("GET /tui/snapshot"), "missing shared snapshot route " + JSON.stringify(run.seen))
    assert(run.seen.includes("GET /tui/frame"), "missing shared frame route " + JSON.stringify(run.seen))
    assert(!rendered.includes("shared manifest fallback"), "manifest fallback was used\\n" + rendered)
    assert(rendered.includes("Surface Contract"), "missing snapshot title\\n" + rendered)
    assert(rendered.includes("[*] Surface Contract"), "missing snapshot-backed tab strip\\n" + rendered)
    assert(rendered.includes("workspace wrk_termux"), "missing shared footer workspace\\n" + rendered)
    assert(rendered.includes("surface transcript"), "missing snapshot transcript text\\n" + rendered)
    assert(rendered.includes("tool") && rendered.includes("edit") && rendered.includes("completed"), "missing snapshot tool row\\n" + rendered)
    assert(rendered.includes("diff") && rendered.includes("+surface"), "missing snapshot diff preview\\n" + rendered)
    assert(rendered.includes("/files") && rendered.includes("Command Palette"), "missing manifest-backed command palette\\n" + rendered)
    assert(rendered.includes("shared") && rendered.includes("manifest") && rendered.includes("commands"), "missing doctor manifest count\\n" + rendered)
    assert(rendered.includes("snapshot-backed") && rendered.includes("transcript") && rendered.includes("footer") && rendered.includes("tabs"), "missing doctor snapshot status\\n" + rendered)
  },
  "home.landing": async () => {
    const width = 100
    const height = 30
    const run = await runHost({
      title: "Home Landing",
      noSession: true,
      width,
      height,
      steps: [
        { delay: 150, text: "hello from home\\r" },
        { delay: 150, text: "\\x04" },
      ],
    })
    semantic(run, ["█▀▀ █   █▀█ █▀█", "/status"])
    const version = spawnSync(host, ["--version"], { encoding: "utf8" }).stdout.trim() || "dev"
    const expected = expectedHomeFrame(width, height, process.env.HOME || "/data/data/com.termux/files/home", version, 1, false, "wrk_termux")
    const rows = run.screen.split("\\n")
    for (const row of [11, 12, 13, 14, 17, 29]) {
      assert(rows[row] === expected[row], "home row " + row + " diverged from canonical landing\\nexpected: " + expected[row] + "\\nactual:   " + rows[row] + "\\n" + run.screen)
    }
    assert(!run.stdout.includes("info: connected"), "home should use compact connected status, not a notice\\n" + run.stdout)
    assert(!run.stdout.includes("SlopCode Android |"), "home should not expose Android runtime chrome\\n" + run.stdout)
    assert(!run.stdout.includes("Rust-native Termux TUI"), "home should not expose Android-only landing copy\\n" + run.stdout)
    assert(!run.screen.includes("SlopCode Android |") && !run.screen.includes("Rust-native Termux TUI") && !run.screen.includes("/help"), "home diverged from shared landing frame\\n" + run.screen)
    assert(run.seen.includes("POST /session"), "home prompt did not lazily create a session " + JSON.stringify(run.seen))
    assert(run.bodies[0]?.parts?.[0]?.text === "hello from home", "home prompt did not submit " + JSON.stringify(run.bodies))
  },
  "composer.submit": async () => {
    const run = await runHost({ title: "Submit Session", args: ["--prompt", "hello"], steps: [{ delay: 150, text: "/exit\\r" }] })
    const body = run.bodies[0]
    assert(body?.messageID?.startsWith("msg_"), "missing message id " + JSON.stringify(body))
    assert(body?.parts?.[0]?.id?.startsWith("prt_"), "missing part id " + JSON.stringify(body))
    assert(body?.parts?.[0]?.text === "hello", "unexpected prompt body " + JSON.stringify(body))
  },
  "composer.editing": async () => {
    const run = await runHost({
      title: "Input Session",
      steps: [
        { delay: 100, text: "\\x1b[200~hello\\nworld\\x1b[201~\\r" },
        { delay: 100, text: "first\\r" },
        { delay: 100, text: "\\x1b[A again\\r" },
        { delay: 100, text: "\\x04" },
      ],
    })
    assert(JSON.stringify(run.bodies.map((item) => item.parts?.[0]?.text)) === JSON.stringify(["hello\\nworld", "first", "first again"]), "unexpected editing bodies " + JSON.stringify(run.bodies))
  },
  "composer.advanced": async () => {
    const run = await runHost({
      title: "Advanced Composer",
      steps: [
        { delay: 100, text: "draft\\x1b[24~" },
        { delay: 100, text: "/list\\r" },
        { delay: 100, text: "\\x1b[25~\\t\\r" },
        { delay: 100, text: "/shell-mode\\r" },
        { delay: 100, text: "ls\\r" },
        { delay: 100, text: "/queue\\r" },
        { delay: 100, text: "\\x04" },
      ],
    })
    assert(run.bodies[0]?.parts?.[0]?.text === "draft", "stash/pop/autocomplete did not submit draft " + JSON.stringify(run.bodies))
    assert(run.shells[0]?.command === "ls", "shell mode did not hit shell route " + JSON.stringify(run.shells))
    assert(
      run.screen.includes("Prompt Queue") || run.stdout.includes("Prompt Queue") || run.screen.includes("queue empty") || run.stdout.includes("queue empty"),
      "missing queue panel\\n" + run.screen,
    )
  },
  "dialogs.question": async () => {
    const run = await runHost({ title: "Question Session", question: true, steps: [{ delay: 200, text: "1\\r" }, { delay: 100, text: "\\x04" }] })
    assert(JSON.stringify(run.replies) === JSON.stringify([{ answers: [["Yes"]] }]), "unexpected replies " + JSON.stringify(run.replies))
  },
  "layout.capture": async () => {
    const run = await runHost({
      title: "Layout Session",
      width: 80,
      height: 24,
      args: ["--prompt", "layout probe"],
      steps: [{ delay: 300, text: "/exit\\r" }],
    })
    const text = run.screen + "\\n" + run.stdout
    assert(text.includes("Layout Session") || text.includes("█▀▀ █   █▀█ █▀█"), "screen missing expected content\\n" + run.screen + "\\nraw:\\n" + run.stdout)
    assert(text.includes("SlopCode"), "screen missing chrome\\n" + run.screen + "\\nraw:\\n" + run.stdout)
    assert(!text.includes("SlopCode Android |"), "screen should use neutral Linux-like chrome\\n" + run.screen + "\\nraw:\\n" + run.stdout)
    assert(!text.includes("Fix a TODO in the codebase"), "screen should not fall back to the old Android home\\n" + run.screen + "\\nraw:\\n" + run.stdout)
  },

  "commands.palette": async () => {
    const run = await runHost({
      title: "Command Session",
      steps: [
        { delay: 150, text: "\\x10" },
        { delay: 150, text: "\\x18f" },
        { delay: 150, text: "\\x18m" },
        { delay: 150, text: "\\x18s" },
        { delay: 150, text: "\\x1a" },
        { delay: 150, text: "/se\\r" },
        { delay: 150, text: "/commands\\r" },
        { delay: 150, text: "/commands model\\r" },
        { delay: 150, text: "/cl\\t\\u0015" },
        { delay: 150, text: "\\x04" },
      ],
    })
    semantic(run, ["Command Palette", "/models"])
    const rendered = run.screen + "\\n" + run.stdout
    assert(rendered.includes("Command Matches") && rendered.includes("/session") && rendered.includes("/se"), "partial slash submit did not keep command matches open\\n" + rendered)
    assert(
      rendered.includes("Command Matches") || (rendered.includes("/close-editor") && rendered.includes("/clipboard")),
      "missing command autocomplete panel\\n" + rendered,
    )
  },
  "sessions.tabs": async () => {
    const run = await runHost({
      title: "Tab Session",
      sessions: [
        { id: "ses_termux", title: "Tab Session" },
        { id: "ses_other", title: "Other Session" },
      ],
      steps: [{ delay: 150, text: "/sessions\\r" }, { delay: 150, text: "/tabs\\r" }, { delay: 150, text: "\\x04" }],
    })
    assert(run.screen.includes("Sessions") || run.stdout.includes("Sessions"), "missing sessions panel\\n" + run.screen)
    const rendered = run.screen + "\\n" + run.stdout
    assert(rendered.toLowerCase().includes("tabs"), "missing tab strip\\n" + run.screen)
    assert(rendered.includes("[close"), "missing close affordance\\n" + rendered)
  },
  "tabs.rich": async () => {
    const run = await runHost({
      title: "Rich Tabs",
      steps: [
        { delay: 150, text: "/open src/app.ts\\r" },
        { delay: 150, text: "/tabs\\r" },
        { delay: 150, text: "/close\\r" },
        { delay: 150, text: "\\x04" },
      ],
    })
    const rendered = run.screen + "\\n" + run.stdout
    assert(rendered.includes("[close"), "missing tab close affordance\\n" + rendered)
    assert(rendered.includes("*"), "missing dirty tab marker\\n" + rendered)
    assert(rendered.includes("closed last tab"), "missing last tab close\\n" + rendered)
    assert(run.seen.includes("POST /editor"), "missing editor tab setup " + JSON.stringify(run.seen))
  },
  "sessions.routes": async () => {
    const run = await runHost({
      title: "Route Session",
      messages: [{ id: "msg_route", sessionID: "ses_termux", role: "user", time: { created: 1 } }],
      steps: [
        { delay: 100, text: "/children\\r" },
        { delay: 100, text: "/messages\\r" },
        { delay: 100, text: "/timeline\\r" },
        { delay: 100, text: "/revert msg_route\\r" },
        { delay: 100, text: "/unrevert\\r" },
        { delay: 100, text: "\\x04" },
      ],
    })
    assert(run.seen.includes("GET /session/ses_termux/children"), "missing children route " + JSON.stringify(run.seen))
    assert(run.seen.includes("GET /tui/snapshot"), "missing shared startup snapshot " + JSON.stringify(run.seen))
    assert(run.seen.includes("GET /tui/frame"), "missing shared startup frame " + JSON.stringify(run.seen))
    assert(run.seen.filter((item) => item === "GET /session/ses_termux/message/index").length >= 2, "missing timeline/history routes " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /session/ses_termux/revert"), "missing revert route " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /session/ses_termux/unrevert"), "missing unrevert route " + JSON.stringify(run.seen))
  },
  "sessions.controls": async () => {
    const run = await runHost({
      title: "Control Session",
      steps: [
        { delay: 100, text: "/status\\r" },
        { delay: 100, text: "/share\\r" },
        { delay: 100, text: "/unshare\\r" },
        { delay: 100, text: "/pause\\r" },
        { delay: 100, text: "/resume-session\\r" },
        { delay: 100, text: "/model openai/gpt-5\\r" },
        { delay: 100, text: "/compact\\r" },
        { delay: 100, text: "/interrupt\\r" },
        { delay: 100, text: "/fork\\r" },
        { delay: 100, text: "\\x04" },
      ],
    })
    assert(run.seen.includes("GET /session/status"), "missing status route " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /session/ses_termux/share"), "missing share route " + JSON.stringify(run.seen))
    assert(run.seen.includes("DELETE /session/ses_termux/share"), "missing unshare route " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /session/ses_termux/pause"), "missing pause route " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /session/ses_termux/resume"), "missing resume route " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /session/ses_termux/summarize"), "missing compact route " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /session/ses_termux/abort"), "missing interrupt route " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /session/ses_termux/fork"), "missing fork route " + JSON.stringify(run.seen))
    assert(run.seen.filter((item) => item === "GET /tui/snapshot").length >= 2, "missing fork snapshot activation " + JSON.stringify(run.seen))
    assert(
      run.summaries[0]?.providerID === "openai" && run.summaries[0]?.modelID === "gpt-5",
      "compact did not send selected model " + JSON.stringify(run.summaries),
    )
    assert(run.screen.includes("Status") || run.stdout.includes("Status"), "missing status panel\\n" + run.screen)
  },
  "models.panel": async () => {
    const run = await runHost({
      title: "Model Session",
      steps: [{ delay: 150, text: "/models\\r" }, { delay: 150, text: "/model openai/gpt-5\\r" }, { delay: 150, text: "hello\\r" }, { delay: 150, text: "\\x04" }],
    })
    assert(run.screen.includes("Models") || run.stdout.includes("Models"), "missing models panel\\n" + run.screen)
    assert(run.bodies[0]?.model?.providerID === "openai" && run.bodies[0]?.model?.modelID === "gpt-5", "missing selected model " + JSON.stringify(run.bodies))
  },
  "commands.linux-parity": async () => {
    const run = await runHost({
      title: "Linux Command Parity",
      steps: [
        { delay: 150, text: "/models-completion\\r" },
        { delay: 150, text: "/models-completion openai/gpt-5\\r" },
        { delay: 150, text: "/variants\\r" },
        { delay: 150, text: "/shells\\r" },
        { delay: 150, text: "/shell /data/data/com.termux/files/usr/bin/zsh\\r" },
        { delay: 150, text: "/orgs\\r" },
        { delay: 150, text: "/plugins\\r" },
        { delay: 150, text: "/skills\\r" },
        { delay: 150, text: "/history\\r" },
        { delay: 150, text: "/timestamps\\r" },
        { delay: 150, text: "/thinking\\r" },
        { delay: 150, text: "\\x04" },
      ],
    })
    const rendered = run.screen + "\\n" + run.stdout
    assert(rendered.includes("Autocomplete Model") && rendered.includes("OpenAI"), "missing autocomplete model panel\\n" + rendered)
    assert(rendered.includes("Variants") && rendered.includes("Variant fast"), "missing variants panel\\n" + rendered)
    assert(rendered.includes("Shells") && rendered.includes("zsh"), "missing shell list\\n" + rendered)
    assert(rendered.includes("Console Orgs") && rendered.includes("OpenAI"), "missing console org/provider list\\n" + rendered)
    assert(rendered.includes("Plugins") && rendered.includes("sample.js"), "missing plugin list\\n" + rendered)
    assert(rendered.includes("Skills") && rendered.includes("sample-skill"), "missing skill command list\\n" + rendered)
    assert(rendered.includes("History mode") && rendered.includes("timestamps shown") && rendered.includes("thinking hidden"), "missing toggle state\\n" + rendered)
    assert(run.seen.includes("GET /config"), "missing config route " + JSON.stringify(run.seen))
    assert(run.seen.includes("GET /v2/provider") && run.seen.includes("GET /v2/model"), "missing provider/model routes " + JSON.stringify(run.seen))
    assert(run.seen.includes("GET /pty/shells"), "missing shell route " + JSON.stringify(run.seen))
    assert(run.seen.includes("GET /command"), "missing command route " + JSON.stringify(run.seen))
    assert(run.seen.filter((item) => item === "PATCH /global/config").length >= 2, "missing global config updates " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /global/dispose"), "missing dispose after config update " + JSON.stringify(run.seen))
    assert(run.configPatches.some((item) => item.autocomplete?.provider_model_overrides?.openai === "gpt-5"), "missing autocomplete patch " + JSON.stringify(run.configPatches))
    assert(run.configPatches.some((item) => item.shell?.program?.includes("zsh")), "missing shell patch " + JSON.stringify(run.configPatches))
  },
  "files.panel": async () => {
    const run = await runHost({ title: "Files Session", steps: [{ delay: 150, text: "/files\\r" }, { delay: 150, text: "/files app\\r" }, { delay: 150, text: "\\x04" }] })
    assert(run.screen.includes("Files") || run.stdout.includes("Files"), "missing files panel\\n" + run.screen)
    assert(run.screen.includes("src/app.ts") || run.stdout.includes("src/app.ts"), "missing file row\\n" + run.screen)
  },
  "render.tools": async () => {
    const run = await runHost({
      title: "Render Session",
      args: ["--prompt", "render probe"],
      messages: [{ id: "msg_tool", role: "assistant" }],
      chunks: [{ messageID: "msg_tool", parts: [{ type: "text", text: "Done" }, { type: "tool", tool: "edit", state: { status: "completed", output: "patched" }, metadata: { diff: "+next\\n-prev" } }] }],
      steps: [{ delay: 300, text: "\\x04" }],
    })
    assert(run.screen.includes("tool edit completed") || run.stdout.includes("tool edit completed"), "missing tool card\\n" + run.screen)
    assert(run.screen.includes("+next") || run.stdout.includes("+next"), "missing diff preview\\n" + run.screen)
  },
  "permissions.preview": async () => {
    const run = await runHost({ title: "Permission Session", permission: true, steps: [{ delay: 500, text: "a" }, { delay: 100, text: "\\x04" }] })
    assert(JSON.stringify(run.permissions) === JSON.stringify([{ reply: "always" }]), "unexpected permission replies " + JSON.stringify(run.permissions))
    assert(run.screen.includes("permission") || run.stdout.includes("permission"), "missing permission panel\\n" + run.screen)
  },
  "editor.diff": async () => {
    const run = await runHost({
      title: "Editor Session",
      steps: [
        { delay: 150, text: "/open src/app.ts\\r" },
        { delay: 150, text: "/diagnostics\\r" },
        { delay: 150, text: "/edit\\r" },
        { delay: 150, text: "x\\u0013\\u0004\\u0011" },
        { delay: 150, text: "/close-editor\\r" },
        { delay: 150, text: "\\x04" },
      ],
    })
    const rendered = run.screen + "\\n" + run.stdout
    const normalized = rendered.replace(/\\s+/g, "")
    assert(rendered.includes("Editor"), "missing editor panel\\\\n" + rendered)
    assert(rendered.includes("expected") && rendered.includes("semicolon"), "missing diagnostics\\\\n" + rendered)
    assert(rendered.includes("console.log('ok')"), "missing editor preview\\n" + rendered)
    assert(
      rendered.includes("input focus") || rendered.includes("input focu") || rendered.includes("saved src/app.ts") || (normalized.includes("dirtyno") && normalized.includes("diffdismissed")),
      "missing editor input/save\\\\n" + rendered,
    )
    assert(run.seen.includes("POST /editor"), "missing editor open " + JSON.stringify(run.seen))
    assert(run.seen.includes("GET /editor/edt_termux/connect"), "missing editor input websocket " + JSON.stringify(run.seen))
    assert(run.seen.includes("GET /editor/edt_termux/snapshot"), "missing editor snapshot " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /editor/edt_termux/save"), "missing editor save " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /editor/edt_termux/diff/dismiss"), "missing diff dismiss " + JSON.stringify(run.seen))
    assert(run.seen.includes("DELETE /editor/edt_termux"), "missing editor close " + JSON.stringify(run.seen))
    assert(run.editorInputs.some((item) => item.type === "input" && item.keys === "x"), "missing editor key input " + JSON.stringify(run.editorInputs))
  },
  "terminal.polish": async () => {
    const run = await runHost({
      title: "Polish Session",
      steps: [
        { delay: 150, text: "/themes\\r" },
        { delay: 150, text: "/keybinds\\r" },
        { delay: 150, text: "/clipboard\\r" },
        { delay: 150, text: "/title Android Title\\r" },
        { delay: 150, text: "/suspend\\r" },
        { delay: 150, text: "/plugins\\r" },
        { delay: 150, text: "\\x04" },
      ],
    })
    const rendered = run.screen + "\\n" + run.stdout
    assert(rendered.includes("Themes"), "missing themes\\\\n" + rendered)
    assert(rendered.includes("Keybinds"), "missing keybinds\\\\n" + rendered)
    assert(rendered.includes("Clipboard"), "missing clipboard\\\\n" + rendered)
    assert(rendered.includes("Plugins") || rendered.includes("Plugi"), "missing plugins\\\\n" + rendered)
    assert(run.seen.includes("PATCH /session/ses_termux"), "missing title route " + JSON.stringify(run.seen))
  },
  "render.parity-gates": async () => {
    const run = await runHost({
      title: "Render Gate",
      width: 100,
      height: 32,
      args: ["--prompt", "render gate"],
      messages: [{ id: "msg_gate", role: "assistant" }],
      chunks: [
        {
          messageID: "msg_gate",
          parts: [
            { type: "text", text: "\`\`\`ts\\n" + Array.from({ length: 20 }, (_, index) => "const item" + index + " = true").join("\\n") + "\\n\`\`\`" },
            {
              type: "tool",
              tool: "edit",
              state: {
                status: "completed",
                output: Array.from({ length: 20 }, (_, index) => "line " + index).join("\\n"),
                input: { diff: "--- a/src/app.ts\\n+++ b/src/app.ts\\n@@ -1 +1 @@\\n-old\\n+new" },
              },
            },
          ],
        },
      ],
      steps: [{ delay: 300, text: "\\x04" }],
    })
    const rendered = run.screen + "\\n" + run.stdout
    assert(rendered.includes("tool edit completed [expanded]"), "missing expanded tool gate\\n" + rendered)
    assert(rendered.includes("diff preview") && rendered.includes("+new"), "missing diff gate\\n" + rendered)
    assert(rendered.includes("more line(s)") || rendered.includes("more code line(s)"), "missing clipping gate\\n" + rendered)
  },
  "permissions.parity-gates": async () => {
    const run = await runHost({ title: "Permission Gate", permission: true, steps: [{ delay: 500, text: "rneeds context\\r" }, { delay: 100, text: "\\x04" }] })
    assert(run.permissions.length === 1 && run.permissions[0].reply === "reject" && run.permissions[0].reason === "needs context", "unexpected permission gate replies " + JSON.stringify(run.permissions))
    assert(run.stdout.includes("permission"), "missing permission gate panel\\n" + run.stdout)
  },
  "sidebar.files": async () => {
    const narrow = await runHost({
      title: "Sidebar Session",
      width: 80,
      height: 24,
      steps: [
        { delay: 150, text: "/summary\\r" },
        { delay: 150, text: "/files\\r" },
        { delay: 150, text: "/open src/app.ts\\r" },
        { delay: 150, text: "/attach src/app.ts\\r" },
        { delay: 150, text: "use it\\r" },
        { delay: 150, text: "\\x04" },
      ],
    })
    assert(narrow.stdout.includes("Sidebar"), "missing overlay sidebar\\n" + narrow.stdout)
    assert(narrow.stdout.includes("Open Files"), "missing open files\\n" + narrow.stdout)
    const rendered = narrow.screen + "\\n" + narrow.stdout
    assert(
      rendered.includes("[open]") && (rendered.includes("[attach]") || rendered.includes("ttach]")),
      "missing file actions\\n" + rendered,
    )
    assert(narrow.seen.includes("GET /file/status") && narrow.seen.includes("GET /file") && narrow.seen.includes("POST /editor"), "missing file/editor routes " + JSON.stringify(narrow.seen))
    assert(JSON.stringify(narrow.bodies[0]?.parts?.map((item) => item.type)) === JSON.stringify(["file", "text"]), "missing attached file part " + JSON.stringify(narrow.bodies))
    const wide = await runHost({ title: "Sidebar Wide", width: 120, height: 24, steps: [{ delay: 150, text: "/summary\\r" }, { delay: 150, text: "\\x04" }] })
    const wideRendered = wide.screen + "\\n" + wide.stdout
    const wideNormalized = wideRendered.replace(/\\s+/g, "")
    assert(wideRendered.includes("Sidebar") || wideNormalized.includes("Sidebar"), "missing sidebar frame\\n" + wideRendered)
    assert(wideNormalized.includes("ModifiedFiles"), "missing modified files\\n" + wideRendered)
  },
}

for (const item of selected()) {
  const started = Date.now()
  try {
    await actions[item.id]()
    results.push({ id: item.id, ok: true, ms: Date.now() - started })
    console.log("android termux e2e ok", item.id)
  } catch (error) {
    results.push({ id: item.id, ok: false, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) })
    fs.writeFileSync(resultPath, JSON.stringify({ mode, phaseReport, matrix, results }, null, 2))
    throw error
  }
}

fs.writeFileSync(resultPath, JSON.stringify({ mode, phaseReport, matrix, results }, null, 2))
console.log("android termux e2e matrix", JSON.stringify({ mode, phases: phaseReport.phases, totals: phaseReport.totals, results }))
`
}

export async function main() {
  const staged = await stage()
  try {
    await installTermux()
    await adb("push", staged.cli, `${tmp}/slopcode-root.tgz`)
    const script = path.join(staged.work, "android-termux-e2e.mjs")
    await Bun.write(script, e2eSource(staged.arch))
    await adb("push", script, `${tmp}/slopcode-android-termux-e2e.mjs`)
    await termux(
      `export SLOPCODE_ANDROID_E2E_MODE=${quote(mode)}; npm install -g --force --include=optional --ignore-scripts=true ${tmp}/slopcode-root.tgz && node "$(npm root -g)/slopcode/postinstall.mjs" && node ${tmp}/slopcode-android-termux-e2e.mjs`,
    )
    console.log(`android e2e: ok (${mode})`)
  } finally {
    await fs.rm(staged.work, { recursive: true, force: true })
  }
}

if (import.meta.main) await main()
