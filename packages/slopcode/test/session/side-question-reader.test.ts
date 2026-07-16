import { describe, expect } from "bun:test"
import { descriptorPath } from "@slopcode-ai/core/file-mutation-platform"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import type { PermissionV1 } from "@slopcode-ai/core/v1/permission"
import { Deferred, Effect, Exit, Layer } from "effect"
import * as Scope from "effect/Scope"
import fs from "fs/promises"
import path from "path"
import type { ToolExecutionOptions } from "ai"
import { Permission } from "../../src/permission"
import { SideQuestionReader } from "../../src/session/side-question-reader"
import { TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const env = Layer.mergeAll(FSUtil.defaultLayer, Permission.defaultLayer)
const it = testEffect(env)
const supported = process.platform === "linux" || process.platform === "darwin"
const secureIt = supported ? it.instance : it.instance.skip
const unsupportedIt = supported ? it.instance.skip : it.instance
const allow = [{ permission: "read", pattern: "*", action: "allow" }] satisfies PermissionV1.Ruleset

const options = (id: string, signal = new AbortController().signal) =>
  ({ toolCallId: id, messages: [], abortSignal: signal }) as ToolExecutionOptions

const execute = (
  reader: SideQuestionReader.Reader,
  input: { path: string; reference?: string; offset?: number; limit?: number },
  id = "call_read",
  signal?: AbortSignal,
) => {
  if (!reader.tool.execute) throw new Error("private read tool is not executable")
  return Promise.resolve(reader.tool.execute(input, options(id, signal)) as SideQuestionReader.Result)
}

describe("SideQuestionReader", () => {
  secureIt("reads regular text with bounded offset and limit", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      yield* Effect.promise(() => fs.writeFile(path.join(fixture.directory, "notes.txt"), "one\ntwo\nthree\nfour"))
      const reader = yield* SideQuestionReader.make({ ruleset: allow, reference: () => Effect.succeed(undefined) })

      const result = yield* Effect.promise(() => execute(reader, { path: "notes.txt", offset: 2, limit: 2 }))

      expect(result.output).toContain("2: two\n3: three")
      expect(result.output).not.toContain("one")
      expect(reader.usage()).toMatchObject({ calls: 1, files: 1, lines: 2 })
      expect(Object.keys(reader.tools)).toEqual(["read"])
    }),
  )

  it.instance("rejects lexical, absolute, symlink, directory, binary, and media reads", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      const outside = path.join(path.dirname(fixture.directory), `outside-${path.basename(fixture.directory)}.txt`)
      yield* Effect.promise(async () => {
        await fs.writeFile(outside, "outside secret")
        await fs.mkdir(path.join(fixture.directory, "folder"))
        await fs.writeFile(path.join(fixture.directory, "binary.dat"), Buffer.from([0, 1, 2, 3]))
        await fs.writeFile(path.join(fixture.directory, "image.png"), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        await fs.symlink(outside, path.join(fixture.directory, "escape.txt"))
      })
      const reader = yield* SideQuestionReader.make({ ruleset: allow, reference: () => Effect.succeed(undefined) })

      for (const [index, input] of [
        { path: "../outside.txt" },
        { path: outside },
        { path: "escape.txt" },
        { path: "folder" },
        { path: "binary.dat" },
        { path: "image.png" },
      ].entries()) {
        yield* Effect.promise(async () => expect(execute(reader, input, `rejected_${index}`)).rejects.toThrow())
      }
      yield* Effect.promise(() => fs.rm(outside, { force: true }))
    }),
  )

  it.instance("rejects a file replaced by a symlink after canonical authorization", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      const target = path.join(fixture.directory, "target.txt")
      const backup = path.join(fixture.directory, "target.original.txt")
      const outside = path.join(path.dirname(fixture.directory), `secret-${path.basename(fixture.directory)}.txt`)
      yield* Effect.promise(async () => {
        await fs.writeFile(target, "inside")
        await fs.writeFile(outside, "outside secret")
      })
      const live = yield* FSUtil.Service
      let swapped = false
      const raced = FSUtil.Service.of({
        ...live,
        realPath: (value) =>
          live.realPath(value).pipe(
            Effect.tap(() => {
              if (value !== target || swapped) return Effect.void
              swapped = true
              return Effect.promise(async () => {
                await fs.rename(target, backup)
                await fs.symlink(outside, target)
              })
            }),
          ),
      })
      const reader = yield* SideQuestionReader.make({
        ruleset: allow,
        reference: () => Effect.succeed(undefined),
      }).pipe(Effect.provideService(FSUtil.Service, raced))

      yield* Effect.promise(async () => expect(execute(reader, { path: "target.txt" })).rejects.toThrow())
      expect(reader.usage().files).toBe(0)
      yield* Effect.promise(() => fs.rm(outside, { force: true }))
    }),
  )

  it.instance("requires configured external references", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      const docs = path.join(path.dirname(fixture.directory), `docs-${path.basename(fixture.directory)}`)
      yield* Effect.promise(async () => {
        await fs.mkdir(docs)
        await fs.writeFile(path.join(docs, "guide.txt"), "reference guide")
      })
      const reference = (name: string) => Effect.succeed(name === "docs" ? docs : undefined)
      const blocked = yield* SideQuestionReader.make({ ruleset: allow, reference })
      yield* Effect.promise(async () =>
        expect(execute(blocked, { path: "guide.txt", reference: "docs" }, "blocked")).rejects.toThrow(/unavailable/i),
      )
      yield* Effect.promise(async () =>
        expect(execute(blocked, { path: "guide.txt", reference: "missing" }, "missing")).rejects.toThrow(
          /unavailable/i,
        ),
      )

      yield* Effect.promise(() => fs.rm(docs, { recursive: true, force: true }))
      expect(yield* (yield* Permission.Service).list()).toEqual([])
    }),
  )

  secureIt("reads pre-approved external references", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      const docs = path.join(path.dirname(fixture.directory), `docs-${path.basename(fixture.directory)}`)
      yield* Effect.promise(async () => {
        await fs.mkdir(docs)
        await fs.writeFile(path.join(docs, "guide.txt"), "reference guide")
      })

      const reader = yield* SideQuestionReader.make({
        ruleset: [...allow, { permission: "external_directory", pattern: path.join(docs, "*"), action: "allow" }],
        reference: (name) => Effect.succeed(name === "docs" ? docs : undefined),
      })
      const result = yield* Effect.promise(() => execute(reader, { path: "guide.txt", reference: "docs" }, "guide"))
      expect(result.output).toContain("reference guide")
      yield* Effect.promise(async () =>
        expect(execute(reader, { path: "../secret.txt", reference: "docs" }, "escape")).rejects.toThrow(/escapes/i),
      )
      yield* Effect.promise(() => fs.rm(docs, { recursive: true, force: true }))
      expect(yield* (yield* Permission.Service).list()).toEqual([])
    }),
  )

  it.instance("authorizes requested and canonical worktree-relative aliases", () =>
    Effect.gen(function* () {
      if (process.platform === "win32") return
      const fixture = yield* TestInstance
      yield* Effect.promise(async () => {
        await fs.writeFile(path.join(fixture.directory, "target.txt"), "secret")
        await fs.symlink("target.txt", path.join(fixture.directory, "alias.txt"))
      })
      const alias = path.relative("/", path.join(fixture.directory, "alias.txt"))
      const target = path.relative("/", path.join(fixture.directory, "target.txt"))
      const requested = yield* SideQuestionReader.make({
        ruleset: [...allow, { permission: "read", pattern: alias, action: "deny" }],
        reference: () => Effect.succeed(undefined),
      })
      const canonical = yield* SideQuestionReader.make({
        ruleset: [...allow, { permission: "read", pattern: target, action: "ask" }],
        reference: () => Effect.succeed(undefined),
      })

      yield* Effect.promise(async () =>
        expect(execute(requested, { path: "alias.txt" }, "requested_alias")).rejects.toThrow(/unavailable/i),
      )
      yield* Effect.promise(async () =>
        expect(execute(canonical, { path: "alias.txt" }, "canonical_alias")).rejects.toThrow(/unavailable/i),
      )
      expect(yield* (yield* Permission.Service).list()).toEqual([])
    }),
  )

  it.instance("uses normal read resources for configured references", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      const docs = path.join(path.dirname(fixture.directory), `resource-${path.basename(fixture.directory)}`)
      yield* Effect.promise(async () => {
        await fs.mkdir(docs)
        await fs.writeFile(path.join(docs, "guide.txt"), "reference secret")
      })
      const resource = path.relative("/", path.join(docs, "guide.txt")).replaceAll("\\", "/")
      const reader = yield* SideQuestionReader.make({
        ruleset: [
          ...allow,
          { permission: "read", pattern: resource, action: "deny" },
          { permission: "external_directory", pattern: path.join(docs, "*"), action: "allow" },
        ],
        reference: (name) => Effect.succeed(name === "docs" ? docs : undefined),
      })

      yield* Effect.promise(async () =>
        expect(execute(reader, { path: "guide.txt", reference: "docs" }, "reference_resource")).rejects.toThrow(
          /unavailable/i,
        ),
      )
      expect(yield* (yield* Permission.Service).list()).toEqual([])
      yield* Effect.promise(() => fs.rm(docs, { recursive: true, force: true }))
    }),
  )

  it.instance("checks permission before target existence and hides denied existence", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      const existing = path.join(fixture.directory, "existing.txt")
      const missing = path.join(fixture.directory, "missing.txt")
      yield* Effect.promise(() => fs.writeFile(existing, "secret"))
      const live = yield* FSUtil.Service
      const targets: string[] = []
      const guarded = FSUtil.Service.of({
        ...live,
        realPath: (value) => {
          if (value === existing || value === missing) targets.push(value)
          return live.realPath(value)
        },
      })
      const reader = yield* SideQuestionReader.make({
        ruleset: [
          ...allow,
          ...[existing, missing].map((target) => ({
            permission: "read" as const,
            pattern: path.relative("/", target),
            action: "deny" as const,
          })),
        ],
        reference: () => Effect.succeed(undefined),
      }).pipe(Effect.provideService(FSUtil.Service, guarded))
      const messages = yield* Effect.promise(() =>
        Promise.all(
          ["existing.txt", "missing.txt"].map((name, index) =>
            execute(reader, { path: name }, `hidden_${index}`).then(
              () => "read unexpectedly succeeded",
              (cause: unknown) => (cause instanceof Error ? cause.message : String(cause)),
            ),
          ),
        ),
      )

      expect(messages[0]).toBe(messages[1])
      expect(messages[0]).toMatch(/unavailable/i)
      expect(targets).toEqual([])
      expect(yield* (yield* Permission.Service).list()).toEqual([])
    }),
  )

  secureIt("atomically rejects a sixth canonical file under concurrent reads", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      yield* Effect.promise(() =>
        Promise.all(
          Array.from({ length: 6 }, (_, index) =>
            fs.writeFile(path.join(fixture.directory, `${index}.txt`), `file ${index}`),
          ),
        ),
      )
      const reader = yield* SideQuestionReader.make({ ruleset: allow, reference: () => Effect.succeed(undefined) })

      const results = yield* Effect.promise(() =>
        Promise.allSettled(
          Array.from({ length: 6 }, (_, index) => execute(reader, { path: `${index}.txt` }, `call_${index}`)),
        ),
      )

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5)
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
      expect(reader.usage().files).toBe(5)
    }),
  )

  secureIt("counts repeated canonical reads once and resets each question", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      yield* Effect.promise(() =>
        Promise.all(
          Array.from({ length: 6 }, (_, index) =>
            fs.writeFile(path.join(fixture.directory, `${index}.txt`), `line one\nline two ${index}`),
          ),
        ),
      )
      const first = yield* SideQuestionReader.make({ ruleset: allow, reference: () => Effect.succeed(undefined) })
      yield* Effect.promise(() => execute(first, { path: "0.txt", limit: 1 }, "repeat_1"))
      yield* Effect.promise(() => execute(first, { path: "0.txt", offset: 2 }, "repeat_2"))
      for (let index = 1; index < 5; index++) {
        yield* Effect.promise(() => execute(first, { path: `${index}.txt` }, `call_${index}`))
      }
      expect(first.usage().files).toBe(5)
      yield* Effect.promise(async () => expect(execute(first, { path: "5.txt" })).rejects.toThrow(/5 unique files/i))

      const second = yield* SideQuestionReader.make({ ruleset: allow, reference: () => Effect.succeed(undefined) })
      yield* Effect.promise(async () =>
        expect(execute(second, { path: "5.txt" })).resolves.toMatchObject({
          output: expect.stringContaining("line two 5"),
        }),
      )
      expect(second.usage().files).toBe(1)
    }),
  )

  secureIt("counts hard links as one opened file identity", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      const original = path.join(fixture.directory, "original.txt")
      yield* Effect.promise(async () => {
        await fs.writeFile(original, "same file")
        await fs.link(original, path.join(fixture.directory, "alias.txt"))
      })
      const reader = yield* SideQuestionReader.make({ ruleset: allow, reference: () => Effect.succeed(undefined) })

      yield* Effect.promise(() => execute(reader, { path: "original.txt" }, "original"))
      yield* Effect.promise(() => execute(reader, { path: "alias.txt" }, "alias"))

      expect(reader.usage().files).toBe(1)
    }),
  )

  secureIt("pins verified identity descriptors until the request scope closes", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      const target = path.join(fixture.directory, "pinned.txt")
      yield* Effect.promise(() => fs.writeFile(target, "pinned content"))
      const scope = yield* Scope.make()
      let descriptor: string | undefined
      let identity: string | undefined
      let releases = 0
      const reader = yield* SideQuestionReader.make({
        ruleset: allow,
        reference: () => Effect.succeed(undefined),
        hooks: {
          beforeRead: () => Effect.void,
          pinned: (input) =>
            Effect.sync(() => {
              descriptor = descriptorPath(process.platform as "linux" | "darwin", input.fd)
              identity = input.identity
            }),
          released: () =>
            Effect.sync(() => {
              releases += 1
            }),
        },
      }).pipe(Effect.provideService(Scope.Scope, scope))

      yield* Effect.promise(() => execute(reader, { path: "pinned.txt" }, "pinned"))
      expect(descriptor).toBeString()
      expect(identity).toBeString()
      if (!descriptor || !identity) throw new Error("Descriptor was not pinned")
      const held = descriptor
      yield* Effect.promise(() => fs.unlink(target))
      expect(
        yield* Effect.promise(() => fs.stat(held, { bigint: true }).then((stat) => `${stat.dev}:${stat.ino}`)),
      ).toBe(identity)
      expect(releases).toBe(0)

      yield* Scope.close(scope, Exit.void)
      expect(releases).toBe(1)
    }),
  )

  secureIt("enforces call and cumulative line limits", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      yield* Effect.promise(() =>
        fs.writeFile(
          path.join(fixture.directory, "large.txt"),
          Array.from({ length: SideQuestionReader.MAX_LINES + 1 }, (_, index) => `line ${index + 1}`).join("\n"),
        ),
      )
      const calls = yield* SideQuestionReader.make({ ruleset: allow, reference: () => Effect.succeed(undefined) })
      for (let index = 0; index < SideQuestionReader.MAX_CALLS; index++) {
        yield* Effect.promise(() => execute(calls, { path: "large.txt", limit: 1 }, `call_${index}`))
      }
      yield* Effect.promise(async () =>
        expect(execute(calls, { path: "large.txt", limit: 1 })).rejects.toThrow(/call limit/i),
      )

      const lines = yield* SideQuestionReader.make({ ruleset: allow, reference: () => Effect.succeed(undefined) })
      for (let offset = 1; offset <= SideQuestionReader.MAX_LINES; offset += SideQuestionReader.MAX_READ_LINES) {
        yield* Effect.promise(() =>
          execute(lines, { path: "large.txt", offset, limit: SideQuestionReader.MAX_READ_LINES }, `lines_${offset}`),
        )
      }
      expect(lines.usage().lines).toBe(SideQuestionReader.MAX_LINES)
      yield* Effect.promise(async () =>
        expect(execute(lines, { path: "large.txt", offset: SideQuestionReader.MAX_LINES + 1 })).rejects.toThrow(
          /line limit/i,
        ),
      )
    }),
  )

  it.instance("reserves invalid attempts before validation", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      yield* Effect.promise(() => fs.writeFile(path.join(fixture.directory, "valid.txt"), "valid"))
      const reader = yield* SideQuestionReader.make({ ruleset: allow, reference: () => Effect.succeed(undefined) })

      for (let index = 0; index < SideQuestionReader.MAX_CALLS; index++) {
        yield* Effect.promise(async () => expect(execute(reader, { path: "" }, `invalid_${index}`)).rejects.toThrow())
      }

      expect(reader.usage().calls).toBe(SideQuestionReader.MAX_CALLS)
      yield* Effect.promise(async () =>
        expect(execute(reader, { path: "valid.txt" }, "over_limit")).rejects.toThrow(/call limit/i),
      )
    }),
  )

  secureIt("caps cumulative returned bytes before another chunk is exposed", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      yield* Effect.promise(() =>
        fs.writeFile(
          path.join(fixture.directory, "bytes.txt"),
          Array.from({ length: 200 }, () => "x".repeat(1024)).join("\n"),
        ),
      )
      const reader = yield* SideQuestionReader.make({ ruleset: allow, reference: () => Effect.succeed(undefined) })

      const result = yield* Effect.promise(() => execute(reader, { path: "bytes.txt", limit: 200 }, "bytes"))

      expect(reader.usage().bytes).toBe(Buffer.byteLength(JSON.stringify(result)))
      expect(reader.usage().bytes).toBeLessThanOrEqual(SideQuestionReader.MAX_BYTES)
      yield* Effect.promise(async () =>
        expect(execute(reader, { path: "bytes.txt", offset: 200, limit: 1 }, "bytes_over")).rejects.toThrow(
          /byte limit/i,
        ),
      )
    }),
  )

  secureIt("interrupts in-flight file work when the tool signal aborts", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      yield* Effect.promise(() => fs.writeFile(path.join(fixture.directory, "slow.txt"), "slow"))
      const started = yield* Deferred.make<void>()
      const stopped = yield* Deferred.make<void>()
      const reader = yield* SideQuestionReader.make({
        ruleset: allow,
        reference: () => Effect.succeed(undefined),
        hooks: {
          beforeRead: () =>
            Deferred.succeed(started, undefined).pipe(
              Effect.andThen(Effect.never),
              Effect.onInterrupt(() => Deferred.succeed(stopped, undefined)),
            ),
        },
      })
      const ctrl = new AbortController()

      const result = execute(reader, { path: "slow.txt" }, "slow", ctrl.signal)
      yield* Deferred.await(started)
      ctrl.abort()
      yield* Effect.promise(async () => expect(result).rejects.toThrow(/abort/i))
      yield* Deferred.await(stopped)
    }),
  )

  unsupportedIt("fails closed when secure file reads are unsupported", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      yield* Effect.promise(() => fs.writeFile(path.join(fixture.directory, "secret.txt"), "private context"))
      let started = false
      const reader = yield* SideQuestionReader.make({
        ruleset: allow,
        reference: () => Effect.succeed(undefined),
        hooks: {
          beforeRead: () =>
            Effect.sync(() => {
              started = true
            }),
        },
      })

      const failure = yield* Effect.promise(() =>
        execute(reader, { path: "secret.txt" }, "unsupported").then(
          () => "read unexpectedly succeeded",
          (cause: unknown) => (cause instanceof Error ? cause.message : String(cause)),
        ),
      )
      expect(failure).toBe(`Secure side reads are not supported on ${process.platform}`)
      expect(started).toBe(false)
      expect(reader.usage()).toEqual({ calls: 1, files: 0, lines: 0, bytes: 0 })
    }),
  )
})
