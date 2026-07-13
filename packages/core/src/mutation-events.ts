export * as MutationEvents from "./mutation-events"

import { Context, Effect, Layer } from "effect"
import fs from "fs/promises"
import { FSUtil } from "./fs-util"

export type Kind = "add" | "change" | "unlink"
export type Fingerprint = string
export const missingFingerprint = "missing"
export const fileFingerprint = (content: Uint8Array, identity = "") =>
  `File:${identity}:${content.length}:${Bun.hash(content)}`
export const currentFingerprint = (canonical: string) =>
  Effect.promise(async () => {
    try {
      const info = await fs.stat(canonical, { bigint: true })
      if (!info.isFile()) return `Other:${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`
      return fileFingerprint(
        await fs.readFile(canonical),
        `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`,
      )
    } catch {
      return missingFingerprint
    }
  })
export interface Ownership {
  readonly complete: (event: Kind, fingerprint: Fingerprint) => Effect.Effect<void>
  readonly cancel: Effect.Effect<void>
}
export interface Interface {
  readonly begin: (canonical: string) => Effect.Effect<Ownership>
  readonly native: (canonical: string, event: Kind, publish?: Effect.Effect<void>) => Effect.Effect<boolean>
}
export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/MutationEvents") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const active = new Set<string>()
    const settled = new Map<string, string>()
    const pending = new Map<
      string,
      { readonly event: Kind; readonly fingerprint: string; readonly publish: Effect.Effect<void> }
    >()
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        active.clear()
        settled.clear()
        pending.clear()
      }),
    )
    return Service.of({
      begin: (input) =>
        Effect.sync(() => {
          const canonical = FSUtil.normalizePath(input)
          active.add(canonical)
          return {
            complete: (_event, value) =>
              Effect.gen(function* () {
                active.delete(canonical)
                settled.set(canonical, value)
                const retained = pending.get(canonical)
                pending.delete(canonical)
                if (retained && retained.fingerprint !== value) yield* retained.publish
              }),
            cancel: Effect.gen(function* () {
              active.delete(canonical)
              const retained = pending.get(canonical)
              pending.delete(canonical)
              if (retained) yield* retained.publish
            }),
          }
        }),
      native: (input, event, publish = Effect.void) =>
        Effect.gen(function* () {
          const canonical = FSUtil.normalizePath(input)
          const current = yield* currentFingerprint(canonical)
          if (active.has(canonical)) {
            pending.set(canonical, { event, fingerprint: current, publish })
            return false
          }
          if (settled.get(canonical) === current) return false
          settled.delete(canonical)
          yield* publish
          return true
        }),
    })
  }),
)

export const locationLayer = layer
