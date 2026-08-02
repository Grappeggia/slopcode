import { AbsolutePath, PositiveInt } from "@slopcode-ai/schema"
import { Schema, SchemaParser } from "effect"

/** Limits for one durable Android/remote-bridge orchestration frame. */
export const AgentOrchestrationLimits = {
  maxFrameBytes: 256 * 1024,
  maxIdentifierBytes: 128,
  maxPathBytes: 4 * 1024,
  maxTextBytes: 64 * 1024,
  maxMetadataEntries: 32,
  maxMetadataKeyBytes: 128,
  maxMetadataValueBytes: 2 * 1024,
  maxMetadataBytes: 16 * 1024,
  maxCapabilities: 16,
  maxQuestionOptions: 32,
  maxReplayEvents: 100,
  maxArtifacts: 64,
  maxArtifactBytes: 1024 * 1024 * 1024,
  maxInteractionRevision: 1_000_000,
} as const

const encoder = new TextEncoder()
const bytes = (value: string) => encoder.encode(value).byteLength
const jsonBytes = (value: unknown) => bytes(JSON.stringify(value) ?? "")
const exact = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S) =>
  Schema.declareConstructor<S["Type"], S["Encoded"]>()(
    [schema],
    ([codec]) =>
      (value, _ast, options) =>
        SchemaParser.decodeUnknownEffect(codec, { ...options, onExcessProperty: "error" })(value),
  )
const bounded = (limit: number, message: string) =>
  Schema.String.check(Schema.makeFilter((value: string) => (bytes(value) <= limit ? undefined : message)))
const noControl = (message: string) =>
  Schema.makeFilter<string>((value) => (/[\u0000-\u001f\u007f-\u009f]/.test(value) ? message : undefined))
const text = (limit: number, message: string) => bounded(limit, message).check(Schema.isMinLength(1), noControl(message))
const body = (limit: number, message: string) =>
  bounded(limit, message).check(Schema.isMinLength(1), Schema.makeFilter((value: string) => (value.includes("\u0000") ? message : undefined)))
const identifier = (prefix: string, name: string) =>
  text(AgentOrchestrationLimits.maxIdentifierBytes, `${name} is too large`).pipe(
    Schema.check(Schema.isPattern(new RegExp(`^${prefix}[A-Za-z0-9._:-]+$`))),
  )
const safePath = (value: string) =>
  value === "/" ||
  (value.startsWith("/") &&
    !value.endsWith("/") &&
    !value.includes("\\") &&
    !value.includes("\u0000") &&
    !/[\u0001-\u001f\u007f-\u009f]/.test(value) &&
    !value.includes("//") &&
    value
      .slice(1)
      .split("/")
      .every((segment) => segment.length > 0 && segment !== "." && segment !== ".."))
const secret = (value: string) =>
  /(?:password|passphrase|private[-_]?key|api[-_]?key|secret|token|authorization|cookie|credential)/i.test(value)
const prototype = (value: string) => value === "__proto__" || value === "constructor" || value === "prototype"

export const AgentOrchestrationVersion = Schema.Literal("v1").annotate({ identifier: "AgentOrchestrationV1.Version" })
export type AgentOrchestrationVersion = typeof AgentOrchestrationVersion.Type

export const AgentOrchestrationAgentID = Schema.Literals(["slopcode", "opencode", "codex", "claude"]).annotate({
  identifier: "AgentOrchestrationV1.AgentID",
})
export type AgentOrchestrationAgentID = typeof AgentOrchestrationAgentID.Type

export const AgentOrchestrationRequestID = identifier("req_", "request ID").pipe(
  Schema.brand("AgentOrchestrationV1.RequestID"),
)
export type AgentOrchestrationRequestID = typeof AgentOrchestrationRequestID.Type

export const AgentOrchestrationIdempotencyKey = text(
  AgentOrchestrationLimits.maxIdentifierBytes,
  "idempotency key is too large",
)
  .check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/))
  .pipe(Schema.brand("AgentOrchestrationV1.IdempotencyKey"))
export type AgentOrchestrationIdempotencyKey = typeof AgentOrchestrationIdempotencyKey.Type

