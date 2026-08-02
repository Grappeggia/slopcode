import { execFile, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream, existsSync } from "node:fs"
import { chmod, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const exec = promisify(execFile)
const schema = 2
const attempts = 300
const interval = 100
const timeout = 6_000

export type BackgroundCliLogger = {
  log(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

export type BackgroundCliOptions = {
  source: string
  userData: string
  hostname: "127.0.0.1"
  port: number
  username: "slopcode"
  password: string
  remote: {
    hostID: string
    token: string
  }
  cors?: string[]
  env?: Record<string, string>
  logger: BackgroundCliLogger
}

type State = {
  schema: typeof schema
  version: string
  fingerprint: string
  pid: number
  identity: string
  url: string
  username: "slopcode"
  password: string
  remoteHostID: string
  remoteSupervisorToken: string
}

type Health = { healthy: boolean; version?: string }

type Child = {
  pid: number
  identity: Promise<string | undefined>
  exit: Promise<number | null>
  stop(): Promise<void>
}

type Deps = {
  version(binary: string): Promise<string>
  fingerprint(binary: string): Promise<string>
  spawn(binary: string, args: string[], env: NodeJS.ProcessEnv): Child
  health(state: Pick<State, "url" | "username" | "password">): Promise<Health>
  identity(pid: number): Promise<string | undefined>
  alive(pid: number): boolean
  stop(pid: number, identity: string): Promise<void>
  wait(ms: number): Promise<void>
}

export type BackgroundCli = {
  start(): Promise<BackgroundCliConnection>
  status(): Promise<BackgroundCliStatus>
  stop(): Promise<void>
}

export type BackgroundCliConnection = {
  url: string
  username: "slopcode"
  password: string
  remoteHostID: string
  remoteSupervisorToken: string
}

export type BackgroundCliStatus =
  | { status: "stopped" }
  | { status: "running" | "unhealthy" | "mismatched" | "stale"; pid: number; url: string; version: string }

export function processIdentityStrategy(platform = process.platform) {
  if (platform === "darwin") return "authenticated-health-only"
  return "process-start"
}

export function backgroundCliSource(packaged: boolean, resources: string) {
  if (packaged) return join(resources, executable())
  return join(dirname(fileURLToPath(import.meta.url)), "../../resources", executable())
}

export function createBackgroundCli(options: BackgroundCliOptions, overrides: Partial<Deps> = {}): BackgroundCli {
  const deps = { ...defaults, ...overrides }
  const directory = join(options.userData, "background-cli")
  const file = join(directory, "service.json")
  let current: State | undefined
  let active: Child | undefined
  let starting: Promise<BackgroundCliConnection> | undefined
  let stopping: Promise<void> | undefined

  const start = (): Promise<BackgroundCliConnection> => {
    if (stopping) return stopping.then(start)
    if (starting) return starting
    starting = boot().finally(() => {
      starting = undefined
    })
    return starting
  }

  const boot = async () => {
    const version = await deps.version(options.source).catch((error) => {
      throw failure("read bundled CLI version", error)
    })
    const fingerprint = await deps.fingerprint(options.source).catch((error) => {
      throw failure("fingerprint bundled CLI", error)
    })

    if (current && current.version === version && current.fingerprint === fingerprint) {
      const alive = deps.alive(current.pid)
      const health = alive ? await deps.health(current) : { healthy: false }
      const identified = !!active || (alive && (await deps.identity(current.pid)) === current.identity)
      const healthy = health.healthy && health.version === version
      if (healthy && (identified || processIdentityStrategy() === "authenticated-health-only")) {
        options.logger.log("background CLI reused", endpoint(current))
        return credentials(current)
      }
      await cleanup(current, identified)
    }

    const saved = await load(file)
    if (!saved && existsSync(file)) await rm(file, { force: true })
    if (saved) {
      const alive = deps.alive(saved.pid)
      const health = alive ? await deps.health(saved) : { healthy: false }
      const identity = alive ? await deps.identity(saved.pid) : undefined
      const healthy = health.healthy && health.version === version
      if (
        saved.version === version &&
        saved.fingerprint === fingerprint &&
        healthy &&
        (identity === saved.identity || processIdentityStrategy() === "authenticated-health-only")
      ) {
        current = saved
        options.logger.log("background CLI recovered", endpoint(saved))
        return credentials(saved)
      }
      options.logger.warn("stale background CLI state found", {
        expectedVersion: version,
        foundVersion: saved.version,
        healthy: health.healthy,
        ...endpoint(saved),
      })
      await cleanup(saved, identity === saved.identity)
    }

    const binary = await stage(options.source, options.userData, version, fingerprint, options.logger)
    const state: State = {
      schema,
      version,
      fingerprint,
      pid: 0,
      identity: "",
      url: `http://${options.hostname}:${options.port}`,
      username: options.username,
      password: options.password,
      remoteHostID: options.remote.hostID,
      remoteSupervisorToken: options.remote.token,
    }
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...options.env,
      SLOPCODE_REMOTE_HOST_ID: state.remoteHostID,
      SLOPCODE_REMOTE_SUPERVISOR_TOKEN: state.remoteSupervisorToken,
      SLOPCODE_SERVER_USERNAME: options.username,
      SLOPCODE_SERVER_PASSWORD: options.password,
      SLOPCODE_CLIENT: "desktop",
      XDG_STATE_HOME: process.env.XDG_STATE_HOME ?? options.userData,
    }
    delete env.DEBUG
    delete env.ELECTRON_RENDERER_URL
    if (process.platform === "linux") delete env.LD_PRELOAD
    const args = [
      "serve",
      "--hostname",
      options.hostname,
      "--port",
      String(options.port),
      ...(options.cors ?? []).flatMap((origin) => ["--cors", origin]),
    ]
    const child = (() => {
      try {
        return deps.spawn(binary, args, env)
      } catch (error) {
        throw failure("spawn background CLI", error)
      }
    })()
    state.pid = child.pid
    const identity = await child.identity.catch(async (error) => {
      await child.stop().catch(() => undefined)
      throw failure("identify background CLI", error)
    })
    if (!identity) {
      await child.stop().catch(() => undefined)
      throw new Error(`Failed to identify background CLI process ${state.pid}`)
    }
    state.identity = identity
    options.logger.log("background CLI spawned", { binary, version, ...endpoint(state) })

    try {
      await save(file, state)
      await Promise.race([
        ready(state, version, deps),
        child.exit.then((code) => {
          throw new Error(`process exited before becoming healthy with code ${code ?? "unknown"}`)
        }),
      ])
      current = state
      active = child
      void child.exit.then(
        () => {
          if (current?.pid !== state.pid) return
          current = undefined
          if (active === child) active = undefined
          void rm(file, { force: true })
        },
        (error) => options.logger.error("background CLI process failed", { error: message(error), pid: state.pid }),
      )
      options.logger.log("background CLI ready", { version, ...endpoint(state) })
      return credentials(state)
    } catch (error) {
      await child.stop().catch((stopError) => {
        options.logger.error("background CLI cleanup failed", { error: message(stopError), pid: state.pid })
      })
      await rm(file, { force: true })
      throw failure("start background CLI", error)
    }
  }

  const cleanup = async (state: State, identified: boolean) => {
    const child = active?.pid === state.pid ? active : undefined
    if (child) {
      await child.stop().catch((error) => {
        throw failure("stop owned background CLI", error)
      })
      if (active === child) active = undefined
    }
    if (!child && identified && deps.alive(state.pid)) {
      await deps.stop(state.pid, state.identity).catch((error) => {
        throw failure("stop stale background CLI", error)
      })
    }
    if (current?.pid === state.pid) current = undefined
    await rm(file, { force: true })
  }

  const stop = () => {
    if (stopping) return stopping
    stopping = (async () => {
      if (starting) await starting.catch(() => undefined)
      const state = current ?? (await load(file))
      if (!state) return
      const child = active?.pid === state.pid ? active : undefined
      if (child) {
        await child.stop()
        if (active === child) active = undefined
      }
      if (!child && deps.alive(state.pid)) {
        await deps.health(state)
        const identity = await deps.identity(state.pid)
        if (identity === state.identity) await deps.stop(state.pid, state.identity)
      }
      current = undefined
      await rm(file, { force: true })
      options.logger.log("background CLI stopped", endpoint(state))
    })().finally(() => {
      stopping = undefined
    })
    return stopping
  }

  const status = async (): Promise<BackgroundCliStatus> => {
    const state = current ?? (await load(file))
    if (!state || !deps.alive(state.pid)) return { status: "stopped" }
    const recovered = active?.pid !== state.pid
    const identified = !recovered || (await deps.identity(state.pid)) === state.identity
    if (!identified && processIdentityStrategy() !== "authenticated-health-only")
      return { status: "stale", pid: state.pid, url: state.url, version: state.version }
    const health = await deps.health(state)
    if (!health.healthy) return { status: "unhealthy", pid: state.pid, url: state.url, version: state.version }
    return {
      status: health.version === state.version ? "running" : "mismatched",
      pid: state.pid,
      url: state.url,
      version: health.version ?? state.version,
    }
  }

  return { start, status, stop }
}

export async function checkBackgroundCliHealth(state: Pick<State, "url" | "username" | "password">): Promise<Health> {
  const url = loopback(state.url)
  if (!url) return { healthy: false }
  const headers = new Headers({
    authorization: `Basic ${Buffer.from(`${state.username}:${state.password}`).toString("base64")}`,
  })
  try {
    const response = await fetch(new URL("/global/health", url), {
      headers,
      signal: AbortSignal.timeout(3_000),
    })
    if (!response.ok) return { healthy: false }
    const body: unknown = await response.json()
    if (!body || typeof body !== "object") return { healthy: false }
    const value = body as { healthy?: unknown; version?: unknown }
    if (value.healthy !== true || typeof value.version !== "string") return { healthy: false }
    return { healthy: true, version: value.version }
  } catch {
    return { healthy: false }
  }
}

async function ready(state: State, version: string, deps: Deps) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const health = await deps.health(state)
    if (health.healthy && health.version === version) return
    if (health.healthy)
      throw new Error(`health check reported version ${health.version ?? "unknown"}, expected ${version}`)
    await deps.wait(interval)
  }
  throw new Error(`health check timed out after ${attempts * interval}ms`)
}

