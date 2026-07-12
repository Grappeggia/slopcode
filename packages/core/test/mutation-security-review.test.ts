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

const mutationLayer = (hooks?: FileMutation.HooksInterface) =>
  FileMutation.layer.pipe(
    Layer.provide(FSUtil.defaultLayer),
    Layer.provide(
      Layer.succeed(FileMutation.Hooks, FileMutation.Hooks.of(hooks ?? { pause: () => Effect.void })),
    ),
  )

function postLayer(input: {
  formatter?: Formatter.Interface
  diagnostics?: PostMutation.DiagnosticsInterface
  events?: EventV2.Interface
  hooks?: FileMutation.HooksInterface
}) {
  const files = mutationLayer(input.hooks)
  const events = input.events
    ? Layer.succeed(EventV2.Service, EventV2.Service.of(input.events))
    : EventV2.defaultLayer
  return Layer.mergeAll(
    files,
    events,
    PostMutation.layer.pipe(
      Layer.provide(files),
      Layer.provide(events),
      Layer.provide(FSUtil.defaultLayer),
      Layer.provide(MutationEvents.layer.pipe(Layer.provide(FSUtil.defaultLayer))),
      Layer.provide(
        Layer.succeed(
          Formatter.Service,
          Formatter.Service.of(
            input.formatter ?? {
              list: () => Effect.succeed([]),
              status: () => Effect.succeed([]),
              format: () => Effect.succeed({ matched: false, outcomes: [] }),
            },
          ),
        ),
      ),
      Layer.provide(
        Layer.succeed(
          PostMutation.Diagnostics,
          PostMutation.Diagnostics.of(input.diagnostics ?? { notify: () => Effect.void }),
        ),
      ),
    ),
  )
}

