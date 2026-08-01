import type { AndroidSecureStorage } from "./types"

export type RemoteWorkspaceRecord = {
  version: "v1"
  pairingId?: string
  capability?: RemoteWorkspaceCapability
  device?: {
    id?: string
    name?: string
    platform?: string
    arch?: string
    version?: string
  }
  host?: {
    id?: string
    name?: string
    platform?: string
    arch?: string
    version?: string
    mode?: "local" | "ssh"
  }
  workspace?: {
    id?: string
    name?: string
    mode?: "local" | "ssh"
    directory?: string
    remoteDirectory?: string
    agent?: RemoteAgent
    ssh?: {
      host?: string
      port?: number
      user?: string
    }
  }
}

export const REMOTE_AGENTS = ["local-slopcode", "codex-cli", "opencode-cli"] as const
export type RemoteAgent = (typeof REMOTE_AGENTS)[number]
export const DEFAULT_REMOTE_AGENT: RemoteAgent = "local-slopcode"

export type RemoteFolderScope = {
  origin: string
  workspaceID: string
  authority: string
}

export type RemoteFolderHistory = RemoteFolderScope & {
  paths: string[]
}

export type RemoteWorkspaceCapability = {
  fs: boolean
  command: boolean
  pty: boolean
  events: boolean
  localWorkspace: boolean
  sshWorkspace: boolean
}

export type RemoteWorkspaceCapabilityName = keyof RemoteWorkspaceCapability

export type RemoteWorkspaceSecret = {
  username?: string
  password: string
}

export type RemoteServerSelection = {
  url: string
  workspaceID?: string
  directory?: string
}

export type RemoteWorkspaceState = {
  version: 1
  serverUrl?: string
  serverSelection?: RemoteServerSelection
  workspace?: RemoteWorkspaceRecord
  recentFolders?: RemoteFolderHistory[]
  savedAt?: string
}

type StoredSecret = RemoteWorkspaceSecret & {
  origin: string
  pairingId?: string
}

type StoredRemoteWorkspace = {
  version: 1
  state: RemoteWorkspaceState
  secret?: StoredSecret
}

const RECORD_KEY = "remote.workspace.v2"
const LEGACY_STATE_KEY = "remote.workspace"
const LEGACY_SECRET_KEY = "remote.workspace.secret"
const NAMESPACE = "slopcode.android.remote.dat"
const MAX_RECENT_SCOPES = 8
const MAX_RECENT_FOLDERS = 3

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function text(value: unknown) {
  if (typeof value !== "string") return
  const trimmed = value.trim()
  if (!trimmed) return
  return trimmed
}

function workspaceID(value: unknown) {
  const next = text(value)
  if (!next || !/^wrk[a-zA-Z0-9._:-]+$/.test(next)) return
  return next
}

