#!/usr/bin/env bun

import fs from "fs/promises"
import os from "os"
import path from "path"
import { fileURLToPath } from "url"
import { Script } from "@slopcode-ai/script"
import pkg from "../package.json"

const dir = fileURLToPath(new URL("..", import.meta.url))
const root = path.resolve(dir, "../..")
const sh = "/data/data/com.termux/files/usr/bin/sh"
const home = "/data/data/com.termux/files/home"
const tmp = "/data/local/tmp"

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
  if (devices.length > 1) throw new Error(`android e2e: multiple adb devices (${devices.join(", ")}); set SLOPCODE_ANDROID_SERIAL`)
  return devices[0]
}

const serial = await adbSerial()
const adbRun = (args: string[], options?: ExecOptions) => exec(["adb", "-s", serial, ...args], options)
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
const adb = (...args: string[]) => adbRun(args)
const termux = (command: string, options?: ExecOptions) =>
  adbRun(["shell", `run-as com.termux ${sh} -lc ${quote(`export PREFIX=/data/data/com.termux/files/usr HOME=${home} TMPDIR=/data/data/com.termux/files/usr/tmp PATH=/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin; cd ${home}; ${command}`)}`], options)

async function exists(target: string) {
  return fs.access(target).then(
    () => true,
    () => false,
  )
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
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-android-termux-e2e-"))
  const androidName = process.env.SLOPCODE_ANDROID_TARGET ?? "slopcode-android-x64"
  const androidFrom = path.join(dir, "dist", androidName)
  if (!(await exists(path.join(androidFrom, "package.json")))) {
    throw new Error(`android e2e: missing ${androidFrom}; run bun --cwd packages/slopcode run script/build.ts --target=android-x64`)
  }

  const androidTo = path.join(work, androidName)
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
        version: Script.version,
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
  await termux("apt-get update && DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::=--force-confnew upgrade && DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::=--force-confnew install openssl nodejs npm")
}

function e2eSource(androidPackage: string) {
  return `import { createServer } from "node:http"
import { spawn, spawnSync } from "node:child_process"
import path from "node:path"

const root = spawnSync("npm", ["root", "-g"], { encoding: "utf8" }).stdout.trim()
const host = path.join(root, ${JSON.stringify(androidPackage)}, "bin", "slopcode-android-host")
const cliPath = path.join(root, "slopcode", "bin", "slopcode")
const cli = spawnSync(cliPath, ["--version"], { encoding: "utf8" })
if (cli.status !== 0) throw new Error(cli.error?.message || cli.stderr || cli.stdout || "slopcode --version failed")
const self = spawnSync(host, ["--self-test"], { encoding: "utf8" })
if (self.status !== 0 || !self.stdout.includes("slopcode-android-host ok")) throw new Error(self.stderr || self.stdout || "sidecar self-test failed")

const bodies = []
const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1")
  if (url.pathname === "/session" && req.method === "POST") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ id: "ses_termux" }))
    return
  }
  if (url.pathname === "/session/ses_termux") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ id: "ses_termux", title: "Termux E2E" }))
    return
  }
  if (url.pathname === "/session/ses_termux/message/index") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end("[]")
    return
  }
  if (url.pathname === "/session/ses_termux/prompt_async" && req.method === "POST") {
    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", () => {
      bodies.push(JSON.parse(body))
      res.writeHead(204)
      res.end()
    })
    return
  }
  if (url.pathname === "/event") {
    res.writeHead(200, { "content-type": "text/event-stream" })
    res.write('data: {"type":"server.connected"}\\n\\n')
    setTimeout(() => res.end(), 1000)
    return
  }
  res.writeHead(200, { "content-type": "application/json" })
  res.end("{}")
})

await new Promise((resolve, reject) => {
  server.listen(0, "127.0.0.1", () => {
    const address = server.address()
    if (!address || typeof address === "string") return reject(new Error("missing mock server port"))
    const child = spawn(host, ["--url", "http://127.0.0.1:" + address.port, "--token", "test", "--prompt", "hello"], { stdio: ["pipe", "pipe", "pipe"] })
    let stderr = ""
    child.stderr.on("data", (chunk) => (stderr += chunk))
    setTimeout(() => child.stdin.end("/exit\\r"), 150)
    child.on("exit", (code) => {
      server.close()
      if (code !== 0) return reject(new Error(stderr || "sidecar exited " + code))
      const body = bodies[0]
      if (!body?.messageID?.startsWith("msg_") || !body?.parts?.[0]?.id?.startsWith("prt_") || body?.parts?.[0]?.text !== "hello") {
        return reject(new Error("unexpected prompt body " + JSON.stringify(body)))
      }
      resolve()
    })
  })
})
console.log("android termux e2e ok")
`
}

const staged = await stage()
try {
  await installTermux()
  await adb("push", staged.android, `${tmp}/slopcode-android-runtime.tgz`)
  await adb("push", staged.cli, `${tmp}/slopcode-root.tgz`)
  const script = path.join(staged.work, "android-termux-e2e.mjs")
  await Bun.write(script, e2eSource(staged.androidPackage))
  await adb("push", script, `${tmp}/slopcode-android-termux-e2e.mjs`)
  await termux(`npm install -g --include=optional --ignore-scripts=false ${tmp}/slopcode-android-runtime.tgz ${tmp}/slopcode-root.tgz && node ${tmp}/slopcode-android-termux-e2e.mjs`)
  console.log("android e2e: ok")
} finally {
  await fs.rm(staged.work, { recursive: true, force: true })
}
