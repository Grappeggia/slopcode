import { LayerNode } from "@slopcode-ai/core/effect/layer-node"
import path from "node:path"
import { serviceUse } from "@slopcode-ai/core/effect/service-use"
import { Global } from "@slopcode-ai/core/global"
import { Context, Effect, Layer, Option, Schema } from "effect"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { EffectFlock } from "@slopcode-ai/core/util/effect-flock"

export const Tokens = Schema.Struct({
  accessToken: Schema.mutableKey(Schema.String),
  refreshToken: Schema.mutableKey(Schema.optional(Schema.String)),
  expiresAt: Schema.mutableKey(Schema.optional(Schema.Number)),
  scope: Schema.mutableKey(Schema.optional(Schema.String)),
})
export type Tokens = Schema.Schema.Type<typeof Tokens>

export const ClientInfo = Schema.Struct({
  clientId: Schema.mutableKey(Schema.String),
  clientSecret: Schema.mutableKey(Schema.optional(Schema.String)),
  clientIdIssuedAt: Schema.mutableKey(Schema.optional(Schema.Number)),
  clientSecretExpiresAt: Schema.mutableKey(Schema.optional(Schema.Number)),
})
export type ClientInfo = Schema.Schema.Type<typeof ClientInfo>

const fields = {
  tokens: Schema.mutableKey(Schema.optional(Tokens)),
  clientInfo: Schema.mutableKey(Schema.optional(ClientInfo)),
  codeVerifier: Schema.mutableKey(Schema.optional(Schema.String)),
  oauthState: Schema.mutableKey(Schema.optional(Schema.String)),
}

export const Entry = Schema.Struct(fields)
export type Entry = Schema.Schema.Type<typeof Entry>

export const Identity = Schema.Struct({
  instance: Schema.String,
  name: Schema.String,
})
export type Identity = Schema.Schema.Type<typeof Identity>

const LegacyEntry = Schema.Struct({
  ...fields,
  serverUrl: Schema.mutableKey(Schema.optional(Schema.String)),
})
type LegacyEntry = Schema.Schema.Type<typeof LegacyEntry>

const Bucket = Schema.Struct({
  identity: Identity,
  servers: Schema.Record(Schema.String, Entry),
})
type Bucket = Schema.Schema.Type<typeof Bucket>

const Data = Schema.Struct({
  version: Schema.Literal(2),
  entries: Schema.Record(Schema.String, Bucket),
  legacy: Schema.optional(Schema.Record(Schema.String, LegacyEntry)),
  recoverable: Schema.optional(Schema.Record(Schema.String, LegacyEntry)),
})
type Data = Schema.Schema.Type<typeof Data>

const decodeData = Schema.decodeUnknownOption(Data)
const decodeLegacy = Schema.decodeUnknownOption(Schema.Record(Schema.String, LegacyEntry))

const URL_ERROR = "MCP OAuth server URL must be an HTTP(S) URL"

export function normalizeServerUrl(value: string) {
  const url = (() => {
    try {
      return new URL(value)
    } catch {
      throw new TypeError(URL_ERROR)
    }
  })()
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) throw new TypeError(URL_ERROR)
  url.hash = ""
  return url.toString()
}

function id(identity: Identity) {
  return JSON.stringify([identity.instance, identity.name])
}

export function key(identity: Identity, serverUrl: string) {
  return JSON.stringify([identity.instance, identity.name, normalizeServerUrl(serverUrl)])
}

function empty(): Data {
  return { version: 2, entries: {} }
}

function present(entry: LegacyEntry) {
  return !!(entry.tokens || entry.clientInfo || entry.codeVerifier || entry.oauthState)
}

function migrate(raw: unknown): { data: Data; dirty: boolean } {
  const current = decodeData(raw)
  if (Option.isSome(current)) return { data: current.value, dirty: false }

  const decoded = decodeLegacy(raw)
  if (Option.isNone(decoded)) return { data: empty(), dirty: false }

  const legacy: Record<string, LegacyEntry> = {}
  const recoverable: Record<string, LegacyEntry> = {}
  for (const [name, entry] of Object.entries(decoded.value)) {
    const serverUrl = (() => {
      try {
        return entry.serverUrl ? normalizeServerUrl(entry.serverUrl) : undefined
      } catch {
        return undefined
      }
    })()
    if (!serverUrl) {
      recoverable[name] = entry
      continue
    }

    const stable = { serverUrl, tokens: entry.tokens, clientInfo: entry.clientInfo }
    const transient = { serverUrl, codeVerifier: entry.codeVerifier, oauthState: entry.oauthState }
    if (present(stable)) legacy[name] = stable
    if (present(transient)) recoverable[name] = transient
  }

  return {
    data: {
      version: 2,
      entries: {},
      ...(Object.keys(legacy).length ? { legacy } : {}),
      ...(Object.keys(recoverable).length ? { recoverable } : {}),
    },
    dirty: true,
  }
}

