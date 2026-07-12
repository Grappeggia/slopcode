export * as MutationEvents from "./mutation-events"

import { Context, Effect, Layer, Option } from "effect"
import { FSUtil } from "./fs-util"

export type Kind = "add" | "change" | "unlink"
export interface Ownership {
  readonly complete: (event: Kind) => Effect.Effect<void>
  readonly cancel: Effect.Effect<void>
}
export interface Interface {
  readonly begin: (canonical: string) => Effect.Effect<Ownership>
  readonly native: (canonical: string, event: Kind) => Effect.Effect<boolean>
}
export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/MutationEvents") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const active = new Set<string>()
    const settled = new Map<string, string>()
    const fingerprint = Effect.fnUntraced(function* (canonical: string) {
      const info = yield* fs.stat(canonical).pipe(Effect.option)
      if (Option.isNone(info)) return "missing"
      const content = info.value.type === "File" ? yield* fs.readFile(canonical).pipe(Effect.option) : Option.none()
      return `${info.value.type}:${info.value.size}:${Option.isSome(content) ? Bun.hash(content.value) : ""}`
    })
    yield* Effect.addFinalizer(() => Effect.sync(() => { active.clear(); settled.clear() }))
    return Service.of({
      begin: (input) => Effect.sync(() => {
        const canonical = FSUtil.normalizePath(input)
        active.add(canonical)
        return {
          complete: () => fingerprint(canonical).pipe(
            Effect.tap((value) => Effect.sync(() => { active.delete(canonical); settled.set(canonical, value) })),
            Effect.asVoid,
          ),
          cancel: Effect.sync(() => { active.delete(canonical) }),
        }
      }),
      native: (input) => Effect.gen(function* () {
        const canonical = FSUtil.normalizePath(input)
        if (active.has(canonical)) return false
        const current = yield* fingerprint(canonical)
        if (settled.get(canonical) === current) return false
        settled.delete(canonical)
        return true
      }),
    })
  }),
)

export const locationLayer = layer
