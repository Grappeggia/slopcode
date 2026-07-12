export * as MCPOAuthStore from "./oauth-store"

import path from "node:path"
import { randomBytes } from "node:crypto"
import fs from "node:fs/promises"
import type { OAuthDiscoveryState } from "@modelcontextprotocol/sdk/client/auth.js"
import type { OAuthClientInformationMixed, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js"
import { Context, Effect, Layer, Schema } from "effect"
import { Global } from "../global"
import type { WorkspaceV2 } from "../workspace"
import { Flock } from "../util/flock"

const DIRECTORY = "mcp-oauth"
const FILE = "store.json"
const URL_ERROR = "MCP OAuth endpoint is invalid"

export type Target = {
  readonly directory: string
  readonly workspaceID?: WorkspaceV2.ID
  readonly name: string
  readonly endpoint: string
}

export type Attempt = {
  readonly state?: string
  readonly verifier?: string
  readonly code?: string
  readonly mode?: "auto" | "manual"
  readonly redirect?: string
  readonly created?: number
  readonly expires?: number
  readonly phase?: "pending" | "received" | "exchanging" | "complete" | "cancelled" | "expired" | "failed"
  readonly error?: string
}

export type Tokens = OAuthTokens & { readonly expires_at?: number }
export type Entry = {
  readonly tokens?: Tokens
  readonly client?: OAuthClientInformationMixed
  readonly discovery?: OAuthDiscoveryState
  readonly compatibility?: string
  readonly attempts?: Readonly<Record<string, Attempt>>
  readonly claim?: string
}

type Bucket = {
  readonly identity: {
    readonly directory: string
    readonly workspaceID?: string
    readonly name: string
    readonly endpoint: string
  }
  readonly entry: Entry
}

type Data = { readonly version: 1; readonly buckets: Readonly<Record<string, Bucket>> }

export class StoreError extends Schema.TaggedErrorClass<StoreError>()("MCP.OAuthStoreError", {
  code: Schema.Literals(["invalid", "unsafe", "io"]),
  message: Schema.String,
}) {}

export interface Interface {
  readonly get: (target: Target) => Effect.Effect<Entry, StoreError>
  readonly update: (target: Target, change: (entry: Entry) => Entry) => Effect.Effect<Entry, StoreError>
  readonly remove: (target: Target) => Effect.Effect<void, StoreError>
  readonly saveTokens: (target: Target, tokens: OAuthTokens, now?: number) => Effect.Effect<void, StoreError>
  readonly invalidate: (
    target: Target,
    scope: "all" | "client" | "tokens" | "verifier" | "discovery",
    attemptID?: string,
  ) => Effect.Effect<void, StoreError>
  readonly findAttempt: (
    attemptID: string,
  ) => Effect.Effect<{ readonly target: Target; readonly attempt: Attempt } | undefined, StoreError>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/MCPOAuthStore") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const global = yield* Global.Service
    return Service.of(make({ data: global.data, legacy: path.join(global.data, "mcp-auth.json") }))
  }),
)

export function normalizeEndpoint(value: string) {
  const url = (() => {
    try {
      return new URL(value)
    } catch {
      throw new TypeError(URL_ERROR)
    }
  })()
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new TypeError(URL_ERROR)
  return url.toString()
}

