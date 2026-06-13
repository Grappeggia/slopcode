import { Context } from "effect"
import type { InstanceContext } from "@/project/instance-context"
import type { WorkspaceV2 } from "@slopcode-ai/core/workspace"

export const InstanceRef = Context.Reference<InstanceContext | undefined>("~slopcode/InstanceRef", {
  defaultValue: () => undefined,
})

export const WorkspaceRef = Context.Reference<WorkspaceV2.ID | undefined>("~slopcode/WorkspaceRef", {
  defaultValue: () => undefined,
})
