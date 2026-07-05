export * as FileSystem from "./filesystem"

import path from "path"
import { Context, Effect, Layer, Option, Schema } from "effect"
import { EventV2 } from "./event"
import { FSUtil } from "./fs-util"
import { Global } from "./global"
import { Location } from "./location"
import { Reference } from "./reference"
import { Ripgrep } from "./ripgrep"
import { AbsolutePath, PositiveInt, RelativePath } from "./schema"
import { FileSystemSearch } from "./filesystem/search"
import { Entry, Match } from "./filesystem/schema"
import { ToolOutputStore } from "./tool-output-store"
export { Entry, Match, Submatch } from "./filesystem/schema"

export const ReadInput = Schema.Struct({
  path: Schema.String,
  reference: Schema.NonEmptyString.pipe(Schema.optional),
})
export type ReadInput = typeof ReadInput.Type

export const Content = Schema.Struct({
  uri: Schema.String,
  name: Schema.String.pipe(Schema.optional),
  content: Schema.String,
  encoding: Schema.Literals(["utf8", "base64"]),
  mime: Schema.String,
}).annotate({ identifier: "FileSystem.Content" })
export type Content = typeof Content.Type

export const ListInput = Schema.Struct({
  path: Schema.String.pipe(Schema.optional),
  reference: Schema.NonEmptyString.pipe(Schema.optional),
})
export type ListInput = typeof ListInput.Type

export class ReadPath extends Schema.Class<ReadPath>("FileSystem.ReadPath")({
  path: AbsolutePath,
  type: Schema.Literals(["file", "directory"]),
  resource: Schema.String,
}) {}

export class RootTarget extends Schema.Class<RootTarget>("FileSystem.RootTarget")({
  real: AbsolutePath,
  root: AbsolutePath,
  resource: Schema.String,
  reference: Schema.NonEmptyString.pipe(Schema.optional),
  type: Schema.Literals(["file", "directory"]),
}) {}

export class FindInput extends Schema.Class<FindInput>("FileSystem.FindInput")({
  query: Schema.String,
  type: Schema.Literals(["file", "directory"]).pipe(Schema.optional),
  limit: PositiveInt.pipe(Schema.optional),
}) {}

export class GlobInput extends Schema.Class<GlobInput>("FileSystem.GlobInput")({
  pattern: Schema.String,
  path: RelativePath.pipe(Schema.optional),
  limit: PositiveInt.pipe(Schema.optional),
}) {}

export class GrepInput extends Schema.Class<GrepInput>("FileSystem.GrepInput")({
  pattern: Schema.String,
  path: RelativePath.pipe(Schema.optional),
  include: Schema.String.pipe(Schema.optional),
  limit: PositiveInt.pipe(Schema.optional),
}) {}

export const Event = {
  Edited: EventV2.define({
    type: "file.edited",
    schema: {
      file: Schema.String,
    },
  }),
}

