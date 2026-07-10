import { describe, expect } from "bun:test"
import path from "path"
import * as fs from "fs/promises"
import { Cause, Effect, Exit, Layer } from "effect"
import { ApplyPatchTool } from "../../src/tool/apply_patch"
import { LSP } from "@/lsp/lsp"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { Format } from "../../src/format"
import { Agent } from "../../src/agent/agent"
import { EventV2Bridge } from "../../src/event-v2-bridge"
import { Truncate } from "@/tool/truncate"
import { TestInstance } from "../fixture/fixture"
import { SessionID, MessageID } from "../../src/session/schema"
import { testEffect } from "../lib/effect"
import { Watcher } from "@slopcode-ai/core/filesystem/watcher"

const it = testEffect(
  Layer.mergeAll(
    LSP.defaultLayer,
    FSUtil.defaultLayer,
    Format.defaultLayer,
    EventV2Bridge.defaultLayer,
    Truncate.defaultLayer,
    Agent.defaultLayer,
  ),
)

const baseCtx = {
  sessionID: SessionID.make("ses_test"),
  messageID: MessageID.make("msg_test"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
}

type AskInput = {
  permission: string
  patterns: string[]
  always: string[]
  metadata: {
    diff?: string
    filepath: string
    files?: Array<{
      filePath: string
      relativePath: string
      type: "add" | "update" | "delete" | "move"
      patch: string
      additions: number
      deletions: number
      movePath?: string
    }>
    canonicalPath?: string
    parentDir?: string
    resource?: string
  }
}

type ToolCtx = typeof baseCtx & {
  ask: (input: AskInput) => Effect.Effect<void>
}

const execute = Effect.fn("ApplyPatchToolTest.execute")(function* (params: { patchText: string }, ctx: ToolCtx) {
  const info = yield* ApplyPatchTool
  const tool = yield* info.init()
  return yield* tool.execute(params, ctx)
})

const makeCtx = (onAsk?: (input: AskInput) => Effect.Effect<void>) => {
  const calls: AskInput[] = []
  const ctx: ToolCtx = {
    ...baseCtx,
    ask: (input) =>
      Effect.sync(() => {
        calls.push(input)
      }).pipe(Effect.andThen(onAsk?.(input) ?? Effect.void)),
  }

  return { ctx, calls }
}

const readText = (filepath: string) => Effect.promise(() => fs.readFile(filepath, "utf-8"))
const writeText = (filepath: string, content: string) => Effect.promise(() => fs.writeFile(filepath, content, "utf-8"))
const makeDir = (dir: string) => Effect.promise(() => fs.mkdir(dir, { recursive: true }))

const expectFailure = <A, E, R>(effect: Effect.Effect<A, E, R>, message?: string) =>
  Effect.gen(function* () {
    const exit = yield* Effect.exit(effect)
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit) && message) expect(Cause.pretty(exit.cause)).toContain(message)
  })

const expectReadFailure = (filepath: string) => expectFailure(readText(filepath))
const diagnostic = {
  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
  message: "symlink diagnostic",
  severity: 1 as const,
}

