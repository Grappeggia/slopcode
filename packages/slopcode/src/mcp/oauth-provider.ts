import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js"
import type {
  OAuthClientMetadata,
  OAuthTokens,
  OAuthClientInformation,
  OAuthClientInformationFull,
} from "@modelcontextprotocol/sdk/shared/auth.js"
import { isLoopbackUrl } from "@slopcode-ai/core/util/url"
import { Effect } from "effect"
import { McpAuth } from "./auth"

const OAUTH_CALLBACK_PORT = 19876
const OAUTH_CALLBACK_PATH = "/mcp/oauth/callback"
const REDIRECT_ERROR = "MCP OAuth redirect URI must be a loopback HTTP URL without credentials or a fragment"

function parseRedirectUrl(value: string) {
  const url = (() => {
    try {
      return new URL(value)
    } catch {
      throw new TypeError(REDIRECT_ERROR)
    }
  })()
  if (
    url.protocol !== "http:" ||
    !isLoopbackUrl(url.toString()) ||
    url.hostname === "0.0.0.0" ||
    url.username ||
    url.password ||
    url.hash ||
    url.port === "0"
  ) {
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
  private initialized = false

  constructor(
    private identity: McpAuth.Identity,
    serverUrl: string,
    private config: McpOAuthConfig,
    private callbacks: McpOAuthCallbacks,
    private auth: McpAuth.Interface,
    private flow?: string,
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
      client_uri: "https://slopcode.dev",
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
    await Effect.runPromise(
      this.auth.updateTokens(this.identity, this.serverUrl, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_in !== undefined ? Date.now() / 1000 + tokens.expires_in : undefined,
        scope: tokens.scope,
      }),
    )
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    await this.callbacks.onRedirect(authorizationUrl)
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    const state = await this.state()
    await Effect.runPromise(this.auth.updateCodeVerifier(this.identity, this.serverUrl, state, codeVerifier))
  }

  async codeVerifier(): Promise<string> {
    if (!this.flow) throw new Error("No code verifier is available")
    const verifier = await Effect.runPromise(this.auth.getCodeVerifier(this.identity, this.serverUrl, this.flow))
    if (!verifier) throw new Error("No PKCE code verifier is available")
    return verifier
  }

  async saveState(state: string): Promise<void> {
    if (this.flow !== state) this.initialized = false
    this.flow = state
    await this.state()
  }

  async state(): Promise<string> {
    this.flow ??= Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    if (this.initialized) return this.flow
    await Effect.runPromise(this.auth.startFlow(this.identity, this.serverUrl, this.flow))
    this.initialized = true
    return this.flow
  }

  currentState() {
    return this.flow
  }

  async invalidateCredentials(type: "all" | "client" | "tokens" | "verifier" | "discovery"): Promise<void> {
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
      case "verifier":
        if (this.flow) await Effect.runPromise(this.auth.clearFlow(this.identity, this.serverUrl, this.flow))
        break
      case "discovery":
        break
    }
  }
}

export { OAUTH_CALLBACK_PORT, OAUTH_CALLBACK_PATH }

/**
 * Parse a redirect URI to extract port and path for the callback server.
 */
export function parseRedirectUri(value?: string): { host: string; port: number; path: string } {
  if (!value) {
    return { host: "127.0.0.1", port: OAUTH_CALLBACK_PORT, path: OAUTH_CALLBACK_PATH }
  }

  const url = parseRedirectUrl(value)
  const host = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
  const port = url.port ? parseInt(url.port, 10) : 80
  const path = url.pathname || OAUTH_CALLBACK_PATH
  return { host, port, path }
}