async function stage(
  source: string,
  userData: string,
  version: string,
  fingerprint: string,
  logger: BackgroundCliLogger,
) {
  const directory = join(userData, "cli", safe(version), fingerprint.slice(0, 16))
  const destination = join(directory, executable())
  if (existsSync(destination)) {
    logger.log("background CLI staged executable reused", { path: destination, version })
    return destination
  }
  const temp = `${destination}.${process.pid}.tmp`
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await copyFile(source, temp)
  if (process.platform !== "win32") await chmod(temp, 0o755)
  await rename(temp, destination).catch(async (error) => {
    await rm(temp, { force: true })
    throw error
  })
  logger.log("background CLI executable staged", { path: destination, version })
  return destination
}

async function load(file: string): Promise<State | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(file, "utf8"))
    if (!value || typeof value !== "object") return
    const state = value as Partial<State>
    if (state.schema !== schema) return
    if (typeof state.version !== "string" || typeof state.fingerprint !== "string") return
    if (!Number.isSafeInteger(state.pid) || !state.pid || state.pid < 1) return
    if (typeof state.identity !== "string" || !state.identity) return
    if (state.username !== "slopcode" || typeof state.password !== "string" || !state.password) return
    if (typeof state.remoteHostID !== "string" || !/^hst_[a-zA-Z0-9_-]+$/.test(state.remoteHostID)) return
    if (typeof state.remoteSupervisorToken !== "string" || !state.remoteSupervisorToken) return
    if (typeof state.url !== "string" || !loopback(state.url)) return
    return state as State
  } catch {
    return
  }
}

