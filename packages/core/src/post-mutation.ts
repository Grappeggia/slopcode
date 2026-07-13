export * as PostMutation from "./post-mutation"

import { Context, Effect, Layer, Schema } from "effect"
import { KeyedMutex } from "./effect/keyed-mutex"
import { EventV2 } from "./event"
import { FileMutation } from "./file-mutation"
import { FileSystem } from "./filesystem"
import { Watcher } from "./filesystem/watcher"
import { Formatter } from "./formatter"
import { MutationEvents } from "./mutation-events"

export interface Fence {
  readonly check: Effect.Effect<void, unknown>
}
export const current: Fence = { check: Effect.void }
export interface DiagnosticsInterface {
  readonly notify: (input: { readonly canonical: string; readonly event: MutationEvents.Kind }) => Effect.Effect<void>
}
export class Diagnostics extends Context.Service<Diagnostics, DiagnosticsInterface>()(
  "@slopcode/v2/PostMutation/Diagnostics",
) {}
export const diagnosticsLayer = Layer.succeed(Diagnostics, Diagnostics.of({ notify: () => Effect.void }))

export class ResultMismatchError extends Schema.TaggedErrorClass<ResultMismatchError>()(
  "PostMutation.ResultMismatchError",
  {
    path: Schema.String,
  },
) {}

type Mutation = FileMutation.WriteResult | FileMutation.RemoveResult
export interface Input<A extends Mutation> {
  readonly target: FileMutation.Target
  readonly intent: "write" | "edit" | "add" | "update" | "delete"
  readonly mutation: Effect.Effect<A, unknown>
  readonly fence?: Fence
}
export type Result<A extends Mutation> = A & {
  readonly event: MutationEvents.Kind
  readonly emitted: boolean
  readonly matched: boolean
  readonly formatters: readonly Formatter.Outcome[]
  readonly changed: boolean
  readonly bytes: number
}
export interface Interface {
  readonly run: <A extends Mutation>(input: Input<A>) => Effect.Effect<Result<A>, unknown>
}
export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/PostMutation") {}

const hasBom = (content: Uint8Array) => content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf
const same = (left: Uint8Array, right: Uint8Array) =>
  left.length === right.length && left.every((byte, index) => byte === right[index])

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const files = yield* FileMutation.Service
    const formatter = yield* Formatter.Service
    const events = yield* EventV2.Service
    const ownership = yield* MutationEvents.Service
    const diagnostics = yield* Diagnostics
    const locks = KeyedMutex.makeUnsafe<string>()

    const staged = (target: Input<Mutation>["target"], immediate: Uint8Array, fence: Fence) =>
      Effect.scoped(
        Effect.gen(function* () {
          const stage = yield* files.stage({ target, content: immediate })
          if (!stage)
            return {
              formatted:
                files.staging === "secure"
                  ? { matched: false, outcomes: [{ name: "stage", code: "unavailable" as const }] }
                  : { matched: false, outcomes: [{ name: "security", code: "unsupported-security" as const }] },
              final: immediate,
            }
          yield* stage.verify
          const formatted = yield* formatter.format({ canonical: stage.canonical })
          yield* fence.check
          yield* stage.verify
          const output = yield* stage.read
          const wanted = hasBom(immediate)
          let offset = 0
          while (hasBom(output.slice(offset))) offset += 3
          const body = output.slice(offset)
          return {
            formatted,
            final: wanted ? new Uint8Array([0xef, 0xbb, 0xbf, ...body]) : body,
          }
        }),
      ).pipe(
        Effect.catchIf(
          (error) => error instanceof FileMutation.StageUnavailableError,
          () =>
            Effect.succeed({
              formatted: { matched: false, outcomes: [{ name: "stage", code: "unavailable" as const }] },
              final: immediate,
            }),
        ),
      )

    const run = <A extends Mutation>(input: Input<A>) =>
      locks.withLock(input.target.canonical)(
        Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            const fence = input.fence ?? current
            yield* fence.check
            const owner = yield* ownership.begin(input.target.canonical)
            let complete = false
            return yield* Effect.gen(function* () {
              const mutated = yield* restore(input.mutation)
              const operation = input.intent === "delete" ? "remove" : "write"
              if (
                mutated.target !== input.target.canonical ||
                mutated.resource !== input.target.resource ||
                mutated.operation !== operation
              )
                return yield* new ResultMismatchError({ path: input.target.canonical })

              const snapshot = files.private(mutated)
              if (!snapshot) return yield* new ResultMismatchError({ path: input.target.canonical })
              if (snapshot.target !== input.target)
                return yield* new ResultMismatchError({ path: input.target.canonical })
              const deleted = mutated.operation === "remove"
              const event: MutationEvents.Kind = deleted ? "unlink" : mutated.existed ? "change" : "add"
              if (mutated.change === "none") {
                yield* owner.cancel
                complete = true
                yield* fence.check
                return {
                  ...mutated,
                  change: mutated.change,
                  event,
                  emitted: false,
                  matched: false,
                  formatters: [],
                  changed: false,
                  bytes: snapshot.content.length,
                }
              }

              const immediate = snapshot.content
              yield* fence.check
              const output = deleted
                ? { formatted: { matched: false, outcomes: [] }, final: new Uint8Array() }
                : yield* restore(staged(input.target, immediate, fence))
              const final = deleted
                ? undefined
                : output.formatted.matched
                  ? yield* Effect.gen(function* () {
                      yield* fence.check
                      return yield* files.commit({
                        target: input.target,
                        expected: immediate,
                        content: output.final,
                        revision: snapshot.revision,
                        guard: fence.check,
                      })
                    })
                  : undefined
              const fingerprint = deleted
                ? MutationEvents.missingFingerprint
                : final
                  ? files.fingerprint(final)
                  : yield* files.validate(mutated as FileMutation.WriteResult, fence.check)
              if (!fingerprint) return yield* new ResultMismatchError({ path: input.target.canonical })

              yield* fence.check
              if (!deleted) yield* events.publish(FileSystem.Event.Edited, { file: input.target.canonical })
              yield* fence.check
              yield* events.publish(Watcher.Event.Updated, { file: input.target.canonical, event })
              yield* owner.complete(event, fingerprint)
              complete = true
              yield* fence.check
              yield* diagnostics.notify({ canonical: input.target.canonical, event })
              yield* fence.check
              return {
                ...mutated,
                change: mutated.change,
                event,
                emitted: true,
                matched: output.formatted.matched,
                formatters: output.formatted.outcomes,
                changed: !same(immediate, output.final),
                bytes: output.final.length,
              }
            }).pipe(Effect.ensuring(Effect.suspend(() => (complete ? Effect.void : owner.cancel))))
          }),
        ),
      )
    return Service.of({ run })
  }),
)

export const locationLayer = layer
