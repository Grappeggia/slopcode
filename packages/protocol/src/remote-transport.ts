import { AbsolutePath, PositiveInt, Workspace } from "@slopcode-ai/schema"
import { Schema, SchemaParser } from "effect"
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
  maxBodyBytes: 1024 * 1024,
  maxChunkBytes: 64 * 1024,
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
  Schema.makeFilter<string>((value) => (value.includes("\u0000") ? message : undefined))

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
  if (!value.startsWith("/") || value.includes("\\") || value.includes("\u0000") || value.includes("//")) return false
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

const isSafeHttpPath = (value: string) => {
  if (value === "/") return true
  if (!value.startsWith("/") || value.includes("\\") || value.includes("\u0000") || value.includes("//")) return false
  if (/[?#\r\n]/.test(value) || /%2e/i.test(value)) return false
  const segments = value
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
  Schema.isPattern(/^[^\r\n]*$/),
)
const MetadataValue = bounded(RemoteTransportLimits.maxMetadataValueBytes, "metadata value is too large")

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
)
export type RemoteTransportHeaders = typeof RemoteTransportHeaders.Type

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
const ChallengeID = boundedID("chl_", "challenge ID is too large").pipe(Schema.brand("RemoteTransport.ChallengeID"))
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

export const RemoteTransportSessionAuth = exact(
  Schema.Struct({
    method: Schema.Literal("pairing-signature"),
    pairingID: RemotePairingID,
    challenge: ChallengeID,
    assertion: text(2 * 1024, "session assertion is too large").check(noControl("session assertion contains NUL")),
  }),
).annotate({ identifier: "RemoteTransportV1.SessionAuth" })
export type RemoteTransportSessionAuth = typeof RemoteTransportSessionAuth.Type

const requestFields = {
  version: RemoteTransportVersion,
  kind: Schema.Literal("request"),
  requestID: RemoteTransportRequestID,
  idempotencyKey: RemoteTransportIdempotencyKey,
  target: RemoteTransportTarget,
}
const responseFields = {
  version: RemoteTransportVersion,
  kind: Schema.Literal("response"),
  requestID: RemoteTransportRequestID,
  target: RemoteTransportTarget,
}
const streamFields = {
  version: RemoteTransportVersion,
  kind: Schema.Literal("stream"),
  requestID: RemoteTransportRequestID,
  target: RemoteTransportTarget,
}
const eventFields = {
  version: RemoteTransportVersion,
  kind: Schema.Literal("event"),
  target: RemoteTransportTarget,
  cursor: Schema.optional(RemoteTransportEventCursor),
}

const sessionOpenShape = Schema.Struct({
  ...requestFields,
  type: Schema.Literal("session.open"),
  auth: RemoteTransportSessionAuth,
})
export const RemoteTransportSessionOpen = exact(sessionOpenShape)
  .check(
    Schema.makeFilter<typeof sessionOpenShape.Type>((value) => {
      if (value.auth.pairingID === value.target.pairingID) return undefined
      return "session auth pairingID is outside target scope"
    }),
  )
  .annotate({ identifier: "RemoteTransportV1.SessionOpen" })
export type RemoteTransportSessionOpen = typeof RemoteTransportSessionOpen.Type

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

export const RemoteTransportBody = bounded(RemoteTransportLimits.maxBodyBytes, "HTTP body is too large")
export type RemoteTransportBody = typeof RemoteTransportBody.Type

export const RemoteTransportBodyChunk = bounded(RemoteTransportLimits.maxChunkBytes, "body chunk is too large")
export type RemoteTransportBodyChunk = typeof RemoteTransportBodyChunk.Type

const HttpMethod = Schema.Literals(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
const HttpStatus = Schema.Int.check(Schema.isGreaterThanOrEqualTo(100), Schema.isLessThanOrEqualTo(599))

export const RemoteTransportHttpRequest = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("http.request"),
    method: HttpMethod,
    path: HttpPath,
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
  events: Schema.Array(RemoteTransportSseEvent).pipe(
    Schema.check(Schema.isMaxLength(RemoteTransportLimits.maxReplayEvents)),
  ),
  nextCursor: Schema.optional(RemoteTransportEventCursor),
  hasMore: Schema.Boolean,
})
export const RemoteTransportEventReplayResponse = exact(eventReplayResponseShape)
  .check(
    Schema.makeFilter<typeof eventReplayResponseShape.Type>((value) =>
      value.events.every((event) => sameTarget(event.target, value.target))
        ? undefined
        : "replayed event target is outside response scope",
    ),
  )
  .annotate({ identifier: "RemoteTransportV1.EventReplayResponse" })