async function save(file: string, state: State) {
  const directory = join(file, "..")
  const temp = `${file}.${process.pid}.tmp`
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await writeFile(temp, `${JSON.stringify(state)}\n`, { encoding: "utf8", mode: 0o600 })
  await rename(temp, file)
}

const defaults: Deps = {
  version: async (binary) => (await exec(binary, ["--version"], { windowsHide: true })).stdout.trim(),
  fingerprint: (binary) =>
    new Promise((resolve, reject) => {
      const hash = createHash("sha256")
      createReadStream(binary)
        .on("error", reject)
        .on("data", (chunk) => hash.update(chunk))
        .on("end", () => resolve(hash.digest("hex")))
    }),
  spawn: (binary, args, env) => {
    const child = spawn(binary, args, {
      detached: true,
      env,
      stdio: "ignore",
      windowsHide: true,
    })
    const exit = new Promise<number | null>((resolve, reject) => {
      child.once("error", reject)
      child.once("exit", (code) => resolve(code))
    })
    if (!child.pid) {
      void exit.catch(() => undefined)
      throw new Error(`Process did not provide a PID: ${binary}`)
    }
    child.unref()
    return {
      pid: child.pid,
      identity: processIdentity(child.pid).then((identity) => identity ?? `active:${child.pid}`),
      exit,
      stop: async () => {
        if (child.exitCode !== null || child.signalCode !== null) return
        child.kill("SIGTERM")
        await waitForExit(exit, timeout)
        if (child.exitCode !== null || child.signalCode !== null) return
        child.kill("SIGKILL")
        await waitForExit(exit, timeout)
        if (child.exitCode === null && child.signalCode === null)
          throw new Error(`Background CLI process ${child.pid} did not stop`)
      },
    }
  },
  health: checkBackgroundCliHealth,
  identity: processIdentity,
  alive: (pid) => {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  },
  stop: async (pid, identity) => {
    if ((await processIdentity(pid)) !== identity) return
    process.kill(pid, "SIGTERM")
    const end = Date.now() + timeout
    while (Date.now() < end) {
      if (!defaults.alive(pid)) return
      await defaults.wait(50)
    }
    if ((await processIdentity(pid)) !== identity) return
    process.kill(pid, "SIGKILL")
    const forced = Date.now() + timeout
    while (Date.now() < forced) {
      if (!defaults.alive(pid)) return
      await defaults.wait(50)
    }
    throw new Error(`Background CLI process ${pid} did not stop`)
  },
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}

