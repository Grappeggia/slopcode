import os from "node:os"
import { Schema } from "effect"
import { InstallationVersion } from "../../installation/version"

const clientID = "app_EMoamEEZ73f0CkXaXp7hrann"
const issuer = "https://auth.openai.com"
const endpoint = "https://chatgpt.com/backend-api/wham/usage"
const timeout = 10_000

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

export interface TokenResponse {
  readonly id_token?: string
  readonly access_token: string
  readonly refresh_token?: string
  readonly expires_in?: number
}

export interface Claims {
  readonly chatgpt_account_id?: string
  readonly organizations?: ReadonlyArray<{ readonly id: string }>
  readonly email?: string
  readonly "https://api.openai.com/auth"?: { readonly chatgpt_account_id?: string }
}

export type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type OAuth = {
  readonly type: "oauth"
  readonly refresh: string
  readonly access: string
  readonly expires: number
  readonly accountID?: string
}

export type Credential = undefined | { readonly type: "key"; readonly key: string } | OAuth

export type Options = {
  readonly fetch?: Fetch
  readonly endpoint?: string
  readonly issuer?: string
  readonly now?: () => number
  readonly signal?: AbortSignal
  readonly timeout?: number
}

type RecordValue = Record<string, unknown>

type Pending = {
  readonly controller: AbortController
  readonly promise: Promise<TokenResponse>
  waiters: number
}

const pending = new Map<string, Pending>()

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

export function parseJwtClaims(token: string): Claims | undefined {
  const parts = token.split(".")
  if (parts.length !== 3) return
  try {
    return record(JSON.parse(Buffer.from(parts[1], "base64url").toString())) as Claims | undefined
  } catch {
    return
  }
}

export function extractAccountIDFromClaims(claims: Claims): string | undefined {
  return (
    claims.chatgpt_account_id ??
    claims["https://api.openai.com/auth"]?.chatgpt_account_id ??
    claims.organizations?.[0]?.id
  )
}

export function extractAccountID(tokens: TokenResponse): string | undefined {
  const id = tokens.id_token ? parseJwtClaims(tokens.id_token) : undefined
  const account = id && extractAccountIDFromClaims(id)
  if (account) return account
  const access = parseJwtClaims(tokens.access_token)
  return access ? extractAccountIDFromClaims(access) : undefined
}

function wait(entry: Pending, key: string, signal?: AbortSignal) {
  entry.waiters++
  return new Promise<TokenResponse>((resolve, reject) => {
    let active = true
    const finish = (done: () => void) => {
      if (!active) return
      active = false
      signal?.removeEventListener("abort", cancel)
      entry.waiters--
      done()
    }
    const cancel = () => {
      finish(() => reject(signal?.reason ?? new DOMException("The operation was aborted", "AbortError")))
      if (entry.waiters !== 0 || pending.get(key) !== entry) return
      pending.delete(key)
      entry.controller.abort()
    }
    if (signal) {
      signal.addEventListener("abort", cancel, { once: true })
      if (signal.aborted) {
        cancel()
        return
      }
    }
    void entry.promise.then(
      (tokens) => finish(() => resolve(tokens)),
      (cause) => finish(() => reject(cause)),
    )
  })
}

export function refreshAccessToken(refresh: string, options: Options = {}) {
  const base = options.issuer ?? issuer
  const key = `${base}\0${refresh}`
  const current = pending.get(key)
  if (current) return wait(current, key, options.signal)
  const request = options.fetch ?? fetch
  const controller = new AbortController()
  const promise = Promise.resolve()
    .then(() =>
      request(`${base}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": `slopcode/${InstallationVersion}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refresh,
          client_id: clientID,
        }).toString(),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(options.timeout ?? timeout)]),
      }),
    )
    .then(async (response) => {
      if (!response.ok) throw new Error(`Token refresh failed: ${response.status}`)
      const value = record(await response.json())
      if (!value || typeof value.access_token !== "string" || !value.access_token) {
        throw new Error("Token refresh missing access token")
      }
      return {
        access_token: value.access_token,
        ...(typeof value.id_token === "string" && { id_token: value.id_token }),
        ...(typeof value.refresh_token === "string" && { refresh_token: value.refresh_token }),
        ...(typeof value.expires_in === "number" &&
          Number.isFinite(value.expires_in) && { expires_in: value.expires_in }),
      }
    })
  const entry = { controller, promise, waiters: 0 }
  const clear = () => {
    if (pending.get(key) === entry) pending.delete(key)
  }
  pending.set(key, entry)
  void promise.then(clear, clear)
  return wait(entry, key, options.signal)
}

export async function refreshOAuth(auth: OAuth, options: Options = {}) {
  const tokens = await refreshAccessToken(auth.refresh, options)
  const claims = (tokens.id_token ? parseJwtClaims(tokens.id_token) : undefined) ?? parseJwtClaims(tokens.access_token)
  const accountID = extractAccountID(tokens) ?? auth.accountID
  return {
    auth: {
      type: "oauth" as const,
      refresh: tokens.refresh_token || auth.refresh,
      access: tokens.access_token,
      expires: (options.now ?? Date.now)() + (tokens.expires_in ?? 3600) * 1000,
      ...(accountID && { accountID }),
    },
    claims,
  }
}

export async function getUsage(
  credential: Credential,
  persist: (credential: OAuth) => Promise<void>,
  options: Options = {},
): Promise<Usage> {
  if (!credential) return { status: "disconnected" }
  if (credential.type === "key") return { status: "api_key" }
  const request = options.fetch ?? fetch
  const now = options.now ?? Date.now
  try {
    const current =
      !credential.access || credential.expires < now()
        ? await refreshOAuth(credential, options).then(async (result) => {
            await persist(result.auth)
            return result
          })
        : { auth: credential, claims: parseJwtClaims(credential.access) }
    const response = await request(options.endpoint ?? endpoint, {
      headers: {
        authorization: `Bearer ${current.auth.access}`,
        ...(current.auth.accountID && { "ChatGPT-Account-Id": current.auth.accountID }),
        "User-Agent": `slopcode/${InstallationVersion} (${os.platform()} ${os.release()}; ${os.arch()})`,
        originator: "slopcode",
      },
      signal: AbortSignal.timeout(options.timeout ?? timeout),
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
