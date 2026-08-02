import path from "node:path"
import { realpath } from "node:fs/promises"

export class WorkspaceError extends Error {}

export async function contained(root: string, target: string) {
  const base = await realpath(root)
  const value = await realpath(target)
  const relative = path.relative(base, value)
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)))
    return value
  throw new WorkspaceError("workspace is outside the configured orchestration root")
}