export const AgentOrchestrationWorkspaceID = identifier("wrk_", "workspace ID").pipe(
  Schema.brand("AgentOrchestrationV1.WorkspaceID"),
)
export type AgentOrchestrationWorkspaceID = typeof AgentOrchestrationWorkspaceID.Type

export const AgentOrchestrationSessionID = identifier("ses_", "session ID").pipe(
  Schema.brand("AgentOrchestrationV1.SessionID"),
)
export type AgentOrchestrationSessionID = typeof AgentOrchestrationSessionID.Type

export const AgentOrchestrationTurnID = identifier("trn_", "turn ID").pipe(Schema.brand("AgentOrchestrationV1.TurnID"))
export type AgentOrchestrationTurnID = typeof AgentOrchestrationTurnID.Type

export const AgentOrchestrationInteractionID = identifier("int_", "interaction ID").pipe(
  Schema.brand("AgentOrchestrationV1.InteractionID"),
)
export type AgentOrchestrationInteractionID = typeof AgentOrchestrationInteractionID.Type

export const AgentOrchestrationPlanID = identifier("pln_", "plan ID").pipe(Schema.brand("AgentOrchestrationV1.PlanID"))
export type AgentOrchestrationPlanID = typeof AgentOrchestrationPlanID.Type

export const AgentOrchestrationPrepareID = identifier("prp_", "plan prepare ID").pipe(
  Schema.brand("AgentOrchestrationV1.PrepareID"),
)
export type AgentOrchestrationPrepareID = typeof AgentOrchestrationPrepareID.Type

export const AgentOrchestrationArtifactID = identifier("art_", "artifact ID").pipe(
  Schema.brand("AgentOrchestrationV1.ArtifactID"),
)
export type AgentOrchestrationArtifactID = typeof AgentOrchestrationArtifactID.Type

const cursor = (value: string) => Number(value.slice(4))

export const AgentOrchestrationEventCursor = text(
  AgentOrchestrationLimits.maxIdentifierBytes,
  "event cursor is too large",
)
  .check(
    Schema.isPattern(/^cur_(?:0|[1-9][0-9]{0,9})$/),
    Schema.makeFilter((value: string) =>
      cursor(value) <= 2_147_483_647 ? undefined : "event cursor is outside the supported range",
    ),
  )
  .pipe(Schema.brand("AgentOrchestrationV1.EventCursor"))
export type AgentOrchestrationEventCursor = typeof AgentOrchestrationEventCursor.Type

export const AgentOrchestrationPath = AbsolutePath.check(
  Schema.makeFilter<typeof AbsolutePath.Type>((value) =>
    bytes(value) <= AgentOrchestrationLimits.maxPathBytes && safePath(value)
      ? undefined
      : "path must be a bounded, normalized absolute POSIX path",
  ),
).pipe(Schema.brand("AgentOrchestrationV1.Path"))
export type AgentOrchestrationPath = typeof AgentOrchestrationPath.Type

const MetadataKey = text(AgentOrchestrationLimits.maxMetadataKeyBytes, "metadata key is too large").check(
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  Schema.makeFilter((value: string) =>
    secret(value) ? "secret-shaped fields are not orchestration metadata" : undefined,
  ),
)
const MetadataValue = bounded(AgentOrchestrationLimits.maxMetadataValueBytes, "metadata value is too large").check(
  noControl("metadata contains control characters"),
)

export const AgentOrchestrationMetadata = Schema.Record(MetadataKey, MetadataValue).check(
  Schema.makeFilter((value) => {
    const entries = Object.entries(value as Record<string, string>)
    if (entries.length > AgentOrchestrationLimits.maxMetadataEntries) return "too many metadata entries"
    if (entries.some(([key]) => prototype(key))) return "prototype metadata keys are not allowed"
    return entries.reduce((sum, [key, item]) => sum + bytes(key) + bytes(item), 0) <= AgentOrchestrationLimits.maxMetadataBytes
      ? undefined
      : "metadata is too large"
  }),
).annotate({ identifier: "AgentOrchestrationV1.Metadata" })
export type AgentOrchestrationMetadata = typeof AgentOrchestrationMetadata.Type

export const AgentOrchestrationCapability = Schema.Literals([
  "workspace",
  "sessions",
  "turns",
  "approvals",
  "questions",
  "plans",
  "artifacts",
  "replay",
]).annotate({ identifier: "AgentOrchestrationV1.Capability" })
export type AgentOrchestrationCapability = typeof AgentOrchestrationCapability.Type

