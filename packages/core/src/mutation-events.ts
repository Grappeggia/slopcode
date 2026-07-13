export * as MutationEvents from "./mutation-events"

import { Context, Effect, Layer } from "effect"
import fs from "fs/promises"
import { FSUtil } from "./fs-util"

export type Kind = "add" | "change" | "unlink"
export type Fingerprint = string
export const missingFingerprint = "missing"
export const fileFingerprint = (content: Uint8Array, identity = "") =>
  `File:${identity}:${content.length}:${Bun.hash(content)}`
export const currentFingerprint = (canonical: string) => Effect.promise(async () => {
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
  readonly native: (canonical: string, event: Kind) => Effect.Effect<boolean>
}
export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/MutationEvents") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const active = new Set<string>()
    const settled = new Map<string, string>()
    yield* Effect.addFinalizer(() => Effect.sync(() => { active.clear(); settled.clear() }))
    return Service.of({
      begin: (input) => Effect.sync(() => {
        const canonical = FSUtil.normalizePath(input)
        active.add(canonical)
        return {
          complete: (_event, value) => Effect.sync(() => { active.delete(canonical); settled.set(canonical, value) }),
          cancel: Effect.sync(() => { active.delete(canonical) }),
        }
      }),
      native: (input) => Effect.gen(function* () {
        const canonical = FSUtil.normalizePath(input)
        if (active.has(canonical)) return false
        const current = yield* currentFingerprint(canonical)
        if (settled.get(canonical) === current) return false
        settled.delete(canonical)
        return true
      }),
    })
  }),
)

export const locationLayer = layer
