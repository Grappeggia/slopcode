export * as State from "./state"

import { Context, Effect, Scope, Semaphore } from "effect"
import type { Draft, Objectish } from "immer"

export type TransformCallback<DraftApi> = (draft: DraftApi) => Effect.Effect<void> | void
export type MakeDraft<State extends Objectish, DraftApi> = (state: Draft<State>) => DraftApi

export interface Registration {
  readonly dispose: Effect.Effect<void>
}

export type Transform<DraftApi> = (
  transform: TransformCallback<DraftApi>,
) => Effect.Effect<Registration, never, Scope.Scope>

export type Reload = () => Effect.Effect<void>

export interface Transformable<DraftApi> {
  readonly transform: Transform<DraftApi>
  readonly reload: Reload
}

const CurrentBatch = Context.Reference<Set<Reload> | undefined>("@slopcode/State/CurrentBatch", {
  defaultValue: () => undefined,
})

export function batch<A, E, R>(effect: Effect.Effect<A, E, R>) {
  return Effect.gen(function* () {
    const current = yield* CurrentBatch
    if (current) return yield* effect
    const reloads = new Set<Reload>()
    const result = yield* effect.pipe(Effect.provideService(CurrentBatch, reloads))
    yield* Effect.forEach(reloads, (reload) => reload(), { discard: true })
    return result
  })
}

export interface Options<State extends Objectish, DraftApi> {
  readonly initial: () => State
  readonly draft: MakeDraft<State, DraftApi>
  readonly finalize?: (draft: DraftApi, reason?: string) => Effect.Effect<void>
}

export interface Interface<State extends Objectish, DraftApi> extends Transformable<DraftApi> {
  readonly get: () => State
  mutate: (update: (draft: DraftApi) => Effect.Effect<void>, reason?: string) => Effect.Effect<void>
}

export function create<State extends Objectish, DraftApi>(
  options: Options<State, DraftApi>,
): Interface<State, DraftApi> {
  let state = options.initial()
  let transforms: { run: TransformCallback<DraftApi> }[] = []
  const semaphore = Semaphore.makeUnsafe(1)

  const commit = Effect.fn("State.commit")(function* (next: State, reason?: string) {
    const api = options.draft(next as Draft<State>)
    if (options.finalize) yield* options.finalize(api, reason)
    state = next
  })

  const apply = (transform: TransformCallback<DraftApi>, draft: DraftApi) =>
    Effect.suspend(() => {
      const result = transform(draft)
      return Effect.isEffect(result) ? Effect.asVoid(result).pipe(Effect.orDie) : Effect.void
    })

  const materialize = Effect.fnUntraced(function* () {
    const next = options.initial()
    const api = options.draft(next as Draft<State>)
    for (const transform of transforms) yield* apply(transform.run, api).pipe(Effect.withSpan("State.reload.update"))
    yield* commit(next)
  })

  const reload = () => semaphore.withPermit(materialize())

  const result: Interface<State, DraftApi> = {
    get: () => state,
    transform: (update) =>
      Effect.uninterruptible(
        Effect.gen(function* () {
          const scope = yield* Scope.Scope
          const transform = { run: update }
          let active = true
          const dispose = Effect.uninterruptible(
            semaphore.withPermit(
              Effect.suspend(() => {
                if (!active) return Effect.void
                active = false
                transforms = transforms.filter((item) => item !== transform)
                return Effect.gen(function* () {
                  const batch = yield* CurrentBatch
                  if (batch) {
                    batch.add(reload)
                    return
                  }
                  yield* materialize()
                })
              }),
            ),
          )
          yield* semaphore.withPermit(
            Effect.sync(() => {
              transforms = [...transforms, transform]
            }),
          )
          yield* Scope.addFinalizer(scope, dispose)
          const batch = yield* CurrentBatch
          if (batch) batch.add(reload)
          else yield* reload()
          return { dispose }
        }),
      ),
    reload,
    mutate: Effect.fn("State.mutate")(function* (update, reason) {
      const api = options.draft(state as Draft<State>)
      yield* update(api)
      if (options.finalize) yield* options.finalize(api, reason)
    }, semaphore.withPermit),
  }
  return result
}