export const AgentOrchestrationCapabilities = Schema.Array(AgentOrchestrationCapability)
  .check(
    Schema.isMinLength(1),
    Schema.isMaxLength(AgentOrchestrationLimits.maxCapabilities),
    Schema.makeFilter((value) =>
      new Set(value).size === value.length ? undefined : "agent capabilities must be unique",
    ),
  )
  .annotate({ identifier: "AgentOrchestrationV1.Capabilities" })
export type AgentOrchestrationCapabilities = typeof AgentOrchestrationCapabilities.Type

export const AgentOrchestrationAgent = exact(
  Schema.Struct({
    id: AgentOrchestrationAgentID,
    capabilities: AgentOrchestrationCapabilities,
  }),
).annotate({ identifier: "AgentOrchestrationV1.Agent" })
export type AgentOrchestrationAgent = typeof AgentOrchestrationAgent.Type

export const AgentOrchestrationWorkspace = exact(
  Schema.Struct({
    id: AgentOrchestrationWorkspaceID,
    path: AgentOrchestrationPath,
    name: Schema.optional(text(256, "workspace name is too large")),
    metadata: Schema.optional(AgentOrchestrationMetadata),
  }),
).annotate({ identifier: "AgentOrchestrationV1.Workspace" })
export type AgentOrchestrationWorkspace = typeof AgentOrchestrationWorkspace.Type

const requestFields = {
  version: AgentOrchestrationVersion,
  kind: Schema.Literal("request"),
  requestID: AgentOrchestrationRequestID,
  idempotencyKey: AgentOrchestrationIdempotencyKey,
}

export const AgentOrchestrationWorkspaceRequest = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("workspace.open"),
    workspace: AgentOrchestrationWorkspace,
    agent: AgentOrchestrationAgent,
  }),
).annotate({ identifier: "AgentOrchestrationV1.WorkspaceRequest" })
export type AgentOrchestrationWorkspaceRequest = typeof AgentOrchestrationWorkspaceRequest.Type

export const AgentOrchestrationSessionRequest = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("session.create"),
    workspaceID: AgentOrchestrationWorkspaceID,
    agent: AgentOrchestrationAgentID,
    title: Schema.optional(text(512, "session title is too large")),
    metadata: Schema.optional(AgentOrchestrationMetadata),
  }),
).annotate({ identifier: "AgentOrchestrationV1.SessionRequest" })
export type AgentOrchestrationSessionRequest = typeof AgentOrchestrationSessionRequest.Type

export const AgentOrchestrationTurnRequest = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("turn.create"),
    sessionID: AgentOrchestrationSessionID,
    turnID: Schema.optional(AgentOrchestrationTurnID),
    agent: AgentOrchestrationAgentID,
    prompt: body(AgentOrchestrationLimits.maxTextBytes, "turn prompt is too large"),
    metadata: Schema.optional(AgentOrchestrationMetadata),
  }),
).annotate({ identifier: "AgentOrchestrationV1.TurnRequest" })
export type AgentOrchestrationTurnRequest = typeof AgentOrchestrationTurnRequest.Type

const Revision = PositiveInt.check(Schema.isLessThanOrEqualTo(AgentOrchestrationLimits.maxInteractionRevision)).pipe(
  Schema.brand("AgentOrchestrationV1.InteractionRevision"),
)
export type AgentOrchestrationRevision = typeof Revision.Type

export const AgentOrchestrationApproval = exact(
  Schema.Struct({
    id: AgentOrchestrationInteractionID,
    revision: Revision,
    title: text(512, "approval title is too large"),
    command: Schema.optional(body(4 * 1024, "approval command is too large")),
    cwd: Schema.optional(AgentOrchestrationPath),
    reason: Schema.optional(body(2 * 1024, "approval reason is too large")),
    risk: Schema.optional(Schema.Literals(["low", "medium", "high"])),
  }),
).annotate({ identifier: "AgentOrchestrationV1.Approval" })
export type AgentOrchestrationApproval = typeof AgentOrchestrationApproval.Type

