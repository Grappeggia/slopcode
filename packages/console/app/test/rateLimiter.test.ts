import { describe, expect, test } from "bun:test"
import { admitIpRequest, getRetryAfterDay } from "../src/routes/zen/util/ipRateLimiter"
import { admitKeyRequest } from "../src/routes/zen/util/keyRateLimiter"

class Redis {
  counts = new Map<string, number>()
  expires = new Map<string, number>()
  calls = 0

  async eval<T>(_script: string, keys: string[], args: unknown[]) {
    this.calls++

    if (keys.length === 1) {
      const limit = Number(args[0])
      const count = this.counts.get(keys[0]) ?? 0
      if (count >= limit) return [0, count] as T
      this.counts.set(keys[0], count + 1)
      if (count === 0) this.expires.set(keys[0], Number(args[1]))
      return [1, count + 1] as T
    }

    const limit = Number(args[0])
    const retryAfter = Number(args[1])
    const isDefault = Number(args[2]) === 1
    const lifetime = this.counts.get(keys[1]) ?? 0
    const daily = this.counts.get(keys[0]) ?? 0
    const isNew = isDefault && lifetime < limit * 7
    const allowed = isNew ? limit * 2 : limit
    if (daily >= allowed) return [0, daily, isNew ? 1 : 0] as T
    this.counts.set(keys[0], daily + 1)
    if (daily === 0) this.expires.set(keys[0], retryAfter)
    if (isNew) this.counts.set(keys[1], lifetime + 1)
    return [1, daily + 1, isNew ? 1 : 0] as T
  }
}

describe("getRetryAfterDay", () => {
  test("returns full day at midnight UTC", () => {
    const midnight = Date.UTC(2026, 0, 15, 0, 0, 0, 0)
    expect(getRetryAfterDay(midnight)).toBe(86_400)
  })

  test("returns remaining seconds until next UTC day", () => {
    const noon = Date.UTC(2026, 0, 15, 12, 0, 0, 0)
    expect(getRetryAfterDay(noon)).toBe(43_200)
  })

  test("rounds up to nearest second", () => {
    const almost = Date.UTC(2026, 0, 15, 23, 59, 59, 500)
    expect(getRetryAfterDay(almost)).toBe(1)
  })
})

describe("atomic rate-limit admission", () => {
  test("admits at most the key limit under concurrency", async () => {
    const redis = new Redis()
    const results = await Promise.all(Array.from({ length: 20 }, () => admitKeyRequest(redis, "key", 3, 60)))

    expect(results.filter(Boolean)).toHaveLength(3)
    expect(redis.counts.get("key")).toBe(3)
    expect(redis.expires.get("key")).toBe(60)
    expect(redis.calls).toBe(20)
  })

  test("keeps admitted key requests counted when provider setup fails", async () => {
    const redis = new Redis()

    expect(await admitKeyRequest(redis, "key", 1, 60)).toBe(true)
    await expect(Promise.reject(new Error("provider unavailable"))).rejects.toThrow("provider unavailable")
    expect(await admitKeyRequest(redis, "key", 1, 60)).toBe(false)
    expect(redis.counts.get("key")).toBe(1)
  })

  test("admits at most the IP limit and updates lifetime count atomically", async () => {
    const redis = new Redis()
    const results = await Promise.all(
      Array.from({ length: 20 }, () => admitIpRequest(redis, "daily", "lifetime", 2, 3600, true)),
    )

    expect(results.filter((result) => result.admitted)).toHaveLength(4)
    expect(redis.counts.get("daily")).toBe(4)
    expect(redis.counts.get("lifetime")).toBe(4)
    expect(redis.expires.get("daily")).toBe(3600)
  })
})
