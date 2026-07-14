export * as SafetyIdentity from "./safety-identity"

import fs from "node:fs/promises"
import path from "node:path"
import { createHmac, randomBytes } from "node:crypto"
import { Context, Effect, Layer, Schema } from "effect"
import { Global } from "./global"
import { LayerNode } from "./effect/layer-node"

export type Sources = {
  readonly account?: string
  readonly openai?: string
}

export interface Interface {
  readonly identifier: (sources: Sources) => string
}

export class SeedError extends Schema.TaggedErrorClass<SeedError>()("SafetyIdentity.SeedError", {
  message: Schema.String,
}) {}

export const seedPath = (data: string) => ({
  directory: path.join(data, "identity"),
  file: path.join(data, "identity", "safety.key"),
})

export const fromSeed = (seed: Uint8Array): Interface => ({
  identifier: (sources) => {
    const source = sources.account ? "account" : sources.openai ? "openai-oauth" : "installation"
    const value = sources.account ?? sources.openai ?? "installation"
    return `sc_${createHmac("sha256", seed)
      .update("slopcode-openai-safety-identifier-v1\0")
      .update(source)
      .update("\0")
      .update(value)
      .digest("base64url")}`
  },
})

export const load = async (data: string): Promise<Interface> => {
  const target = seedPath(data)
  await fs.mkdir(target.directory, { recursive: true, mode: 0o700 })
  const directory = await fs.lstat(target.directory)
  if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error("Safety identity directory is unsafe")
  await fs.chmod(target.directory, 0o700)
  const existing = await fs.lstat(target.file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  if (!existing) {
    const temp = path.join(target.directory, `.safety.${process.pid}.${randomBytes(16).toString("hex")}.tmp`)
    const handle = await fs.open(temp, "wx", 0o600)
    try {
      await handle.writeFile(randomBytes(32))
      await handle.sync()
    } finally {
      await handle.close()
    }
    try {
      await fs.link(temp, target.file).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error
      })
    } finally {
      await fs.rm(temp, { force: true })
    }
  }
  const info = await fs.lstat(target.file)
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Safety identity seed is unsafe")
  await fs.chmod(target.file, 0o600)
  const seed = await fs.readFile(target.file)
  if (seed.byteLength !== 32) throw new Error("Safety identity seed is invalid")
  return fromSeed(seed)
}

export const make = (input: { readonly data: string }) =>
  Effect.tryPromise({
    try: () => load(input.data),
    catch: (error) =>
      new SeedError({ message: error instanceof Error ? error.message : "Safety identity seed initialization failed" }),
  })

export class Service extends Context.Service<Service, Interface>()("@slopcode/SafetyIdentity") {}
export const layer = Layer.effect(Service, Global.Service.pipe(Effect.flatMap(make), Effect.orDie))
export const defaultLayer = layer.pipe(Layer.provide(Global.defaultLayer))
export const layerWithSeed = (seed: Uint8Array) => Layer.succeed(Service, Service.of(fromSeed(seed)))
export const node = LayerNode.make(layer, [Global.node])
