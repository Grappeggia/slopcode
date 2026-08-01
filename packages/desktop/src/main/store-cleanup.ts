import { readdir, readFile, rm, stat } from "node:fs/promises"
import { join } from "node:path"

const emptyStoreMaxBytes = 128
const draftRetentionMs = 30 * 24 * 60 * 60 * 1000
const draftKeepRecent = 100

type StoreKind = "draft" | "workspace"
type StoreCandidate = {
  name: string
  path: string
  kind: StoreKind
  modified: number
  empty: boolean
}

export async function cleanupStoreFiles(userDataPath: string, now = Date.now()) {
  const entries = await readdir(userDataPath, { withFileTypes: true }).catch(() => [])
  const candidates = (
    await Promise.all(
      entries.filter((entry) => entry.isFile()).map((entry) => candidate(userDataPath, entry.name)),
    )
  ).filter((entry): entry is StoreCandidate => entry !== undefined)
  const stale = new Set<StoreCandidate>()

  candidates.forEach((entry) => {
    if (entry.empty || (entry.kind === "draft" && now - entry.modified > draftRetentionMs)) stale.add(entry)
  })
  candidates
    .filter((entry) => entry.kind === "draft" && !entry.empty)
    .sort((a, b) => b.modified - a.modified)
    .slice(draftKeepRecent)
    .forEach((entry) => stale.add(entry))

  const deleted = await Promise.all(
    [...stale].map(async (entry) => {
      await rm(entry.path, { force: true })
      return entry.name
    }),
  )
  return { scanned: candidates.length, deleted }
}

export async function deleteStoreFileIfEmpty(userDataPath: string, name: string) {
  const entry = await candidate(userDataPath, name)
  if (!entry?.empty) return false
  await rm(entry.path, { force: true })
  return true
}

async function candidate(userDataPath: string, name: string) {
  const kind = storeKind(name)
  if (!kind) return
  const path = join(userDataPath, name)
  const info = await stat(path).catch(() => undefined)
  if (!info?.isFile()) return
  return { name, path, kind, modified: info.mtimeMs, empty: await isEmptyStore(path, info.size) }
}

function storeKind(name: string): StoreKind | undefined {
  if (/^slopcode\.draft\..+\.dat$/.test(name)) return "draft"
  if (/^slopcode\.workspace\..+\.dat$/.test(name)) return "workspace"
}

async function isEmptyStore(path: string, size: number) {
  if (size > emptyStoreMaxBytes) return false
  const raw = await readFile(path, "utf8").catch(() => undefined)
  if (raw === undefined) return false
  if (raw.trim() === "") return true
  try {
    const value = JSON.parse(raw) as unknown
    return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0
  } catch {
    return false
  }
}
