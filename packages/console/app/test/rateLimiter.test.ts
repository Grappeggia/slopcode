import { describe, expect, test } from "bun:test"
import { admitIpRequest, getRetryAfterDay } from "../src/routes/zen/util/ipRateLimiter"
import { admitKeyRequest } from "../src/routes/zen/util/keyRateLimiter"

const KEY_ADMIT = `
local count = tonumber(redis.call("GET", KEYS[1]) or "0")
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
if redis.call("TTL", KEYS[1]) < 0 and count > 0 then
  redis.call("EXPIRE", KEYS[1], ttl)
end
if count >= limit then
  return {0, count}
end
count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ttl)
end
return {1, count}
`

const IP_ADMIT = `
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local is_default = tonumber(ARGV[3]) == 1
local lifetime = tonumber(redis.call("GET", KEYS[2]) or "0")
local daily = tonumber(redis.call("GET", KEYS[1]) or "0")
local is_new = is_default and lifetime < limit * 7
local allowed = is_new and limit * 2 or limit
if redis.call("TTL", KEYS[1]) < 0 and daily > 0 then
  redis.call("EXPIRE", KEYS[1], ttl)
end
if daily >= allowed then
  return {0, daily, is_new and 1 or 0}
end
daily = redis.call("INCR", KEYS[1])
if daily == 1 then
  redis.call("EXPIRE", KEYS[1], ttl)
end
if is_new then
  redis.call("INCR", KEYS[2])
end
return {1, daily, is_new and 1 or 0}
`

class Redis {
  counts = new Map<string, number>()
  expires = new Map<string, number>()
  calls = 0

  async eval<T>(script: string, keys: string[], args: unknown[]) {
    this.calls++

    if (script === KEY_ADMIT) {
      if (keys.length !== 1 || args.length !== 2) throw new Error("Invalid key admission contract")
      const limit = Number(args[0])
      const count = this.counts.get(keys[0]) ?? 0
      if (count > 0 && !this.expires.has(keys[0])) this.expires.set(keys[0], Number(args[1]))
      if (count >= limit) return [0, count] as T
      this.counts.set(keys[0], count + 1)
      if (count === 0) this.expires.set(keys[0], Number(args[1]))
      return [1, count + 1] as T
    }

    if (script !== IP_ADMIT) throw new Error("Unexpected Redis script")
    if (keys.length !== 2 || args.length !== 3) throw new Error("Invalid IP admission contract")
    const limit = Number(args[0])
    const retryAfter = Number(args[1])
    const isDefault = Number(args[2]) === 1
    const lifetime = this.counts.get(keys[1]) ?? 0
    const daily = this.counts.get(keys[0]) ?? 0
    if (daily > 0 && !this.expires.has(keys[0])) this.expires.set(keys[0], retryAfter)
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

  test("repairs missing TTLs on existing key and IP counters", async () => {
    const redis = new Redis()
    redis.counts.set("key", 1)
    redis.counts.set("daily", 1)

    expect(await admitKeyRequest(redis, "key", 3, 60)).toBe(true)
    expect(await admitIpRequest(redis, "daily", "lifetime", 3, 3_600, false)).toEqual({
      admitted: true,
      isNew: false,
    })
    expect(redis.expires.get("key")).toBe(60)
    expect(redis.expires.get("daily")).toBe(3_600)
    await expect(redis.eval("return 1", [], [])).rejects.toThrow("Unexpected Redis script")
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
