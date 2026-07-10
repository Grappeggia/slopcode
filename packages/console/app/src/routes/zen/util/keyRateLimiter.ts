import { RateLimitError } from "./error"
import { buildRateLimitKey, getRedis } from "./redis"
import { i18n } from "~/i18n"
import { localeFromRequest } from "~/lib/language"

type Redis = {
  eval<T>(script: string, keys: string[], args: unknown[]): Promise<T>
}

export const KEY_ADMIT = `
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

export async function admitKeyRequest(redis: Redis, key: string, limit: number, ttl: number) {
  const result = await redis.eval<[number, number]>(KEY_ADMIT, [key], [limit, ttl])
  return Number(result[0]) === 1
}

export function createRateLimiter(
  modelId: string,
  rateLimit: number | undefined,
  zenApiKey: string | undefined,
  request: Request,
) {
  if (!zenApiKey) return
  const dict = i18n(localeFromRequest(request))

  const LIMIT = rateLimit ?? 1000
  const yyyyMMddHHmm = new Date(Date.now())
    .toISOString()
    .replace(/[^0-9]/g, "")
    .substring(0, 12)
  const interval = `${modelId.substring(0, 27)}-${yyyyMMddHHmm}`
  const redis = getRedis()
  const key = buildRateLimitKey("key", zenApiKey, interval)

  return {
    admit: async () => {
      if (!(await admitKeyRequest(redis, key, LIMIT, 60)))
        throw new RateLimitError(dict["zen.api.error.rateLimitExceeded"], 60)
    },
  }
}
