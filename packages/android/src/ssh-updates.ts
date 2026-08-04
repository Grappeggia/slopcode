import type { SshAgent } from "./ssh"

export type SshUpdatePreference = "upgrade" | "skip"

export type SshUpdateRecord = {
  checkedAt: number
  preference?: SshUpdatePreference
}

type Store = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

const KEY = "ssh.agent-updates.v1"
const DAY = 24 * 60 * 60 * 1_000
const MAX_RECORDS = 32

function name(profile: string, agent: SshAgent) {
  return `${profile}|${agent}`
}

function records(value: string | null) {
  if (!value) return {} as Record<string, SshUpdateRecord>
  try {
    const raw: unknown = JSON.parse(value)
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
    return Object.fromEntries(
      Object.entries(raw).flatMap(([key, item]) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return []
        const checkedAt = (item as { checkedAt?: unknown }).checkedAt
        const preference = (item as { preference?: unknown }).preference
        if (typeof checkedAt !== "number" || !Number.isSafeInteger(checkedAt) || checkedAt < 0) return []
        if (preference !== undefined && preference !== "upgrade" && preference !== "skip") return []
        return [[key, { checkedAt, ...(preference ? { preference } : {}) }]]
      }),
    ) as Record<string, SshUpdateRecord>
  } catch {
    return {}
  }
}

export function shouldCheckSshUpdate(record: SshUpdateRecord | undefined, now = Date.now()) {
  if (!record) return true
  return now < record.checkedAt || now - record.checkedAt >= DAY
}

export async function readSshUpdateRecord(store: Store, profile: string, agent: SshAgent) {
  const value = records(await store.getItem(KEY).catch(() => null))
  return value[name(profile, agent)]
}

export async function writeSshUpdateRecord(
  store: Store,
  profile: string,
  agent: SshAgent,
  record: SshUpdateRecord,
) {
  const value = records(await store.getItem(KEY).catch(() => null))
  const next = Object.fromEntries(
    Object.entries({ ...value, [name(profile, agent)]: record })
      .sort((left, right) => right[1].checkedAt - left[1].checkedAt)
      .slice(0, MAX_RECORDS),
  )
  await store.setItem(KEY, JSON.stringify(next))
}

function version(value: string) {
  const match = value.trim().match(/^(?:v)?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+][0-9A-Za-z.-]+)?$/)
  if (!match) return
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)]
}

export function newerSshVersion(current: string, latest: string) {
  const a = version(current)
  const b = version(latest)
  if (!a || !b) return false
  return b.some((value, index) => value !== a[index] && value > a[index] && b.slice(0, index).every((item, i) => item === a[i]))
}
