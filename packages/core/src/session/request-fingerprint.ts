export * as SessionRequestFingerprint from "./request-fingerprint"

import fs from "node:fs/promises"
import path from "node:path"
import { createHash, createHmac, randomBytes } from "node:crypto"
import type { LLMRequest } from "@slopcode-ai/llm"
import { Context, Effect, Layer, Schema } from "effect"
import type { AgentV2 } from "../agent"
import { Global } from "../global"
import type { ModelV2 } from "../model"
import type { ModelHarness } from "../model-harness"

const secret = /^(?:authorization|proxy-authorization|(?:x-)?api[-_]?key|token|secret|credential|cookie|set-cookie|auth|password)$/i

export class KeyError extends Schema.TaggedErrorClass<KeyError>()("SessionRequestFingerprint.KeyError", {
  message: Schema.String,
}) {}

export const keyPath = (data: string) => ({
  directory: path.join(data, "identity"),
  file: path.join(data, "identity", "request-fingerprint.key"),
})

const load = async (data: string) => {
  const target = keyPath(data)
  await fs.mkdir(target.directory, { recursive: true, mode: 0o700 })
  const directory = await fs.lstat(target.directory)
  if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error("Request fingerprint key directory is unsafe")
  await fs.chmod(target.directory, 0o700)
  const existing = await fs.lstat(target.file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  if (!existing) {
    const temp = path.join(target.directory, `.request-fingerprint.${process.pid}.${randomBytes(16).toString("hex")}.tmp`)
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
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Request fingerprint key file is unsafe")
  await fs.chmod(target.file, 0o600)
  const key = await fs.readFile(target.file)
  if (key.byteLength !== 32) throw new Error("Request fingerprint key is invalid")
  return key
}

const plain = (value: unknown): unknown => {
  if (value === undefined) return null
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) return value.map(plain)
  if (typeof value !== "object") return String(value)
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([name, item]) => [name, plain(item)]))
}

export type Input = {
  readonly request: LLMRequest
  readonly catalog: ModelV2.Info
  readonly variant?: string
  readonly agent: AgentV2.ID
  readonly harness?: ModelHarness.Profile
}

export interface Interface {
  readonly fingerprint: (input: Input) => string
}

export const fromKey = (key: Uint8Array): Interface => {
  const installation = createHmac("sha256", key).update("slopcode-request-installation-v1").digest("hex")
  const credential = (names: ReadonlyArray<string>, value: unknown) => createHmac("sha256", key)
    .update("slopcode-request-credential-v2\0")
    .update(names.join("\0"))
    .update("\0")
    .update(JSON.stringify(plain(value)))
    .digest("hex")
  const canonical = (value: unknown, names: ReadonlyArray<string> = []): unknown => {
    if (value === undefined) return null
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
    if (Array.isArray(value)) return value.map((item, index) => canonical(item, [...names, String(index)]))
    if (typeof value !== "object") return String(value)
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([name, item]) => [name, secret.test(name) ? { credential: credential([...names, name], item) } : canonical(item, [...names, name])]))
  }
  return {
    fingerprint: (input) => createHash("sha256").update(JSON.stringify(canonical({
      version: 2,
      installation,
      agent: input.agent,
      variant: input.variant ?? "default",
      harness: input.harness,
      catalog: { id: input.catalog.id, providerID: input.catalog.providerID, api: input.catalog.api, request: input.catalog.request },
      request: {
        model: {
          id: input.request.model.id,
          provider: input.request.model.provider,
          route: { id: input.request.model.route.id, protocol: input.request.model.route.protocol, capabilities: input.request.model.route.capabilities, defaults: input.request.model.route.defaults, auth: input.request.model.route.auth },
        },
        system: input.request.system,
        messages: input.request.messages,
        tools: input.request.tools,
        toolChoice: input.request.toolChoice,
        generation: input.request.generation,
        providerOptions: input.request.providerOptions,
        http: input.request.http,
        responseFormat: input.request.responseFormat,
        cache: input.request.cache,
        metadata: input.request.metadata,
      },
    }))).digest("hex"),
  }
}

export const make = (input: { readonly data: string }) => Effect.tryPromise({
  try: () => load(input.data).then(fromKey),
  catch: (error) => new KeyError({ message: error instanceof Error ? error.message : "Request fingerprint key initialization failed" }),
})

export class Service extends Context.Service<Service, Interface>()("@slopcode/SessionRequestFingerprint") {}
export const layer = Layer.effect(Service, Global.Service.pipe(Effect.flatMap((global) => make(global)), Effect.orDie))
export const defaultLayer = layer.pipe(Layer.provide(Global.defaultLayer))
export const layerWithKey = (key: Uint8Array) => Layer.succeed(Service, Service.of(fromKey(key)))
export const fingerprint = (input: Input) => Service.use((service) => Effect.sync(() => service.fingerprint(input)))
