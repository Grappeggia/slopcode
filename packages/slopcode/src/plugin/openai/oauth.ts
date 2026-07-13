import type { Auth } from "@/auth"
import {
  extractAccountID,
  extractAccountIDFromClaims,
  parseJwtClaims,
  refreshAccessToken as refreshToken,
  refreshOAuth,
  type Claims,
  type Fetch,
  type TokenResponse,
} from "@slopcode-ai/core/plugin/provider/openai-usage"

export { parseJwtClaims }
export type { Fetch, TokenResponse }
export type IdTokenClaims = Claims

export const extractAccountIdFromClaims = extractAccountIDFromClaims
export const extractAccountId = extractAccountID

export function refreshAccessToken(refresh: string, issuer?: string, request?: Fetch) {
  return refreshToken(refresh, { issuer, fetch: request })
}

export async function refreshAuth(
  auth: Auth.Oauth,
  persist: (auth: Auth.Oauth) => Promise<void>,
  options: { issuer?: string; fetch?: Fetch } = {},
) {
  const result = await refreshOAuth(
    {
      type: "oauth",
      refresh: auth.refresh,
      access: auth.access,
      expires: auth.expires,
      ...(auth.accountId && { accountID: auth.accountId }),
    },
    options,
  )
  const next: Auth.Oauth = {
    type: "oauth",
    refresh: result.auth.refresh,
    access: result.auth.access,
    expires: result.auth.expires,
    ...(result.auth.accountID && { accountId: result.auth.accountID }),
  }
  await persist(next)
  return { auth: next, claims: result.claims }
}
