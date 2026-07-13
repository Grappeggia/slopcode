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
  readonly authorization?: string
  readonly created?: number
  readonly expires?: number
  readonly phase?:
    | "initializing"
    | "pending"
    | "received"
    | "exchanging"
    | "complete"
    | "cancelled"
    | "expired"
    | "failed"
  readonly error?: string
}

export type AttemptResult =
  | { readonly status: "claimed"; readonly target: Target; readonly attempt: Attempt }
  | { readonly status: "cancelled"; readonly target: Target; readonly attempt: Attempt }
  | { readonly status: "missing" | "invalid" | "expired" | "used" }

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
  readonly claimLegacy: (
    target: Target,
    input: {
      readonly compatibility: string
      readonly clientID?: string
      readonly clientSecret?: string
      readonly scope?: string
    },
  ) => Effect.Effect<boolean, StoreError>
  readonly targets: (scope: Omit<Target, "endpoint">) => Effect.Effect<ReadonlyArray<Target>, StoreError>
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
  readonly claimAttempt: (
    attemptID: string,
    state: string,
    code: string,
    now: number,
  ) => Effect.Effect<AttemptResult, StoreError>
  readonly cancelAttempt: (attemptID: string) => Effect.Effect<AttemptResult, StoreError>
  readonly readyAttempt: (
    target: Target,
    attemptID: string,
    authorization: string,
  ) => Effect.Effect<Attempt | undefined, StoreError>
  readonly startExchange: (
    target: Target,
    attemptID: string,
    code: string,
  ) => Effect.Effect<Attempt | undefined, StoreError>
  readonly finishExchange: (
    target: Target,
    attemptID: string,
    tokens: OAuthTokens,
    now?: number,
  ) => Effect.Effect<{ readonly won: boolean; readonly cancelled: ReadonlyArray<string> }, StoreError>
  readonly finishAttempt: (
    target: Target,
    attemptID: string,
    phase: "expired" | "failed",
    error: string,
    expected?: ReadonlyArray<Attempt["phase"]>,
  ) => Effect.Effect<boolean, StoreError>
  readonly cancelTarget: (target: Target, invalidate?: boolean) => Effect.Effect<void, StoreError>
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
    if (!validData(data)) throw new StoreError({ code: "invalid", message: "MCP OAuth store data is invalid" })
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
      return { value: current ?? {} }
    })

  const claimLegacy: Interface["claimLegacy"] = (target, options) =>
    transact(async (data) => {
      const name = key(target)
      const current = data.buckets[name]?.entry
      if (current) return { value: current.claim === "v1-version-2" && current.compatibility === options.compatibility }
      if (target.workspaceID !== undefined || !input.legacy || !options.clientID) return { value: false }
      const claimed = await legacy(input.legacy, identity(target))
      if (
        !claimed?.tokens?.access_token ||
        !claimed.client ||
        claimed.client.client_id !== options.clientID ||
        claimed.client.client_secret !== options.clientSecret ||
        (options.scope !== undefined && claimed.tokens.scope !== options.scope)
      )
        return { value: false }
      const entry = { ...claimed, compatibility: options.compatibility, claim: "v1-version-2" as const }
      return {
        data: { version: 1, buckets: { ...data.buckets, [name]: { identity: identity(target), entry } } },
        value: true,
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
        const attempt = attempts[attemptID]
        if (attempt && ["initializing", "pending", "received", "exchanging"].includes(attempt.phase ?? ""))
          attempts[attemptID] = {
            mode: attempt.mode,
            redirect: attempt.redirect,
            created: attempt.created,
            expires: attempt.expires,
            phase: "cancelled",
          }
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

  const targets: Interface["targets"] = (scope) =>
    transact(async (data) => ({
      value: Object.values(data.buckets)
        .filter(
          (bucket) =>
            bucket.identity.directory === scope.directory &&
            bucket.identity.workspaceID === scope.workspaceID &&
            bucket.identity.name === scope.name,
        )
        .map(targetOf),
    }))

  const locate = (data: Data, attemptID: string) =>
    Object.entries(data.buckets).find(([, bucket]) => bucket.entry.attempts?.[attemptID])
  const targetOf = (bucket: Bucket): Target => ({
    directory: bucket.identity.directory,
    ...(bucket.identity.workspaceID === undefined
      ? {}
      : { workspaceID: bucket.identity.workspaceID as WorkspaceV2.ID }),
    name: bucket.identity.name,
    endpoint: bucket.identity.endpoint,
  })
  const ended = (attempt: Attempt, phase: "complete" | "cancelled" | "expired" | "failed", error?: string) => ({
    mode: attempt.mode,
    redirect: attempt.redirect,
    created: attempt.created,
    expires: attempt.expires,
    phase,
    ...(error ? { error } : {}),
  })

  const claimAttempt: Interface["claimAttempt"] = (attemptID, state, code, now) =>
    transact<AttemptResult>(async (data) => {
      const found = locate(data, attemptID)
      if (!found) return { value: { status: "missing" } as const }
      const [name, bucket] = found
      const attempt = bucket.entry.attempts![attemptID]!
      if (attempt.phase !== "pending") return { value: { status: "used" } as const }
      if (attempt.state !== state || !code) return { value: { status: "invalid" } as const }
      if (attempt.expires! <= now) {
        const attempts = { ...bucket.entry.attempts, [attemptID]: ended(attempt, "expired", "attempt-expired") }
        return {
          data: { ...data, buckets: { ...data.buckets, [name]: { ...bucket, entry: { ...bucket.entry, attempts } } } },
          value: { status: "expired" } as const,
        }
      }
      const claimed = { ...attempt, phase: "received" as const, code }
      const attempts = { ...bucket.entry.attempts, [attemptID]: claimed }
      return {
        data: { ...data, buckets: { ...data.buckets, [name]: { ...bucket, entry: { ...bucket.entry, attempts } } } },
        value: { status: "claimed", target: targetOf(bucket), attempt: claimed } as const,
      }
    })

  const readyAttempt: Interface["readyAttempt"] = (target, attemptID, authorization) =>
    transact(async (data) => {
      const name = key(target)
      const bucket = data.buckets[name]
      const attempt = bucket?.entry.attempts?.[attemptID]
      if (!bucket || attempt?.phase !== "initializing" || !attempt.verifier || !web(authorization))
        return { value: undefined }
      const pending = { ...attempt, authorization, phase: "pending" as const }
      return {
        data: {
          ...data,
          buckets: {
            ...data.buckets,
            [name]: {
              ...bucket,
              entry: { ...bucket.entry, attempts: { ...bucket.entry.attempts, [attemptID]: pending } },
            },
          },
        },
        value: pending,
      }
    })

  const cancelAttempt: Interface["cancelAttempt"] = (attemptID) =>
    transact<AttemptResult>(async (data) => {
      const found = locate(data, attemptID)
      if (!found) return { value: { status: "missing" } as const }
      const [name, bucket] = found
      const attempt = bucket.entry.attempts![attemptID]!
      if (attempt.phase !== "pending" && attempt.phase !== "initializing") return { value: { status: "used" } as const }
      const cancelled = ended(attempt, "cancelled")
      const attempts = { ...bucket.entry.attempts, [attemptID]: cancelled }
      return {
        data: { ...data, buckets: { ...data.buckets, [name]: { ...bucket, entry: { ...bucket.entry, attempts } } } },
        value: { status: "cancelled", target: targetOf(bucket), attempt: cancelled } as const,
      }
    })

  const startExchange: Interface["startExchange"] = (target, attemptID, code) =>
    transact(async (data) => {
      const name = key(target)
      const bucket = data.buckets[name]
      const attempt = bucket?.entry.attempts?.[attemptID]
      if (!bucket || attempt?.phase !== "received" || attempt.code !== code) return { value: undefined }
      const exchanging = { ...attempt, phase: "exchanging" as const }
      return {
        data: {
          ...data,
          buckets: {
            ...data.buckets,
            [name]: {
              ...bucket,
              entry: { ...bucket.entry, attempts: { ...bucket.entry.attempts, [attemptID]: exchanging } },
            },
          },
        },
        value: exchanging,
      }
    })

  const finishExchange: Interface["finishExchange"] = (target, attemptID, tokens, now = Date.now() / 1000) =>
    transact<{ readonly won: boolean; readonly cancelled: ReadonlyArray<string> }>(async (data) => {
      const name = key(target)
      const bucket = data.buckets[name]
      const attempt = bucket?.entry.attempts?.[attemptID]
      if (!bucket || attempt?.phase !== "exchanging") return { value: { won: false, cancelled: [] } }
      const cancelled = Object.entries(bucket.entry.attempts ?? {})
        .filter(
          ([id, current]) =>
            id !== attemptID && ["initializing", "pending", "received", "exchanging"].includes(current.phase ?? ""),
        )
        .map(([id]) => id)
      const attempts = Object.fromEntries(
        Object.entries(bucket.entry.attempts ?? {}).map(([id, current]) => [
          id,
          id === attemptID
            ? ended(current, "complete")
            : ["initializing", "pending", "received", "exchanging"].includes(current.phase ?? "")
              ? ended(current, "cancelled")
              : current,
        ]),
      )
      const saved: Tokens = {
        ...tokens,
        ...(tokens.refresh_token === undefined && bucket.entry.tokens?.refresh_token
          ? { refresh_token: bucket.entry.tokens.refresh_token }
          : {}),
        ...(tokens.scope === undefined && bucket.entry.tokens?.scope ? { scope: bucket.entry.tokens.scope } : {}),
        ...(tokens.expires_in === undefined ? {} : { expires_at: now + tokens.expires_in }),
      }
      return {
        data: {
          ...data,
          buckets: { ...data.buckets, [name]: { ...bucket, entry: { ...bucket.entry, tokens: saved, attempts } } },
        },
        value: { won: true, cancelled },
      }
    })

  const finishAttempt: Interface["finishAttempt"] = (target, attemptID, phase, error, expected) =>
    transact(async (data) => {
      const name = key(target)
      const bucket = data.buckets[name]
      const attempt = bucket?.entry.attempts?.[attemptID]
      if (!bucket || !attempt || (expected && !expected.includes(attempt.phase))) return { value: false }
      return {
        data: {
          ...data,
          buckets: {
            ...data.buckets,
            [name]: {
              ...bucket,
              entry: {
                ...bucket.entry,
                attempts: { ...bucket.entry.attempts, [attemptID]: ended(attempt, phase, error) },
              },
            },
          },
        },
        value: true,
      }
    })

  const cancelTarget: Interface["cancelTarget"] = (target, invalidate = false) =>
    transact(async (data) => {
      const name = key(target)
      const bucket = data.buckets[name]
      if (!bucket) return { value: undefined }
      const entry = {
        ...(invalidate ? {} : bucket.entry),
        attempts: Object.fromEntries(
          Object.entries(bucket.entry.attempts ?? {}).map(([id, attempt]) => [
            id,
            ["initializing", "pending", "received", "exchanging"].includes(attempt.phase ?? "")
              ? ended(attempt, "cancelled")
              : attempt,
          ]),
        ),
      }
      return {
        data: { ...data, buckets: { ...data.buckets, [name]: { ...bucket, entry } } },
        value: undefined,
      }
    })

  return {
    get,
    claimLegacy,
    targets,
    update,
    remove,
    saveTokens,
    invalidate,
    findAttempt,
    claimAttempt,
    cancelAttempt,
    readyAttempt,
    startExchange,
    finishExchange,
    finishAttempt,
    cancelTarget,
  }
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
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= 0)
}

function validData(value: unknown): value is Data {
  if (!exact(value, ["version", "buckets"]) || value.version !== 1 || !record(value.buckets)) return false
  return Object.entries(value.buckets).every(([key, candidate]) => {
    if (!exact(candidate, ["identity", "entry"]) || !record(candidate.identity) || !record(candidate.entry))
      return false
    const id = candidate.identity
    if (!exact(id, ["directory", "workspaceID", "name", "endpoint"])) return false
    if (
      typeof id.directory !== "string" ||
      typeof id.name !== "string" ||
      typeof id.endpoint !== "string" ||
      !web(id.endpoint)
    )
      return false
    if (id.workspaceID !== undefined && typeof id.workspaceID !== "string") return false
    const expected = JSON.stringify(
      id.workspaceID === undefined
        ? [id.directory, id.name, id.endpoint]
        : [id.directory, id.workspaceID, id.name, id.endpoint],
    )
    if (normalizeEndpoint(id.endpoint) !== id.endpoint || expected !== key) return false
    const entry = candidate.entry
    if (!exact(entry, ["tokens", "client", "discovery", "compatibility", "attempts", "claim"])) return false
    if (
      entry.compatibility !== undefined &&
      (typeof entry.compatibility !== "string" || !/^[a-f0-9]{64}$/.test(entry.compatibility))
    )
      return false
    if (entry.claim !== undefined && entry.claim !== "v1-version-2") return false
    if (entry.tokens !== undefined) {
      if (
        !exact(entry.tokens, [
          "access_token",
          "token_type",
          "expires_in",
          "expires_at",
          "refresh_token",
          "scope",
          "id_token",
        ]) ||
        typeof entry.tokens.access_token !== "string" ||
        typeof entry.tokens.token_type !== "string"
      )
        return false
      if (!finite(entry.tokens.expires_in) || !finite(entry.tokens.expires_at)) return false
      for (const field of ["refresh_token", "scope", "id_token"])
        if (entry.tokens[field] !== undefined && typeof entry.tokens[field] !== "string") return false
    }
    if (entry.client !== undefined) {
      if (!client(entry.client) || typeof entry.client.client_id !== "string") return false
      if (entry.client.client_secret !== undefined && typeof entry.client.client_secret !== "string") return false
      if (!finite(entry.client.client_id_issued_at) || !finite(entry.client.client_secret_expires_at)) return false
    }
    if (entry.discovery !== undefined) {
      if (
        !exact(entry.discovery, [
          "authorizationServerUrl",
          "resourceMetadataUrl",
          "authorizationServerMetadata",
          "resourceMetadata",
        ]) ||
        !web(entry.discovery.authorizationServerUrl)
      )
        return false
      for (const field of ["resourceMetadataUrl"])
        if (entry.discovery[field] !== undefined && !web(entry.discovery[field])) return false
      const metadata = entry.discovery.authorizationServerMetadata
      if (metadata !== undefined && !authorization(metadata)) return false
      const resource = entry.discovery.resourceMetadata
      if (resource !== undefined && !protectedResource(resource)) return false
    }
    if (entry.attempts !== undefined) {
      if (!record(entry.attempts)) return false
      const phases = new Set([
        "initializing",
        "pending",
        "received",
        "exchanging",
        "complete",
        "cancelled",
        "expired",
        "failed",
      ])
      for (const attempt of Object.values(entry.attempts)) {
        if (
          !exact(attempt, [
            "state",
            "verifier",
            "code",
            "mode",
            "redirect",
            "authorization",
            "created",
            "expires",
            "phase",
            "error",
          ])
        )
          return false
        for (const field of ["state", "verifier", "code"])
          if (attempt[field] !== undefined && typeof attempt[field] !== "string") return false
        if (attempt.error !== undefined && !FAILURES.has(attempt.error as string)) return false
        if (!web(attempt.redirect)) return false
        if (attempt.mode !== "auto" && attempt.mode !== "manual") return false
        if (
          !finite(attempt.created) ||
          attempt.created === undefined ||
          !finite(attempt.expires) ||
          attempt.expires === undefined
        )
          return false
        if (!phases.has(attempt.phase as string)) return false
        if (attempt.authorization !== undefined && !web(attempt.authorization)) return false
        if (attempt.phase === "initializing" && (!attempt.state || attempt.code || attempt.authorization)) return false
        if (
          attempt.phase === "pending" &&
          (!attempt.state || !attempt.verifier || !attempt.authorization || attempt.code)
        )
          return false
        if (
          ["received", "exchanging"].includes(attempt.phase as string) &&
          (!attempt.state || !attempt.code || !attempt.verifier || !attempt.authorization)
        )
          return false
        if (
          ["complete", "cancelled", "expired", "failed"].includes(attempt.phase as string) &&
          (attempt.state || attempt.code || attempt.verifier || attempt.authorization)
        )
          return false
      }
    }
    return true
  })
}

const CLIENT_FIELDS = [
  "client_id",
  "client_secret",
  "client_id_issued_at",
  "client_secret_expires_at",
  "redirect_uris",
  "token_endpoint_auth_method",
  "grant_types",
  "response_types",
  "client_name",
  "client_uri",
  "logo_uri",
  "scope",
  "contacts",
  "tos_uri",
  "policy_uri",
  "jwks_uri",
  "jwks",
  "software_id",
  "software_version",
  "software_statement",
] as const
const AUTH_FIELDS = [
  "issuer",
  "authorization_endpoint",
  "token_endpoint",
  "registration_endpoint",
  "scopes_supported",
  "response_types_supported",
  "response_modes_supported",
  "grant_types_supported",
  "token_endpoint_auth_methods_supported",
  "token_endpoint_auth_signing_alg_values_supported",
  "service_documentation",
  "revocation_endpoint",
  "revocation_endpoint_auth_methods_supported",
  "revocation_endpoint_auth_signing_alg_values_supported",
  "introspection_endpoint",
  "introspection_endpoint_auth_methods_supported",
  "introspection_endpoint_auth_signing_alg_values_supported",
  "code_challenge_methods_supported",
  "client_id_metadata_document_supported",
  "userinfo_endpoint",
  "jwks_uri",
  "acr_values_supported",
  "subject_types_supported",
  "id_token_signing_alg_values_supported",
  "id_token_encryption_alg_values_supported",
  "id_token_encryption_enc_values_supported",
  "userinfo_signing_alg_values_supported",
  "userinfo_encryption_alg_values_supported",
  "userinfo_encryption_enc_values_supported",
  "request_object_signing_alg_values_supported",
  "request_object_encryption_alg_values_supported",
  "request_object_encryption_enc_values_supported",
  "display_values_supported",
  "claim_types_supported",
  "claims_supported",
  "claims_locales_supported",
  "ui_locales_supported",
  "claims_parameter_supported",
  "request_parameter_supported",
  "request_uri_parameter_supported",
  "require_request_uri_registration",
  "op_policy_uri",
  "op_tos_uri",
] as const
const RESOURCE_FIELDS = [
  "resource",
  "authorization_servers",
  "jwks_uri",
  "scopes_supported",
  "bearer_methods_supported",
  "resource_signing_alg_values_supported",
  "resource_name",
  "resource_documentation",
  "resource_policy_uri",
  "resource_tos_uri",
  "tls_client_certificate_bound_access_tokens",
  "authorization_details_types_supported",
  "dpop_signing_alg_values_supported",
  "dpop_bound_access_tokens_required",
] as const

function client(value: unknown): value is OAuthClientInformationMixed {
  if (!exact(value, CLIENT_FIELDS) || typeof value.client_id !== "string") return false
  if (value.client_secret !== undefined && typeof value.client_secret !== "string") return false
  if (!finite(value.client_id_issued_at) || !finite(value.client_secret_expires_at)) return false
  if (value.redirect_uris !== undefined && (!Array.isArray(value.redirect_uris) || !value.redirect_uris.every(web)))
    return false
  if (
    !strings(value, [
      "token_endpoint_auth_method",
      "client_name",
      "scope",
      "software_id",
      "software_version",
      "software_statement",
    ])
  )
    return false
  if (!arrays(value, ["grant_types", "response_types", "contacts"])) return false
  if (!json(value.jwks)) return false
  return urlFields(value, ["client_uri", "logo_uri", "tos_uri", "policy_uri", "jwks_uri"])
}

function authorization(value: unknown) {
  if (!exact(value, AUTH_FIELDS)) return false
  if (
    typeof value.issuer !== "string" ||
    !web(value.issuer) ||
    !web(value.authorization_endpoint) ||
    !web(value.token_endpoint)
  )
    return false
  if (
    !Array.isArray(value.response_types_supported) ||
    !value.response_types_supported.every((item) => typeof item === "string")
  )
    return false
  if (
    !arrays(value, [
      "scopes_supported",
      "response_modes_supported",
      "grant_types_supported",
      "token_endpoint_auth_methods_supported",
      "token_endpoint_auth_signing_alg_values_supported",
      "revocation_endpoint_auth_methods_supported",
      "revocation_endpoint_auth_signing_alg_values_supported",
      "introspection_endpoint_auth_methods_supported",
      "introspection_endpoint_auth_signing_alg_values_supported",
      "code_challenge_methods_supported",
      "acr_values_supported",
      "subject_types_supported",
      "id_token_signing_alg_values_supported",
      "id_token_encryption_alg_values_supported",
      "id_token_encryption_enc_values_supported",
      "userinfo_signing_alg_values_supported",
      "userinfo_encryption_alg_values_supported",
      "userinfo_encryption_enc_values_supported",
      "request_object_signing_alg_values_supported",
      "request_object_encryption_alg_values_supported",
      "request_object_encryption_enc_values_supported",
      "display_values_supported",
      "claim_types_supported",
      "claims_supported",
      "claims_locales_supported",
      "ui_locales_supported",
    ])
  )
    return false
  if (
    !booleans(value, [
      "client_id_metadata_document_supported",
      "claims_parameter_supported",
      "request_parameter_supported",
      "request_uri_parameter_supported",
      "require_request_uri_registration",
    ])
  )
    return false
  return urlFields(value, [
    "registration_endpoint",
    "service_documentation",
    "revocation_endpoint",
    "introspection_endpoint",
    "userinfo_endpoint",
    "jwks_uri",
    "op_policy_uri",
    "op_tos_uri",
  ])
}

function protectedResource(value: unknown) {
  if (!exact(value, RESOURCE_FIELDS) || !web(value.resource)) return false
  if (
    value.authorization_servers !== undefined &&
    (!Array.isArray(value.authorization_servers) || !value.authorization_servers.every(web))
  )
    return false
  if (
    !arrays(value, [
      "scopes_supported",
      "bearer_methods_supported",
      "resource_signing_alg_values_supported",
      "authorization_details_types_supported",
      "dpop_signing_alg_values_supported",
    ])
  )
    return false
  if (!strings(value, ["resource_name"])) return false
  if (!booleans(value, ["tls_client_certificate_bound_access_tokens", "dpop_bound_access_tokens_required"]))
    return false
  return urlFields(value, ["jwks_uri", "resource_documentation", "resource_policy_uri", "resource_tos_uri"])
}

function urlFields(value: Record<string, unknown>, fields: ReadonlyArray<string>) {
  return fields.every((field) => value[field] === undefined || value[field] === "" || web(value[field]))
}

function strings(value: Record<string, unknown>, fields: ReadonlyArray<string>) {
  return fields.every((field) => value[field] === undefined || typeof value[field] === "string")
}

function arrays(value: Record<string, unknown>, fields: ReadonlyArray<string>) {
  return fields.every(
    (field) =>
      value[field] === undefined ||
      (Array.isArray(value[field]) && value[field].every((item) => typeof item === "string")),
  )
}

function booleans(value: Record<string, unknown>, fields: ReadonlyArray<string>) {
  return fields.every((field) => value[field] === undefined || typeof value[field] === "boolean")
}

function json(value: unknown): boolean {
  if (value === undefined || value === null || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(json)
  return record(value) && Object.values(value).every(json)
}

const FAILURES = new Set([
  "attempt-expired",
  "provider-error",
  "callback-unavailable",
  "indeterminate-exchange",
  "discovery",
  "exchange",
])

function exact(value: unknown, fields: ReadonlyArray<string>): value is Record<string, unknown> {
  return record(value) && Object.keys(value).every((field) => fields.includes(field))
}

async function legacy(file: string, target: ReturnType<typeof legacyIdentity>): Promise<Entry | undefined> {
  const raw: unknown = await fs
    .readFile(file, "utf8")
    .then(JSON.parse)
    .catch(() => undefined)
  if (!legacyData(raw)) return
  const matches = Object.entries(raw.entries).filter(([key, value]) => {
    return (
      key === JSON.stringify([value.identity.instance, value.identity.name]) &&
      value.identity.instance === target.directory &&
      value.identity.name === target.name
    )
  })
  if (matches.length !== 1) return
  const servers = matches[0]![1].servers
  const sources = Object.entries(servers).filter(([endpoint]) => {
    try {
      return normalizeEndpoint(endpoint) === target.endpoint && endpoint === target.endpoint
    } catch {
      return false
    }
  })
  if (sources.length !== 1) return
  const source = sources[0]![1]
  const tokens = source.tokens
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
  const client = source.clientInfo
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

type LegacyEntry = {
  readonly tokens?: {
    readonly accessToken: string
    readonly refreshToken?: string
    readonly expiresAt?: number
    readonly scope?: string
  }
  readonly clientInfo?: {
    readonly clientId: string
    readonly clientSecret?: string
    readonly clientIdIssuedAt?: number
    readonly clientSecretExpiresAt?: number
  }
  readonly codeVerifier?: string
  readonly oauthState?: string
  readonly serverUrl?: string
}
type LegacyData = {
  readonly version: 2
  readonly entries: Readonly<
    Record<
      string,
      {
        readonly identity: { readonly instance: string; readonly name: string }
        readonly servers: Readonly<Record<string, LegacyEntry>>
      }
    >
  >
  readonly legacy?: Readonly<Record<string, LegacyEntry>>
  readonly recoverable?: Readonly<Record<string, LegacyEntry>>
}

function legacyData(value: unknown): value is LegacyData {
  if (!exact(value, ["version", "entries", "legacy", "recoverable"]) || value.version !== 2 || !record(value.entries))
    return false
  if (value.legacy !== undefined && !legacyEntries(value.legacy, true)) return false
  if (value.recoverable !== undefined && !legacyEntries(value.recoverable, true)) return false
  return Object.entries(value.entries).every(([key, bucket]) => {
    if (
      !exact(bucket, ["identity", "servers"]) ||
      !exact(bucket.identity, ["instance", "name"]) ||
      !record(bucket.servers)
    )
      return false
    if (typeof bucket.identity.instance !== "string" || typeof bucket.identity.name !== "string") return false
    if (key !== JSON.stringify([bucket.identity.instance, bucket.identity.name])) return false
    return legacyEntries(bucket.servers, false)
  })
}

function legacyEntries(value: unknown, serverUrl: boolean) {
  if (!record(value)) return false
  return Object.entries(value).every(([endpoint, entry]) => {
    if (!exact(entry, ["tokens", "clientInfo", "codeVerifier", "oauthState", ...(serverUrl ? ["serverUrl"] : [])]))
      return false
    if (serverUrl) {
      if (entry.serverUrl !== undefined && (typeof entry.serverUrl !== "string" || !web(entry.serverUrl))) return false
    } else {
      try {
        if (normalizeEndpoint(endpoint) !== endpoint) return false
      } catch {
        return false
      }
    }
    if (entry.codeVerifier !== undefined && typeof entry.codeVerifier !== "string") return false
    if (entry.oauthState !== undefined && typeof entry.oauthState !== "string") return false
    if (entry.tokens !== undefined) {
      if (
        !exact(entry.tokens, ["accessToken", "refreshToken", "expiresAt", "scope"]) ||
        typeof entry.tokens.accessToken !== "string"
      )
        return false
      if (entry.tokens.refreshToken !== undefined && typeof entry.tokens.refreshToken !== "string") return false
      if (entry.tokens.scope !== undefined && typeof entry.tokens.scope !== "string") return false
      if (!finite(entry.tokens.expiresAt)) return false
    }
    if (entry.clientInfo !== undefined) {
      if (
        !exact(entry.clientInfo, ["clientId", "clientSecret", "clientIdIssuedAt", "clientSecretExpiresAt"]) ||
        typeof entry.clientInfo.clientId !== "string"
      )
        return false
      if (entry.clientInfo.clientSecret !== undefined && typeof entry.clientInfo.clientSecret !== "string") return false
      if (!finite(entry.clientInfo.clientIdIssuedAt) || !finite(entry.clientInfo.clientSecretExpiresAt)) return false
    }
    return true
  })
}

function legacyIdentity(target: Target) {
  return { directory: target.directory, name: target.name, endpoint: normalizeEndpoint(target.endpoint) }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
