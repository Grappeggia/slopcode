export * as FileMutation from "./file-mutation"
export { Platform, descriptorPath, unsupported, type PlatformInterface } from "./file-mutation-platform"

import { constants, type BigIntStats } from "fs"
import fs, { type FileHandle } from "fs/promises"
import path from "path"
import crypto from "crypto"
import { Context, Effect, Layer, Option, Schema, Scope } from "effect"
import { KeyedMutex } from "./effect/keyed-mutex"
import { FSUtil } from "./fs-util"
import { Platform, make as makePlatform } from "./file-mutation-platform"
import { MutationEvents } from "./mutation-events"

export interface Target {
  readonly canonical: string
  readonly resource: string
  readonly staging?: string
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
export type HookPhase =
  | "parent-opened"
  | "file-opened"
  | "before-write"
  | "before-remove"
  | "before-remove-atomic"
  | "before-commit"
  | "stage-before-open"
  | "stage-created"
  | "stage-written"
  | "remove-exchanged"
  | "remove-placeholder-moved"
  | "remove-rollback"
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

export class StageUnavailableError extends Schema.TaggedErrorClass<StageUnavailableError>()("FileMutation.StageUnavailableError", {
  path: Schema.String,
}) {}

export class RecoveryConflictError extends Schema.TaggedErrorClass<RecoveryConflictError>()("FileMutation.RecoveryConflictError", {
  path: Schema.String,
  recovery: Schema.String,
  recoveries: Schema.Array(Schema.String),
  state: Schema.String,
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
  readonly secure: boolean
  readonly target: Target
}

export interface Stage {
  readonly canonical: string
  readonly verify: Effect.Effect<void, Error>
  readonly read: Effect.Effect<Uint8Array, Error>
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

export type Error = StaleContentError | TargetExistsError | TargetChangedError | UnsupportedPlatformError | StageUnavailableError | RecoveryConflictError | FSUtil.Error

export interface Interface {
  readonly create: (input: WriteInput) => Effect.Effect<WriteResult, Error>
  readonly write: (input: WriteInput) => Effect.Effect<WriteResult, unknown>
  readonly writeTextPreservingBom: (input: TextWriteInput) => Effect.Effect<WriteResult, unknown>
  readonly writeIfUnchanged: (input: ConditionalWriteInput) => Effect.Effect<WriteResult, unknown>
  /** Internal formatter settlement, distinct from the supplied primitive effect. */
  readonly commit: (input: ConditionalWriteInput & {
    readonly revision: unknown
    readonly guard?: Effect.Effect<void, unknown>
  }) => Effect.Effect<WriteResult, Error | unknown>
  readonly validate: (result: WriteResult, guard?: Effect.Effect<void, unknown>) => Effect.Effect<string, Error | unknown>
  readonly stage: (input: WriteInput) => Effect.Effect<Stage | undefined, Error, Scope.Scope>
  readonly fingerprint: (result: WriteResult) => string | undefined
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

const revisionIdentity = (value: Revision) =>
  `${value.dev}:${value.ino}:${value.size}:${value.mtime}:${value.ctime}`

const code = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined

class Missing extends Error {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const locks = KeyedMutex.makeUnsafe<string>()
    const option = yield* Effect.serviceOption(Hooks)
    const hooks = Option.getOrElse(option, () => Hooks.of({ pause: () => Effect.void }))
    const configured = yield* Effect.serviceOption(Platform)
    const platform = Option.isSome(configured) ? configured.value : yield* makePlatform
    const data = new WeakMap<WriteResult | RemoveResult, Private>()
    const safe = <A>(target: Target, run: () => Promise<A>) => Effect.tryPromise({
      try: run,
      catch: () => new TargetChangedError({ path: target.canonical }),
    })
    const supported = (target: Target) => platform.capabilities.mutation
      ? Effect.void
      : Effect.fail(new UnsupportedPlatformError({ platform: platform.name }))
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
          const child = platform.path(current.fd, part)
          const next = yield* safe(target, async () => {
            try {
              return await fs.open(child, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
            } catch (error) {
              if (!create || code(error) !== "ENOENT") throw error
              await fs.mkdir(child, { mode: target.staging ? 0o700 : 0o755 })
              return fs.open(child, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
            }
          })
          opened.push(next)
        }
        const handle = opened.at(-1)!
        const actual = yield* safe(target, () => fs.realpath(platform.path(handle.fd)))
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
            platform.path(directory.fd, path.basename(target.canonical)),
            constants.O_RDWR | constants.O_NOFOLLOW,
          ),
          catch: (error) => code(error) === "ENOENT"
            ? new Missing()
            : new TargetChangedError({ path: target.canonical }),
        }),
        close,
      )),
      Effect.tap((handle) => Effect.gen(function* () {
        const actual = yield* safe(target, () => fs.realpath(platform.path(handle.fd)))
        if (FSUtil.normalizePath(actual) !== FSUtil.normalizePath(target.canonical)) {
          return yield* new TargetChangedError({ path: target.canonical })
        }
        yield* hooks.pause("file-opened", target.canonical)
      })),
    )

    const result = (target: Target, existed: boolean, change: WriteResult["change"], content: Uint8Array, current: Revision) => {
      const value = { operation: "write", target: target.canonical, resource: target.resource, existed } as WriteResult
      Object.defineProperty(value, "change", { value: change, enumerable: false })
      data.set(value, { revision: current, content, secure: platform.capabilities.mutation, target })
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
      data.set(value, { content: new Uint8Array(), secure: platform.capabilities.mutation, target })
      return value
    }

    const createHandle = (target: Target, content: Uint8Array) => parent(target, true).pipe(
      Effect.flatMap((directory) => Effect.acquireRelease(
        Effect.tryPromise({
          try: () => fs.open(
            platform.path(directory.fd, path.basename(target.canonical)),
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
      guard: Effect.Effect<void, unknown> = Effect.void,
    ) => open(target, createDirs).pipe(
      Effect.flatMap((handle) => Effect.gen(function* () {
        const stat = yield* safe(target, () => handle.stat({ bigint: true }))
        const current = yield* safe(target, () => handle.readFile())
        if (expected && !same(current, expected)) return yield* new StaleContentError({ path: target.canonical })
        if (wanted && !sameRevision(revision(stat), wanted)) return yield* new StaleContentError({ path: target.canonical })
        if (same(current, content)) return result(target, true, "none", current, revision(stat))
        yield* hooks.pause(wanted ? "before-commit" : "before-write", target.canonical)
        yield* guard
        yield* safe(target, async () => {
          await handle.truncate(0)
          await handle.write(content, 0, content.length, 0)
          await handle.sync()
        })
        return result(target, true, "changed", content, revision(yield* safe(target, () => handle.stat({ bigint: true }))))
      })),
    )

    const write = Effect.fn("FileMutation.write")((input: WriteInput) => supported(input.target).pipe(Effect.andThen(withLock(input.target,
      writeOpen(input.target, bytes(input.content), undefined, undefined, true).pipe(
        Effect.catchIf((error) => error instanceof Missing, () => createHandle(input.target, bytes(input.content))),
      ),
    ))))

    const create = Effect.fn("FileMutation.create")(function* (input: WriteInput) {
      yield* supported(input.target)
      return yield* withLock(input.target, createHandle(input.target, bytes(input.content)))
    })

    const writeTextPreservingBom = Effect.fn("FileMutation.writeTextPreservingBom")(function* (input: TextWriteInput) {
      yield* supported(input.target)
      return yield* withLock(input.target,
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
      )
    })

    const writeIfUnchanged = Effect.fn("FileMutation.writeIfUnchanged")(function* (input: ConditionalWriteInput) {
      yield* supported(input.target)
      return yield* withLock(input.target, writeOpen(input.target, bytes(input.content), input.expected).pipe(
        Effect.catchIf((error) => error instanceof Missing, () => Effect.fail(new TargetChangedError({ path: input.target.canonical }))),
      ))
    })

    const commit = Effect.fn("FileMutation.commit")((input: ConditionalWriteInput & {
      readonly revision: unknown
      readonly guard?: Effect.Effect<void, unknown>
    }) =>
      withLock(input.target, input.revision && typeof input.revision === "object"
        ? writeOpen(
            input.target,
            bytes(input.content),
            input.expected,
            input.revision as Revision,
            false,
            input.guard,
          ).pipe(
            Effect.catchIf((error) => error instanceof Missing, () => Effect.fail(new StaleContentError({ path: input.target.canonical }))),
          )
        : Effect.fail(new StaleContentError({ path: input.target.canonical }))),
    )

    const validate = Effect.fn("FileMutation.validate")(function* (
      value: WriteResult,
      guard: Effect.Effect<void, unknown> = Effect.void,
    ) {
      const snapshot = data.get(value)
      if (!snapshot?.revision) return yield* new StaleContentError({ path: value.target })
      const target = snapshot.target
      return yield* withLock(target, open(target, false).pipe(
        Effect.flatMap((handle) => Effect.gen(function* () {
          const current = yield* safe(target, () => handle.readFile())
          const stat = revision(yield* safe(target, () => handle.stat({ bigint: true })))
          if (!same(current, snapshot.content) || !sameRevision(stat, snapshot.revision!)) {
            return yield* new StaleContentError({ path: value.target })
          }
          yield* guard
          return MutationEvents.fileFingerprint(current, revisionIdentity(stat))
        })),
        Effect.catchIf((error) => error instanceof Missing, () =>
          Effect.fail(new StaleContentError({ path: value.target }))),
      ))
    })

    const stage = Effect.fn("FileMutation.stage")(function* (input: WriteInput) {
      if (!platform.capabilities.staging || !platform.executable) return undefined
      const extension = path.extname(input.target.canonical)
      const base = path.basename(input.target.canonical, extension).replaceAll(/[^a-zA-Z0-9_-]/g, "_")
      const name = `.${base}.slopcode-${crypto.randomBytes(16).toString("hex")}${extension}`
      const target = input.target.staging
        ? { ...input.target, canonical: path.join(input.target.staging, name) }
        : input.target
      return yield* parent(target, Boolean(input.target.staging)).pipe(
        Effect.flatMap((directory) => Effect.gen(function* () {
          const child = platform.path(directory.fd, name)
          const parent = path.dirname(target.canonical)
          const executable = platform.executable!(directory.fd, name, parent)
          yield* hooks.pause("stage-before-open", input.target.canonical)
          const handle = yield* Effect.tryPromise({
            try: () => fs.open(
              child,
              constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
              0o600,
            ),
            catch: () => new StageUnavailableError({ path: input.target.canonical }),
          })
          const identity = yield* safe(input.target, () => handle.stat({ bigint: true }))
          const verify = Effect.tryPromise({
            try: async () => {
              const current = await fs.lstat(platform.name === "darwin" ? executable : child, { bigint: true })
              const actual = await fs.realpath(platform.path(directory.fd))
              if (
                current.dev !== identity.dev || current.ino !== identity.ino ||
                FSUtil.normalizePath(actual) !== FSUtil.normalizePath(parent)
              ) throw new Error("stage changed")
            },
            catch: () => new TargetChangedError({ path: input.target.canonical }),
          })
          yield* Effect.addFinalizer(() => Effect.promise(async () => {
            await handle.close().catch(() => {})
            const current = await fs.lstat(child, { bigint: true }).catch(() => undefined)
            if (current?.dev === identity.dev && current.ino === identity.ino) platform.unlink?.(directory.fd, name)
          }))
          yield* hooks.pause("stage-created", input.target.canonical)
          yield* Effect.tryPromise({
            try: async () => {
              await handle.writeFile(bytes(input.content))
              await handle.sync()
            },
            catch: () => new StageUnavailableError({ path: input.target.canonical }),
          })
          yield* hooks.pause("stage-written", input.target.canonical)
          return {
            canonical: executable,
            verify,
            read: verify.pipe(Effect.andThen(safe(input.target, async () => {
              const stat = await handle.stat()
              const output = new Uint8Array(stat.size)
              await handle.read(output, 0, output.length, 0)
              return output
            }))),
          } satisfies Stage
        })),
      )
    })

    const remove = Effect.fn("FileMutation.remove")((input: RemoveInput) => supported(input.target).pipe(Effect.andThen(withLock(input.target,
      parent(input.target, false).pipe(
        Effect.flatMap((directory) => Effect.acquireRelease(
          Effect.tryPromise({
            try: () => fs.open(platform.path(directory.fd, path.basename(input.target.canonical)), constants.O_RDONLY | constants.O_NOFOLLOW),
            catch: (error) => code(error) === "ENOENT" ? new Missing() : new TargetChangedError({ path: input.target.canonical }),
          }),
          close,
        ).pipe(Effect.flatMap((handle) => {
          if (!handle) return Effect.succeed(removed(input.target, false))
          return Effect.gen(function* () {
            yield* hooks.pause("file-opened", input.target.canonical)
            yield* hooks.pause("before-remove", input.target.canonical)
            const opened = yield* safe(input.target, () => handle.stat({ bigint: true }))
            const named = yield* safe(input.target, () => fs.lstat(platform.path(directory.fd, path.basename(input.target.canonical)), { bigint: true }))
            if (opened.dev !== named.dev || opened.ino !== named.ino) return yield* new TargetChangedError({ path: input.target.canonical })
            if (!platform.exchange || !platform.move || !platform.unlink) return yield* new UnsupportedPlatformError({ platform: platform.name })
            const exchange = platform.exchange
            const move = platform.move
            const unlink = platform.unlink
            const name = path.basename(input.target.canonical)
            const quarantine = `.slopcode-delete-${crypto.randomBytes(16).toString("hex")}`
            const placeholder = yield* safe(input.target, () => fs.open(
              platform.path(directory.fd, quarantine),
              constants.O_RDONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
              0o600,
            ))
            const placeholderIdentity = yield* safe(input.target, () => placeholder.stat({ bigint: true }))
            const state: { value: "placeholder" | "approved" | "public" | "done" | "conflict" } = { value: "placeholder" }
            const matches = async (child: string, expected: BigIntStats) => {
              const current = await fs.lstat(platform.path(directory.fd, child), { bigint: true }).catch(() => undefined)
              return current?.dev === expected.dev && current.ino === expected.ino
            }
            yield* Effect.addFinalizer(() => Effect.promise(async () => {
              await placeholder.close().catch(() => {})
              if (state.value === "placeholder" && await matches(quarantine, placeholderIdentity)) {
                unlink(directory.fd, quarantine)
              }
              if (
                state.value === "approved" &&
                await matches(quarantine, opened) &&
                await matches(name, placeholderIdentity)
              ) exchange(directory.fd, name, quarantine)
            }))
            yield* hooks.pause("before-remove-atomic", input.target.canonical)
            if (!exchange(directory.fd, name, quarantine)) {
              return yield* new TargetChangedError({ path: input.target.canonical })
            }
            state.value = "approved"
            let cleanup: string | undefined
            let placeholderMoved = false
            return yield* Effect.gen(function* () {
              yield* hooks.pause("remove-exchanged", input.target.canonical)
              const quarantined = yield* safe(input.target, () => fs.lstat(
                platform.path(directory.fd, quarantine),
                { bigint: true },
              ))
              if (opened.dev !== quarantined.dev || opened.ino !== quarantined.ino) {
                yield* hooks.pause("remove-rollback", input.target.canonical)
                if (!exchange(directory.fd, name, quarantine)) {
                  state.value = "conflict"
                  const recovery = path.join(path.dirname(input.target.canonical), quarantine)
                  return yield* new RecoveryConflictError({
                    path: input.target.canonical,
                    recovery,
                    recoveries: [recovery, input.target.canonical],
                    state: "rollback-exchange",
                  })
                }
                state.value = "placeholder"
                if (!unlink(directory.fd, quarantine)) {
                  state.value = "conflict"
                  const recovery = path.join(path.dirname(input.target.canonical), quarantine)
                  return yield* new RecoveryConflictError({
                    path: input.target.canonical,
                    recovery,
                    recoveries: [recovery, input.target.canonical],
                    state: "rollback-placeholder-unlink",
                  })
                }
                state.value = "done"
                return yield* new TargetChangedError({ path: input.target.canonical })
              }
              if (!unlink(directory.fd, quarantine)) {
                state.value = "conflict"
                const recovery = path.join(path.dirname(input.target.canonical), quarantine)
                return yield* new RecoveryConflictError({
                  path: input.target.canonical,
                  recovery,
                  recoveries: [recovery, input.target.canonical],
                  state: "approved-unlink",
                })
              }
              state.value = "public"
              cleanup = `.slopcode-delete-${crypto.randomBytes(16).toString("hex")}`
              if (!move(directory.fd, name, cleanup)) {
                state.value = "conflict"
                return yield* new RecoveryConflictError({
                  path: input.target.canonical,
                  recovery: input.target.canonical,
                  recoveries: [input.target.canonical],
                  state: "placeholder-move",
                })
              }
              placeholderMoved = true
              yield* hooks.pause("remove-placeholder-moved", input.target.canonical)
              const moved = yield* safe(input.target, () => fs.lstat(
                platform.path(directory.fd, cleanup!),
                { bigint: true },
              ))
              if (placeholderIdentity.dev !== moved.dev || placeholderIdentity.ino !== moved.ino) {
                if (!move(directory.fd, cleanup, name)) {
                  state.value = "conflict"
                  const recovery = path.join(path.dirname(input.target.canonical), cleanup)
                  return yield* new RecoveryConflictError({
                    path: input.target.canonical,
                    recovery,
                    recoveries: [recovery, input.target.canonical],
                    state: "placeholder-restore",
                  })
                }
                state.value = "done"
                return yield* new TargetChangedError({ path: input.target.canonical })
              }
              if (!unlink(directory.fd, cleanup)) {
                state.value = "conflict"
                const recovery = path.join(path.dirname(input.target.canonical), cleanup)
                return yield* new RecoveryConflictError({
                  path: input.target.canonical,
                  recovery,
                  recoveries: [recovery],
                  state: "placeholder-unlink",
                })
              }
              state.value = "done"
              return removed(input.target, true)
            }).pipe(Effect.catch((error) => {
              if (error instanceof RecoveryConflictError || state.value === "placeholder" || state.value === "done") {
                return Effect.fail(error)
              }
              const current = state.value
              state.value = "conflict"
              const recoveries = current === "approved" || !cleanup
                ? [path.join(path.dirname(input.target.canonical), quarantine), input.target.canonical]
                : placeholderMoved
                  ? [path.join(path.dirname(input.target.canonical), cleanup)]
                  : [input.target.canonical]
              return Effect.fail(new RecoveryConflictError({
                path: input.target.canonical,
                recovery: recoveries[0]!,
                recoveries,
                state: cleanup ? "placeholder-inspection" : "approved-inspection",
              }))
            }))
          })
        }))),
        Effect.catchIf((error) => error instanceof Missing, () => Effect.succeed(removed(input.target, false))),
      ),
    ))))

    return Service.of({
      create,
      write,
      writeTextPreservingBom,
      writeIfUnchanged,
      commit,
      validate,
      stage,
      fingerprint: (value) => {
        const snapshot = data.get(value)
        return snapshot?.revision
          ? MutationEvents.fileFingerprint(snapshot.content, revisionIdentity(snapshot.revision))
          : undefined
      },
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
