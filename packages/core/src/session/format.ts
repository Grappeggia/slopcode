export * as SessionFormat from "./format"

import Ajv from "ajv"
import Ajv2020 from "ajv/dist/2020.js"
import { createHash } from "node:crypto"
import { Effect, Schema } from "effect"
import type { JsonSchema } from "effect"
import type { EventV2 } from "../event"
import type { SessionMessage } from "./message"
import type { SessionSchema } from "./schema"

export const SCHEMA_MAX_BYTES = 256 * 1024
export const VALUE_MAX_BYTES = 1024 * 1024
export const MAX_DEPTH = 64

const Draft7 = "http://json-schema.org/draft-07/schema#"
const Draft2020 = "https://json-schema.org/draft/2020-12/schema"

export const Text = Schema.Struct({ type: Schema.Literal("text") })
export const Json = Schema.Struct({
  type: Schema.Literal("json_schema"),
  schema: Schema.Record(Schema.String, Schema.Unknown),
  retry_count: Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 5 })),
})
export const Format = Schema.Union([Text, Json]).pipe(Schema.toTaggedUnion("type"))
export type Format = typeof Format.Type
export type JsonFormat = typeof Json.Type

export const AdmissionReason = Schema.Literals([
  "invalid-format",
  "invalid-schema",
  "unsupported-schema",
  "schema-too-large",
  "schema-too-deep",
])

export class AdmissionError extends Schema.TaggedErrorClass<AdmissionError>()(
  "Session.StructuredFormatAdmissionError",
  {
    reason: AdmissionReason,
    message: Schema.String,
  },
) {}

type Check = ((value: unknown) => boolean) & { errors?: unknown }
const validators = new WeakMap<object, Check>()

const fail = (reason: typeof AdmissionReason.Type, message: string) =>
  Effect.fail(new AdmissionError({ reason, message }))

export const admit = Effect.fn("SessionFormat.admit")(function* (input: unknown) {
  if (input === undefined) return Object.freeze({ type: "text" as const })
  if (!record(input) || !plain(input)) return yield* fail("invalid-format", "Structured output format must be an object")
  const descriptors = Object.getOwnPropertyDescriptors(input)
  if (
    Object.getOwnPropertySymbols(input).length > 0 ||
    Object.values(descriptors).some((descriptor) => !("value" in descriptor) || !descriptor.enumerable)
  )
    return yield* fail("invalid-format", "Structured output format must be a closed JSON object")
  if (descriptors.type?.value === "text") {
    if (!keys(input, ["type"])) return yield* fail("invalid-format", "Text format contains unknown fields")
    return Object.freeze({ type: "text" as const })
  }
  if (descriptors.type?.value !== "json_schema" || !keys(input, ["type", "schema", "retry_count"]))
    return yield* fail("invalid-format", "Structured output format is invalid")
  if (!descriptors.schema || !("value" in descriptors.schema) || !record(descriptors.schema.value))
    return yield* fail("invalid-schema", "Structured output schema must be an object")
  const retry = descriptors.retry_count && "value" in descriptors.retry_count ? descriptors.retry_count.value : 2
  if (!Number.isInteger(retry) || typeof retry !== "number" || retry < 0 || retry > 5)
    return yield* fail("invalid-format", "retry_count must be an integer from 0 through 5")
  const schema = (yield* clone(descriptors.schema.value, "schema", SCHEMA_MAX_BYTES, MAX_DEPTH).pipe(
    Effect.mapError(
      (error) =>
        new AdmissionError({
          reason: error === "too-large" ? "schema-too-large" : error === "too-deep" ? "schema-too-deep" : "invalid-schema",
          message:
            error === "too-large"
              ? "Structured output schema exceeds 256 KiB"
              : error === "too-deep"
                ? "Structured output schema exceeds depth 64"
                : "Structured output schema must be a JSON object",
        }),
    ),
  )) as JsonSchema.JsonSchema
  const draft = Object.hasOwn(schema, "$schema") ? schema.$schema : Draft2020
  if (draft !== Draft7 && draft !== Draft2020)
    return yield* fail("unsupported-schema", "Structured output schema draft is unsupported")
  const compiled = yield* Effect.try({
    try: () =>
      (draft === Draft7 ? new Ajv(options) : new Ajv2020(options)).compile(schema as object) as Check,
    catch: () => new AdmissionError({ reason: "unsupported-schema", message: "Structured output schema is unsupported" }),
  })
  const value = Object.freeze({ type: "json_schema" as const, schema, retry_count: retry })
  validators.set(value, compiled)
  return value
})

const options = {
  allErrors: true,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
  loadSchema: undefined,
  validateFormats: true,
  strictSchema: true,
  strictTypes: false,
  strictTuples: false,
  allowUnionTypes: true,
} as const

export const validate = (format: JsonFormat, value: unknown) => validator(format)(value)

export const validator = (format: JsonFormat) => {
  const cached = validators.get(format)
  if (cached) return cached
  const draft = Object.hasOwn(format.schema, "$schema") ? format.schema.$schema : Draft2020
  const compiled = (draft === Draft7 ? new Ajv(options) : new Ajv2020(options)).compile(format.schema as object) as Check
  validators.set(format, compiled)
  return compiled
}

