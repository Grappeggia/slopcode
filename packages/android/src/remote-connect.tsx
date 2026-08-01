import { createSignal, For, onMount, Show } from "solid-js"
import { persistRemoteWorkspace, readInitialWorkspaceState } from "./platform"
import {
  DEFAULT_REMOTE_AGENT,
  REMOTE_AGENTS,
  normalizeHttpsUrl,
  normalizeRemoteWorkspaceState,
  rememberRemoteFolder,
  remoteFoldersForScope,
  type RemoteAgent,
  type RemoteWorkspaceCapability,
  type RemoteWorkspaceRecord,
  type RemoteWorkspaceState,
} from "./remote-workspace-state"

type Props = {
  onConnected: () => void
}

export type RemoteFetcher = (input: string | URL, init?: RequestInit) => Promise<Response>

type Fetcher = RemoteFetcher

const MAX_RESPONSE_BYTES = 256 * 1024
const REQUEST_TIMEOUT_MS = 15_000
const MAX_FOLDER_ENTRIES = 256
const MAX_FOLDER_NAME_LENGTH = 256
const DEFAULT_SSH_PORT = 22

const shellMeta = new Set([";", "&", "|", "$", "`", '"', "'", "<", ">", "(", ")", "{", "}", "*", "?", "!", "~", "\\"])

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validUrl(value: string) {
  return normalizeHttpsUrl(clean(value))
}

export function validPort(value: string) {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,4}$/.test(value.trim())) return
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return
  return port
}

function validWorkspaceID(value: string) {
  const next = clean(value)
  if (!next) return
  if (!/^wrk[a-zA-Z0-9._:-]+$/.test(next)) return
  return next
}

function validDeviceID(value: string | undefined) {
  if (value === undefined) return `dev_android_${crypto.randomUUID().replaceAll("-", "")}`
  const next = clean(value)
  if (!/^dev_[a-zA-Z0-9._:-]+$/.test(next)) return
  return next
}

function selectionBinding(value: unknown) {
  if (!isRecord(value)) return
  const nonce = value.nonce
  const deviceID = value.deviceID
  const code = value.code
  if (
    typeof nonce !== "string" ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(nonce) ||
    typeof deviceID !== "string" ||
    !/^dev_[a-zA-Z0-9._:-]+$/.test(deviceID) ||
    typeof code !== "string" ||
    !/^[A-Z0-9]{6}$/.test(code)
  ) return
  return { nonce, deviceID, code }
}

function basic(username: string, password: string) {
  if (!password) throw new Error("Enter the desktop password or token to authenticate pairing.")
  const user = username || "slopcode"
  if ([user, password].some((value) => value.length > 512 || /[\u0000\r\n]/.test(value))) {
    throw new Error("Desktop credentials are invalid.")
  }
  try {
    return `Basic ${btoa(`${user}:${password}`)}`
  } catch {
    throw new Error("Desktop credentials must use a supported encoding.")
  }
}

export function validDirectory(value: string) {
  const next = clean(value)
  if (
    !next.startsWith("/") ||
    next.length > 4_096 ||
    (next !== "/" && next.endsWith("/")) ||
    next.includes("\\") ||
    next.includes("//") ||
    /[\u0000-\u001f\u007f\r\n?#]/.test(next) ||
    next.split("/").some((part) => part === "." || part === "..")
  ) return
  return next
}

export type SshAuthority = {
  user: string
  host: string
  port?: number
}

function validHost(value: string, ipv6 = false) {
  if (!value || value.length > (ipv6 ? 45 : 253)) return
  if ([...shellMeta].some((character) => value.includes(character))) return
  if (ipv6) {
    if (!/^[0-9A-Fa-f:.]+$/.test(value) || !value.includes(":")) return
    return value.toLowerCase()
  }
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(value) || value.includes("..")) return
  if (value.split(".").some((part) => !part || part.startsWith("-") || part.endsWith("-"))) return
  return value.toLowerCase()
}

