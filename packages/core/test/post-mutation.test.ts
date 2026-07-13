import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { EventV2 } from "@slopcode-ai/core/event"
import { FileMutation } from "@slopcode-ai/core/file-mutation"
import { FileSystem } from "@slopcode-ai/core/filesystem"
import { Watcher } from "@slopcode-ai/core/filesystem/watcher"
import { Formatter } from "@slopcode-ai/core/formatter"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { MutationEvents } from "@slopcode-ai/core/mutation-events"
import { PostMutation } from "@slopcode-ai/core/post-mutation"
import { tmpdir } from "./fixture/tmpdir"
import { it } from "./lib/effect"

describe("PostMutation", () => {
  it.live("settles formatting, BOM repair, canonical events, diagnostics, and final status in order", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        const target = { canonical: path.join(tmp.path, "formatted.txt"), resource: "shown.txt" }
        const order: string[] = []
        const formatter = Layer.succeed(
          Formatter.Service,
          Formatter.Service.of({
            list: () => Effect.succeed([]),
            status: () => Effect.succeed([]),
            format: (stage) =>
              Effect.promise(async () => {
                order.push("format")
                await fs.writeFile(stage.canonical, "\uFEFF\uFEFFformatted")
                return {
                  matched: true,
                  outcomes: [
                    {
                      name: "test",
                      code: "formatted" as const,
                      stdoutBytes: 0,
                      stderrBytes: 0,
                      stdoutTruncated: false,
                      stderrTruncated: false,
                      exitCode: 0,
                    },
                  ],
                }
              }),
          }),
        )
        const diagnostics = Layer.succeed(
          PostMutation.Diagnostics,
          PostMutation.Diagnostics.of({ notify: () => Effect.sync(() => order.push("diagnostics")) }),
        )
        const eventLayer = EventV2.defaultLayer
        const fileLayer = FileMutation.layer.pipe(Layer.provide(FSUtil.defaultLayer))
        const post = PostMutation.layer.pipe(
          Layer.provide(fileLayer),
          Layer.provide(formatter),
          Layer.provide(FSUtil.defaultLayer),
          Layer.provide(eventLayer),
          Layer.provide(MutationEvents.layer.pipe(Layer.provide(FSUtil.defaultLayer))),
          Layer.provide(diagnostics),
        )
        const layer = Layer.mergeAll(eventLayer, fileLayer, post)
        return Effect.gen(function* () {
          const events = yield* EventV2.Service
          yield* events.listen((event) =>
            event.type === FileSystem.Event.Edited.type || event.type === Watcher.Event.Updated.type
              ? Effect.sync(() => order.push(event.type))
              : Effect.void,
          )
          const files = yield* FileMutation.Service
          const result = yield* (yield* PostMutation.Service).run({
            target,
            intent: "write",
            mutation: files.writeTextPreservingBom({ target, content: "\uFEFFchanged" }),
            fence: PostMutation.current,
          })

          expect(yield* Effect.promise(() => fs.readFile(target.canonical, "utf8"))).toBe("\uFEFFformatted")
          expect(order).toEqual(["format", "file.edited", "file.watcher.updated", "diagnostics"])
          expect(result).toMatchObject({
            operation: "write",
            target: target.canonical,
            resource: "shown.txt",
            event: "add",
            matched: true,
            changed: true,
          })
          expect(result.bytes).toBe(Buffer.byteLength("\uFEFFformatted"))
        }).pipe(Effect.provide(layer))
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )
})
