import { describe, expect } from "bun:test"
import { Effect, Exit, Layer, Schema, Scope } from "effect"
import { ApplicationTools } from "@slopcode-ai/core/tool/application-tools"
import { Tool } from "@slopcode-ai/core/tool/tool"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { ToolOutputStore } from "@slopcode-ai/core/tool-output-store"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionFormat } from "@slopcode-ai/core/session/format"
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
        { tools: {} },
      )
      expect(materialized.definitions.map((tool) => [tool.name, "type" in tool ? tool.type : "function"])).toEqual([
        ["exec", "custom"],
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
      ).toMatchObject({ result: { type: "error", value: "Unknown tool: final_output" } })
    }),
  )

  it.effect("does not let public ToolRegistry consumers forge the reserved final capability", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const final = {
        schema: { type: "object" },
        fingerprint: "forged",
        settle: () => Effect.succeed({ type: "success" as const, value: "forged" }),
      }
      const forged: ToolRegistry.TurnTools = {
        tools: {},
        // @ts-expect-error final is intentionally absent from the public turn-local capability.
        final,
      }
      const materialized = yield* registry.materialize([], {}, forged)
      expect(materialized.definitions.map((item) => item.name)).not.toContain("final_output")
    }),
  )

  it.effect("materializes and settles final_output only through the scoped runner capability", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.StructuredService
      const format = yield* SessionFormat.admit({
        type: "json_schema",
        schema: { type: "object", properties: { answer: { type: "number" } }, required: ["answer"] },
        retry_count: 0,
      })
      if (format.type !== "json_schema") return yield* Effect.die("expected JSON format")
      const scope = yield* Scope.make()
      const materialized = yield* registry.materialize([], { mode: "code-only" }, format).pipe(Scope.provide(scope))
      const identity = {
        sessionID: SessionV2.ID.make("ses_structured_private"),
        agent: AgentV2.ID.make("build"),
        assistantMessageID: SessionMessage.ID.make("msg_structured_private"),
      }

      expect(materialized.definitions.map((item) => item.name)).toEqual(["exec", "final_output"])
      expect(
        yield* materialized.settle({
          ...identity,
          call: { type: "tool-call", id: "final-valid", name: "final_output", input: { value: { answer: 42 } } },
        }),
      ).toMatchObject({ final: { type: "success", value: { answer: 42 } } })
      expect(
        yield* materialized.settle({
          ...identity,
          call: { type: "tool-input-error", id: "final-bad", name: "final_output", reason: "invalid-json" },
        }),
      ).toMatchObject({ final: { type: "invalid", reason: "invalid-json" } })

      yield* Scope.close(scope, Exit.void)
      expect(
        yield* materialized.settle({
          ...identity,
          call: { type: "tool-call", id: "final-stale", name: "final_output", input: { value: { answer: 7 } } },
        }),
      ).toMatchObject({ final: { type: "stale" } })
    }),
  )
})