export function parseSshAuthority(value: string): SshAuthority | undefined {
  const raw = clean(value)
  if (
    !raw ||
    raw.length > 320 ||
    [...raw].some((character) => shellMeta.has(character) || character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f)
  ) return

  const at = raw.indexOf("@")
  if (at < 1 || at !== raw.lastIndexOf("@")) return
  const user = raw.slice(0, at)
  const target = raw.slice(at + 1)
  if (!/^[A-Za-z_][A-Za-z0-9._-]{0,63}$/.test(user) || !target) return

  let host = target
  let port: number | undefined
  if (target.startsWith("[")) {
    const close = target.indexOf("]")
    if (close < 0) return
    const rest = target.slice(close + 1)
    if (rest && !rest.startsWith(":")) return
    if (rest) {
      port = validPort(rest.slice(1))
      if (!port) return
    }
    host = validHost(target.slice(1, close), true) ?? ""
  } else {
    const colons = [...target].filter((character) => character === ":").length
    if (colons > 1) return
    if (colons === 1) {
      const split = target.lastIndexOf(":")
      host = target.slice(0, split)
      port = validPort(target.slice(split + 1))
      if (!port) return
    }
    host = validHost(host) ?? ""
  }
  if (!host) return
  return { user, host, port }
}

function effectivePort(authority: SshAuthority, value: number | undefined) {
  if (authority.port !== undefined) return authority.port
  if (value === undefined) return DEFAULT_SSH_PORT
  if (!Number.isInteger(value) || value < 1 || value > 65_535) return
  return value
}

function authorityKey(authority: SshAuthority, port: number) {
  const host = authority.host.includes(":") ? `[${authority.host}]` : authority.host
  return `${authority.user}@${host}:${port}`
}

function record(value: unknown, code: boolean) {
  if (!isRecord(value)) return
  const raw = value
  if (raw.version !== "v1" || typeof raw.id !== "string" || !/^pair_[a-zA-Z0-9._:-]+$/.test(raw.id)) return
  if (code && (typeof raw.code !== "string" || !/^[A-Z0-9]{6}$/.test(raw.code))) return
  if (!code && Object.prototype.hasOwnProperty.call(raw, "code")) return
  const selection = code ? selectionBinding(raw.selection) : undefined
  if (code && raw.selection !== undefined && !selection) return
  if (!code && raw.selection !== undefined) return
  const capability = raw.capability
  if (!capability || typeof capability !== "object" || Array.isArray(capability)) return
  const capabilities = capability as Record<string, unknown>
  if (!["fs", "command", "pty", "events", "localWorkspace", "sshWorkspace"].every((key) => typeof capabilities[key] === "boolean")) return
  const device = raw.device
  const host = raw.host
  if (!device || typeof device !== "object" || Array.isArray(device)) return
  if (!host || typeof host !== "object" || Array.isArray(host)) return
  if (typeof (device as Record<string, unknown>).id !== "string" || !/^dev_[a-zA-Z0-9._:-]+$/.test((device as Record<string, unknown>).id as string)) return
  if (typeof (host as Record<string, unknown>).id !== "string" || !/^hst_[a-zA-Z0-9._:-]+$/.test((host as Record<string, unknown>).id as string)) return
  const normalized = normalizeRemoteWorkspaceState({ workspace: raw }).workspace
  const workspace = normalized?.workspace
  const deviceRecord = normalized?.device
  const hostRecord = normalized?.host
  const capabilityRecord = normalized?.capability
  if (
    !workspace?.id ||
    !workspace.name ||
    workspace.mode !== "ssh" ||
    !workspace.directory ||
    !workspace.remoteDirectory ||
    !workspace.ssh?.host ||
    !workspace.ssh.user ||
    !workspace.ssh.port ||
    !deviceRecord?.id ||
    !deviceRecord.name ||
    !deviceRecord.platform ||
    !deviceRecord.arch ||
    !deviceRecord.version ||
    !hostRecord?.id ||
    !hostRecord.name ||
    !hostRecord.platform ||
    !hostRecord.arch ||
    !hostRecord.version ||
    !hostRecord.mode ||
    !capabilityRecord
  ) return
  if (capabilityRecord.localWorkspace !== false || capabilityRecord.sshWorkspace !== true) return
  return {
    id: raw.id,
    code: code ? (raw.code as string) : undefined,
    selection,
    capability: capabilityRecord,
    device: deviceRecord,
    host: hostRecord,
    workspace,
    record: {
      version: "v1",
      capability: capabilityRecord,
      device: normalized?.device,
      host: normalized?.host,
      workspace,
      pairingId: raw.id,
    } satisfies RemoteWorkspaceRecord,
  }
}

