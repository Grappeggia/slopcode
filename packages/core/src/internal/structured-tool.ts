import type { AnyToolDefinition } from "@slopcode-ai/llm"
import { Context, type Effect, type Scope } from "effect"
import type { PermissionV2 } from "../permission"
import type { SessionFormat } from "../session/format"
import type { ToolRegistry } from "../tool/registry"
import type { ToolOutputStore } from "../tool-output-store"

const Brand = Symbol("ToolRegistry.Structured")

export type FinalSettlement =
  | { readonly type: "success"; readonly value: unknown }
  | { readonly type: "schema"; readonly value: unknown }
  | { readonly type: "invalid"; readonly reason: "invalid-json" | "value-limit" }
  | { readonly type: "stale" }

export interface Materialization {
  readonly definitions: ReadonlyArray<AnyToolDefinition>
  readonly permissions: PermissionV2.Ruleset
  readonly settle: ToolRegistry.Materialization["settle"]
  readonly settleFinal: (
    input: ToolRegistry.ExecuteInput,
  ) => Effect.Effect<FinalSettlement, ToolOutputStore.Error>
}

interface Interface {
  readonly [Brand]: true
  readonly materialize: (
    permissions: PermissionV2.Ruleset,
    plan: ToolRegistry.ToolPlan,
    format: SessionFormat.JsonFormat,
  ) => Effect.Effect<Materialization, never, Scope.Scope>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/internal/structured-tool") {}

export const make = (materialize: Interface["materialize"]): Interface =>
  Object.freeze(Object.defineProperty({ materialize }, Brand, { value: true })) as Interface
