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

  const androidTo = path.join(work, selected.name)
  await fs.cp(androidFrom, androidTo, { recursive: true, force: true })
  const androidJson = (await Bun.file(path.join(androidTo, "package.json")).json()) as { name: string; version: string }
  const android = await pack(androidTo, "slopcode-android-runtime.tgz")

  const app = path.join(work, pkg.name)
  await fs.mkdir(app, { recursive: true })
  await fs.cp(path.join(dir, "bin"), path.join(app, "bin"), { recursive: true, force: true })
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
        files: ["bin", "postinstall.mjs", "README.md", "LICENSE"],
        scripts: { postinstall: "bun ./postinstall.mjs || node ./postinstall.mjs" },
        optionalDependencies: { [androidJson.name]: androidJson.version },
      },
      null,
      2,
    ),
  )
  const cli = await pack(app, "slopcode-root.tgz")
  return { work, android, cli, androidPackage: androidJson.name }
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

export function e2eSource(androidPackage: string) {
  return `import { createServer } from "node:http"
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { setTimeout as sleep } from "node:timers/promises"

const matrix = ${JSON.stringify(parity, null, 2)}
const phaseReport = ${JSON.stringify(report(), null, 2)}
const mode = process.env.SLOPCODE_ANDROID_E2E_MODE || "smoke"
const root = spawnSync("npm", ["root", "-g"], { encoding: "utf8" }).stdout.trim()
const host = path.join(root, ${JSON.stringify(androidPackage)}, "bin", "slopcode-android-host")
const cliPath = path.join(root, "slopcode", "bin", "slopcode")
const resultPath = path.join(process.env.HOME || ".", "android-termux-e2e-result.json")
const results = []

function wide(char) {
  const code = char.codePointAt(0) || 0
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

async function runHost(input) {
  const state = { bodies: [], replies: [], permissions: [], shells: [], seen: [] }
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1")
    state.seen.push(req.method + " " + url.pathname)
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
    if (url.pathname === "/session/ses_termux/summarize" && req.method === "POST") return json(res, true)
    if (url.pathname === "/session/ses_termux/children") return json(res, [{ id: "ses_child", title: "Child Session" }])
    if (url.pathname === "/session/ses_termux/diff/index") return json(res, [{ file: "src/app.ts", added: 2, removed: 1 }])
    if (url.pathname === "/editor" && req.method === "POST") return json(res, { id: "edt_termux", sessionID: "ses_termux", file: "src/app.ts", dirty: true, diff: true })
    if (url.pathname === "/editor/edt_termux/snapshot") return json(res, { file: "src/app.ts", dirty: true, diff: true, diagnostics: [{ line: 1, column: 1, severity: "error", message: "expected semicolon" }] })
    if (url.pathname === "/editor/edt_termux/save" && req.method === "POST") return json(res, { id: "edt_termux", sessionID: "ses_termux", file: "src/app.ts", dirty: false, diff: true })
    if (url.pathname === "/editor/edt_termux/diff/dismiss" && req.method === "POST") return json(res, { id: "edt_termux", sessionID: "ses_termux", file: "src/app.ts", dirty: false, diff: false })
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
      { providerID: "openai", id: "gpt-5", name: "GPT 5", release_date: "2026-01-01" },
      { providerID: "anthropic", id: "claude-sonnet", name: "Claude Sonnet", release_date: "2025-12-01" },
    ])
    if (url.pathname === "/v2/provider") return json(res, [
      { id: "openai", name: "OpenAI", models: {} },
      { id: "anthropic", name: "Anthropic", models: {} },
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
        res.write('data: {"type":"permission.asked","properties":{"id":"perm_termux","sessionID":"ses_termux","permission":"edit","patterns":["src/app.ts"],"metadata":{"filepath":"src/app.ts","diff":"+hello\\n-world"}}}\\n\\n')
      }
      setTimeout(() => res.end(), 1000)
      return
    }
    return json(res, {})
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
  },
  "release.sidecar-smoke": async () => actions["smoke.install"](),
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
        { delay: 100, text: "/shell\\r" },
        { delay: 100, text: "ls\\r" },
        { delay: 100, text: "/queue\\r" },
        { delay: 100, text: "\\x04" },
      ],
    })
    assert(run.bodies[0]?.parts?.[0]?.text === "draft", "stash/pop/autocomplete did not submit draft " + JSON.stringify(run.bodies))
    assert(run.shells[0]?.command === "ls", "shell mode did not hit shell route " + JSON.stringify(run.shells))
    assert(run.screen.includes("Prompt Queue") || run.stdout.includes("Prompt Queue"), "missing queue panel\\n" + run.screen)
  },
  "dialogs.question": async () => {
    const run = await runHost({ title: "Question Session", question: true, steps: [{ delay: 200, text: "1\\r" }, { delay: 100, text: "\\x04" }] })
    assert(JSON.stringify(run.replies) === JSON.stringify([{ answers: [["Yes"]] }]), "unexpected replies " + JSON.stringify(run.replies))
  },
  "layout.capture": async () => {
    const run = await runHost({ title: "Layout Session", width: 80, height: 24, steps: [{ delay: 1500, text: "/exit\\r" }] })
    assert(run.screen.includes("Layout Session") || run.stdout.includes("Layout Session"), "screen missing title\\n" + run.screen + "\\nraw:\\n" + run.stdout)
    assert(run.screen.includes("SlopCode") || run.stdout.includes("SlopCode"), "screen missing chrome\\n" + run.screen + "\\nraw:\\n" + run.stdout)
  },
  "commands.palette": async () => {
    const run = await runHost({ title: "Command Session", steps: [{ delay: 150, text: "/commands\\r" }, { delay: 150, text: "/cl\\t\\u0015" }, { delay: 150, text: "\\x04" }] })
    semantic(run, ["Command Palette", "/models", "Command Matches"])
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
    assert(run.screen.includes("tabs") || run.stdout.includes("tabs"), "missing tab strip\\n" + run.screen)
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
    assert(run.seen.filter((item) => item === "GET /session/ses_termux/message/index").length >= 3, "missing timeline/history routes " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /session/ses_termux/revert"), "missing revert route " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /session/ses_termux/unrevert"), "missing unrevert route " + JSON.stringify(run.seen))
  },
  "models.panel": async () => {
    const run = await runHost({
      title: "Model Session",
      steps: [{ delay: 150, text: "/models\\r" }, { delay: 150, text: "/model openai/gpt-5\\r" }, { delay: 150, text: "hello\\r" }, { delay: 150, text: "\\x04" }],
    })
    assert(run.screen.includes("Models") || run.stdout.includes("Models"), "missing models panel\\n" + run.screen)
    assert(run.bodies[0]?.model?.providerID === "openai" && run.bodies[0]?.model?.modelID === "gpt-5", "missing selected model " + JSON.stringify(run.bodies))
  },
  "files.panel": async () => {
    const run = await runHost({ title: "Files Session", steps: [{ delay: 150, text: "/files\\r" }, { delay: 150, text: "/files app\\r" }, { delay: 150, text: "\\x04" }] })
    assert(run.screen.includes("Files") || run.stdout.includes("Files"), "missing files panel\\n" + run.screen)
    assert(run.screen.includes("src/app.ts") || run.stdout.includes("src/app.ts"), "missing file row\\n" + run.screen)
  },
  "render.tools": async () => {
    const run = await runHost({
      title: "Render Session",
      messages: [{ id: "msg_tool", role: "assistant" }],
      chunks: [{ messageID: "msg_tool", parts: [{ type: "text", text: "Done" }, { type: "tool", tool: "edit", state: { status: "completed", output: "patched" }, metadata: { diff: "+next\\n-prev" } }] }],
      steps: [{ delay: 150, text: "\\x04" }],
    })
    assert(run.screen.includes("tool edit completed") || run.stdout.includes("tool edit completed"), "missing tool card\\n" + run.screen)
    assert(run.screen.includes("+next") || run.stdout.includes("+next"), "missing diff preview\\n" + run.screen)
  },
  "permissions.preview": async () => {
    const run = await runHost({ title: "Permission Session", permission: true, steps: [{ delay: 200, text: "a" }, { delay: 100, text: "\\x04" }] })
    assert(JSON.stringify(run.permissions) === JSON.stringify([{ reply: "always" }]), "unexpected permission replies " + JSON.stringify(run.permissions))
    assert(run.screen.includes("permission") || run.stdout.includes("permission"), "missing permission panel\\n" + run.screen)
  },
  "editor.diff": async () => {
    const run = await runHost({
      title: "Editor Session",
      steps: [
        { delay: 150, text: "/open src/app.ts\\r" },
        { delay: 150, text: "/diagnostics\\r" },
        { delay: 150, text: "/close-editor\\r" },
        { delay: 150, text: "/save\\r" },
        { delay: 150, text: "/diff dismiss\\r" },
        { delay: 150, text: "/close-editor!\\r" },
        { delay: 150, text: "\\x04" },
      ],
    })
    assert(run.stdout.includes("Editor"), "missing editor panel\\\\n" + run.stdout)
    assert(run.stdout.includes("expected semicolon"), "missing diagnostics\\\\n" + run.stdout)
    assert(run.stdout.includes("console.log('ok')"), "missing editor preview\\n" + run.stdout)
    assert(run.stdout.includes("unsaved changes") || run.stdout.includes("saved src/app.ts"), "missing dirty guard/save\\\\n" + run.stdout)
    assert(run.seen.includes("POST /editor"), "missing editor open " + JSON.stringify(run.seen))
    assert(run.seen.includes("GET /editor/edt_termux/snapshot"), "missing editor snapshot " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /editor/edt_termux/save"), "missing editor save " + JSON.stringify(run.seen))
    assert(run.seen.includes("POST /editor/edt_termux/diff/dismiss"), "missing diff dismiss " + JSON.stringify(run.seen))
    assert(run.seen.includes("DELETE /editor/edt_termux"), "missing editor close " + JSON.stringify(run.seen))
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
    assert(run.stdout.includes("Themes"), "missing themes\\\\n" + run.stdout)
    assert(run.stdout.includes("Keybinds"), "missing keybinds\\\\n" + run.stdout)
    assert(run.stdout.includes("Clipboard"), "missing clipboard\\\\n" + run.stdout)
    assert(run.stdout.includes("Plugins"), "missing plugins\\\\n" + run.stdout)
    assert(run.seen.includes("PATCH /session/ses_termux"), "missing title route " + JSON.stringify(run.seen))
  },
  "render.parity-gates": async () => {
    const run = await runHost({
      title: "Render Gate",
      width: 100,
      height: 32,
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
      steps: [{ delay: 150, text: "\\x04" }],
    })
    assert(run.stdout.includes("tool edit completed [expanded]"), "missing expanded tool gate\\n" + run.stdout)
    assert(run.stdout.includes("diff preview") && run.stdout.includes("+new"), "missing diff gate\\n" + run.stdout)
    assert(run.stdout.includes("more line(s)") || run.stdout.includes("more code line(s)"), "missing clipping gate\\n" + run.stdout)
  },
  "permissions.parity-gates": async () => {
    const run = await runHost({ title: "Permission Gate", permission: true, steps: [{ delay: 200, text: "rneeds context\\r" }, { delay: 100, text: "\\x04" }] })
    assert(JSON.stringify(run.permissions) === JSON.stringify([{ reply: "reject", reason: "needs context" }]), "unexpected permission gate replies " + JSON.stringify(run.permissions))
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
    assert(narrow.stdout.includes("Sidebar overlay"), "missing overlay sidebar\\n" + narrow.stdout)
    assert(narrow.stdout.includes("Open Files"), "missing open files\\n" + narrow.stdout)
    assert(narrow.stdout.includes("[attach]") && narrow.stdout.includes("[open]"), "missing file actions\\n" + narrow.stdout)
    assert(narrow.seen.includes("GET /file/status") && narrow.seen.includes("GET /file") && narrow.seen.includes("POST /editor"), "missing file/editor routes " + JSON.stringify(narrow.seen))
    assert(JSON.stringify(narrow.bodies[0]?.parts?.map((item) => item.type)) === JSON.stringify(["file", "text"]), "missing attached file part " + JSON.stringify(narrow.bodies))
    const wide = await runHost({ title: "Sidebar Wide", width: 120, height: 24, steps: [{ delay: 150, text: "/summary\\r" }, { delay: 150, text: "\\x04" }] })
    assert(wide.stdout.includes("Sidebar"), "missing sidebar frame\\n" + wide.stdout)
    assert(wide.stdout.includes("Modified Files"), "missing modified files\\n" + wide.stdout)
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
    await adb("push", staged.android, `${tmp}/slopcode-android-runtime.tgz`)
    await adb("push", staged.cli, `${tmp}/slopcode-root.tgz`)
    const script = path.join(staged.work, "android-termux-e2e.mjs")
    await Bun.write(script, e2eSource(staged.androidPackage))
    await adb("push", script, `${tmp}/slopcode-android-termux-e2e.mjs`)
    await termux(
      `export SLOPCODE_ANDROID_E2E_MODE=${quote(mode)}; npm install -g --include=optional --ignore-scripts=false ${tmp}/slopcode-android-runtime.tgz ${tmp}/slopcode-root.tgz && node ${tmp}/slopcode-android-termux-e2e.mjs`,
    )
    console.log(`android e2e: ok (${mode})`)
  } finally {
    await fs.rm(staged.work, { recursive: true, force: true })
  }
}

if (import.meta.main) await main()
