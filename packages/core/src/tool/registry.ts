export * as ToolRegistry from "./registry"

import {
  CodeMode,
  Tool as CodeModeTool,
  toolError,
  type JsonSchema as CodeModeJsonSchema,
  type ToolDefinition as CodeModeToolDefinition,
} from "@slopcode-ai/codemode"
import {
  CustomToolDefinition,
  ToolOutput,
  type AnyToolDefinition,
  type ToolCall,
  type ToolResultValue,
} from "@slopcode-ai/llm"
import { Context, Effect, Layer, Scope, Semaphore } from "effect"
import { AgentV2 } from "../agent"
import { PermissionV2 } from "../permission"
import { SessionMessage } from "../session/message"
import { SessionSchema } from "../session/schema"
import type { SessionEvent } from "../session/event"
import { ToolOutputStore } from "../tool-output-store"
import { Wildcard } from "../util/wildcard"
import { ApplicationTools } from "./application-tools"
import {
  definition,
  permission,
  settle,
  validateName,
  RegistrationError,
  type AnyTool,
  type Context as ToolContext,
} from "./tool"
import { Tools, type RegistrationOptions } from "./tools"

export type ExecuteInput = {
  readonly sessionID: SessionSchema.ID
  readonly agent: AgentV2.ID
  readonly assistantMessageID: SessionMessage.ID
  readonly call: ToolCall
  readonly task?: SessionEvent.Task.Requested["data"]
  readonly prepared?: SessionEvent.Task.Prepared["data"]
}

export interface Interface {
  readonly materialize: {
    (permissions?: PermissionV2.Ruleset, plan?: ToolPlan): Effect.Effect<Materialization>
    (permissions: PermissionV2.Ruleset, plan: ToolPlan, turn: TurnTools): Effect.Effect<Materialization, RegistrationError>
  }
  /** Internal registration capability exposed publicly only through Tools.Service. */
  readonly register: (
    tools: Readonly<Record<string, AnyTool>>,
    options?: RegistrationOptions,
  ) => Effect.Effect<void, RegistrationError, Scope.Scope>
}

export interface Materialization {
  readonly definitions: ReadonlyArray<AnyToolDefinition>
  readonly permissions: PermissionV2.Ruleset
  readonly settle: (input: ExecuteInput) => Effect.Effect<Settlement, ToolOutputStore.Error>
}

export interface ChildProgress {
  readonly started: number
  readonly settled: number
  readonly latest: {
    readonly name: string
    readonly outcome: "started" | "success" | "failure"
  }
}

export interface ToolPlan {
  readonly mode?: "function" | "code-preferred" | "code-only"
  readonly shell?: "shell_command"
  readonly patch?: "freeform"
  readonly multiAgent?: "v1" | "v2"
  readonly progress?: (input: ExecuteInput, progress: ChildProgress) => Effect.Effect<void>
}

export interface TurnTools {
  /** Ordered records permit adapters to compose overlays while detecting duplicate names. */
  readonly tools: Readonly<Record<string, AnyTool>> | ReadonlyArray<Readonly<Record<string, AnyTool>>>
  readonly direct?: ReadonlySet<string>
}

export interface Settlement {
  readonly result: ToolResultValue
  readonly output?: ToolOutput
  readonly outputPaths?: ReadonlyArray<string>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/ToolRegistry") {}

export const FINAL_OUTPUT = "final_output"

const registryLayer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const applications = yield* ApplicationTools.Service
    const resources = yield* ToolOutputStore.Service
    type Registration = { readonly identity: object; readonly tool: AnyTool }
    type Captured = { readonly registration: Registration; readonly overlay: boolean }
    type Local = {
      readonly slot: object
      readonly token: object
      readonly registration: Registration
      readonly visible: () => boolean
    }
    const local = new Map<string, Local[]>()
    const order = new Map<object, number>()
    const active = new Map<object, Set<object>>()
    let sequence = 0
    const visible = (name: string) => local.get(name)?.findLast((entry) => entry.visible())?.registration