function workspace(value: unknown) {
  const normalized = normalizeRemoteWorkspaceState({ workspace: { workspace: value } }).workspace?.workspace
  if (
    !normalized?.id ||
    !normalized.name ||
    normalized.mode !== "ssh" ||
    !normalized.directory ||
    !normalized.remoteDirectory ||
    !normalized.ssh?.host ||
    !normalized.ssh.user ||
    !normalized.ssh.port
  ) return
  return normalized
}

function sameWorkspace(left: NonNullable<RemoteWorkspaceRecord["workspace"]>, right: NonNullable<RemoteWorkspaceRecord["workspace"]>) {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.mode === right.mode &&
    left.directory === right.directory &&
    left.remoteDirectory === right.remoteDirectory &&
    (left.agent ?? DEFAULT_REMOTE_AGENT) === (right.agent ?? DEFAULT_REMOTE_AGENT) &&
    left.ssh?.host === right.ssh?.host &&
    left.ssh?.port === right.ssh?.port &&
    left.ssh?.user === right.ssh?.user
  )
}

function sameDevice(left: RemoteWorkspaceRecord["device"], right: RemoteWorkspaceRecord["device"]) {
  return (
    !!left &&
    !!right &&
    left.id === right.id &&
    left.name === right.name &&
    left.platform === right.platform &&
    left.arch === right.arch &&
    left.version === right.version
  )
}

function sameHost(left: RemoteWorkspaceRecord["host"], right: RemoteWorkspaceRecord["host"]) {
  return (
    !!left &&
    !!right &&
    left.id === right.id &&
    left.name === right.name &&
    left.platform === right.platform &&
    left.arch === right.arch &&
    left.version === right.version &&
    left.mode === right.mode
  )
}

function sameCapability(left: RemoteWorkspaceCapability | undefined, right: RemoteWorkspaceCapability | undefined) {
  return (
    !!left &&
    !!right &&
    left.fs === right.fs &&
    left.command === right.command &&
    left.pty === right.pty &&
    left.events === right.events &&
    left.localWorkspace === right.localWorkspace &&
    left.sshWorkspace === right.sshWorkspace
  )
}

function message(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  const raw = value as Record<string, unknown>
  if (typeof raw.message === "string" && raw.message.length <= 512) return raw.message
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    const nested = (raw.data as Record<string, unknown>).message
    if (typeof nested === "string" && nested.length <= 512) return nested
  }
}

async function body(response: Response) {
  const length = Number(response.headers.get("content-length"))
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) throw new Error("Desktop response exceeded the Android limit.")
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
        throw new Error("Desktop response exceeded the Android limit.")
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
  const raw = new TextDecoder().decode(bytes)
  if (!raw) return
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return
  }
}

async function fetchBounded(fetcher: Fetcher, url: string, init: RequestInit) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal })
    return { response, data: await body(response) }
  } finally {
    clearTimeout(timer)
  }
}

async function request(fetcher: Fetcher, url: string, headers: Headers, payload?: unknown, method: "GET" | "POST" = "POST") {
  const init: RequestInit = {
    method,
    headers,
    credentials: "omit",
    redirect: "error",
  }
  if (payload !== undefined) {
    init.headers = new Headers({ ...Object.fromEntries(headers.entries()), "content-type": "application/json" })
    init.body = JSON.stringify(payload)
  }
  const result = await fetchBounded(fetcher, url, init)
  const response = result.response
  const data = result.data
  if (response.ok) return data
  const detail = message(data)
  if (response.status === 409) {
    throw new RemoteSupervisorPendingError(detail ?? "The desktop supervisor has not registered this SSH folder yet.")
  }
  if (response.status === 401 || response.status === 403) throw new Error("Desktop authentication failed for remote pairing.")
  throw new Error(detail ?? `Desktop remote request failed (${response.status}).`)
}

