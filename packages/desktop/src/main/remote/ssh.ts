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
  port: Promise<number>
  stop: () => void
  onExit: (cb: (code: number | null, signal: NodeJS.Signals | null) => void) => void
  onError: (cb: (error: Error) => void) => void
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
    "-v",
    "-L",
    `127.0.0.1:${localPort}:127.0.0.1:${remotePort}`,
    target.authority,
  ]
}

export function buildSshBootstrapScript(target: NormalizedSshTarget, port: number, password: string) {
  return bootstrapScript(target, port, password)
}

export function buildSshStopScript(target: NormalizedSshTarget, password?: string) {
  return stopScript(target, password)
}

export function createSshRemoteHostService(opts: Partial<Deps> = {}): DesktopRemoteHostService {
  const deps = withDeps(opts)
  const listeners = new Set<(event: DesktopRemoteEvent) => void>()
  const states = new Map<string, DesktopRemoteState>()
  const active = new Map<string, RunningWorkspace>()
  const pending = new Map<string, PendingWorkspace>()
  const generations = new Map<string, number>()
  const operations = new Map<string, Promise<unknown>>()

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

  const fail = (target: NormalizedSshTarget, message: string, secrets: string[] = []) => {
    const state = {
      kind: "failed",
      id: target.id,
      host: target.host,
      workspace: target.workspace,
      message: redact(message, secrets),
    } satisfies DesktopRemoteState
    emit(state)
    return state
  }

  const queue = <T>(id: string, operation: () => Promise<T>) => {
    const previous = operations.get(id) ?? Promise.resolve()
    let tracked!: Promise<T>
    const next = previous.catch(() => undefined).then(operation)
    tracked = next.finally(() => {
      if (operations.get(id) === tracked) operations.delete(id)
    })
    operations.set(id, tracked)
    return tracked
  }

  const closeUnexpected = (
    target: NormalizedSshTarget,
    generation: number,
    item: RunningWorkspace,
    error: Error,
  ) => {
    if (active.get(target.id) !== item) return
    if (generations.get(target.id) !== generation) return
    active.delete(target.id)
    item.tunnel.stop()
    void queue(target.id, async () => {
      await item.stopRemote().catch(() => undefined)
      await item.cleanup().catch(() => undefined)
      if (generations.get(target.id) === generation) fail(target, error.message, [item.state.password])
    }).catch(() => undefined)
  }

  const start = async (target: NormalizedSshTarget, signal: AbortController, generation: number) => {
    const current = active.get(target.id)
    if (current) return current.state

    emit({
      kind: "validating",
      id: target.id,
      host: target.host,
      workspace: target.workspace,
    })
    let cleanup = async () => {}
    let stopRemote = async () => {}
    let stopStartup = async () => {}
    let tunnel: TunnelProcess | undefined
    let item: RunningWorkspace | undefined
    let requestedPassword = ""
    let remotePassword = ""
    let tunnelError: Error | undefined
    let rejectTunnel!: (error: Error) => void
    const tunnelFailure = new Promise<never>((_, reject) => {
      rejectTunnel = reject
    })
    const reportTunnelFailure = (error: unknown) => {
      const next = error instanceof Error ? error : new Error(String(error))
      if (tunnelError) return
      tunnelError = next
      rejectTunnel(next)
      if (item) closeUnexpected(target, generation, item, next)
    }

    try {
      const hostKey = await deps.materializeHostKey(target.hostKey)
      cleanup = once(hostKey.cleanup)
      assertLive(signal.signal, generations, target.id, generation)

      emit({
        kind: "starting",
        id: target.id,
        host: target.host,
        workspace: target.workspace,
      })
      const execArgs = buildSshExecArgs(target, hostKey.path)
      stopRemote = once(() => deps.runSsh(execArgs, stopScript(target), SSH_SCRIPT_TIMEOUT_MS).then(() => undefined))
      const requestedPort = await deps.allocatePort()
      assertLive(signal.signal, generations, target.id, generation)
      requestedPassword = deps.uuid()
      stopStartup = once(() =>
        deps.runSsh(execArgs, stopScript(target, requestedPassword), SSH_SCRIPT_TIMEOUT_MS).then(() => undefined),
      )
      const bootstrap = await deps.runSsh(
        execArgs,
        bootstrapScript(target, requestedPort, requestedPassword),
        SSH_SCRIPT_TIMEOUT_MS,
        signal.signal,
      )
      assertLive(signal.signal, generations, target.id, generation)
      const remote = parseBootstrap(bootstrap)
      remotePassword = remote.password
      assertLive(signal.signal, generations, target.id, generation)
      tunnel = deps.openTunnel(buildSshTunnelArgs(target, hostKey.path, 0, remote.port))
      tunnel.onExit((code, exitSignal) => {
        reportTunnelFailure(new Error(`SSH tunnel exited (code=${code ?? "null"} signal=${exitSignal ?? "null"})`))
      })
      tunnel.onError(reportTunnelFailure)
      const localPort = await Promise.race([tunnel.port, tunnelFailure])
      assertLive(signal.signal, generations, target.id, generation)
      const url = `http://127.0.0.1:${localPort}`
      const closeTunnel = () => tunnel?.stop()
      signal.signal.addEventListener("abort", closeTunnel, { once: true })

      try {
        await Promise.race([waitForHealth(() => deps.health(url, remote.password, signal.signal), signal.signal), tunnelFailure])
        assertLive(signal.signal, generations, target.id, generation)
        await Promise.race([
          deps.validateRemoteDirectory(url, remote.password, target.remoteDirectory, signal.signal),
          tunnelFailure,
        ])
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

      item = {
        state,
        tunnel,
        stopRemote,
        cleanup,
      }

      assertLive(signal.signal, generations, target.id, generation)
      if (tunnelError) throw tunnelError
      active.set(target.id, item)
      emit(state)
      return state
    } catch (error) {
      tunnel?.stop()
      await stopStartup().catch(() => undefined)
      await cleanup().catch(() => undefined)
      if (isAbortError(error)) throw error
      const message = error instanceof Error ? error.message : String(error)
      if (generations.get(target.id) === generation) fail(target, message, [requestedPassword, remotePassword])
      throw error
    }
  }

  const ensure = (input: DesktopSshTarget) => {
    const target = normalizeSshTarget(input)
    const running = pending.get(target.id)
    if (running) return running.promise

    const signal = new AbortController()
    const task = queue(target.id, async () => {
      const current = active.get(target.id)
      if (current) return current.state
      const generation = nextGeneration(target.id)
      return start(target, signal, generation)
    })
    pending.set(target.id, {
      promise: task,
      cancel: () => signal.abort(abortError()),
    })
    void task.then(
      () => {
        if (pending.get(target.id)?.promise === task) pending.delete(target.id)
      },
      () => {
        if (pending.get(target.id)?.promise === task) pending.delete(target.id)
      },
    )
    return task
  }

  const stop = (id: ReturnType<typeof DesktopWorkspaceID.make>) => {
    const item = active.get(id)
    const running = pending.get(id)
    nextGeneration(id)
    running?.cancel()
    if (pending.get(id) === running) pending.delete(id)
    return queue(id, async () => {
      if (active.get(id) === item) active.delete(id)
      const state = states.get(id)
      if (state?.kind !== "stopped" && state) stopped(state)
      if (item) {
        item.tunnel.stop()
        await item.stopRemote().catch(() => undefined)
        await item.cleanup().catch(() => undefined)
      }
      if (running) await running.promise.catch(() => undefined)
    })
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
      const ready = await ensure(target)
      return deps.validateRemoteDirectory(ready.url, ready.password, ready.workspace.remoteDirectory)
    },
    ensureWorkspace: ensure,
    stopWorkspace: stop,
    async stopAll() {
      await Promise.all(
        [...new Set([...active.keys(), ...pending.keys(), ...states.keys(), ...operations.keys()])].map((id) =>
          stop(DesktopWorkspaceID.make(id)),
        ),
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

function readStateLines() {
  return [
    "read_state() {",
    '  exec 3<"$state_file" || return 1',
    '  IFS= read -r next_pid <&3 || { exec 3<&-; return 1; }',
    '  IFS= read -r next_port <&3 || { exec 3<&-; return 1; }',
    '  IFS= read -r next_password <&3 || { exec 3<&-; return 1; }',
    '  IFS= read -r next_workspace <&3 || { exec 3<&-; return 1; }',
    '  IFS= read -r next_start <&3 || { exec 3<&-; return 1; }',
    '  IFS= read -r next_exe <&3 || { exec 3<&-; return 1; }',
    '  if IFS= read -r state_extra <&3; then',
    "    exec 3<&-",
    "    return 1",
    "  fi",
    "  exec 3<&-",
    '  [ -n "$next_pid" ] || return 1',
    '  [ -n "$next_port" ] || return 1',
    '  [ -n "$next_password" ] || return 1',
    '  [ -n "$next_workspace" ] || return 1',
    '  [ -n "$next_start" ] || return 1',
    '  [ -n "$next_exe" ] || return 1',
    '  state_pid="$next_pid"',
    '  state_port="$next_port"',
    '  state_password="$next_password"',
    '  state_workspace="$next_workspace"',
    '  state_start="$next_start"',
    '  state_exe="$next_exe"',
    "}",
  ]
}

function processIdentityLines() {
  return [
    "process_start() {",
    '  pid="$1"',
    '  marker=""',
    '  if [ -r "/proc/$pid/stat" ]; then',
    '    stat="$(cat "/proc/$pid/stat" 2>/dev/null || true)"',
    '    rest="$(printf \'%s\\n\' "$stat" | sed \'s/^[^)]*) //\')"',
    '    marker="$(printf \'%s\\n\' "$rest" | awk \'{print $20}\' || true)"',
    "  fi",
    '  if [ -z "$marker" ]; then',
    '    marker="$(ps -p "$pid" -o lstart= 2>/dev/null | sed \'s/^[[:space:]]*//;s/[[:space:]]*$//\' || true)"',
    "  fi",
    '  [ -n "$marker" ] || return 1',
    '  printf \'%s\\n\' "$marker"',
    "}",
    "process_exe() {",
    '  pid="$1"',
    '  if [ -r "/proc/$pid/exe" ] && command -v readlink >/dev/null 2>&1; then',
    '    exe="$(readlink "/proc/$pid/exe" 2>/dev/null || true)"',
    '    if [ -n "$exe" ]; then',
    '      printf \'%s\\n\' "$exe"',
    "      return 0",
    "    fi",
    "  fi",
    '  exe="$(ps -p "$pid" -o comm= 2>/dev/null | sed \'s/^[[:space:]]*//;s/[[:space:]]*$//\' || true)"',
    '  [ -n "$exe" ] || return 1',
    '  printf \'%s\\n\' "$exe"',
    "}",
    "resolve_exe() {",
    '  bin="$1"',
    '  case "$bin" in',
    '    /*) candidate="$bin" ;;',
    '    *) candidate="$(command -v "$bin" || true)" ;;',
    '  esac',
    '  case "$candidate" in',
    '    /*) ;;',
    '    *) candidate="$(pwd -P)/$candidate" ;;',
    '  esac',
    '  if command -v readlink >/dev/null 2>&1; then',
    '    resolved="$(readlink -f "$candidate" 2>/dev/null || true)"',
    '    if [ -n "$resolved" ]; then',
    '      printf \'%s\\n\' "$resolved"',
    "      return 0",
    "    fi",
    "  fi",
    '  printf \'%s\\n\' "$candidate"',
    "}",
  ]
}

function matchesServerLines() {
  return [
    "matches_server() {",
    '  pid="$1"',
    '  port="$2"',
    '  expected_start="$3"',
    '  expected_exe="$4"',
    '  case "$pid" in',
    "    ''|*[!0-9]*) return 1 ;;",
    "  esac",
    '  case "$port" in',
    "    ''|*[!0-9]*) return 1 ;;",
    "  esac",
    '  [ -n "$expected_start" ] || return 1',
    '  [ -n "$expected_exe" ] || return 1',
    '  actual_start="$(process_start "$pid" 2>/dev/null || true)"',
    '  [ "$actual_start" = "$expected_start" ] || return 1',
    '  actual_exe="$(process_exe "$pid" 2>/dev/null || true)"',
    '  [ -n "$actual_exe" ] || return 1',
    '  expected_name="${expected_exe##*/}"',
    '  actual_name="${actual_exe##*/}"',
    '  if [ -r "/proc/$pid/exe" ]; then',
    '    [ "$actual_exe" = "$expected_exe" ] || return 1',
    "  else",
    '    [ "$actual_name" = "$expected_name" ] || return 1',
    "  fi",
    '  comm="$(ps -p "$pid" -o comm= 2>/dev/null || true)"',
    '  [ -n "$comm" ] || return 1',
    '  case "$comm" in',
    '    "$expected_name"|"$expected_exe") ;;',
    "    *) return 1 ;;",
    "  esac",
    '  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"',
    '  [ -n "$cmd" ] || return 1',
    '  expected_args="serve --hostname 127.0.0.1 --port $port"',
    '  case "$cmd" in',
    '    "$expected_exe $expected_args"|"$expected_name $expected_args") return 0 ;;',
    "    *) return 1 ;;",
    "  esac",
    "}",
  ]
}

function waitForStateLines() {
  return [
    "wait_for_state() {",
    '  tries="${1:-20}"',
    '  while [ "$tries" -gt 0 ]; do',
    "    if read_state; then",
    "      return 0",
    "    fi",
    '    tries=$((tries - 1))',
    '    sleep 0.1',
    "  done",
    "  return 1",
    "}",
  ]
}

function waitForServerLines() {
  return [
    "wait_for_server() {",
    '  tries="${1:-20}"',
    '  while [ "$tries" -gt 0 ]; do',
    '    if matches_server "$state_pid" "$state_port" "$state_start" "$state_exe"; then',
    "      return 0",
    "    fi",
    '    if ! kill -0 "$state_pid" 2>/dev/null; then',
    "      return 1",
    "    fi",
    '    tries=$((tries - 1))',
    '    sleep 0.1',
    "  done",
    "  return 1",
    "}",
  ]
}

function bootstrapScript(target: NormalizedSshTarget, port: number, password: string) {
  return [
    "set -eu",
    `dir=${quote(target.remoteDirectory)}`,
    `key=${quote(target.stateKey)}`,
    'state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/slopcode"',
    'state_file="$state_dir/desktop-ssh-server-$key.state"',
    'log_file="$state_dir/desktop-ssh-server-$key.log"',
    "mkdir -p \"$state_dir\"",
    ...readStateLines(),
    ...processIdentityLines(),
    ...matchesServerLines(),
    ...waitForStateLines(),
    ...waitForServerLines(),
    'if [ -f "$state_file" ]; then',
    '  if read_state && [ "$state_workspace" = "$dir" ] && matches_server "$state_pid" "$state_port" "$state_start" "$state_exe"; then',
    '    printf \'{"attached":true,"port":%s,"username":"slopcode","password":"%s"}\\n\' "$state_port" "$state_password"',
    "    exit 0",
    "  fi",
    '  rm -f "$state_file"',
    "fi",
    'bin="$(command -v slopcode || true)"',
    'if [ -z "$bin" ] && [ -x "$HOME/.slopcode/bin/slopcode" ]; then',
    '  bin="$HOME/.slopcode/bin/slopcode"',
    "fi",
    'if [ -z "$bin" ]; then',
    '  echo "slopcode executable not found" >&2',
    "  exit 41",
    "fi",
    'exe="$(resolve_exe "$bin" || true)"',
    'if [ -z "$exe" ]; then',
    '  echo "failed to identify slopcode executable" >&2',
    "  exit 44",
    "fi",
    'cd "$dir"',
    `PORT=${port}`,
    `PASSWORD=${quote(password)}`,
    'STATE_FILE="$state_file" BIN="$exe" EXE="$exe" PORT="$PORT" PASSWORD="$PASSWORD" DIR="$dir" nohup sh -se <<\'EOF\' >>"$log_file" 2>&1 &',
    "umask 077",
    'cd "$DIR"',
    'tmp="$STATE_FILE.tmp.$$"',
    'trap \'rm -f "$tmp"\' EXIT HUP INT TERM',
    'start=""',
    'if [ -r "/proc/$$/stat" ]; then',
    '  stat="$(cat "/proc/$$/stat" 2>/dev/null || true)"',
    '  rest="$(printf \'%s\\n\' "$stat" | sed \'s/^[^)]*) //\')"',
    '  start="$(printf \'%s\\n\' "$rest" | awk \'{print $20}\' || true)"',
    "fi",
    'if [ -z "$start" ]; then',
    '  start="$(ps -p "$$" -o lstart= 2>/dev/null | sed \'s/^[[:space:]]*//;s/[[:space:]]*$//\' || true)"',
    "fi",
    'if [ -z "$start" ] || [ -z "$EXE" ]; then',
    '  echo "failed to identify slopcode process" >&2',
    "  exit 44",
    "fi",
    'printf \'%s\\n\' "$$" "$PORT" "$PASSWORD" "$DIR" "$start" "$EXE" >"$tmp"',
    'mv -f "$tmp" "$STATE_FILE"',
    'trap - EXIT HUP INT TERM',
    'exec env SLOPCODE_SERVER_USERNAME=slopcode SLOPCODE_SERVER_PASSWORD="$PASSWORD" SLOPCODE_CLIENT=desktop SLOPCODE_DISABLE_EMBEDDED_WEB_UI=true "$BIN" serve --hostname 127.0.0.1 --port "$PORT"',
    "EOF",
    "launch_pid=$!",
    "if ! wait_for_state 20 || ! wait_for_server 20; then",
    '  rm -f "$state_file"',
    '  kill "$launch_pid" 2>/dev/null || true',
    '  wait "$launch_pid" 2>/dev/null || true',
    '  echo "failed to persist ssh workspace state" >&2',
    "  exit 42",
    "fi",
    'if [ "$state_pid" != "$launch_pid" ] || [ "$state_port" != "$PORT" ] || [ "$state_password" != "$PASSWORD" ] || [ "$state_workspace" != "$dir" ] || [ -z "$state_start" ] || [ -z "$state_exe" ]; then',
    '  rm -f "$state_file"',
    '  kill "$launch_pid" 2>/dev/null || true',
    '  wait "$launch_pid" 2>/dev/null || true',
    '  echo "ssh workspace state mismatch" >&2',
    "  exit 43",
    "fi",
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

function stopScript(target: NormalizedSshTarget, password?: string) {
  return [
    "set -eu",
    `dir=${quote(target.remoteDirectory)}`,
    `key=${quote(target.stateKey)}`,
    ...(password ? [`expected_password=${quote(password)}`] : []),
    'state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/slopcode"',
    'state_file="$state_dir/desktop-ssh-server-$key.state"',
    ...readStateLines(),
    ...processIdentityLines(),
    ...matchesServerLines(),
    ...waitForServerLines(),
    ...(password
      ? [
          'if [ ! -f "$state_file" ]; then',
          '  tries=20',
          '  while [ ! -f "$state_file" ] && [ "$tries" -gt 0 ]; do',
          '    tries=$((tries - 1))',
          '    sleep 0.1',
          "  done",
          "fi",
        ]
      : []),
    'if [ ! -f "$state_file" ]; then',
    "  exit 0",
    "fi",
    'if ! read_state; then',
    '  rm -f "$state_file"',
    "  exit 0",
    "fi",
    'if [ "$state_workspace" != "$dir" ]; then',
    '  rm -f "$state_file"',
    "  exit 0",
    "fi",
    ...(password
      ? [
          'if [ "$state_password" != "$expected_password" ]; then',
          "  exit 0",
          "fi",
          'if ! matches_server "$state_pid" "$state_port" "$state_start" "$state_exe"; then',
          '  if ! wait_for_server 20; then',
          '    rm -f "$state_file"',
          "    exit 0",
          "  fi",
          "fi",
        ]
      : [
          'if ! matches_server "$state_pid" "$state_port" "$state_start" "$state_exe"; then',
          '  rm -f "$state_file"',
          "  exit 0",
          "fi",
        ]),
    'rm -f "$state_file"',
    'kill "$state_pid" 2>/dev/null || true',
  ].join("\n")
}

function quote(value: string) {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`
}

function once(task: () => Promise<void>) {
  let result: Promise<void> | undefined
  return () => {
    if (result) return result
    result = task()
    return result
  }
}

function redact(value: string, secrets: string[]) {
  return secrets.filter(Boolean).reduce((next, secret) => next.replaceAll(secret, "[redacted]"), value)
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
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
  })
  let resolvePort!: (port: number) => void
  let rejectPort!: (error: Error) => void
  let assigned = false
  let failure: Error | undefined
  let exit: { code: number | null; signal: NodeJS.Signals | null } | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let outputBuffer = ""
  const exits = new Set<(code: number | null, signal: NodeJS.Signals | null) => void>()
  const errors = new Set<(error: Error) => void>()
  const port = new Promise<number>((resolve, reject) => {
    resolvePort = resolve
    rejectPort = reject
  })
  const fail = (error: unknown) => {
    const next = error instanceof Error ? error : new Error(String(error))
    if (failure) return
    failure = next
    if (timer) clearTimeout(timer)
    rejectPort(next)
    for (const cb of errors) cb(next)
    errors.clear()
  }
  const assign = (next: number) => {
    if (assigned || failure) return
    assigned = true
    if (timer) clearTimeout(timer)
    resolvePort(next)
  }
  const output = (chunk: string) => {
    outputBuffer += chunk
    const match = /Local forwarding listening on [^\r\n]*\bport ([0-9]+)\.?/i.exec(outputBuffer)
    const next = Number(match?.[1])
    if (Number.isInteger(next) && next > 0 && next <= 65_535) assign(next)
    if (outputBuffer.length > 4_096) outputBuffer = outputBuffer.slice(-4_096)
  }
  child.stderr.setEncoding("utf8")
  child.stderr.on("data", output)
  child.once("error", fail)
  child.once("exit", (code, signal) => {
    exit = { code, signal }
    if (!assigned) fail(new Error(`SSH tunnel exited before local port assignment (code=${code ?? "null"} signal=${signal ?? "null"})`))
    for (const cb of exits) cb(code, signal)
    exits.clear()
  })
  timer = setTimeout(() => fail(new Error("SSH tunnel did not report its assigned local port")), SSH_SCRIPT_TIMEOUT_MS)
  return {
    port,
    stop: () => child.kill(),
    onExit: (cb) => {
      if (exit) cb(exit.code, exit.signal)
      else exits.add(cb)
    },
    onError: (cb) => {
      if (failure) cb(failure)
      else errors.add(cb)
    },
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
