import path from "path"
import { Effect, Schema } from "effect"
import { InstanceState } from "@/effect/instance-state"
import type * as Tool from "./tool"
import { containsPath, type InstanceContext } from "../project/instance-context"
import { FSUtil } from "@slopcode-ai/core/fs-util"

type Kind = "file" | "directory"

type Options = {
  bypass?: boolean
  kind?: Kind
}

export interface ResolvedPath {
  readonly original: string
  readonly canonical: string
  readonly exists: boolean
  readonly directory: boolean
}

export class PathResolutionError extends Schema.TaggedErrorClass<PathResolutionError>()("PathResolutionError", {
  path: Schema.String,
  reason: Schema.Literals(["broken_symlink", "symlink_loop", "non_directory_ancestor", "filesystem"]),
  cause: Schema.optional(Schema.Defect()),
}) {
  override get message() {
    return `Cannot resolve path ${this.path}: ${this.reason}`
  }
}

function missing(error: FSUtil.Error) {
  return error._tag === "PlatformError" && error.reason._tag === "NotFound"
}

function errno(error: FSUtil.Error) {
  if (error._tag !== "PlatformError" || !("cause" in error.reason)) return
  const cause = error.reason.cause
  if (!cause || typeof cause !== "object" || !("code" in cause) || typeof cause.code !== "string") return
  return cause.code
}

function failure(filepath: string, error: FSUtil.Error) {
  return new PathResolutionError({
    path: filepath,
    reason: errno(error) === "ELOOP" ? "symlink_loop" : "filesystem",
    cause: error,
  })
}

export const resolvePathEffect = Effect.fn("Tool.resolvePath")(function* (
  fs: FSUtil.Interface,
  target: string,
  base = process.cwd(),
) {
  const original = path.resolve(
    process.platform === "win32" ? FSUtil.windowsPath(base) : base,
    process.platform === "win32" ? FSUtil.windowsPath(target) : target,
  )
  let current = original

  while (true) {
    const canonical = yield* fs.realPath(current).pipe(
      Effect.map((value) => value as string | undefined),
      Effect.catch((error) => (missing(error) ? Effect.succeed(undefined) : Effect.fail(failure(original, error)))),
    )
    if (canonical !== undefined) {
      const info = yield* fs.stat(canonical).pipe(Effect.mapError((error) => failure(original, error)))
      if (current !== original && info.type !== "Directory") {
        return yield* new PathResolutionError({ path: original, reason: "non_directory_ancestor" })
      }
      return {
        original,
        canonical: current === original ? canonical : path.resolve(canonical, path.relative(current, original)),
        exists: current === original,
        directory: current === original && info.type === "Directory",
      } satisfies ResolvedPath
    }

    const link = yield* fs.readLink(current).pipe(
      Effect.as(true),
      Effect.catch((error) => {
        if (
          missing(error) ||
          (error._tag === "PlatformError" && error.reason._tag === "InvalidData") ||
          errno(error) === "EINVAL"
        ) {
          return Effect.succeed(false)
        }
        return Effect.fail(failure(original, error))
      }),
    )
    if (link) return yield* new PathResolutionError({ path: original, reason: "broken_symlink" })

    const parent = path.dirname(current)
    if (parent === current) {
      return yield* new PathResolutionError({ path: original, reason: "non_directory_ancestor" })
    }
    current = parent
  }
})

export const resolveBoundaryEffect = Effect.fn("Tool.resolveBoundary")(function* (
  fs: FSUtil.Interface,
  ctx: InstanceContext,
) {
  return {
    ...ctx,
    directory: (yield* resolvePathEffect(fs, ctx.directory)).canonical,
    worktree: ctx.worktree === "/" ? "/" : (yield* resolvePathEffect(fs, ctx.worktree)).canonical,
  } satisfies InstanceContext
})

export const assertExternalDirectoryWithFsEffect = Effect.fn("Tool.assertExternalDirectory")(function* (
  fs: FSUtil.Interface,
  ctx: Tool.Context,
  target?: string | ResolvedPath,
  options?: Options,
) {
  if (!target) return false
  if (options?.bypass && typeof target === "string") return false

  const ins = yield* InstanceState.context
  const resolved = typeof target === "string" ? yield* resolvePathEffect(fs, target, ins.directory) : target
  if (options?.bypass) return resolved
  if (containsPath(resolved.canonical, yield* resolveBoundaryEffect(fs, ins))) return resolved

  const kind = options?.kind ?? (resolved.directory ? "directory" : "file")
  const dir = kind === "directory" ? resolved.canonical : path.dirname(resolved.canonical)
  const glob =
    process.platform === "win32"
      ? FSUtil.normalizePathPattern(path.join(dir, "*"))
      : path.join(dir, "*").replaceAll("\\", "/")

  yield* ctx.ask({
    permission: "external_directory",
    patterns: [glob],
    always: [glob],
    metadata: {
      filepath: resolved.original,
      canonicalPath: resolved.canonical,
      parentDir: dir,
      resource: glob,
    },
  })
  return resolved
})

export const assertExternalDirectoryEffect = Effect.fn("Tool.assertExternalDirectory")(function* (
  ctx: Tool.Context,
  target?: string | ResolvedPath,
  options?: Options,
) {
  if (!target || (options?.bypass && typeof target === "string")) return false
  return yield* assertExternalDirectoryWithFsEffect(yield* FSUtil.Service, ctx, target, options)
})

export async function assertExternalDirectory(ctx: Tool.Context, target?: string | ResolvedPath, options?: Options) {
  return Effect.runPromise(
    assertExternalDirectoryEffect(ctx, target, options).pipe(Effect.provide(FSUtil.defaultLayer)),
  )
}
