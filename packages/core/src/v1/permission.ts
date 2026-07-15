export * as PermissionV1 from "./permission"

import { Schema } from "effect"
import { ProjectV2 } from "../project"
import { withStatics } from "../schema"
import { SessionSchema } from "../session/schema"
import { Identifier } from "../util/identifier"

export const ID = Schema.String.check(Schema.isStartsWith("per")).pipe(
  Schema.brand("PermissionID"),
  withStatics((schema) => ({ ascending: (id?: string) => schema.make(id ?? "per_" + Identifier.ascending()) })),
)
export type ID = typeof ID.Type

export const BatchID = Schema.String.check(Schema.isStartsWith("pmb_")).pipe(
  Schema.brand("PermissionBatchID"),
  withStatics((schema) => ({ ascending: () => schema.make("pmb_" + Identifier.ascending()) })),
)
export type BatchID = typeof BatchID.Type

export const Action = Schema.Literals(["allow", "deny", "ask"]).annotate({ identifier: "PermissionAction" })
export type Action = typeof Action.Type

export const Rule = Schema.Struct({
  permission: Schema.String,
  pattern: Schema.String,
  action: Action,
}).annotate({ identifier: "PermissionRule" })
export type Rule = typeof Rule.Type

export const Ruleset = Schema.Array(Rule).annotate({ identifier: "PermissionRuleset" })
export type Ruleset = typeof Ruleset.Type

export const Request = Schema.Struct({
  id: ID,
  sessionID: SessionSchema.ID,
  permission: Schema.String,
  patterns: Schema.Array(Schema.String),
  metadata: Schema.Record(Schema.String, Schema.Unknown),
  always: Schema.Array(Schema.String),
  kind: Schema.optional(Schema.Literal("forecast")),
  batchID: Schema.optional(BatchID),
  reason: Schema.optional(Schema.String),
  tool: Schema.Struct({
    messageID: Schema.String,
    callID: Schema.String,
  }).pipe(Schema.optional),
}).annotate({ identifier: "PermissionRequest" })
export type Request = typeof Request.Type

export const Reply = Schema.Literals(["once", "always", "reject"])
export type Reply = typeof Reply.Type

export const ReplyBody = Schema.Struct({
  reply: Reply,
  message: Schema.String.pipe(Schema.optional),
}).annotate({ identifier: "PermissionReplyBody" })
export type ReplyBody = typeof ReplyBody.Type

export const Approval = Schema.Struct({
  projectID: ProjectV2.ID,
  patterns: Schema.Array(Schema.String),
}).annotate({ identifier: "PermissionApproval" })
export type Approval = typeof Approval.Type

export const AskInput = Schema.Struct({
  ...Request.fields,
  id: ID.pipe(Schema.optional),
  ruleset: Ruleset,
}).annotate({ identifier: "PermissionAskInput" })
export type AskInput = typeof AskInput.Type

export const ReplyInput = Schema.Struct({
  requestID: ID,
  ...ReplyBody.fields,
}).annotate({ identifier: "PermissionReplyInput" })
export type ReplyInput = typeof ReplyInput.Type

export const BatchReplyBody = Schema.Struct({
  requestIDs: Schema.Array(ID).check(Schema.isMaxLength(16)),
  reply: Reply,
}).annotate({ identifier: "PermissionBatchReplyBody" })
export type BatchReplyBody = typeof BatchReplyBody.Type

export const BatchReplyInput = Schema.Struct({
  batchID: BatchID,
  ...BatchReplyBody.fields,
}).annotate({ identifier: "PermissionBatchReplyInput" })
export type BatchReplyInput = typeof BatchReplyInput.Type

export class RejectedError extends Schema.TaggedErrorClass<RejectedError>()("PermissionRejectedError", {}) {
  override get message() {
    return "The user rejected permission to use this specific tool call."
  }
}

export class CorrectedError extends Schema.TaggedErrorClass<CorrectedError>()("PermissionCorrectedError", {
  feedback: Schema.String,
}) {
  override get message() {
    return `The user rejected permission to use this specific tool call with the following feedback: ${this.feedback}`
  }
}

export class DeniedError extends Schema.TaggedErrorClass<DeniedError>()("PermissionDeniedError", {
  ruleset: Schema.Any,
}) {
  override get message() {
    return `The user has specified a rule which prevents you from using this specific tool call. Here are some of the relevant rules ${JSON.stringify(this.ruleset)}`
  }
}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("Permission.NotFoundError", {
  requestID: ID,
}) {}

export class BatchError extends Schema.TaggedErrorClass<BatchError>()("Permission.BatchError", {
  batchID: BatchID,
  message: Schema.String,
}) {}

export type Error = DeniedError | RejectedError | CorrectedError
