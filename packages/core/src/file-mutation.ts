export * as FileMutation from "./file-mutation"

import { constants, type BigIntStats } from "fs"
import fs, { type FileHandle } from "fs/promises"
import path from "path"
import { Context, Effect, Layer, Option, Schema, Scope } from "effect"
import { KeyedMutex } from "./effect/keyed-mutex"
import { FSUtil } from "./fs-util"

export interface Target {
  readonly canonical: string
  readonly resource: string
}

export interface WriteInput {
  readonly target: Target
  readonly content: string | Uint8Array
}

export interface TextWriteInput {
  readonly target: Target
  readonly content: string
}

export interface ConditionalWriteInput extends WriteInput {
  readonly expected: Uint8Array
}

export interface RemoveInput {
  readonly target: Target
}

export type Change = "none" | "created" | "changed" | "deleted"
export type HookPhase = "parent-opened" | "file-opened" | "before-write" | "before-remove" | "before-commit"
export interface HooksInterface {
  readonly pause: (phase: HookPhase, target: string) => Effect.Effect<void>
}
export class Hooks extends Context.Service<Hooks, HooksInterface>()("@slopcode/v2/FileMutation/Hooks") {}

export class StaleContentError extends Schema.TaggedErrorClass<StaleContentError>()("FileMutation.StaleContentError", {
  path: Schema.String,
}) {}

export class TargetExistsError extends Schema.TaggedErrorClass<TargetExistsError>()("FileMutation.TargetExistsError", {
  path: Schema.String,
}) {}

export class TargetChangedError extends Schema.TaggedErrorClass<TargetChangedError>()("FileMutation.TargetChangedError", {
  path: Schema.String,
}) {}

export class UnsupportedPlatformError extends Schema.TaggedErrorClass<UnsupportedPlatformError>()("FileMutation.UnsupportedPlatformError", {
  platform: Schema.String,
}) {}

type Revision = {
  readonly dev: bigint
  readonly ino: bigint
  readonly size: bigint
  readonly mtime: bigint
  readonly ctime: bigint
}

type Private = {
  readonly revision?: Revision
  readonly content: Uint8Array
}

export interface WriteResult {
  readonly operation: "write"
  readonly target: string
  readonly resource: string
  readonly existed: boolean
  readonly change: Exclude<Change, "deleted">
}

export interface RemoveResult {
  readonly operation: "remove"
  readonly target: string
  readonly resource: string
  readonly existed: boolean
  readonly change: "none" | "deleted"
}

export type Error = StaleContentError | TargetExistsError | TargetChangedError | UnsupportedPlatformError | FSUtil.Error

export interface Interface {
  readonly create: (input: WriteInput) => Effect.Effect<WriteResult, Error>
  readonly write: (input: WriteInput) => Effect.Effect<WriteResult, Error>
  readonly writeTextPreservingBom: (input: TextWriteInput) => Effect.Effect<WriteResult, Error>
  readonly writeIfUnchanged: (input: ConditionalWriteInput) => Effect.Effect<WriteResult, Error>
  /** Internal formatter settlement, distinct from the supplied primitive effect. */
  readonly commit: (input: ConditionalWriteInput & { readonly revision: unknown }) => Effect.Effect<WriteResult, Error>
  readonly remove: (input: RemoveInput) => Effect.Effect<RemoveResult, Error>
  readonly private: (result: WriteResult | RemoveResult) => Private | undefined
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/FileMutation") {}

const bytes = (content: string | Uint8Array) =>
  typeof content === "string" ? new TextEncoder().encode(content) : content

const same = (left: Uint8Array, right: Uint8Array) =>
  left.length === right.length && left.every((byte, index) => byte === right[index])

const revision = (stat: BigIntStats): Revision => ({
  dev: stat.dev,
  ino: stat.ino,
  size: stat.size,
  mtime: stat.mtimeNs,
  ctime: stat.ctimeNs,
})

const sameRevision = (left: Revision, right: Revision) =>
  left.dev === right.dev && left.ino === right.ino && left.size === right.size &&
  left.mtime === right.mtime && left.ctime === right.ctime

const code = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined

class Missing extends Error {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const locks = KeyedMutex.makeUnsafe<string>()
    const option = yield* Effect.serviceOption(Hooks)
    const hooks = Option.getOrElse(option, () => Hooks.of({ pause: () => Effect.void }))
    const data = new WeakMap<WriteResult | RemoveResult, Private>()
    const safe = <A>(target: Target, run: () => Promise<A>) => Effect.tryPromise({
      try: run,
      catch: () => new TargetChangedError({ path: target.canonical }),
    })
    const supported = (target: Target) => process.platform === "linux"
      ? Effect.void
      : Effect.fail(new UnsupportedPlatformError({ platform: process.platform }))
    const withLock = <A, E>(target: Target, effect: Effect.Effect<A, E, Scope.Scope>) =>
      locks.withLock(target.canonical)(Effect.uninterruptible(Effect.scoped(effect)))

