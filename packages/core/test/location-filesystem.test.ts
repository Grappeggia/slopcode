import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Exit, Layer } from "effect"
import { FileSystem } from "@slopcode-ai/core/filesystem"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { Global } from "@slopcode-ai/core/global"
import { Location } from "@slopcode-ai/core/location"
import { Reference } from "@slopcode-ai/core/reference"
import { Ripgrep } from "@slopcode-ai/core/ripgrep"
import { AbsolutePath, RelativePath } from "@slopcode-ai/core/schema"
import { location } from "./fixture/location"
import { tmpdir } from "./fixture/tmpdir"
import { it } from "./lib/effect"

const provide = (directory: string, references: Reference.Info[] = []) =>
  Effect.provide(
    FileSystem.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          FSUtil.defaultLayer,
          Ripgrep.defaultLayer,
          Global.layerWith({ data: path.join(directory, ".data") }),
          Layer.succeed(
            Reference.Service,
            Reference.Service.of({
              transform: () => Effect.die("unused"),
              list: () => Effect.succeed(references),
            }),
          ),
          Layer.succeed(Location.Service, Location.Service.of(location({ directory: AbsolutePath.make(directory) }))),
        ),
      ),
    ),
  )

const withTmp = <A, E, R>(f: (directory: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireRelease(
    Effect.promise(() => tmpdir()),
    (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
  ).pipe(Effect.flatMap((tmp) => f(tmp.path)))

describe("FileSystem", () => {
  it.live("reads text and binary files", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => fs.writeFile(path.join(directory, "text.txt"), "hello"))
        yield* Effect.promise(() => fs.writeFile(path.join(directory, "data.bin"), Buffer.from([0, 1, 2])))
        const service = yield* FileSystem.Service
        const text = yield* service.read({ path: RelativePath.make("text.txt") })
        const binary = yield* service.read({ path: RelativePath.make("data.bin") })
        expect(new TextDecoder().decode(text.content)).toBe("hello")
        expect(text.mime).toBe("text/plain")
        expect(binary.content).toEqual(new Uint8Array([0, 1, 2]))
      }).pipe(provide(directory)),
    ),
  )

  it.live("lists direct children", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => fs.mkdir(path.join(directory, "src")))
        yield* Effect.promise(() => fs.writeFile(path.join(directory, "README.md"), "# Test"))
        const entries = yield* (yield* FileSystem.Service).list()
        expect(entries.map((entry) => ({ path: entry.path, type: entry.type }))).toEqual([
          { path: RelativePath.make("src" + path.sep), type: "directory" },
          { path: RelativePath.make("README.md"), type: "file" },
        ])
      }).pipe(provide(directory)),
    ),
  )

  it.live("rejects lexical escapes", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        const result = yield* (yield* FileSystem.Service)
          .read({ path: RelativePath.make("../outside.txt") })
          .pipe(Effect.exit)
        expect(Exit.isFailure(result)).toBe(true)
      }).pipe(provide(directory)),
    ),
  )

  it.live("rejects absolute paths outside managed tool output", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        const result = yield* (yield* FileSystem.Service)
          .read({ path: path.join(directory, "outside.txt") })
          .pipe(Effect.exit)
        expect(Exit.isFailure(result)).toBe(true)
      }).pipe(provide(directory)),
    ),
  )

  it.live("allows absolute managed tool output paths", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        const managed = path.join(directory, ".data", "tool-output")
        const file = path.join(managed, "tool_test")
        yield* Effect.promise(() => fs.mkdir(managed, { recursive: true }))
        yield* Effect.promise(() => fs.writeFile(file, "full output"))

        const result = yield* (yield* FileSystem.Service).read({ path: file })

        expect(new TextDecoder().decode(result.content)).toBe("full output")
      }).pipe(provide(directory)),
    ),
  )

  it.live("resolves named reference reads", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        const docs = path.join(directory, "docs")
        yield* Effect.promise(() => fs.mkdir(docs, { recursive: true }))
        yield* Effect.promise(() => fs.writeFile(path.join(docs, "README.md"), "reference docs"))

        const service = yield* FileSystem.Service
        const resolved = yield* service.resolveReadPath({ path: "README.md", reference: "docs" })
        const result = yield* service.read({ path: "README.md", reference: "docs" })

        expect(resolved.resource).toBe("docs:README.md")
        expect(new TextDecoder().decode(result.content)).toBe("reference docs")
      }).pipe(
        provide(directory, [
          new Reference.Info({
            name: "docs",
            path: AbsolutePath.make(path.join(directory, "docs")),
            source: new Reference.LocalSource({ type: "local", path: AbsolutePath.make(path.join(directory, "docs")) }),
          }),
        ]),
      ),
    ),
  )
})