    const settleWith = Effect.fn("ToolRegistry.settle")(function* (
      input: ExecuteInput,
      registration: Registration,
      plan: ToolPlan = {},
      permissions: PermissionV2.Ruleset = [],
    ) {
      const context = Object.defineProperties(
        {
          sessionID: input.sessionID,
          agent: input.agent,
          assistantMessageID: input.assistantMessageID,
          toolCallID: input.call.id,
          ...(plan.multiAgent === undefined ? {} : { multiAgent: plan.multiAgent }),
        },
        {
          permissions: { value: permissions },
          plan: {
            value: Object.freeze({
              mode: plan.mode,
              shell: plan.shell,
              patch: plan.patch,
              multiAgent: plan.multiAgent,
            }),
          },
          task: { value: input.task },
          prepared: { value: input.prepared },
        },
      ) as ToolContext
      const pending = yield* settle(registration.tool, input.call, context).pipe(
        Effect.map((output) => ({ output })),
        Effect.catchTag("LLM.ToolFailure", (failure) =>
          Effect.succeed({ result: { type: "error" as const, value: failure.message } }),
        ),
      )
      if ("result" in pending) return pending
      const output = pending.output
      const bounded = yield* resources.bound({ sessionID: input.sessionID, toolCallID: input.call.id, output })
      const result = ToolOutput.toResultValue(bounded.output)
      if (result.type === "error")
        return bounded.outputPaths.length > 0 ? { result, outputPaths: bounded.outputPaths } : { result }
      return bounded.outputPaths.length > 0
        ? { result, output: bounded.output, outputPaths: bounded.outputPaths }
        : { result, output: bounded.output }
    })

