import {
  normalizeHttpsUrl,
  type RemoteAgent,
  type RemoteCommandCatalog,
  type RemoteCommandInfo,
} from "./remote-workspace-state"

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>

const MAX_RESPONSE_BYTES = 256 * 1024
const MAX_COMMANDS = 256
const MAX_NAME_LENGTH = 128
const MAX_DESCRIPTION_LENGTH = 512
const MAX_VERSION_LENGTH = 128
const REQUEST_TIMEOUT_MS = 15_000

const builtins: Record<RemoteAgent, readonly string[]> = {
  "local-slopcode": ["init", "review"],
  "codex-cli": [
    "help",
    "model",
    "ide",
    "permissions",
    "approvals",
    "sandbox",
    "keymap",
    "vim",
    "setup-default-sandbox",
    "sandbox-add-read-dir",
    "experimental",
    "approve",
    "memories",
    "skills",
    "import",
    "hooks",
    "review",
    "rename",
    "new",
    "archive",
    "delete",
    "resume",
    "fork",
    "app",
    "init",
    "compact",
    "plan",
    "goal",
    "agent",
    "side",
    "btw",
    "copy",
    "raw",
    "diff",
    "mention",
    "status",
    "usage",
    "debug-config",
    "title",
    "statusline",
    "theme",
    "pets",
    "pet",
    "mcp",
    "apps",
    "plugins",
    "logout",
    "quit",
    "exit",
    "feedback",
    "rollout",
    "ps",
    "stop",
    "clean",
    "clear",
    "personality",
    "test-approval",
    "subagents",
    "debug-m-drop",
    "debug-m-update",
  ],
  "opencode-cli": [
    "connect",
    "compact",
    "summarize",
    "details",
    "editor",
    "exit",
    "quit",
    "q",
    "export",
    "help",
    "init",
    "models",
    "new",
    "clear",
    "redo",
    "sessions",
    "resume",
    "continue",
    "share",
    "themes",
    "thinking",
    "undo",
    "unshare",
  ],
  "claude-code": [
    "add-dir",
    "advisor",
    "agents",
    "autofix-pr",
    "background",
    "bg",
    "batch",
    "branch",
    "btw",
    "bug",
    "cd",
    "chrome",
    "claude-api",
    "clear",
    "reset",
    "new",
    "code-review",
    "color",
    "compact",
    "config",
    "settings",
    "context",
    "copy",
    "cost",
    "dataviz",
    "debug",
    "deep-research",
    "design-login",
    "design-sync",
    "desktop",
    "app",
    "diff",
    "doctor",
    "checkup",
    "effort",
    "exit",
    "quit",
    "export",
    "fast",
    "feedback",
    "fewer-permission-prompts",
    "focus",
    "fork",
    "goal",
    "heapdump",
    "help",
    "hooks",
    "ide",
    "init",
    "insights",
    "install-github-app",
    "install-slack-app",
    "keybindings",
    "login",
    "logout",
    "loop",
    "proactive",
    "mcp",
    "memory",
    "mobile",
    "ios",
    "android",
    "model",
    "passes",
    "permissions",
    "allowed-tools",
    "plan",
    "plugin",
    "powerup",
    "pr-comments",
    "privacy-settings",
    "radio",
    "recap",
    "release-notes",
    "reload-plugins",
    "reload-skills",
    "remote-control",
    "rc",
    "remote-env",
    "rename",
    "resume",
    "continue",
    "review",
    "rewind",
    "checkpoint",
    "undo",
    "run",
    "run-skill-generator",
    "sandbox",
    "schedule",
    "routines",
    "scroll-speed",
    "security-review",
    "setup-bedrock",
    "setup-vertex",
    "simplify",
    "skills",
    "stats",
    "status",
    "statusline",
    "stickers",
    "stop",
    "subtask",
    "tasks",
    "bashes",
    "team-onboarding",
    "teleport",
    "tp",
    "terminal-setup",
    "theme",
    "tui",
    "ultraplan",
    "ultrareview",
    "upgrade",
    "usage",
    "verify",
    "vim",
    "voice",
    "web-setup",
    "workflows",
  ],
}

function text(value: unknown, limit: number) {
  if (typeof value !== "string" || value.length === 0 || value.length > limit || /\u0000/.test(value)) return
  return value.trim() || undefined
}