export class RemoteSupervisorPendingError extends Error {
  readonly code = "remote_supervisor_pending"

  constructor(detail: string) {
    super(detail)
    this.name = "RemoteSupervisorPendingError"
  }
}

export class RemoteSelectionBindingRequiredError extends Error {
  readonly code = "remote_selection_binding_required"

  constructor() {
    super("The desktop select endpoint is not device/session/code-bound; no connection was saved.")
    this.name = "RemoteSelectionBindingRequiredError"
  }
}

export type RemoteConnectInput = {
  serverUrl: string
  username: string
  password: string
  name: string
  workspaceID: string
  sshAuthority: string
  port?: number
  directory: string
  agent?: RemoteAgent
  recentFolders?: readonly string[]
  deviceID?: string
}

export type RemoteConnectResult = {
  state: RemoteWorkspaceState
  secret: { username: string; password: string }
  pairing: RemoteWorkspaceRecord
}

export type RemoteFolderEntry = {
  name: string
  path: string
  type: "directory"
}

export type RemoteFolderListing = {
  root: string
  path: string
  parent?: string
  entries: RemoteFolderEntry[]
  recentFolders: string[]
}

export type BrowseRemoteFoldersInput = {
  serverUrl: string
  username: string
  password: string
  workspaceID: string
  sshAuthority: string
  port?: number
  path?: string
  recentFolders?: readonly string[]
}

function parent(value: string) {
  if (value === "/") return
  const slash = value.lastIndexOf("/")
  if (slash <= 0) return "/"
  return value.slice(0, slash)
}

function boundedRecent(value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error("Remote folder history is invalid.")
  const paths = value
    .filter((item): item is string => typeof item === "string")
    .map(validDirectory)
  if (paths.length !== value.length || paths.some((item) => !item)) throw new Error("Remote folder history is invalid.")
  return paths
    .filter((item): item is string => !!item)
    .filter((item, index, all) => all.indexOf(item) === index)
    .slice(0, 3)
}

function within(root: string, value: string) {
  return root === "/" || value === root || value.startsWith(`${root}/`)
}

const remoteEntryTypes = ["directory", "file", "symlink", "other"] as const
type RemoteEntryType = (typeof remoteEntryTypes)[number]

function listing(value: unknown, recent: readonly string[]): RemoteFolderListing {
  if (!isRecord(value)) throw new Error("Desktop folder browser returned an invalid listing.")
  if (Object.keys(value).some((key) => !["root", "current", "parent", "entries"].includes(key))) {
    throw new Error("Desktop folder browser returned an invalid listing.")
  }
  const root = typeof value.root === "string" ? validDirectory(value.root) : undefined
  const path = typeof value.current === "string" ? validDirectory(value.current) : undefined
  if (!root || !path || !within(root, path) || !Array.isArray(value.entries) || value.entries.length > MAX_FOLDER_ENTRIES) {
    throw new Error("Desktop folder browser returned an invalid listing.")
  }

  const responseParent = value.parent === undefined ? undefined : typeof value.parent === "string" ? validDirectory(value.parent) : undefined
  if (value.parent !== undefined && (!responseParent || responseParent !== parent(path) || !within(root, responseParent))) {
    throw new Error("Desktop folder browser returned an invalid parent.")
  }

  const parsed = value.entries.map((item) => {
    if (
      !isRecord(item) ||
      Object.keys(item).some((key) => !["name", "path", "type"].includes(key)) ||
      typeof item.type !== "string" ||
      !remoteEntryTypes.includes(item.type as RemoteEntryType) ||
      typeof item.name !== "string" ||
      item.name.length < 1 ||
      item.name.length > MAX_FOLDER_NAME_LENGTH
    ) {
      throw new Error("Desktop folder browser returned an invalid entry.")
    }
    if (item.name === "." || item.name === ".." || item.name.includes("/") || /[\u0000\r\n]/.test(item.name)) {
      throw new Error("Desktop folder browser returned an invalid entry.")
    }
    const entryPath = typeof item.path === "string" ? validDirectory(item.path) : undefined
    const expectedPath = path === "/" ? `/${item.name}` : `${path}/${item.name}`
    if (!entryPath || entryPath !== expectedPath) throw new Error("Desktop folder browser returned an invalid entry path.")
    return { name: item.name, path: entryPath, type: item.type as RemoteEntryType }
  })
  if (parsed.some((item, index) => parsed.findIndex((other) => other.path === item.path) !== index)) {
    throw new Error("Desktop folder browser returned invalid duplicate entries.")
  }

  const entries = parsed
    .filter((item): item is RemoteFolderEntry => item.type === "directory")
    .map((item) => ({ name: item.name, path: item.path, type: "directory" as const }))
  const recentFolders = [...recent].filter((item, index, all) => all.indexOf(item) === index).slice(0, 3)
  return { root, path, ...(responseParent ? { parent: responseParent } : {}), entries, recentFolders }
}