export const AgentOrchestrationQuestion = exact(
  Schema.Struct({
    id: AgentOrchestrationInteractionID,
    revision: Revision,
    prompt: body(4 * 1024, "question prompt is too large"),
    options: Schema.optional(
      Schema.Array(text(512, "question option is too large")).check(
        Schema.isMinLength(1),
        Schema.isMaxLength(AgentOrchestrationLimits.maxQuestionOptions),
        Schema.makeFilter((value) => new Set(value).size === value.length ? undefined : "question options must be unique"),
      ),
    ),
    allowFreeform: Schema.optional(Schema.Boolean),
  }),
).annotate({ identifier: "AgentOrchestrationV1.Question" })
export type AgentOrchestrationQuestion = typeof AgentOrchestrationQuestion.Type

export const AgentOrchestrationApprovalReply = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("interaction.approval.reply"),
    sessionID: AgentOrchestrationSessionID,
    interactionID: AgentOrchestrationInteractionID,
    revision: Revision,
    decision: Schema.Literals(["approved", "rejected"]),
    reason: Schema.optional(body(2 * 1024, "approval reply reason is too large")),
  }),
).annotate({ identifier: "AgentOrchestrationV1.ApprovalReply" })
export type AgentOrchestrationApprovalReply = typeof AgentOrchestrationApprovalReply.Type

export const AgentOrchestrationQuestionReply = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("interaction.question.reply"),
    sessionID: AgentOrchestrationSessionID,
    interactionID: AgentOrchestrationInteractionID,
    revision: Revision,
    answer: body(4 * 1024, "question answer is too large"),
  }),
).annotate({ identifier: "AgentOrchestrationV1.QuestionReply" })
export type AgentOrchestrationQuestionReply = typeof AgentOrchestrationQuestionReply.Type

export const agentOrchestrationInteractionRevisionIsCurrent = (
  interaction: Pick<AgentOrchestrationApproval | AgentOrchestrationQuestion, "id" | "revision">,
  reply: Pick<AgentOrchestrationApprovalReply | AgentOrchestrationQuestionReply, "interactionID" | "revision">,
) => interaction.id === reply.interactionID && interaction.revision === reply.revision

export const AgentOrchestrationPlan = exact(
  Schema.Struct({
    id: AgentOrchestrationPlanID,
    path: AgentOrchestrationPath,
    revision: Revision,
    content: body(AgentOrchestrationLimits.maxTextBytes, "plan content is too large"),
  }),
).annotate({ identifier: "AgentOrchestrationV1.Plan" })
export type AgentOrchestrationPlan = typeof AgentOrchestrationPlan.Type

export const AgentOrchestrationPlanSavePrepare = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("plan.save.prepare"),
    sessionID: AgentOrchestrationSessionID,
    plan: AgentOrchestrationPlan,
  }),
).annotate({ identifier: "AgentOrchestrationV1.PlanSavePrepare" })
export type AgentOrchestrationPlanSavePrepare = typeof AgentOrchestrationPlanSavePrepare.Type

export const AgentOrchestrationPlanSaveCommit = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("plan.save.commit"),
    sessionID: AgentOrchestrationSessionID,
    prepareID: AgentOrchestrationPrepareID,
    planID: AgentOrchestrationPlanID,
    revision: Revision,
  }),
).annotate({ identifier: "AgentOrchestrationV1.PlanSaveCommit" })
export type AgentOrchestrationPlanSaveCommit = typeof AgentOrchestrationPlanSaveCommit.Type

export const AgentOrchestrationArtifact = exact(
  Schema.Struct({
    id: AgentOrchestrationArtifactID,
    name: text(256, "artifact name is too large"),
    kind: Schema.Literals(["file", "directory", "image", "diff", "log", "plan", "report"]),
    path: AgentOrchestrationPath,
    size: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(AgentOrchestrationLimits.maxArtifactBytes)),
    mime: Schema.optional(text(128, "artifact MIME type is too large")),
    metadata: Schema.optional(AgentOrchestrationMetadata),
  }),
).annotate({ identifier: "AgentOrchestrationV1.Artifact" })
export type AgentOrchestrationArtifact = typeof AgentOrchestrationArtifact.Type

