import { spawn } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import path, { posix } from "node:path"
import { RemoteHost, RemoteWorkspaceSsh } from "@slopcode-ai/protocol"
import { Schema } from "effect"
import {
  DesktopWorkspaceID,
  type DesktopRemoteEvent,
  type DesktopRemoteHost,
  type DesktopRemoteHostService,
  type DesktopRemoteReady,
  type DesktopRemoteState,
  type DesktopRemoteValidation,
  type DesktopRemoteWorkspace,
  type DesktopSshHostKey,
  type DesktopSshTarget,
} from "./contract"

type NormalizedSshTarget = {
  id: ReturnType<typeof workspaceIdentity>
  host: DesktopRemoteHost
  workspace: DesktopRemoteWorkspace
  authority: string
  hostName: string
  user: string
  port: number
  localDirectory: string
  remoteDirectory: string
  stateKey: string
  identityPath?: string
  hostKey: DesktopSshHostKey
}

type CommandResult = {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
}

type TunnelProcess = {
  stop: () => void
  onExit: (cb: (code: number | null, signal: NodeJS.Signals | null) => void) => void
}

type BootstrapResult = {
  attached: boolean
  port: number
  username: string
  password: string
}

type MaterializedHostKey = {
  path: string
  cleanup: () => Promise<void>
}

type RunningWorkspace = {
  state: DesktopRemoteReady
  tunnel: TunnelProcess
  owned: boolean
  stopRemote: () => Promise<void>
  cleanup: () => Promise<void>
}

type PendingWorkspace = {
  promise: Promise<DesktopRemoteReady>
  cancel: () => void
}

type Deps = {
  allocatePort: () => Promise<number>
  uuid: () => string
  runSsh: (args: string[], script: string, timeoutMs: number, signal?: AbortSignal) => Promise<CommandResult>
  openTunnel: (args: string[]) => TunnelProcess
  health: (url: string, password: string, signal?: AbortSignal) => Promise<boolean>
  validateRemoteDirectory: (
    url: string,
    password: string,
    directory: string,
    signal?: AbortSignal,
  ) => Promise<DesktopRemoteValidation>
  materializeHostKey: (hostKey: DesktopSshHostKey) => Promise<MaterializedHostKey>
}

const decodeHost = Schema.decodeUnknownSync(RemoteHost)
const decodeWorkspace = Schema.decodeUnknownSync(RemoteWorkspaceSsh)
const SSH_SCRIPT_TIMEOUT_MS = 15_000
const SSH_HEALTH_TIMEOUT_MS = 30_000

export function normalizeSshTarget(target: DesktopSshTarget): NormalizedSshTarget {
  const decodedHost = decodeHost(target.host)
  if (decodedHost.mode !== "ssh") throw new Error("Remote host must use ssh mode")
  const host = decodedHost as DesktopRemoteHost
  const workspace = decodeWorkspace(target.workspace)
  const hostName = requireToken("SSH host", workspace.ssh.host, /^[a-zA-Z0-9._:[\]-]+$/)
  const user = requireToken("SSH user", workspace.ssh.user, /^[a-zA-Z0-9._-]+$/)
  const port = workspace.ssh.port
  const localDirectory = normalizeLocalDirectory(workspace.directory)
  const remoteDirectory = normalizeRemoteDirectory(workspace.remoteDirectory)
  const identityPath = target.security.identityPath
    ? normalizeAbsolutePath("SSH identity path", target.security.identityPath)
    : undefined
  const id = workspaceIdentity({
    hostName,
    user,
    port,
    remoteDirectory,
  })
  const stateKey = workspaceStateKey(id)

  return {
    id,
    host,
    workspace: {
      ...workspace,
      directory: asWorkspacePath(localDirectory),
      remoteDirectory: asWorkspacePath(remoteDirectory),
      ssh: {
        ...workspace.ssh,
        host: hostName,
        user,
      },
    },
    authority: `${user}@${hostName}`,
    hostName,
    user,
    port,
    localDirectory,
    remoteDirectory,
    stateKey,
    identityPath,
    hostKey: normalizeHostKey(target.security.hostKey),
  }
}

