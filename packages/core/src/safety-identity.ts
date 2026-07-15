export * as SafetyIdentity from "./safety-identity"

import fs from "node:fs/promises"
import { constants } from "node:fs"
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
  const nofollow = constants.O_NOFOLLOW ?? 0
  const directory = await fs.open(target.directory, constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | nofollow)
  try {
    if (!(await directory.stat()).isDirectory()) throw new Error("Safety identity directory is unsafe")
    if (process.platform !== "win32") await directory.chmod(0o700)
  } finally {
    await directory.close()
  }

  const temp = path.join(target.directory, `.safety.${process.pid}.${randomBytes(16).toString("hex")}.tmp`)
  const created = await fs.open(temp, "wx", 0o600)
  try {
    await created.writeFile(randomBytes(32))
    await created.sync()
    if (process.platform !== "win32") await created.chmod(0o600)
    await fs.link(temp, target.file).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error
    })
  } finally {
    await created.close()
    await fs.rm(temp, { force: true })
  }

  const handle = await fs.open(target.file, constants.O_RDONLY | nofollow)
  try {
    const info = await handle.stat()
    if (!info.isFile()) throw new Error("Safety identity seed is unsafe")
    if (process.platform !== "win32") await handle.chmod(0o600)
    const seed = await handle.readFile()
    if (seed.byteLength !== 32) throw new Error("Safety identity seed is invalid")
    return fromSeed(seed)
  } finally {
    await handle.close()
  }
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
