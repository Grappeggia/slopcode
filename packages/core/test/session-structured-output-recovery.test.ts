import { describe, expect } from "bun:test"
import { Effect, Layer, Schema, Scope } from "effect"
import { ApplicationTools } from "@slopcode-ai/core/tool/application-tools"
import { Tool } from "@slopcode-ai/core/tool/tool"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { ToolOutputStore } from "@slopcode-ai/core/tool-output-store"
import { testEffect } from "./lib/effect"

const output = Layer.mock(ToolOutputStore.Service, {
  bound: (input) => Effect.succeed({ output: input.output, outputPaths: [] }),
})
const layer = ToolRegistry.layer.pipe(Layer.provide(ApplicationTools.layer), Layer.provide(output))
const it = testEffect(layer)
const ordinary = Tool.make({
  description: "ordinary",
  input: Schema.Struct({}),
  output: Schema.Struct({}),
  execute: () => Effect.succeed({}),
})

describe("structured final tool reservation", () => {
  it.effect("rejects persistent and ordinary overlay collisions", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const scope = yield* Scope.make()
      expect((yield* registry.register({ final_output: ordinary }).pipe(Scope.provide(scope), Effect.flip)).name).toBe(
        "final_output",
      )
      expect(
        (
          yield* registry
            .materialize([], {}, { tools: { final_output: ordinary } })
            .pipe(Effect.flip)
        ).name,
      ).toBe("final_output")
    }),
  )
})