export async function browseRemoteFolders(
  input: BrowseRemoteFoldersInput,
  fetcher: RemoteFetcher = fetch,
): Promise<RemoteFolderListing> {
  const serverUrl = validUrl(input.serverUrl)
  const workspaceID = validWorkspaceID(input.workspaceID)
  const path = input.path === undefined ? undefined : validDirectory(input.path)
  const authority = parseSshAuthority(input.sshAuthority)
  const port = authority && effectivePort(authority, input.port)
  const recent = boundedRecent(input.recentFolders)
  if (!serverUrl) throw new Error("Enter an HTTPS desktop or relay URL.")
  if (!workspaceID) throw new Error("Enter a workspace ID provisioned by the desktop host.")
  if (input.path !== undefined && !path) throw new Error("Remote folder must be an absolute POSIX path without traversal.")
  if (!authority || !port) throw new Error("SSH authority must be user@host with an optional unambiguous :port.")

  const headers = new Headers({ authorization: basic(clean(input.username), input.password) })
  const endpoint = new URL(`${serverUrl}/remote/ssh/browse`)
  endpoint.searchParams.set("workspace", workspaceID)
  if (path !== undefined) endpoint.searchParams.set("path", path)
  const data = await request(fetcher, endpoint.toString(), headers, undefined, "GET")
  return listing(data, recent)
}

