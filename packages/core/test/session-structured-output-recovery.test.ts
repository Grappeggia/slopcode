import { describe, expect } from "bun:test"
import { Effect, Exit, Layer, Schema, Scope } from "effect"
import { ApplicationTools } from "@slopcode-ai/core/tool/application-tools"
import { Tool } from "@slopcode-ai/core/tool/tool"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { ToolOutputStore } from "@slopcode-ai/core/tool-output-store"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionMessage } from "@slopcode-ai/core/session/message"
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

  it.effect("keeps final_output direct and unavailable to nested CodeMode", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const materialized = yield* registry.materialize(
        [],
        { mode: "code-only" },
        {
          tools: {},
          direct: new Set(["final_output"]),
          final: {
            schema: { type: "object" },
            fingerprint: "contract",
            settle: (value) => Effect.succeed({ type: "success", value }),
          },
        },
      )
      expect(materialized.definitions.map((tool) => [tool.name, "type" in tool ? tool.type : "function"])).toEqual([
        ["exec", "custom"],
        ["final_output", "function"],
      ])
      const identity = {
        sessionID: SessionV2.ID.make("ses_structured_registry"),
        agent: AgentV2.ID.make("build"),
        assistantMessageID: SessionMessage.ID.make("msg_structured_registry"),
      }
      const nested = yield* materialized.settle({
        ...identity,
        call: {
          type: "tool-call",
          toolType: "custom",
          id: "exec-1",
          name: "exec",
          input: "return await tools.final_output({ answer: 1 })",
        },
      })
      expect(nested.output?.structured).toMatchObject({ ok: false, error: { kind: "UnknownTool" } })
      expect(
        yield* materialized.settle({
          ...identity,
          call: { type: "tool-call", id: "final-1", name: "final_output", input: { answer: 1 } },
        }),
      ).toMatchObject({ final: { type: "success", value: { answer: 1 } } })
    }),
  )

  it.effect("does not let public ToolRegistry consumers forge the reserved final capability", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const forged = yield* registry
        .materialize(
          [],
          {},
          {
            tools: {},
            final: {
              schema: { type: "object" },
              fingerprint: "forged",
              settle: () => Effect.succeed({ type: "success" as const, value: "forged" }),
            },
          },
        )
        .pipe(Effect.exit)
      expect(Exit.isFailure(forged)).toBe(true)
    }),
  )
})