export function workspaceIdentity(input: {
  hostName: string
  user: string
  port: number
  remoteDirectory: string
}) {
  return DesktopWorkspaceID.make(`ssh:${input.user}@${input.hostName}:${input.port}\u0000${input.remoteDirectory}`)
}

export function workspaceStateKey(id: DesktopWorkspaceID | string) {
  return createHash("sha256").update(id).digest("hex")
}

export function buildSshExecArgs(target: NormalizedSshTarget, knownHostsPath: string) {
  return [...buildSshBaseArgs(target, knownHostsPath), "-T", target.authority, "sh", "-se"]
}

export function buildSshTunnelArgs(
  target: NormalizedSshTarget,
  knownHostsPath: string,
  localPort: number,
  remotePort: number,
) {
  return [
    ...buildSshBaseArgs(target, knownHostsPath),
    "-N",
    "-T",
    "-L",
    `${localPort}:127.0.0.1:${remotePort}`,
    target.authority,
  ]
}

export function buildSshBootstrapScript(target: NormalizedSshTarget, port: number, password: string) {
  return bootstrapScript(target, port, password)
}

export function buildSshStopScript(target: NormalizedSshTarget) {
  return stopScript(target)
}

export function createSshRemoteHostService(opts: Partial<Deps> = {}): DesktopRemoteHostService {
  const deps = withDeps(opts)
  const listeners = new Set<(event: DesktopRemoteEvent) => void>()
  const states = new Map<string, DesktopRemoteState>()
  const active = new Map<string, RunningWorkspace>()
  const pending = new Map<string, PendingWorkspace>()
  const generations = new Map<string, number>()

  const emit = (state: DesktopRemoteState) => {
    states.set(state.id, state)
    for (const listener of listeners) listener({ type: "state", state })
  }

  const nextGeneration = (id: string) => {
    const next = (generations.get(id) ?? 0) + 1
    generations.set(id, next)
    return next
  }

  const stopped = (state: DesktopRemoteState) => {
    emit({
      kind: "stopped",
      id: state.id,
      host: state.host,
      workspace: state.workspace,
    })
  }

  const fail = (target: NormalizedSshTarget, message: string) => {
    const state = {
      kind: "failed",
      id: target.id,
      host: target.host,
      workspace: target.workspace,
      message,
    } satisfies DesktopRemoteState
    emit(state)
    return state
  }

  const start = async (input: DesktopSshTarget) => {
    const target = normalizeSshTarget(input)
    const current = active.get(target.id)
    if (current) return current.state
    const running = pending.get(target.id)
    if (running) return running.promise

    const generation = nextGeneration(target.id)
    const signal = new AbortController()
    let task!: Promise<DesktopRemoteReady>

    task = (async () => {
      emit({
        kind: "validating",
        id: target.id,
        host: target.host,
        workspace: target.workspace,
      })
      let cleanup = async () => {}
      let stopRemote = async () => {}
      let tunnel: TunnelProcess | undefined
      let owned = false

      try {
        const hostKey = await deps.materializeHostKey(target.hostKey)
        cleanup = () => hostKey.cleanup()
        assertLive(signal.signal, generations, target.id, generation)

        emit({
          kind: "starting",
          id: target.id,
          host: target.host,
          workspace: target.workspace,
        })
        const execArgs = buildSshExecArgs(target, hostKey.path)
        stopRemote = () => deps.runSsh(execArgs, stopScript(target), SSH_SCRIPT_TIMEOUT_MS).then(() => undefined)
        const requestedPort = await deps.allocatePort()
        assertLive(signal.signal, generations, target.id, generation)
        const requestedPassword = deps.uuid()
        const bootstrap = await deps.runSsh(
          execArgs,
          bootstrapScript(target, requestedPort, requestedPassword),
          SSH_SCRIPT_TIMEOUT_MS,
          signal.signal,
        )
        assertLive(signal.signal, generations, target.id, generation)
        const remote = parseBootstrap(bootstrap)
        owned = !remote.attached
        const localPort = await deps.allocatePort()
        assertLive(signal.signal, generations, target.id, generation)
        tunnel = deps.openTunnel(buildSshTunnelArgs(target, hostKey.path, localPort, remote.port))
        const url = `http://127.0.0.1:${localPort}`
        const closeTunnel = () => tunnel?.stop()
        signal.signal.addEventListener("abort", closeTunnel, { once: true })

        try {
          await waitForHealth(() => deps.health(url, remote.password, signal.signal), signal.signal)
          assertLive(signal.signal, generations, target.id, generation)
          await deps.validateRemoteDirectory(url, remote.password, target.remoteDirectory, signal.signal)
          assertLive(signal.signal, generations, target.id, generation)
        } catch (error) {
          tunnel.stop()
          throw error
        } finally {
          signal.signal.removeEventListener("abort", closeTunnel)
        }

        const state = {
          kind: "ready",
          id: target.id,
          host: target.host,
          workspace: target.workspace,
          url,
          username: remote.username,
          password: remote.password,
          attached: remote.attached,
        } satisfies DesktopRemoteReady

        const item = {
          state,
          tunnel,
          owned,
          stopRemote,
          cleanup,
        } satisfies RunningWorkspace

        assertLive(signal.signal, generations, target.id, generation)
        active.set(target.id, item)
        emit(state)
        tunnel.onExit((code, signal) => {
          if (active.get(target.id) !== item) return
          if (generations.get(target.id) !== generation) return
          active.delete(target.id)
          void cleanup()
          fail(target, `SSH tunnel exited (code=${code ?? "null"} signal=${signal ?? "null"})`)
        })
        return state
      } catch (error) {
        tunnel?.stop()
        if (owned) await stopRemote().catch(() => undefined)
        await cleanup().catch(() => undefined)
        if (isAbortError(error)) throw error
        const message = error instanceof Error ? error.message : String(error)
        if (generations.get(target.id) === generation) fail(target, message)
        throw error
      } finally {
        if (pending.get(target.id)?.promise === task) pending.delete(target.id)
      }
    })()

    pending.set(target.id, {
      promise: task,
      cancel: () => signal.abort(abortError()),
    })
    return task
  }

  const stop = async (id: ReturnType<typeof DesktopWorkspaceID.make>) => {
    nextGeneration(id)
    const item = active.get(id)
    const running = pending.get(id)
    const state = states.get(id)
    active.delete(id)
    running?.cancel()
    if (state?.kind !== "stopped" && state) stopped(state)
    if (item) {
      item.tunnel.stop()
      if (item.owned) await item.stopRemote().catch(() => undefined)
      await item.cleanup().catch(() => undefined)
    }
    if (running) await running.promise.catch(() => undefined)
  }

  return {
    getState(id) {
      return states.get(id)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async validateWorkspace(target) {
      const ready = await start(target)
      return deps.validateRemoteDirectory(ready.url, ready.password, ready.workspace.remoteDirectory)
    },
    ensureWorkspace: start,
    stopWorkspace: stop,
    async stopAll() {
      await Promise.all(
        [...new Set([...active.keys(), ...pending.keys(), ...states.keys()])].map((id) => stop(DesktopWorkspaceID.make(id))),
      )
    },
  }
}

function buildSshBaseArgs(target: NormalizedSshTarget, knownHostsPath: string) {
  return [
    "-o",
    "BatchMode=yes",
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "ServerAliveInterval=15",
    "-o",
    "ServerAliveCountMax=3",
    "-o",
    "StrictHostKeyChecking=yes",
    "-o",
    `UserKnownHostsFile=${knownHostsPath}`,
    ...(target.identityPath ? ["-i", target.identityPath, "-o", "IdentitiesOnly=yes"] : []),
    "-p",
    String(target.port),
  ]
}

function normalizeHostKey(hostKey: DesktopSshHostKey): DesktopSshHostKey {
  if (hostKey.kind === "known_hosts") {
    return {
      kind: "known_hosts",
      path: normalizeAbsolutePath("known_hosts path", hostKey.path),
    }
  }

  const value = requireLine("SSH host key", hostKey.value)
  if (!/\s+(ssh-|ecdsa-|sk-)/.test(value)) throw new Error("SSH host key must be a single known_hosts entry")
  return {
    kind: "pinned",
    value,
  }
}

function normalizeLocalDirectory(value: string) {
  const next = normalizeAbsolutePath("workspace directory", value)
  return path.normalize(next)
}

function normalizeRemoteDirectory(value: string) {
  const next = requireLine("remote directory", value)
  if (!next.startsWith("/")) throw new Error("Remote directory must be an absolute POSIX path")
  const normalized = posix.normalize(next)
  return normalized.length > 1 && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized
}

function normalizeAbsolutePath(label: string, value: string) {
  const next = requireLine(label, value)
  if (!path.isAbsolute(next)) throw new Error(`${label} must be absolute`)
  return next
}

function requireToken(label: string, value: string, pattern: RegExp) {
  const next = requireLine(label, value)
  if (next.startsWith("-")) throw new Error(`${label} cannot start with '-'`)
  if (!pattern.test(next)) throw new Error(`Invalid ${label}`)
  return next
}

function requireLine(label: string, value: string) {
  const next = value.trim()
  if (!next) throw new Error(`Missing ${label}`)
  if (/[\0\r\n]/.test(next)) throw new Error(`Invalid ${label}`)
  return next
}

function parseBootstrap(result: CommandResult): BootstrapResult {
  if (result.code !== 0) {
    throw new Error(summarize(result.stderr || result.stdout) || `ssh exited with code ${result.code ?? "null"}`)
  }

  const line =
    result.stdout
      .split(/\r?\n/g)
      .map((item) => item.trim())
      .filter(Boolean)
      .at(-1) ?? ""

  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    throw new Error(summarize(result.stderr || result.stdout) || "SSH bootstrap returned invalid JSON")
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as Record<string, unknown>).attached !== "boolean" ||
    typeof (parsed as Record<string, unknown>).port !== "number" ||
    typeof (parsed as Record<string, unknown>).username !== "string" ||
    typeof (parsed as Record<string, unknown>).password !== "string"
  ) {
    throw new Error("SSH bootstrap returned an unexpected payload")
  }

  return parsed as BootstrapResult
}