export function make(input: { readonly data: string; readonly legacy?: string }): Interface {
  const dir = path.join(input.data, DIRECTORY)
  const file = path.join(dir, FILE)
  const lock = `mcp-oauth:${file}`
  const identity = (target: Target) => ({
    directory: target.directory,
    ...(target.workspaceID === undefined ? {} : { workspaceID: target.workspaceID }),
    name: target.name,
    endpoint: normalizeEndpoint(target.endpoint),
  })
  const key = (target: Target) => JSON.stringify(Object.values(identity(target)))

  const ensure = async () => {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 })
    const info = await fs.lstat(dir)
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new StoreError({ code: "unsafe", message: "MCP OAuth store path is unsafe" })
    await fs.chmod(dir, 0o700)
  }

  const read = async (): Promise<Data> => {
    await ensure()
    const info = await fs.lstat(file).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined
      throw error
    })
    if (!info) return { version: 1, buckets: {} }
    if (!info.isFile() || info.isSymbolicLink())
      throw new StoreError({ code: "unsafe", message: "MCP OAuth store file is unsafe" })
    await fs.chmod(file, 0o600)
    const raw: unknown = JSON.parse(await fs.readFile(file, "utf8"))
    if (!validData(raw)) throw new StoreError({ code: "invalid", message: "MCP OAuth store data is invalid" })
    return raw
  }

  const write = async (data: Data) => {
    await ensure()
    const temp = path.join(dir, `.store.${process.pid}.${randomBytes(16).toString("hex")}.tmp`)
    const handle = await fs.open(temp, "wx", 0o600)
    try {
      await handle.writeFile(JSON.stringify(data))
      await handle.sync()
    } finally {
      await handle.close()
    }
    try {
      await fs.chmod(temp, 0o600)
      await fs.rename(temp, file)
      const owner = await fs.open(dir, "r")
      await owner.sync().finally(() => owner.close())
    } finally {
      await fs.rm(temp, { force: true })
    }
  }

  const transact = <A>(run: (data: Data) => Promise<{ data?: Data; value: A }>) =>
    Effect.tryPromise({
      try: (signal) =>
        Flock.withLock(
          lock,
          async () => {
            const result = await run(await read())
            if (result.data) await write(result.data)
            return result.value
          },
          { signal, dir: path.join(input.data, ".mcp-oauth-locks") },
        ),
      catch: (cause) =>
        cause instanceof StoreError
          ? cause
          : new StoreError({
              code: cause instanceof SyntaxError ? "invalid" : "io",
              message: "MCP OAuth store operation failed",
            }),
    })

  const update: Interface["update"] = (target, change) =>
    transact(async (data) => {
      const id = identity(target)
      const name = key(target)
      const entry = change(data.buckets[name]?.entry ?? {})
      return { data: { version: 1, buckets: { ...data.buckets, [name]: { identity: id, entry } } }, value: entry }
    })

  const get: Interface["get"] = (target) =>
    transact(async (data) => {
      const name = key(target)
      const current = data.buckets[name]?.entry
      if (current || target.workspaceID !== undefined || !input.legacy) return { value: current ?? {} }
      const claimed = await legacy(input.legacy, identity(target))
      if (!claimed) return { value: {} }
      const entry = { ...claimed, claim: "v1-version-2" }
      return {
        data: { version: 1, buckets: { ...data.buckets, [name]: { identity: identity(target), entry } } },
        value: entry,
      }
    })

  const remove: Interface["remove"] = (target) =>
    transact(async (data) => {
      const buckets = { ...data.buckets }
      delete buckets[key(target)]
      return { data: { version: 1, buckets }, value: undefined }
    })

  const saveTokens: Interface["saveTokens"] = (target, tokens, now = Date.now() / 1000) =>
    update(target, (entry) => ({
      ...entry,
      tokens: {
        ...tokens,
        ...(tokens.refresh_token === undefined && entry.tokens?.refresh_token
          ? { refresh_token: entry.tokens.refresh_token }
          : {}),
        ...(tokens.scope === undefined && entry.tokens?.scope ? { scope: entry.tokens.scope } : {}),
        ...(tokens.expires_in === undefined ? {} : { expires_at: now + tokens.expires_in }),
      },
    })).pipe(Effect.asVoid)

  const invalidate: Interface["invalidate"] = (target, scope, attemptID) =>
    update(target, (entry) => {
      const attempts = { ...entry.attempts }
      if (attemptID && (scope === "all" || scope === "verifier")) {
        const attempt = { ...attempts[attemptID] }
        delete attempt.verifier
        if (scope === "all") {
          delete attempt.state
          delete attempt.code
        }
        if (Object.keys(attempt).length) attempts[attemptID] = attempt
        else delete attempts[attemptID]
      }
      if (scope === "tokens") return { ...entry, tokens: undefined }
      if (scope === "client") return { ...entry, client: undefined }
      if (scope === "discovery") return { ...entry, discovery: undefined }
      if (scope === "verifier") return { ...entry, attempts }
      return { attempts }
    }).pipe(Effect.asVoid)

  const findAttempt: Interface["findAttempt"] = (attemptID) =>
    transact(async (data) => {
      const found = Object.values(data.buckets).find((bucket) => bucket.entry.attempts?.[attemptID])
      return {
        value: found
          ? {
              target: {
                directory: found.identity.directory,
                ...(found.identity.workspaceID === undefined
                  ? {}
                  : { workspaceID: found.identity.workspaceID as WorkspaceV2.ID }),
                name: found.identity.name,
                endpoint: found.identity.endpoint,
              },
              attempt: found.entry.attempts![attemptID]!,
            }
          : undefined,
      }
    })

  return { get, update, remove, saveTokens, invalidate, findAttempt }
}

