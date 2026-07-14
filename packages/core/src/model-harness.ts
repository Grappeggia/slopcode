export * as ModelHarness from "./model-harness"

import { Effect, Schema } from "effect"
import { createHash } from "node:crypto"
import { ModelV2 } from "./model"
import general from "./model-harness-gpt-5.6-general-v1.txt"
import sol from "./model-harness-gpt-5.6-sol-v1.txt"

export const ID = Schema.Literals(["gpt-5.6", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"])
export type ID = typeof ID.Type

export const Capability = Schema.Literals(["code-mode", "responses-lite", "websocket"])
export type Capability = typeof Capability.Type

export type ToolMode = "function" | "code-preferred" | "code-only"
export type Reasoning = "low" | "medium" | "high" | "xhigh" | "max" | "ultra"
export type Route = "public" | "codex"

export interface Template {
  readonly id: "gpt-5.6-sol-v1" | "gpt-5.6-general-v1"
  readonly version: 1
  readonly contentHash: `sha256:${string}`
}

export interface Profile {
  readonly id: ID
  readonly version: 1
  readonly instruction: Template
  readonly reasoning: {
    readonly default: Reasoning
    readonly supported: readonly Reasoning[]
  }
  readonly multiAgent: "v1" | "v2"
  readonly source: typeof source
  readonly sourceModel: "gpt-5.6-sol" | "gpt-5.6-terra" | "gpt-5.6-luna"
  readonly profileHash: `sha256:${string}`
  readonly route: RouteProfile
}

export interface RouteProfile {
  readonly id: Route
  readonly tools: {
    readonly mode: ToolMode
    readonly shell?: "shell_command"
    readonly patch?: "freeform"
    readonly discovery?: "code-mode"
    readonly parallel?: boolean
  }
  readonly context: {
    readonly limit: number | undefined
    readonly truncation?: { readonly mode: "tokens"; readonly limit: number }
    readonly compaction?: { readonly compatible: boolean; readonly hash: string }
  }
  readonly transport: {
    readonly required: readonly Capability[]
    readonly websocket: "preferred" | "neutral"
  }
  readonly responses: "full" | "lite"
  readonly reasoning: "default" | "all_turns"
}

export const source = {
  repository: "openai/codex",
  commit: "bfe31598c79bd2e5b9089030ae7f2978457015c8",
  path: "codex-rs/models-manager/models.json",
  contentHash: "sha256:58852101e0de20048bd9878a48fa78f6040c89628d0b0a421d080da47e7f03e6",
} as const

export const templates = {
  "gpt-5.6-sol-v1": {
    id: "gpt-5.6-sol-v1",
    version: 1,
    contentHash: "sha256:e9778714d505f3dd04d44db4394024c5fab5bf6554fc9faa3cdf9cf776b63bb9",
  },
  "gpt-5.6-general-v1": {
    id: "gpt-5.6-general-v1",
    version: 1,
    contentHash: "sha256:78a2fc84e1bffa421d865c1a2ade4185d3d33ef38e6a15157f0ff1a89b7d52ec",
  },
} as const satisfies Record<Template["id"], Template>

const common = {
  version: 1,
  source,
} as const

export const routes: Readonly<Record<Route, RouteProfile>> = {
  public: {
    id: "public",
    tools: { mode: "function" },
    context: { limit: undefined },
    transport: { required: [], websocket: "neutral" },
    responses: "full",
    reasoning: "default",
  },
  codex: {
    id: "codex",
    tools: {
      mode: "code-only",
      shell: "shell_command",
      patch: "freeform",
      discovery: "code-mode",
      parallel: true,
    },
    context: {
      limit: 372_000,
      truncation: { mode: "tokens", limit: 10_000 },
      compaction: { compatible: true, hash: "3000" },
    },
    transport: { required: ["code-mode", "responses-lite"], websocket: "preferred" },
    responses: "lite",
    reasoning: "all_turns",
  },
}

const all = ["low", "medium", "high", "xhigh", "max", "ultra"] as const
const standard = ["low", "medium", "high", "xhigh", "max"] as const

export const profiles: Readonly<Record<ID, Omit<Profile, "route">>> = {
  "gpt-5.6": {
    ...common,
    id: "gpt-5.6",
    sourceModel: "gpt-5.6-sol",
    instruction: templates["gpt-5.6-sol-v1"],
    reasoning: { default: "low", supported: all },
    multiAgent: "v2",
    profileHash: "sha256:6cb8d2fa5c427e475d93b253a70df7198efd8996c3e2602333ddb8961c104a98",
  },
  "gpt-5.6-sol": {
    ...common,
    id: "gpt-5.6-sol",
    sourceModel: "gpt-5.6-sol",
    instruction: templates["gpt-5.6-sol-v1"],
    reasoning: { default: "low", supported: all },
    multiAgent: "v2",
    profileHash: "sha256:7ab05e3cdf1593aa9d7686cea1c0673479f3b0db4658b529e203818466022a5c",
  },
  "gpt-5.6-terra": {
    ...common,
    id: "gpt-5.6-terra",
    sourceModel: "gpt-5.6-terra",
    instruction: templates["gpt-5.6-general-v1"],
    reasoning: { default: "medium", supported: all },
    multiAgent: "v2",
    profileHash: "sha256:7fc5f8b80d8894e4c423016b68ead2d3120fa78849374478847dce8708ad50b2",
  },
  "gpt-5.6-luna": {
    ...common,
    id: "gpt-5.6-luna",
    sourceModel: "gpt-5.6-luna",
    instruction: templates["gpt-5.6-general-v1"],
    reasoning: { default: "medium", supported: standard },
    multiAgent: "v1",
    profileHash: "sha256:f09032794140a9992ce6fbe7e9f9f0879885da6994cbc7cd55793cb50cca729f",
  },
}

export class IncompatibilityError extends Schema.TaggedErrorClass<IncompatibilityError>()(
  "ModelHarness.IncompatibilityError",
  {
    profileID: ID,
    missing: Schema.Array(Capability),
  },
) {}

export class UnsupportedReasoningError extends Schema.TaggedErrorClass<UnsupportedReasoningError>()(
  "ModelHarness.UnsupportedReasoningError",
  {
    profileID: ID,
    variant: Schema.String,
    supported: Schema.Array(Schema.Literals(all)),
  },
) {}

const isID = Schema.is(ID)

export const resolve = (model: ModelV2.Info, route: Route = "public"): Profile | undefined => {
  if (!isID(model.api.id)) return undefined
  const id: ID = model.api.id
  return { ...profiles[id], route: routes[route] }
}

export const validate = (profile: Profile, capabilities: readonly string[]) => {
  const available = new Set(capabilities)
  const missing = profile.route.transport.required.filter((capability) => !available.has(capability))
  if (missing.length > 0) return Effect.fail(new IncompatibilityError({ profileID: profile.id, missing }))
  return Effect.void
}

const content: Readonly<Record<Template["id"], string>> = {
  "gpt-5.6-sol-v1": sol,
  "gpt-5.6-general-v1": general,
}

export const instructions = (profile: Pick<Profile, "instruction">) =>
  Effect.sync(() => {
    const value = content[profile.instruction.id]
    if (value === undefined) throw new Error(`Missing model harness instructions: ${profile.instruction.id}`)
    const hash = `sha256:${createHash("sha256").update(value).digest("hex")}`
    if (hash !== profile.instruction.contentHash)
      throw new Error(
        `Invalid model harness instructions hash for ${profile.instruction.id}: expected ${profile.instruction.contentHash}, received ${hash}`,
      )
    return value
  })

export const reasoning = (profile: Omit<Profile, "route"> | Profile, variant?: string) => {
  if (variant === undefined || variant === "default") return Effect.succeed(profile.reasoning.default)
  if (profile.reasoning.supported.some((effort) => effort === variant)) return Effect.succeed(variant as Reasoning)
  return Effect.fail(
    new UnsupportedReasoningError({
      profileID: profile.id,
      variant,
      supported: [...profile.reasoning.supported],
    }),
  )
}
