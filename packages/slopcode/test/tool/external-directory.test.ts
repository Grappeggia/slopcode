import { PermissionV1 } from "@slopcode-ai/core/v1/permission"
import { describe, expect } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Cause, Effect, Exit, Layer } from "effect"
import { CrossSpawnSpawner } from "@slopcode-ai/core/cross-spawn-spawner"
import type { Tool } from "@/tool/tool"
import { assertExternalDirectoryEffect } from "../../src/tool/external-directory"
import { Filesystem } from "@/util/filesystem"
import { TestInstance, tmpdirScoped } from "../fixture/fixture"
import type { Permission } from "../../src/permission"
import { SessionID, MessageID } from "../../src/session/schema"
import { testEffect } from "../lib/effect"
import { FSUtil } from "@slopcode-ai/core/fs-util"

const it = testEffect(Layer.mergeAll(CrossSpawnSpawner.defaultLayer, FSUtil.defaultLayer))

const baseCtx: Omit<Tool.Context, "ask"> = {
  sessionID: SessionID.make("ses_test"),
  messageID: MessageID.make("msg_test"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
}

const glob = (p: string) =>
  process.platform === "win32" ? Filesystem.normalizePathPattern(p) : p.replaceAll("\\", "/")

function makeCtx() {
  const requests: Array<Omit<PermissionV1.Request, "id" | "sessionID" | "tool">> = []
  const ctx: Tool.Context = {
    ...baseCtx,
    ask: (req) =>
      Effect.sync(() => {
        requests.push(req)
      }),
  }
  return { requests, ctx }
}

describe("tool.assertExternalDirectory", () => {
  it.live("no-ops for empty target", () =>
    Effect.gen(function* () {
      const { requests, ctx } = makeCtx()

      yield* assertExternalDirectoryEffect(ctx)

      expect(requests.length).toBe(0)
    }),
  )

  it.instance("no-ops for paths inside the instance directory", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { requests, ctx } = makeCtx()

      yield* assertExternalDirectoryEffect(ctx, path.join(test.directory, "file.txt"))

      expect(requests.length).toBe(0)
    }),
  )

  it.instance("asks with a single canonical glob", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { requests, ctx } = makeCtx()

      const target = path.join(path.dirname(test.directory), "outside", "file.txt")
      const expected = glob(path.join(path.dirname(target), "*"))

      yield* assertExternalDirectoryEffect(ctx, target)

      const req = requests.find((r) => r.permission === "external_directory")
      expect(req).toBeDefined()
      expect(req!.patterns).toEqual([expected])
      expect(req!.always).toEqual([expected])
    }),
  )

  it.instance("uses target directory when kind=directory", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { requests, ctx } = makeCtx()

      const target = path.join(path.dirname(test.directory), "outside")
      const expected = glob(path.join(target, "*"))

      yield* assertExternalDirectoryEffect(ctx, target, { kind: "directory" })

      const req = requests.find((r) => r.permission === "external_directory")
      expect(req).toBeDefined()
      expect(req!.patterns).toEqual([expected])
      expect(req!.always).toEqual([expected])
    }),
  )

  it.instance("deduplicates successful checks with a shared resource set", () =>
    Effect.gen(function* () {
      const outside = yield* tmpdirScoped()
      const first = path.join(outside, "first.txt")
      const second = path.join(outside, "second.txt")
      yield* Effect.promise(async () => {
        await fs.writeFile(first, "first")
        await fs.writeFile(second, "second")
      })
      const { requests, ctx } = makeCtx()
      const seen = new Set<string>()

      yield* assertExternalDirectoryEffect(ctx, first, { seen })
      yield* assertExternalDirectoryEffect(ctx, second, { seen })

      const parent = yield* Effect.promise(() => fs.realpath(outside))
      const resource = glob(path.join(parent, "*"))
      expect(requests).toEqual([
        expect.objectContaining({
          patterns: [resource],
          always: [resource],
          metadata: expect.objectContaining({
            filepath: first,
            canonicalPath: yield* Effect.promise(() => fs.realpath(first)),
            parentDir: parent,
            resource,
          }),
        }),
      ])
      expect(seen).toEqual(new Set([resource]))
    }),
  )

  it.live("skips prompting when bypass=true", () =>
    Effect.gen(function* () {
      const { requests, ctx } = makeCtx()

      yield* assertExternalDirectoryEffect(ctx, "/tmp/outside/file.txt", { bypass: true })

      expect(requests.length).toBe(0)
    }),
  )

  if (process.platform !== "win32") {
    it.instance("asks for the canonical target of an internal symlink", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const outside = yield* tmpdirScoped()
        const target = path.join(outside, "secret.txt")
        const link = path.join(test.directory, "secret.txt")
        yield* Effect.promise(async () => {
          await fs.writeFile(target, "secret")
          await fs.symlink(target, link)
        })
        const { requests, ctx } = makeCtx()

        yield* assertExternalDirectoryEffect(ctx, link)

        const req = requests.find((item) => item.permission === "external_directory")
        const canonical = yield* Effect.promise(() => fs.realpath(target))
        const parent = yield* Effect.promise(() => fs.realpath(outside))
        expect(req).toMatchObject({
          patterns: [glob(path.join(parent, "*"))],
          always: [glob(path.join(parent, "*"))],
          metadata: {
            filepath: link,
            canonicalPath: canonical,
            parentDir: parent,
            resource: glob(path.join(parent, "*")),
          },
        })
      }),
    )

    it.instance("fails closed for a broken internal symlink", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const outside = yield* tmpdirScoped()
        const link = path.join(test.directory, "broken.txt")
        yield* Effect.promise(() => fs.symlink(path.join(outside, "missing.txt"), link))
        const { requests, ctx } = makeCtx()

        const exit = yield* Effect.exit(assertExternalDirectoryEffect(ctx, link))

        expect(Exit.isFailure(exit)).toBe(true)
        if (Exit.isFailure(exit)) {
          expect(Cause.squash(exit.cause)).toMatchObject({
            _tag: "PathResolutionError",
            path: link,
            reason: "broken_symlink",
          })
        }
        expect(requests).toEqual([])
      }),
    )

    it.instance("fails closed for an internal symlink loop", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const first = path.join(test.directory, "first")
        const second = path.join(test.directory, "second")
        yield* Effect.promise(async () => {
          await fs.symlink(second, first)
          await fs.symlink(first, second)
        })
        const { requests, ctx } = makeCtx()

        const exit = yield* Effect.exit(assertExternalDirectoryEffect(ctx, first))

        expect(Exit.isFailure(exit)).toBe(true)
        if (Exit.isFailure(exit)) {
          expect(Cause.squash(exit.cause)).toMatchObject({
            _tag: "PathResolutionError",
            path: first,
            reason: "symlink_loop",
          })
        }
        expect(requests).toEqual([])
      }),
    )
  }

  if (process.platform === "win32") {
    it.instance(
      "normalizes Windows path variants to one glob",
      () =>
        Effect.gen(function* () {
          const { requests, ctx } = makeCtx()

          const outerTmp = yield* tmpdirScoped()
          yield* Effect.promise(() => Bun.write(path.join(outerTmp, "outside.txt"), "x"))

          const target = path.join(outerTmp, "outside.txt")
          const alt = target
            .replace(/^([A-Za-z]):/, "/$1")
            .replaceAll("\\", "/")
            .toLowerCase()

          yield* assertExternalDirectoryEffect(ctx, alt)

          const req = requests.find((r) => r.permission === "external_directory")
          const expected = glob(path.join(outerTmp, "*"))
          expect(req).toBeDefined()
          expect(req!.patterns).toEqual([expected])
          expect(req!.always).toEqual([expected])
        }),
      { git: true },
    )

    it.instance(
      "uses drive root glob for root files",
      () =>
        Effect.gen(function* () {
          const { requests, ctx } = makeCtx()

          const tmp = yield* TestInstance
          const root = path.parse(tmp.directory).root
          const target = path.join(root, "boot.ini")

          yield* assertExternalDirectoryEffect(ctx, target)

          const req = requests.find((r) => r.permission === "external_directory")
          const expected = path.join(root, "*")
          expect(req).toBeDefined()
          expect(req!.patterns).toEqual([expected])
          expect(req!.always).toEqual([expected])
        }),
      { git: true },
    )
  }
})
