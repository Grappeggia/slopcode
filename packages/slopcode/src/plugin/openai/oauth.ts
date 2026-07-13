import type { Auth } from "@/auth"

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
const ISSUER = "https://auth.openai.com"

export interface TokenResponse {
  id_token?: string
  access_token: string
  refresh_token?: string
  expires_in?: number
}

export interface IdTokenClaims {
  chatgpt_account_id?: string
  organizations?: Array<{ id: string }>
  email?: string
  "https://api.openai.com/auth"?: {
    chatgpt_account_id?: string
  }
}

export type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const pending = new Map<string, Promise<{ auth: Auth.Oauth; claims: IdTokenClaims | undefined }>>()

export function parseJwtClaims(token: string): IdTokenClaims | undefined {
  const parts = token.split(".")
  if (parts.length !== 3) return undefined
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString())
  } catch {
    return undefined
  }
}

export function extractAccountIdFromClaims(claims: IdTokenClaims): string | undefined {
  return (
    claims.chatgpt_account_id ||
    claims["https://api.openai.com/auth"]?.chatgpt_account_id ||
    claims.organizations?.[0]?.id
  )
}

export function extractAccountId(tokens: TokenResponse): string | undefined {
  if (tokens.id_token) {
    const claims = parseJwtClaims(tokens.id_token)
    const account = claims && extractAccountIdFromClaims(claims)
    if (account) return account
  }
  if (!tokens.access_token) return
  const claims = parseJwtClaims(tokens.access_token)
  return claims ? extractAccountIdFromClaims(claims) : undefined
}

export async function refreshAccessToken(refresh: string, issuer = ISSUER, request: Fetch = fetch) {
  const response = await request(`${issuer}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: CLIENT_ID,
    }).toString(),
  })
  if (!response.ok) throw new Error(`Token refresh failed: ${response.status}`)
  const tokens = (await response.json()) as Partial<TokenResponse>
  if (typeof tokens.access_token !== "string" || !tokens.access_token)
    throw new Error("Token refresh missing access token")
  return tokens as TokenResponse
}

export async function refreshAuth(
  auth: Auth.Oauth,
  persist: (auth: Auth.Oauth) => Promise<void>,
  options: { issuer?: string; fetch?: Fetch } = {},
) {
  const current = pending.get(auth.refresh)
  if (current) return current
  const result = refreshAccessToken(auth.refresh, options.issuer, options.fetch).then(async (tokens) => {
    const accountId = extractAccountId(tokens) || auth.accountId
    const next: Auth.Oauth = {
      type: "oauth",
      refresh: tokens.refresh_token || auth.refresh,
      access: tokens.access_token,
      expires: Date.now() + (tokens.expires_in ?? 3600) * 1000,
      ...(accountId && { accountId }),
    }
    await persist(next)
    return {
      auth: next,
      claims: (tokens.id_token ? parseJwtClaims(tokens.id_token) : undefined) ?? parseJwtClaims(tokens.access_token),
    }
  })
  const shared = result.finally(() => pending.delete(auth.refresh))
  pending.set(auth.refresh, shared)
  return shared
}
