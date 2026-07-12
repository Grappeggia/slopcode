import { describe, expect, test } from "bun:test"
import {
  AuthenticationReason,
  HttpContext,
  HttpRequestDetails,
  HttpResponseDetails,
  InvalidRequestReason,
  LLMError,
  ProviderInternalReason,
  RateLimitReason,
  TransportReason,
} from "@slopcode-ai/llm"
import { LLMEvent } from "@slopcode-ai/llm"
import { SessionProviderRetry } from "@slopcode-ai/core/session/provider-retry"

describe("SessionProviderRetry", () => {
  const error = (reason: LLMError["reason"]) => new LLMError({ module: "test", method: "stream", reason })

  test("uses exact bounded backoff and canonical hint precedence", () => {
    expect(Array.from({ length: 5 }, (_, index) => SessionProviderRetry.delay(index + 1, {}, 1_000))).toEqual([
      2_000,
      4_000,
      8_000,
      16_000,
      30_000,
    ])
    expect(SessionProviderRetry.delay(3, { retryAfterMs: 0, headers: { "retry-after-ms": "9000" } }, 1_000)).toBe(0)
    expect(SessionProviderRetry.delay(1, { headers: { "retry-after-ms": "2500", "retry-after": "9" } }, 1_000)).toBe(2_500)
    expect(SessionProviderRetry.delay(1, { headers: { "retry-after": "Thu, 01 Jan 1970 00:00:06 GMT" } }, 1_000)).toBe(5_000)
    expect(SessionProviderRetry.delay(1, { retryAfterMs: Number.POSITIVE_INFINITY }, 1_000)).toBe(2_000)
    expect(SessionProviderRetry.delay(1, { headers: { "retry-after": "Thu, 01 Jan 1970 00:00:00 GMT" } }, 1_000)).toBe(2_000)
    expect(SessionProviderRetry.delay(1, { retryAfterMs: 90_000 }, 1_000)).toBe(30_000)
  })

  test("retries only explicit or canonical transient failures and honors deny classes", () => {
    expect(SessionProviderRetry.classify(error(new RateLimitReason({ message: "limited" })))).toMatchObject({ code: "rate-limit" })
    expect(SessionProviderRetry.classify(error(new ProviderInternalReason({ message: "server", status: 500 })))).toMatchObject({ code: "server" })
    expect(SessionProviderRetry.classify(error(new TransportReason({ message: "retry me" })))).toBeUndefined()
    expect(SessionProviderRetry.classify(LLMEvent.providerError({ message: "explicit", retryable: true }))).toMatchObject({ code: "explicit" })
    expect(SessionProviderRetry.classify(LLMEvent.providerError({ message: "rate limit 500", retryable: false }))).toBeUndefined()
    expect(SessionProviderRetry.classify(error(new AuthenticationReason({ message: "no", kind: "invalid" })))).toBeUndefined()
    expect(SessionProviderRetry.classify(error(new InvalidRequestReason({ message: "too large", classification: "context-overflow" })))).toBeUndefined()
  })

  test("sanitizes bounded durable retry metadata", () => {
    const secret = "sk-secret-canary"
    const value = SessionProviderRetry.notice(
      error(new RateLimitReason({
        message: `retry\u0000 authorization Bearer ${secret} ${"😀".repeat(300)}`,
        retryAfterMs: 0,
      })),
    )
    expect(value.message).not.toContain(secret)
    expect(value.message).not.toContain("\u0000")
    expect(new TextEncoder().encode(value.message).byteLength).toBeLessThanOrEqual(512)
    expect(value).toEqual({ code: "rate-limit", action: "retry-provider", message: value.message })
    const forbidden = SessionProviderRetry.notice(
      error(new RateLimitReason({
        message: "authorization=secret-message",
        retryAfterMs: 0,
        http: new HttpContext({
          request: new HttpRequestDetails({ method: "POST", url: "https://secret.example/prompt", headers: { authorization: "secret-header" } }),
          response: new HttpResponseDetails({ status: 429, headers: { "x-secret": "secret-response" } }),
          body: "secret-body",
          requestId: "secret-request-id",
        }),
        providerMetadata: { private: { value: "secret-metadata" } },
      })),
    )
    expect(JSON.stringify(forbidden)).not.toMatch(/secret-(?:message|header|response|body|request-id|metadata)|secret\.example/)
  })

  test("allows exactly five additional provider attempts", () => {
    expect(SessionProviderRetry.MAX_ADDITIONAL_ATTEMPTS).toBe(5)
    expect(SessionProviderRetry.canRetry(5)).toBeTrue()
    expect(SessionProviderRetry.canRetry(6)).toBeFalse()
  })
})