export async function connectRemoteWorkspace(
  input: RemoteConnectInput,
  fetcher: Fetcher = fetch,
  save: (state: RemoteWorkspaceState, secret: { username: string; password: string }) => Promise<void> = persistRemoteWorkspace,
): Promise<RemoteConnectResult> {
  const serverUrl = validUrl(input.serverUrl)
  const remoteDirectory = validDirectory(input.directory)
  const authority = parseSshAuthority(input.sshAuthority)
  const sshPort = authority && effectivePort(authority, input.port)
  const workspaceID = validWorkspaceID(input.workspaceID)
  const agent = input.agent === undefined ? DEFAULT_REMOTE_AGENT : input.agent
  const recent = boundedRecent(input.recentFolders)
  if (!serverUrl) throw new Error("Enter an HTTPS desktop or relay URL.")
  if (!remoteDirectory) throw new Error("Remote folder must be an absolute POSIX path without traversal.")
  if (!authority || !sshPort) throw new Error("SSH authority must be user@host with an optional unambiguous :port.")
  if (!workspaceID) throw new Error("Enter a workspace ID provisioned by the desktop host.")
  if (!REMOTE_AGENTS.includes(agent)) throw new Error("Remote agent selection is invalid.")
  const deviceID = validDeviceID(input.deviceID)
  if (!deviceID) throw new Error("Android device identity is invalid.")

  const headers = new Headers({ authorization: basic(clean(input.username), input.password) })
  const health = await fetchBounded(fetcher, `${serverUrl}/global/health`, { headers, credentials: "omit", redirect: "error" })
  if (!health.response.ok) {
    if (health.response.status === 401 || health.response.status === 403) throw new Error("Desktop authentication failed for remote pairing.")
    throw new Error(`Desktop health check failed (${health.response.status}).`)
  }

  const requestedWorkspace = {
    id: workspaceID,
    name: clean(input.name) || remoteDirectory,
    mode: "ssh" as const,
    directory: remoteDirectory,
    remoteDirectory,
    agent,
    ssh: { host: authority.host, port: sshPort, user: authority.user },
  }
  const requestedDevice = {
    id: deviceID,
    name: "Slopcode Android",
    platform: "android",
    arch: "arm64",
    version: "1",
  }
  const created = record(
    await request(fetcher, `${serverUrl}/experimental/workspace/remote/pairing`, headers, {
      device: {
        ...requestedDevice,
      },
      workspace: requestedWorkspace,
    }),
    true,
  )
  if (
    !created ||
    !created.workspace ||
    !sameWorkspace(created.workspace, requestedWorkspace) ||
    !sameDevice(created.device, requestedDevice) ||
    !created.capability
  ) throw new Error("Desktop returned a pairing outside the requested device and workspace; no connection was saved.")

  const validated = workspace(
    await request(fetcher, `${serverUrl}/experimental/workspace/remote/ssh/validate`, headers, requestedWorkspace),
  )
  if (!validated || !sameWorkspace(validated, requestedWorkspace) || !sameWorkspace(validated, created.workspace)) {
    throw new Error("Desktop validation did not return the exact requested workspace; no connection was saved.")
  }

  if (!created.selection || created.selection.deviceID !== requestedDevice.id) throw new RemoteSelectionBindingRequiredError()

  const selected = record(
    await request(fetcher, `${serverUrl}/experimental/workspace/remote/select`, headers, {
      pairingID: created.id,
      deviceID: created.selection.deviceID,
      selectionNonce: created.selection.nonce,
      selectionCode: created.selection.code,
    }),
    false,
  )
  if (
    !selected ||
    selected.id !== created.id ||
    !selected.workspace ||
    !sameWorkspace(selected.workspace, requestedWorkspace) ||
    !sameWorkspace(selected.workspace, validated) ||
    !sameDevice(selected.device, requestedDevice) ||
    !sameHost(selected.host, created.host) ||
    !sameCapability(selected.capability, created.capability)
  ) throw new Error("Desktop did not return the exact authoritative selected pairing; no connection was saved.")

  const selectedID = selected.workspace.id
  if (!selectedID) throw new Error("Desktop returned a selected workspace without an ID; no connection was saved.")
  const selectedRecord: RemoteWorkspaceRecord = {
    ...selected.record,
    workspace: { ...selected.record.workspace, agent },
  }
  const scope = {
    origin: serverUrl,
    workspaceID: selectedID,
    authority: authorityKey(authority, sshPort),
  }
  const secret = { username: clean(input.username) || "slopcode", password: input.password }
  const state = rememberRemoteFolder(
    {
      version: 1,
      serverUrl,
      serverSelection: {
        url: serverUrl,
        workspaceID: selectedID,
        directory: selected.workspace.remoteDirectory ?? selected.workspace.directory,
      },
      workspace: selectedRecord,
      recentFolders: [
        {
          ...scope,
          paths: recent,
        },
      ],
      savedAt: new Date().toISOString(),
    },
    scope,
    remoteDirectory,
  )
  await save(state, secret)
  return { state, secret, pairing: selectedRecord }
}