function claim(data: Data, identity: Identity, serverUrl: string): { data: Data; entry?: Entry } {
  const bucket = data.entries[id(identity)]
  const entry = bucket?.servers[serverUrl]
  const source = data.legacy?.[identity.name]
  if (!source || source.serverUrl !== serverUrl) return { data, entry }

  const moved = {
    ...(!entry?.tokens && source.tokens ? { tokens: source.tokens } : {}),
    ...(!entry?.clientInfo && source.clientInfo ? { clientInfo: source.clientInfo } : {}),
  }
  if (!moved.tokens && !moved.clientInfo) return { data, entry }

  const next = { ...entry, ...moved }
  const remaining = {
    ...source,
    ...(moved.tokens ? { tokens: undefined } : {}),
    ...(moved.clientInfo ? { clientInfo: undefined } : {}),
  }
  const legacy = { ...data.legacy }
  if (present(remaining)) legacy[identity.name] = remaining
  else delete legacy[identity.name]

  return {
    data: {
      ...data,
      entries: {
        ...data.entries,
        [id(identity)]: {
          identity,
          servers: { ...bucket?.servers, [serverUrl]: next },
        },
      },
      legacy: Object.keys(legacy).length ? legacy : undefined,
    },
    entry: next,
  }
}

export interface Interface {
  readonly get: (identity: Identity, serverUrl: string) => Effect.Effect<Entry | undefined>
  readonly set: (identity: Identity, serverUrl: string, entry: Entry) => Effect.Effect<void>
  readonly remove: (identity: Identity, serverUrl: string) => Effect.Effect<void>
  readonly updateTokens: (identity: Identity, serverUrl: string, tokens: Tokens) => Effect.Effect<void>
  readonly clearTokens: (identity: Identity, serverUrl: string) => Effect.Effect<void>
  readonly updateClientInfo: (identity: Identity, serverUrl: string, clientInfo: ClientInfo) => Effect.Effect<void>
  readonly clearClientInfo: (identity: Identity, serverUrl: string) => Effect.Effect<void>
  readonly updateCodeVerifier: (identity: Identity, serverUrl: string, codeVerifier: string) => Effect.Effect<void>
  readonly clearCodeVerifier: (identity: Identity, serverUrl: string) => Effect.Effect<void>
  readonly updateOAuthState: (identity: Identity, serverUrl: string, oauthState: string) => Effect.Effect<void>
  readonly getOAuthState: (identity: Identity, serverUrl: string) => Effect.Effect<string | undefined>
  readonly clearOAuthState: (identity: Identity, serverUrl: string) => Effect.Effect<void>
  readonly isTokenExpired: (identity: Identity, serverUrl: string) => Effect.Effect<boolean | null>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/McpAuth") {}

export const use = serviceUse(Service)

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const global = yield* Global.Service
    const flock = yield* EffectFlock.Service
    const filepath = path.join(global.data, "mcp-auth.json")
    const lockKey = `mcp-auth:${filepath}`

    const load = Effect.fnUntraced(function* () {
      return yield* fs.readJson(filepath).pipe(
        Effect.map(migrate),
        Effect.catch(() => Effect.succeed({ data: empty(), dirty: false })),
      )
    })

    const write = Effect.fnUntraced(function* (data: Data) {
      const temp = filepath + ".tmp"
      yield* fs.makeDirectory(path.dirname(filepath), { recursive: true }).pipe(Effect.orDie)
      yield* Effect.gen(function* () {
        yield* fs.writeFileString(temp, JSON.stringify(data, null, 2), { mode: 0o600 }).pipe(Effect.orDie)
        yield* fs.chmod(temp, 0o600).pipe(Effect.orDie)
        yield* fs.rename(temp, filepath).pipe(Effect.orDie)
      }).pipe(Effect.ensuring(fs.remove(temp, { force: true }).pipe(Effect.ignore)))
    })

    const transact = <A>(update: (data: Data) => { data?: Data; value: A }) =>
      Effect.gen(function* () {
        const loaded = yield* load()
        const result = update(loaded.data)
        if (loaded.dirty || result.data) yield* write(result.data ?? loaded.data)
        return result.value
      }).pipe(flock.withLock(lockKey), Effect.orDie)

    const get = Effect.fn("McpAuth.get")(function* (identity: Identity, value: string) {
      const serverUrl = normalizeServerUrl(value)
      return yield* transact((data) => {
        const result = claim(data, identity, serverUrl)
        return { data: result.data === data ? undefined : result.data, value: result.entry }
      })
    })

