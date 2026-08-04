import type { AndroidSecureStorage } from "./types"
import { SSH_AGENTS, normalizeSshTarget, parseSshTarget, sshProfile, validSshPath, type SshAgent } from "./ssh"

export type SshWorkspaceState = {
  version: 1
  target: string
  profile: string
  host: string
  port: number
  username: string
  directory: string
  agent: SshAgent
  recentTargets: string[]
  recentFolders: string[]
  savedAt?: string
}

const NAMESPACE = "slopcode.android.remote.dat"
const KEY = "ssh.workspace.v1"
const MAX_TARGETS = 8
const MAX_FOLDERS = 3

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function agent(value: unknown): SshAgent | undefined {
  if (value === "slopcode-cli") return "opencode-cli"
  return typeof value === "string" && SSH_AGENTS.includes(value as SshAgent) ? (value as SshAgent) : undefined
}

export function normalizeSshWorkspace(value: unknown): SshWorkspaceState | undefined {
  if (!record(value)) return
  const target = normalizeSshTarget(text(value.target) ?? "")
  const parsed = target ? parseSshTarget(target) : undefined
  const port = typeof value.port === "number" && Number.isInteger(value.port) ? value.port : (parsed?.port ?? 22)
  const profile = target ? sshProfile(target, port) : undefined
  const directory = validSshPath(text(value.directory) ?? "")
  const selected = agent(value.agent)
  if (!target || !parsed || !profile || !directory || !selected || port < 1 || port > 65_535) return
  const recentTargets = Array.isArray(value.recentTargets)
    ? value.recentTargets
        .filter((item): item is string => typeof item === "string")
        .map(normalizeSshTarget)
        .filter((item): item is string => !!item)
        .filter((item, index, all) => all.indexOf(item) === index)
        .slice(0, MAX_TARGETS)
    : []
  const recentFolders = Array.isArray(value.recentFolders)
    ? value.recentFolders
        .filter((item): item is string => typeof item === "string")
        .map(validSshPath)
        .filter((item): item is string => !!item)
        .filter((item, index, all) => all.indexOf(item) === index)
        .slice(0, MAX_FOLDERS)
    : []
  return {
    version: 1,
    target,
    profile,
    host: parsed.host,
    port,
    username: parsed.user,
    directory,
    agent: selected,
    recentTargets,
    recentFolders,
    ...(typeof value.savedAt === "string" ? { savedAt: value.savedAt } : {}),
  }
}

export function rememberSshTarget(state: SshWorkspaceState | undefined, target: string) {
  const next = normalizeSshTarget(target)
  if (!next) return state
  const current = state ? normalizeSshWorkspace(state) : undefined
  if (!current) return undefined
  return {
    ...current,
    recentTargets: [next, ...current.recentTargets.filter((item) => item !== next)].slice(0, MAX_TARGETS),
  }
}

export function rememberSshFolder(state: SshWorkspaceState, folder: string) {
  const next = validSshPath(folder)
  if (!next) return state
  return {
    ...state,
    recentFolders: [next, ...state.recentFolders.filter((item) => item !== next)].slice(0, MAX_FOLDERS),
  }
}

export async function readSshWorkspace(storage: AndroidSecureStorage) {
  const raw = await storage.getItem(NAMESPACE, KEY)
  if (!raw) return undefined
  try {
    return normalizeSshWorkspace(JSON.parse(raw))
  } catch {
    return undefined
  }
}

export async function writeSshWorkspace(storage: AndroidSecureStorage, state: SshWorkspaceState) {
  const next = normalizeSshWorkspace(state)
  if (!next) throw new Error("SSH workspace state is invalid")
  await storage.setItem(NAMESPACE, KEY, JSON.stringify({ ...next, savedAt: new Date().toISOString() }))
}

export async function clearSshWorkspace(storage: AndroidSecureStorage) {
  await storage.removeItem(NAMESPACE, KEY)
}
