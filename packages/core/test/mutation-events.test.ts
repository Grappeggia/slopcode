import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { MutationEvents } from "@slopcode-ai/core/mutation-events"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { tmpdir } from "./fixture/tmpdir"
import { it } from "./lib/effect"

describe("MutationEvents", () => {
  it.live("suppresses in-flight and delayed native echoes until filesystem identity changes", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        const target = path.join(tmp.path, "owned.txt")
        return Effect.gen(function* () {
          const events = yield* MutationEvents.Service
          const ownership = yield* events.begin(target)
          yield* Effect.promise(() => fs.writeFile(target, "one"))
          expect(yield* events.native(target, "add")).toBe(false)
          yield* ownership.complete("add")
          expect(yield* events.native(target, "add")).toBe(false)
          expect(yield* events.native(target, "change")).toBe(false)
          yield* Effect.promise(() => fs.writeFile(target, "two"))
          expect(yield* events.native(target, "change")).toBe(true)
        }).pipe(Effect.provide(MutationEvents.layer.pipe(Layer.provide(FSUtil.defaultLayer))))
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )
})
