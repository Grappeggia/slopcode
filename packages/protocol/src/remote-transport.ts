import { AbsolutePath, PositiveInt, Workspace } from "@opencode-ai/schema"
import { Schema, SchemaGetter, SchemaParser } from "effect"
import {
  RemoteEventCursor,
  RemoteHostID,
  RemoteIdempotencyKey,
  RemotePairingID,
  RemoteRequestID,
  RemoteVersion,
} from "./remote"

/**
 * Limits are part of the wire contract. They keep a JSON/WebSocket or
 * JSON-lines peer from turning a single frame into an unbounded allocation.
 */
export const RemoteTransportLimits = {
  maxHeaderCount: 64,
  maxHeaderNameBytes: 128,
  maxHeaderValueBytes: 8 * 1024,
  maxMetadataEntries: 32,
  maxMetadataKeyBytes: 128,
  maxMetadataValueBytes: 2 * 1024,
  maxMetadataBytes: 16 * 1024,
  // A regular HTTP body is carried in one JSON frame. Larger bodies must use
  // http.upload/http.upload.chunk, whose aggregate stream limit is separate.
  maxBodyBytes: 64 * 1024,
  maxChunkBytes: 64 * 1024,
  maxFrameBytes: 256 * 1024,
  maxQueryBytes: 8 * 1024,
  maxArrayBytes: 128 * 1024,
  maxReplayBytes: 128 * 1024,
  maxStreamBytes: 16 * 1024 * 1024,
  maxStreamWindowBytes: 256 * 1024,
  maxChallengeEntries: 1_024,
  maxIdempotencyEntries: 4_096,
  maxIdempotencyTtlMs: 10 * 60 * 1000,
  maxPathBytes: 4 * 1024,
  maxIdentifierBytes: 128,
  maxEventNameBytes: 128,
  maxReplayEvents: 100,
  maxPtyArguments: 64,
  maxPtyArgumentBytes: 1024,
  maxNotificationItems: 32,
} as const

const encoder = new TextEncoder()
const byteLength = (value: string) => encoder.encode(value).byteLength
const bounded = (max: number, message: string) =>
  Schema.String.check(Schema.makeFilter((value: string) => (byteLength(value) <= max ? undefined : message)))
const text = (max: number, message: string) => bounded(max, message).check(Schema.isMinLength(1))
const noControl = (message: string) =>
  Schema.makeFilter<string>((value) => (/[\u0000-\u001f\u007f-\u009f]/.test(value) ? message : undefined))

const jsonBytes = (value: unknown) => byteLength(JSON.stringify(value) ?? "")
const boundedPositive = (value: number | undefined, fallback: number, max: number) =>
  value === undefined || !Number.isFinite(value) ? fallback : Math.min(Math.max(value, 1), max)
const boundedCount = (value: number | undefined, fallback: number, max: number) =>
  Math.floor(boundedPositive(value, fallback, max))

const boundedArray = <S extends Schema.Top>(schema: S, count: number, bytes: number, message: string) =>
  Schema.Array(schema).check(
    Schema.isMaxLength(count),
    Schema.makeFilter((value) => (jsonBytes(value) <= bytes ? undefined : message)),
  )

const exact = <S extends Schema.Top>(schema: S) =>
  Schema.declareConstructor<S["Type"], S["Encoded"]>()([schema], ([codec]) => (u, _ast, options) =>
    SchemaParser.decodeUnknownEffect(codec, { ...options, onExcessProperty: "error" })(u),
  )

export const RemoteTransportVersion = RemoteVersion.annotate({ identifier: "RemoteTransportV1.Version" })
export type RemoteTransportVersion = typeof RemoteTransportVersion.Type

export const RemoteTransportRequestID = RemoteRequestID.pipe(
  Schema.check(Schema.isMaxLength(RemoteTransportLimits.maxIdentifierBytes)),
)
export type RemoteTransportRequestID = typeof RemoteTransportRequestID.Type

export const RemoteTransportIdempotencyKey = RemoteIdempotencyKey.pipe(
  Schema.check(Schema.isMaxLength(RemoteTransportLimits.maxIdentifierBytes)),
)
export type RemoteTransportIdempotencyKey = typeof RemoteTransportIdempotencyKey.Type

export const RemoteTransportEventCursor = RemoteEventCursor.pipe(
  Schema.check(Schema.isMaxLength(RemoteTransportLimits.maxIdentifierBytes)),
)
export type RemoteTransportEventCursor = typeof RemoteTransportEventCursor.Type

const isSafeAbsolutePath = (value: string) => {
  if (value === "/") return true
  if (
    !value.startsWith("/") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f-\u009f]/.test(value) ||
    value.includes("//")
  )
    return false
  return value
    .slice(1)
    .split("/")
    .every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
}

export const RemoteTransportRemoteDirectory = AbsolutePath.check(
  Schema.makeFilter<typeof AbsolutePath.Type>(
    (value) =>
      byteLength(value) <= RemoteTransportLimits.maxPathBytes && isSafeAbsolutePath(value)
        ? undefined
        : "remoteDirectory must be a bounded, normalized absolute POSIX path",
  ),
).pipe(Schema.brand("RemoteTransport.RemoteDirectory"))
export type RemoteTransportRemoteDirectory = typeof RemoteTransportRemoteDirectory.Type

export const RemoteTransportPath = RemoteTransportRemoteDirectory
export type RemoteTransportPath = typeof RemoteTransportPath.Type

const isWithin = (path: string, root: string) => root === "/" || path === root || path.startsWith(`${root}/`)

