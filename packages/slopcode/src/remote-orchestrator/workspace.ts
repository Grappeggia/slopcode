import path from "node:path"
import { realpath } from "node:fs/promises"
import { AgentOrchestrationLimits } from "@slopcode-ai/protocol"

export class WorkspaceError extends Error {}

const controls = /[\u0000-\u001f\u007f-\u009f]/
const valid = (value: string) => {
  if (
    !path.isAbsolute(value) ||
    controls.test(value) ||
    Buffer.byteLength(value) > AgentOrchestrationLimits.maxPathBytes ||
    value.includes("\\") ||
    value.includes(`${path.sep}${path.sep}`) ||
    path.normalize(value) !== value
  )
    return false
  return value.split(path.sep).every((segment) => segment !== "." && segment !== "..")
}

const inside = (base: string, value: string) => {
  const relative = path.relative(base, value)
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
}

export async function contained(root: string, target: string) {
  if (!valid(target)) throw new WorkspaceError("workspace path is not normalized or bounded")
  const base = await realpath(root)
  const value = await realpath(target)
  if (valid(base) && valid(value) && inside(base, value)) return value
  throw new WorkspaceError("workspace is outside the configured orchestration root")
}

export async function approvalCwd(root: string, value: string | undefined) {
  if (!value || !valid(value)) return undefined
  return contained(root, value).catch(() => undefined)
}
