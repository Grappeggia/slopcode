import { describe, expect } from "bun:test"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { SessionMessage } from "@slopcode-ai/core/session/message"
import { SessionV2 } from "@slopcode-ai/core/session"
import { Tool } from "@slopcode-ai/core/tool/tool"
import { ToolOutputStore } from "@slopcode-ai/core/tool-output-store"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { ApplicationTools } from "@slopcode-ai/core/tool/application-tools"
import { Cause, Deferred, Effect, Exit, Fiber, Layer, Ref, Schema, Scope } from "effect"
import * as TestClock from "effect/testing/TestClock"
import { testEffect } from "./lib/effect"

const outputStore = Layer.mock(ToolOutputStore.Service, {
  limits: () => Effect.succeed({ maxLines: 2_000, maxBytes: 50 * 1024 }),
  bound: (input) =>
    Effect.succeed({
      output: input.output,
      outputPaths: input.output.content.some((item) => item.type === "file") ? ["/managed/media"] : [],
    }),
  cleanup: () => Effect.void,
})
const layer = ToolRegistry.layer.pipe(Layer.provide(ApplicationTools.layer), Layer.provide(outputStore))
const it = testEffect(layer)
const sessionID = SessionV2.ID.make("ses_codemode")
const identity = {
  sessionID,
  agent: AgentV2.ID.make("build"),
  assistantMessageID: SessionMessage.ID.make("msg_codemode"),
}
const call = (source: unknown, id = "call-exec"): ToolRegistry.ExecuteInput => ({
  ...identity,
  call: { type: "tool-call", toolType: "custom", id, name: "exec", input: source } as ToolRegistry.ExecuteInput["call"],
})
const echo = (run: (text: string, context: Tool.Context) => Effect.Effect<{ text: string }, Tool.Failure> = (text) =>
  Effect.succeed({ text })) =>
  Tool.make({
    description: "Echo supplied text",
    input: Schema.Struct({ text: Schema.String }),
    output: Schema.Struct({ text: Schema.String }),
    execute: ({ text }, context) => run(text, context),
  })