const decodeUrlComponent = (value: string) => {
  if (/%(?![0-9a-f]{2})/i.test(value)) return undefined
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

const isSafeHttpPath = (value: string) => {
  if (value === "/") return true
  if (!value.startsWith("/") || value.includes("\\") || value.includes("\u0000") || value.includes("//")) return false
  if (/[?#\r\n]/.test(value)) return false
  const decoded = decodeUrlComponent(value)
  if (
    decoded === undefined ||
    decoded.includes("%") ||
    /[\\\u0000-\u001f\u007f-\u009f?#]/.test(decoded)
  )
    return false
  const segments = decoded
    .slice(1)
    .split("/")
  return segments.every(
    (segment, index) =>
      (segment.length > 0 || index === segments.length - 1) && segment !== "." && segment !== "..",
  )
}

const HttpPath = text(RemoteTransportLimits.maxPathBytes, "HTTP path is too large").check(
  Schema.makeFilter((value: string) =>
    isSafeHttpPath(value) ? undefined : "HTTP path must be a scoped absolute path without traversal",
  ),
)

export const RemoteTransportQuery = bounded(RemoteTransportLimits.maxQueryBytes, "HTTP query is too large").check(
  noControl("HTTP query contains control characters"),
  Schema.makeFilter((value: string) => {
    if (value.includes("?") || value.includes("#") || value.includes("\\")) return "HTTP query contains unsafe delimiters"
    const decoded = decodeUrlComponent(value)
    return decoded === undefined || /[\u0000-\u001f\u007f-\u009f#]/.test(decoded)
      ? "HTTP query contains malformed encoding or unsafe decoded characters"
      : undefined
  }),
)
export type RemoteTransportQuery = typeof RemoteTransportQuery.Type

const FieldName = text(RemoteTransportLimits.maxMetadataKeyBytes, "metadata key is too large").check(
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
)
const HeaderName = text(RemoteTransportLimits.maxHeaderNameBytes, "header name is too large").check(
  Schema.isPattern(/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/),
)
const secretField = (value: string) =>
  /(?:password|passphrase|private[-_]?key|api[-_]?key|secret|token|authorization|cookie|credential)/i.test(value)
const SafeFieldName = FieldName.check(
  Schema.makeFilter((value: string) => (secretField(value) ? "secret-shaped fields are not transport metadata" : undefined)),
)
const SafeHeaderName = HeaderName.check(
  Schema.makeFilter((value: string) => (secretField(value) ? "secret-shaped fields are not transport headers" : undefined)),
)
const HeaderValue = bounded(RemoteTransportLimits.maxHeaderValueBytes, "header value is too large").check(
  noControl("header value contains control characters"),
)
const MetadataValue = bounded(RemoteTransportLimits.maxMetadataValueBytes, "metadata value is too large").check(
  noControl("metadata value contains control characters"),
)

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "proxy-connection",
])
const forwardingHeaders = new Set([
  "forward",
  "forwarded",
  "via",
  "x-client-ip",
  "x-cluster-client-ip",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-real-ip",
  "true-client-ip",
  "cf-connecting-ip",
])
const unsafeHeader = (name: string) => {
  const normalized = name.toLowerCase()
  return (
    hopByHopHeaders.has(normalized) ||
    forwardingHeaders.has(normalized) ||
    normalized.startsWith("x-forwarded-") ||
    normalized.startsWith("sec-websocket-")
  )
}
const prototypeKey = (name: string) => name === "__proto__" || name === "constructor" || name === "prototype"

const boundedRecord = <S extends Schema.Top>(
  schema: S,
  entries: number,
  bytes: number,
  message: string,
) =>
  schema.check(
    Schema.makeFilter<S["Type"]>((value) => {
      const values = Object.entries(value as Record<string, string>)
      if (values.length > entries) return `too many entries: ${message}`
      if (values.some(([key]) => prototypeKey(key))) return `prototype key is not allowed: ${message}`
      const size = values.reduce((sum, [key, item]) => sum + byteLength(key) + byteLength(item), 0)
      return size <= bytes ? undefined : message
    }),
  )

export const RemoteTransportHeaders = boundedRecord(
  Schema.Record(SafeHeaderName, HeaderValue),
  RemoteTransportLimits.maxHeaderCount,
  RemoteTransportLimits.maxHeaderCount *
    (RemoteTransportLimits.maxHeaderNameBytes + RemoteTransportLimits.maxHeaderValueBytes),
  "HTTP headers are too large",
).check(
  Schema.makeFilter((value) => {
    const names = new Set<string>()
    for (const [name] of Object.entries(value as Record<string, string>)) {
      const normalized = name.toLowerCase()
      if (names.has(normalized)) return "duplicate HTTP header names are not allowed"
      if (unsafeHeader(name)) return "hop-by-hop or forwarding HTTP headers are not allowed"
      names.add(normalized)
    }
    return undefined
  }),
)
export type RemoteTransportHeaders = typeof RemoteTransportHeaders.Type

/** Receivers should call this before forwarding a validated header map. */
export const normalizeRemoteTransportHeaders = (headers: RemoteTransportHeaders) =>
  Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]))

export const RemoteTransportMetadata = boundedRecord(
  Schema.Record(SafeFieldName, MetadataValue),
  RemoteTransportLimits.maxMetadataEntries,
  RemoteTransportLimits.maxMetadataBytes,
  "transport metadata is too large",
)
export type RemoteTransportMetadata = typeof RemoteTransportMetadata.Type

const boundedID = (prefix: string, message: string) =>
  text(RemoteTransportLimits.maxIdentifierBytes, message).pipe(
    Schema.check(Schema.isPattern(new RegExp(`^${prefix}[a-zA-Z0-9._:-]+$`))),
  )

const SessionID = boundedID("ses_", "session ID is too large").pipe(Schema.brand("RemoteTransport.SessionID"))
const PTYID = boundedID("pty_", "PTY ID is too large").pipe(Schema.brand("RemoteTransport.PTYID"))
const NotificationID = boundedID("ntf_", "notification ID is too large").pipe(
  Schema.brand("RemoteTransport.NotificationID"),
)
const EventName = text(RemoteTransportLimits.maxEventNameBytes, "event name is too large").pipe(
  Schema.check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)),
)
const Sequence = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1_000_000))
const TerminalSize = PositiveInt.check(Schema.isLessThanOrEqualTo(500))
const ExitCode = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(255))

const WorkspaceID = Workspace.ID.pipe(Schema.check(Schema.isMaxLength(RemoteTransportLimits.maxIdentifierBytes)))

export const RemoteTransportTarget = exact(
  Schema.Struct({
    hostID: RemoteHostID.pipe(Schema.check(Schema.isMaxLength(RemoteTransportLimits.maxIdentifierBytes))),
    pairingID: RemotePairingID.pipe(Schema.check(Schema.isMaxLength(RemoteTransportLimits.maxIdentifierBytes))),
    workspaceID: WorkspaceID,
    remoteDirectory: RemoteTransportRemoteDirectory,
  }),
).annotate({ identifier: "RemoteTransportV1.Target" })
export type RemoteTransportTarget = typeof RemoteTransportTarget.Type
export type RemoteTransportTargetEncoded = typeof RemoteTransportTarget.Encoded

export const RemoteTransportScope = RemoteTransportTarget
export type RemoteTransportScope = typeof RemoteTransportScope.Type

const sameTarget = (left: RemoteTransportTarget, right: RemoteTransportTarget) =>
  left.hostID === right.hostID &&
  left.pairingID === right.pairingID &&
  left.workspaceID === right.workspaceID &&
  left.remoteDirectory === right.remoteDirectory

const compareBytes = (left: string, right: string) => {
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  const length = Math.min(a.length, b.length)
  for (let index = 0; index < length; index++) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return a.length - b.length
}