describe("tool.apply_patch freeform", () => {
  it.live("requires patchText", () =>
    Effect.gen(function* () {
      const { ctx } = makeCtx()
      yield* expectFailure(execute({ patchText: "" }, ctx), "patchText is required")
    }),
  )

  it.live("rejects invalid patch format", () =>
    Effect.gen(function* () {
      const { ctx } = makeCtx()
      yield* expectFailure(execute({ patchText: "invalid patch" }, ctx), "apply_patch verification failed")
    }),
  )

  it.live("rejects empty patch", () =>
    Effect.gen(function* () {
      const { ctx } = makeCtx()
      yield* expectFailure(execute({ patchText: "*** Begin Patch\n*** End Patch" }, ctx), "patch rejected: empty patch")
    }),
  )

  it.instance(
    "applies add/update/delete in one patch",
    () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const { ctx, calls } = makeCtx()
        const modifyPath = path.join(test.directory, "modify.txt")
        const deletePath = path.join(test.directory, "delete.txt")
        yield* writeText(modifyPath, "line1\nline2\n")
        yield* writeText(deletePath, "obsolete\n")

        const patchText =
          "*** Begin Patch\n*** Add File: nested/new.txt\n+created\n*** Delete File: delete.txt\n*** Update File: modify.txt\n@@\n-line2\n+changed\n*** End Patch"

        const result = yield* execute({ patchText }, ctx)

        expect(result.title).toContain("Success. Updated the following files")
        expect(result.output).toContain("Success. Updated the following files")
        // Strict formatting assertions for slashes
        expect(result.output).toMatch(/A nested\/new\.txt/)
        expect(result.output).toMatch(/D delete\.txt/)
        expect(result.output).toMatch(/M modify\.txt/)
        if (process.platform === "win32") {
          expect(result.output).not.toContain("\\")
        }
        expect(result.metadata.diff).toContain("Index:")
        expect(calls.length).toBe(1)

        // Verify permission metadata includes files array for UI rendering
        const permissionCall = calls[0]
        const files = permissionCall.metadata.files ?? []
        expect(files).toHaveLength(3)
        expect(files.map((f) => f.type).sort()).toEqual(["add", "delete", "update"])

        const addFile = files.find((f) => f.type === "add")
        expect(addFile?.relativePath).toBe("nested/new.txt")
        expect(addFile?.patch).toContain("+created")

        const updateFile = files.find((f) => f.type === "update")
        expect(updateFile?.patch).toContain("-line2")
        expect(updateFile?.patch).toContain("+changed")

        expect(yield* readText(path.join(test.directory, "nested", "new.txt"))).toBe("created\n")
        expect(yield* readText(modifyPath)).toBe("line1\nchanged\n")
        yield* expectReadFailure(deletePath)
      }),
    { git: true },
  )

  it.instance(
    "permission metadata includes move file info",
    () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const { ctx, calls } = makeCtx()
        const original = path.join(test.directory, "old", "name.txt")
        yield* makeDir(path.dirname(original))
        yield* writeText(original, "old content\n")

        const patchText =
          "*** Begin Patch\n*** Update File: old/name.txt\n*** Move to: renamed/dir/name.txt\n@@\n-old content\n+new content\n*** End Patch"

        yield* execute({ patchText }, ctx)

        expect(calls.length).toBe(1)
        const permissionCall = calls[0]
        expect(permissionCall.metadata.files).toHaveLength(1)

        const moveFile = permissionCall.metadata.files?.[0]
        expect(moveFile).toBeDefined()
        if (!moveFile) return
        expect(moveFile.type).toBe("move")
        expect(moveFile.relativePath).toBe("renamed/dir/name.txt")
        expect(moveFile.movePath).toBe(path.join(test.directory, "renamed/dir/name.txt"))
        expect(moveFile.patch).toContain("-old content")
        expect(moveFile.patch).toContain("+new content")
      }),
    { git: true },
  )

  it.instance("applies multiple hunks to one file", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const target = path.join(test.directory, "multi.txt")
      yield* writeText(target, "line1\nline2\nline3\nline4\n")

      const patchText =
        "*** Begin Patch\n*** Update File: multi.txt\n@@\n-line2\n+changed2\n@@\n-line4\n+changed4\n*** End Patch"

      yield* execute({ patchText }, ctx)

      expect(yield* readText(target)).toBe("line1\nchanged2\nline3\nchanged4\n")
    }),
  )

  it.instance("does not invent a first-line diff for BOM files", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx, calls } = makeCtx()
      const bom = String.fromCharCode(0xfeff)
      const target = path.join(test.directory, "example.cs")
      yield* writeText(target, `${bom}using System;\n\nclass Test {}\n`)

      const patchText =
        "*** Begin Patch\n*** Update File: example.cs\n@@\n class Test {}\n+class Next {}\n*** End Patch"

      yield* execute({ patchText }, ctx)

      expect(calls.length).toBe(1)
      const shown = calls[0].metadata.files?.[0]?.patch ?? ""
      expect(shown).not.toContain(bom)
      expect(shown).not.toContain("-using System;")
      expect(shown).not.toContain("+using System;")

      const content = yield* readText(target)
      expect(content.charCodeAt(0)).toBe(0xfeff)
      expect(content.slice(1)).toBe("using System;\n\nclass Test {}\nclass Next {}\n")
    }),
  )

  it.instance("inserts lines with insert-only hunk", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const target = path.join(test.directory, "insert_only.txt")
      yield* writeText(target, "alpha\nomega\n")

      const patchText = "*** Begin Patch\n*** Update File: insert_only.txt\n@@\n alpha\n+beta\n omega\n*** End Patch"

      yield* execute({ patchText }, ctx)

      expect(yield* readText(target)).toBe("alpha\nbeta\nomega\n")
    }),
  )

  it.instance("appends trailing newline on update", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const target = path.join(test.directory, "no_newline.txt")
      yield* writeText(target, "no newline at end")

      const patchText =
        "*** Begin Patch\n*** Update File: no_newline.txt\n@@\n-no newline at end\n+first line\n+second line\n*** End Patch"

      yield* execute({ patchText }, ctx)

      const contents = yield* readText(target)
      expect(contents.endsWith("\n")).toBe(true)
      expect(contents).toBe("first line\nsecond line\n")
    }),
  )

  it.instance("moves file to a new directory", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const original = path.join(test.directory, "old", "name.txt")
      yield* makeDir(path.dirname(original))
      yield* writeText(original, "old content\n")

      const patchText =
        "*** Begin Patch\n*** Update File: old/name.txt\n*** Move to: renamed/dir/name.txt\n@@\n-old content\n+new content\n*** End Patch"

      yield* execute({ patchText }, ctx)

      const moved = path.join(test.directory, "renamed", "dir", "name.txt")
      yield* expectReadFailure(original)
      expect(yield* readText(moved)).toBe("new content\n")
    }),
  )

  it.instance("moves file overwriting existing destination", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const original = path.join(test.directory, "old", "name.txt")
      const destination = path.join(test.directory, "renamed", "dir", "name.txt")
      yield* makeDir(path.dirname(original))
      yield* makeDir(path.dirname(destination))
      yield* writeText(original, "from\n")
      yield* writeText(destination, "existing\n")

      const patchText =
        "*** Begin Patch\n*** Update File: old/name.txt\n*** Move to: renamed/dir/name.txt\n@@\n-from\n+new\n*** End Patch"

      yield* execute({ patchText }, ctx)

      yield* expectReadFailure(original)
      expect(yield* readText(destination)).toBe("new\n")
    }),
  )

  if (process.platform !== "win32") {
    it.instance("does not add a missing child through a denied external directory symlink", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const outside = path.join(path.dirname(test.directory), `${path.basename(test.directory)}-outside`)
        const link = path.join(test.directory, "linked")
        yield* makeDir(outside)
        yield* Effect.promise(() => fs.symlink(outside, link))
        yield* Effect.addFinalizer(() => Effect.promise(() => fs.rm(outside, { recursive: true, force: true })))
        const denied = new Error("external directory denied")
        const { ctx, calls } = makeCtx((input) =>
          input.permission === "external_directory" ? Effect.die(denied) : Effect.void,
        )

        yield* expectFailure(
          execute({ patchText: "*** Begin Patch\n*** Add File: linked/new.txt\n+escaped\n*** End Patch" }, ctx),
          denied.message,
        )

        const parent = yield* Effect.promise(() => fs.realpath(outside))
        expect(calls[0]).toMatchObject({
          permission: "external_directory",
          patterns: [path.join(parent, "*").replaceAll("\\", "/")],
          metadata: { canonicalPath: path.join(parent, "new.txt"), parentDir: parent },
        })
        yield* expectReadFailure(path.join(outside, "new.txt"))
      }),
    )

    it.instance("moves from a symlink without deleting its canonical target", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const root = path.join(path.dirname(test.directory), `${path.basename(test.directory)}-move`)
        const firstSource = path.join(root, "source-first")
        const firstDestination = path.join(root, "destination-first")
        const secondDestination = path.join(root, "destination-second")
        const original = path.join(firstSource, "source.txt")
        const source = path.join(test.directory, "source.txt")
        const destination = path.join(test.directory, "destination")
        yield* Effect.promise(async () => {
          await Promise.all(
            [firstSource, firstDestination, secondDestination].map((dir) => fs.mkdir(dir, { recursive: true })),
          )
          await fs.writeFile(original, "old approved\n")
          await fs.symlink(original, source)
          await fs.symlink(firstDestination, destination)
        })
        yield* Effect.addFinalizer(() => Effect.promise(() => fs.rm(root, { recursive: true, force: true })))
        const canonicalSource = yield* Effect.promise(() => fs.realpath(original))
        const canonicalDestination = path.join(yield* Effect.promise(() => fs.realpath(firstDestination)), "moved.txt")
        const shownDestination = path.join(destination, "moved.txt")
        const state = { destination: false }
        const { ctx, calls } = makeCtx((input) => {
          if (input.permission !== "external_directory") return Effect.void
          if (input.metadata.canonicalPath === canonicalDestination && !state.destination) {
            state.destination = true
            return Effect.promise(async () => {
              await fs.unlink(destination)
              await fs.symlink(secondDestination, destination)
            }).pipe(Effect.orDie)
          }
          return Effect.void
        })
        const base = yield* LSP.Service
        const touched: string[] = []
        const events = yield* EventV2Bridge.Service
        const updated: string[] = []
        const unsubscribe = yield* events.listen((event) => {
          if (event.type !== Watcher.Event.Updated.type) return Effect.void
          return Effect.sync(() => updated.push((event.data as { file: string }).file))
        })
        yield* Effect.addFinalizer(() => unsubscribe)

        const result = yield* execute(
          {
            patchText:
              "*** Begin Patch\n*** Update File: source.txt\n*** Move to: destination/moved.txt\n@@\n-old approved\n+new approved\n*** End Patch",
          },
          ctx,
        ).pipe(
          Effect.provideService(
            LSP.Service,
            LSP.Service.of({
              ...base,
              touchFile: (file) => Effect.sync(() => touched.push(file)),
              diagnostics: () => Effect.succeed({ [canonicalDestination]: [diagnostic] }),
            }),
          ),
        )

        const external = calls.filter((input) => input.permission === "external_directory")
        expect(external.map((input) => input.metadata.canonicalPath)).toEqual([canonicalSource, canonicalDestination])
        expect(external.map((input) => input.metadata.parentDir)).toEqual([
          yield* Effect.promise(() => fs.realpath(firstSource)),
          yield* Effect.promise(() => fs.realpath(firstDestination)),
        ])
        expect(state).toEqual({ destination: true })
        yield* expectReadFailure(source)
        expect(yield* readText(original)).toBe("old approved\n")
        expect(yield* readText(canonicalDestination)).toBe("new approved\n")
        yield* expectReadFailure(path.join(secondDestination, "moved.txt"))
        expect(result.metadata.diagnostics).toEqual({ [shownDestination]: [diagnostic] })
        expect(result.output).toContain(`<diagnostics file="${shownDestination}">`)
        expect(touched).toEqual([canonicalDestination])
        expect(updated).toEqual([source, canonicalDestination])
      }),
    )

    it.instance("denies an external symlink entry move before changing the source or destination", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const root = path.join(path.dirname(test.directory), `${path.basename(test.directory)}-link-denied`)
        const target = path.join(test.directory, "target.txt")
        const source = path.join(root, "source.txt")
        const destination = path.join(test.directory, "moved.txt")
        yield* Effect.promise(async () => {
          await fs.mkdir(root)
          await fs.writeFile(target, "source original\n")
          await fs.writeFile(destination, "destination original\n")
          await fs.symlink(target, source)
        })
        yield* Effect.addFinalizer(() => Effect.promise(() => fs.rm(root, { recursive: true, force: true })))
        const denied = new Error("external link denied")
        const { ctx, calls } = makeCtx((input) =>
          input.permission === "external_directory" ? Effect.die(denied) : Effect.void,
        )

        yield* expectFailure(
          execute(
            {
              patchText: `*** Begin Patch\n*** Update File: ${path.relative(test.directory, source)}\n*** Move to: moved.txt\n@@\n-source original\n+source changed\n*** End Patch`,
            },
            ctx,
          ),
          denied.message,
        )

        const parent = yield* Effect.promise(() => fs.realpath(root))
        expect(calls.filter((input) => input.permission === "external_directory")).toEqual([
          expect.objectContaining({
            patterns: [path.join(parent, "*").replaceAll("\\", "/")],
            metadata: expect.objectContaining({
              filepath: source,
              canonicalPath: path.join(parent, path.basename(source)),
              parentDir: parent,
            }),
          }),
        ])
        expect((yield* Effect.promise(() => fs.lstat(source))).isSymbolicLink()).toBe(true)
        expect(yield* Effect.promise(() => fs.realpath(source))).toBe(yield* Effect.promise(() => fs.realpath(target)))
        expect(yield* readText(target)).toBe("source original\n")
        expect(yield* readText(destination)).toBe("destination original\n")
      }),
    )

    it.instance("authorizes external symlink entries and targets separately", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const root = path.join(path.dirname(test.directory), `${path.basename(test.directory)}-external-move`)
        const links = path.join(root, "links")
        const targets = path.join(root, "targets")
        const target = path.join(targets, "target.txt")
        const source = path.join(links, "source.txt")
        const destination = path.join(test.directory, "moved.txt")
        yield* Effect.promise(async () => {
          await fs.mkdir(links, { recursive: true })
          await fs.mkdir(targets, { recursive: true })
          await fs.writeFile(target, "source original\n")
          await fs.symlink(target, source)
        })
        yield* Effect.addFinalizer(() => Effect.promise(() => fs.rm(root, { recursive: true, force: true })))
        const { ctx, calls } = makeCtx()

        yield* execute(
          {
            patchText: `*** Begin Patch\n*** Update File: ${path.relative(test.directory, source)}\n*** Move to: moved.txt\n@@\n-source original\n+source changed\n*** End Patch`,
          },
          ctx,
        )

        const targetPath = yield* Effect.promise(() => fs.realpath(target))
        const linkPath = path.join(yield* Effect.promise(() => fs.realpath(links)), path.basename(source))
        const external = calls.filter((input) => input.permission === "external_directory")
        expect(external).toHaveLength(2)
        expect(external.map((input) => input.metadata.canonicalPath).sort()).toEqual([linkPath, targetPath].sort())
        expect(external.map((input) => input.metadata.parentDir).sort()).toEqual(
          [path.dirname(linkPath), path.dirname(targetPath)].sort(),
        )
        yield* expectReadFailure(source)
        expect(yield* readText(target)).toBe("source original\n")
        expect(yield* readText(destination)).toBe("source changed\n")
      }),
    )

    it.instance("authorizes one resource when a symlink source target and destination share a directory", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const root = path.join(path.dirname(test.directory), `${path.basename(test.directory)}-shared-move`)
        const target = path.join(root, "target.txt")
        const source = path.join(root, "source.txt")
        const destination = path.join(root, "moved.txt")
        yield* Effect.promise(async () => {
          await fs.mkdir(root)
          await fs.writeFile(target, "source original\n")
          await fs.symlink(target, source)
        })
        yield* Effect.addFinalizer(() => Effect.promise(() => fs.rm(root, { recursive: true, force: true })))
        const once = new Set<string>()
        const { ctx, calls } = makeCtx((input) => {
          if (input.permission !== "external_directory") return Effect.void
          return Effect.sync(() => {
            const resource = input.patterns[0]
            if (once.has(resource)) throw new Error(`duplicate external authorization: ${resource}`)
            once.add(resource)
          })
        })

        yield* execute(
          {
            patchText: `*** Begin Patch\n*** Update File: ${path.relative(test.directory, source)}\n*** Move to: ${path.relative(test.directory, destination)}\n@@\n-source original\n+source changed\n*** End Patch`,
          },
          ctx,
        )

        const parent = yield* Effect.promise(() => fs.realpath(root))
        const resource = path.join(parent, "*").replaceAll("\\", "/")
        expect(calls.filter((input) => input.permission === "external_directory")).toEqual([
          expect.objectContaining({
            patterns: [resource],
            always: [resource],
            metadata: expect.objectContaining({
              filepath: source,
              canonicalPath: yield* Effect.promise(() => fs.realpath(target)),
              parentDir: parent,
              resource,
            }),
          }),
        ])
        yield* expectReadFailure(source)
        expect(yield* readText(target)).toBe("source original\n")
        expect(yield* readText(destination)).toBe("source changed\n")
      }),
    )

    it.instance("authorizes each external resource once across multiple hunks", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const root = path.join(path.dirname(test.directory), `${path.basename(test.directory)}-multi-move`)
        const first = path.join(root, "first")
        const second = path.join(root, "second")
        const targetA = path.join(first, "target-a.txt")
        const sourceA = path.join(first, "source-a.txt")
        const destinationA = path.join(second, "moved-a.txt")
        const targetB = path.join(second, "target-b.txt")
        const sourceB = path.join(second, "source-b.txt")
        const destinationB = path.join(first, "moved-b.txt")
        yield* Effect.promise(async () => {
          await fs.mkdir(first, { recursive: true })
          await fs.mkdir(second, { recursive: true })
          await fs.writeFile(targetA, "first original\n")
          await fs.writeFile(targetB, "second original\n")
          await fs.symlink(targetA, sourceA)
          await fs.symlink(targetB, sourceB)
        })
        yield* Effect.addFinalizer(() => Effect.promise(() => fs.rm(root, { recursive: true, force: true })))
        const once = new Set<string>()
        const { ctx, calls } = makeCtx((input) => {
          if (input.permission !== "external_directory") return Effect.void
          return Effect.sync(() => {
            const resource = input.patterns[0]
            if (once.has(resource)) throw new Error(`duplicate external authorization: ${resource}`)
            once.add(resource)
          })
        })

        yield* execute(
          {
            patchText: `*** Begin Patch\n*** Update File: ${path.relative(test.directory, sourceA)}\n*** Move to: ${path.relative(test.directory, destinationA)}\n@@\n-first original\n+first changed\n*** Update File: ${path.relative(test.directory, sourceB)}\n*** Move to: ${path.relative(test.directory, destinationB)}\n@@\n-second original\n+second changed\n*** End Patch`,
          },
          ctx,
        )

        const firstParent = yield* Effect.promise(() => fs.realpath(first))
        const secondParent = yield* Effect.promise(() => fs.realpath(second))
        const firstResource = path.join(firstParent, "*").replaceAll("\\", "/")
        const secondResource = path.join(secondParent, "*").replaceAll("\\", "/")
        const external = calls.filter((input) => input.permission === "external_directory")
        expect(external.map((input) => input.patterns[0])).toEqual([firstResource, secondResource])
        expect(external.map((input) => input.metadata)).toEqual([
          expect.objectContaining({
            filepath: sourceA,
            canonicalPath: yield* Effect.promise(() => fs.realpath(targetA)),
            parentDir: firstParent,
            resource: firstResource,
          }),
          expect.objectContaining({
            filepath: destinationA,
            canonicalPath: path.join(secondParent, path.basename(destinationA)),
            parentDir: secondParent,
            resource: secondResource,
          }),
        ])
        yield* expectReadFailure(sourceA)
        yield* expectReadFailure(sourceB)
        expect(yield* readText(targetA)).toBe("first original\n")
        expect(yield* readText(targetB)).toBe("second original\n")
        expect(yield* readText(destinationA)).toBe("first changed\n")
        expect(yield* readText(destinationB)).toBe("second changed\n")
      }),
    )

    it.instance("leaves every hunk unchanged when a distinct external resource is denied", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const root = path.join(path.dirname(test.directory), `${path.basename(test.directory)}-multi-denied`)
        const first = path.join(root, "first")
        const second = path.join(root, "second")
        const targetA = path.join(first, "target-a.txt")
        const sourceA = path.join(first, "source-a.txt")
        const destinationA = path.join(first, "moved-a.txt")
        const targetB = path.join(second, "target-b.txt")
        const sourceB = path.join(second, "source-b.txt")
        const destinationB = path.join(second, "moved-b.txt")
        yield* Effect.promise(async () => {
          await fs.mkdir(first, { recursive: true })
          await fs.mkdir(second, { recursive: true })
          await fs.writeFile(targetA, "first original\n")
          await fs.writeFile(destinationA, "first destination\n")
          await fs.writeFile(targetB, "second original\n")
          await fs.writeFile(destinationB, "second destination\n")
          await fs.symlink(targetA, sourceA)
          await fs.symlink(targetB, sourceB)
        })
        yield* Effect.addFinalizer(() => Effect.promise(() => fs.rm(root, { recursive: true, force: true })))
        const firstParent = yield* Effect.promise(() => fs.realpath(first))
        const secondParent = yield* Effect.promise(() => fs.realpath(second))
        const firstResource = path.join(firstParent, "*").replaceAll("\\", "/")
        const secondResource = path.join(secondParent, "*").replaceAll("\\", "/")
        const denied = new Error("second external resource denied")
        const { ctx, calls } = makeCtx((input) =>
          input.permission === "external_directory" && input.patterns[0] === secondResource
            ? Effect.die(denied)
            : Effect.void,
        )

        yield* expectFailure(
          execute(
            {
              patchText: `*** Begin Patch\n*** Update File: ${path.relative(test.directory, sourceA)}\n*** Move to: ${path.relative(test.directory, destinationA)}\n@@\n-first original\n+first changed\n*** Update File: ${path.relative(test.directory, sourceB)}\n*** Move to: ${path.relative(test.directory, destinationB)}\n@@\n-second original\n+second changed\n*** End Patch`,
            },
            ctx,
          ),
          denied.message,
        )

        expect(
          calls.filter((input) => input.permission === "external_directory").map((input) => input.patterns[0]),
        ).toEqual([firstResource, secondResource])
        expect((yield* Effect.promise(() => fs.lstat(sourceA))).isSymbolicLink()).toBe(true)
        expect((yield* Effect.promise(() => fs.lstat(sourceB))).isSymbolicLink()).toBe(true)
        expect(yield* readText(targetA)).toBe("first original\n")
        expect(yield* readText(destinationA)).toBe("first destination\n")
        expect(yield* readText(targetB)).toBe("second original\n")
        expect(yield* readText(destinationB)).toBe("second destination\n")
      }),
    )

    it.instance("rejects move aliases that resolve to the same canonical file without data loss", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const { ctx } = makeCtx()
        const source = path.join(test.directory, "source.txt")
        const alias = path.join(test.directory, "alias.txt")
        yield* writeText(source, "original\n")
        yield* Effect.promise(() => fs.symlink(source, alias))

        yield* expectFailure(
          execute(
            {
              patchText:
                "*** Begin Patch\n*** Update File: source.txt\n*** Move to: alias.txt\n@@\n-original\n+changed\n*** End Patch",
            },
            ctx,
          ),
          "same canonical target",
        )

        expect(yield* readText(source)).toBe("original\n")
        expect(yield* Effect.promise(() => fs.realpath(alias))).toBe(yield* Effect.promise(() => fs.realpath(source)))
      }),
    )

    it.instance("rejects a self move without changing the source", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const { ctx } = makeCtx()
        const source = path.join(test.directory, "source.txt")
        yield* writeText(source, "original\n")

        yield* expectFailure(
          execute(
            {
              patchText:
                "*** Begin Patch\n*** Update File: source.txt\n*** Move to: source.txt\n@@\n-original\n+changed\n*** End Patch",
            },
            ctx,
          ),
          "same canonical target",
        )

        expect(yield* readText(source)).toBe("original\n")
      }),
    )

    it.instance("rejects a swapped move source symlink before writing or removing data", () =>
      Effect.gen(function* () {
        const test = yield* TestInstance
        const root = path.join(path.dirname(test.directory), `${path.basename(test.directory)}-swap`)
        const original = path.join(root, "original.txt")
        const replacement = path.join(root, "replacement.txt")
        const source = path.join(test.directory, "source.txt")
        const destination = path.join(test.directory, "moved.txt")
        yield* Effect.promise(async () => {
          await fs.mkdir(root)
          await fs.writeFile(original, "original\n")
          await fs.writeFile(replacement, "replacement\n")
          await fs.symlink(original, source)
        })
        yield* Effect.addFinalizer(() => Effect.promise(() => fs.rm(root, { recursive: true, force: true })))
        const state = { swapped: false }
        const { ctx } = makeCtx((input) => {
          if (input.permission !== "edit" || state.swapped) return Effect.void
          state.swapped = true
          return Effect.promise(async () => {
            await fs.unlink(source)
            await fs.symlink(replacement, source)
          }).pipe(Effect.orDie)
        })

        yield* expectFailure(
          execute(
            {
              patchText:
                "*** Begin Patch\n*** Update File: source.txt\n*** Move to: moved.txt\n@@\n-original\n+changed\n*** End Patch",
            },
            ctx,
          ),
          "move source changed",
        )

        expect(state.swapped).toBe(true)
        expect(yield* readText(original)).toBe("original\n")
        expect(yield* readText(replacement)).toBe("replacement\n")
        expect(yield* Effect.promise(() => fs.realpath(source))).toBe(
          yield* Effect.promise(() => fs.realpath(replacement)),
        )
        yield* expectReadFailure(destination)
      }),
    )
  }

  it.instance("adds file overwriting existing file", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const target = path.join(test.directory, "duplicate.txt")
      yield* writeText(target, "old content\n")

      const patchText = "*** Begin Patch\n*** Add File: duplicate.txt\n+new content\n*** End Patch"

      yield* execute({ patchText }, ctx)
      expect(yield* readText(target)).toBe("new content\n")
    }),
  )

  it.instance("rejects update when target file is missing", () =>
    Effect.gen(function* () {
      const { ctx } = makeCtx()
      const patchText = "*** Begin Patch\n*** Update File: missing.txt\n@@\n-nope\n+better\n*** End Patch"

      yield* expectFailure(
        execute({ patchText }, ctx),
        "apply_patch verification failed: Failed to read file to update",
      )
    }),
  )

  it.instance("rejects delete when file is missing", () =>
    Effect.gen(function* () {
      const { ctx } = makeCtx()
      const patchText = "*** Begin Patch\n*** Delete File: missing.txt\n*** End Patch"

      yield* expectFailure(execute({ patchText }, ctx))
    }),
  )

  it.instance("rejects delete when target is a directory", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const dirPath = path.join(test.directory, "dir")
      yield* makeDir(dirPath)

      const patchText = "*** Begin Patch\n*** Delete File: dir\n*** End Patch"

      yield* expectFailure(execute({ patchText }, ctx))
    }),
  )

  it.instance("rejects invalid hunk header", () =>
    Effect.gen(function* () {
      const { ctx } = makeCtx()
      const patchText = "*** Begin Patch\n*** Frobnicate File: foo\n*** End Patch"

      yield* expectFailure(execute({ patchText }, ctx), "apply_patch verification failed")
    }),
  )

  it.instance("rejects update with missing context", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const target = path.join(test.directory, "modify.txt")
      yield* writeText(target, "line1\nline2\n")

      const patchText = "*** Begin Patch\n*** Update File: modify.txt\n@@\n-missing\n+changed\n*** End Patch"

      yield* expectFailure(execute({ patchText }, ctx), "apply_patch verification failed")
      expect(yield* readText(target)).toBe("line1\nline2\n")
    }),
  )

  it.instance("verification failure leaves no side effects", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const patchText =
        "*** Begin Patch\n*** Add File: created.txt\n+hello\n*** Update File: missing.txt\n@@\n-old\n+new\n*** End Patch"

      yield* expectFailure(execute({ patchText }, ctx))
      yield* expectReadFailure(path.join(test.directory, "created.txt"))
    }),
  )

  it.instance("supports end of file anchor", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const target = path.join(test.directory, "tail.txt")
      yield* writeText(target, "alpha\nlast\n")

      const patchText = "*** Begin Patch\n*** Update File: tail.txt\n@@\n-last\n+end\n*** End of File\n*** End Patch"

      yield* execute({ patchText }, ctx)
      expect(yield* readText(target)).toBe("alpha\nend\n")
    }),
  )

  it.instance("rejects missing second chunk context", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const target = path.join(test.directory, "two_chunks.txt")
      yield* writeText(target, "a\nb\nc\nd\n")

      const patchText = "*** Begin Patch\n*** Update File: two_chunks.txt\n@@\n-b\n+B\n\n-d\n+D\n*** End Patch"

      yield* expectFailure(execute({ patchText }, ctx))
      expect(yield* readText(target)).toBe("a\nb\nc\nd\n")
    }),
  )

  it.instance("disambiguates change context with @@ header", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const target = path.join(test.directory, "multi_ctx.txt")
      yield* writeText(target, "fn a\nx=10\ny=2\nfn b\nx=10\ny=20\n")

      const patchText = "*** Begin Patch\n*** Update File: multi_ctx.txt\n@@ fn b\n-x=10\n+x=11\n*** End Patch"

      yield* execute({ patchText }, ctx)
      expect(yield* readText(target)).toBe("fn a\nx=10\ny=2\nfn b\nx=11\ny=20\n")
    }),
  )

  it.instance("EOF anchor matches from end of file first", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const target = path.join(test.directory, "eof_anchor.txt")
      // File has duplicate "marker" lines - one in middle, one at end
      yield* writeText(target, "start\nmarker\nmiddle\nmarker\nend\n")

      // With EOF anchor, should match the LAST "marker" line, not the first
      const patchText =
        "*** Begin Patch\n*** Update File: eof_anchor.txt\n@@\n-marker\n-end\n+marker-changed\n+end\n*** End of File\n*** End Patch"

      yield* execute({ patchText }, ctx)
      // First marker unchanged, second marker changed
      expect(yield* readText(target)).toBe("start\nmarker\nmiddle\nmarker-changed\nend\n")
    }),
  )

  it.instance("parses heredoc-wrapped patch", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const patchText = `cat <<'EOF'
*** Begin Patch
*** Add File: heredoc_test.txt
+heredoc content
*** End Patch
EOF`

      yield* execute({ patchText }, ctx)
      expect(yield* readText(path.join(test.directory, "heredoc_test.txt"))).toBe("heredoc content\n")
    }),
  )

  it.instance("parses heredoc-wrapped patch without cat", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const patchText = `<<EOF
*** Begin Patch
*** Add File: heredoc_no_cat.txt
+no cat prefix
*** End Patch
EOF`

      yield* execute({ patchText }, ctx)
      expect(yield* readText(path.join(test.directory, "heredoc_no_cat.txt"))).toBe("no cat prefix\n")
    }),
  )

  it.instance("matches with trailing whitespace differences", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const target = path.join(test.directory, "trailing_ws.txt")
      // File has trailing spaces on some lines
      yield* writeText(target, "line1  \nline2\nline3   \n")

      // Patch doesn't have trailing spaces - should still match via rstrip pass
      const patchText = "*** Begin Patch\n*** Update File: trailing_ws.txt\n@@\n-line2\n+changed\n*** End Patch"

      yield* execute({ patchText }, ctx)
      expect(yield* readText(target)).toBe("line1  \nchanged\nline3   \n")
    }),
  )

  it.instance("matches with leading whitespace differences", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const target = path.join(test.directory, "leading_ws.txt")
      // File has leading spaces
      yield* writeText(target, "  line1\nline2\n  line3\n")

      // Patch without leading spaces - should match via trim pass
      const patchText = "*** Begin Patch\n*** Update File: leading_ws.txt\n@@\n-line2\n+changed\n*** End Patch"

      yield* execute({ patchText }, ctx)
      expect(yield* readText(target)).toBe("  line1\nchanged\n  line3\n")
    }),
  )

  it.instance("matches with Unicode punctuation differences", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const { ctx } = makeCtx()
      const target = path.join(test.directory, "unicode.txt")
      // File has fancy Unicode quotes (U+201C, U+201D) and em-dash (U+2014)
      const leftQuote = "\u201C"
      const rightQuote = "\u201D"
      const emDash = "\u2014"
      yield* writeText(target, `He said ${leftQuote}hello${rightQuote}\nsome${emDash}dash\nend\n`)

      // Patch uses ASCII equivalents - should match via normalized pass
      // The replacement uses ASCII quotes from the patch (not preserving Unicode)
      const patchText =
        '*** Begin Patch\n*** Update File: unicode.txt\n@@\n-He said "hello"\n+He said "hi"\n*** End Patch'

      yield* execute({ patchText }, ctx)
      // Result has ASCII quotes because that's what the patch specifies
      expect(yield* readText(target)).toBe(`He said "hi"\nsome${emDash}dash\nend\n`)
    }),
  )
})
