import { describe, expect } from "bun:test"
import { Effect, Exit } from "effect"
import { SessionFormat } from "@slopcode-ai/core/session/format"
import { it } from "./lib/effect"

describe("SessionFormat admission", () => {
  it.effect("normalizes text and the structured retry budget", () =>
    Effect.gen(function* () {
      expect(yield* SessionFormat.admit(undefined)).toEqual({ type: "text" })
      expect(yield* SessionFormat.admit({ type: "text" })).toEqual({ type: "text" })
      expect(yield* SessionFormat.admit({ type: "json_schema", schema: { type: "string" } })).toEqual({
        type: "json_schema",
        schema: { type: "string" },
        retry_count: 2,
      })
      expect(
        yield* SessionFormat.admit({ type: "json_schema", schema: { type: "number" }, retry_count: 0 }),
      ).toMatchObject({ retry_count: 0 })
      expect(
        yield* SessionFormat.admit({ type: "json_schema", schema: { type: "boolean" }, retry_count: 5 }),
      ).toMatchObject({ retry_count: 5 })
    }),
  )

  it.effect("rejects invalid closed formats before admission", () =>
    Effect.gen(function* () {
      for (const format of [
        { type: "text", extra: true },
        { type: "json_schema" },
        { type: "json_schema", schema: {}, retry_count: -1 },
        { type: "json_schema", schema: {}, retry_count: 1.5 },
        { type: "json_schema", schema: {}, retry_count: 6 },
      ]) {
        const exit = yield* SessionFormat.admit(format).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
    }),
  )

  it.effect("compiles supported local schemas and fails closed", () =>
    Effect.gen(function* () {
      const admitted = yield* SessionFormat.admit({
        type: "json_schema",
        schema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          $defs: { item: { type: "object", properties: { constructor: { type: "string" } }, required: ["constructor"] } },
          type: "array",
          items: { $ref: "#/$defs/item" },
        },
      })
      if (admitted.type !== "json_schema") throw new Error("expected structured format")
      expect(SessionFormat.validate(admitted, [{ constructor: "safe" }])).toBe(true)
      expect(SessionFormat.validate(admitted, [{ constructor: 1 }])).toBe(false)

      for (const schema of [
        { $schema: "https://json-schema.org/draft/2019-09/schema" },
        { type: "string", format: "email" },
        { $ref: "https://example.test/schema.json" },
        { unknownKeyword: true },
      ]) {
        const failure = yield* SessionFormat.admit({ type: "json_schema", schema }).pipe(Effect.flip)
        expect(failure._tag).toBe("Session.StructuredFormatAdmissionError")
      }
    }),
  )

  it.effect("clones safely without invoking accessors or prototype setters", () =>
    Effect.gen(function* () {
      let accessed = false
      const invalid = Object.defineProperty({}, "type", {
        enumerable: true,
        get() {
          accessed = true
          return "text"
        },
      })
      yield* SessionFormat.admit(invalid).pipe(Effect.exit)
      expect(accessed).toBe(false)

      const schema = Object.create(null) as Record<string, unknown>
      Object.defineProperty(schema, "__proto__", { value: { type: "string" }, enumerable: true })
      schema.type = "object"
      schema.properties = Object.fromEntries([
        ["__proto__", { type: "string" }],
        ["prototype", { type: "number" }],
        ["constructor", { type: "boolean" }],
      ])
      const admitted = yield* SessionFormat.admit({ type: "json_schema", schema })
      if (admitted.type !== "json_schema") throw new Error("expected structured format")
      ;(schema.properties as Record<string, unknown>).constructor = { type: "null" }
      expect(Object.keys(admitted.schema)).toContain("__proto__")
      expect((admitted.schema.properties as Record<string, unknown>).constructor).toEqual({ type: "boolean" })
      expect(Object.getPrototypeOf({})).toBe(Object.prototype)

      for (const value of [
        Object.assign(Object.create({ inherited: true }), { type: "text" }),
        { type: "json_schema", schema: { type: "number" }, extra: Symbol("bad") },
        { type: "json_schema", schema: { const: Number.NaN } },
        { type: "json_schema", schema: { const: Number.POSITIVE_INFINITY } },
        { type: "json_schema", schema: { const: () => undefined } },
      ]) {
        expect(Exit.isFailure(yield* SessionFormat.admit(value).pipe(Effect.exit))).toBe(true)
      }
      const cyclic: Record<string, unknown> = { type: "object" }
      cyclic.self = cyclic
      expect(
        Exit.isFailure(
          yield* SessionFormat.admit({ type: "json_schema", schema: cyclic }).pipe(Effect.exit),
        ),
      ).toBe(true)
      const hidden = Object.defineProperty({ type: "text" }, "hidden", {
        get() {
          throw new Error("must not execute")
        },
      })
      expect(Exit.isFailure(yield* SessionFormat.admit(hidden).pipe(Effect.exit))).toBe(true)
    }),
  )

  it.effect("applies byte and depth limits to the schema rather than its format wrapper", () =>
    Effect.gen(function* () {
      const overhead = Buffer.byteLength(JSON.stringify({ description: "" }))
      const exact = { description: "x".repeat(SessionFormat.SCHEMA_MAX_BYTES - overhead) }
      expect((yield* SessionFormat.admit({ type: "json_schema", schema: exact })).type).toBe("json_schema")
      expect(
        (yield* SessionFormat.admit({ type: "json_schema", schema: { description: `${exact.description}x` } }).pipe(
          Effect.flip,
        )).reason,
      ).toBe("schema-too-large")

      const nested = (depth: number): Record<string, unknown> =>
        depth === 0 ? { type: "string" } : { type: "array", items: nested(depth - 1) }
      expect((yield* SessionFormat.admit({ type: "json_schema", schema: nested(64) })).type).toBe("json_schema")
      expect(
        (yield* SessionFormat.admit({ type: "json_schema", schema: nested(65) }).pipe(Effect.flip)).reason,
      ).toBe("schema-too-deep")
    }),
  )

  it.effect("preserves durable schema while stripping only the tool-view metaschema", () =>
    Effect.gen(function* () {
      const admitted = yield* SessionFormat.admit({
        type: "json_schema",
        schema: {
          $schema: "http://json-schema.org/draft-07/schema#",
          type: "object",
          properties: { nested: { $schema: "http://json-schema.org/draft-07/schema#", type: "string" } },
        },
      })
      if (admitted.type !== "json_schema") throw new Error("expected structured format")
      expect(SessionFormat.toolSchema(admitted)).not.toHaveProperty("$schema")
      expect((SessionFormat.toolSchema(admitted).properties as Record<string, unknown>).nested).toHaveProperty(
        "$schema",
      )
      expect(admitted.schema).toHaveProperty("$schema")
      expect(SessionFormat.toolSchema(admitted)).toEqual({
        type: "object",
        properties: {
          value: {
            type: "object",
            properties: { nested: { $schema: "http://json-schema.org/draft-07/schema#", type: "string" } },
          },
        },
        required: ["value"],
        additionalProperties: false,
      })
    }),
  )
})
