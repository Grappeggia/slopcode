import { describe, expect } from "bun:test"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import type { PermissionV1 } from "@slopcode-ai/core/v1/permission"
import { Deferred, Effect, Layer } from "effect"
import fs from "fs/promises"
import path from "path"
import type { ToolExecutionOptions } from "ai"
import { Permission } from "../../src/permission"
import { SideQuestionReader } from "../../src/session/side-question-reader"
import { TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const env = Layer.mergeAll(FSUtil.defaultLayer, Permission.defaultLayer)
const it = testEffect(env)
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
  it.instance("reads regular text with bounded offset and limit", () =>
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

      for (const input of [
        { path: "../outside.txt" },
        { path: outside },
        { path: "escape.txt" },
        { path: "folder" },
        { path: "binary.dat" },
        { path: "image.png" },
      ]) {
        yield* Effect.promise(async () => expect(execute(reader, input)).rejects.toThrow())
      }
      yield* Effect.promise(() => fs.rm(outside, { force: true }))
    }),
  )

  it.instance("requires configured and pre-approved external references", () =>
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
        expect(execute(blocked, { path: "guide.txt", reference: "docs" })).rejects.toThrow(/not allowed/i),
      )
      yield* Effect.promise(async () =>
        expect(execute(blocked, { path: "guide.txt", reference: "missing" })).rejects.toThrow(/unknown/i),
      )

      const reader = yield* SideQuestionReader.make({
        ruleset: [...allow, { permission: "external_directory", pattern: path.join(docs, "*"), action: "allow" }],
        reference,
      })
      const result = yield* Effect.promise(() => execute(reader, { path: "guide.txt", reference: "docs" }))
      expect(result.output).toContain("reference guide")
      yield* Effect.promise(async () =>
        expect(execute(reader, { path: "../secret.txt", reference: "docs" })).rejects.toThrow(/escapes/i),
      )
      yield* Effect.promise(() => fs.rm(docs, { recursive: true, force: true }))
      expect(yield* (yield* Permission.Service).list()).toEqual([])
    }),
  )

  it.instance("atomically rejects a sixth canonical file under concurrent reads", () =>
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

  it.instance("counts repeated canonical reads once and resets each question", () =>
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

  it.instance("enforces call and cumulative line limits", () =>
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

  it.instance("caps cumulative returned bytes before another chunk is exposed", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      yield* Effect.promise(() =>
        fs.writeFile(
          path.join(fixture.directory, "bytes.txt"),
          Array.from({ length: 200 }, () => "x".repeat(1024)).join("\n"),
        ),
      )
      const reader = yield* SideQuestionReader.make({ ruleset: allow, reference: () => Effect.succeed(undefined) })

      yield* Effect.promise(() => execute(reader, { path: "bytes.txt", limit: 200 }))

      expect(reader.usage().bytes).toBe(SideQuestionReader.MAX_BYTES)
      yield* Effect.promise(async () =>
        expect(execute(reader, { path: "bytes.txt", offset: 129, limit: 1 })).rejects.toThrow(/byte limit/i),
      )
    }),
  )

  it.instance("interrupts in-flight file work when the tool signal aborts", () =>
    Effect.gen(function* () {
      const fixture = yield* TestInstance
      yield* Effect.promise(() => fs.writeFile(path.join(fixture.directory, "slow.txt"), "slow"))
      const live = yield* FSUtil.Service
      const stopped = yield* Deferred.make<void>()
      const delayed = FSUtil.Service.of({
        ...live,
        readFile: () => Effect.never.pipe(Effect.onInterrupt(() => Deferred.succeed(stopped, undefined))),
      })
      const reader = yield* SideQuestionReader.make({
        ruleset: allow,
        reference: () => Effect.succeed(undefined),
      }).pipe(Effect.provideService(FSUtil.Service, delayed))
      const ctrl = new AbortController()

      yield* Effect.promise(async () => {
        const result = execute(reader, { path: "slow.txt" }, "slow", ctrl.signal)
        await Bun.sleep(20)
        ctrl.abort()
        await expect(result).rejects.toThrow(/abort/i)
      })
      yield* Deferred.await(stopped)
    }),
  )
})