function absolutePath(value: unknown) {
  const next = text(value)
  if (!next || !next.startsWith("/") || next.includes("\\") || next.includes("\u0000")) return
  if (
    next.length > 4_096 ||
    (next !== "/" && next.endsWith("/")) ||
    next.includes("//") ||
    /[\u0000-\u001f\u007f\r\n?#]/.test(next) ||
    next.split("/").some((part) => part === "." || part === "..")
  ) return
  return next
}

function remoteAgent(value: unknown) {
  if (value === undefined) return DEFAULT_REMOTE_AGENT
  if (REMOTE_AGENTS.includes(value as RemoteAgent)) return value as RemoteAgent
}

function safeAuthority(value: unknown) {
  const next = text(value)
  if (!next || next.length > 320 || /[\u0000-\u001f\u007f\r\n;&|$`"'<>()[\]{}*?!~\\]/.test(next)) return
  const at = next.indexOf("@")
  if (at < 1 || at !== next.lastIndexOf("@") || !/^[A-Za-z_][A-Za-z0-9._-]{0,63}$/.test(next.slice(0, at))) return
  const target = next.slice(at + 1)
  if (!target) return
  if (target.startsWith("[")) {
    const close = target.indexOf("]")
    if (close < 0 || target.slice(close + 1) && !/^:[1-9][0-9]{0,4}$/.test(target.slice(close + 1))) return
    if (!/^[0-9A-Fa-f:.]+$/.test(target.slice(1, close)) || !target.slice(1, close).includes(":")) return
    return next
  }
  const colons = [...target].filter((character) => character === ":").length
  if (colons > 1) return
  const host = colons === 1 ? target.slice(0, target.lastIndexOf(":")) : target
  const suffix = colons === 1 ? target.slice(target.lastIndexOf(":")) : ""
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(host) || host.includes("..") || (suffix && !/^:[1-9][0-9]{0,4}$/.test(suffix))) return
  return next
}

function mode(value: unknown) {
  if (value === "local" || value === "ssh") return value
}

function port(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) return
  if (value < 1 || value > 65_535) return
  return value
}

export function normalizeHttpsUrl(value: unknown) {
  const raw = text(value)
  if (!raw) return
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:") return
    if (url.username || url.password || url.search || url.hash) return
    return url.toString().replace(/\/+$/, "")
  } catch {
    return
  }
}

function clean<T extends Record<string, unknown>>(value: T) {
  if (Object.keys(value).length === 0) return
  return value
}

function normalizeDevice(value: unknown) {
  if (!isRecord(value)) return
  return clean({
    id: text(value.id),
    name: text(value.name),
    platform: text(value.platform),
    arch: text(value.arch),
    version: text(value.version),
  })
}

function normalizeHost(value: unknown) {
  if (!isRecord(value)) return
  return clean({
    id: text(value.id),
    name: text(value.name),
    platform: text(value.platform),
    arch: text(value.arch),
    version: text(value.version),
    mode: mode(value.mode),
  } satisfies NonNullable<RemoteWorkspaceRecord["host"]>)
}

function normalizeSsh(value: unknown) {
  if (!isRecord(value)) return
  return clean({
    host: text(value.host),
    port: port(value.port),
    user: text(value.user),
  } satisfies NonNullable<NonNullable<RemoteWorkspaceRecord["workspace"]>["ssh"]>)
}

function normalizeCapability(value: unknown) {
  if (!isRecord(value)) return
  const keys = ["fs", "command", "pty", "events", "localWorkspace", "sshWorkspace"] as const
  if (!keys.every((key) => typeof value[key] === "boolean")) return
  return {
    fs: value.fs as boolean,
    command: value.command as boolean,
    pty: value.pty as boolean,
    events: value.events as boolean,
    localWorkspace: value.localWorkspace as boolean,
    sshWorkspace: value.sshWorkspace as boolean,
  } satisfies RemoteWorkspaceCapability
}

function normalizeWorkspace(value: unknown) {
  if (!isRecord(value)) return
  const agent = remoteAgent(value.agent)
  if (!agent) return
  const record = clean({
    id: text(value.id),
    name: text(value.name),
    mode: mode(value.mode),
    directory: absolutePath(value.directory),
    remoteDirectory: absolutePath(value.remoteDirectory),
    agent: value.mode === "ssh" ? agent : undefined,
    ssh: normalizeSsh(value.ssh),
  } satisfies NonNullable<RemoteWorkspaceRecord["workspace"]>)
  if (!record) return
  if (record.mode === "local") {
    return clean({
      id: record.id,
      name: record.name,
      mode: record.mode,
      directory: record.directory,
    })
  }
  return clean(record)
}

function normalizeRecentFolders(value: unknown) {
  if (!Array.isArray(value)) return
  return value
    .slice(0, MAX_RECENT_SCOPES)
    .flatMap((item) => {
      if (!isRecord(item)) return []
      const origin = normalizeHttpsUrl(item.origin)
      const workspaceIDValue = workspaceID(item.workspaceID)
      const authority = safeAuthority(item.authority)
      if (!origin || !workspaceIDValue || !authority || !Array.isArray(item.paths)) return []
      const paths = item.paths
        .filter((path): path is string => typeof path === "string")
        .map(absolutePath)
        .filter((path): path is string => !!path)
        .filter((path, index, all) => all.indexOf(path) === index)
        .slice(0, MAX_RECENT_FOLDERS)
      if (paths.length === 0) return []
      return [{ origin, workspaceID: workspaceIDValue, authority, paths }]
    })
}

function normalizeWorkspaceRecord(value: unknown): RemoteWorkspaceRecord | undefined {
  if (!isRecord(value)) return
  const record = clean({
    version: "v1" as const,
    pairingId: text("pairingId" in value ? value.pairingId : value.id),
    capability: normalizeCapability(value.capability),
    device: normalizeDevice(value.device),
    host: normalizeHost(value.host),
    workspace: normalizeWorkspace(value.workspace),
  })
  if (!record) return
  if (!record.device && !record.host && !record.workspace) return
  return record
}

export function remoteCapabilityEnabled(record: RemoteWorkspaceRecord | undefined, name: RemoteWorkspaceCapabilityName) {
  return record?.capability?.[name] === true
}

export function normalizeRemoteWorkspaceSecret(value: unknown): RemoteWorkspaceSecret | undefined {
  if (!isRecord(value)) return
  const password = text(value.password)
  if (!password) return
  return {
    password,
    username: text(value.username),
  }
}

function normalizeStoredSecret(value: unknown): StoredSecret | undefined {
  if (!isRecord(value)) return
  const secret = normalizeRemoteWorkspaceSecret(value)
  const origin = normalizeHttpsUrl(value.origin)
  if (!secret || !origin) return
  return {
    ...secret,
    origin,
    pairingId: text(value.pairingId),
  }
}

function normalizeServerSelection(value: unknown, serverUrl?: string): RemoteServerSelection | undefined {
  if (!isRecord(value)) return
  const url = normalizeHttpsUrl(value.url)
  if (!url || (serverUrl && url !== serverUrl)) return
  const id = value.workspaceID === undefined ? undefined : workspaceID(value.workspaceID)
  const directory = value.directory === undefined ? undefined : absolutePath(value.directory)
  if (value.workspaceID !== undefined && !id) return
  if (value.directory !== undefined && !directory) return
  return clean({ url, workspaceID: id, directory }) as RemoteServerSelection
}

export function normalizeRemoteWorkspaceState(value: unknown): RemoteWorkspaceState {
  if (!isRecord(value)) return { version: 1 }
  const serverUrl = normalizeHttpsUrl(value.serverUrl)
  const selection = normalizeServerSelection(value.serverSelection, serverUrl)
  const selectedUrl = selection?.url ?? serverUrl
  const recentFolders = normalizeRecentFolders(value.recentFolders)
  return {
    version: 1,
    serverUrl: selectedUrl,
    serverSelection:
      selection ??
      (selectedUrl
        ? {
            url: selectedUrl,
            workspaceID: workspaceID(
              isRecord(value.workspace) && isRecord(value.workspace.workspace) ? value.workspace.workspace.id : undefined,
            ),
            directory:
              isRecord(value.workspace) && isRecord(value.workspace.workspace)
                ? absolutePath(value.workspace.workspace.remoteDirectory ?? value.workspace.workspace.directory)
                : undefined,
          }
        : undefined),
    workspace: normalizeWorkspaceRecord(value.workspace ?? value.pairing),
    ...(recentFolders ? { recentFolders } : {}),
    savedAt: text(value.savedAt),
  }
}

export function remoteFoldersForScope(state: RemoteWorkspaceState, scope: RemoteFolderScope) {
  const origin = normalizeHttpsUrl(scope.origin)
  const workspaceIDValue = workspaceID(scope.workspaceID)
  const authority = safeAuthority(scope.authority)
  if (!origin || !workspaceIDValue || !authority) return []
  const found = state.recentFolders?.find(
    (item) => item.origin === origin && item.workspaceID === workspaceIDValue && item.authority === authority,
  )
  return found?.paths.slice(0, MAX_RECENT_FOLDERS) ?? []
}

export function rememberRemoteFolder(state: RemoteWorkspaceState, scope: RemoteFolderScope, path: string) {
  const origin = normalizeHttpsUrl(scope.origin)
  const workspaceIDValue = workspaceID(scope.workspaceID)
  const authority = safeAuthority(scope.authority)
  const folder = absolutePath(path)
  if (!origin || !workspaceIDValue || !authority || !folder) return normalizeRemoteWorkspaceState(state)

  const current = normalizeRemoteWorkspaceState(state)
  const history = current.recentFolders ?? []
  const index = history.findIndex(
    (item) => item.origin === origin && item.workspaceID === workspaceIDValue && item.authority === authority,
  )
  const paths = [folder, ...(index < 0 ? [] : history[index].paths.filter((item) => item !== folder))].slice(
    0,
    MAX_RECENT_FOLDERS,
  )
  const next = { origin, workspaceID: workspaceIDValue, authority, paths }
  const recentFolders =
    index < 0
      ? [next, ...history].slice(0, MAX_RECENT_SCOPES)
      : history.map((item, itemIndex) => (itemIndex === index ? next : item))
  return { ...current, recentFolders }
}

function initialState() {
  return { version: 1 } as RemoteWorkspaceState
}

async function clearLegacy(storage: AndroidSecureStorage) {
  await storage.removeItem(NAMESPACE, LEGACY_STATE_KEY)
  await storage.removeItem(NAMESPACE, LEGACY_SECRET_KEY)
}

export async function clearRemoteWorkspace(storage: AndroidSecureStorage) {
  await storage.removeItem(NAMESPACE, RECORD_KEY)
  await clearLegacy(storage)
}

function bound(secret: StoredSecret, state: RemoteWorkspaceState) {
  return (
    !!state.serverUrl &&
    secret.origin === state.serverUrl &&
    (!secret.pairingId || secret.pairingId === state.workspace?.pairingId)
  )
}

function parseState(value: unknown) {
  if (!isRecord(value)) throw new Error("Invalid remote workspace state")
  const state = normalizeRemoteWorkspaceState(value)
  const rawUrl = text(value.serverUrl)
  if (rawUrl && (!normalizeHttpsUrl(rawUrl) || normalizeHttpsUrl(rawUrl) !== state.serverUrl)) {
    throw new Error("Invalid remote server URL")
  }
  if (value.serverSelection !== undefined && !normalizeServerSelection(value.serverSelection, normalizeHttpsUrl(rawUrl))) {
    throw new Error("Invalid remote server selection")
  }
  return state
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return
  }
}

function hasState(state: RemoteWorkspaceState) {
  return !!state.serverUrl || !!state.workspace || !!state.savedAt || !!state.serverSelection || !!state.recentFolders?.length
}

function stored(state: RemoteWorkspaceState, secret?: RemoteWorkspaceSecret): StoredRemoteWorkspace {
  const normalized = normalizeRemoteWorkspaceSecret(secret)
  return {
    version: 1,
    state,
    secret: normalized
      ? {
          ...normalized,
          origin: state.serverUrl!,
          pairingId: state.workspace?.pairingId,
        }
      : undefined,
  }
}

async function writeStored(storage: AndroidSecureStorage, state: RemoteWorkspaceState, secret?: RemoteWorkspaceSecret) {
  await storage.setItem(NAMESPACE, RECORD_KEY, JSON.stringify(stored(state, secret)))
  await clearLegacy(storage)
}

async function readLegacy(storage: AndroidSecureStorage) {
  const [rawState, rawSecret] = await Promise.all([
    storage.getItem(NAMESPACE, LEGACY_STATE_KEY),
    storage.getItem(NAMESPACE, LEGACY_SECRET_KEY),
  ])
  if (rawState === null && rawSecret === null) return { state: initialState(), secret: undefined }

  const parsedState = rawState === null ? undefined : parseJson(rawState)
  const state = parsedState === undefined ? initialState() : normalizeRemoteWorkspaceState(parsedState)
  const secretValue = rawSecret === null ? undefined : parseJson(rawSecret)
  const secret = normalizeRemoteWorkspaceSecret(secretValue)
  const boundSecret = secret && state.serverUrl ? secret : undefined
  if (!hasState(state) && !boundSecret) {
    await clearLegacy(storage)
    return { state: initialState(), secret: undefined }
  }
  await writeStored(storage, state, boundSecret)
  return { state, secret: boundSecret }
}

export async function readRemoteWorkspace(storage: AndroidSecureStorage) {
  const raw = await storage.getItem(NAMESPACE, RECORD_KEY)
  if (raw === null) return readLegacy(storage)

  const value = parseJson(raw)
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.state)) {
    await storage.removeItem(NAMESPACE, RECORD_KEY)
    return readLegacy(storage)
  }

  let state: RemoteWorkspaceState
  try {
    state = parseState(value.state)
  } catch {
    await storage.removeItem(NAMESPACE, RECORD_KEY)
    return readLegacy(storage)
  }

  const secret = value.secret === undefined ? undefined : normalizeStoredSecret(value.secret)
  if (value.secret !== undefined && (!secret || !bound(secret, state))) {
    await writeStored(storage, state)
    return { state, secret: undefined }
  }
  await clearLegacy(storage)
  return { state, secret: secret ? { username: secret.username, password: secret.password } : undefined }
}

export async function readRemoteWorkspaceState(storage: AndroidSecureStorage) {
  return (await readRemoteWorkspace(storage)).state
}

export async function readRemoteWorkspaceSecret(storage: AndroidSecureStorage) {
  return (await readRemoteWorkspace(storage)).secret
}

export async function writeRemoteWorkspaceRecord(
  storage: AndroidSecureStorage,
  state: RemoteWorkspaceState,
  secret?: RemoteWorkspaceSecret,
) {
  const next = normalizeRemoteWorkspaceState(state)
  const rawUrl = text(state.serverUrl)
  if (rawUrl && (!normalizeHttpsUrl(rawUrl) || normalizeHttpsUrl(rawUrl) !== next.serverUrl)) {
    throw new Error("Remote server URL must be HTTPS without credentials, query, or fragment")
  }
  if (state.serverSelection !== undefined && !normalizeServerSelection(state.serverSelection, normalizeHttpsUrl(rawUrl))) {
    throw new Error("Remote server selection is invalid")
  }
  const normalized = normalizeRemoteWorkspaceSecret(secret)
  if (secret !== undefined && !normalized) {
    throw new Error("Remote credential record is invalid")
  }
  if (normalized && !next.serverUrl) {
    throw new Error("Remote credentials require an exact HTTPS server origin")
  }
  if (!hasState(next)) {
    await clearRemoteWorkspace(storage)
    return
  }
  await writeStored(storage, next, normalized)
}

export async function writeRemoteWorkspaceState(storage: AndroidSecureStorage, state: RemoteWorkspaceState) {
  const current = await readRemoteWorkspace(storage)
  const next = normalizeRemoteWorkspaceState(state)
  const secret = current.secret && current.state.serverUrl === next.serverUrl && current.state.workspace?.pairingId === next.workspace?.pairingId
    ? current.secret
    : undefined
  await writeRemoteWorkspaceRecord(storage, state, secret)
}

export async function writeRemoteWorkspaceSecret(storage: AndroidSecureStorage, secret?: RemoteWorkspaceSecret) {
  const current = await readRemoteWorkspace(storage)
  if (!secret) {
    await writeRemoteWorkspaceRecord(storage, current.state)
    return
  }
  if (!normalizeRemoteWorkspaceSecret(secret)) throw new Error("Remote credential record is invalid")
  if (!current.state.serverUrl) {
    throw new Error("Remote credentials require an exact HTTPS server origin")
  }
  await writeRemoteWorkspaceRecord(storage, current.state, secret)
}
