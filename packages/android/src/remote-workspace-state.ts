import type { AndroidSecureStorage } from "./types"

export type RemoteWorkspaceRecord = {
  version: "v1"
  pairingId?: string
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
    ssh?: {
      host?: string
      port?: number
      user?: string
    }
  }
}

export type RemoteWorkspaceSecret = {
  username?: string
  password: string
}

export type RemoteWorkspaceState = {
  version: 1
  serverUrl?: string
  workspace?: RemoteWorkspaceRecord
  savedAt?: string
}

const STATE_KEY = "remote.workspace"
const SECRET_KEY = "remote.workspace.secret"
const NAMESPACE = "slopcode.android.remote.dat"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function text(value: unknown) {
  if (typeof value !== "string") return
  const trimmed = value.trim()
  if (!trimmed) return
  return trimmed
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

function normalizeWorkspace(value: unknown) {
  if (!isRecord(value)) return
  const record = clean({
    id: text(value.id),
    name: text(value.name),
    mode: mode(value.mode),
    directory: text(value.directory),
    remoteDirectory: text(value.remoteDirectory),
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

function normalizeWorkspaceRecord(value: unknown): RemoteWorkspaceRecord | undefined {
  if (!isRecord(value)) return
  const record = clean({
    version: "v1" as const,
    pairingId: text("pairingId" in value ? value.pairingId : value.id),
    device: normalizeDevice(value.device),
    host: normalizeHost(value.host),
    workspace: normalizeWorkspace(value.workspace),
  })
  if (!record) return
  if (!record.device && !record.host && !record.workspace) return
  return record
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

export function normalizeRemoteWorkspaceState(value: unknown): RemoteWorkspaceState {
  if (!isRecord(value)) return { version: 1 }
  return {
    version: 1,
    serverUrl: normalizeHttpsUrl(value.serverUrl),
    workspace: normalizeWorkspaceRecord(value.workspace ?? value.pairing),
    savedAt: text(value.savedAt),
  }
}

export async function readRemoteWorkspaceState(storage: AndroidSecureStorage) {
  const raw = await storage.getItem(NAMESPACE, STATE_KEY)
  if (!raw) return { version: 1 } satisfies RemoteWorkspaceState
  try {
    const value = JSON.parse(raw)
    const next = normalizeRemoteWorkspaceState(value)
    if (isRecord(value) && text(value.serverUrl) && !next.serverUrl) {
      await storage.removeItem(NAMESPACE, STATE_KEY)
      return { version: 1 } satisfies RemoteWorkspaceState
    }
    return next
  } catch {
    return { version: 1 } satisfies RemoteWorkspaceState
  }
}

export async function readRemoteWorkspaceSecret(storage: AndroidSecureStorage) {
  const raw = await storage.getItem(NAMESPACE, SECRET_KEY)
  if (!raw) return
  try {
    return normalizeRemoteWorkspaceSecret(JSON.parse(raw))
  } catch {
    return
  }
}

export async function writeRemoteWorkspaceState(storage: AndroidSecureStorage, state: RemoteWorkspaceState) {
  const next = normalizeRemoteWorkspaceState(state)
  if (text(state.serverUrl) && !next.serverUrl) {
    await storage.removeItem(NAMESPACE, STATE_KEY)
    throw new Error("Remote server URL must be HTTPS without credentials, query, or fragment")
  }
  if (!next.serverUrl && !next.workspace && !next.savedAt) {
    await storage.removeItem(NAMESPACE, STATE_KEY)
    return
  }
  await storage.setItem(NAMESPACE, STATE_KEY, JSON.stringify(next))
}

export async function writeRemoteWorkspaceSecret(storage: AndroidSecureStorage, secret?: RemoteWorkspaceSecret) {
  const next = normalizeRemoteWorkspaceSecret(secret)
  if (!next) {
    await storage.removeItem(NAMESPACE, SECRET_KEY)
    return
  }
  await storage.setItem(NAMESPACE, SECRET_KEY, JSON.stringify(next))
}
