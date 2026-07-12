export * as PostMutation from "./post-mutation"

import { Context, Effect, Layer } from "effect"
import { KeyedMutex } from "./effect/keyed-mutex"
import { EventV2 } from "./event"
import { FileMutation } from "./file-mutation"
import { FileSystem } from "./filesystem"
import { Watcher } from "./filesystem/watcher"
import { Formatter } from "./formatter"
import { FSUtil } from "./fs-util"
import { MutationEvents } from "./mutation-events"

export interface Fence { readonly check: Effect.Effect<void, unknown> }
export const current: Fence = { check: Effect.void }
export interface DiagnosticsInterface {
  readonly notify: (input: { readonly canonical: string; readonly event: MutationEvents.Kind }) => Effect.Effect<void>
}
export class Diagnostics extends Context.Service<Diagnostics, DiagnosticsInterface>()("@slopcode/v2/PostMutation/Diagnostics") {}
export const diagnosticsLayer = Layer.succeed(Diagnostics, Diagnostics.of({ notify: () => Effect.void }))

type Mutation = FileMutation.WriteResult | FileMutation.RemoveResult
export interface Input<A extends Mutation> {
  readonly target: { readonly canonical: string; readonly resource: string }
  readonly intent: "write" | "edit" | "add" | "update" | "delete"
  readonly mutation: Effect.Effect<A, unknown>
  readonly fence?: Fence
}
export type Result<A extends Mutation> = A & {
  readonly event: MutationEvents.Kind
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
const same = (left: Uint8Array, right: Uint8Array) => left.length === right.length && left.every((byte, index) => byte === right[index])

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const files = yield* FileMutation.Service
    const formatter = yield* Formatter.Service
    const fs = yield* FSUtil.Service
    const events = yield* EventV2.Service
    const ownership = yield* MutationEvents.Service
    const diagnostics = yield* Diagnostics
    const locks = KeyedMutex.makeUnsafe<string>()
    const run = <A extends Mutation>(input: Input<A>) => locks.withLock(input.target.canonical)(
      Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const fence = input.fence ?? current
          yield* fence.check
          const owner = yield* ownership.begin(input.target.canonical)
          let complete = false
          return yield* Effect.gen(function* () {
            const mutated = yield* restore(input.mutation)
            const deleted = mutated.operation === "remove"
            const immediate = deleted ? new Uint8Array() : yield* fs.readFile(input.target.canonical)
            yield* fence.check
            const formatted = deleted ? { matched: false, outcomes: [] } : yield* restore(formatter.format(input.target))
            let final = deleted ? new Uint8Array() : yield* fs.readFile(input.target.canonical)
            if (!deleted) {
              const wanted = hasBom(immediate)
              let offset = 0
              while (hasBom(final.slice(offset))) offset += 3
              const body = final.slice(offset)
              const repaired = wanted ? new Uint8Array([0xef, 0xbb, 0xbf, ...body]) : body
              if (!same(final, repaired)) {
                yield* files.write({ target: input.target, content: repaired })
                final = repaired
              }
            }
            const event: MutationEvents.Kind = deleted ? "unlink" : mutated.existed ? "change" : "add"
            yield* fence.check
            if (!deleted) yield* events.publish(FileSystem.Event.Edited, { file: input.target.canonical })
            yield* events.publish(Watcher.Event.Updated, { file: input.target.canonical, event })
            yield* owner.complete(event)
            complete = true
            yield* diagnostics.notify({ canonical: input.target.canonical, event })
            yield* fence.check
            return {
              ...mutated,
              event,
              matched: formatted.matched,
              formatters: formatted.outcomes,
              changed: !same(immediate, final),
              bytes: final.length,
            }
          }).pipe(Effect.ensuring(Effect.suspend(() => complete ? Effect.void : owner.cancel)))
        }),
      ),
    )
    return Service.of({ run })
  }),
)

export const locationLayer = layer
