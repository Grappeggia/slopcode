import type { AndroidSecureStorage } from "./types"

export type RemoteWorkspaceState = {
  version: 1
  serverUrl?: string
  pairing?: { version: "v1" } & Record<string, unknown>
  savedAt?: string
}

const KEY = "remote.workspace"
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

function normalizePairing(value: unknown) {
  if (!isRecord(value)) return
  if (value.version !== "v1") return
  return { ...value } as RemoteWorkspaceState["pairing"]
}

export function normalizeRemoteWorkspaceState(value: unknown): RemoteWorkspaceState {
  if (!isRecord(value)) return { version: 1 }
  return {
    version: 1,
    serverUrl: text(value.serverUrl),
    pairing: normalizePairing(value.pairing),
    savedAt: text(value.savedAt),
  }
}

export async function readRemoteWorkspaceState(storage: AndroidSecureStorage) {
  const raw = await storage.getItem(NAMESPACE, KEY)
  if (!raw) return { version: 1 } satisfies RemoteWorkspaceState
  try {
    return normalizeRemoteWorkspaceState(JSON.parse(raw))
  } catch {
    return { version: 1 } satisfies RemoteWorkspaceState
  }
}

export async function writeRemoteWorkspaceState(storage: AndroidSecureStorage, state: RemoteWorkspaceState) {
  const next = normalizeRemoteWorkspaceState(state)
  if (!next.serverUrl && !next.pairing && !next.savedAt) {
    await storage.removeItem(NAMESPACE, KEY)
    return
  }
  await storage.setItem(NAMESPACE, KEY, JSON.stringify(next))
}
