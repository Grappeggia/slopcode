import path from "node:path"
import { realpath } from "node:fs/promises"
import { AgentOrchestrationLimits } from "@slopcode-ai/protocol"

export class WorkspaceError extends Error {}

const controls = /[\u0000-\u001f\u007f-\u009f]/

export async function contained(root: string, target: string) {
  const base = await realpath(root)
  const value = await realpath(target)
  const relative = path.relative(base, value)
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)))
    return value
  throw new WorkspaceError("workspace is outside the configured orchestration root")
}

export async function approvalCwd(root: string, value: string | undefined) {
  if (
    !value ||
    !path.isAbsolute(value) ||
    controls.test(value) ||
    Buffer.byteLength(value) > AgentOrchestrationLimits.maxPathBytes
  )
    return undefined
  return contained(root, value).catch(() => undefined)
}