describe("mutation security review", () => {
  it.live("writes the opened file rather than a symlink substituted after open", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        if (process.platform !== "linux") return
        const approved = target(directory)
        const moved = path.join(directory, "opened.txt")
        const escaped = path.join(directory, "escaped.txt")
        yield* Effect.promise(() => Promise.all([
          fs.writeFile(approved.canonical, "approved"),
          fs.writeFile(escaped, "escaped"),
        ]))
        const opened = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        const hooks: FileMutation.HooksInterface = {
          pause: (phase) => phase === "file-opened"
            ? Deferred.succeed(opened, undefined).pipe(Effect.andThen(Deferred.await(release)))
            : Effect.void,
        }
        const fiber = yield* Effect.gen(function* () {
          return yield* (yield* FileMutation.Service).write({ target: approved, content: "safe" })
        }).pipe(
          Effect.provide(mutationLayer(hooks)),
          Effect.forkChild,
        )
        yield* Deferred.await(opened)
        yield* Effect.promise(async () => {
          await fs.rename(approved.canonical, moved)
          await fs.symlink(escaped, approved.canonical)
        })
        yield* Deferred.succeed(release, undefined)
        yield* Fiber.join(fiber)
        expect(yield* Effect.promise(() => fs.readFile(moved, "utf8"))).toBe("safe")
        expect(yield* Effect.promise(() => fs.readFile(escaped, "utf8"))).toBe("escaped")
      }),
    ),
  )

  it.live("creates through the opened parent rather than a substituted parent", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        if (process.platform !== "linux") return
        const parent = path.join(directory, "parent")
        const moved = path.join(directory, "opened-parent")
        yield* Effect.promise(() => fs.mkdir(parent))
        const approved = target(parent)
        const opened = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        const hooks: FileMutation.HooksInterface = {
          pause: (phase) => phase === "parent-opened"
            ? Deferred.succeed(opened, undefined).pipe(Effect.andThen(Deferred.await(release)))
            : Effect.void,
        }
        const fiber = yield* Effect.gen(function* () {
          return yield* (yield* FileMutation.Service).create({ target: approved, content: "safe" })
        }).pipe(
          Effect.provide(mutationLayer(hooks)),
          Effect.forkChild,
        )
        yield* Deferred.await(opened)
        yield* Effect.promise(async () => {
          await fs.rename(parent, moved)
          await fs.mkdir(parent)
        })
        yield* Deferred.succeed(release, undefined)
        yield* Fiber.join(fiber)
        expect(yield* Effect.promise(() => fs.readFile(path.join(moved, "target.txt"), "utf8"))).toBe("safe")
        expect(yield* Effect.promise(() => fs.readdir(parent))).toEqual([])
      }),
    ),
  )

  it.live("formats a private stage and rejects a concurrent user edit", () =>
    withTmp((directory) => {
      const approved = target(directory, "source.fmt")
      let stage = ""
      const formatter: Formatter.Interface = {
          list: () => Effect.succeed([]),
          status: () => Effect.succeed([]),
          format: (value) => Effect.promise(async () => {
            stage = value.canonical
            expect(value.canonical).not.toBe(approved.canonical)
            expect(path.extname(value.canonical)).toBe(".fmt")
            await fs.writeFile(approved.canonical, "user")
            await fs.writeFile(value.canonical, "formatted")
            return { matched: true, outcomes: [{ name: "test", code: "formatted" }] }
          }),
      }
      return Effect.gen(function* () {
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "before"))
        const files = yield* FileMutation.Service
        const error = yield* (yield* PostMutation.Service).run({
          target: approved,
          intent: "write",
          mutation: files.write({ target: approved, content: "primitive" }),
        }).pipe(Effect.flip)
        expect(error).toMatchObject({ _tag: "FileMutation.StaleContentError" })
        expect(yield* Effect.promise(() => fs.readFile(approved.canonical, "utf8"))).toBe("user")
        expect(stage).not.toBe("")
        expect(yield* Effect.promise(() => fs.stat(path.dirname(stage)).then(() => true, () => false))).toBe(false)
      }).pipe(Effect.provide(postLayer({ formatter })))
    }),
  )

  it.live("suppresses formatting, events, and diagnostics for a primitive no-op", () =>
    withTmp((directory) => {
      const approved = target(directory, "same.fmt")
      let formats = 0
      let events = 0
      let diagnostics = 0
      return Effect.gen(function* () {
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "same"))
        const files = yield* FileMutation.Service
        const result = yield* (yield* PostMutation.Service).run({
          target: approved,
          intent: "write",
          mutation: Effect.sync(() => formats++).pipe(
            Effect.andThen(files.write({ target: approved, content: "same" })),
          ),
        })
        expect(result.change).toBe("none")
        expect(formats).toBe(1)
        expect(events).toBe(0)
        expect(diagnostics).toBe(0)
      }).pipe(Effect.provide(postLayer({
        formatter: {
          list: () => Effect.succeed([]),
          status: () => Effect.succeed([]),
          format: () => Effect.sync(() => { formats++; return { matched: true, outcomes: [] } }),
        },
        diagnostics: { notify: () => Effect.sync(() => { diagnostics++ }) },
        events: { publish: () => Effect.sync(() => { events++ }), listen: () => Effect.void },
      })))
    }),
  )

  it.live("rejects a primitive result that does not match its approved target", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        const approved = target(directory)
        const error = yield* (yield* PostMutation.Service).run({
          target: approved,
          intent: "write",
          mutation: Effect.succeed({
            operation: "write" as const,
            target: path.join(directory, "other.txt"),
            resource: "other.txt",
            existed: false,
            change: "created" as const,
          }),
        }).pipe(Effect.flip)
        expect(error).toMatchObject({ _tag: "PostMutation.ResultMismatchError" })
      }).pipe(Effect.provide(postLayer({}))),
    ),
  )

  it.live("checks the epoch before each event, diagnostics, and success", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        for (const boundary of ["semantic", "watcher", "diagnostics", "success"] as const) {
          const approved = target(directory, `${boundary}.txt`)
          let checks = 0
          let semantic = 0
          let watcher = 0
          let diagnostics = 0
          yield* Effect.gen(function* () {
            const fail = boundary === "semantic" ? 3 : boundary === "watcher" ? 4 : boundary === "diagnostics" ? 5 : 6
            const events = yield* EventV2.Service
            yield* events.listen((event) => {
              if (event.type === FileSystem.Event.Edited.type) return Effect.sync(() => { semantic++ })
              if (event.type === Watcher.Event.Updated.type) return Effect.sync(() => { watcher++ })
              return Effect.void
            })
            const files = yield* FileMutation.Service
            yield* (yield* PostMutation.Service).run({
              target: approved,
              intent: "write",
              mutation: files.write({ target: approved, content: boundary }),
              fence: {
                check: Effect.sync(() => {
                  checks++
                  if (checks === fail) throw new Error(`stale-${boundary}`)
                }),
              },
            }).pipe(Effect.exit)
            if (boundary === "semantic") expect([semantic, watcher, diagnostics]).toEqual([0, 0, 0])
            if (boundary === "watcher") expect([semantic, watcher, diagnostics]).toEqual([1, 0, 0])
            if (boundary === "diagnostics") expect([semantic, watcher, diagnostics]).toEqual([1, 1, 0])
            if (boundary === "success") expect([semantic, watcher, diagnostics]).toEqual([1, 1, 1])
          }).pipe(Effect.provide(postLayer({
            diagnostics: { notify: () => Effect.sync(() => { diagnostics++ }) },
          })))
        }
      }),
    ),
  )
})