    const set = Effect.fn("McpAuth.set")(function* (identity: Identity, value: string, entry: Entry) {
      const serverUrl = normalizeServerUrl(value)
      yield* transact((data) => {
        const result = claim(data, identity, serverUrl)
        const bucket = result.data.entries[id(identity)]
        return {
          data: {
            ...result.data,
            entries: {
              ...result.data.entries,
              [id(identity)]: { identity, servers: { ...bucket?.servers, [serverUrl]: entry } },
            },
          },
          value: undefined,
        }
      })
    })

    const remove = Effect.fn("McpAuth.remove")(function* (identity: Identity, value: string) {
      const serverUrl = normalizeServerUrl(value)
      yield* transact((data) => {
        const bucket = data.entries[id(identity)]
        const source = data.legacy?.[identity.name]
        const recoverable = data.recoverable?.[identity.name]
        if (!bucket?.servers[serverUrl] && source?.serverUrl !== serverUrl && recoverable?.serverUrl !== serverUrl) {
          return { value: undefined }
        }

        const servers = { ...bucket?.servers }
        delete servers[serverUrl]
        const entries = { ...data.entries }
        if (Object.keys(servers).length) entries[id(identity)] = { identity, servers }
        else delete entries[id(identity)]
        const legacy = { ...data.legacy }
        if (source?.serverUrl === serverUrl) delete legacy[identity.name]
        const remaining = { ...data.recoverable }
        if (recoverable?.serverUrl === serverUrl) delete remaining[identity.name]
        return {
          data: {
            ...data,
            entries,
            legacy: Object.keys(legacy).length ? legacy : undefined,
            recoverable: Object.keys(remaining).length ? remaining : undefined,
          },
          value: undefined,
        }
      })
    })

    const updateField = <K extends keyof Entry>(field: K, span: string) =>
      Effect.fn(`McpAuth.${span}`)(function* (identity: Identity, value: string, fieldValue: NonNullable<Entry[K]>) {
        const serverUrl = normalizeServerUrl(value)
        yield* transact((data) => {
          const result = claim(data, identity, serverUrl)
          const bucket = result.data.entries[id(identity)]
          return {
            data: {
              ...result.data,
              entries: {
                ...result.data.entries,
                [id(identity)]: {
                  identity,
                  servers: { ...bucket?.servers, [serverUrl]: { ...result.entry, [field]: fieldValue } },
                },
              },
            },
            value: undefined,
          }
        })
      })

    const clearField = (field: keyof Entry, span: string) =>
      Effect.fn(`McpAuth.${span}`)(function* (identity: Identity, value: string) {
        const serverUrl = normalizeServerUrl(value)
        yield* transact((data) => {
          const result = claim(data, identity, serverUrl)
          if (!result.entry || !(field in result.entry)) {
            return { data: result.data === data ? undefined : result.data, value: undefined }
          }
          const entry = { ...result.entry }
          delete entry[field]
          const bucket = result.data.entries[id(identity)]
          return {
            data: {
              ...result.data,
              entries: {
                ...result.data.entries,
                [id(identity)]: { identity, servers: { ...bucket?.servers, [serverUrl]: entry } },
              },
            },
            value: undefined,
          }
        })
      })

    const updateTokens = updateField("tokens", "updateTokens")
    const clearTokens = clearField("tokens", "clearTokens")
    const updateClientInfo = updateField("clientInfo", "updateClientInfo")
    const clearClientInfo = clearField("clientInfo", "clearClientInfo")
    const updateCodeVerifier = updateField("codeVerifier", "updateCodeVerifier")
    const clearCodeVerifier = clearField("codeVerifier", "clearCodeVerifier")
    const updateOAuthState = updateField("oauthState", "updateOAuthState")
    const clearOAuthState = clearField("oauthState", "clearOAuthState")

    const getOAuthState = Effect.fn("McpAuth.getOAuthState")(function* (identity: Identity, serverUrl: string) {
      return (yield* get(identity, serverUrl))?.oauthState
    })

    const isTokenExpired = Effect.fn("McpAuth.isTokenExpired")(function* (identity: Identity, serverUrl: string) {
      const entry = yield* get(identity, serverUrl)
      if (!entry?.tokens) return null
      if (entry.tokens.expiresAt === undefined) return false
      return entry.tokens.expiresAt < Date.now() / 1000
    })

    return Service.of({
      get,
      set,
      remove,
      updateTokens,
      clearTokens,
      updateClientInfo,
      clearClientInfo,
      updateCodeVerifier,
      clearCodeVerifier,
      updateOAuthState,
      getOAuthState,
      clearOAuthState,
      isTokenExpired,
    })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(EffectFlock.defaultLayer),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Global.defaultLayer),
)

export const node = LayerNode.make(layer, [FSUtil.node, EffectFlock.node, Global.node])

export * as McpAuth from "./auth"
