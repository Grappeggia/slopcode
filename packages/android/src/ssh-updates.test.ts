import { describe, expect, test } from "bun:test"
import { newerSshVersion, readSshUpdateRecord, shouldCheckSshUpdate, writeSshUpdateRecord } from "./ssh-updates"

function store() {
  const values = new Map<string, string>()
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => void values.set(key, value),
  }
}

describe("SSH agent update checks", () => {
  test("checks immediately, then waits a day", () => {
    expect(shouldCheckSshUpdate(undefined, 1_000)).toBe(true)
    expect(shouldCheckSshUpdate({ checkedAt: 1_000 }, 1_000 + 23 * 60 * 60 * 1_000)).toBe(false)
    expect(shouldCheckSshUpdate({ checkedAt: 1_000 }, 1_000 + 24 * 60 * 60 * 1_000)).toBe(true)
    expect(shouldCheckSshUpdate({ checkedAt: 2_000 }, 1_000)).toBe(true)
  })

  test("compares provider versions without accepting malformed values", () => {
    expect(newerSshVersion("0.146.0", "0.147.0")).toBe(true)
    expect(newerSshVersion("1.2.9", "1.3.0")).toBe(true)
    expect(newerSshVersion("1.3.0", "1.3.0")).toBe(false)
    expect(newerSshVersion("1.4.0", "1.3.9")).toBe(false)
    expect(newerSshVersion("unknown", "1.3.0")).toBe(false)
  })

  test("stores preferences locally per profile and provider", async () => {
    const value = store()
    await writeSshUpdateRecord(value, "agent@void:22", "codex-cli", { checkedAt: 10, preference: "skip" })
    await writeSshUpdateRecord(value, "agent@void:22", "opencode-cli", { checkedAt: 20 })
    expect(await readSshUpdateRecord(value, "agent@void:22", "codex-cli")).toEqual({ checkedAt: 10, preference: "skip" })
    expect(await readSshUpdateRecord(value, "agent@void:22", "opencode-cli")).toEqual({ checkedAt: 20 })
    expect(await readSshUpdateRecord(value, "other@void:22", "codex-cli")).toBeUndefined()
  })
})