    const close = (handle: FileHandle | undefined) => handle
      ? Effect.promise(() => handle.close()).pipe(Effect.ignore)
      : Effect.void

    const parent = (target: Target, create: boolean) => Effect.acquireRelease(
      Effect.gen(function* () {
        yield* supported(target)
        const parts = path.dirname(target.canonical).split(path.sep).filter(Boolean)
        const opened: FileHandle[] = []
        const root = yield* safe(target, () => fs.open("/", constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW))
        opened.push(root)
        for (const part of parts) {
          const current = opened.at(-1)!
          const child = `/proc/self/fd/${current.fd}/${part}`
          const next = yield* safe(target, async () => {
            try {
              return await fs.open(child, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
            } catch (error) {
              if (!create || code(error) !== "ENOENT") throw error
              await fs.mkdir(child, { mode: 0o755 })
              return fs.open(child, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
            }
          })
          opened.push(next)
        }
        const handle = opened.at(-1)!
        const actual = yield* safe(target, () => fs.realpath(`/proc/self/fd/${handle.fd}`))
        if (FSUtil.normalizePath(actual) !== FSUtil.normalizePath(path.dirname(target.canonical))) {
          yield* Effect.forEach(opened, close, { discard: true })
          return yield* new TargetChangedError({ path: target.canonical })
        }
        yield* Effect.forEach(opened.slice(0, -1), close, { discard: true })
        yield* hooks.pause("parent-opened", target.canonical)
        return handle
      }),
      close,
    )

    const open = (target: Target, createDirs: boolean) => parent(target, createDirs).pipe(
      Effect.flatMap((directory) => Effect.acquireRelease(
        Effect.tryPromise({
          try: () => fs.open(
            `/proc/self/fd/${directory.fd}/${path.basename(target.canonical)}`,
            constants.O_RDWR | constants.O_NOFOLLOW,
          ),
          catch: (error) => code(error) === "ENOENT"
            ? new Missing()
            : new TargetChangedError({ path: target.canonical }),
        }),
        close,
      )),
      Effect.tap((handle) => Effect.gen(function* () {
        const actual = yield* safe(target, () => fs.realpath(`/proc/self/fd/${handle.fd}`))
        if (FSUtil.normalizePath(actual) !== FSUtil.normalizePath(target.canonical)) {
          return yield* new TargetChangedError({ path: target.canonical })
        }
        yield* hooks.pause("file-opened", target.canonical)
      })),
    )

    const result = (target: Target, existed: boolean, change: WriteResult["change"], content: Uint8Array, current: Revision) => {
      const value = { operation: "write", target: target.canonical, resource: target.resource, existed } as WriteResult
      Object.defineProperty(value, "change", { value: change, enumerable: false })
      data.set(value, { revision: current, content })
      return value
    }

    const removed = (target: Target, existed: boolean): RemoveResult => {
      const value = {
        operation: "remove",
        target: target.canonical,
        resource: target.resource,
        existed,
      } as RemoveResult
      Object.defineProperty(value, "change", { value: existed ? "deleted" : "none", enumerable: false })
      data.set(value, { content: new Uint8Array() })
      return value
    }

    const createHandle = (target: Target, content: Uint8Array) => parent(target, true).pipe(
      Effect.flatMap((directory) => Effect.acquireRelease(
        Effect.tryPromise({
          try: () => fs.open(
            `/proc/self/fd/${directory.fd}/${path.basename(target.canonical)}`,
            constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
            0o644,
          ),
          catch: (error) => code(error) === "EEXIST"
            ? new TargetExistsError({ path: target.canonical })
            : new TargetChangedError({ path: target.canonical }),
        }),
        close,
      )),
      Effect.tap(() => hooks.pause("before-write", target.canonical)),
      Effect.flatMap((handle) => safe(target, async () => {
        await handle.writeFile(content)
        await handle.sync()
        return result(target, false, "created", content, revision(await handle.stat({ bigint: true })))
      })),
    )

    const writeOpen = (
      target: Target,
      content: Uint8Array,
      expected?: Uint8Array,
      wanted?: Revision,
      createDirs = false,
    ) => open(target, createDirs).pipe(
      Effect.flatMap((handle) => Effect.gen(function* () {
        const stat = yield* safe(target, () => handle.stat({ bigint: true }))
        const current = yield* safe(target, () => handle.readFile())
        if (expected && !same(current, expected)) return yield* new StaleContentError({ path: target.canonical })
        if (wanted && !sameRevision(revision(stat), wanted)) return yield* new StaleContentError({ path: target.canonical })
        if (same(current, content)) return result(target, true, "none", current, revision(stat))
        yield* hooks.pause(wanted ? "before-commit" : "before-write", target.canonical)
        yield* safe(target, async () => {
          await handle.truncate(0)
          await handle.write(content, 0, content.length, 0)
          await handle.sync()
        })
        return result(target, true, "changed", content, revision(yield* safe(target, () => handle.stat({ bigint: true }))))
      })),
    )

    const write = Effect.fn("FileMutation.write")((input: WriteInput) => withLock(input.target,
      writeOpen(input.target, bytes(input.content), undefined, undefined, true).pipe(
        Effect.catchIf((error) => error instanceof Missing, () => createHandle(input.target, bytes(input.content))),
      ),
    ))

    const create = Effect.fn("FileMutation.create")((input: WriteInput) =>
      withLock(input.target, createHandle(input.target, bytes(input.content))),
    )

    const writeTextPreservingBom = Effect.fn("FileMutation.writeTextPreservingBom")((input: TextWriteInput) =>
      withLock(input.target,
        open(input.target, true).pipe(
          Effect.flatMap((handle) => Effect.gen(function* () {
            const current = yield* safe(input.target, () => handle.readFile())
            const next = splitBom(input.content)
            const content = bytes(joinBom(next.text, hasUtf8Bom(current) || next.bom))
            const stat = yield* safe(input.target, () => handle.stat({ bigint: true }))
            if (same(current, content)) return result(input.target, true, "none", current, revision(stat))
            yield* hooks.pause("before-write", input.target.canonical)
            yield* safe(input.target, async () => {
              await handle.truncate(0)
              await handle.write(content, 0, content.length, 0)
              await handle.sync()
            })
            return result(input.target, true, "changed", content, revision(yield* safe(input.target, () => handle.stat({ bigint: true }))))
          })),
          Effect.catchIf((error) => error instanceof Missing, () => {
            const next = splitBom(input.content)
            return createHandle(input.target, bytes(joinBom(next.text, next.bom)))
          }),
        ),
      ),
    )

    const writeIfUnchanged = Effect.fn("FileMutation.writeIfUnchanged")((input: ConditionalWriteInput) =>
      withLock(input.target, writeOpen(input.target, bytes(input.content), input.expected).pipe(
        Effect.catchIf((error) => error instanceof Missing, () => Effect.fail(new TargetChangedError({ path: input.target.canonical }))),
      )),
    )

    const commit = Effect.fn("FileMutation.commit")((input: ConditionalWriteInput & { readonly revision: unknown }) =>
      withLock(input.target, input.revision && typeof input.revision === "object"
        ? writeOpen(input.target, bytes(input.content), input.expected, input.revision as Revision).pipe(
            Effect.catchIf((error) => error instanceof Missing, () => Effect.fail(new StaleContentError({ path: input.target.canonical }))),
          )
        : Effect.fail(new StaleContentError({ path: input.target.canonical }))),
    )

    const remove = Effect.fn("FileMutation.remove")((input: RemoveInput) => withLock(input.target,
      parent(input.target, false).pipe(
        Effect.flatMap((directory) => Effect.acquireRelease(
          Effect.tryPromise({
            try: () => fs.open(`/proc/self/fd/${directory.fd}/${path.basename(input.target.canonical)}`, constants.O_RDONLY | constants.O_NOFOLLOW),
            catch: (error) => code(error) === "ENOENT" ? new Missing() : new TargetChangedError({ path: input.target.canonical }),
          }),
          close,
        ).pipe(Effect.flatMap((handle) => {
          if (!handle) return Effect.succeed(removed(input.target, false))
          return Effect.gen(function* () {
            yield* hooks.pause("file-opened", input.target.canonical)
            yield* hooks.pause("before-remove", input.target.canonical)
            const opened = yield* safe(input.target, () => handle.stat({ bigint: true }))
            const named = yield* safe(input.target, () => fs.lstat(`/proc/self/fd/${directory.fd}/${path.basename(input.target.canonical)}`, { bigint: true }))
            if (opened.dev !== named.dev || opened.ino !== named.ino) return yield* new TargetChangedError({ path: input.target.canonical })
            yield* safe(input.target, () => fs.unlink(`/proc/self/fd/${directory.fd}/${path.basename(input.target.canonical)}`))
            return removed(input.target, true)
          })
        }))),
        Effect.catchIf((error) => error instanceof Missing, () => Effect.succeed(removed(input.target, false))),
      ),
    ))

    return Service.of({
      create,
      write,
      writeTextPreservingBom,
      writeIfUnchanged,
      commit,
      remove,
      private: (value) => data.get(value),
    })
  }),
)

function splitBom(text: string) {
  const stripped = text.replace(/^\uFEFF+/, "")
  return { bom: stripped.length !== text.length, text: stripped }
}

function joinBom(text: string, bom: boolean) {
  const stripped = splitBom(text).text
  return bom ? `\uFEFF${stripped}` : stripped
}

function hasUtf8Bom(content: Uint8Array) {
  return content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf
}

export const locationLayer = layer
