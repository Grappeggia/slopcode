import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import path, { posix } from "node:path"
import { Schema } from "effect"
import { RemoteHost, RemoteWorkspaceSsh } from "../../../../protocol/src/remote"
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
  stopRemote: () => Promise<void>
  cleanup: () => Promise<void>
}

type Deps = {
  allocatePort: () => Promise<number>
  uuid: () => string
  runSsh: (args: string[], script: string, timeoutMs: number) => Promise<CommandResult>
  openTunnel: (args: string[]) => TunnelProcess
  health: (url: string, password: string) => Promise<boolean>
  validateRemoteDirectory: (url: string, password: string, directory: string) => Promise<DesktopRemoteValidation>
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

export function createSshRemoteHostService(opts: Partial<Deps> = {}): DesktopRemoteHostService {
  const deps = withDeps(opts)
  const listeners = new Set<(event: DesktopRemoteEvent) => void>()
  const states = new Map<string, DesktopRemoteState>()
  const active = new Map<string, RunningWorkspace>()
  const pending = new Map<string, Promise<DesktopRemoteReady>>()

  const emit = (state: DesktopRemoteState) => {
    states.set(state.id, state)
    for (const listener of listeners) listener({ type: "state", state })
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
    if (running) return running

    const task = (async () => {
      emit({
        kind: "validating",
        id: target.id,
        host: target.host,
        workspace: target.workspace,
      })
      const hostKey = await deps.materializeHostKey(target.hostKey)
      const cleanup = async () => hostKey.cleanup()

      try {
        emit({
          kind: "starting",
          id: target.id,
          host: target.host,
          workspace: target.workspace,
        })
        const requestedPort = await deps.allocatePort()
        const requestedPassword = deps.uuid()
        const execArgs = buildSshExecArgs(target, hostKey.path)
        const bootstrap = await deps.runSsh(execArgs, bootstrapScript(requestedPort, requestedPassword), SSH_SCRIPT_TIMEOUT_MS)
        const remote = parseBootstrap(bootstrap)
        const localPort = await deps.allocatePort()
        const tunnel = deps.openTunnel(buildSshTunnelArgs(target, hostKey.path, localPort, remote.port))
        const url = `http://127.0.0.1:${localPort}`

        try {
          await waitForHealth(() => deps.health(url, remote.password))
          await deps.validateRemoteDirectory(url, remote.password, target.remoteDirectory)
        } catch (error) {
          tunnel.stop()
          throw error
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
          stopRemote: () => deps.runSsh(execArgs, stopScript(), SSH_SCRIPT_TIMEOUT_MS).then(() => undefined),
          cleanup,
        } satisfies RunningWorkspace

        active.set(target.id, item)
        emit(state)
        tunnel.onExit((code, signal) => {
          if (active.get(target.id) !== item) return
          active.delete(target.id)
          void cleanup()
          fail(target, `SSH tunnel exited (code=${code ?? "null"} signal=${signal ?? "null"})`)
        })
        return state
      } catch (error) {
        await cleanup().catch(() => undefined)
        const message = error instanceof Error ? error.message : String(error)
        fail(target, message)
        throw error
      } finally {
        pending.delete(target.id)
      }
    })()

    pending.set(target.id, task)
    return task
  }

  const stop = async (id: ReturnType<typeof DesktopWorkspaceID.make>) => {
    const item = active.get(id)
    const state = states.get(id)
    active.delete(id)
    if (item) {
      item.tunnel.stop()
      await item.stopRemote().catch(() => undefined)
      await item.cleanup().catch(() => undefined)
    }
    if (state) {
      emit({
        kind: "stopped",
        id: state.id,
        host: state.host,
        workspace: state.workspace,
      })
    }
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
      await Promise.all([...new Set([...active.keys(), ...states.keys()])].map((id) => stop(DesktopWorkspaceID.make(id))))
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

async function waitForHealth(check: () => Promise<boolean>) {
  const timeout = Date.now() + SSH_HEALTH_TIMEOUT_MS
  while (Date.now() < timeout) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
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

function bootstrapScript(port: number, password: string) {
  return [
    "set -eu",
    'state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/slopcode"',
    'state_file="$state_dir/desktop-ssh-server.env"',
    'log_file="$state_dir/desktop-ssh-server.log"',
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
    '  if matches_pid && [ -n "${PORT:-}" ] && [ -n "${PASSWORD:-}" ]; then',
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
    `PORT=${port}`,
    `PASSWORD='${password}'`,
    'nohup env SLOPCODE_SERVER_USERNAME=slopcode SLOPCODE_SERVER_PASSWORD="$PASSWORD" SLOPCODE_CLIENT=desktop SLOPCODE_DISABLE_EMBEDDED_WEB_UI=true "$bin" serve --hostname 127.0.0.1 --port "$PORT" >>"$log_file" 2>&1 &',
    "PID=$!",
    'cat >"$state_file" <<EOF',
    'PID=$PID',
    'PORT=$PORT',
    'PASSWORD="$PASSWORD"',
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

function stopScript() {
  return [
    "set -eu",
    'state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/slopcode"',
    'state_file="$state_dir/desktop-ssh-server.env"',
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

function runSsh(args: string[], script: string, timeoutMs: number) {
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn("ssh", args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    })
    let stdout = ""
    let stderr = ""
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error(`ssh ${args.join(" ")} timed out after ${timeoutMs}ms`))
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
      clearTimeout(timeout)
      reject(error)
    })
    child.once("close", (code, signal) => {
      clearTimeout(timeout)
      resolve({ code, signal, stdout, stderr })
    })
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

async function validateRemoteDirectory(url: string, password: string, directory: string): Promise<DesktopRemoteValidation> {
  const target = new URL("/path", url)
  target.searchParams.set("directory", directory)
  const res = await fetch(target, {
    method: "GET",
    headers: {
      authorization: `Basic ${Buffer.from(`slopcode:${password}`).toString("base64")}`,
    },
    signal: AbortSignal.timeout(5_000),
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

async function defaultHealth(url: string, password: string) {
  let healthUrl: URL
  try {
    healthUrl = new URL("/global/health", url)
  } catch {
    return false
  }

  try {
    const res = await fetch(healthUrl, {
      method: "GET",
      headers: {
        authorization: `Basic ${Buffer.from(`slopcode:${password}`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(3_000),
    })
    return res.ok
  } catch {
    return false
  }
}