describe("ToolRegistry CodeMode materialization", () => {
  it.effect("preserves function mode and exposes the requested code-mode plans", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      yield* registry.register({ echo: echo() })

      const functions = yield* registry.materialize()
      const only = yield* registry.materialize([], { mode: "code-only" })
      const preferred = yield* registry.materialize([], { mode: "code-preferred" })

      expect(functions.definitions.map((tool) => tool.name)).toEqual(["echo"])
      expect(only.definitions).toHaveLength(1)
      expect(only.definitions[0]).toMatchObject({
        type: "custom",
        name: "exec",
        format: {
          type: "grammar",
          syntax: "lark",
          definition: String.raw`
start: pragma_source | plain_source
pragma_source: PRAGMA_LINE NEWLINE SOURCE
plain_source: SOURCE

PRAGMA_LINE: /[ \t]*\/\/ @exec:[^\r\n]*/
NEWLINE: /\r?\n/
SOURCE: /[\s\S]+/
`,
        },
      })
      expect(only.definitions[0]?.description).toContain("echo (1 tool, none shown)")
      expect(preferred.definitions.map((tool) => tool.name)).toEqual(["exec", "echo"])
    }),
  )

  it.live("runs search and sequential or parallel nested calls with deterministic IDs", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const ids: string[] = []
      const active = yield* Ref.make(0)
      const peak = yield* Ref.make(0)
      yield* registry.register({
        echo: echo((text, context) =>
          Effect.gen(function* () {
            ids.push(context.toolCallID)
            const count = yield* Ref.updateAndGet(active, (value) => value + 1)
            yield* Ref.update(peak, (value) => Math.max(value, count))
            yield* Effect.sleep("10 millis")
            yield* Ref.update(active, (value) => value - 1)
            return { text }
          }),
        ),
      })
      const materialized = yield* registry.materialize([], { mode: "code-only" })

      const search = yield* materialized.settle(
        call('return await tools.$codemode.search({ query: "echo" })', "call-search"),
      )
      expect(search.output?.structured).toMatchObject({
        ok: true,
        value: { total: 1, items: [{ path: "tools.echo" }] },
      })

      const sequential = yield* materialized.settle(
        call('const a = await tools.echo({ text: "a" }); const b = await tools.echo({ text: "b" }); return [a, b]', "call-sequential"),
      )
      expect(sequential.output?.structured).toMatchObject({
        ok: true,
        value: [{ text: "a" }, { text: "b" }],
      })
      expect(yield* Ref.get(peak)).toBe(1)

      yield* Ref.set(peak, 0)
      const parallel = yield* materialized.settle(
        call(
          'return await Promise.all([tools.echo({ text: "c" }), tools.echo({ text: "d" })])',
          "call-parallel",
        ),
      )
      expect(parallel.output?.structured).toMatchObject({
        ok: true,
        value: [{ text: "c" }, { text: "d" }],
      })
      expect(yield* Ref.get(peak)).toBe(2)
      expect(ids).toEqual([
        "call-sequential:codemode:0",
        "call-sequential:codemode:1",
        "call-parallel:codemode:0",
        "call-parallel:codemode:1",
      ])
    }),
  )

  it.effect("keeps denial, stale registration, recursion, and raw-input failures model-safe", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const scope = yield* Scope.make()
      yield* registry
        .register({
          denied: Tool.make({
            description: "Always denied",
            input: Schema.Struct({}),
            output: Schema.Struct({ ok: Schema.Boolean }),
            execute: () => Effect.fail(new Tool.Failure({ message: "Permission denied" })),
          }),
          hidden: Tool.withPermission(echo(), "hidden"),
          echo: echo(),
        })
        .pipe(Scope.provide(scope))
      const materialized = yield* registry.materialize([], { mode: "code-only" })

      expect((yield* materialized.settle(call({ code: "not raw" }))).result).toEqual({
        type: "error",
        value: "Invalid exec input: expected raw source text",
      })
      expect((yield* materialized.settle(call("return await tools.denied({})"))).output?.structured).toMatchObject({
        ok: false,
        error: { kind: "ToolFailure", message: "Permission denied" },
      })
      expect((yield* materialized.settle(call("return await tools.exec({})"))).output?.structured).toMatchObject({
        ok: false,
        error: { kind: "UnknownTool" },
      })
      const filtered = yield* registry.materialize([{ action: "hidden", resource: "*", effect: "deny" }], {
        mode: "code-only",
      })
      expect(filtered.definitions[0]?.description).not.toContain("tools.hidden")
      expect(
        (yield* filtered.settle(call("return await tools.hidden({ text: 'secret' })"))).output?.structured,
      ).toMatchObject({ ok: false, error: { kind: "UnknownTool" } })

      yield* Scope.close(scope, Exit.void)
      yield* registry.register({ echo: echo() })
      expect(
        (yield* materialized.settle(call('return await tools.echo({ text: "stale" })'))).output?.structured,
      ).toMatchObject({ ok: false, error: { kind: "ToolFailure", message: "Stale tool call: echo" } })
    }),
  )

  it.effect("enforces product limits and publishes bounded input-free progress", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const progress: ToolRegistry.ChildProgress[] = []
      const parents: string[] = []
      yield* registry.register({
        echo: echo(),
        never: Tool.make({
          description: "Never settles",
          input: Schema.Struct({}),
          output: Schema.Struct({}),
          execute: () => Effect.never,
        }),
      })
      const materialized = yield* registry.materialize([], {
        mode: "code-only",
        progress: (input, event) =>
          Effect.sync(() => {
            parents.push(input.call.id)
            progress.push(event)
          }),
      })

      const calls = Array.from({ length: 65 }, (_, index) => `await tools.echo({ text: "${index}" });`).join("\n")
      expect((yield* materialized.settle(call(calls))).output?.structured).toMatchObject({
        ok: false,
        error: { kind: "ToolCallLimitExceeded" },
      })
      expect(progress).toHaveLength(128)
      expect(progress.at(-1)).toEqual({
        started: 64,
        settled: 64,
        latest: { name: "echo", outcome: "success" },
      })
      expect(progress.every((event) => Object.keys(event.latest).toSorted().join(",") === "name,outcome")).toBe(true)
      expect(new Set(parents)).toEqual(new Set(["call-exec"]))

      const bounded = yield* materialized.settle(call('return "x".repeat(70000)', "call-output-limit"))
      expect(bounded.output?.structured).toMatchObject({ ok: true, truncated: true })

      const timeout = yield* materialized
        .settle(call("return await tools.never({})", "call-timeout"))
        .pipe(Effect.forkChild)
      yield* Effect.yieldNow
      yield* TestClock.adjust("60 seconds")
      expect((yield* Fiber.join(timeout)).output?.structured).toMatchObject({
        ok: false,
        error: { kind: "TimeoutExceeded", message: "Execution timed out after 60000ms." },
      })
    }),
  )

  it.effect("maps patch and shell projections and aggregates media outside the sandbox", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const inputs: unknown[] = []
      yield* registry.register({
        apply_patch: Tool.make({
          description: "Apply a patch",
          input: Schema.Struct({ patchText: Schema.String }),
          output: Schema.Struct({ applied: Schema.Boolean }),
          execute: (input) => Effect.sync(() => inputs.push(input)).pipe(Effect.as({ applied: true })),
        }),
        bash: Tool.make({
          description: "Run a shell command",
          input: Schema.Struct({ command: Schema.String }),
          output: Schema.Struct({ stdout: Schema.String }),
          execute: (input) => Effect.sync(() => inputs.push(input)).pipe(Effect.as({ stdout: input.command })),
        }),
        image: Tool.make({
          description: "Read an image",
          input: Schema.Struct({}),
          output: Schema.Struct({ kind: Schema.String }),
          execute: () => Effect.succeed({ kind: "image" }),
          toModelOutput: () => [
            { type: "text", text: "image" },
            { type: "file", data: "aGVsbG8=", mime: "image/png", name: "pixel.png" },
          ],
        }),
      })
      const materialized = yield* registry.materialize([], {
        mode: "code-only",
        patch: "freeform",
        shell: "shell_command",
      })

      const settled = yield* materialized.settle(
        call(
          'const patch = await tools.apply_patch("*** Begin Patch\\n*** End Patch"); const shell = await tools.shell_command({ command: "pwd" }); const image = await tools.image({}); return { patch, shell, image }',
        ),
      )
      expect(inputs).toEqual([{ patchText: "*** Begin Patch\n*** End Patch" }, { command: "pwd" }])
      expect(settled.output?.structured).toMatchObject({
        ok: true,
        value: { patch: { applied: true }, shell: { stdout: "pwd" }, image: { kind: "image" } },
        toolCalls: [{ name: "apply_patch" }, { name: "bash" }, { name: "image" }],
      })
      expect(settled.output?.content.filter((item) => item.type === "file")).toEqual([
        { type: "file", uri: "data:image/png;base64,aGVsbG8=", mime: "image/png", name: "pixel.png" },
      ])
      expect(settled.outputPaths).toEqual(["/managed/media"])
      expect(JSON.stringify(settled.output?.structured)).not.toContain("/managed/media")
    }),
  )

  it.effect("propagates interruption and serializes concurrent outer exec calls", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const started = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const order: string[] = []
      yield* registry.register({
        wait: Tool.make({
          description: "Wait",
          input: Schema.Struct({ name: Schema.String }),
          output: Schema.Struct({ name: Schema.String }),
          execute: ({ name }) =>
            name === "interrupt"
              ? Effect.never
              :
            Effect.sync(() => order.push(`start:${name}`)).pipe(
              Effect.andThen(name === "first" ? Deferred.succeed(started, undefined) : Effect.void),
              Effect.andThen(Deferred.await(release)),
              Effect.andThen(Effect.sync(() => order.push(`end:${name}`))),
              Effect.as({ name }),
            ),
        }),
      })
      const materialized = yield* registry.materialize([], { mode: "code-only" })
      const first = yield* materialized
        .settle(call('return await tools.wait({ name: "first" })', "call-first"))
        .pipe(Effect.forkChild)
      yield* Deferred.await(started)
      const second = yield* materialized
        .settle(call('return await tools.wait({ name: "second" })', "call-second"))
        .pipe(Effect.forkChild)
      yield* Effect.yieldNow
      expect(order).toEqual(["start:first"])
      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(first)
      yield* Fiber.join(second)
      expect(order).toEqual(["start:first", "end:first", "start:second", "end:second"])

      const never = yield* materialized
        .settle(call('return await tools.wait({ name: "interrupt" })', "call-interrupt"))
        .pipe(Effect.forkChild)
      yield* Fiber.interrupt(never)
      const exit = yield* Fiber.await(never)
      expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
    }),
  )
})
