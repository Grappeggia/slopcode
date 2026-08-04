export const SSH_AGENTS = ["opencode-cli", "codex-cli", "claude-code", "antigravity-cli"] as const
export type SshAgent = (typeof SSH_AGENTS)[number]
export const SSH_SETUP_ACTIONS = ["install", "login"] as const
export type SshSetupAction = (typeof SSH_SETUP_ACTIONS)[number]
export type SshLoginFlow = "device-code" | "provider-method" | "ssh-browser-code"

export function sshLoginFlow(agent: SshAgent): SshLoginFlow {
  if (agent === "codex-cli") return "device-code"
  if (agent === "opencode-cli") return "provider-method"
  return "ssh-browser-code"
}

export function sshLoginGuidance(agent: SshAgent) {
  if (agent === "codex-cli")
    return "Codex is using OAuth device authentication. Open the link on this phone and enter the code; no browser callback is needed on the computer."
  if (agent === "opencode-cli")
    return "OpenCode will ask which provider and login method to use. Choose that provider’s device or headless method when one is offered."
  if (agent === "antigravity-cli")
    return "Antigravity detects SSH and shows a secure Google sign-in link plus a code to return to this screen."
  return "Claude Code detects SSH and shows a browser sign-in link plus a code to return to this screen."
}

export function sshSetupRecipe(agent: SshAgent, action: SshSetupAction) {
  const install =
    agent === "codex-cli"
      ? 'npm install --prefix "$HOME/.local" -g @openai/codex (uses apt-get to install Node.js/npm if npm is missing)'
      : agent === "opencode-cli"
        ? 'npm install --prefix "$HOME/.local" -g opencode-ai (uses apt-get to install Node.js/npm if npm is missing)'
        : agent === "claude-code"
          ? 'npm install --prefix "$HOME/.local" -g @anthropic-ai/claude-code (uses apt-get to install Node.js/npm if npm is missing)'
          : "curl -fsSL https://antigravity.google/cli/install.sh | bash (uses apt-get to install curl/bash if they are missing)"
  if (action === "install") return install
  if (agent === "codex-cli") return "codex login --device-auth"
  if (agent === "opencode-cli") return "opencode auth login"
  if (agent === "antigravity-cli") return "agy"
  return "claude"
}

export type SshCredential =
  | { auth: "password"; password: string }
  | { auth: "privateKey"; privateKey: string; passphrase?: string }

export type SshConnectionInput = {
  profile: string
  host: string
  port: number
  username: string
  directory: string
  auth?: "password" | "privateKey"
  password?: string
  privateKey?: string
  passphrase?: string
  saveCredentials?: boolean
}

export type SshConnectResult =
  | { status: "connected"; profile: string; host: string; port: number; remoteTransport: true }
  | {
      status: "host_key_required"
      profile: string
      host: string
      port: number
      type: string
      fingerprint: string
    }
  | { status: "trusted"; profile: string; fingerprint: string }

export type SshFolderEntry = {
  name: string
  path: string
  type: "directory" | "file"
  size?: number
  modified?: number
}

export type SshFolderListing = {
  path: string
  parent?: string
  entries: SshFolderEntry[]
}

export type SshHome = {
  path: string
}

export type SshWorkspaceSelection = {
  path: string
}

export type SshPreflight = {
  agent: SshAgent
  executable: string
  exitCode: number
  output: string
  ok: boolean
  error?: string
}

export type SshAuthStatus = SshPreflight & {
  loggedIn: boolean
}

export type SshUpdateCheck = SshPreflight & {
  currentVersion: string
  latestVersion?: string
}

export type SshCodexAppServerStatus = {
  executable: "codex"
  state: "ready" | "needs_sign_in" | "not_installed" | "unavailable"
  ready: boolean
  handshake: "verified" | "failed" | "not_run"
  message: string
  output: string
  preflight: SshPreflight
  auth?: SshAuthStatus
  error?: string
}

export type SshSessionStart = {
  id: string
  status: "started"
  operation: "interactive" | "prompt" | SshSetupAction
}

