import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Deferred, Effect, Fiber, Layer, Option, Schema } from "effect"
import { AppProcess } from "@slopcode-ai/core/process"
import { Config } from "@slopcode-ai/core/config"
import { EventV2 } from "@slopcode-ai/core/event"
import { FileMutation } from "@slopcode-ai/core/file-mutation"
import { make as makePlatform } from "@slopcode-ai/core/file-mutation-platform"
import { FileSystem } from "@slopcode-ai/core/filesystem"
import { Watcher } from "@slopcode-ai/core/filesystem/watcher"
import { Formatter } from "@slopcode-ai/core/formatter"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { Location } from "@slopcode-ai/core/location"
import { MutationEvents } from "@slopcode-ai/core/mutation-events"
import { Npm } from "@slopcode-ai/core/npm"
import { PostMutation } from "@slopcode-ai/core/post-mutation"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { location } from "./fixture/location"
import { tmpdir } from "./fixture/tmpdir"
import { it } from "./lib/effect"

const target = (directory: string, name = "target.txt") => ({
  canonical: path.join(directory, name),
  resource: name,
})

const exists = (file: string) =>
  fs.stat(file).then(
    () => true,
    () => false,
  )

const withTmp = <A, E, R>(run: (directory: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.promise(() => tmpdir()),
    (tmp) => run(tmp.path),
    (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
  )

const mutation = (
  hooks: FileMutation.HooksInterface = { pause: () => Effect.void },
  platform?: FileMutation.PlatformInterface,
) =>
  FileMutation.layer.pipe(
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
      Layer.provide(
        Layer.succeed(
          PostMutation.Diagnostics,
          PostMutation.Diagnostics.of(input.diagnostics ?? { notify: () => Effect.void }),
        ),
      ),
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
        yield* Effect.promise(() =>
          Promise.all([fs.writeFile(approved.canonical, "approved"), fs.writeFile(replacement, "replacement")]),
        )
        const checked = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        const fiber = yield* Effect.gen(function* () {
          return yield* (yield* FileMutation.Service).remove({ target: approved })
        }).pipe(
          Effect.provide(
            mutation({
              pause: (phase) =>
                phase === "before-remove-atomic"
                  ? Deferred.succeed(checked, undefined).pipe(Effect.andThen(Deferred.await(release)))
                  : Effect.void,
            }),
          ),
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

  it.live("surfaces rollback recovery while preserving both placeholder replacements", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        if (process.platform !== "linux") return
        const approved = target(directory)
        const displaced = path.join(directory, "displaced.txt")
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "approved"))
        const moved = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        const fiber = yield* Effect.gen(function* () {
          return yield* (yield* FileMutation.Service).remove({ target: approved })
        }).pipe(
          Effect.provide(
            mutation({
              pause: (phase) =>
                phase === "remove-placeholder-moved"
                  ? Deferred.succeed(moved, undefined).pipe(Effect.andThen(Deferred.await(release)))
                  : phase === "remove-exchanged"
                    ? Effect.promise(async () => {
                        await fs.rename(approved.canonical, displaced)
                        await fs.writeFile(approved.canonical, "replacement-a")
                      })
                    : Effect.void,
            }),
          ),
          Effect.flip,
          Effect.forkChild,
        )
        yield* Deferred.await(moved)
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "replacement-b"))
        yield* Deferred.succeed(release, undefined)
        const error = yield* Fiber.join(fiber)
        expect(error).toMatchObject({
          _tag: "FileMutation.RecoveryConflictError",
          path: approved.canonical,
          state: "placeholder-restore",
        })
        expect(error.recoveries).toContain(error.recovery)
        expect(yield* Effect.promise(() => fs.readFile(approved.canonical, "utf8"))).toBe("replacement-b")
        expect(yield* Effect.promise(() => fs.readFile(error.recovery, "utf8"))).toBe("replacement-a")
        expect(yield* Effect.promise(() => fs.readFile(displaced, "utf8"))).toBe("")
      }),
    ),
  )

  it.live("stages beside the approved target with a private derived same-extension name", () =>
    withTmp((directory) => {
      const approved = target(directory, "source.prettier")
      let stage = ""
      const formatter: Formatter.Interface = {
        ...none,
        format: (value) =>
          Effect.promise(async () => {
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
        expect(
          (yield* Effect.promise(() => fs.readdir(directory))).filter((name) => name.includes("slopcode")),
        ).toEqual([])
      }).pipe(Effect.provide(post({ formatter })))
    }),
  )

  it.live("keeps Darwin primitive mutation descriptor-safe while skipping formatter execution", () =>
    withTmp((directory) => {
      const approved = target(directory, "source.darwin")
      let formats = 0
      const platform: FileMutation.PlatformInterface = {
        name: "darwin",
        capabilities: { mutation: true, staging: false, exchange: false },
        path: (fd, child = "") => `/proc/self/fd/${fd}${child ? `/${child}` : ""}`,
      }
      const formatter: Formatter.Interface = {
        ...none,
        format: () => Effect.sync(() => { formats++; return { matched: true, outcomes: [] } }),
      }
      return Effect.gen(function* () {
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "before"))
        const files = yield* FileMutation.Service
        const result = yield* (yield* PostMutation.Service).run({
          target: approved,
          intent: "write",
          mutation: files.write({ target: approved, content: "primitive" }),
        })
        expect(result.formatters).toEqual([{ name: "security", code: "unsupported-security" }])
        expect(formats).toBe(0)
        expect(yield* Effect.promise(() => fs.readFile(approved.canonical, "utf8"))).toBe("primitive")
      }).pipe(Effect.provide(post({ formatter, platform })))
    }),
  )

  it.live("preserves real Prettier config discovery and explicit hidden-file formatting", () =>
    withTmp((directory) => {
      const nested = path.join(directory, "nested")
      const approved = target(nested, "source.js")
      const active = Layer.succeed(
        Location.Service,
        Location.Service.of(location({ directory: AbsolutePath.make(directory) })),
      )
      const config = Layer.succeed(
        Config.Service,
        Config.Service.of({
          entries: () =>
            Effect.succeed([
              new Config.Document({
                type: "document",
                info: Schema.decodeUnknownSync(Config.Info)({ formatter: true }),
              }),
            ]),
        }),
      )
      const npm = Layer.succeed(
        Npm.Service,
        Npm.Service.of({
          add: () => Effect.die("unused"),
          install: () => Effect.die("unused"),
          which: (name) =>
            Effect.succeed(
              name === "prettier"
                ? Option.some(path.resolve(import.meta.dir, "../../../node_modules/.bin/prettier"))
                : Option.none(),
            ),
        }),
      )
      const formatting = Formatter.layer.pipe(
        Layer.provide(AppProcess.defaultLayer),
        Layer.provide(FSUtil.defaultLayer),
        Layer.provide(active),
        Layer.provide(config),
        Layer.provide(npm),
      )
      const files = mutation()
      const events = EventV2.defaultLayer
      const layer = Layer.mergeAll(
        files,
        events,
        PostMutation.layer.pipe(
          Layer.provide(files),
          Layer.provide(formatting),
          Layer.provide(events),
          Layer.provide(MutationEvents.layer.pipe(Layer.provide(FSUtil.defaultLayer))),
          Layer.provide(PostMutation.diagnosticsLayer),
        ),
      )
      return Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await fs.mkdir(nested)
          await fs.writeFile(path.join(directory, "package.json"), JSON.stringify({ dependencies: { prettier: "1" } }))
          await fs.writeFile(
            path.join(nested, ".prettierrc"),
            JSON.stringify({ tabWidth: 7, printWidth: 10, semi: false }),
          )
          await fs.writeFile(approved.canonical, "before")
        })
        const service = yield* FileMutation.Service
        const result = yield* (yield* PostMutation.Service).run({
          target: approved,
          intent: "write",
          mutation: service.write({ target: approved, content: "const value={nested:true}" }),
        })
        expect(result.formatters).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: "prettier", code: "formatted" })]),
        )
        const output = yield* Effect.promise(() => fs.readFile(approved.canonical, "utf8"))
        expect(output).toContain("       nested: true")
        expect(output).not.toContain(";")
        expect((yield* Effect.promise(() => fs.readdir(nested))).some((name) => name.includes("slopcode"))).toBe(false)
      }).pipe(Effect.provide(layer))
    }),
  )

  it.live("checks the fence after formatter return and before commit", () =>
    withTmp((directory) => {
      const approved = target(directory, "fenced.fmt")
      let stale = false
      const formatter: Formatter.Interface = {
        ...none,
        format: (stage) =>
          Effect.promise(async () => {
            await fs.writeFile(stage.canonical, "formatted")
            stale = true
            return { matched: true, outcomes: [{ name: "test", code: "formatted" }] }
          }),
      }
      return Effect.gen(function* () {
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "before"))
        const files = yield* FileMutation.Service
        yield* (yield* PostMutation.Service)
          .run({
            target: approved,
            intent: "write",
            mutation: files.write({ target: approved, content: "primitive" }),
            fence: {
              check: Effect.sync(() => {
                if (stale) throw new Error("stale")
              }),
            },
          })
          .pipe(Effect.exit)
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
        format: () =>
          Effect.promise(async () => {
            await fs.writeFile(approved.canonical, "replacement")
            return { matched: false, outcomes: [] }
          }),
      }
      return Effect.gen(function* () {
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "before"))
        const bus = yield* EventV2.Service
        yield* bus.listen((event) =>
          event.type === FileSystem.Event.Edited.type || event.type === Watcher.Event.Updated.type
            ? Effect.sync(() => {
                events++
              })
            : Effect.void,
        )
        const files = yield* FileMutation.Service
        const error = yield* (yield* PostMutation.Service)
          .run({
            target: approved,
            intent: "write",
            mutation: files.write({ target: approved, content: "primitive" }),
          })
          .pipe(Effect.flip)
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
        for (const phase of ["stage-before-open", "stage-created", "stage-written"] as const) {
          const approved = target(directory, `${phase}.fmt`)
          yield* Effect.promise(() => fs.writeFile(approved.canonical, "before"))
          const exit = yield* Effect.gen(function* () {
            const files = yield* FileMutation.Service
            return yield* (yield* PostMutation.Service).run({
              target: approved,
              intent: "write",
              mutation: files.write({ target: approved, content: "primitive" }),
            })
          }).pipe(
            Effect.provide(
              post({
                formatter: none,
                hooks: { pause: (current) => (current === phase ? Effect.die(`fail-${phase}`) : Effect.void) },
              }),
            ),
            Effect.exit,
          )
          expect(exit._tag).toBe("Failure")
          expect(
            (yield* Effect.promise(() => fs.readdir(directory))).filter((name) => name.includes("slopcode")),
          ).toEqual([])
        }
      }),
    ),
  )

  it.live("rejects adapters without secure mutation capability instead of using pathname fallback", () =>
    withTmp((directory) => {
      let formats = 0
      return Effect.gen(function* () {
        for (const name of ["darwin", "win32"]) {
          const approved = target(directory, `${name}.fmt`)
          const platform: FileMutation.PlatformInterface = {
            name,
            capabilities: { mutation: false, staging: false, exchange: false },
            path: (directory, child) => path.join(`/mock-fd/${directory}`, child),
          }
          yield* Effect.gen(function* () {
            const files = yield* FileMutation.Service
            const error = yield* (yield* PostMutation.Service)
              .run({
                target: approved,
                intent: "write",
                mutation: files.write({ target: approved, content: "portable" }),
              })
              .pipe(Effect.flip)
            expect(error).toMatchObject({ _tag: "FileMutation.UnsupportedPlatformError", platform: name })
            expect(yield* Effect.promise(() => exists(approved.canonical))).toBe(false)
          }).pipe(
            Effect.provide(
              post({
                platform,
                formatter: {
                  ...none,
                  format: () =>
                    Effect.sync(() => {
                      formats++
                      return { matched: true, outcomes: [] }
                    }),
                },
              }),
            ),
          )
        }
        expect(formats).toBe(0)
      })
    }),
  )

  it.live("surfaces exact recovery state for every post-exchange operation failure", () =>
    withTmp((directory) =>
      Effect.scoped(
        Effect.gen(function* () {
          if (process.platform !== "linux") return
          const native = yield* makePlatform
          for (const failure of ["approved-unlink", "placeholder-move", "placeholder-unlink"] as const) {
            const approved = target(directory, `${failure}.txt`)
            yield* Effect.promise(() => fs.writeFile(approved.canonical, "approved"))
            let unlinks = 0
            const platform: FileMutation.PlatformInterface = {
              ...native,
              unlink: (fd, child) => {
                unlinks++
                if (failure === "approved-unlink" && unlinks === 1) return false
                if (failure === "placeholder-unlink" && unlinks === 2) return false
                return native.unlink!(fd, child)
              },
              move: (fd, left, right) => (failure === "placeholder-move" ? false : native.move!(fd, left, right)),
            }
            const error = yield* Effect.gen(function* () {
              return yield* (yield* FileMutation.Service).remove({ target: approved })
            }).pipe(Effect.provide(mutation(undefined, platform)), Effect.flip)
            expect(error).toMatchObject({
              _tag: "FileMutation.RecoveryConflictError",
              path: approved.canonical,
              state: failure,
            })
            expect(error.recoveries.length).toBeGreaterThan(0)
            for (const recovery of error.recoveries) expect(yield* Effect.promise(() => exists(recovery))).toBe(true)
          }
        }),
      ),
    ),
  )

  it.live("surfaces rollback exchange and rollback placeholder unlink failures", () =>
    withTmp((directory) =>
      Effect.scoped(
        Effect.gen(function* () {
          if (process.platform !== "linux") return
          const native = yield* makePlatform
          for (const failure of ["rollback-exchange", "rollback-placeholder-unlink"] as const) {
            const approved = target(directory, `${failure}.txt`)
            const original = path.join(directory, `${failure}-original.txt`)
            const replacement = path.join(directory, `${failure}-replacement.txt`)
            yield* Effect.promise(() =>
              Promise.all([fs.writeFile(approved.canonical, "approved"), fs.writeFile(replacement, "replacement")]),
            )
            let exchanges = 0
            const platform: FileMutation.PlatformInterface = {
              ...native,
              exchange: (fd, left, right) => {
                exchanges++
                if (failure === "rollback-exchange" && exchanges === 2) return false
                return native.exchange!(fd, left, right)
              },
              unlink: (fd, child) => (failure === "rollback-placeholder-unlink" ? false : native.unlink!(fd, child)),
            }
            const error = yield* Effect.gen(function* () {
              return yield* (yield* FileMutation.Service).remove({ target: approved })
            }).pipe(
              Effect.provide(
                mutation(
                  {
                    pause: (phase) =>
                      phase === "before-remove-atomic"
                        ? Effect.promise(async () => {
                            await fs.rename(approved.canonical, original)
                            await fs.rename(replacement, approved.canonical)
                          })
                        : Effect.void,
                  },
                  platform,
                ),
              ),
              Effect.flip,
            )
            expect(error).toMatchObject({
              _tag: "FileMutation.RecoveryConflictError",
              path: approved.canonical,
              state: failure,
            })
            expect(yield* Effect.promise(() => fs.readFile(original, "utf8"))).toBe("approved")
            for (const recovery of error.recoveries) expect(yield* Effect.promise(() => exists(recovery))).toBe(true)
          }
        }),
      ),
    ),
  )

  it.live("reports only observed recovery entries when a failed operation already removed its source", () =>
    withTmp((directory) => Effect.scoped(Effect.gen(function* () {
      if (process.platform !== "linux") return
      const native = yield* makePlatform
      for (const failure of ["approved-unlink", "placeholder-move", "placeholder-unlink"] as const) {
        const approved = target(directory, `${failure}-vanished.txt`)
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "approved"))
        let unlinks = 0
        const platform: FileMutation.PlatformInterface = {
          ...native,
          unlink: (fd, child) => {
            unlinks++
            if (failure === "approved-unlink" && unlinks === 1) {
              native.unlink!(fd, child)
              native.unlink!(fd, path.basename(approved.canonical))
              return false
            }
            if (failure === "placeholder-unlink" && unlinks === 2) {
              native.unlink!(fd, child)
              return false
            }
            return native.unlink!(fd, child)
          },
          move: (fd, left, right) => {
            if (failure !== "placeholder-move") return native.move!(fd, left, right)
            native.unlink!(fd, left)
            return false
          },
        }
        const error = yield* Effect.gen(function* () {
          return yield* (yield* FileMutation.Service).remove({ target: approved })
        }).pipe(Effect.provide(mutation(undefined, platform)), Effect.flip)
        expect(error).toMatchObject({ _tag: "FileMutation.OperationFailureError", state: failure })
        expect("recoveries" in error).toBe(false)
        expect((yield* Effect.promise(() => fs.readdir(directory))).filter((name) => name.includes(failure))).toEqual([])
      }
    }))),
  )

  it.live("rejects a reconstructed target with alternate staging authority before formatting", () =>
    withTmp((directory) =>
      withTmp((alternate) => {
        let formats = 0
        const approved = { ...target(directory), staging: directory }
        return Effect.gen(function* () {
          yield* Effect.promise(() => fs.writeFile(approved.canonical, "before"))
          const files = yield* FileMutation.Service
          const mutation = yield* files.write({ target: approved, content: "primitive" })
          const error = yield* (yield* PostMutation.Service)
            .run({
              target: { ...approved, staging: alternate },
              intent: "write",
              mutation: Effect.succeed(mutation),
            })
            .pipe(Effect.flip)
          expect(error).toMatchObject({ _tag: "PostMutation.ResultMismatchError" })
          expect(formats).toBe(0)
        }).pipe(
          Effect.provide(
            post({
              formatter: {
                ...none,
                format: () =>
                  Effect.sync(() => {
                    formats++
                    return { matched: false, outcomes: [] }
                  }),
              },
            }),
          ),
        )
      }),
    ),
  )

  it.effect("selects stable descriptor namespaces behind explicit platform capabilities", () =>
    Effect.sync(() => {
      expect(FileMutation.descriptorPath("linux", 7, "target.txt")).toBe("/proc/self/fd/7/target.txt")
      expect(FileMutation.descriptorPath("darwin", 7, "target.txt")).toBe("/dev/fd/7/target.txt")
      expect(FileMutation.unsupported("win32").capabilities).toEqual({
        mutation: false,
        staging: false,
        exchange: false,
      })
    }),
  )

  it.live("stages external targets under Location authority and ignores external formatter config", () =>
    withTmp((directory) =>
      withTmp((outside) => {
        const approved = {
          ...target(outside, "external.js"),
          externalDirectory: {
            action: "external_directory" as const,
            directory: outside,
            resource: `${outside}/*`,
            save: `${outside}/*`,
          },
          staging: directory,
        }
        const active = Layer.succeed(
          Location.Service,
          Location.Service.of(location({ directory: AbsolutePath.make(directory) })),
        )
        const config = Layer.succeed(
          Config.Service,
          Config.Service.of({
            entries: () =>
              Effect.succeed([
                new Config.Document({
                  type: "document",
                  info: Schema.decodeUnknownSync(Config.Info)({ formatter: true }),
                }),
              ]),
          }),
        )
        const npm = Layer.succeed(
          Npm.Service,
          Npm.Service.of({
            add: () => Effect.die("unused"),
            install: () => Effect.die("unused"),
            which: (name) =>
              Effect.succeed(
                name === "prettier"
                  ? Option.some(path.resolve(import.meta.dir, "../../../node_modules/.bin/prettier"))
                  : Option.none(),
              ),
          }),
        )
        const formatting = Formatter.layer.pipe(
          Layer.provide(AppProcess.defaultLayer),
          Layer.provide(FSUtil.defaultLayer),
          Layer.provide(active),
          Layer.provide(config),
          Layer.provide(npm),
        )
        const files = mutation()
        const events = EventV2.defaultLayer
        const layer = Layer.mergeAll(
          files,
          events,
          PostMutation.layer.pipe(
            Layer.provide(files),
            Layer.provide(formatting),
            Layer.provide(events),
            Layer.provide(MutationEvents.layer.pipe(Layer.provide(FSUtil.defaultLayer))),
            Layer.provide(PostMutation.diagnosticsLayer),
          ),
        )
        return Effect.gen(function* () {
          yield* Effect.promise(async () => {
            await fs.writeFile(
              path.join(directory, "package.json"),
              JSON.stringify({ dependencies: { prettier: "1" } }),
            )
            await fs.writeFile(
              path.join(directory, ".prettierrc"),
              JSON.stringify({ tabWidth: 2, printWidth: 10, semi: false }),
            )
            await fs.writeFile(
              path.join(outside, ".prettierrc"),
              JSON.stringify({ plugins: ["./malicious.cjs"], tabWidth: 8 }),
            )
            await fs.writeFile(path.join(outside, "malicious.cjs"), "throw new Error('external plugin loaded')")
            await fs.writeFile(approved.canonical, "before")
          })
          const service = yield* FileMutation.Service
          const result = yield* (yield* PostMutation.Service).run({
            target: approved,
            intent: "write",
            mutation: service.write({ target: approved, content: "const value={nested:true}" }),
          })
          expect(result.formatters).toContainEqual(expect.objectContaining({ name: "prettier", code: "formatted" }))
          expect(yield* Effect.promise(() => fs.readFile(approved.canonical, "utf8"))).toContain("  nested: true")
          expect((yield* Effect.promise(() => fs.readdir(outside))).some((name) => name.includes("slopcode"))).toBe(
            false,
          )
          expect(
            (yield* Effect.promise(() => fs.readdir(approved.staging))).some((name) => name.includes("slopcode")),
          ).toBe(false)
        }).pipe(Effect.provide(layer))
      }),
    ),
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
        const published: MutationEvents.Kind[] = []
        yield* events.native(
          approved.canonical,
          "change",
          Effect.sync(() => {
            published.push("change")
          }),
        )
        yield* owner.complete("add", expected)
        expect(published).toEqual(["change"])
      }).pipe(Effect.provide(MutationEvents.layer.pipe(Layer.provide(FSUtil.defaultLayer))))
    }),
  )

  it.live("routes a callback-before-complete replacement through the actual watcher adapter", () =>
    withTmp((directory) => {
      const approved = target(directory)
      return Effect.gen(function* () {
        const ownership = yield* MutationEvents.Service
        const owner = yield* ownership.begin(approved.canonical)
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "direct"))
        const expected = yield* MutationEvents.currentFingerprint(approved.canonical)
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "replacement"))
        const published: MutationEvents.Kind[] = ["add"]
        const runs: Promise<void>[] = []
        const callback = Watcher.callback({
          ownership,
          publish: (_file, event) =>
            Effect.sync(() => {
              published.push(event)
            }),
          run: (effect) => {
            runs.push(Effect.runPromise(effect))
          },
        })
        callback(null, [{ path: approved.canonical, type: "update" }])
        yield* Effect.promise(() => Promise.all(runs))
        yield* owner.complete("add", expected)
        expect(published).toEqual(["add", "change"])
      }).pipe(Effect.provide(MutationEvents.layer.pipe(Layer.provide(FSUtil.defaultLayer))))
    }),
  )

  it.effect("marks private formatter stages as watcher-internal", () =>
    Effect.sync(() => {
      expect(Watcher.isMutationStage("/project/.source.slopcode-0123456789abcdef.ts")).toBe(true)
      expect(Watcher.isMutationStage("/project/source.ts")).toBe(false)
      expect(Watcher.isMutationStage("/project/.slopcode/config.json")).toBe(false)
    }),
  )

  it.live("keeps formatter timeout nonfatal and does not replay after reopening", () =>
    withTmp((directory) => {
      const approved = target(directory, "timeout.fmt")
      let formats = 0
      const formatter: Formatter.Interface = {
        ...none,
        format: () =>
          Effect.sync(() => {
            formats++
            return { matched: true, outcomes: [{ name: "actual", code: "timeout" as const }] }
          }),
      }
      return Effect.gen(function* () {
        yield* Effect.promise(() => fs.writeFile(approved.canonical, "before"))
        yield* Effect.gen(function* () {
          const files = yield* FileMutation.Service
          const result = yield* (yield* PostMutation.Service).run({
            target: approved,
            intent: "write",
            mutation: files.write({ target: approved, content: "primitive" }),
          })
          expect(result.formatters).toEqual([{ name: "actual", code: "timeout" }])
        }).pipe(Effect.provide(post({ formatter })))
        expect(formats).toBe(1)
        yield* Effect.scoped(
          Effect.gen(function* () {
            yield* PostMutation.Service
          }).pipe(Effect.provide(post({ formatter }))),
        )
        expect(formats).toBe(1)
        expect(yield* Effect.promise(() => fs.readFile(approved.canonical, "utf8"))).toBe("primitive")
      })
    }),
  )
})