async function processIdentity(pid: number) {
  try {
    if (process.platform === "linux") {
      const value = await readFile(`/proc/${pid}/stat`, "utf8")
      const fields = value
        .slice(value.lastIndexOf(")") + 1)
        .trim()
        .split(/\s+/)
      if (!fields[19]) return
      return `linux:${fields[19]}`
    }
    if (process.platform === "win32") {
      const result = await exec(
        "powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "(Get-Process -Id $args[0] -ErrorAction Stop).StartTime.ToUniversalTime().Ticks",
          String(pid),
        ],
        { windowsHide: true },
      )
      const value = result.stdout.trim()
      return value ? `win32:${value}` : undefined
    }
    // `ps lstart` is only second-precision on macOS. libproc's precise process
    // identifiers are not public Node APIs, so never authorize a recovered PID
    // for reuse or termination with that lossy value. Authenticated loopback
    // health remains sufficient to reuse the service without sending it a signal.
    if (process.platform === "darwin") return
    return
  } catch {
    return
  }
}

async function waitForExit(exit: Promise<number | null>, ms: number) {
  const expired = Promise.withResolvers<void>()
  const timer = setTimeout(expired.resolve, ms)
  timer.unref()
  try {
    await Promise.race([
      exit.then(
        () => undefined,
        () => undefined,
      ),
      expired.promise,
    ])
  } finally {
    clearTimeout(timer)
  }
}

function loopback(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:") return
    if (!url.port) return
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return
    return url
  } catch {
    return
  }
}

function endpoint(state: Pick<State, "pid" | "url">) {
  const url = new URL(state.url)
  return { pid: state.pid, url: state.url, hostname: url.hostname, port: url.port }
}

function credentials(state: State) {
  return {
    url: state.url,
    username: state.username,
    password: state.password,
    remoteHostID: state.remoteHostID,
    remoteSupervisorToken: state.remoteSupervisorToken,
  }
}

function safe(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-")
}

function executable() {
  return process.platform === "win32" ? "slopcode-cli.exe" : "slopcode-cli"
}

function failure(action: string, error: unknown) {
  return new Error(`Failed to ${action}: ${message(error)}`, { cause: error })
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
