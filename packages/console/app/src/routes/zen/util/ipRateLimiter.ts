import { FreeUsageLimitError } from "./error"
import { logger } from "./logger"
import { buildRateLimitKey, getRedis } from "./redis"
import { i18n } from "~/i18n"
import { localeFromRequest } from "~/lib/language"
import { Subscription } from "@slopcode-ai/console-core/subscription.js"

type Redis = {
  eval<T>(script: string, keys: string[], args: unknown[]): Promise<T>
}

export const IP_ADMIT = `
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

export async function admitIpRequest(
  redis: Redis,
  dailyKey: string,
  lifetimeKey: string,
  limit: number,
  ttl: number,
  isDefault: boolean,
) {
  const result = await redis.eval<[number, number, number]>(
    IP_ADMIT,
    [dailyKey, lifetimeKey],
    [limit, ttl, isDefault ? 1 : 0],
  )
  return { admitted: Number(result[0]) === 1, isNew: Number(result[2]) === 1 }
}

export function createRateLimiter(modelId: string, rateLimit: number | undefined, rawIp: string, request: Request) {
  const dict = i18n(localeFromRequest(request))

  const limits = Subscription.getFreeLimits()
  // temporarily disable check headers
  //const headersExist = Object.entries(limits.checkHeaders).every(
  //  ([name, value]) => request.headers.get(name)?.toLowerCase().includes(value) ?? false,
  //)
  //const dailyLimit = !headersExist ? limits.dailyRequestsFallback : (rateLimit ?? limits.dailyRequests)
  const headersExist = true
  const dailyLimit = !headersExist ? limits.dailyRequestsFallback : (rateLimit ?? limits.dailyRequests)
  const isDefaultModel = headersExist && !rateLimit

  const ip = !rawIp.length ? "unknown" : rawIp
  const now = Date.now()
  const dailyInterval = rateLimit ? `${buildYYYYMMDD(now)}${modelId.substring(0, 2)}` : buildYYYYMMDD(now)
  const retryAfter = getRetryAfterDay(now)
  const redis = getRedis()
  const lifetimeKey = buildRateLimitKey("ip", ip)
  const dailyKey = buildRateLimitKey("ip", ip, dailyInterval)
  return {
    admit: async () => {
      const result = await admitIpRequest(redis, dailyKey, lifetimeKey, dailyLimit, retryAfter, isDefaultModel)
      logger.debug(`rate limit admitted: ${result.admitted}, new: ${result.isNew}`)
      if (!result.admitted) throw new FreeUsageLimitError(dict["zen.api.error.rateLimitExceeded"], retryAfter)
    },
  }
}

export function getRetryAfterDay(now: number) {
  return Math.ceil((86_400_000 - (now % 86_400_000)) / 1000)
}

function buildYYYYMMDD(timestamp: number) {
  return new Date(timestamp)
    .toISOString()
    .replace(/[^0-9]/g, "")
    .substring(0, 8)
}