async function waitForHealth(check: () => Promise<boolean>, signal: AbortSignal) {
  const timeout = Date.now() + SSH_HEALTH_TIMEOUT_MS
  while (Date.now() < timeout) {
    throwIfAborted(signal)
    if (await check()) return
    await wait(100, signal)
  }
  throw new Error(`SSH tunnel health check timed out after ${SSH_HEALTH_TIMEOUT_MS}ms`)
}

function summarize(value: string) {
  return value
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
}

function bootstrapScript(target: NormalizedSshTarget, port: number, password: string) {
  return [
    "set -eu",
    `dir=${quote(target.remoteDirectory)}`,
    `key=${quote(target.stateKey)}`,
    'state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/slopcode"',
    'state_file="$state_dir/desktop-ssh-server-$key.env"',
    'log_file="$state_dir/desktop-ssh-server-$key.log"',
    "mkdir -p \"$state_dir\"",
    "matches_pid() {",
    '  [ -n "${PID:-}" ] || return 1',
    '  cmd="$(ps -p "$PID" -o command= 2>/dev/null || true)"',
    '  [ -n "$cmd" ] || return 1',
    '  case "$cmd" in',
    '    *slopcode*serve*) return 0 ;;',
    "  esac",
    "  return 1",
    "}",
    'if [ -f "$state_file" ]; then',
    '  . "$state_file"',
    '  if matches_pid && [ -n "${PORT:-}" ] && [ -n "${PASSWORD:-}" ] && [ "${DIRECTORY:-}" = "$dir" ]; then',
    '    printf \'{"attached":true,"port":%s,"username":"slopcode","password":"%s"}\\n\' "$PORT" "$PASSWORD"',
    "    exit 0",
    "  fi",
    "fi",
    'bin="$(command -v slopcode || true)"',
    'if [ -z "$bin" ] && [ -x "$HOME/.slopcode/bin/slopcode" ]; then',
    '  bin="$HOME/.slopcode/bin/slopcode"',
    "fi",
    'if [ -z "$bin" ]; then',
    '  echo "slopcode executable not found" >&2',
    "  exit 41",
    "fi",
    'cd "$dir"',
    `PORT=${port}`,
    `PASSWORD=${quote(password)}`,
    'nohup env SLOPCODE_SERVER_USERNAME=slopcode SLOPCODE_SERVER_PASSWORD="$PASSWORD" SLOPCODE_CLIENT=desktop SLOPCODE_DISABLE_EMBEDDED_WEB_UI=true "$bin" serve --hostname 127.0.0.1 --port "$PORT" >>"$log_file" 2>&1 &',
    "PID=$!",
    'cat >"$state_file" <<EOF',
    'PID=$PID',
    'PORT=$PORT',
    'PASSWORD="$PASSWORD"',
    'DIRECTORY="$dir"',
    "EOF",
    'printf \'{"attached":false,"port":%s,"username":"slopcode","password":"%s"}\\n\' "$PORT" "$PASSWORD"',
  ].join("\n")
}