const eventFields = {
  version: AgentOrchestrationVersion,
  kind: Schema.Literal("event"),
  cursor: AgentOrchestrationEventCursor,
  sequence: PositiveInt.check(Schema.isLessThanOrEqualTo(2_147_483_647)),
  sessionID: AgentOrchestrationSessionID,
}

export const AgentOrchestrationTurnOutputEvent = exact(
  Schema.Struct({
    ...eventFields,
    type: Schema.Literal("turn.output"),
    turnID: AgentOrchestrationTurnID,
    text: body(AgentOrchestrationLimits.maxTextBytes, "turn output is too large"),
  }),
).annotate({ identifier: "AgentOrchestrationV1.TurnOutputEvent" })
export type AgentOrchestrationTurnOutputEvent = typeof AgentOrchestrationTurnOutputEvent.Type

export const AgentOrchestrationApprovalRequestedEvent = exact(
  Schema.Struct({
    ...eventFields,
    type: Schema.Literal("interaction.approval.requested"),
    turnID: AgentOrchestrationTurnID,
    interaction: AgentOrchestrationApproval,
  }),
).annotate({ identifier: "AgentOrchestrationV1.ApprovalRequestedEvent" })
export type AgentOrchestrationApprovalRequestedEvent = typeof AgentOrchestrationApprovalRequestedEvent.Type

export const AgentOrchestrationQuestionRequestedEvent = exact(
  Schema.Struct({
    ...eventFields,
    type: Schema.Literal("interaction.question.requested"),
    turnID: AgentOrchestrationTurnID,
    interaction: AgentOrchestrationQuestion,
  }),
).annotate({ identifier: "AgentOrchestrationV1.QuestionRequestedEvent" })
export type AgentOrchestrationQuestionRequestedEvent = typeof AgentOrchestrationQuestionRequestedEvent.Type

export const AgentOrchestrationPlanSavedEvent = exact(
  Schema.Struct({
    ...eventFields,
    type: Schema.Literal("plan.saved"),
    plan: AgentOrchestrationPlan,
  }),
).annotate({ identifier: "AgentOrchestrationV1.PlanSavedEvent" })
export type AgentOrchestrationPlanSavedEvent = typeof AgentOrchestrationPlanSavedEvent.Type

export const AgentOrchestrationArtifactCreatedEvent = exact(
  Schema.Struct({
    ...eventFields,
    type: Schema.Literal("artifact.created"),
    turnID: Schema.optional(AgentOrchestrationTurnID),
    artifact: AgentOrchestrationArtifact,
  }),
).annotate({ identifier: "AgentOrchestrationV1.ArtifactCreatedEvent" })
export type AgentOrchestrationArtifactCreatedEvent = typeof AgentOrchestrationArtifactCreatedEvent.Type

export const AgentOrchestrationEvent = Schema.Union([
  AgentOrchestrationTurnOutputEvent,
  AgentOrchestrationApprovalRequestedEvent,
  AgentOrchestrationQuestionRequestedEvent,
  AgentOrchestrationPlanSavedEvent,
  AgentOrchestrationArtifactCreatedEvent,
]).annotate({ identifier: "AgentOrchestrationV1.Event" })
export type AgentOrchestrationEvent = typeof AgentOrchestrationEvent.Type

export const AgentOrchestrationEventReplayRequest = exact(
  Schema.Struct({
    ...requestFields,
    type: Schema.Literal("event.replay"),
    sessionID: AgentOrchestrationSessionID,
    afterCursor: Schema.optional(AgentOrchestrationEventCursor),
    limit: PositiveInt.check(Schema.isLessThanOrEqualTo(AgentOrchestrationLimits.maxReplayEvents)),
  }),
).annotate({ identifier: "AgentOrchestrationV1.EventReplayRequest" })
export type AgentOrchestrationEventReplayRequest = typeof AgentOrchestrationEventReplayRequest.Type

