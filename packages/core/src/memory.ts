export * as Memory from "./memory"

import { Schema } from "effect"
import { ProjectV2 } from "./project"
import { SessionSchema } from "./session/schema"
import { SessionV1 } from "./v1/session"
import { Identifier } from "./id/id"
import { NonNegativeInt, withStatics } from "./schema"

export const ID = Schema.String.check(Schema.isStartsWith("mem_")).pipe(
  Schema.brand("Memory.ID"),
  withStatics((schema) => ({ create: () => schema.make(Identifier.ascending("memory")) })),
)
export type ID = typeof ID.Type

export const Scope = Schema.Literals(["project", "global"]).annotate({ identifier: "Memory.Scope" })
export type Scope = typeof Scope.Type

export const Info = Schema.Struct({
  id: ID,
  scope: Scope,
  projectID: Schema.optional(ProjectV2.ID),
  content: Schema.String,
  enabled: Schema.Boolean,
  sourceSessionID: Schema.optional(SessionSchema.ID),
  sourceMessageID: Schema.optional(SessionV1.MessageID),
  time: Schema.Struct({
    created: NonNegativeInt,
    updated: NonNegativeInt,
    accessed: Schema.optional(NonNegativeInt),
  }),
}).annotate({ identifier: "Memory" })
export type Info = Schema.Schema.Type<typeof Info>

export const CreateInput = Schema.Struct({
  content: Schema.String,
  scope: Schema.optional(Scope),
  enabled: Schema.optional(Schema.Boolean),
}).annotate({ identifier: "Memory.CreateInput" })
export type CreateInput = Schema.Schema.Type<typeof CreateInput>

export const UpdateInput = Schema.Struct({
  content: Schema.optional(Schema.String),
  enabled: Schema.optional(Schema.Boolean),
}).annotate({ identifier: "Memory.UpdateInput" })
export type UpdateInput = Schema.Schema.Type<typeof UpdateInput>

export const ListQuery = Schema.Struct({
  includeDisabled: Schema.optional(Schema.Boolean),
}).annotate({ identifier: "Memory.ListQuery" })
export type ListQuery = Schema.Schema.Type<typeof ListQuery>