    return Service.of({
      register: Effect.fn("ToolRegistry.register")(function* (tools, options?: RegistrationOptions) {
        const entries = Object.entries(tools)
        yield* Effect.forEach(entries, ([name]) => validateName(name), { discard: true })
        if (entries.some(([name]) => name === FINAL_OUTPUT))
          return yield* new RegistrationError({
            name: FINAL_OUTPUT,
            message: `${FINAL_OUTPUT} is reserved for structured Session turns`,
          })
        yield* Effect.uninterruptible(
          Effect.gen(function* () {
            const token = {}
            const slot = options?.slot ?? {}
            if (!order.has(slot)) order.set(slot, sequence++)
            active.set(slot, new Set([...(active.get(slot) ?? []), token]))
            for (const [name, tool] of entries) {
              const registration = {
                slot,
                token,
                registration: { identity: {}, tool },
                visible: options?.visible ?? (() => true),
              }
              const existing = local.get(name) ?? []
              const registrations = [...existing, registration]
              registrations.sort((left, right) => order.get(left.slot)! - order.get(right.slot)!)
              local.set(name, registrations)
            }
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                for (const [name] of entries) {
                  const registrations = local.get(name)?.filter((registration) => registration.token !== token) ?? []
                  if (registrations.length > 0) local.set(name, registrations)
                  else local.delete(name)
                }
                const tokens = active.get(slot)
                tokens?.delete(token)
                if (tokens?.size === 0) {
                  active.delete(slot)
                  order.delete(slot)
                }
              }),
            )
          }),
        )
      }),
      materialize: Effect.fn("ToolRegistry.materialize")(function* (
        permissions: PermissionV2.Ruleset = [],
        plan: ToolPlan = {},
        turn?: TurnTools,
      ) {
        const rules = Object.freeze(permissions.map((rule) => Object.freeze({ ...rule })))
        const captured = Object.freeze({
          mode: plan.mode,
          shell: plan.shell,
          patch: plan.patch,
          multiAgent: plan.multiAgent,
          progress: plan.progress,
        })
        const registrations = new Map<string, Captured>(
          Array.from(applications.entries(), ([name, registration]) => [name, { registration, overlay: false }] as const),
        )
        for (const [name] of local) {
          const registration = visible(name)
          if (registration) registrations.set(name, { registration, overlay: false })
        }
        const groups: ReadonlyArray<Readonly<Record<string, AnyTool>>> = turn
          ? Array.isArray(turn.tools)
            ? turn.tools
            : [turn.tools as Readonly<Record<string, AnyTool>>]
          : []
        const overlays = groups.flatMap((tools) => Object.entries(tools))
        yield* Effect.forEach(overlays, ([name]) => validateName(name), { discard: true })
        if (overlays.some(([name]) => name === FINAL_OUTPUT))
          return yield* new RegistrationError({
            name: FINAL_OUTPUT,
            message: `${FINAL_OUTPUT} is reserved for structured Session turns`,
          })
        const names = new Set<string>()
        for (const [name, tool] of overlays) {
          if (names.has(name))
            return yield* Effect.fail(
              new RegistrationError({ name, message: `Duplicate turn-local tool name: ${name}` }),
            )
          names.add(name)
          registrations.set(name, { registration: { identity: {}, tool }, overlay: true })
        }
        const direct = new Set(turn?.direct ?? [])
        yield* Effect.forEach(direct, validateName, { discard: true })
        for (const name of direct)
          if (!registrations.has(name))
            return yield* Effect.fail(new RegistrationError({ name, message: `Unknown direct tool name: ${name}` }))
        const mode = captured.mode ?? "function"
        if (mode !== "function" && (names.has("exec") || direct.has("exec")))
          return yield* Effect.fail(
            new RegistrationError({ name: "exec", message: `Tool name is reserved in ${mode} mode: exec` }),
          )
        for (const [name, entry] of registrations)
          if (whollyDisabled(permission(entry.registration.tool, name), rules)) registrations.delete(name)
        const definitions = Object.freeze(
          Array.from(registrations, ([name, entry]) => definition(name, entry.registration.tool, rules)),
        )
        const settleMaterialized = (input: ExecuteInput): Effect.Effect<Settlement, ToolOutputStore.Error> => {
          const entry = registrations.get(input.call.name)
          if (entry?.overlay) return settleWith(input, entry.registration, captured, rules)
          if (entry) {
            const current = visible(input.call.name) ?? applications.entries().get(input.call.name)
            if (current?.identity !== entry.registration.identity)
              return Effect.succeed({ result: { type: "error" as const, value: `Stale tool call: ${input.call.name}` } })
            return settleWith(input, entry.registration, captured, rules)
          }
          return Effect.succeed({ result: { type: "error" as const, value: `Unknown tool: ${input.call.name}` } })
        }
        if (mode === "function") return { definitions, permissions: rules, settle: settleMaterialized }

        const catalog = Object.freeze(
          definitions
            .filter((item) => item.name !== "exec")
            .filter((item) => !direct.has(item.name))
            .filter((item) => !(captured.shell === "shell_command" && item.name === "shell_command"))
            .map((item) => ({
              name: captured.shell === "shell_command" && item.name === "bash" ? "shell_command" : item.name,
              target: item.name,
              description: item.description,
              input:
                captured.patch === "freeform" && item.name === "apply_patch"
                  ? ({ type: "string" } as const)
                  : (item.inputSchema as CodeModeJsonSchema),
              output: item.outputSchema as CodeModeJsonSchema | undefined,
            })),
        )
        const projected = new Map(catalog.map((item) => [item.name, item.target]))
        const codeTools = (
          run: (target: string, input: unknown, index: number) => Effect.Effect<unknown, unknown, never>,
        ): Record<string, CodeModeToolDefinition> =>
          Object.freeze(
            Object.fromEntries(
              catalog.map((item) => [
                item.name,
                CodeModeTool.make({
                  description: item.description,
                  input: item.input,
                  output: item.output,
                  run: (value, context) => {
                    if (!context) return Effect.die("CodeMode invocation context is required")
                    return run(
                      item.target,
                      captured.patch === "freeform" && item.target === "apply_patch" ? { patchText: value } : value,
                      context.index,
                    )
                  },
                }),
              ]),
            ),
          )
        const preview = CodeMode.make({
          tools: codeTools(() => Effect.die("CodeMode catalog preview cannot execute tools")),
          discovery: { maxInlineCatalogTokens: 0 },
        })
        const exec = new CustomToolDefinition({
          type: "custom",
          name: "exec",
          description: preview.instructions(),
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
        const serial = Semaphore.makeUnsafe(1).withPermit
        const settleExec = (input: ExecuteInput) => {
          if (typeof input.call.input !== "string")
            return Effect.succeed({
              result: { type: "error" as const, value: "Invalid exec input: expected raw source text" },
            })
          const source = input.call.input
          return serial(
            Effect.gen(function* () {
              const artifacts = new Map<
                number,
                { readonly content: ToolOutput["content"]; readonly outputPaths: ReadonlyArray<string> }
              >()
              let started = 0
              let settled = 0
              const progress = (event: ChildProgress) => captured.progress?.(input, event) ?? Effect.void
              const runtime = CodeMode.make({
                tools: codeTools((target, value, index) =>
                  settleMaterialized({
                    ...input,
                    call: {
                      type: "tool-call",
                      id: `${input.call.id}/${index}`,
                      name: target,
                      input: value,
                    },
                  }).pipe(
                    Effect.flatMap((result) => {
                      if (result.result.type === "error")
                        return Effect.fail(
                          toolError(
                            typeof result.result.value === "string"
                              ? result.result.value
                              : (JSON.stringify(result.result.value) ?? String(result.result.value)),
                          ),
                        )
                      artifacts.set(index, {
                        content: result.output?.content ?? [],
                        outputPaths: result.outputPaths ?? [],
                      })
                      return Effect.succeed(result.output?.structured ?? result.result.value)
                    }),
                  ),
                ),
                limits: { timeoutMs: 120_000, maxToolCalls: 64, maxOutputBytes: 1_048_576 },
                discovery: { maxInlineCatalogTokens: 0 },
                onToolCallStart: (call) => {
                  started++
                  return progress({
                    started,
                    settled,
                    latest: { name: projected.get(call.name) ?? call.name, outcome: "started" },
                  })
                },
                onToolCallEnd: (call) => {
                  settled++
                  return progress({
                    started,
                    settled,
                    latest: { name: projected.get(call.name) ?? call.name, outcome: call.outcome },
                  })
                },
              })
              const result = yield* runtime.execute(source)
              const audited = {
                ...result,
                toolCalls: result.toolCalls.map((call) => ({ name: projected.get(call.name) ?? call.name })),
              }
              const ordered = [...artifacts].sort(([left], [right]) => left - right).map(([, value]) => value)
              const content = ordered.flatMap((item) => item.content)
              const outputPaths = ordered.flatMap((item) => item.outputPaths)
              const output = {
                structured: audited,
                content:
                  content.length === 0 ? [] : [{ type: "text" as const, text: JSON.stringify(audited) }, ...content],
              }
              const bounded = yield* resources.bound({ sessionID: input.sessionID, toolCallID: input.call.id, output })
              const paths = [...new Set([...outputPaths, ...bounded.outputPaths])]
              const resultValue = ToolOutput.toResultValue(bounded.output)
              return paths.length > 0
                ? { result: resultValue, output: bounded.output, outputPaths: paths }
                : { result: resultValue, output: bounded.output }
            }),
          )
        }
        return {
          definitions:
            mode === "code-only"
              ? [exec, ...definitions.filter((definition) => direct.has(definition.name))]
              : [exec, ...definitions.filter((definition) => definition.name !== "exec")],
          permissions: rules,
          settle: (input) => {
            if (input.call.name !== "exec") return settleMaterialized(input)
            if (input.call.toolType === "custom") return settleExec(input)
            return Effect.succeed({
              result: { type: "error", value: "Invalid exec call: expected a raw custom tool call" },
            })
          },
        }
      }) as Interface["materialize"],
    })
  }),
)

export const layer = Layer.effect(
  Tools.Service,
  Service.use((registry) => Effect.succeed(Tools.Service.of({ register: registry.register }))),
).pipe(Layer.provideMerge(registryLayer))

function whollyDisabled(action: string, rules: PermissionV2.Ruleset) {
  const rule = rules.findLast((rule) => Wildcard.match(action, rule.action))
  return rule?.resource === "*" && rule.effect === "deny"
}

export const defaultLayer = layer.pipe(
  Layer.provide(ApplicationTools.layer),
  Layer.provide(ToolOutputStore.defaultLayer),
)
