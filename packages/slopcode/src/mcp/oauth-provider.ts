import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js"
import type {
  OAuthClientMetadata,
  OAuthTokens,
  OAuthClientInformation,
  OAuthClientInformationFull,
} from "@modelcontextprotocol/sdk/shared/auth.js"
import { Effect } from "effect"
import { McpAuth } from "./auth"

const OAUTH_CALLBACK_PORT = 19876
const OAUTH_CALLBACK_PATH = "/mcp/oauth/callback"
const REDIRECT_ERROR = "MCP OAuth redirect URI must be an HTTP(S) URL without a fragment"

function parseRedirectUrl(value: string) {
  const url = (() => {
    try {
      return new URL(value)
    } catch {
      throw new TypeError(REDIRECT_ERROR)
    }
  })()
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname || url.hash) {
    throw new TypeError(REDIRECT_ERROR)
  }
  return url
}

export interface McpOAuthConfig {
  clientId?: string
  clientSecret?: string
  scope?: string
  callbackPort?: number
  redirectUri?: string
}

export interface McpOAuthCallbacks {
  onRedirect: (url: URL) => void | Promise<void>
}

export class McpOAuthProvider implements OAuthClientProvider {
  private serverUrl: string

  constructor(
    private identity: McpAuth.Identity,
    serverUrl: string,
    private config: McpOAuthConfig,
    private callbacks: McpOAuthCallbacks,
    private auth: McpAuth.Interface,
  ) {
    this.serverUrl = McpAuth.normalizeServerUrl(serverUrl)
  }

  get redirectUrl(): string {
    if (this.config.redirectUri) {
      parseRedirectUrl(this.config.redirectUri)
      return this.config.redirectUri
    }
    const port = this.config.callbackPort ?? OAUTH_CALLBACK_PORT
    return `http://127.0.0.1:${port}${OAUTH_CALLBACK_PATH}`
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      client_name: "SlopCode",
      client_uri: "https://slopcode.ai",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: this.config.clientSecret ? "client_secret_post" : "none",
      ...(this.config.scope ? { scope: this.config.scope } : {}),
    }
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    // Check config first (pre-registered client)
    if (this.config.clientId) {
      return {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }
    }

    // Check stored client info (from dynamic registration)
    const entry = await Effect.runPromise(this.auth.get(this.identity, this.serverUrl))
    if (entry?.clientInfo) {
      // Check if client secret has expired
      if (entry.clientInfo.clientSecretExpiresAt && entry.clientInfo.clientSecretExpiresAt < Date.now() / 1000) {
        return undefined
      }
      return {
        client_id: entry.clientInfo.clientId,
        client_secret: entry.clientInfo.clientSecret,
      }
    }

    // No client info or URL changed - will trigger dynamic registration
    return undefined
  }

  async saveClientInformation(info: OAuthClientInformationFull): Promise<void> {
    await Effect.runPromise(
      this.auth.updateClientInfo(this.identity, this.serverUrl, {
        clientId: info.client_id,
        clientSecret: info.client_secret,
        clientIdIssuedAt: info.client_id_issued_at,
        clientSecretExpiresAt: info.client_secret_expires_at,
      }),
    )
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const entry = await Effect.runPromise(this.auth.get(this.identity, this.serverUrl))
    if (!entry?.tokens) return undefined

    return {
      access_token: entry.tokens.accessToken,
      token_type: "Bearer",
      refresh_token: entry.tokens.refreshToken,
      expires_in:
        entry.tokens.expiresAt !== undefined
          ? Math.max(0, Math.floor(entry.tokens.expiresAt - Date.now() / 1000))
          : undefined,
      scope: entry.tokens.scope,
    }
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const existing = (await Effect.runPromise(this.auth.get(this.identity, this.serverUrl)))?.tokens
    await Effect.runPromise(
      this.auth.updateTokens(this.identity, this.serverUrl, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? existing?.refreshToken,
        expiresAt: tokens.expires_in !== undefined ? Date.now() / 1000 + tokens.expires_in : undefined,
        scope: tokens.scope ?? existing?.scope,
      }),
    )
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    await this.callbacks.onRedirect(authorizationUrl)
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await Effect.runPromise(this.auth.updateCodeVerifier(this.identity, this.serverUrl, codeVerifier))
  }

  async codeVerifier(): Promise<string> {
    const entry = await Effect.runPromise(this.auth.get(this.identity, this.serverUrl))
    if (!entry?.codeVerifier) {
      throw new Error(`No code verifier saved for MCP server: ${this.identity.name}`)
    }
    return entry.codeVerifier
  }

  async saveState(state: string): Promise<void> {
    await Effect.runPromise(this.auth.updateOAuthState(this.identity, this.serverUrl, state))
  }

  async state(): Promise<string> {
    const entry = await Effect.runPromise(this.auth.get(this.identity, this.serverUrl))
    if (entry?.oauthState) {
      return entry.oauthState
    }

    // Generate a new state if none exists — the SDK calls state() as a
    // generator, not just a reader, so we need to produce a value even when
    // startAuth() hasn't pre-saved one (e.g. during automatic auth on first
    // connect).
    const newState = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    await Effect.runPromise(this.auth.updateOAuthState(this.identity, this.serverUrl, newState))
    return newState
  }

  async invalidateCredentials(type: "all" | "client" | "tokens"): Promise<void> {
    switch (type) {
      case "all":
        await Effect.runPromise(this.auth.remove(this.identity, this.serverUrl))
        break
      case "client":
        await Effect.runPromise(this.auth.clearClientInfo(this.identity, this.serverUrl))
        break
      case "tokens":
        await Effect.runPromise(this.auth.clearTokens(this.identity, this.serverUrl))
        break
    }
  }
}

export { OAUTH_CALLBACK_PORT, OAUTH_CALLBACK_PATH }

/**
 * Parse a redirect URI to extract port and path for the callback server.
 */
export function parseRedirectUri(value?: string): { port: number; path: string } {
  if (!value) {
    return { port: OAUTH_CALLBACK_PORT, path: OAUTH_CALLBACK_PATH }
  }

  const url = parseRedirectUrl(value)
  const port = url.port ? parseInt(url.port, 10) : url.protocol === "https:" ? 443 : 80
  const path = url.pathname || OAUTH_CALLBACK_PATH
  return { port, path }
}