const replayShape = Schema.Struct({
  version: AgentOrchestrationVersion,
  kind: Schema.Literal("response"),
  type: Schema.Literal("event.replay"),
  requestID: AgentOrchestrationRequestID,
  idempotencyKey: AgentOrchestrationIdempotencyKey,
  events: Schema.Array(AgentOrchestrationEvent).check(Schema.isMaxLength(AgentOrchestrationLimits.maxReplayEvents)),
  nextCursor: Schema.optional(AgentOrchestrationEventCursor),
  hasMore: Schema.Boolean,
})
export const AgentOrchestrationEventReplayResponse = exact(replayShape)
  .check(
    Schema.makeFilter<typeof replayShape.Type>((value) => {
      const cursors = new Set<string>()
      for (const event of value.events) {
        if (cursors.has(event.cursor)) return "replayed event cursors must be unique"
        cursors.add(event.cursor)
      }
      if (value.events.some((event, index) => index > 0 && event.sequence <= value.events[index - 1]!.sequence)) {
        return "replayed events must be ordered by sequence"
      }
      if (value.events.some((event, index) => index > 0 && cursor(event.cursor) <= cursor(value.events[index - 1]!.cursor))) {
        return "replayed event cursors must be ordered"
      }
      if (value.hasMore !== (value.nextCursor !== undefined)) return "event replay continuation must match hasMore"
      if (value.nextCursor !== undefined && value.events.length > 0 && cursor(value.nextCursor) <= cursor(value.events.at(-1)!.cursor)) {
        return "next cursor must advance beyond replayed events"
      }
      return jsonBytes(value) <= AgentOrchestrationLimits.maxFrameBytes ? undefined : "event replay is too large"
    }),
  )
  .annotate({ identifier: "AgentOrchestrationV1.EventReplayResponse" })
export type AgentOrchestrationEventReplayResponse = typeof AgentOrchestrationEventReplayResponse.Type

export const AgentOrchestrationError = exact(
  Schema.Struct({
    version: AgentOrchestrationVersion,
    kind: Schema.Literal("error"),
    type: Schema.Literal("error"),
    requestID: Schema.optional(AgentOrchestrationRequestID),
    idempotencyKey: Schema.optional(AgentOrchestrationIdempotencyKey),
    code: Schema.Literals([
      "bad_request",
      "unsupported_agent",
      "not_found",
      "interaction_conflict",
      "idempotency_conflict",
      "path_forbidden",
      "too_large",
      "cancelled",
      "timeout",
      "internal",
    ]),
    message: body(2 * 1024, "error message is too large"),
    retryable: Schema.Boolean,
    details: Schema.optional(AgentOrchestrationMetadata),
  }),
)
  .check(
    Schema.makeFilter((value) =>
      (value.requestID === undefined) === (value.idempotencyKey === undefined)
        ? undefined
        : "request errors must include both request and idempotency IDs",
    ),
  )
  .annotate({ identifier: "AgentOrchestrationV1.Error" })
export type AgentOrchestrationError = typeof AgentOrchestrationError.Type

export const AgentOrchestrationRequest = Schema.Union([
  AgentOrchestrationWorkspaceRequest,
  AgentOrchestrationSessionRequest,
  AgentOrchestrationTurnRequest,
  AgentOrchestrationApprovalReply,
  AgentOrchestrationQuestionReply,
  AgentOrchestrationPlanSavePrepare,
  AgentOrchestrationPlanSaveCommit,
  AgentOrchestrationEventReplayRequest,
]).annotate({ identifier: "AgentOrchestrationV1.Request" })
export type AgentOrchestrationRequest = typeof AgentOrchestrationRequest.Type

export const AgentOrchestrationFrame = exact(
  Schema.Union([
    AgentOrchestrationRequest,
    AgentOrchestrationEventReplayResponse,
    AgentOrchestrationEvent,
    AgentOrchestrationError,
  ]),
)
  .check(
    Schema.makeFilter((value) =>
      jsonBytes(value) <= AgentOrchestrationLimits.maxFrameBytes ? undefined : "orchestration frame is too large",
    ),
  )
  .annotate({ identifier: "AgentOrchestrationV1.Frame" })
export type AgentOrchestrationFrame = typeof AgentOrchestrationFrame.Type

export const AgentOrchestrationFrameJson = bounded(
  AgentOrchestrationLimits.maxFrameBytes,
  "orchestration frame is too large",
).pipe(Schema.decodeTo(Schema.fromJsonString(AgentOrchestrationFrame))).annotate({
  identifier: "AgentOrchestrationV1.FrameJson",
})
export type AgentOrchestrationFrameJson = typeof AgentOrchestrationFrameJson.Type
