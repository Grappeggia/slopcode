import type { Auth } from "@/auth"
import { InstallationVersion } from "@slopcode-ai/core/installation/version"
import { Schema } from "effect"
import os from "os"
import { parseJwtClaims, refreshAuth, type Fetch } from "./oauth"

const ENDPOINT = "https://chatgpt.com/backend-api/wham/usage"

export const Window = Schema.Struct({
  usedPercent: Schema.Finite,
  windowMinutes: Schema.optional(Schema.Finite),
  resetAt: Schema.optional(Schema.Finite),
})

export const Credits = Schema.Struct({
  hasCredits: Schema.Boolean,
  unlimited: Schema.Boolean,
  balance: Schema.optional(Schema.String),
})

export const Spend = Schema.Struct({
  limit: Schema.String,
  used: Schema.String,
  remainingPercent: Schema.Finite,
  resetAt: Schema.optional(Schema.Finite),
})

export const Usage = Schema.Union([
  Schema.Struct({ status: Schema.Literal("disconnected") }),
  Schema.Struct({ status: Schema.Literal("api_key") }),
  Schema.Struct({ status: Schema.Literal("unavailable") }),
  Schema.Struct({
    status: Schema.Literal("oauth"),
    plan: Schema.String,
    email: Schema.optional(Schema.String),
    primary: Schema.optional(Window),
    secondary: Schema.optional(Window),
    credits: Schema.optional(Credits),
    spend: Schema.optional(Spend),
    capturedAt: Schema.Finite,
  }),
]).annotate({ identifier: "OpenAIUsage" })
export type Usage = Schema.Schema.Type<typeof Usage>

type RecordValue = Record<string, unknown>

function record(input: unknown): RecordValue | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return
  return input as RecordValue
}

function number(input: unknown) {
  if (typeof input === "number" && Number.isFinite(input)) return input
  if (typeof input !== "string" || !input.trim()) return
  const value = Number(input)
  return Number.isFinite(value) ? value : undefined
}

function money(input: unknown) {
  if (typeof input !== "string") return
  const value = input.trim()
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return
  return Number.isFinite(Number(value)) ? value : undefined
}

function window(input: unknown) {
  const value = record(input)
  if (!value) return
  const usedPercent = number(value.used_percent)
  const seconds = number(value.limit_window_seconds)
  const resetAt = number(value.reset_at)
  if (usedPercent === undefined) return
  return {
    usedPercent,
    ...(seconds !== undefined && { windowMinutes: seconds / 60 }),
    ...(resetAt !== undefined && { resetAt }),
  }
}

export function normalizeUsage(input: unknown, email?: string, capturedAt = Date.now()): Usage | undefined {
  const value = record(input)
  if (!value || typeof value.plan_type !== "string") return
  const rate = record(value.rate_limit)
  const credit = record(value.credits)
  const control =
    record(record(value.spend_control)?.individual_limit) ??
    record(value.individual_monthly_spend_control) ??
    record(value.individual_monthly_spend)
  const limit = money(control?.limit) ?? money(control?.monthly_limit)
  const used = money(control?.used) ?? money(control?.monthly_used)
  const remaining =
    number(control?.remaining_percent) ??
    number(
      limit !== undefined && used !== undefined && Number(limit) !== 0
        ? ((Number(limit) - Number(used)) / Number(limit)) * 100
        : undefined,
    )
  const primary = window(rate?.primary_window)
  const secondary = window(rate?.secondary_window)
  const balance = money(credit?.balance)
  return {
    status: "oauth",
    plan: value.plan_type,
    ...(email && { email }),
    ...(primary && { primary }),
    ...(secondary && { secondary }),
    ...(credit &&
      typeof credit.has_credits === "boolean" &&
      typeof credit.unlimited === "boolean" && {
        credits: {
          hasCredits: credit.has_credits,
          unlimited: credit.unlimited,
          ...(balance !== undefined && { balance }),
        },
      }),
    ...(limit !== undefined && used !== undefined && remaining !== undefined
      ? {
          spend: {
            limit,
            used,
            remainingPercent: remaining,
            ...(number(control?.reset_at) !== undefined && { resetAt: number(control?.reset_at) }),
          },
        }
      : {}),
    capturedAt,
  }
}

export async function getUsage(
  auth: Auth.Info | undefined,
  persist: (auth: Auth.Oauth) => Promise<void>,
  options: { fetch?: Fetch; endpoint?: string; issuer?: string; now?: () => number } = {},
): Promise<Usage> {
  if (!auth) return { status: "disconnected" }
  if (auth.type === "api") return { status: "api_key" }
  if (auth.type !== "oauth") return { status: "unavailable" }
  const request = options.fetch ?? fetch
  const now = options.now ?? Date.now
  try {
    const current =
      !auth.access || auth.expires < now()
        ? await refreshAuth(auth, persist, { issuer: options.issuer, fetch: request })
        : { auth, claims: parseJwtClaims(auth.access) }
    const response = await request(options.endpoint ?? ENDPOINT, {
      headers: {
        authorization: `Bearer ${current.auth.access}`,
        ...(current.auth.accountId && { "ChatGPT-Account-Id": current.auth.accountId }),
        "User-Agent": `slopcode/${InstallationVersion} (${os.platform()} ${os.release()}; ${os.arch()})`,
        originator: "slopcode",
      },
    })
    if (!response.ok) return { status: "unavailable" }
    return (
      normalizeUsage(
        await response.json(),
        typeof current.claims?.email === "string" ? current.claims.email : undefined,
        now(),
      ) ?? { status: "unavailable" }
    )
  } catch {
    return { status: "unavailable" }
  }
}