export const toolSchema = (format: JsonFormat) => {
  const schema = Object.fromEntries(Object.entries(format.schema).filter(([key]) => key !== "$schema"))
  return deepFreeze({
    type: "object",
    properties: { value: schema },
    required: ["value"],
    additionalProperties: false,
  }) as JsonSchema.JsonSchema
}

export const toolValue = Effect.fn("SessionFormat.toolValue")(function* (input: unknown) {
  const value = yield* safeValue(input)
  if (!record(value) || Object.keys(value).length !== 1 || !Object.hasOwn(value, "value"))
    return yield* Effect.fail(new Error("Structured final tool input must contain exactly one value field"))
  return yield* safeValue(value.value)
})

export const fingerprint = (format: JsonFormat) =>
  createHash("sha256").update(JSON.stringify({ schema: format.schema, retry_count: format.retry_count })).digest("hex")

const id = (sessionID: SessionSchema.ID, root: SessionMessage.ID, suffix: string) =>
  `evt_structured_${createHash("sha256").update(`${sessionID}\0${root}\0${suffix}`).digest("hex")}` as EventV2.ID

export const terminalID = (sessionID: SessionSchema.ID, root: SessionMessage.ID) => id(sessionID, root, "terminal")
export const candidateID = (sessionID: SessionSchema.ID, root: SessionMessage.ID, attempt: number) =>
  id(sessionID, root, `candidate:${attempt}`)
export const retryID = (sessionID: SessionSchema.ID, root: SessionMessage.ID, attempt: number) =>
  id(sessionID, root, `retry:${attempt}`)

export const equivalent = (left: Format | undefined, right: Format | undefined) => {
  const a = left ?? ({ type: "text" } as const)
  const b = right ?? ({ type: "text" } as const)
  if (a.type === "text" || b.type === "text") return a.type === b.type
  return a.retry_count === b.retry_count && equal(a.schema, b.schema)
}

export const safeValue = Effect.fn("SessionFormat.safeValue")(function* (value: unknown) {
  return yield* clone(value, "value", VALUE_MAX_BYTES, MAX_DEPTH).pipe(
    Effect.mapError(() => new Error("Structured output value exceeds public JSON limits")),
  )
})

type CloneError = "invalid" | "too-large" | "too-deep"

const clone = (value: unknown, _name: string, max: number, limit: number): Effect.Effect<unknown, CloneError> =>
  Effect.sync(() => {
    const seen = new Set<object>()
    const copy = (item: unknown, depth: number): unknown => {
      if (item === null || typeof item === "string" || typeof item === "boolean") return item
      if (typeof item === "number" && Number.isFinite(item)) return item
      if (typeof item !== "object") throw "invalid" satisfies CloneError
      if (depth > limit) throw "too-deep" satisfies CloneError
      if (seen.has(item)) throw "invalid" satisfies CloneError
      const proto = Object.getPrototypeOf(item)
      if (proto !== Object.prototype && proto !== null && !Array.isArray(item)) throw "invalid" satisfies CloneError
      if (Object.getOwnPropertySymbols(item).length > 0) throw "invalid" satisfies CloneError
      seen.add(item)
      if (Array.isArray(item)) {
        const descriptors = Object.getOwnPropertyDescriptors(item)
        const result = Array.from({ length: item.length }, (_, index) => {
          const descriptor = descriptors[String(index)]
          if (!descriptor || !("value" in descriptor)) throw "invalid" satisfies CloneError
          return copy(descriptor.value, depth + 1)
        })
        if (Object.keys(descriptors).some((key) => key !== "length" && !/^\d+$/.test(key)))
          throw "invalid" satisfies CloneError
        seen.delete(item)
        return Object.freeze(result)
      }
      const result = Object.create(null) as Record<string, unknown>
      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(item))) {
        if (!("value" in descriptor)) throw "invalid" satisfies CloneError
        if (!descriptor.enumerable) continue
        Object.defineProperty(result, key, {
          value: copy(descriptor.value, depth + 1),
          enumerable: true,
          configurable: false,
          writable: false,
        })
      }
      seen.delete(item)
      return Object.freeze(result)
    }
    const result = copy(value, 0)
    if (Buffer.byteLength(JSON.stringify(result)) > max) throw "too-large" satisfies CloneError
    return result
  }).pipe(Effect.catchDefect((error) => Effect.fail(error as CloneError)))

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const plain = (value: object) => {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const keys = (value: Record<string, unknown>, allowed: readonly string[]) =>
  Object.keys(value).every((key) => allowed.includes(key))

const equal = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((item, index) => equal(item, right[index]))
  if (!record(left) || !record(right)) return false
  const a = Object.keys(left)
  const b = Object.keys(right)
  return a.length === b.length && a.every((key, index) => key === b[index] && equal(left[key], right[key]))
}

const deepFreeze = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value
  Object.values(value).forEach(deepFreeze)
  return Object.freeze(value)
}