function command(value: unknown): RemoteCommandInfo | undefined {
  if (!isRecord(value)) return
  const name = text(value.name, MAX_NAME_LENGTH)
  if (!name || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(name)) return
  const description = value.description === undefined ? undefined : text(value.description, MAX_DESCRIPTION_LENGTH)
  const agent = value.agent === undefined ? undefined : text(value.agent, MAX_NAME_LENGTH)
  const model = value.model === undefined ? undefined : text(value.model, MAX_NAME_LENGTH)
  if (value.description !== undefined && !description) return
  if (value.agent !== undefined && !agent) return
  if (value.model !== undefined && !model) return
  if (value.subtask !== undefined && typeof value.subtask !== "boolean") return
  return {
    name,
    ...(description ? { description } : {}),
    ...(agent ? { agent } : {}),
    ...(model ? { model } : {}),
    ...(value.subtask === undefined ? {} : { subtask: value.subtask }),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function bakedRemoteCommands(agent: RemoteAgent) {
  return builtins[agent].map((name) => ({ name }))
}

export function bakedRemoteCommandCatalog(agent: RemoteAgent): RemoteCommandCatalog {
  return { agent, version: "baked", commands: bakedRemoteCommands(agent) }
}

export function mergeRemoteCommandCatalog(
  agent: RemoteAgent,
  version: string,
  commands: readonly RemoteCommandInfo[],
): RemoteCommandCatalog {
  const map = new Map(bakedRemoteCommands(agent).map((item) => [item.name, item]))
  commands.slice(0, MAX_COMMANDS).forEach((item) => map.set(item.name, item))
  return { agent, version, commands: [...map.values()].slice(0, MAX_COMMANDS) }
}

function parse(value: unknown, agent: RemoteAgent, fallbackVersion: string): RemoteCommandCatalog | undefined {
  const raw = isRecord(value) && "data" in value ? value.data : value
  if (Array.isArray(raw)) {
    const commands = raw.map(command).filter((item): item is RemoteCommandInfo => !!item)
    if (commands.length !== raw.length) return
    return mergeRemoteCommandCatalog(agent, fallbackVersion, commands)
  }
  if (!isRecord(raw)) return
  if (raw.agent !== agent || typeof raw.version !== "string" || raw.version.length > MAX_VERSION_LENGTH) return
  if (!Array.isArray(raw.commands) || raw.commands.length > MAX_COMMANDS) return
  const commands = raw.commands.map(command).filter((item): item is RemoteCommandInfo => !!item)
  if (commands.length !== raw.commands.length) return
  return mergeRemoteCommandCatalog(agent, raw.version, commands)
}

async function json(response: Response) {
  const length = Number(response.headers.get("content-length"))
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES)
    throw new Error("Remote command catalog exceeded the Android limit.")
  if (!response.body) return
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > MAX_RESPONSE_BYTES) {
        void reader.cancel()
        throw new Error("Remote command catalog exceeded the Android limit.")
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  })
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    return
  }
}

function authorization(username: string | undefined, password: string) {
  const user = username?.trim() || "slopcode"
  if (!password || /[\u0000\r\n]/.test(user + password))
    throw new Error("Remote command catalog requires desktop authentication.")
  return `Basic ${btoa(`${user}:${password}`)}`
}

export type RemoteCommandCatalogInput = {
  serverUrl: string
  username?: string
  password: string
  workspaceID: string
  directory: string
  agent: RemoteAgent
  version?: string
}

export async function fetchRemoteAgentCatalog(
  input: RemoteCommandCatalogInput,
  fetcher: Fetcher = fetch,
): Promise<RemoteCommandCatalog> {
  const serverUrl = normalizeHttpsUrl(input.serverUrl)
  if (!serverUrl || !input.workspaceID || !input.directory || !input.agent)
    throw new Error("Remote command catalog input is invalid.")
  const endpoint = new URL(
    input.agent === "local-slopcode" ? `${serverUrl}/command` : `${serverUrl}/remote/agent/catalog`,
  )
  endpoint.searchParams.set("workspace", input.workspaceID)
  endpoint.searchParams.set(input.agent === "local-slopcode" ? "directory" : "path", input.directory)
  if (input.agent !== "local-slopcode") endpoint.searchParams.set("agent", input.agent)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  let value: unknown
  try {
    response = await fetcher(endpoint.toString(), {
      method: "GET",
      headers: { authorization: authorization(input.username, input.password) },
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    })
    value = await json(response)
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) throw new Error(`Remote command catalog request failed (${response.status}).`)
  const catalog = parse(value, input.agent, input.version ?? "unknown")
  if (!catalog) throw new Error("Remote command catalog returned an invalid response.")
  return catalog
}
