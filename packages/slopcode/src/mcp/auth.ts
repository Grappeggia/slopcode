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

const legacyFields = {
  tokens: Schema.mutableKey(Schema.optional(Tokens)),
  clientInfo: Schema.mutableKey(Schema.optional(ClientInfo)),
  codeVerifier: Schema.mutableKey(Schema.optional(Schema.String)),
  oauthState: Schema.mutableKey(Schema.optional(Schema.String)),
}

export const Flow = Schema.Struct({
  state: Schema.String,
  codeVerifier: Schema.mutableKey(Schema.optional(Schema.String)),
})
export type Flow = Schema.Schema.Type<typeof Flow>

export const Entry = Schema.Struct({
  ...legacyFields,
  flows: Schema.mutableKey(Schema.optional(Schema.Record(Schema.String, Flow))),
})
export type Entry = Schema.Schema.Type<typeof Entry>

export const Identity = Schema.Struct({
  instance: Schema.String,
  name: Schema.String,
})
export type Identity = Schema.Schema.Type<typeof Identity>

const LegacyEntry = Schema.Struct({
  ...legacyFields,
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

function migrate(raw: unknown): { data: Data; dirty: boolean } {
  const current = decodeData(raw)
  if (Option.isSome(current)) return { data: current.value, dirty: false }

  if (typeof raw === "object" && raw !== null && "version" in raw) {
    throw new Error("Unsupported MCP OAuth storage version")
  }

  const decoded = decodeLegacy(raw)
  if (Option.isNone(decoded)) throw new Error("Invalid MCP OAuth storage")

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

    legacy[name] = { ...entry, serverUrl }
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

export interface Interface {
  readonly get: (identity: Identity, serverUrl: string) => Effect.Effect<Entry | undefined>
  readonly set: (identity: Identity, serverUrl: string, entry: Entry) => Effect.Effect<void>
  readonly remove: (identity: Identity, serverUrl: string) => Effect.Effect<void>
  readonly updateTokens: (identity: Identity, serverUrl: string, tokens: Tokens) => Effect.Effect<void>
  readonly clearTokens: (identity: Identity, serverUrl: string) => Effect.Effect<void>
  readonly updateClientInfo: (identity: Identity, serverUrl: string, clientInfo: ClientInfo) => Effect.Effect<void>
  readonly clearClientInfo: (identity: Identity, serverUrl: string) => Effect.Effect<void>
  readonly startFlow: (identity: Identity, serverUrl: string, state: string) => Effect.Effect<void>
  readonly updateCodeVerifier: (
    identity: Identity,
    serverUrl: string,
    state: string,
    codeVerifier: string,
  ) => Effect.Effect<void>
  readonly getCodeVerifier: (identity: Identity, serverUrl: string, state: string) => Effect.Effect<string | undefined>
  readonly clearFlow: (identity: Identity, serverUrl: string, state: string) => Effect.Effect<void>
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
      const raw = yield* fs.readJson(filepath).pipe(
        Effect.map((value) => Option.some(value)),
        Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(Option.none())),
      )
      if (Option.isNone(raw)) return { data: empty(), dirty: false }
      return migrate(raw.value)
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
      return yield* transact((data) => ({ value: data.entries[id(identity)]?.servers[serverUrl] }))
    })

    const set = Effect.fn("McpAuth.set")(function* (identity: Identity, value: string, entry: Entry) {
      const serverUrl = normalizeServerUrl(value)
      yield* transact((data) => {
        const bucket = data.entries[id(identity)]
        return {
          data: {
            ...data,
            entries: {
              ...data.entries,
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
        if (!bucket?.servers[serverUrl]) return { value: undefined }

        const servers = { ...bucket?.servers }
        delete servers[serverUrl]
        const entries = { ...data.entries }
        if (Object.keys(servers).length) entries[id(identity)] = { identity, servers }
        else delete entries[id(identity)]
        return {
          data: {
            ...data,
            entries,
          },
          value: undefined,
        }
      })
    })

    const updateField = <K extends keyof Entry>(field: K, span: string) =>
      Effect.fn(`McpAuth.${span}`)(function* (identity: Identity, value: string, fieldValue: NonNullable<Entry[K]>) {
        const serverUrl = normalizeServerUrl(value)
        yield* transact((data) => {
          const bucket = data.entries[id(identity)]
          const entry = bucket?.servers[serverUrl]
          return {
            data: {
              ...data,
              entries: {
                ...data.entries,
                [id(identity)]: {
                  identity,
                  servers: { ...bucket?.servers, [serverUrl]: { ...entry, [field]: fieldValue } },
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
          const bucket = data.entries[id(identity)]
          const current = bucket?.servers[serverUrl]
          if (!current || !(field in current)) return { value: undefined }
          const entry = { ...current }
          delete entry[field]
          return {
            data: {
              ...data,
              entries: {
                ...data.entries,
                [id(identity)]: { identity, servers: { ...bucket?.servers, [serverUrl]: entry } },
              },
            },
            value: undefined,
          }
        })
      })

    const updateTokens = Effect.fn("McpAuth.updateTokens")(function* (
      identity: Identity,
      value: string,
      tokens: Tokens,
    ) {
      const serverUrl = normalizeServerUrl(value)
      yield* transact((data) => {
        const bucket = data.entries[id(identity)]
        const entry = bucket?.servers[serverUrl]
        const next = {
          ...tokens,
          ...(tokens.refreshToken === undefined && entry?.tokens?.refreshToken !== undefined
            ? { refreshToken: entry.tokens.refreshToken }
            : {}),
          ...(tokens.scope === undefined && entry?.tokens?.scope !== undefined ? { scope: entry.tokens.scope } : {}),
        }
        return {
          data: {
            ...data,
            entries: {
              ...data.entries,
              [id(identity)]: {
                identity,
                servers: { ...bucket?.servers, [serverUrl]: { ...entry, tokens: next } },
              },
            },
          },
          value: undefined,
        }
      })
    })
    const clearTokens = clearField("tokens", "clearTokens")
    const updateClientInfo = updateField("clientInfo", "updateClientInfo")
    const clearClientInfo = clearField("clientInfo", "clearClientInfo")

    const startFlow = Effect.fn("McpAuth.startFlow")(function* (identity: Identity, value: string, state: string) {
      const serverUrl = normalizeServerUrl(value)
      yield* transact((data) => {
        const bucket = data.entries[id(identity)]
        const entry = bucket?.servers[serverUrl]
        return {
          data: {
            ...data,
            entries: {
              ...data.entries,
              [id(identity)]: {
                identity,
                servers: {
                  ...bucket?.servers,
                  [serverUrl]: { ...entry, flows: { ...entry?.flows, [state]: { state } } },
                },
              },
            },
          },
          value: undefined,
        }
      })
    })

    const updateCodeVerifier = Effect.fn("McpAuth.updateCodeVerifier")(function* (
      identity: Identity,
      value: string,
      state: string,
      codeVerifier: string,
    ) {
      const serverUrl = normalizeServerUrl(value)
      yield* transact((data) => {
        const bucket = data.entries[id(identity)]
        const entry = bucket?.servers[serverUrl]
        const flow = entry?.flows?.[state]
        return {
          data: {
            ...data,
            entries: {
              ...data.entries,
              [id(identity)]: {
                identity,
                servers: {
                  ...bucket?.servers,
                  [serverUrl]: {
                    ...entry,
                    flows: { ...entry?.flows, [state]: { ...flow, state, codeVerifier } },
                  },
                },
              },
            },
          },
          value: undefined,
        }
      })
    })

    const getCodeVerifier = Effect.fn("McpAuth.getCodeVerifier")(function* (
      identity: Identity,
      serverUrl: string,
      state: string,
    ) {
      return (yield* get(identity, serverUrl))?.flows?.[state]?.codeVerifier
    })

    const clearFlow = Effect.fn("McpAuth.clearFlow")(function* (identity: Identity, value: string, state: string) {
      const serverUrl = normalizeServerUrl(value)
      yield* transact((data) => {
        const bucket = data.entries[id(identity)]
        const current = bucket?.servers[serverUrl]
        if (!current?.flows?.[state]) return { value: undefined }
        const flows = { ...current.flows }
        delete flows[state]
        const entry = { ...current, flows: Object.keys(flows).length ? flows : undefined }
        return {
          data: {
            ...data,
            entries: {
              ...data.entries,
              [id(identity)]: { identity, servers: { ...bucket.servers, [serverUrl]: entry } },
            },
          },
          value: undefined,
        }
      })
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
      startFlow,
      updateCodeVerifier,
      getCodeVerifier,
      clearFlow,
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