function web(value: unknown) {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      !url.hash
    )
  } catch {
    return false
  }
}

function finite(value: unknown) {
  return value === undefined || (typeof value === "number" && Number.isFinite(value))
}

function validData(value: unknown): value is Data {
  if (!record(value) || value.version !== 1 || !record(value.buckets)) return false
  return Object.values(value.buckets).every((candidate) => {
    if (!record(candidate) || !record(candidate.identity) || !record(candidate.entry)) return false
    const id = candidate.identity
    if (typeof id.directory !== "string" || typeof id.name !== "string" || !web(id.endpoint)) return false
    if (id.workspaceID !== undefined && typeof id.workspaceID !== "string") return false
    const entry = candidate.entry
    if (entry.tokens !== undefined) {
      if (
        !record(entry.tokens) ||
        typeof entry.tokens.access_token !== "string" ||
        typeof entry.tokens.token_type !== "string"
      )
        return false
      if (!finite(entry.tokens.expires_in) || !finite(entry.tokens.expires_at)) return false
    }
    if (entry.client !== undefined && (!record(entry.client) || typeof entry.client.client_id !== "string"))
      return false
    if (entry.discovery !== undefined) {
      if (!record(entry.discovery) || !web(entry.discovery.authorizationServerUrl)) return false
      for (const field of ["resourceMetadataUrl"])
        if (entry.discovery[field] !== undefined && !web(entry.discovery[field])) return false
      const metadata = entry.discovery.authorizationServerMetadata
      if (
        metadata !== undefined &&
        (!record(metadata) || !web(metadata.authorization_endpoint) || !web(metadata.token_endpoint))
      )
        return false
    }
    if (entry.attempts !== undefined && !record(entry.attempts)) return false
    return true
  })
}

async function legacy(file: string, target: ReturnType<typeof legacyIdentity>): Promise<Entry | undefined> {
  const raw: unknown = await fs
    .readFile(file, "utf8")
    .then(JSON.parse)
    .catch(() => undefined)
  if (!record(raw) || raw.version !== 2 || !record(raw.entries)) return
  const matches = Object.values(raw.entries).filter((value) => {
    if (!record(value) || !record(value.identity) || !record(value.servers)) return false
    return value.identity.instance === target.directory && value.identity.name === target.name
  })
  if (matches.length !== 1) return
  const source = (matches[0] as { servers: Record<string, unknown> }).servers[target.endpoint]
  if (!record(source)) return
  const tokens = record(source.tokens)
    ? {
        access_token: source.tokens.accessToken,
        token_type: "Bearer",
        refresh_token: source.tokens.refreshToken,
        scope: source.tokens.scope,
        ...(finite(source.tokens.expiresAt) && source.tokens.expiresAt !== undefined
          ? { expires_at: source.tokens.expiresAt }
          : {}),
      }
    : undefined
  const client = record(source.clientInfo)
    ? {
        client_id: source.clientInfo.clientId,
        client_secret: source.clientInfo.clientSecret,
        client_id_issued_at: source.clientInfo.clientIdIssuedAt,
        client_secret_expires_at: source.clientInfo.clientSecretExpiresAt,
      }
    : undefined
  if (
    tokens &&
    (typeof tokens.access_token !== "string" ||
      (tokens.refresh_token !== undefined && typeof tokens.refresh_token !== "string"))
  )
    return
  if (
    client &&
    (typeof client.client_id !== "string" ||
      (client.client_secret !== undefined && typeof client.client_secret !== "string"))
  )
    return
  if (!tokens && !client) return
  return {
    ...(tokens ? { tokens: tokens as Tokens } : {}),
    ...(client ? { client: client as OAuthClientInformationMixed } : {}),
  }
}

function legacyIdentity(target: Target) {
  return { directory: target.directory, name: target.name, endpoint: normalizeEndpoint(target.endpoint) }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
