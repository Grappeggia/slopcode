export * as Tool from "./tool"

import { ToolDefinition, ToolFailure, ToolOutput, type ToolCall } from "@slopcode-ai/llm"
import { Effect, JsonSchema, Schema } from "effect"
import type { AgentV2 } from "../agent"
import type { PermissionV2 } from "../permission"
import type { SessionMessage } from "../session/message"
import type { SessionSchema } from "../session/schema"
import type { SessionEvent } from "../session/event"

export interface Context {
  readonly sessionID: SessionSchema.ID
  readonly agent: AgentV2.ID
  readonly assistantMessageID: SessionMessage.ID
  readonly toolCallID: string
  readonly multiAgent?: "v1" | "v2"
  readonly permissions: PermissionV2.Ruleset
  readonly plan: {
    readonly mode?: "function" | "code-preferred" | "code-only"
    readonly shell?: "shell_command"
    readonly patch?: "freeform"
    readonly multiAgent?: "v1" | "v2"
  }
  readonly task?: SessionEvent.Task.Requested["data"]
}

export type SchemaType<A> = Schema.Codec<A, any, never, never>

declare const TypeId: unique symbol

export interface Definition<Input extends SchemaType<any>, Output extends SchemaType<any>> {
  readonly [TypeId]: {
    readonly _Input: Input
    readonly _Output: Output
  }
}

export type AnyTool = Definition<any, any>
export const Failure = ToolFailure
export type Failure = ToolFailure

export class RegistrationError extends Schema.TaggedErrorClass<RegistrationError>()("Tool.RegistrationError", {
  name: Schema.String,
  message: Schema.String,
}) {}

export type Content =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "file"; readonly data: string; readonly mime: string; readonly name?: string }

type Config<Input extends SchemaType<any>, Output extends SchemaType<any>> = {
  readonly description: string | ((permissions: PermissionV2.Ruleset) => string)
  readonly input: Input
  readonly output: Output
  readonly execute: (
    input: Schema.Schema.Type<Input>,
    context: Context,
  ) => Effect.Effect<Schema.Schema.Type<Output>, ToolFailure>
  readonly validateInput?: (input: unknown) => string | undefined
  readonly toModelOutput?: (input: {
    readonly input: Schema.Schema.Type<Input>
    readonly output: Output["Encoded"]
  }) => ReadonlyArray<Content>
}

type Runtime = {
  readonly permission?: string
  readonly definition: (name: string, permissions: PermissionV2.Ruleset) => ToolDefinition
  readonly settle: (call: ToolCall, context: Context) => Effect.Effect<ToolOutput, ToolFailure>
}

const runtimes = new WeakMap<AnyTool, Runtime>()

export function make<Input extends SchemaType<any>, Output extends SchemaType<any>>(
  config: Config<Input, Output>,
): Definition<Input, Output> {
  const tool = Object.freeze({}) as Definition<Input, Output>
  const definitions = new Map<string, ToolDefinition>()
  runtimes.set(tool, {
    definition: (name, permissions) => {
      const description = typeof config.description === "string" ? config.description : config.description(permissions)
      const key = `${name}\u0000${description}`
      const cached = definitions.get(key)
      if (cached) return cached
      const definition = new ToolDefinition({
        name,
        description,
        inputSchema: toJsonSchema(config.input),
        outputSchema: toJsonSchema(config.output),
      })
      definitions.set(key, definition)
      return definition
    },
    settle: (call, context) => {
      const error = config.validateInput?.(call.input)
      return error
        ? Effect.fail(new ToolFailure({ message: error }))
        : Schema.decodeUnknownEffect(config.input)(call.input).pipe(
            Effect.mapError((error) => new ToolFailure({ message: `Invalid tool input: ${error.message}` })),
            Effect.flatMap((input) =>
              config.execute(input, context).pipe(
                Effect.flatMap((output) =>
                  Schema.encodeEffect(config.output)(output).pipe(
                    Effect.mapError(
                      (error) =>
                        new ToolFailure({
                          message: `Tool returned an invalid value for its output schema: ${error.message}`,
                        }),
                    ),
                  ),
                ),
                Effect.map((output) => ({
                  structured: output,
                  content:
                    config.toModelOutput?.({ input, output }).map((part) =>
                      part.type === "text"
                        ? { type: "text" as const, text: part.text }
                        : {
                            type: "file" as const,
                            uri: `data:${part.mime};base64,${part.data}`,
                            mime: part.mime,
                            name: part.name,
                          },
                    ) ?? (typeof output === "string" ? [{ type: "text" as const, text: output }] : []),
                })),
              ),
            ),
          )
    },
  })
  return tool
}

export const validateName = (name: string) =>
  /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)
    ? Effect.void
    : Effect.fail(new RegistrationError({ name, message: `Invalid tool name: ${name}` }))

export const withPermission = <Input extends SchemaType<any>, Output extends SchemaType<any>>(
  tool: Definition<Input, Output>,
  permission: string,
) => {
  const decorated = Object.freeze({}) as Definition<Input, Output>
  runtimes.set(decorated, { ...runtimeOf(tool), permission })
  return decorated
}

export const permission = (tool: AnyTool, name: string) => runtimeOf(tool).permission ?? name
export const definition = (name: string, tool: AnyTool, permissions: PermissionV2.Ruleset = []) =>
  runtimeOf(tool).definition(name, permissions)
export const settle = (tool: AnyTool, call: ToolCall, context: Context) => runtimeOf(tool).settle(call, context)

function runtimeOf(tool: AnyTool) {
  const runtime = runtimes.get(tool)
  if (!runtime) throw new TypeError("Invalid Core Tool value")
  return runtime
}

function toJsonSchema(schema: Schema.Top): JsonSchema.JsonSchema {
  const document = Schema.toJsonSchemaDocument(schema)
  if (Object.keys(document.definitions).length === 0) return document.schema
  return { ...document.schema, $defs: document.definitions }
}