export function RemoteConnect(props: Props) {
  const [url, setUrl] = createSignal("")
  const [username, setUsername] = createSignal("slopcode")
  const [password, setPassword] = createSignal("")
  const [name, setName] = createSignal("Remote workspace")
  const [workspace, setWorkspace] = createSignal("")
  const [port, setPort] = createSignal("22")
  const [authority, setAuthority] = createSignal("")
  const [directory, setDirectory] = createSignal("")
  const [agent, setAgent] = createSignal<RemoteAgent>(DEFAULT_REMOTE_AGENT)
  const [browsePath, setBrowsePath] = createSignal<string>()
  const [recentFolders, setRecentFolders] = createSignal<string[]>([])
  const [listingState, setListingState] = createSignal<RemoteFolderListing>()
  const [error, setError] = createSignal("")
  const [browseError, setBrowseError] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [browseBusy, setBrowseBusy] = createSignal(false)
  const [storedState, setStoredState] = createSignal<RemoteWorkspaceState>({ version: 1 })

  onMount(() => {
    void readInitialWorkspaceState()
      .then((initial) => setStoredState(initial.state))
      .catch(() => undefined)
  })

  const storedFolders = () => {
    const parsed = parseSshAuthority(authority())
    const resolved = parsed && effectivePort(parsed, validPort(port()))
    if (!parsed || !resolved) return []
    return remoteFoldersForScope(storedState(), {
      origin: url(),
      workspaceID: workspace(),
      authority: authorityKey(parsed, resolved),
    })
  }

  const browse = async (path = directory() || browsePath()) => {
    if (browseBusy()) return
    setBrowseBusy(true)
    setBrowseError("")
    try {
      const result = await browseRemoteFolders({
        serverUrl: url(),
        username: username(),
        password: password(),
        workspaceID: workspace(),
        sshAuthority: authority(),
        port: validPort(port()),
        path,
        recentFolders: recentFolders().length > 0 ? recentFolders() : storedFolders(),
      })
      setBrowsePath(result.path)
      setListingState(result)
      setRecentFolders(result.recentFolders)
    } catch (cause) {
      setBrowseError(cause instanceof Error ? cause.message : "Could not browse the remote machine.")
    } finally {
      setBrowseBusy(false)
    }
  }

  const connect = async () => {
    if (busy()) return
    setBusy(true)
    setError("")
    try {
      await connectRemoteWorkspace({
        serverUrl: url(),
        username: username(),
        password: password(),
        name: name(),
        workspaceID: workspace(),
        sshAuthority: authority(),
        port: validPort(port()),
        directory: directory(),
        agent: agent(),
        recentFolders: recentFolders(),
      })
      props.onConnected()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect to the desktop host.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main class="min-h-screen bg-surface-base text-text-strong flex items-center justify-center p-6">
      <form
        class="w-full max-w-xl rounded-xl border border-border-weak-base bg-surface-raised-base p-6 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void connect()
        }}
      >
        <div class="flex flex-col gap-1">
          <h1 class="text-20-medium">Connect to a remote workspace</h1>
          <p class="text-14-regular text-text-weak">
            The desktop host keeps SSH credentials local. Android receives only the selected workspace connection.
          </p>
        </div>

        <label class="flex flex-col gap-1 text-14-medium">
          Desktop HTTPS or relay URL
          <input
            required
            type="url"
            inputMode="url"
            placeholder="https://desktop.example.com"
            value={url()}
            onInput={(event) => setUrl(event.currentTarget.value)}
            class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
          />
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1 text-14-medium">
            Username
            <input
              type="text"
              autocomplete="username"
              value={username()}
              onInput={(event) => setUsername(event.currentTarget.value)}
              class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
            />
          </label>
          <label class="flex flex-col gap-1 text-14-medium">
            Desktop password or token
            <input
              type="password"
              autocomplete="current-password"
              value={password()}
              onInput={(event) => setPassword(event.currentTarget.value)}
              class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
            />
          </label>
        </div>

        <label class="flex flex-col gap-1 text-14-medium">
          Workspace name
          <input
            type="text"
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
            class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
          />
        </label>

        <label class="flex flex-col gap-1 text-14-medium">
            Workspace ID (provisioned by the desktop host)
            <input
              required
              type="text"
              placeholder="wrk_project"
            value={workspace()}
            onInput={(event) => setWorkspace(event.currentTarget.value)}
            class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
          />
        </label>

        <div class="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
          <label class="flex flex-col gap-1 text-14-medium">
            SSH authority
            <input
              required
              type="text"
              autocomplete="off"
              placeholder="mac-user@mac.example.com"
              value={authority()}
              onInput={(event) => {
                const value = event.currentTarget.value
                setAuthority(value)
                const parsed = parseSshAuthority(value)
                if (parsed?.port) setPort(String(parsed.port))
              }}
              class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
            />
          </label>
          <label class="flex flex-col gap-1 text-14-medium">
            Port fallback
            <input
              required
              type="number"
              min="1"
              max="65535"
              value={port()}
              onInput={(event) => setPort(event.currentTarget.value)}
              class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
            />
          </label>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-14-medium">Remote folder</span>
          <div class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2 text-14-regular">
            {directory() || "Choose a folder from the remote machine"}
          </div>
          <button
            type="button"
            disabled={browseBusy()}
            onClick={() => void browse()}
            class="rounded-md border border-border-weak-base px-4 py-2 disabled:opacity-50"
          >
            {browseBusy() ? "Loading folders…" : "Browse remote folders"}
          </button>
        </div>

        <label class="flex flex-col gap-1 text-14-medium">
          Agent
          <select
            value={agent()}
            onChange={(event) => {
              const value = event.currentTarget.value
              if (REMOTE_AGENTS.includes(value as RemoteAgent)) setAgent(value as RemoteAgent)
            }}
            class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
          >
            <option value="local-slopcode">Local Slopcode — commands run on the SSH host</option>
            <option value="codex-cli">Codex CLI — prompts/config are sent to Codex CLI</option>
            <option value="opencode-cli">OpenCode CLI — prompts/config are sent to OpenCode CLI</option>
          </select>
        </label>

        <Show when={listingState()}>
          <section class="rounded-md border border-border-weak-base p-3 flex flex-col gap-3" aria-label="Remote folder browser">
            <div class="flex items-center justify-between gap-2">
              <div class="flex flex-col gap-1">
                <h2 class="text-16-medium">Remote folders</h2>
                <p class="text-12-regular text-text-weak">{browsePath() ?? "Remote instance root"}</p>
              </div>
              <button
                type="button"
                disabled={!listingState()?.parent || browseBusy()}
                onClick={() => {
                  const next = listingState()?.parent
                  if (next) void browse(next)
                }}
                class="rounded-md border border-border-weak-base px-3 py-1 disabled:opacity-50"
              >
                Parent
              </button>
            </div>

            <Show when={(listingState()?.recentFolders.length ?? 0) > 0}>
              <div class="flex flex-col gap-2">
                <h3 class="text-14-medium">Recently used</h3>
                <For each={listingState()?.recentFolders ?? []}>
                  {(folder) => (
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void browse(folder)}
                        class="min-w-0 flex-1 text-left rounded-md border border-border-weak-base px-3 py-2 truncate"
                      >
                        {folder}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDirectory(folder)
                          setBrowsePath(folder)
                        }}
                        class="rounded-md border border-border-weak-base px-3 py-2"
                      >
                        Use
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <div class="flex flex-col gap-2">
              <h3 class="text-14-medium">Directories</h3>
              <Show when={(listingState()?.entries.length ?? 0) > 0} fallback={<p class="text-12-regular text-text-weak">No subfolders</p>}>
                <For each={listingState()?.entries ?? []}>
                  {(entry) => (
                    <button
                      type="button"
                      onClick={() => void browse(entry.path)}
                      class="rounded-md border border-border-weak-base px-3 py-2 text-left"
                    >
                      {entry.name}
                    </button>
                  )}
                </For>
              </Show>
            </div>

            <button
              type="button"
              onClick={() => {
                const current = listingState()?.path
                if (current) {
                  setDirectory(current)
                  setBrowsePath(current)
                  setListingState()
                }
              }}
              class="rounded-md bg-surface-brand-base text-text-on-brand-base px-4 py-2"
            >
              Use current folder
            </button>
          </section>
        </Show>

        <Show when={browseError()}>
          <p role="alert" class="text-14-regular text-text-on-critical-base">
            {browseError()}
          </p>
        </Show>

        <Show when={error()}>
          <p role="alert" class="text-14-regular text-text-on-critical-base">
            {error()}
          </p>
        </Show>

        <button
          type="submit"
          disabled={busy()}
          class="rounded-md bg-surface-brand-base text-text-on-brand-base px-4 py-2 disabled:opacity-50"
        >
          {busy() ? "Checking desktop…" : "Connect workspace"}
        </button>
      </form>
    </main>
  )
}