const canonicalJson = (value: unknown, arrayItem = false): string | undefined => {
  if (value === undefined) return arrayItem ? "null" : undefined
  if (value === null || typeof value !== "object") {
    const result = JSON.stringify(value)
    if (result === undefined) throw new Error("remote transport value is not canonicalizable")
    return result
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item, true) ?? "null").join(",")}]`
  }
  const fields = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => compareBytes(left, right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
  return `{${fields.join(",")}}`
}

/**
 * Canonical JSON is UTF-8 JSON with recursively sorted object keys and no
 * undefined properties. It is the transcript used for target and request
 * digests; peers must hash this exact representation, not a local serializer.
 */
export const remoteTransportCanonicalJson = (value: unknown) => {
  const result = canonicalJson(value)
  if (result === undefined) throw new Error("remote transport value is not canonicalizable")
  return result
}

const sha256 = async (value: string) => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(value))
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, "0")).join("")
}

export const RemoteTransportTargetDigest = Schema.String.check(
  Schema.isMinLength(64),
  Schema.isMaxLength(64),
  Schema.isPattern(/^[0-9a-f]{64}$/),
).pipe(Schema.brand("RemoteTransport.TargetDigest"))
export type RemoteTransportTargetDigest = typeof RemoteTransportTargetDigest.Type

export const RemoteTransportRequestDigest = Schema.String.check(
  Schema.isMinLength(64),
  Schema.isMaxLength(64),
  Schema.isPattern(/^[0-9a-f]{64}$/),
).pipe(Schema.brand("RemoteTransport.RequestDigest"))
export type RemoteTransportRequestDigest = typeof RemoteTransportRequestDigest.Type

/** Computes the SHA-256 digest required in session auth.targetDigest. */
export const remoteTransportComputeTargetDigest = async (target: RemoteTransportTargetEncoded) =>
  sha256(remoteTransportCanonicalJson(target))

/**
 * These are the only request fields omitted from a request digest. In
 * particular, the client proof is excluded so the digest can be computed
 * before signing and the signature transcript can include the digest without
 * becoming circular.
 */
export const remoteTransportRequestDigestInput = <T extends object>(request: T) => {
  const input = Object.entries(request).reduce<Record<string, unknown>>((result, [key, value]) => {
    if (key !== "requestDigest") result[key] = value
    return result
  }, {})
  const auth = input.auth
  if (auth !== null && typeof auth === "object" && !Array.isArray(auth)) {
    input.auth = Object.entries(auth).reduce<Record<string, unknown>>((result, [key, value]) => {
      if (key !== "proof") result[key] = value
      return result
    }, {})
  }
  return input
}

/** Computes SHA-256 after applying the explicit request digest exclusions. */
export const remoteTransportComputeRequestDigest = async <T extends object>(request: T) =>
  sha256(remoteTransportCanonicalJson(remoteTransportRequestDigestInput(request)))

export const remoteTransportVerifyRequestDigest = async <T extends { requestDigest: string }>(request: T) =>
  request.requestDigest === (await remoteTransportComputeRequestDigest(request))

/**
 * Idempotency is scoped by the authenticated session, exact target, and the
 * canonical request digest. A receiver should use this value as its replay
 * key and reject an existing key whose digest differs.
 */
export const remoteTransportIdempotencyBinding = (
  sessionID: string,
  target: RemoteTransportTarget,
  idempotencyKey: RemoteTransportIdempotencyKey,
  requestDigest: RemoteTransportRequestDigest,
) =>
  remoteTransportCanonicalJson({
    sessionID,
    target,
    idempotencyKey,
    requestDigest,
  })

export type RemoteTransportIdempotencyState = "in-flight" | "completed"

export type RemoteTransportIdempotencyClaim =
  | Readonly<{ status: "accepted"; replay: boolean; state: RemoteTransportIdempotencyState }>
  | Readonly<{ status: "conflict"; requestDigest: RemoteTransportRequestDigest }>
  | Readonly<{ status: "invalid-digest"; expected: string }>
  | Readonly<{ status: "target-mismatch" }>
  | Readonly<{ status: "capacity" }>

export type RemoteTransportIdempotencyStore = Readonly<{
  /** This operation must be implemented as one atomic compare-and-set. */
  claim: (
    sessionID: string,
    registeredTarget: RemoteTransportTarget,
    idempotencyKey: RemoteTransportIdempotencyKey,
    requestDigest: RemoteTransportRequestDigest,
    now?: number,
  ) => RemoteTransportIdempotencyClaim
  /** Marks an in-flight claim complete while retaining its replay binding. */
  complete: (
    sessionID: string,
    registeredTarget: RemoteTransportTarget,
    idempotencyKey: RemoteTransportIdempotencyKey,
    requestDigest: RemoteTransportRequestDigest,
    now?: number,
  ) => boolean
  /** Releases only an in-flight claim so a failed request can be retried. */
  release: (
    sessionID: string,
    registeredTarget: RemoteTransportTarget,
    idempotencyKey: RemoteTransportIdempotencyKey,
    requestDigest: RemoteTransportRequestDigest,
    now?: number,
  ) => boolean
  prune: (now?: number) => void
}>

export type RemoteTransportIdempotencyStoreOptions = Readonly<{
  maxEntries?: number
  ttlMs?: number
}>

/**
 * Creates a process-local atomic idempotency store. A multi-process server
 * should implement the same claim operation with a transactional unique key
 * on (sessionID, target, idempotencyKey).
 */
export const createRemoteTransportIdempotencyStore = (
  options: RemoteTransportIdempotencyStoreOptions = {},
): RemoteTransportIdempotencyStore => {
  const maxEntries = boundedCount(options.maxEntries, RemoteTransportLimits.maxIdempotencyEntries, RemoteTransportLimits.maxIdempotencyEntries)
  const ttlMs = boundedPositive(options.ttlMs, RemoteTransportLimits.maxIdempotencyTtlMs, RemoteTransportLimits.maxIdempotencyTtlMs)
  const records = new Map<
    string,
    {
      digest: RemoteTransportRequestDigest
      state: RemoteTransportIdempotencyState
      expiresAt: number
    }
  >()
  const key = (sessionID: string, target: RemoteTransportTarget, idempotencyKey: RemoteTransportIdempotencyKey) =>
    remoteTransportCanonicalJson({ sessionID, target, idempotencyKey })
  const prune = (now: number) => {
    for (const [id, record] of records) if (record.expiresAt <= now) records.delete(id)
  }
  return {
    claim: (sessionID, target, idempotencyKey, requestDigest, now = Date.now()) => {
      prune(now)
      const id = key(sessionID, target, idempotencyKey)
      const previous = records.get(id)
      if (previous !== undefined) {
        return previous.digest === requestDigest
          ? { status: "accepted", replay: true, state: previous.state }
          : { status: "conflict", requestDigest: previous.digest }
      }
      if (records.size >= maxEntries) return { status: "capacity" }
      records.set(id, { digest: requestDigest, state: "in-flight", expiresAt: now + ttlMs })
      return { status: "accepted", replay: false, state: "in-flight" }
    },
    complete: (sessionID, target, idempotencyKey, requestDigest, now = Date.now()) => {
      prune(now)
      const record = records.get(key(sessionID, target, idempotencyKey))
      if (record === undefined || record.digest !== requestDigest || record.state !== "in-flight") return false
      record.state = "completed"
      return true
    },
    release: (sessionID, target, idempotencyKey, requestDigest, now = Date.now()) => {
      prune(now)
      const id = key(sessionID, target, idempotencyKey)
      const record = records.get(id)
      if (record === undefined || record.digest !== requestDigest || record.state !== "in-flight") return false
      records.delete(id)
      return true
    },
    prune: (now = Date.now()) => prune(now),
  }
}

/** Verifies a request digest before atomically claiming its idempotency key. */
export const remoteTransportClaimIdempotency = async <
  T extends {
    idempotencyKey: RemoteTransportIdempotencyKey
    requestDigest: RemoteTransportRequestDigest
    target: RemoteTransportTarget
  },
>(store: RemoteTransportIdempotencyStore, sessionID: string, registeredTarget: RemoteTransportTarget, request: T, now?: number) => {
  if (!sameTarget(request.target, registeredTarget)) return { status: "target-mismatch" } as const
  const expected = await remoteTransportComputeRequestDigest(request)
  if (request.requestDigest !== expected) return { status: "invalid-digest", expected } as const
  return store.claim(sessionID, registeredTarget, request.idempotencyKey, request.requestDigest, now)
}

export const remoteTransportCompleteIdempotency = (
  store: RemoteTransportIdempotencyStore,
  sessionID: string,
  registeredTarget: RemoteTransportTarget,
  idempotencyKey: RemoteTransportIdempotencyKey,
  requestDigest: RemoteTransportRequestDigest,
  now?: number,
) => store.complete(sessionID, registeredTarget, idempotencyKey, requestDigest, now)

export const remoteTransportReleaseIdempotency = (
  store: RemoteTransportIdempotencyStore,
  sessionID: string,
  registeredTarget: RemoteTransportTarget,
  idempotencyKey: RemoteTransportIdempotencyKey,
  requestDigest: RemoteTransportRequestDigest,
  now?: number,
) => store.release(sessionID, registeredTarget, idempotencyKey, requestDigest, now)

const Base64Url = text(512, "base64url value is too large").check(
  Schema.isPattern(/^[A-Za-z0-9_-]+$/),
  noControl("base64url value contains control characters"),
)

export const remoteTransportDecodeBase64Url = (value: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return undefined
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (item) => item.charCodeAt(0))
    return remoteTransportEncodeBase64Url(bytes) === value ? bytes : undefined
  } catch {
    return undefined
  }
}

export const remoteTransportEncodeBase64Url = (value: Uint8Array) => {
  let binary = ""
  for (const item of value) binary += String.fromCharCode(item)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export const RemoteTransportSignature = Base64Url.check(
  Schema.makeFilter((value: string) => {
    const bytes = remoteTransportDecodeBase64Url(value)
    return bytes !== undefined && bytes.byteLength === 64 && value.length === 86
      ? undefined
      : "Ed25519 signatures must be exactly 64 bytes of unpadded base64url"
  }),
).annotate({ identifier: "RemoteTransportV1.Ed25519Signature" })
export type RemoteTransportSignature = typeof RemoteTransportSignature.Type

const Nonce = Base64Url.check(Schema.isMinLength(16))
const Timestamp = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(9_999_999_999_999))
const ChallengeID = boundedID("chl_", "challenge ID is too large").pipe(Schema.brand("RemoteTransport.ChallengeID"))

export const RemoteTransportChallenge = exact(
  Schema.Struct({
    issuer: Schema.Literal("server"),
    id: ChallengeID,
    nonce: Nonce,
    issuedAt: Timestamp,
    expiresAt: Timestamp,
    oneTime: Schema.Literal(true),
  }),
).check(
  Schema.makeFilter((value) =>
    value.expiresAt > value.issuedAt && value.expiresAt - value.issuedAt <= 5 * 60 * 1000
      ? undefined
      : "challenge must expire within five minutes and after issuance",
  ),
).annotate({ identifier: "RemoteTransportV1.Challenge" })
export type RemoteTransportChallenge = typeof RemoteTransportChallenge.Type

export const RemoteTransportSessionProof = exact(
  Schema.Struct({
    algorithm: Schema.Literal("ed25519"),
    encoding: Schema.Literal("base64url"),
    signature: RemoteTransportSignature,
  }),
).annotate({ identifier: "RemoteTransportV1.SessionProof" })
export type RemoteTransportSessionProof = typeof RemoteTransportSessionProof.Type

export const RemoteTransportSessionAuth = exact(
  Schema.Struct({
    method: Schema.Literal("pairing-signature"),
    pairingID: RemotePairingID,
    target: RemoteTransportTarget,
    targetDigest: RemoteTransportTargetDigest,
    challenge: RemoteTransportChallenge,
    proof: RemoteTransportSessionProof,
  }),
).annotate({ identifier: "RemoteTransportV1.SessionAuth" })
export type RemoteTransportSessionAuth = typeof RemoteTransportSessionAuth.Type

const requestFields = {
  version: RemoteTransportVersion,
  kind: Schema.Literal("request"),
  requestID: RemoteTransportRequestID,
  idempotencyKey: RemoteTransportIdempotencyKey,
  requestDigest: RemoteTransportRequestDigest,
  target: RemoteTransportTarget,
}
const responseFields = {
  version: RemoteTransportVersion,
  kind: Schema.Literal("response"),
  requestID: RemoteTransportRequestID,
  idempotencyKey: RemoteTransportIdempotencyKey,
  requestDigest: RemoteTransportRequestDigest,
  target: RemoteTransportTarget,
}
const streamFields = {
  version: RemoteTransportVersion,
  kind: Schema.Literal("stream"),
  requestID: RemoteTransportRequestID,
  idempotencyKey: RemoteTransportIdempotencyKey,
  requestDigest: RemoteTransportRequestDigest,
  target: RemoteTransportTarget,
}
const eventFields = {
  version: RemoteTransportVersion,
  kind: Schema.Literal("event"),
  target: RemoteTransportTarget,
  cursor: Schema.optional(RemoteTransportEventCursor),
}

/**
 * v1 strict semantics are negotiated explicitly. An updated peer must not
 * silently fall back to a legacy proof, frame, or upload interpretation.
 */
export const RemoteTransportFeature = Schema.Literals([
  "proof.ed25519.v1",
  "frame.bounds.v1",
  "http.upload.v1",
])
export type RemoteTransportFeature = typeof RemoteTransportFeature.Type

const requiredFeatures: ReadonlyArray<RemoteTransportFeature> = [
  "proof.ed25519.v1",
  "frame.bounds.v1",
  "http.upload.v1",
]
const featureList = boundedArray(
  RemoteTransportFeature,
  requiredFeatures.length,
  RemoteTransportLimits.maxArrayBytes,
  "remote transport feature list is too large",
).check(
  Schema.makeFilter((value) =>
    new Set(value).size === value.length ? undefined : "remote transport feature list contains duplicates",
  ),
)

export const RemoteTransportCapabilities = exact(
  Schema.Struct({
    offered: featureList,
    required: featureList,
  }),
).check(
  Schema.makeFilter((value) =>
    requiredFeatures.every((feature) => value.required.includes(feature) && value.offered.includes(feature))
      ? undefined
      : "strict v1 capabilities are required",
  ),
).annotate({ identifier: "RemoteTransportV1.Capabilities" })
export type RemoteTransportCapabilities = typeof RemoteTransportCapabilities.Type

export const RemoteTransportAcceptedCapabilities = exact(
  Schema.Struct({ accepted: featureList }),
).check(
  Schema.makeFilter((value) =>
    requiredFeatures.every((feature) => value.accepted.includes(feature))
      ? undefined
      : "strict v1 capabilities were not negotiated",
  ),
).annotate({ identifier: "RemoteTransportV1.AcceptedCapabilities" })
export type RemoteTransportAcceptedCapabilities = typeof RemoteTransportAcceptedCapabilities.Type

export const remoteTransportCapabilitiesMatch = (
  offered: RemoteTransportCapabilities,
  accepted: RemoteTransportAcceptedCapabilities,
) =>
  accepted.accepted.every((feature) => offered.offered.includes(feature)) &&
  offered.required.every((feature) => accepted.accepted.includes(feature))

const sessionOpenShape = Schema.Struct({
  ...requestFields,
  type: Schema.Literal("session.open"),
  capabilities: RemoteTransportCapabilities,
  auth: RemoteTransportSessionAuth,
})
export const RemoteTransportSessionOpen = exact(sessionOpenShape)
  .check(
    Schema.makeFilter<typeof sessionOpenShape.Type>((value) => {
      if (value.auth.pairingID !== value.target.pairingID) return "session auth pairingID is outside target scope"
      if (!sameTarget(value.auth.target, value.target)) return "session auth target copy does not match request target"
      return undefined
    }),
  )
  .annotate({ identifier: "RemoteTransportV1.SessionOpen" })
export type RemoteTransportSessionOpen = typeof RemoteTransportSessionOpen.Type

/**
 * The signature covers this canonical transcript. The server issues the
 * challenge; the client signs it once with its pairing key. The requestDigest
 * in the transcript is computed with auth.proof excluded, so signing cannot
 * create a circular digest.
 */
export const remoteTransportSessionProofTranscript = (open: RemoteTransportSessionOpen) =>
  remoteTransportCanonicalJson({
    domain: "slopcode-remote-v1",
    version: open.version,
    type: open.type,
    requestID: open.requestID,
    idempotencyKey: open.idempotencyKey,
    requestDigest: open.requestDigest,
    target: open.target,
    authTarget: open.auth.target,
    targetDigest: open.auth.targetDigest,
    pairingID: open.auth.pairingID,
    challenge: open.auth.challenge,
    capabilities: open.capabilities,
  })

const remoteTransportSessionAuthScopeMatches = async (
  open: RemoteTransportSessionOpen,
  registeredTarget: RemoteTransportTarget,
) =>
  sameTarget(open.target, registeredTarget) &&
  sameTarget(open.auth.target, registeredTarget) &&
  open.auth.pairingID === registeredTarget.pairingID &&
  open.auth.targetDigest === (await remoteTransportComputeTargetDigest(registeredTarget)) &&
  (await remoteTransportVerifyRequestDigest(open))

export const remoteTransportChallengeIsFresh = (
  challenge: RemoteTransportChallenge,
  now = Date.now(),
) => challenge.issuedAt <= now && now < challenge.expiresAt

export type RemoteTransportChallengeStore = Readonly<{
  /** Checks exact server issuance and freshness without consuming the challenge. */
  check: (challenge: RemoteTransportChallenge, now?: number) => boolean
  /** This operation must atomically compare, validate, and consume a challenge. */
  consume: (challenge: RemoteTransportChallenge, now?: number) => boolean
}>

export type RemoteTransportChallengeStoreOptions = Readonly<{
  maxEntries?: number
  ttlMs?: number
}>

export type RemoteTransportChallengeIssuer = RemoteTransportChallengeStore &
  Readonly<{
    issue: (now?: number, ttlMs?: number) => RemoteTransportChallenge
  }>

/**
 * Creates a bounded process-local challenge store with an atomic consume operation.
 * A multi-process server should replace consume with a transactional
 * compare-and-delete keyed by challenge ID and the complete challenge value.
 */
export const createRemoteTransportChallengeStore = (
  options: RemoteTransportChallengeStoreOptions = {},
): RemoteTransportChallengeIssuer => {
  const maxEntries = boundedCount(options.maxEntries, RemoteTransportLimits.maxChallengeEntries, RemoteTransportLimits.maxChallengeEntries)
  const ttlMs = boundedPositive(options.ttlMs, 60_000, 5 * 60 * 1000)
  const pending = new Map<string, RemoteTransportChallenge>()
  const prune = (now: number) => {
    for (const [id, challenge] of pending) if (!remoteTransportChallengeIsFresh(challenge, now)) pending.delete(id)
  }
  const matches = (challenge: RemoteTransportChallenge, now: number) => {
    const stored = pending.get(challenge.id)
    return (
      stored !== undefined &&
      remoteTransportCanonicalJson(stored) === remoteTransportCanonicalJson(challenge) &&
      remoteTransportChallengeIsFresh(stored, now)
    )
  }
  return {
    issue: (now = Date.now(), requestedTtlMs = ttlMs) => {
      prune(now)
      if (pending.size >= maxEntries) throw new Error("remote transport challenge store is full")
      const expiresAt = now + boundedPositive(requestedTtlMs, ttlMs, 5 * 60 * 1000)
      const challenge = Schema.decodeUnknownSync(RemoteTransportChallenge)({
        issuer: "server",
        id: `chl_${remoteTransportEncodeBase64Url(globalThis.crypto.getRandomValues(new Uint8Array(18)))}`,
        nonce: remoteTransportEncodeBase64Url(globalThis.crypto.getRandomValues(new Uint8Array(24))),
        issuedAt: now,
        expiresAt,
        oneTime: true,
      })
      pending.set(challenge.id, challenge)
      return challenge
    },
    check: (challenge, now = Date.now()) => {
      prune(now)
      return matches(challenge, now)
    },
    consume: (challenge, now = Date.now()) => {
      prune(now)
      if (!matches(challenge, now)) return false
      pending.delete(challenge.id)
      return true
    },
  }
}

export type RemoteTransportPublicKeyVerifier =
  | CryptoKey
  | ((transcript: Uint8Array, signature: Uint8Array) => boolean | Promise<boolean>)

/**
 * Verifies a session open against the registered target, registered pairing
 * public key/verifier, and a synchronized one-time challenge store.
 */
export const remoteTransportVerifySessionProof = async (
  open: RemoteTransportSessionOpen,
  registeredTarget: RemoteTransportTarget,
  verifier: RemoteTransportPublicKeyVerifier,
  challenges: RemoteTransportChallengeStore,
  now = Date.now(),
) => {
  if (!(await remoteTransportSessionAuthScopeMatches(open, registeredTarget))) return false
  if (!challenges.check(open.auth.challenge, now)) return false
  const signature = remoteTransportDecodeBase64Url(open.auth.proof.signature)
  if (signature === undefined || signature.byteLength !== 64) return false
  const transcript = encoder.encode(remoteTransportSessionProofTranscript(open))
  const verified =
    typeof verifier === "function"
      ? await verifier(transcript, signature)
      : verifier.type === "public" && verifier.algorithm.name === "Ed25519"
        ? await globalThis.crypto.subtle.verify("Ed25519", verifier, signature, transcript)
        : false
  return verified && challenges.consume(open.auth.challenge, now)
}

/** Fails closed unless a registered target, verifier, and challenge store are supplied. */
export const remoteTransportSessionAuthMatches = async (
  open: RemoteTransportSessionOpen,
  registeredTarget?: RemoteTransportTarget,
  verifier?: RemoteTransportPublicKeyVerifier,
  challenges?: RemoteTransportChallengeStore,
  now = Date.now(),
) => {
  if (registeredTarget === undefined || verifier === undefined || challenges === undefined) return false
  return remoteTransportVerifySessionProof(open, registeredTarget, verifier, challenges, now)
}

export const RemoteTransportSessionClose = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("session.close"),
    sessionID: SessionID,
    reason: Schema.optional(text(2 * 1024, "session close reason is too large")),
  }),
).annotate({ identifier: "RemoteTransportV1.SessionClose" })
export type RemoteTransportSessionClose = typeof RemoteTransportSessionClose.Type

export const RemoteTransportSessionOpened = exact(
  Schema.Struct({
    ...responseFields,
    type: Schema.Literal("session.opened"),
    sessionID: SessionID,
    capabilities: RemoteTransportAcceptedCapabilities,
  }),
).annotate({ identifier: "RemoteTransportV1.SessionOpened" })
export type RemoteTransportSessionOpened = typeof RemoteTransportSessionOpened.Type

export const RemoteTransportSessionClosed = exact(
  Schema.Struct({
    ...responseFields,
    type: Schema.Literal("session.closed"),
    sessionID: SessionID,
  }),
).annotate({ identifier: "RemoteTransportV1.SessionClosed" })
export type RemoteTransportSessionClosed = typeof RemoteTransportSessionClosed.Type

const base64ByteLength = (value: string) => {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return -1
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0
  return value.length / 4 * 3 - padding
}

const base64Data = (max: number, message: string) =>
  bounded(Math.ceil(max * 4 / 3) + 4, message).check(
    Schema.makeFilter((value: string) =>
      base64ByteLength(value) >= 0 && base64ByteLength(value) <= max ? undefined : message,
    ),
  )

const makeBody = (max: number, message: string) =>
  exact(
    Schema.Union([
      exact(
        Schema.Struct({
          encoding: Schema.Literal("utf8"),
          data: bounded(max, message),
        }),
      ),
      exact(
        Schema.Struct({
          encoding: Schema.Literal("base64"),
          data: base64Data(max, message),
        }),
      ),
    ]),
  )

/**
 * Bodies are intentionally discriminated. utf8 is measured after UTF-8
 * encoding; base64 is canonical standard Base64 and measured after decode.
 * Receivers must decode once and never reinterpret either form as a URL or
 * another charset. The 64 KiB single-frame limit leaves room for the JSON
 * envelope; use http.upload for larger binary operations.
 */
export const RemoteTransportBody = makeBody(RemoteTransportLimits.maxBodyBytes, "HTTP body is too large")
export type RemoteTransportBody = typeof RemoteTransportBody.Type

export const RemoteTransportBodyChunk = makeBody(RemoteTransportLimits.maxChunkBytes, "body chunk is too large")
export type RemoteTransportBodyChunk = typeof RemoteTransportBodyChunk.Type

const bodyByteLength = (body: RemoteTransportBody | RemoteTransportBodyChunk) =>
  body.encoding === "utf8" ? byteLength(body.data) : base64ByteLength(body.data)

const HttpMethod = Schema.Literals(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
const HttpStatus = Schema.Int.check(Schema.isGreaterThanOrEqualTo(100), Schema.isLessThanOrEqualTo(599))
const UploadLength = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(RemoteTransportLimits.maxStreamBytes),
)

/** Opens a bounded, ordered HTTP request-body stream. */
export const RemoteTransportHttpUpload = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("http.upload"),
    method: HttpMethod,
    path: HttpPath,
    query: Schema.optional(RemoteTransportQuery),
    headers: Schema.optional(RemoteTransportHeaders),
    contentLength: UploadLength,
  }),
).annotate({ identifier: "RemoteTransportV1.HttpUpload" })
export type RemoteTransportHttpUpload = typeof RemoteTransportHttpUpload.Type

export const RemoteTransportHttpRequest = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("http.request"),
    method: HttpMethod,
    path: HttpPath,
    query: Schema.optional(RemoteTransportQuery),
    headers: Schema.optional(RemoteTransportHeaders),
    body: Schema.optional(RemoteTransportBody),
  }),
).annotate({ identifier: "RemoteTransportV1.HttpRequest" })
export type RemoteTransportHttpRequest = typeof RemoteTransportHttpRequest.Type

export const RemoteTransportHttpResponse = exact(
  Schema.Struct({
    ...responseFields,
    type: Schema.Literal("http.response"),
    status: HttpStatus,
    headers: Schema.optional(RemoteTransportHeaders),
    body: Schema.optional(RemoteTransportBody),
  }),
).annotate({ identifier: "RemoteTransportV1.HttpResponse" })
export type RemoteTransportHttpResponse = typeof RemoteTransportHttpResponse.Type

export const RemoteTransportHttpChunk = exact(
  Schema.Struct({
    ...streamFields,
    type: Schema.Literal("http.chunk"),
    sequence: Sequence,
    chunk: RemoteTransportBodyChunk,
    final: Schema.Boolean,
  }),
).annotate({ identifier: "RemoteTransportV1.HttpChunk" })
export type RemoteTransportHttpChunk = typeof RemoteTransportHttpChunk.Type

export const RemoteTransportHttpUploadChunk = exact(
  Schema.Struct({
    ...streamFields,
    type: Schema.Literal("http.upload.chunk"),
    sequence: Sequence,
    chunk: RemoteTransportBodyChunk,
    final: Schema.Boolean,
  }),
).annotate({ identifier: "RemoteTransportV1.HttpUploadChunk" })
export type RemoteTransportHttpUploadChunk = typeof RemoteTransportHttpUploadChunk.Type

export const RemoteTransportEventReplayRequest = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("event.replay"),
    cursor: Schema.optional(RemoteTransportEventCursor),
    limit: PositiveInt.check(Schema.isLessThanOrEqualTo(RemoteTransportLimits.maxReplayEvents)),
  }),
).annotate({ identifier: "RemoteTransportV1.EventReplayRequest" })
export type RemoteTransportEventReplayRequest = typeof RemoteTransportEventReplayRequest.Type

export const RemoteTransportSseEvent = exact(
  Schema.Struct({
    ...eventFields,
    type: Schema.Literal("event"),
    cursor: RemoteTransportEventCursor,
    event: EventName,
    data: RemoteTransportBodyChunk,
    replayed: Schema.optional(Schema.Boolean),
    metadata: Schema.optional(RemoteTransportMetadata),
  }),
).annotate({ identifier: "RemoteTransportV1.SseEvent" })
export type RemoteTransportSseEvent = typeof RemoteTransportSseEvent.Type

const eventReplayResponseShape = Schema.Struct({
  ...responseFields,
  type: Schema.Literal("event.replay"),
  events: boundedArray(
    RemoteTransportSseEvent,
    RemoteTransportLimits.maxReplayEvents,
    RemoteTransportLimits.maxReplayBytes,
    "event replay is too large",
  ),
  nextCursor: Schema.optional(RemoteTransportEventCursor),
  hasMore: Schema.Boolean,
})
export const RemoteTransportEventReplayResponse = exact(eventReplayResponseShape)
  .check(
    Schema.makeFilter<typeof eventReplayResponseShape.Type>((value) =>
      value.events.every((event) => sameTarget(event.target, value.target))
        ? (() => {
            const cursors = new Set<string>()
            for (const event of value.events) {
              if (cursors.has(event.cursor)) return "replayed event cursors must be unique"
              cursors.add(event.cursor)
            }
            if (value.nextCursor !== undefined && cursors.has(value.nextCursor)) {
              return "nextCursor must not duplicate a replayed event cursor"
            }
            return jsonBytes(value.events) <= RemoteTransportLimits.maxReplayBytes &&
              value.events.reduce((sum, event) => sum + bodyByteLength(event.data), 0) <=
                RemoteTransportLimits.maxReplayBytes
              ? undefined
              : "event replay data is too large"
          })()
        : "replayed event target is outside response scope",
    ),
  )
  .annotate({ identifier: "RemoteTransportV1.EventReplayResponse" })
export type RemoteTransportEventReplayResponse = typeof RemoteTransportEventReplayResponse.Type

const PtyCommand = text(2 * 1024, "PTY command is too large").check(noControl("PTY command contains NUL"))
const PtyArgument = bounded(RemoteTransportLimits.maxPtyArgumentBytes, "PTY argument is too large").check(
  noControl("PTY argument contains NUL"),
)
const PtyArguments = boundedArray(
  PtyArgument,
  RemoteTransportLimits.maxPtyArguments,
  RemoteTransportLimits.maxArrayBytes,
  "PTY arguments are too large",
)

const ptyOpenShape = Schema.Struct({
  ...requestFields,
  type: Schema.Literal("pty.open"),
  ptyID: Schema.optional(PTYID),
  command: Schema.optional(PtyCommand),
  args: Schema.optional(PtyArguments),
  cwd: Schema.optional(RemoteTransportRemoteDirectory),
  rows: TerminalSize,
  cols: TerminalSize,
})
export const RemoteTransportPtyOpen = exact(ptyOpenShape).check(
  Schema.makeFilter<typeof ptyOpenShape.Type>((value) => {
    if (value.cwd === undefined) return undefined
    return isWithin(value.cwd, value.target.remoteDirectory) ? undefined : "PTY cwd is outside target remoteDirectory"
  }),
)
export type RemoteTransportPtyOpen = typeof RemoteTransportPtyOpen.Type

export const RemoteTransportPtyOpened = exact(
  Schema.Struct({
    ...responseFields,
    type: Schema.Literal("pty.opened"),
    ptyID: PTYID,
    rows: TerminalSize,
    cols: TerminalSize,
  }),
).annotate({ identifier: "RemoteTransportV1.PtyOpened" })
export type RemoteTransportPtyOpened = typeof RemoteTransportPtyOpened.Type

export const RemoteTransportPtyInput = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("pty.input"),
    ptyID: PTYID,
    chunk: RemoteTransportBodyChunk,
  }),
).annotate({ identifier: "RemoteTransportV1.PtyInput" })
export type RemoteTransportPtyInput = typeof RemoteTransportPtyInput.Type

export const RemoteTransportPtyResize = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("pty.resize"),
    ptyID: PTYID,
    rows: TerminalSize,
    cols: TerminalSize,
  }),
).annotate({ identifier: "RemoteTransportV1.PtyResize" })
export type RemoteTransportPtyResize = typeof RemoteTransportPtyResize.Type

export const RemoteTransportPtyOutput = exact(
  Schema.Struct({
    ...streamFields,
    type: Schema.Literal("pty.output"),
    ptyID: PTYID,
    sequence: Sequence,
    chunk: RemoteTransportBodyChunk,
    final: Schema.Boolean,
  }),
).annotate({ identifier: "RemoteTransportV1.PtyOutput" })
export type RemoteTransportPtyOutput = typeof RemoteTransportPtyOutput.Type

export type RemoteTransportStreamState = Readonly<{
  nextSequence: number
  final: boolean
  totalBytes: number
  windowBytes: number
  maxBytes: number
  maxWindowBytes: number
  expectedBytes?: number
}>

export const remoteTransportCreateStreamState = (
  maxBytes = RemoteTransportLimits.maxStreamBytes,
  maxWindowBytes = RemoteTransportLimits.maxStreamWindowBytes,
  expectedBytes?: number,
): RemoteTransportStreamState => ({
  nextSequence: 0,
  final: false,
  totalBytes: 0,
  windowBytes: 0,
  maxBytes: Math.min(maxBytes, RemoteTransportLimits.maxStreamBytes),
  maxWindowBytes: Math.min(maxWindowBytes, RemoteTransportLimits.maxStreamWindowBytes),
  expectedBytes: expectedBytes === undefined ? undefined : Math.min(expectedBytes, RemoteTransportLimits.maxStreamBytes),
})

export const RemoteTransportInitialStreamState = remoteTransportCreateStreamState()

export const remoteTransportCreateUploadStreamState = (
  upload: Pick<RemoteTransportHttpUpload, "contentLength">,
) => remoteTransportCreateStreamState(RemoteTransportLimits.maxStreamBytes, RemoteTransportLimits.maxStreamWindowBytes, upload.contentLength)

/**
 * Advances a stream only for the next sequence number. Once a final chunk is
 * accepted, every later chunk is rejected, which makes duplicate finals and
 * post-final data replay-safe.
 */
export const remoteTransportAdvanceStream = (
  state: RemoteTransportStreamState,
  chunk: Pick<RemoteTransportHttpChunk | RemoteTransportHttpUploadChunk | RemoteTransportPtyOutput, "sequence" | "final" | "chunk">,
) => {
  if (state.final || chunk.sequence !== state.nextSequence) return undefined
  const bytes = bodyByteLength(chunk.chunk)
  const totalBytes = state.totalBytes + bytes
  if (
    totalBytes > state.maxBytes ||
    (state.expectedBytes !== undefined && totalBytes > state.expectedBytes) ||
    state.windowBytes + bytes > state.maxWindowBytes ||
    (chunk.final && state.expectedBytes !== undefined && totalBytes !== state.expectedBytes)
  )
    return undefined
  return {
    nextSequence: state.nextSequence + 1,
    final: chunk.final,
    totalBytes,
    windowBytes: state.windowBytes + bytes,
    maxBytes: state.maxBytes,
    maxWindowBytes: state.maxWindowBytes,
    expectedBytes: state.expectedBytes,
  } satisfies RemoteTransportStreamState
}

/** Records downstream consumption so a producer can receive another window. */
export const remoteTransportAcknowledgeStream = (state: RemoteTransportStreamState, bytes: number) => {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > state.windowBytes) return undefined
  return { ...state, windowBytes: state.windowBytes - bytes } satisfies RemoteTransportStreamState
}

export const remoteTransportStreamComplete = (state: RemoteTransportStreamState) =>
  state.final && (state.expectedBytes === undefined || state.totalBytes === state.expectedBytes)

export const RemoteTransportPtyClose = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("pty.close"),
    ptyID: PTYID,
  }),
).annotate({ identifier: "RemoteTransportV1.PtyClose" })
export type RemoteTransportPtyClose = typeof RemoteTransportPtyClose.Type

export const RemoteTransportPtyClosed = exact(
  Schema.Struct({
    ...responseFields,
    type: Schema.Literal("pty.closed"),
    ptyID: PTYID,
    exitCode: Schema.optional(ExitCode),
  }),
).annotate({ identifier: "RemoteTransportV1.PtyClosed" })
export type RemoteTransportPtyClosed = typeof RemoteTransportPtyClosed.Type

const NotificationFields = {
  ...eventFields,
  notificationID: NotificationID,
  requestID: Schema.optional(RemoteTransportRequestID),
}
const NotificationItems = boundedArray(
  text(2 * 1024, "notification item is too large"),
  RemoteTransportLimits.maxNotificationItems,
  RemoteTransportLimits.maxArrayBytes,
  "notification items are too large",
)

export const RemoteTransportApprovalNotification = exact(
  Schema.Struct({
    ...NotificationFields,
    type: Schema.Literal("approval.request"),
    action: text(512, "approval action is too large"),
    resources: NotificationItems,
    reason: text(2 * 1024, "approval reason is too large"),
    metadata: Schema.optional(RemoteTransportMetadata),
  }),
).annotate({ identifier: "RemoteTransportV1.ApprovalNotification" })
export type RemoteTransportApprovalNotification = typeof RemoteTransportApprovalNotification.Type

const QuestionOption = exact(
  Schema.Struct({
    label: text(256, "question option label is too large"),
    value: text(256, "question option value is too large"),
  }),
)
const QuestionPrompt = exact(
  Schema.Struct({
    question: text(2 * 1024, "question text is too large"),
    header: Schema.optional(text(128, "question header is too large")),
    options: boundedArray(QuestionOption, 16, RemoteTransportLimits.maxArrayBytes, "question options are too large"),
    multiple: Schema.Boolean,
  }),
)

export const RemoteTransportQuestionNotification = exact(
  Schema.Struct({
    ...NotificationFields,
    type: Schema.Literal("question.request"),
    questions: boundedArray(QuestionPrompt, 8, RemoteTransportLimits.maxArrayBytes, "questions are too large"),
    metadata: Schema.optional(RemoteTransportMetadata),
  }),
).annotate({ identifier: "RemoteTransportV1.QuestionNotification" })
export type RemoteTransportQuestionNotification = typeof RemoteTransportQuestionNotification.Type

export const RemoteTransportApprovalReply = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("approval.reply"),
    notificationID: NotificationID,
    reply: Schema.Literals(["once", "always", "reject"]),
  }),
).annotate({ identifier: "RemoteTransportV1.ApprovalReply" })
export type RemoteTransportApprovalReply = typeof RemoteTransportApprovalReply.Type

const Answers = boundedArray(
  boundedArray(text(2 * 1024, "question answer is too large"), 16, RemoteTransportLimits.maxArrayBytes, "answers are too large"),
  8,
  RemoteTransportLimits.maxArrayBytes,
  "question answers are too large",
)

export const RemoteTransportQuestionReply = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("question.reply"),
    notificationID: NotificationID,
    answers: Answers,
  }),
).annotate({ identifier: "RemoteTransportV1.QuestionReply" })
export type RemoteTransportQuestionReply = typeof RemoteTransportQuestionReply.Type

export const RemoteTransportQuestionReject = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("question.reject"),
    notificationID: NotificationID,
  }),
).annotate({ identifier: "RemoteTransportV1.QuestionReject" })
export type RemoteTransportQuestionReject = typeof RemoteTransportQuestionReject.Type

export const RemoteTransportErrorCode = Schema.Literals([
  "bad_request",
  "unauthorized",
  "forbidden",
  "out_of_scope",
  "not_found",
  "conflict",
  "too_large",
  "unsupported",
  "cancelled",
  "timeout",
  "rate_limited",
  "internal",
])
export type RemoteTransportErrorCode = typeof RemoteTransportErrorCode.Type

const remoteTransportErrorShape = Schema.Struct({
  version: RemoteTransportVersion,
  kind: Schema.Literal("error"),
  type: Schema.Literal("error"),
  requestID: Schema.optional(RemoteTransportRequestID),
  idempotencyKey: Schema.optional(RemoteTransportIdempotencyKey),
  requestDigest: Schema.optional(RemoteTransportRequestDigest),
  target: Schema.optional(RemoteTransportTarget),
  code: RemoteTransportErrorCode,
  message: text(2 * 1024, "error message is too large"),
  retryable: Schema.Boolean,
  details: Schema.optional(RemoteTransportMetadata),
})
export const RemoteTransportError = exact(remoteTransportErrorShape)
  .check(
    Schema.makeFilter<typeof remoteTransportErrorShape.Type>((value) =>
      value.requestID === undefined ||
      (value.idempotencyKey !== undefined && value.requestDigest !== undefined && value.target !== undefined)
        ? undefined
        : "request errors must echo idempotency, digest, and target",
    ),
  )
  .annotate({ identifier: "RemoteTransportV1.Error" })
export type RemoteTransportError = typeof RemoteTransportError.Type

export const RemoteTransportRequest = Schema.Union([
  RemoteTransportSessionOpen,
  RemoteTransportSessionClose,
  RemoteTransportHttpRequest,
  RemoteTransportHttpUpload,
  RemoteTransportEventReplayRequest,
  RemoteTransportPtyOpen,
  RemoteTransportPtyInput,
  RemoteTransportPtyResize,
  RemoteTransportPtyClose,
  RemoteTransportApprovalReply,
  RemoteTransportQuestionReply,
  RemoteTransportQuestionReject,
]).annotate({ identifier: "RemoteTransportV1.Request" })
export type RemoteTransportRequest = typeof RemoteTransportRequest.Type

export const RemoteTransportResponse = Schema.Union([
  RemoteTransportSessionOpened,
  RemoteTransportSessionClosed,
  RemoteTransportHttpResponse,
  RemoteTransportEventReplayResponse,
  RemoteTransportPtyOpened,
  RemoteTransportPtyClosed,
]).annotate({ identifier: "RemoteTransportV1.Response" })
export type RemoteTransportResponse = typeof RemoteTransportResponse.Type

export const RemoteTransportStream = Schema.Union([
  RemoteTransportHttpChunk,
  RemoteTransportHttpUploadChunk,
  RemoteTransportPtyOutput,
]).annotate({
  identifier: "RemoteTransportV1.Stream",
})
export type RemoteTransportStream = typeof RemoteTransportStream.Type

export const RemoteTransportEvent = Schema.Union([
  RemoteTransportSseEvent,
  RemoteTransportApprovalNotification,
  RemoteTransportQuestionNotification,
]).annotate({ identifier: "RemoteTransportV1.Event" })
export type RemoteTransportEvent = typeof RemoteTransportEvent.Type

const remoteTransportFrameSchema = Schema.Union([
  RemoteTransportSessionOpen,
  RemoteTransportSessionClose,
  RemoteTransportHttpRequest,
  RemoteTransportHttpUpload,
  RemoteTransportEventReplayRequest,
  RemoteTransportPtyOpen,
  RemoteTransportPtyInput,
  RemoteTransportPtyResize,
  RemoteTransportPtyClose,
  RemoteTransportApprovalReply,
  RemoteTransportQuestionReply,
  RemoteTransportQuestionReject,
  RemoteTransportSessionOpened,
  RemoteTransportSessionClosed,
  RemoteTransportHttpResponse,
  RemoteTransportEventReplayResponse,
  RemoteTransportPtyOpened,
  RemoteTransportPtyClosed,
  RemoteTransportHttpChunk,
  RemoteTransportHttpUploadChunk,
  RemoteTransportPtyOutput,
  RemoteTransportSseEvent,
  RemoteTransportApprovalNotification,
  RemoteTransportQuestionNotification,
  RemoteTransportError,
]).check(
  Schema.makeFilter((value) =>
    jsonBytes(value) <= RemoteTransportLimits.maxFrameBytes
      ? undefined
      : "remote transport decoded frame exceeds the UTF-8 byte limit",
  ),
)
export const RemoteTransportFrame = remoteTransportFrameSchema.annotate({ identifier: "RemoteTransportV1.Frame" })
export type RemoteTransportFrame = typeof RemoteTransportFrame.Type
export type RemoteTransportFrameEncoded = typeof RemoteTransportFrame.Encoded

/** Scans JSON before parsing so last-key-wins semantics cannot hide duplicates. */
const assertNoDuplicateJsonKeys = (source: string) => {
  let index = 0
  const fail = () => {
    throw new Error("invalid JSON frame")
  }
  const skip = () => {
    while (/\s/.test(source[index] ?? "")) index++
  }
  const string = () => {
    if (source[index++] !== '"') fail()
    let result = ""
    while (index < source.length) {
      const value = source[index++]
      if (value === '"') return result
      if (value === undefined || value < " ") fail()
      if (value !== "\\") {
        result += value
        continue
      }
      const escaped = source[index++]
      if (escaped === undefined) fail()
      if (escaped === "u") {
        const hex = source.slice(index, index + 4)
        if (!/^[0-9a-f]{4}$/i.test(hex)) fail()
        result += String.fromCharCode(Number.parseInt(hex, 16))
        index += 4
        continue
      }
      const replacements: Record<string, string> = {
        '"': '"',
        "\\": "\\",
        "/": "/",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
      }
      const replacement = replacements[escaped]
      if (replacement === undefined) fail()
      result += replacement
    }
    return fail()
  }
  const value = (depth: number): void => {
    if (depth > 64) fail()
    skip()
    const current = source[index]
    if (current === '"') {
      string()
      return
    }
    if (current === "{") {
      index++
      skip()
      const keys = new Set<string>()
      if (source[index] === "}") {
        index++
        return
      }
      while (true) {
        skip()
        const key = string()
        if (keys.has(key)) fail()
        keys.add(key)
        skip()
        if (source[index++] !== ":") fail()
        value(depth + 1)
        skip()
        const delimiter = source[index++]
        if (delimiter === "}") return
        if (delimiter !== ",") fail()
      }
    }
    if (current === "[") {
      index++
      skip()
      if (source[index] === "]") {
        index++
        return
      }
      while (true) {
        value(depth + 1)
        skip()
        const delimiter = source[index++]
        if (delimiter === "]") return
        if (delimiter !== ",") fail()
      }
    }
    if (source.startsWith("true", index)) {
      index += 4
      return
    }
    if (source.startsWith("false", index)) {
      index += 5
      return
    }
    if (source.startsWith("null", index)) {
      index += 4
      return
    }
    const number = source.slice(index).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/)
    if (number === null) return fail()
    index += number[0].length
  }
  value(0)
  skip()
  if (index !== source.length) fail()
}

const RemoteTransportFrameJsonSource = Schema.String.check(
  Schema.makeFilter((value: string) =>
    byteLength(value) <= RemoteTransportLimits.maxFrameBytes
      ? undefined
      : "remote transport JSON frame exceeds the UTF-8 byte limit",
  ),
)

/**
 * The source string guard runs before parseJson during decoding and again on
 * encoding. WebSocket and JSONL adapters should apply this schema to each
 * complete text message/line before dispatch.
 */
export const RemoteTransportFrameJson = RemoteTransportFrameJsonSource.pipe(
  Schema.decodeTo(RemoteTransportFrame, {
    decode: SchemaGetter.transform((value: string) => {
      assertNoDuplicateJsonKeys(value)
      return JSON.parse(value) as RemoteTransportFrameEncoded
    }),
    encode: SchemaGetter.stringifyJson(),
  }),
).annotate({
  identifier: "RemoteTransportV1.FrameJson",
})
export type RemoteTransportFrameJson = typeof RemoteTransportFrameJson.Type

export const RemoteTransportJsonLine = RemoteTransportFrameJson
export type RemoteTransportJsonLine = typeof RemoteTransportJsonLine.Type
