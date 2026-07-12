export * as MCPOAuthProvider from "./oauth-provider"

import type { OAuthClientProvider, OAuthDiscoveryState } from "@modelcontextprotocol/sdk/client/auth.js"
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js"
import { Effect } from "effect"
import type { ConfigMCP } from "../config/mcp"
import type { MCPOAuthStore } from "./oauth-store"
import { createHash } from "node:crypto"

export function make(input: {
  readonly store: MCPOAuthStore.Interface
  readonly target: MCPOAuthStore.Target
  readonly attemptID: string
  readonly state: string
  readonly redirectUrl: string
  readonly config: typeof ConfigMCP.OAuth.Type
  readonly onRedirect: (url: URL) => Promise<void>
  readonly now?: () => number
  readonly transient?: boolean
  readonly compatibility?: string
  readonly saveTokens?: (tokens: OAuthTokens) => Promise<void>
  readonly interactive?: boolean
}): OAuthClientProvider {
  const run = <A>(effect: Effect.Effect<A, MCPOAuthStore.StoreError>) => Effect.runPromise(effect)
  const now = input.now ?? (() => Date.now() / 1000)
  return {
    redirectUrl: input.redirectUrl,
    clientMetadata: {
      redirect_uris: [input.redirectUrl],
      client_name: "SlopCode",
      client_uri: "https://slopcode.ai",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: input.config.client_secret ? "client_secret_post" : "none",
      ...(input.config.scope ? { scope: input.config.scope } : {}),
    } satisfies OAuthClientMetadata,
    state: () => input.state,
    clientInformation: async () => {
      if (input.config.client_id)
        return {
          client_id: input.config.client_id,
          ...(input.config.client_secret === undefined ? {} : { client_secret: input.config.client_secret }),
        }
      const entry = await run(input.store.get(input.target))
      const client = entry.compatibility === input.compatibility ? entry.client : undefined
      if (!client) return undefined
      const expiry = client.client_secret_expires_at
      if (expiry !== undefined && Number.isFinite(expiry) && expiry > 0 && expiry <= now()) return undefined
      return client
    },
    saveClientInformation: (client: OAuthClientInformationMixed) =>
      run(
        input.store.update(input.target, (entry) => ({
          ...entry,
          client,
          ...(input.compatibility ? { compatibility: input.compatibility } : {}),
        })),
      ).then(() => undefined),
    tokens: async () => {
      const entry = await run(input.store.get(input.target))
      const tokens = entry.compatibility === input.compatibility ? entry.tokens : undefined
      if (!tokens) return undefined
      return {
        access_token: tokens.access_token,
        token_type: tokens.token_type,
        ...(tokens.refresh_token === undefined ? {} : { refresh_token: tokens.refresh_token }),
        ...(tokens.scope === undefined ? {} : { scope: tokens.scope }),
        ...(tokens.id_token === undefined ? {} : { id_token: tokens.id_token }),
        ...(tokens.expires_at === undefined ? {} : { expires_in: Math.max(0, Math.floor(tokens.expires_at - now())) }),
      } satisfies OAuthTokens
    },
    saveTokens: (tokens) =>
      input.saveTokens
        ? input.saveTokens(tokens)
        : run(input.store.saveTokens(input.target, tokens, now())).then(() =>
        run(
          input.store.update(input.target, (entry) => ({
            ...entry,
            ...(input.compatibility ? { compatibility: input.compatibility } : {}),
          })),
        ).then(() => undefined),
      ),
    redirectToAuthorization: (url) => input.interactive === false ? Promise.reject(new Error("MCP OAuth interaction is unavailable")) : input.onRedirect(url),
    saveCodeVerifier: (verifier) =>
      input.transient === false
        ? Promise.resolve()
        : run(
            input.store.update(input.target, (entry) => ({
              ...entry,
              attempts: { ...entry.attempts, [input.attemptID]: { ...entry.attempts?.[input.attemptID], verifier } },
            })),
          ).then(() => undefined),
    codeVerifier: async () => {
      if (input.transient === false) throw new Error("MCP OAuth verifier is unavailable")
      const verifier = (await run(input.store.get(input.target))).attempts?.[input.attemptID]?.verifier
      if (!verifier) throw new Error("MCP OAuth verifier is unavailable")
      return verifier
    },
    discoveryState: () => run(input.store.get(input.target)).then((entry) => entry.discovery),
    saveDiscoveryState: (discovery: OAuthDiscoveryState) =>
      run(input.store.update(input.target, (entry) => ({ ...entry, discovery }))).then(() => undefined),
    invalidateCredentials: (scope) => run(input.store.invalidate(input.target, scope, input.attemptID)),
  }
}

export function connect(input: {
  readonly entry: MCPOAuthStore.Entry
  readonly config: typeof ConfigMCP.OAuth.Type
  readonly compatibility: string
  readonly now?: () => number
}): OAuthClientProvider {
  const now = input.now ?? (() => Date.now() / 1000)
  const client = input.config.client_id
    ? {
        client_id: input.config.client_id,
        ...(input.config.client_secret === undefined ? {} : { client_secret: input.config.client_secret }),
      }
    : input.entry.compatibility === input.compatibility
      ? input.entry.client
      : undefined
  const tokens = input.entry.compatibility === input.compatibility ? input.entry.tokens : undefined
  return {
    redirectUrl: undefined,
    clientMetadata: {
      redirect_uris: [],
      client_name: "SlopCode",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: input.config.client_secret ? "client_secret_post" : "none",
      ...(input.config.scope ? { scope: input.config.scope } : {}),
    },
    clientInformation: () => client,
    tokens: () =>
      tokens && {
        access_token: tokens.access_token,
        token_type: tokens.token_type,
        ...(tokens.refresh_token === undefined ? {} : { refresh_token: tokens.refresh_token }),
        ...(tokens.scope === undefined ? {} : { scope: tokens.scope }),
        ...(tokens.id_token === undefined ? {} : { id_token: tokens.id_token }),
        ...(tokens.expires_at === undefined ? {} : { expires_in: Math.max(0, Math.floor(tokens.expires_at - now())) }),
      },
    saveTokens: () => undefined,
    redirectToAuthorization: () => Promise.reject(new Error("MCP OAuth interaction is unavailable")),
    saveCodeVerifier: () => Promise.reject(new Error("MCP OAuth interaction is unavailable")),
    codeVerifier: () => Promise.reject(new Error("MCP OAuth interaction is unavailable")),
    discoveryState: () => input.entry.discovery,
  }
}

export function compatibility(endpoint: string, config: typeof ConfigMCP.OAuth.Type, redirectUrl: string) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        endpoint,
        config.client_id ?? null,
        config.client_secret ?? null,
        config.scope ?? null,
        redirectUrl,
      ]),
    )
    .digest("hex")
}
