import { describe, expect, test } from "bun:test"
import { ApplicationTools } from "@slopcode-ai/core/tool/application-tools"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { Tool } from "@slopcode-ai/core/tool/tool"
import { ToolOutputStore } from "@slopcode-ai/core/tool-output-store"
import { Cause, Deferred, Effect, Exit, Fiber, Layer } from "effect"
import { testEffect } from "./lib/effect"

const bounded: string[] = []
const outputStore = Layer.mock(ToolOutputStore.Service, {
  limits: () => Effect.succeed({ maxLines: 2_000, maxBytes: 50 * 1024 }),
  bound: (input) =>
    Effect.sync(() => bounded.push(input.toolCallID)).pipe(Effect.as({ output: input.output, outputPaths: [] })),
  cleanup: () => Effect.void,
})
const it = testEffect(ToolRegistry.layer.pipe(Layer.provide(ApplicationTools.layer), Layer.provide(outputStore)))
const identity = {
  sessionID: SessionV2.ID.make("ses_dynamic_tool"),
  agent: AgentV2.ID.make("build"),
  assistantMessageID: SessionMessage.ID.make("msg_dynamic_tool"),
}

describe("Tool.dynamic", () => {
  it.effect("preserves immutable raw schemas and executes only decoded input", () =>
    Effect.gen(function* () {
      const input = {
        type: "object",
        properties: { value: { type: "string", description: "original" } },
        required: ["value"],
      }
      const output = { type: "object", properties: { size: { type: "integer" } }, required: ["size"] }
      const seen: Array<{ value: string }> = []
      const tool = Tool.dynamic({
        description: "Measure a value",
        inputSchema: input,
        outputSchema: output,
        decodeInput: (value) =>
          typeof value === "object" && value !== null && "value" in value && typeof value.value === "string"
            ? Effect.succeed({ value: value.value.trim() })
            : Effect.fail(new Tool.Failure({ message: "value must be a string" })),
        encodeOutput: (value) =>
          typeof value === "object" && value !== null && "size" in value && typeof value.size === "number"
            ? Effect.succeed({ size: value.size })
            : Effect.fail(new Tool.Failure({ message: "size must be a number" })),
        execute: (value) => Effect.sync(() => seen.push(value)).pipe(Effect.as({ size: value.value.length })),
        toModelOutput: ({ output }) => [
          { type: "text", text: String(output.size) },
          { type: "file", data: "aGVsbG8=", mime: "text/plain", name: "size.txt" },
        ],
      })
      input.properties.value.description = "mutated"
      output.properties.size.type = "string"

      const registry = yield* ToolRegistry.Service
      const materialized = yield* registry.materialize([], {}, { tools: [{ dynamic: tool }] })
      expect(materialized.definitions[0]).toMatchObject({
        name: "dynamic",
        inputSchema: {
          type: "object",
          properties: { value: { type: "string", description: "original" } },
          required: ["value"],
        },
        outputSchema: { type: "object", properties: { size: { type: "integer" } }, required: ["size"] },
      })
      expect(Object.isFrozen(materialized.definitions[0]?.inputSchema)).toBe(true)
      expect(Object.isFrozen(materialized.definitions[0]?.inputSchema.properties)).toBe(true)

      const invalid = yield* materialized.settle({
        ...identity,
        call: { type: "tool-call", id: "call-invalid", name: "dynamic", input: { value: 1 } },
      })
      expect(invalid.result).toEqual({ type: "error", value: "value must be a string" })
      expect(seen).toEqual([])

      const valid = yield* materialized.settle({
        ...identity,
        call: { type: "tool-call", id: "call-valid", name: "dynamic", input: { value: " abc " } },
      })
      expect(seen).toEqual([{ value: "abc" }])
      expect(valid).toMatchObject({
        result: {
          type: "content",
          value: [
            { type: "text", text: "3" },
            { type: "file", uri: "data:text/plain;base64,aGVsbG8=", mime: "text/plain", name: "size.txt" },
          ],
        },
        output: { structured: { size: 3 } },
      })
    }),
  )

  it.effect("turns adapter and output validation failures into tool failures while preserving defects", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const invalid = Tool.dynamic({
        description: "Invalid output",
        inputSchema: {},
        outputSchema: { type: "object" },
        decodeInput: Effect.succeed,
        encodeOutput: () => Effect.fail(new Tool.Failure({ message: "invalid dynamic output" })),
        execute: () => Effect.succeed({ nope: true }),
      })
      const defect = Tool.dynamic({
        description: "Defect",
        inputSchema: {},
        outputSchema: {},
        decodeInput: Effect.succeed,
        encodeOutput: Effect.succeed,
        execute: () => Effect.die("dynamic defect"),
      })
      const materialized = yield* registry.materialize([], {}, { tools: [{ invalid, defect }] })

      expect(
        (yield* materialized.settle({
          ...identity,
          call: { type: "tool-call", id: "call-output", name: "invalid", input: {} },
        })).result,
      ).toEqual({ type: "error", value: "invalid dynamic output" })
      const exit = yield* Effect.exit(
        materialized.settle({
          ...identity,
          call: { type: "tool-call", id: "call-defect", name: "defect", input: {} },
        }),
      )
      expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain("dynamic defect")
    }),
  )

  it.effect("rejects malformed canonical text and file output before bounding", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const malformed = (content: unknown) =>
        Tool.dynamic({
          description: "Malformed canonical output",
          inputSchema: {},
          outputSchema: {},
          decodeInput: Effect.succeed,
          encodeOutput: Effect.succeed,
          execute: () => Effect.succeed({ ok: true }),
          toModelOutput: () => content as ReadonlyArray<Tool.Content>,
        })
      const materialized = yield* registry.materialize(
        [],
        {},
        {
          tools: {
            canonical: malformed({ type: "text", text: "not an array" }),
            entry: malformed([null]),
            text: malformed([{ type: "text", text: 1 }]),
            file: malformed([{ type: "file", data: 1, mime: undefined }]),
          },
        },
      )

      for (const name of ["canonical", "entry", "text", "file"]) {
        const result = yield* materialized.settle({
          ...identity,
          call: { type: "tool-call", id: `call-malformed-${name}`, name, input: {} },
        })
        expect(result.result).toMatchObject({
          type: "error",
          value: expect.stringContaining("Tool returned an invalid ToolOutput"),
        })
        expect(bounded).not.toContain(`call-malformed-${name}`)
      }
    }),
  )

  it.effect("preserves interruption and resists schema mutation from execution", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const started = yield* Deferred.make<void>()
      const input = { type: "object", properties: { stable: { const: true } } }
      const output = { type: "object", properties: { stable: { const: true } } }
      let advertised: object | undefined
      const interrupt = Tool.dynamic({
        description: "Interruptible",
        inputSchema: input,
        outputSchema: output,
        decodeInput: Effect.succeed,
        encodeOutput: Effect.succeed,
        execute: () => Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)),
      })
      const mutate = Tool.dynamic({
        description: "Mutate schemas",
        inputSchema: input,
        outputSchema: output,
        decodeInput: Effect.succeed,
        encodeOutput: Effect.succeed,
        execute: () =>
          Effect.sync(() => {
            input.properties.stable.const = false
            output.properties.stable.const = false
            if (advertised) Reflect.set(advertised, "mutated", true)
            return { stable: true }
          }),
      })
      const materialized = yield* registry.materialize([], {}, { tools: { interrupt, mutate } })
      advertised = materialized.definitions.find((item) => item.name === "mutate")!.inputSchema

      const fiber = yield* materialized
        .settle({
          ...identity,
          call: { type: "tool-call", id: "call-interrupt", name: "interrupt", input: {} },
        })
        .pipe(Effect.forkChild)
      yield* Deferred.await(started)
      yield* Fiber.interrupt(fiber)
      const exit = yield* Fiber.await(fiber)
      expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
      expect(bounded).not.toContain("call-interrupt")

      yield* materialized.settle({
        ...identity,
        call: { type: "tool-call", id: "call-mutate", name: "mutate", input: {} },
      })
      expect(materialized.definitions.find((item) => item.name === "mutate")).toMatchObject({
        inputSchema: { properties: { stable: { const: true } } },
        outputSchema: { properties: { stable: { const: true } } },
      })
      const later = yield* registry.materialize([], {}, { tools: { mutate } })
      expect(later.definitions[0]).toMatchObject({
        inputSchema: { properties: { stable: { const: true } } },
        outputSchema: { properties: { stable: { const: true } } },
      })
    }),
  )

  test("rejects non-JSON schemas at construction", () => {
    expect(() =>
      Tool.dynamic({
        description: "Invalid schema",
        inputSchema: { type: "object", invalid: undefined },
        outputSchema: {},
        decodeInput: Effect.succeed,
        encodeOutput: Effect.succeed,
        execute: Effect.succeed,
      }),
    ).toThrow("inputSchema must be a JSON Schema object")
  })
})
