export * as SessionTaskMetadata from "./task-metadata"

import { Schema } from "effect"
import { AgentV2 } from "../agent"
import { PermissionSchema } from "../permission/schema"
import { SessionSchema } from "./schema"
import { SessionMessage } from "./message"

export const Owner = Schema.Struct({
  version: Schema.Literal(1),
  parentID: SessionSchema.ID,
  agent: AgentV2.ID,
  origin: Schema.Struct({
    messageID: SessionMessage.ID,
    callID: Schema.String,
  }),
  ceiling: PermissionSchema.Ruleset,
})
export type Owner = typeof Owner.Type

export const Metadata = Schema.Struct({ task: Owner })

export function owner(metadata: unknown) {
  if (typeof metadata !== "object" || metadata === null || !("task" in metadata)) return
  const value = (metadata as { readonly task?: unknown }).task
  return Schema.is(Owner)(value) ? value : undefined
}
