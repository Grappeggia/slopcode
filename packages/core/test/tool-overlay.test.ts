import { describe, expect } from "bun:test"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { ApplicationTools } from "@slopcode-ai/core/tool/application-tools"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { Tool } from "@slopcode-ai/core/tool/tool"
import { ToolOutputStore } from "@slopcode-ai/core/tool-output-store"
import { Effect, Layer, Schema, Scope } from "effect"
import { testEffect } from "./lib/effect"

const bounded: string[] = []
const outputStore = Layer.mock(ToolOutputStore.Service, {
  limits: () => Effect.succeed({ maxLines: 2_000, maxBytes: 50 * 1024 }),
  bound: (input) => Effect.sync(() => bounded.push(input.toolCallID)).pipe(Effect.as({ output: input.output, outputPaths: [] })),
  cleanup: () => Effect.void,
})
const registry = ToolRegistry.layer.pipe(Layer.provide(ApplicationTools.layer), Layer.provide(outputStore))
const layer = Layer.mergeAll(ApplicationTools.layer, registry)
const it = testEffect(layer)
const identity = {
  sessionID: SessionV2.ID.make("ses_overlay_tool"),
  agent: AgentV2.ID.make("build"),
  assistantMessageID: SessionMessage.ID.make("msg_overlay_tool"),
}
const tool = (value: string) =>
  Tool.make({
    description: value,
    input: Schema.Struct({}),
    output: Schema.Struct({ value: Schema.String }),
    execute: () => Effect.succeed({ value }),
  })
const settle = (materialized: ToolRegistry.Materialization, name: string, id = `call-${name}`) =>
  materialized.settle({ ...identity, call: { type: "tool-call", id, name, input: {} } })