function withDeps(opts: Partial<Deps>): Deps {
  return {
    allocatePort: opts.allocatePort ?? allocatePort,
    uuid: opts.uuid ?? (() => randomUUID()),
    runSsh: opts.runSsh ?? runSsh,
    openTunnel: opts.openTunnel ?? openTunnel,
    health: opts.health ?? defaultHealth,
    validateRemoteDirectory: opts.validateRemoteDirectory ?? validateRemoteDirectory,
    materializeHostKey: opts.materializeHostKey ?? materializeHostKey,
  }
}

function stopScript(target: NormalizedSshTarget) {
  return [
    "set -eu",
    `key=${quote(target.stateKey)}`,
    'state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/slopcode"',
    'state_file="$state_dir/desktop-ssh-server-$key.env"',
    'if [ ! -f "$state_file" ]; then',
    "  exit 0",
    "fi",
    ' . "$state_file"',
    'rm -f "$state_file"',
    'if [ -n "${PID:-}" ]; then',
    '  kill "$PID" 2>/dev/null || true',
    "fi",
  ].join("\n")
}

function quote(value: string) {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`
}

function abortError() {
  return Object.assign(new Error("SSH workspace start aborted"), { name: "AbortError" })
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError"
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw (signal.reason instanceof Error ? signal.reason : abortError())
}

function assertLive(
  signal: AbortSignal,
  generations: Map<string, number>,
  id: ReturnType<typeof DesktopWorkspaceID.make>,
  generation: number,
) {
  throwIfAborted(signal)
  if (generations.get(id) !== generation) throw abortError()
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    throwIfAborted(signal)
    const timer = setTimeout(done, ms)
    const abort = () => {
      clearTimeout(timer)
      reject(signal.reason instanceof Error ? signal.reason : abortError())
    }

    function done() {
      signal.removeEventListener("abort", abort)
      resolve()
    }

    signal.addEventListener("abort", abort, { once: true })
  })
}

function allocatePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (typeof address !== "object" || !address) {
        server.close()
        reject(new Error("Failed to allocate port"))
        return
      }
      server.close(() => resolve(address.port))
    })
  })
}

async function materializeHostKey(hostKey: DesktopSshHostKey): Promise<MaterializedHostKey> {
  if (hostKey.kind === "known_hosts") {
    return {
      path: hostKey.path,
      cleanup: async () => undefined,
    }
  }

  const dir = await mkdtemp(path.join(tmpdir(), "slopcode-ssh-known-hosts-"))
  const file = path.join(dir, "known_hosts")
  await writeFile(file, `${hostKey.value}\n`, "utf8")
  return {
    path: file,
    cleanup: async () => rm(dir, { recursive: true, force: true }),
  }
}

function runSsh(args: string[], script: string, timeoutMs: number, signal?: AbortSignal) {
  return new Promise<CommandResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : abortError())
      return
    }

    const child = spawn("ssh", args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    })
    let stdout = ""
    let stderr = ""
    let done = false
    const finish = (next: () => void) => {
      if (done) return
      done = true
      clearTimeout(timeout)
      signal?.removeEventListener("abort", abort)
      next()
    }
    const abort = () =>
      finish(() => {
        child.kill()
        reject(signal?.reason instanceof Error ? signal.reason : abortError())
      })
    const timeout = setTimeout(() => {
      child.kill()
      finish(() => reject(new Error(`ssh ${args.join(" ")} timed out after ${timeoutMs}ms`)))
    }, timeoutMs)

    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk
    })
    child.once("error", (error) => {
      finish(() => reject(error))
    })
    child.once("close", (code, signal) => {
      finish(() => resolve({ code, signal, stdout, stderr }))
    })
    signal?.addEventListener("abort", abort, { once: true })
    child.stdin.end(script)
  })
}

function openTunnel(args: string[]): TunnelProcess {
  const child = spawn("ssh", args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })
  return {
    stop: () => child.kill(),
    onExit: (cb) => child.once("exit", cb),
  }
}

async function validateRemoteDirectory(
  url: string,
  password: string,
  directory: string,
  signal?: AbortSignal,
): Promise<DesktopRemoteValidation> {
  const target = new URL("/path", url)
  target.searchParams.set("directory", directory)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5_000)
  const abort = () => controller.abort(signal?.reason instanceof Error ? signal.reason : abortError())
  signal?.addEventListener("abort", abort, { once: true })
  const res = await fetch(target, {
    method: "GET",
    headers: {
      authorization: `Basic ${Buffer.from(`slopcode:${password}`).toString("base64")}`,
    },
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timer)
    signal?.removeEventListener("abort", abort)
  })

  if (!res.ok) {
    const text = summarize(await res.text())
    throw new Error(text || `Remote directory validation failed with status ${res.status}`)
  }

  const body = (await res.json().catch(() => null)) as { directory?: unknown } | null
  const next = typeof body?.directory === "string" ? body.directory : directory
  if (next !== directory) throw new Error(`Remote directory resolved to ${next} instead of ${directory}`)
  return { directory: next }
}

function asWorkspacePath(value: string): DesktopRemoteWorkspace["directory"] {
  return value as DesktopRemoteWorkspace["directory"]
}

async function defaultHealth(url: string, password: string, signal?: AbortSignal) {
  let healthUrl: URL
  try {
    healthUrl = new URL("/global/health", url)
  } catch {
    return false
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3_000)
    const abort = () => controller.abort(signal?.reason instanceof Error ? signal.reason : abortError())
    signal?.addEventListener("abort", abort, { once: true })
    const res = await fetch(healthUrl, {
      method: "GET",
      headers: {
        authorization: `Basic ${Buffer.from(`slopcode:${password}`).toString("base64")}`,
      },
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", abort)
    })
    return res.ok
  } catch {
    return false
  }
}
