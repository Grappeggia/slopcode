export * as LocationSearch from "./location-search"

import path from "path"
import { Context, Effect, Layer, Option, Schema } from "effect"
import { FileSystem } from "./filesystem"
import { FSUtil } from "./fs-util"
import { Ripgrep } from "./ripgrep"
import { NonNegativeInt, PositiveInt, RelativePath } from "./schema"

export const DEFAULT_RESULT_LIMIT = 100
export const MAX_RESULT_LIMIT = 100
export const MAX_LINE_PREVIEW_LENGTH = 2_000

export const ResultLimit = PositiveInt.check(Schema.isLessThanOrEqualTo(MAX_RESULT_LIMIT))

export const FilesInput = Schema.Struct({
  pattern: Schema.String,
  ...FileSystem.ListInput.fields,
  limit: ResultLimit.pipe(Schema.optional),
})
export type FilesInput = typeof FilesInput.Type & { readonly signal?: AbortSignal }

export const GrepInput = Schema.Struct({
  pattern: Schema.String,
  include: Schema.String.pipe(Schema.optional),
  ...FileSystem.ListInput.fields,
  limit: ResultLimit.pipe(Schema.optional),
})
export type GrepInput = typeof GrepInput.Type & { readonly signal?: AbortSignal }

export class File extends Schema.Class<File>("LocationSearch.File")({
  path: RelativePath,
  canonical: Schema.String,
  resource: Schema.String,
  mtime: Schema.Number,
}) {}

export class Submatch extends Schema.Class<Submatch>("LocationSearch.Submatch")({
  text: Schema.String,
  start: NonNegativeInt,
  end: NonNegativeInt,
}) {}

export class Match extends Schema.Class<Match>("LocationSearch.Match")({
  path: RelativePath,
  canonical: Schema.String,
  resource: Schema.String,
  lines: Schema.String,
  linePreviewTruncated: Schema.Boolean,
  line: PositiveInt,
  offset: NonNegativeInt,
  submatches: Schema.Array(Submatch),
  mtime: Schema.Number,
}) {}

export class FilesResult extends Schema.Class<FilesResult>("LocationSearch.FilesResult")({
  items: Schema.Array(File),
  truncated: Schema.Boolean,
  partial: Schema.Boolean,
}) {}

export class GrepResult extends Schema.Class<GrepResult>("LocationSearch.GrepResult")({
  items: Schema.Array(Match),
  truncated: Schema.Boolean,
  partial: Schema.Boolean,
}) {}

export interface Interface {
  readonly files: (input: FilesInput) => Effect.Effect<FilesResult, Ripgrep.Error>
  readonly grep: (input: GrepInput) => Effect.Effect<GrepResult, Ripgrep.Error | Ripgrep.InvalidPatternError>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/LocationSearch") {}

const slash = (value: string) => value.replaceAll("\\", "/")
const cap = (limit?: number) => Math.min(limit ?? DEFAULT_RESULT_LIMIT, MAX_RESULT_LIMIT)

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const filesystem = yield* FileSystem.Service
    const ripgrep = yield* Ripgrep.Service

    const candidate = Effect.fnUntraced(function* (root: FileSystem.RootTarget, cwd: string, value: string) {
      const absolute = path.resolve(cwd, value)
      const contained = root.type === "directory" ? FSUtil.contains(root.real, absolute) : absolute === root.real
      if (!contained) return
      const canonical = yield* fs.realPath(absolute).pipe(Effect.catch(() => Effect.void))
      if (!canonical || !FSUtil.contains(root.root, canonical)) return
      const info = yield* fs.stat(canonical).pipe(Effect.catch(() => Effect.void))
      if (!info || info.type !== "File") return
      const relative = slash(path.relative(root.root, canonical))
      return {
        path: RelativePath.make(relative),
        canonical,
        resource: root.reference === undefined ? relative : `${root.reference}:${relative}`,
        mtime: info.mtime.pipe(
          Option.map((date) => date.getTime()),
          Option.getOrElse(() => 0),
        ),
      }
    })

    return Service.of({
      files: Effect.fn("LocationSearch.files")(function* (input) {
        const root = yield* filesystem.resolveRoot(input)
        if (root.type !== "directory") return yield* Effect.die(new Error("Files search path must be a directory"))
        const limit = cap(input.limit)
        const found =
          input.reference || path.isAbsolute(input.path ?? "")
            ? yield* ripgrep.glob({
                cwd: root.real,
                pattern: input.pattern,
                limit: limit + 1,
                signal: input.signal,
              })
            : yield* filesystem.glob({
                pattern: input.pattern,
                path: input.path === undefined ? undefined : RelativePath.make(input.path),
                limit: limit + 1,
              })
        const selected = found.slice(0, limit)
        const mapped = yield* Effect.forEach(selected, (item) => candidate(root, root.root, item.path), {
          concurrency: 16,
        })
        const items = mapped.filter((item): item is File => item !== undefined).map((item) => new File(item))
        return new FilesResult({
          items,
          truncated: found.length > limit,
          partial: items.length !== selected.length,
        })
      }),
      grep: Effect.fn("LocationSearch.grep")(function* (input) {
        const root = yield* filesystem.resolveRoot(input)
        const cwd = root.type === "directory" ? root.real : path.dirname(root.real)
        const limit = cap(input.limit)
        const results =
          input.reference || path.isAbsolute(input.path ?? "")
            ? yield* ripgrep.grep({
                cwd,
                pattern: input.pattern,
                include: input.include,
                file: root.type === "file" ? path.basename(root.real) : undefined,
                limit: limit + 1,
                signal: input.signal,
              })
            : yield* filesystem.grep({
                pattern: input.pattern,
                path: input.path === undefined ? undefined : RelativePath.make(input.path),
                include: input.include,
                limit: limit + 1,
              })
        const selected = results.slice(0, limit)
        const mapped = yield* Effect.forEach(
          selected,
          (item) =>
            candidate(
              root,
              input.reference || path.isAbsolute(input.path ?? "") ? cwd : root.root,
              item.entry.path,
            ).pipe(
              Effect.map((file) => {
                if (!file) return
                const lines = item.text.slice(0, MAX_LINE_PREVIEW_LENGTH)
                return new Match({
                  ...file,
                  lines,
                  linePreviewTruncated: item.text.length > MAX_LINE_PREVIEW_LENGTH,
                  line: item.line,
                  offset: item.offset,
                  submatches: item.submatches.map((submatch) => new Submatch(submatch)),
                })
              }),
            ),
          { concurrency: 16 },
        )
        const items = mapped.filter((item): item is Match => item !== undefined)
        return new GrepResult({
          items,
          truncated: selected.length < results.length,
          partial: items.length !== selected.length,
        })
      }),
    })
  }),
)

export const locationLayer = layer.pipe(Layer.provide(FileSystem.locationLayer))