describe("ToolRegistry turn-local overlays", () => {
  it.effect("isolates overrides, captures identity, validates names, and rejects duplicates", () =>
    Effect.gen(function* () {
      const applications = yield* ApplicationTools.Service
      const registry = yield* ToolRegistry.Service
      yield* applications.register({ shared: tool("application") })
      const scope = yield* Scope.make()
      yield* registry.register({ shared: tool("location") }).pipe(Scope.provide(scope))

      const overlay = yield* registry.materialize([], {}, { tools: [{ shared: tool("overlay"), local: tool("local") }] })
      const ordinary = yield* registry.materialize()
      expect(overlay.definitions.map((item) => item.name)).toEqual(["shared", "local"])
      expect(ordinary.definitions.map((item) => item.description)).toEqual(["location"])
      expect((yield* settle(overlay, "shared")).output?.structured).toEqual({ value: "overlay" })
      expect((yield* settle(ordinary, "shared")).output?.structured).toEqual({ value: "location" })

      yield* registry.register({ shared: tool("later") })
      expect((yield* settle(overlay, "shared", "call-captured")).output?.structured).toEqual({ value: "overlay" })
      expect((yield* settle(overlay, "local")).output?.structured).toEqual({ value: "local" })
      expect(bounded).toContain("call-local")

      expect(
        yield* Effect.flip(registry.materialize([], {}, { tools: [{ duplicate: tool("a") }, { duplicate: tool("b") }] })),
      ).toBeInstanceOf(Tool.RegistrationError)
      expect(
        yield* Effect.flip(registry.materialize([], {}, { tools: [{ "invalid name": tool("bad") }] })),
      ).toBeInstanceOf(Tool.RegistrationError)
    }),
  )

  it.effect("applies permission aliases and deeply captures permission rules", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const rules = [{ action: "alias", resource: "*", effect: "deny" as const }]
      const materialized = yield* registry.materialize(rules, {}, {
        tools: [{ hidden: Tool.withPermission(tool("hidden"), "alias"), visible: tool("visible") }],
      })
      rules[0]!.effect = "allow" as "deny"
      expect(materialized.definitions.map((item) => item.name)).toEqual(["visible"])
      expect(materialized.permissions).toEqual([{ action: "alias", resource: "*", effect: "deny" }])
      expect(Object.isFrozen(materialized.permissions)).toBe(true)
      expect(Object.isFrozen(materialized.permissions[0])).toBe(true)
      expect((yield* settle(materialized, "hidden")).result).toEqual({ type: "error", value: "Unknown tool: hidden" })
    }),
  )

  it.effect("projects direct overlays once and excludes them from nested execution", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      yield* registry.register({ persistent: tool("persistent") })
      const turn = { tools: [{ nested: tool("nested"), direct: tool("direct") }], direct: new Set(["direct"]) }
      const functions = yield* registry.materialize([], { mode: "function" }, turn)
      const preferred = yield* registry.materialize([], { mode: "code-preferred" }, turn)
      const only = yield* registry.materialize([], { mode: "code-only" }, turn)

      expect(functions.definitions.map((item) => item.name)).toEqual(["persistent", "nested", "direct"])
      expect(preferred.definitions.map((item) => item.name)).toEqual(["exec", "persistent", "nested", "direct"])
      expect(only.definitions.map((item) => item.name)).toEqual(["exec", "direct"])
      expect(preferred.definitions.filter((item) => item.name === "direct")).toHaveLength(1)
      expect(preferred.definitions[0]?.description).toContain("- nested")
      expect(preferred.definitions[0]?.description).not.toContain("- direct")

      expect((yield* settle(only, "direct")).output?.structured).toEqual({ value: "direct" })
      expect(
        (
          yield* only.settle({
            ...identity,
            call: {
              type: "tool-call",
              toolType: "custom",
              id: "call-exec-nested",
              name: "exec",
              input: "return await tools.nested({})",
            },
          })
        ).output?.structured,
      ).toMatchObject({ ok: true, value: { value: "nested" } })
      expect(
        (
          yield* only.settle({
            ...identity,
            call: {
              type: "tool-call",
              toolType: "custom",
              id: "call-exec-direct",
              name: "exec",
              input: "return await tools.direct({})",
            },
          })
        ).output?.structured,
      ).toMatchObject({ ok: false, error: { kind: "UnknownTool" } })
    }),
  )

  it.effect("fails closed on overlay and direct exec collisions in code modes", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const turn = { tools: { exec: tool("overlay exec") } }
      const direct = { ...turn, direct: new Set(["exec"]) }

      const functions = yield* registry.materialize([], { mode: "function" }, turn)
      const directFunctions = yield* registry.materialize([], { mode: "function" }, direct)
      expect(functions.definitions.map((item) => item.name)).toEqual(["exec"])
      expect(directFunctions.definitions.map((item) => item.name)).toEqual(["exec"])
      expect((yield* settle(functions, "exec")).output?.structured).toEqual({ value: "overlay exec" })

      for (const mode of ["code-preferred", "code-only"] as const) {
        for (const collision of [turn, direct]) {
          const failure = yield* Effect.flip(registry.materialize([], { mode }, collision))
          expect(failure).toBeInstanceOf(Tool.RegistrationError)
          expect(failure).toMatchObject({ name: "exec", message: expect.stringContaining("reserved") })
        }
      }

      yield* registry.register({ exec: tool("persistent exec") })
      const preferred = yield* registry.materialize([], { mode: "code-preferred" })
      const only = yield* registry.materialize([], { mode: "code-only" })
      expect(preferred.definitions.map((item) => item.name)).toEqual(["exec"])
      expect(only.definitions.map((item) => item.name)).toEqual(["exec"])
      expect(new Set(preferred.definitions.map((item) => item.name)).size).toBe(preferred.definitions.length)
      expect(new Set(only.definitions.map((item) => item.name)).size).toBe(only.definitions.length)

      const directPersistent = yield* Effect.flip(
        registry.materialize([], { mode: "code-only" }, { tools: {}, direct: new Set(["exec"]) }),
      )
      expect(directPersistent).toBeInstanceOf(Tool.RegistrationError)
      expect(directPersistent).toMatchObject({ name: "exec", message: expect.stringContaining("reserved") })
    }),
  )

  it.effect("preserves shell and freeform patch aliases for dynamic overlays", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const inputs: unknown[] = []
      const dynamic = (description: string, inputSchema: Record<string, unknown>) =>
        Tool.dynamic({
          description,
          inputSchema,
          outputSchema: { type: "object" },
          decodeInput: (input) => Effect.succeed(input),
          encodeOutput: Effect.succeed,
          execute: (input) => Effect.sync(() => inputs.push(input)).pipe(Effect.as({ ok: true })),
        })
      const materialized = yield* registry.materialize(
        [],
        { mode: "code-only", shell: "shell_command", patch: "freeform" },
        {
          tools: {
            bash: dynamic("Run shell", {
              type: "object",
              properties: { command: { type: "string" } },
              required: ["command"],
            }),
            apply_patch: dynamic("Apply patch", { type: "object" }),
          },
        },
      )

      const result = yield* materialized.settle({
        ...identity,
        call: {
          type: "tool-call",
          toolType: "custom",
          id: "call-dynamic-aliases",
          name: "exec",
          input:
            'const shell = await tools.shell_command({ command: "pwd" }); const patch = await tools.apply_patch("*** Begin Patch\\n*** End Patch"); return { shell, patch }',
        },
      })
      expect(inputs).toEqual([{ command: "pwd" }, { patchText: "*** Begin Patch\n*** End Patch" }])
      expect(result.output?.structured).toMatchObject({
        ok: true,
        value: { shell: { ok: true }, patch: { ok: true } },
        toolCalls: [{ name: "bash" }, { name: "apply_patch" }],
      })
      expect(bounded).toEqual(expect.arrayContaining(["call-dynamic-aliases/0", "call-dynamic-aliases/1", "call-dynamic-aliases"]))
    }),
  )
})