export type RemoteTransportEventReplayResponse = typeof RemoteTransportEventReplayResponse.Type

const PtyCommand = text(2 * 1024, "PTY command is too large").check(noControl("PTY command contains NUL"))
const PtyArgument = bounded(RemoteTransportLimits.maxPtyArgumentBytes, "PTY argument is too large").check(
  noControl("PTY argument contains NUL"),
)
const PtyArguments = Schema.Array(PtyArgument).check(Schema.isMaxLength(RemoteTransportLimits.maxPtyArguments))

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
const NotificationItems = Schema.Array(text(2 * 1024, "notification item is too large")).pipe(
  Schema.check(Schema.isMaxLength(RemoteTransportLimits.maxNotificationItems)),
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
    options: Schema.Array(QuestionOption).pipe(Schema.check(Schema.isMaxLength(16))),
    multiple: Schema.Boolean,
  }),
)

export const RemoteTransportQuestionNotification = exact(
  Schema.Struct({
    ...NotificationFields,
    type: Schema.Literal("question.request"),
    questions: Schema.Array(QuestionPrompt).pipe(Schema.check(Schema.isMaxLength(8))),
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

const Answers = Schema.Array(Schema.Array(text(2 * 1024, "question answer is too large")).pipe(Schema.check(Schema.isMaxLength(16)))).pipe(
  Schema.check(Schema.isMaxLength(8)),
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

export const RemoteTransportError = exact(
  Schema.Struct({
    version: RemoteTransportVersion,
    kind: Schema.Literal("error"),
    type: Schema.Literal("error"),
    requestID: Schema.optional(RemoteTransportRequestID),
    idempotencyKey: Schema.optional(RemoteTransportIdempotencyKey),
    target: Schema.optional(RemoteTransportTarget),
    code: RemoteTransportErrorCode,
    message: text(2 * 1024, "error message is too large"),
    retryable: Schema.Boolean,
    details: Schema.optional(RemoteTransportMetadata),
  }),
).annotate({ identifier: "RemoteTransportV1.Error" })
export type RemoteTransportError = typeof RemoteTransportError.Type

export const RemoteTransportRequest = Schema.Union([
  RemoteTransportSessionOpen,
  RemoteTransportSessionClose,
  RemoteTransportHttpRequest,
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

export const RemoteTransportStream = Schema.Union([RemoteTransportHttpChunk, RemoteTransportPtyOutput]).annotate({
  identifier: "RemoteTransportV1.Stream",
})
export type RemoteTransportStream = typeof RemoteTransportStream.Type

export const RemoteTransportEvent = Schema.Union([
  RemoteTransportSseEvent,
  RemoteTransportApprovalNotification,
  RemoteTransportQuestionNotification,
]).annotate({ identifier: "RemoteTransportV1.Event" })
export type RemoteTransportEvent = typeof RemoteTransportEvent.Type

export const RemoteTransportFrame = Schema.Union([
  RemoteTransportSessionOpen,
  RemoteTransportSessionClose,
  RemoteTransportHttpRequest,
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
  RemoteTransportPtyOutput,
  RemoteTransportSseEvent,
  RemoteTransportApprovalNotification,
  RemoteTransportQuestionNotification,
  RemoteTransportError,
]).annotate({ identifier: "RemoteTransportV1.Frame" })
export type RemoteTransportFrame = typeof RemoteTransportFrame.Type
export type RemoteTransportFrameEncoded = typeof RemoteTransportFrame.Encoded

export const RemoteTransportFrameJson = Schema.fromJsonString(RemoteTransportFrame).annotate({
  identifier: "RemoteTransportV1.FrameJson",
})
export type RemoteTransportFrameJson = typeof RemoteTransportFrameJson.Type

export const RemoteTransportJsonLine = RemoteTransportFrameJson
export type RemoteTransportJsonLine = typeof RemoteTransportJsonLine.Type
