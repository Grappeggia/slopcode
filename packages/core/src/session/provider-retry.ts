export * as SessionProviderRetry from "./provider-retry"

import { LLMError, ProviderErrorEvent, type LLMErrorReason } from "@slopcode-ai/llm"
import { Schema } from "effect"

export const MAX_ADDITIONAL_ATTEMPTS = 5
export const MAX_ATTEMPTS = MAX_ADDITIONAL_ATTEMPTS + 1
export const MAX_DELAY_MS = 30_000
const BACKOFF = [2_000, 4_000, 8_000, 16_000, 30_000] as const
const AUTH = /\b(?:basic|bearer)\s+(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi
const JSON_SECRET = /"(?:authorization|api[-_]?key|token|secret|credential)"\s*:\s*"(?:[^"\\]|\\.)*"/gi
const ASSIGNED_SECRET =
  /\b(?:authorization|api[-_]?key|token|secret|credential)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^,;]+)/gi

export const Code = Schema.Literals(["rate-limit", "server", "explicit", "dispatch-uncertain"])
export type Code = typeof Code.Type
export const Action = Schema.Literal("retry-provider")
export type Action = typeof Action.Type

export type Notice = {
  readonly code: Code
  readonly action: Action
  readonly message: string
}

type Hint = {
  readonly retryAfterMs?: number
  readonly headers?: Readonly<Record<string, string>>
}

const finite = (value: unknown) => {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export const delay = (attempt: number, hint: Hint, now: number) => {
  const direct = finite(hint.retryAfterMs)
  if (direct !== undefined) return Math.min(direct, MAX_DELAY_MS)
  const millis = finite(hint.headers?.["retry-after-ms"])
  if (millis !== undefined) return Math.min(millis, MAX_DELAY_MS)
  const value = hint.headers?.["retry-after"]
  const seconds = finite(value)
  if (seconds !== undefined) return Math.min(seconds * 1_000, MAX_DELAY_MS)
  if (value) {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed) && parsed >= now) return Math.min(parsed - now, MAX_DELAY_MS)
  }
  return BACKOFF[Math.max(0, Math.min(BACKOFF.length - 1, attempt - 1))]!
}

const status = (reason: LLMErrorReason) => {
  if (reason._tag === "ProviderInternal") return reason.status
  return (
    ("http" in reason ? reason.http?.response?.status : undefined) ??
    (reason._tag === "UnknownProvider" ? reason.status : undefined)
  )
}

const denied = (reason: LLMErrorReason) =>
  reason._tag === "InvalidRequest" ||
  reason._tag === "NoRoute" ||
  reason._tag === "Authentication" ||
  reason._tag === "QuotaExceeded" ||
  reason._tag === "ContentPolicy" ||
  reason._tag === "InvalidProviderOutput"

export const classify = (failure: unknown): Notice | undefined => {
  if (failure instanceof LLMError) {
    if (denied(failure.reason)) return
    const code =
      failure.reason._tag === "RateLimit"
        ? "rate-limit"
        : failure.reason._tag === "ProviderInternal"
          ? "server"
          : undefined
    const http = status(failure.reason)
    if (http !== undefined && http !== 429 && (http < 500 || http > 599)) return
    if (!failure.retryable && http !== 429 && !(http !== undefined && http >= 500 && http <= 599)) return
    return {
      code: code ?? (http === 429 ? "rate-limit" : "server"),
      action: "retry-provider",
      message: sanitize(failure.reason.message),
    }
  }
  if (
    !Schema.is(ProviderErrorEvent)(failure) ||
    failure.retryable !== true ||
    failure.classification === "context-overflow"
  )
    return
  return { code: "explicit", action: "retry-provider", message: sanitize(failure.message) }
}

export const notice = (failure: unknown) =>
  classify(failure) ?? {
    code: "explicit" as const,
    action: "retry-provider" as const,
    message: "Provider request failed",
  }

export const hints = (failure: unknown): Hint => {
  if (!(failure instanceof LLMError)) return {}
  const reason = failure.reason
  const headers = "http" in reason ? reason.http?.response?.headers : undefined
  return {
    ...(failure.retryAfterMs === undefined ? {} : { retryAfterMs: failure.retryAfterMs }),
    ...(headers === undefined
      ? {}
      : {
          headers: Object.fromEntries(
            Object.entries(headers).flatMap(([key, value]) =>
              typeof value === "string" ? [[key.toLowerCase(), value]] : [],
            ),
          ),
        }),
  }
}

export const canRetry = (additionalAttempt: number) =>
  additionalAttempt >= 1 && additionalAttempt <= MAX_ADDITIONAL_ATTEMPTS

export const sanitize = (value: string, secrets: ReadonlyArray<string> = []) => {
  const redacted = secrets.filter(Boolean).reduce((text, item) => text.replaceAll(item, "<redacted>"), value)
  const normalized = redacted
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(JSON_SECRET, '"credential":"<redacted>"')
    .replace(AUTH, "credential <redacted>")
    .replace(ASSIGNED_SECRET, "credential=<redacted>")
    .replace(/\s+/g, " ")
    .trim()
  const bytes = new TextEncoder().encode(normalized)
  if (bytes.byteLength <= 512) return normalized
  const decoder = new TextDecoder("utf-8", { fatal: false })
  return decoder.decode(bytes.slice(0, 512)).replace(/\uFFFD$/u, "")
}