export type SshOrchestratorStart = {
  id: string
  status: "started"
}

export type SshOrchestratorPreflight = {
  executable: "slopcode"
  version?: string
  ok: boolean
  exitCode: number
  error?: { code: string; message: string }
}

export type SshOrchestratorInstall = {
  executable: "slopcode"
  package: "slopcode@latest"
  operation: "install_or_upgrade"
  ok: boolean
  exitCode: number
  error?: { code: string; message: string }
}

export type SshOrchestratorEvent =
  | { type: "started"; id: string }
  | { type: "output"; id: string; data: string }
  | { type: "completed"; id: string; exitCode: number }
  | { type: "error"; id: string; message: string }

export type SshEvent =
  | { type: "started"; id: string; operation: "interactive" | "prompt" | SshSetupAction; agent: SshAgent }
  | { type: "output"; id: string; stream: "stdout" | "stderr"; data: string }
  | { type: "completed"; id: string; exitCode: number }
  | { type: "error"; id: string; message: string }

export type SshTransport = {
  connect(input: SshConnectionInput): Promise<SshConnectResult>
  cancelConnect(): Promise<unknown>
  trustHostKey(profile: string, fingerprint: string): Promise<SshConnectResult>
  status(): Promise<{ connected: boolean; remoteTransport: boolean; profile?: string }>
  disconnect(): Promise<unknown>
  cleanup(): Promise<unknown>
  home(): Promise<string>
  list(path: string, showHidden?: boolean): Promise<SshFolderListing>
  selectWorkspace(path: string): Promise<string>
  execVersion(agent: SshAgent, directory: string): Promise<SshPreflight>
  execAuthStatus(agent: SshAgent, directory: string): Promise<SshAuthStatus>
  checkUpdate?: (agent: SshAgent, directory: string) => Promise<SshUpdateCheck>
  codexAppServerStatus(directory: string): Promise<SshCodexAppServerStatus>
  start(input: {
    operation: "interactive" | "prompt" | SshSetupAction
    agent: SshAgent
    directory: string
    prompt?: string
    cols?: number
    rows?: number
    width?: number
    height?: number
  }): Promise<SshSessionStart>
  orchestratorStart(directory: string): Promise<SshOrchestratorStart>
  orchestratorPreflight?(directory: string): Promise<SshOrchestratorPreflight>
  orchestratorInstall?(directory: string): Promise<SshOrchestratorInstall>
  orchestratorInput(value: string): Promise<unknown>
  orchestratorStop(): Promise<unknown>
  input(value: string): Promise<unknown>
  resize(cols: number, rows: number, width?: number, height?: number): Promise<unknown>
  interrupt(): Promise<unknown>
  credentialGet(profile: string): Promise<SshCredential | undefined>
  credentialSet(profile: string, credential: SshCredential): Promise<unknown>
  credentialClear(profile: string): Promise<unknown>
  subscribe(listener: (event: SshEvent) => void): () => void
  subscribeOrchestrator(listener: (event: SshOrchestratorEvent) => void): () => void
}

type Target = { user: string; host: string; port?: number }

const DEFAULT_PORT = 22
const MAX_PATH = 4_096
const MAX_TARGET = 320
const MAX_FINGERPRINT = 256
const MAX_SESSION_ID = 128
const MAX_EVENT_OUTPUT = 16 * 1024
const MAX_EVENT_ERROR = 2 * 1024
const MAX_ORCHESTRATOR_OUTPUT = 256 * 1024

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function validPort(value: string) {
  if (!/^[1-9][0-9]{0,4}$/.test(value)) return
  const port = Number(value)
  if (!Number.isInteger(port) || port > 65_535) return
  return port
}

function validUser(value: string) {
  return /^[A-Za-z_][A-Za-z0-9._-]{0,63}$/.test(value)
}