export interface Interface {
  readonly read: (input: ReadInput) => Effect.Effect<{ readonly content: Uint8Array; readonly mime: string }>
  readonly resolveReadPath: (input: ReadInput) => Effect.Effect<ReadPath>
  readonly resolveRoot: (input?: ListInput) => Effect.Effect<RootTarget>
  readonly list: (input?: ListInput) => Effect.Effect<Entry[]>
  readonly find: (input: FindInput) => Effect.Effect<Entry[]>
  readonly glob: (input: GlobInput) => Effect.Effect<readonly Entry[], Ripgrep.Error>
  readonly grep: (input: GrepInput) => Effect.Effect<readonly Match[], Ripgrep.Error | Ripgrep.InvalidPatternError>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/FileSystem") {}

const baseLayer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const location = yield* Location.Service
    const search = yield* FileSystemSearch.Service
    const global = yield* Effect.serviceOption(Global.Service)
    const references = yield* Effect.serviceOption(Reference.Service)
    const root = yield* fs.realPath(location.directory).pipe(Effect.orDie)
    const managed = path.join(
      Option.match(global, { onNone: () => Global.Path.data, onSome: (value) => value.data }),
      ToolOutputStore.MANAGED_DIRECTORY,
    )
    const select = Effect.fnUntraced(function* (reference?: string) {
      if (!reference) return { directory: location.directory, root }
      if (Option.isNone(references)) return yield* Effect.die(new Error(`Unknown project reference: ${reference}`))
      const found = (yield* references.value.list()).find((item) => item.name === reference)
      if (!found) return yield* Effect.die(new Error(`Unknown project reference: ${reference}`))
      const real = yield* fs.realPath(found.path).pipe(Effect.orDie)
      return { directory: found.path, root: real }
    })
    const resolve = Effect.fnUntraced(function* (input?: string, reference?: string) {
      if (input && path.isAbsolute(input)) {
        if (reference) return yield* Effect.die(new Error("Absolute paths cannot use a project reference"))
        if (path.dirname(input) !== managed || !path.basename(input).startsWith("tool_"))
          return yield* Effect.die(new Error("Absolute path is not managed tool output"))
        const real = yield* fs.realPath(input).pipe(Effect.orDie)
        const managedRoot = yield* fs.realPath(managed).pipe(Effect.orDie)
        if (path.dirname(real) !== managedRoot || !path.basename(real).startsWith("tool_"))
          return yield* Effect.die(new Error("Path escapes managed tool output"))
        return { absolute: input, real, directory: managed, root: managedRoot }
      }
      const selected = yield* select(reference)
      const absolute = path.resolve(selected.directory, input ?? ".")
      if (!FSUtil.contains(selected.directory, absolute))
        return yield* Effect.die(new Error("Path escapes the location"))
      const real = yield* fs.realPath(absolute).pipe(Effect.orDie)
      if (!FSUtil.contains(selected.root, real)) return yield* Effect.die(new Error("Path escapes the location"))
      return { absolute, real, ...selected }
    })
    const resource = (target: { root: string; real: string }, reference?: string) => {
      const relative = path.relative(target.root, target.real).replaceAll("\\", "/") || "."
      return reference === undefined ? relative : `${reference}:${relative}`
    }
    const type = Effect.fnUntraced(function* (real: string) {
      const info = yield* fs.stat(real).pipe(Effect.orDie)
      const kind = info.type === "File" ? "file" : info.type === "Directory" ? "directory" : undefined
      if (!kind) return yield* Effect.die(new Error("Path is not a file or directory"))
      return kind
    })
    const resolveReadPath = Effect.fn("FileSystem.resolveReadPath")(function* (input: ReadInput) {
      const target = yield* resolve(input.path, input.reference)
      return new ReadPath({
        path: AbsolutePath.make(target.real),
        type: yield* type(target.real),
        resource: resource(target, input.reference),
      })
    })
    const resolveRoot = Effect.fn("FileSystem.resolveRoot")(function* (input: ListInput = {}) {
      const target = yield* resolve(input.path, input.reference)
      return new RootTarget({
        real: AbsolutePath.make(target.real),
        root: AbsolutePath.make(target.root),
        resource: resource(target, input.reference),
        reference: input.reference,
        type: yield* type(target.real),
      })
    })
    return Service.of({
      find: search.find,
      glob: search.glob,
      grep: search.grep,
      resolveReadPath,
      resolveRoot,
      read: Effect.fn("FileSystem.read")(function* (input) {
        const target = yield* resolve(input.path, input.reference)
        const info = yield* fs.stat(target.real).pipe(Effect.orDie)
        if (info.type !== "File") return yield* Effect.die(new Error("Path is not a file"))
        return {
          content: yield* fs.readFile(target.real).pipe(Effect.orDie),
          mime: FSUtil.mimeType(target.real),
        }
      }),
      list: Effect.fn("FileSystem.list")(function* (input = {}) {
        const target = yield* resolve(input.path, input.reference)
        const info = yield* fs.stat(target.real).pipe(Effect.orDie)
        if (info.type !== "Directory") return yield* Effect.die(new Error("Path is not a directory"))
        return yield* fs.readDirectoryEntries(target.real).pipe(
          Effect.orDie,
          Effect.map((items) =>
            items
              .flatMap((item) => {
                if (item.type !== "file" && item.type !== "directory") return []
                const absolute = path.join(target.absolute, item.name)
                const relative = path.relative(target.directory, absolute)
                return [
                  new Entry({
                    path: RelativePath.make(relative + (item.type === "directory" ? path.sep : "")),
                    type: item.type,
                    mime: item.type === "directory" ? "application/x-directory" : FSUtil.mimeType(absolute),
                  }),
                ]
              })
              .sort((a, b) => (a.type === b.type ? a.path.localeCompare(b.path) : a.type === "directory" ? -1 : 1)),
          ),
        )
      }),
    })
  }),
)

export const layer = baseLayer.pipe(Layer.provide(FileSystemSearch.defaultLayer), Layer.provide(FSUtil.defaultLayer))

export const locationLayer = layer
