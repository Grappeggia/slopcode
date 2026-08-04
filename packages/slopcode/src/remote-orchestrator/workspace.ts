import path from "node:path"
import { constants } from "node:fs"
import { lstat, open, readFile, realpath } from "node:fs/promises"
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

export async function readText(root: string, target: string, line = 1, limit?: number) {
  const info = await lstat(target)
  if (!info.isFile() || info.isSymbolicLink()) throw new WorkspaceError("workspace file is not a regular file")
  const value = await contained(root, target)
  if (info.size > AgentOrchestrationLimits.maxFrameBytes)
    throw new WorkspaceError("workspace file is too large for an ACP text read")
  const content = await readFile(value, "utf8")
  const start = Math.max(0, Math.trunc(line) - 1)
  const count = limit === undefined ? undefined : Math.max(0, Math.trunc(limit))
  return content
    .split("\n")
    .slice(start, count === undefined ? undefined : start + count)
    .join("\n")
}

export async function writeText(root: string, target: string, content: string) {
  if (!valid(target)) throw new WorkspaceError("workspace path is not normalized or bounded")
  if (Buffer.byteLength(content) > AgentOrchestrationLimits.maxFrameBytes)
    throw new WorkspaceError("workspace file is too large for an ACP text write")
  const base = await realpath(root)
  const parent = path.dirname(target)
  const resolved = await realpath(parent)
  if (base !== root || resolved !== parent || !inside(base, resolved))
    throw new WorkspaceError("workspace file is outside the configured orchestration root")
  const current = await lstat(target).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined
    throw error
  })
  if (current && (!current.isFile() || current.isSymbolicLink()))
    throw new WorkspaceError("workspace file is not a regular file")
  const handle = await open(
    target,
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW,
    0o600,
  )
  try {
    await handle.writeFile(content, "utf8")
  } finally {
    await handle.close()
  }
  return target
}