function validHost(value: string, ipv6 = false) {
  if (!value || value.length > (ipv6 ? 45 : 253) || /[\u0000-\u001f\u007f\r\n;&|$`"'<>()[\]{}*?!~\\]/.test(value))
    return
  if (ipv6) {
    if (!/^[0-9A-Fa-f:.]+$/.test(value) || !value.includes(":")) return
    return value.toLowerCase()
  }
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(value) || value.includes("..")) return
  if (value.split(".").some((item) => !item || item.startsWith("-") || item.endsWith("-"))) return
  return value.toLowerCase()
}

export function parseSshTarget(value: string): Target | undefined {
  const raw = clean(value)
  if (!raw || raw.length > MAX_TARGET) return
  const at = raw.indexOf("@")
  if (at < 1 || at !== raw.lastIndexOf("@")) return
  const user = raw.slice(0, at)
  const target = raw.slice(at + 1)
  if (!validUser(user) || !target) return
  if (target.startsWith("[")) {
    const close = target.indexOf("]")
    if (close < 0) return
    const rest = target.slice(close + 1)
    if (rest && !rest.startsWith(":")) return
    const port = rest ? validPort(rest.slice(1)) : undefined
    if (rest && !port) return
    const host = validHost(target.slice(1, close), true)
    if (!host) return
    return { user, host, ...(port ? { port } : {}) }
  }
  const colons = [...target].filter((item) => item === ":").length
  if (colons > 1) return
  const split = colons === 1 ? target.lastIndexOf(":") : -1
  const host = validHost(split < 0 ? target : target.slice(0, split))
  const port = split < 0 ? undefined : validPort(target.slice(split + 1))
  if (!host || (split >= 0 && !port)) return
  return { user, host, ...(port ? { port } : {}) }
}

export function normalizeSshTarget(value: string) {
  const target = parseSshTarget(value)
  if (!target) return
  const host = target.host.includes(":") ? `[${target.host}]` : target.host
  return `${target.user}@${host}${target.port === undefined ? "" : `:${target.port}`}`
}

export function sshProfile(value: string, port?: number) {
  const target = parseSshTarget(value)
  if (!target) return
  const next = target.port ?? port ?? DEFAULT_PORT
  if (!Number.isInteger(next) || next < 1 || next > 65_535) return
  const host = target.host.includes(":") ? `[${target.host}]` : target.host
  return `${target.user}@${host}:${next}`
}

export function validSshPath(value: string) {
  const next = clean(value)
  if (
    !next.startsWith("/") ||
    next.length > MAX_PATH ||
    (next !== "/" && next.endsWith("/")) ||
    next.includes("\\") ||
    next.includes("//") ||
    /[\u0000-\u001f\u007f\r\n?#]/.test(next) ||
    next.split("/").some((part) => part === "." || part === "..")
  )
    return
  return next
}

function validAgent(value: unknown): value is SshAgent {
  return typeof value === "string" && SSH_AGENTS.includes(value as SshAgent)
}

function validSetupAction(value: unknown): value is SshSetupAction {
  return typeof value === "string" && SSH_SETUP_ACTIONS.includes(value as SshSetupAction)
}

function validSessionID(value: unknown): value is string {
  return typeof value === "string" && /^ssh_[A-Za-z0-9_-]{1,120}$/.test(value) && value.length <= MAX_SESSION_ID
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseSshConnectResult(value: unknown): SshConnectResult | undefined {
  if (!object(value) || typeof value.status !== "string" || typeof value.profile !== "string") return
  if (value.status === "connected") {
    if (
      typeof value.host !== "string" ||
      typeof value.port !== "number" ||
      value.remoteTransport !== true ||
      !Number.isInteger(value.port)
    )
      return
    return { status: "connected", profile: value.profile, host: value.host, port: value.port, remoteTransport: true }
  }
  if (value.status === "trusted") {
    if (typeof value.fingerprint !== "string" || value.fingerprint.length > MAX_FINGERPRINT) return
    return { status: "trusted", profile: value.profile, fingerprint: value.fingerprint }
  }
  if (
    value.status !== "host_key_required" ||
    typeof value.host !== "string" ||
    typeof value.port !== "number" ||
    typeof value.type !== "string" ||
    typeof value.fingerprint !== "string" ||
    value.fingerprint.length > MAX_FINGERPRINT
  )
    return
  return {
    status: "host_key_required",
    profile: value.profile,
    host: value.host,
    port: value.port,
    type: value.type,
    fingerprint: value.fingerprint,
  }
}

export function parseSshStatus(value: unknown) {
  if (!object(value) || typeof value.connected !== "boolean" || typeof value.remoteTransport !== "boolean") return
  return {
    connected: value.connected,
    remoteTransport: value.remoteTransport,
    ...(typeof value.profile === "string" ? { profile: value.profile } : {}),
  }
}

export function parseSshListing(value: unknown): SshFolderListing | undefined {
  if (!object(value) || typeof value.path !== "string" || !validSshPath(value.path) || !Array.isArray(value.entries))
    return
  const entries = value.entries.flatMap((item): SshFolderEntry[] => {
    if (!object(item) || typeof item.name !== "string" || typeof item.path !== "string") return []
    if (item.type !== "directory" && item.type !== "file") return []
    if (!validSshPath(item.path) || item.name === "." || item.name === ".." || item.name.includes("/")) return []
    const expected = value.path === "/" ? `/${item.name}` : `${value.path}/${item.name}`
    if (item.path !== expected) return []
    return [
      {
        name: item.name,
        path: item.path,
        type: item.type,
        ...(typeof item.size === "number" && item.size >= 0 ? { size: item.size } : {}),
        ...(typeof item.modified === "number" && item.modified >= 0 ? { modified: item.modified } : {}),
      },
    ]
  })
  const parent = typeof value.parent === "string" && validSshPath(value.parent) ? value.parent : undefined
  return { path: value.path, ...(parent ? { parent } : {}), entries }
}

export function parseSshHome(value: unknown): string | undefined {
  if (!object(value) || typeof value.path !== "string") return
  return validSshPath(value.path)
}

export function parseSshWorkspaceSelection(value: unknown): SshWorkspaceSelection | undefined {
  const path = parseSshHome(value)
  if (!path || path === "/") return
  return { path }
}

export function parseSshPreflight(value: unknown): SshPreflight | undefined {
  if (
    !object(value) ||
    !validAgent(value.agent) ||
    typeof value.executable !== "string" ||
    typeof value.exitCode !== "number" ||
    typeof value.output !== "string" ||
    typeof value.ok !== "boolean"
  )
    return
  return {
    agent: value.agent,
    executable: value.executable,
    exitCode: value.exitCode,
    output: value.output,
    ok: value.ok,
    ...(typeof value.error === "string" ? { error: value.error } : {}),
  }
}

function orchestratorError(value: unknown) {
  if (!object(value) || typeof value.code !== "string" || typeof value.message !== "string") return
  return { code: value.code, message: value.message }
}

export function parseSshOrchestratorPreflight(value: unknown): SshOrchestratorPreflight | undefined {
  if (
    !object(value) ||
    value.executable !== "slopcode" ||
    typeof value.ok !== "boolean" ||
    typeof value.exitCode !== "number"
  )
    return
  const error = value.error === null || value.error === undefined ? undefined : orchestratorError(value.error)
  if (!value.ok && !error) return
  return {
    executable: "slopcode",
    ok: value.ok,
    exitCode: value.exitCode,
    ...(typeof value.version === "string" ? { version: value.version } : {}),
    ...(error ? { error } : {}),
  }
}

export function parseSshOrchestratorInstall(value: unknown): SshOrchestratorInstall | undefined {
  if (
    !object(value) ||
    value.executable !== "slopcode" ||
    value.package !== "slopcode@latest" ||
    value.operation !== "install_or_upgrade" ||
    typeof value.ok !== "boolean" ||
    typeof value.exitCode !== "number"
  )
    return
  const error = value.error === null || value.error === undefined ? undefined : orchestratorError(value.error)
  if (!value.ok && !error) return
  return {
    executable: "slopcode",
    package: "slopcode@latest",
    operation: "install_or_upgrade",
    ok: value.ok,
    exitCode: value.exitCode,
    ...(error ? { error } : {}),
  }
}

export function parseSshAuthStatus(value: unknown): SshAuthStatus | undefined {
  if (!object(value) || typeof value.loggedIn !== "boolean") return
  const preflight = parseSshPreflight(value)
  return preflight ? { ...preflight, loggedIn: value.loggedIn } : undefined
}

export function parseSshUpdateCheck(value: unknown): SshUpdateCheck | undefined {
  if (!object(value) || typeof value.currentVersion !== "string" || value.currentVersion.length > 128) return
  const preflight = parseSshPreflight(value)
  if (!preflight) return
  const latestVersion =
    typeof value.latestVersion === "string" && value.latestVersion.length <= 128 ? value.latestVersion : undefined
  return { ...preflight, currentVersion: value.currentVersion, ...(latestVersion ? { latestVersion } : {}) }
}

export function codexAppServerStatus(
  preflight: SshPreflight,
  auth?: SshAuthStatus,
  handshake: SshCodexAppServerStatus["handshake"] = "not_run",
  probeError?: string,
): SshCodexAppServerStatus {
  if (!preflight.ok) {
    const installed = preflight.exitCode !== 127
    const message = installed
      ? "Codex needs attention before its App Server can start."
      : "Install Codex before its App Server can start."
    return {
      executable: "codex",
      state: installed ? "unavailable" : "not_installed",
      ready: false,
      handshake: "not_run",
      message,
      output: preflight.output || preflight.error || message,
      preflight,
      ...(preflight.error ? { error: preflight.error } : {}),
    }
  }
  if (!auth?.loggedIn) {
    const message = "Sign in to Codex before its App Server can start."
    return {
      executable: "codex",
      state: "needs_sign_in",
      ready: false,
      handshake: "not_run",
      message,
      output: [preflight.output, auth?.output, message].filter(Boolean).join("\n"),
      preflight,
      ...(auth ? { auth } : {}),
      ...(auth?.error ? { error: auth.error } : {}),
    }
  }
  if (handshake !== "verified") {
    const message = probeError ?? "Codex App Server handshake could not be verified on this Android build."
    return {
      executable: "codex",
      state: "unavailable",
      ready: false,
      handshake,
      message,
      output: [preflight.output, auth.output, message].filter(Boolean).join("\n"),
      preflight,
      auth,
      ...(probeError ? { error: probeError } : {}),
    }
  }
  const message = "Codex App Server is ready to start through this encrypted SSH connection."
  return {
    executable: "codex",
    state: "ready",
    ready: true,
    handshake: "verified",
    message,
    output: [preflight.output, auth.output, message].filter(Boolean).join("\n"),
    preflight,
    auth,
  }
}

export async function checkCodexAppServer(
  ssh: Pick<SshTransport, "execVersion" | "execAuthStatus">,
  directory: string,
) {
  const preflight = await ssh.execVersion("codex-cli", directory)
  if (!preflight.ok) return codexAppServerStatus(preflight)
  return codexAppServerStatus(preflight, await ssh.execAuthStatus("codex-cli", directory))
}

export function parseSshCodexAppServerStatus(value: unknown): SshCodexAppServerStatus | undefined {
  if (
    !object(value) ||
    value.executable !== "codex" ||
    typeof value.ready !== "boolean" ||
    typeof value.message !== "string" ||
    (value.handshake !== "verified" && value.handshake !== "failed" && value.handshake !== "not_run")
  )
    return
  if (
    value.state !== "ready" &&
    value.state !== "needs_sign_in" &&
    value.state !== "not_installed" &&
    value.state !== "unavailable"
  )
    return
  const preflight = parseSshPreflight(value.preflight)
  const auth = value.auth === undefined ? undefined : parseSshAuthStatus(value.auth)
  if (
    !preflight ||
    preflight.agent !== "codex-cli" ||
    (value.auth !== undefined && (!auth || auth.agent !== "codex-cli")) ||
    typeof value.output !== "string"
  )
    return
  if (value.state === "ready" && (value.ready !== true || value.handshake !== "verified" || auth?.loggedIn !== true))
    return
  if (value.state !== "ready" && value.ready !== false) return
  return {
    executable: "codex",
    state: value.state,
    ready: value.ready,
    handshake: value.handshake,
    message: value.message,
    output: value.output,
    preflight,
    ...(auth ? { auth } : {}),
    ...(typeof value.error === "string" ? { error: value.error } : {}),
  }
}

export function parseSshStart(value: unknown): SshSessionStart | undefined {
  if (!object(value) || !validSessionID(value.id) || value.status !== "started") return
  if (value.operation !== "interactive" && value.operation !== "prompt" && !validSetupAction(value.operation)) return
  return { id: value.id, status: "started", operation: value.operation }
}

export function parseSshOrchestratorStart(value: unknown): SshOrchestratorStart | undefined {
  if (!object(value) || !validSessionID(value.id) || value.status !== "started") return
  return { id: value.id, status: "started" }
}

export function parseSshEventMessage(value: unknown, nonce: string): SshEvent | undefined {
  if (
    !object(value) ||
    value.type !== "slopcode.ssh" ||
    value.channel !== "slopcode.android.ssh" ||
    value.nonce !== nonce
  )
    return
  const event = value.event
  if (!object(event) || typeof event.type !== "string" || !validSessionID(event.id)) return
  if (
    event.type === "started" &&
    (event.operation === "interactive" || event.operation === "prompt" || validSetupAction(event.operation)) &&
    validAgent(event.agent)
  ) {
    return { type: "started", id: event.id, operation: event.operation, agent: event.agent }
  }
  if (
    event.type === "output" &&
    (event.stream === "stdout" || event.stream === "stderr") &&
    typeof event.data === "string" &&
    event.data.length <= MAX_EVENT_OUTPUT
  ) {
    return { type: "output", id: event.id, stream: event.stream, data: event.data }
  }
  if (event.type === "completed" && typeof event.exitCode === "number") {
    return { type: "completed", id: event.id, exitCode: event.exitCode }
  }
  if (event.type === "error" && typeof event.message === "string" && event.message.length <= MAX_EVENT_ERROR) {
    return { type: "error", id: event.id, message: event.message }
  }
}

export function parseSshOrchestratorEventMessage(value: unknown, nonce: string): SshOrchestratorEvent | undefined {
  if (
    !object(value) ||
    value.type !== "slopcode.ssh" ||
    value.channel !== "slopcode.android.ssh" ||
    value.nonce !== nonce
  )
    return
  const event = value.event
  if (!object(event) || typeof event.type !== "string" || !validSessionID(event.id)) return
  if (event.type === "orchestrator_started") return { type: "started", id: event.id }
  if (
    event.type === "orchestrator_output" &&
    typeof event.data === "string" &&
    event.data.length <= MAX_ORCHESTRATOR_OUTPUT
  )
    return { type: "output", id: event.id, data: event.data }
  if (event.type === "orchestrator_completed" && typeof event.exitCode === "number")
    return { type: "completed", id: event.id, exitCode: event.exitCode }
  if (
    event.type === "orchestrator_error" &&
    typeof event.message === "string" &&
    event.message.length <= MAX_EVENT_ERROR
  )
    return { type: "error", id: event.id, message: event.message }
}

export function parseSshCredential(value: unknown): SshCredential | undefined {
  if (!object(value) || (value.auth !== "password" && value.auth !== "privateKey")) return
  if (value.auth === "password" && typeof value.password === "string" && value.password.length <= 16 * 1024) {
    return { auth: "password", password: value.password }
  }
  if (
    value.auth === "privateKey" &&
    typeof value.privateKey === "string" &&
    value.privateKey.length > 0 &&
    new TextEncoder().encode(value.privateKey).byteLength <= 128 * 1024
  ) {
    return {
      auth: "privateKey",
      privateKey: value.privateKey,
      ...(typeof value.passphrase === "string" && value.passphrase ? { passphrase: value.passphrase } : {}),
    }
  }
}
