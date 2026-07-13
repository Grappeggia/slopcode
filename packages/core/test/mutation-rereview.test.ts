import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Deferred, Effect, Fiber, Layer } from "effect"
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

const target = (directory: string, name = "target.txt") => ({
  canonical: path.join(directory, name),
  resource: name,
})

const withTmp = <A, E, R>(run: (directory: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.promise(() => tmpdir()),
    (tmp) => run(tmp.path),
    (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
  )

const mutation = (
  hooks: FileMutation.HooksInterface = { pause: () => Effect.void },
  platform?: FileMutation.PlatformInterface,
) => FileMutation.layer.pipe(
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Layer.succeed(FileMutation.Hooks, FileMutation.Hooks.of(hooks))),
  ...(platform ? [Layer.provide(Layer.succeed(FileMutation.Platform, FileMutation.Platform.of(platform)))] : []),
)

function post(input: {
  formatter: Formatter.Interface
  hooks?: FileMutation.HooksInterface
  diagnostics?: PostMutation.DiagnosticsInterface
  platform?: FileMutation.PlatformInterface
}) {
  const files = mutation(input.hooks, input.platform)
  const events = EventV2.defaultLayer
  return Layer.mergeAll(
    files,
    events,
    PostMutation.layer.pipe(
      Layer.provide(files),
      Layer.provide(events),
      Layer.provide(FSUtil.defaultLayer),
      Layer.provide(MutationEvents.layer.pipe(Layer.provide(FSUtil.defaultLayer))),
      Layer.provide(Layer.succeed(Formatter.Service, Formatter.Service.of(input.formatter))),
      Layer.provide(Layer.succeed(
        PostMutation.Diagnostics,
        PostMutation.Diagnostics.of(input.diagnostics ?? { notify: () => Effect.void }),
      )),
    ),
  )
}

const none: Formatter.Interface = {
  format: () => Effect.succeed({ matched: false, outcomes: [] }),
  list: () => Effect.succeed([]),
  status: () => Effect.succeed([]),
}

describe("mutation rejection re-review", () => {
  it.live("atomically restores and preserves a child substituted immediately before delete", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        if (process.platform !== "linux") return
        const approved = target(directory)
        const original = path.join(directory, "original.txt")
        const replacement = path.join(directory, "replacement.txt")
        yield* Effect.promise(() => Promise.all([
          fs.writeFile(approved.canonical, "approved"),
          fs.writeFile(replacement, "replacement"),
        ]))
        const checked = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        const fiber = yield* Effect.gen(function* () {
          return yield* (yield* FileMutation.Service).remove({ target: approved })
        }).pipe(
          Effect.provide(mutation({
            pause: (phase) => phase === "before-remove-atomic"
              ? Deferred.succeed(checked, undefined).pipe(Effect.andThen(Deferred.await(release)))
              : Effect.void,
          })),
          Effect.flip,
          Effect.forkChild,
        )
        yield* Deferred.await(checked)
        yield* Effect.promise(async () => {
          await fs.rename(approved.canonical, original)
          await fs.rename(replacement, approved.canonical)
        })
        yield* Deferred.succeed(release, undefined)
        expect(yield* Fiber.join(fiber)).toMatchObject({ _tag: "FileMutation.TargetChangedError" })
        expect(yield* Effect.promise(() => fs.readFile(approved.canonical, "utf8"))).toBe("replacement")
        expect(yield* Effect.promise(() => fs.readFile(original, "utf8"))).toBe("approved")
      }),
    ),
  )

  it.live("stages beside the approved target with a private derived same-extension name", () =>
    withTmp((directory) => {
      const approved = target(directory, "source.prettier")
      let stage = ""
      const formatter: Formatter.Interface = {
        ...none,
        format: (value) => Effect.promise(async () => {
          stage = value.canonical
          expect(await fs.realpath(path.dirname(stage))).toBe(await fs.realpath(directory))
          expect(path.extname(stage)).toBe(".prettier")
          expect(path.basename(stage)).toContain("source")
          expect((await fs.stat(stage)).mode & 0o777).toBe(0o600)
          await fs.writeFile(stage, "formatted")
          return { matched: true, outcomes: [{ name: "test", code: "formatted" }] }
        }),
      }
      return Effect.gen(function* () {
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "before"))
        const files = yield* FileMutation.Service
        yield* (yield* PostMutation.Service).run({
          target: approved,
          intent: "write",
          mutation: files.write({ target: approved, content: "primitive" }),
        })
        expect(stage).not.toBe("")
        expect((yield* Effect.promise(() => fs.readdir(directory))).filter((name) => name.includes("slopcode"))).toEqual([])
      }).pipe(Effect.provide(post({ formatter })))
    }),
  )

  it.live("checks the fence after formatter return and before commit", () =>
    withTmp((directory) => {
      const approved = target(directory, "fenced.fmt")
      let stale = false
      const formatter: Formatter.Interface = {
        ...none,
        format: (stage) => Effect.promise(async () => {
          await fs.writeFile(stage.canonical, "formatted")
          stale = true
          return { matched: true, outcomes: [{ name: "test", code: "formatted" }] }
        }),
      }
      return Effect.gen(function* () {
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "before"))
        const files = yield* FileMutation.Service
        yield* (yield* PostMutation.Service).run({
          target: approved,
          intent: "write",
          mutation: files.write({ target: approved, content: "primitive" }),
          fence: { check: Effect.sync(() => { if (stale) throw new Error("stale") }) },
        }).pipe(Effect.exit)
        expect(yield* Effect.promise(() => fs.readFile(approved.canonical, "utf8"))).toBe("primitive")
      }).pipe(Effect.provide(post({ formatter })))
    }),
  )

  it.live("validates an unmatched target before publishing events", () =>
    withTmp((directory) => {
      const approved = target(directory, "unmatched.txt")
      let events = 0
      const formatter: Formatter.Interface = {
        ...none,
        format: () => Effect.promise(async () => {
          await fs.writeFile(approved.canonical, "replacement")
          return { matched: false, outcomes: [] }
        }),
      }
      return Effect.gen(function* () {
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "before"))
        const bus = yield* EventV2.Service
        yield* bus.listen((event) =>
          event.type === FileSystem.Event.Edited.type || event.type === Watcher.Event.Updated.type
            ? Effect.sync(() => { events++ })
            : Effect.void,
        )
        const files = yield* FileMutation.Service
        const error = yield* (yield* PostMutation.Service).run({
          target: approved,
          intent: "write",
          mutation: files.write({ target: approved, content: "primitive" }),
        }).pipe(Effect.flip)
        expect(error).toMatchObject({ _tag: "FileMutation.StaleContentError" })
        expect(events).toBe(0)
      }).pipe(Effect.provide(post({ formatter })))
    }),
  )

  it.live("does not fail a durable mutation solely because it exceeds sixteen MiB", () =>
    withTmp((directory) => {
      const approved = target(directory, "large.fmt")
      const content = new Uint8Array(16 * 1024 * 1024 + 1).fill(97)
      return Effect.gen(function* () {
        const files = yield* FileMutation.Service
        const result = yield* (yield* PostMutation.Service).run({
          target: approved,
          intent: "write",
          mutation: files.write({ target: approved, content }),
        })
        expect(result.bytes).toBe(content.length)
        expect((yield* Effect.promise(() => fs.stat(approved.canonical))).size).toBe(content.length)
      }).pipe(Effect.provide(post({ formatter: none })))
    }),
  )

  it.live("cleans every partially acquired in-directory stage", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        for (const phase of ["stage-created", "stage-written"] as const) {
          const approved = target(directory, `${phase}.fmt`)
          yield* Effect.promise(() => fs.writeFile(approved.canonical, "before"))
          yield* Effect.gen(function* () {
            const files = yield* FileMutation.Service
            yield* (yield* PostMutation.Service).run({
              target: approved,
              intent: "write",
              mutation: files.write({ target: approved, content: "primitive" }),
            }).pipe(Effect.exit)
          }).pipe(Effect.provide(post({
            formatter: none,
            hooks: { pause: (current) => current === phase ? Effect.die(`fail-${phase}`) : Effect.void },
          })))
          expect((yield* Effect.promise(() => fs.readdir(directory))).filter((name) => name.includes("slopcode"))).toEqual([])
        }
      }),
    ),
  )

  it.live("preserves primitive parity and skips formatting on insecure platform adapters", () =>
    withTmp((directory) => {
      const approved = target(directory, "portable.fmt")
      let formats = 0
      const platform: FileMutation.PlatformInterface = { name: "darwin", secure: false }
      return Effect.gen(function* () {
        const files = yield* FileMutation.Service
        const result = yield* (yield* PostMutation.Service).run({
          target: approved,
          intent: "write",
          mutation: files.write({ target: approved, content: "portable" }),
        })
        expect(yield* Effect.promise(() => fs.readFile(approved.canonical, "utf8"))).toBe("portable")
        expect(result.formatters).toEqual([{ name: "security", code: "unsupported-security" }])
        expect(formats).toBe(0)
      }).pipe(Effect.provide(post({
        platform,
        formatter: { ...none, format: () => Effect.sync(() => { formats++; return { matched: true, outcomes: [] } }) },
      })))
    }),
  )

  it.live("event completion retains the validated identity instead of adopting replacement bytes", () =>
    withTmp((directory) => {
      const approved = target(directory)
      return Effect.gen(function* () {
        const events = yield* MutationEvents.Service
        const owner = yield* events.begin(approved.canonical)
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "approved"))
        const expected = MutationEvents.fileFingerprint(new TextEncoder().encode("approved"))
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "replacement"))
        yield* owner.complete("add", expected)
        expect(yield* events.native(approved.canonical, "change")).toBe(true)
      }).pipe(Effect.provide(MutationEvents.layer.pipe(Layer.provide(FSUtil.defaultLayer))))
    }),
  )
})
