export * as ModelHarness from "./model-harness"

import { Effect, Schema } from "effect"
import { ModelV2 } from "./model"

export const ID = Schema.Literals(["gpt-5.6", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"])
export type ID = typeof ID.Type

export const Capability = Schema.Literals(["code-mode", "responses-lite", "websocket"])
export type Capability = typeof Capability.Type

export type ToolMode = "function" | "code-preferred" | "code-only"
export type Reasoning = "low" | "medium" | "high" | "xhigh" | "max" | "ultra"

export interface Template {
  readonly id: "gpt-5.6-sol-v1" | "gpt-5.6-general-v1"
  readonly version: 1
  readonly contentHash: `sha256:${string}`
}

export interface Profile {
  readonly id: ID
  readonly version: 1
  readonly instruction: Template
  readonly tools: {
    readonly mode: ToolMode
    readonly shell: "shell_command"
    readonly patch: "freeform"
    readonly discovery: "code-mode"
    readonly parallel: boolean
  }
  readonly reasoning: {
    readonly default: Reasoning
    readonly supported: readonly Reasoning[]
  }
  readonly multiAgent: "v1" | "v2"
  readonly context: {
    readonly limit: number
    readonly truncation: { readonly mode: "tokens"; readonly limit: number }
    readonly compaction: { readonly compatible: boolean; readonly hash: string }
  }
  readonly transport: {
    readonly required: readonly Capability[]
    readonly websocket: "preferred" | "neutral"
  }
  readonly source: typeof source
  readonly sourceModel: "gpt-5.6-sol" | "gpt-5.6-terra" | "gpt-5.6-luna"
  readonly profileHash: `sha256:${string}`
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
  transport: {
    required: ["code-mode", "responses-lite"],
    websocket: "preferred",
  },
  source,
} as const

const all = ["low", "medium", "high", "xhigh", "max", "ultra"] as const
const standard = ["low", "medium", "high", "xhigh", "max"] as const

export const profiles: Readonly<Record<ID, Profile>> = {
  "gpt-5.6": {
    ...common,
    id: "gpt-5.6",
    sourceModel: "gpt-5.6-sol",
    instruction: templates["gpt-5.6-sol-v1"],
    reasoning: { default: "low", supported: all },
    multiAgent: "v2",
    profileHash: "sha256:5d727c29a47b42a85e4a653f428cfe24a802615b70b3da4f325e718f282c6b87",
  },
  "gpt-5.6-sol": {
    ...common,
    id: "gpt-5.6-sol",
    sourceModel: "gpt-5.6-sol",
    instruction: templates["gpt-5.6-sol-v1"],
    reasoning: { default: "low", supported: all },
    multiAgent: "v2",
    profileHash: "sha256:4b4fc2f50c2eec0cd208430eced7f04665e2f0d6827eeb896231bbbf8e23db42",
  },
  "gpt-5.6-terra": {
    ...common,
    id: "gpt-5.6-terra",
    sourceModel: "gpt-5.6-terra",
    instruction: templates["gpt-5.6-general-v1"],
    reasoning: { default: "medium", supported: all },
    multiAgent: "v2",
    profileHash: "sha256:44b764825455ae23fb572218522248497be9e587da3f2f50098e87343d5b882c",
  },
  "gpt-5.6-luna": {
    ...common,
    id: "gpt-5.6-luna",
    sourceModel: "gpt-5.6-luna",
    instruction: templates["gpt-5.6-general-v1"],
    reasoning: { default: "medium", supported: standard },
    multiAgent: "v1",
    profileHash: "sha256:68b571fede4f2b1518c58c389ea859816ed4f58b6895a367fb2508bc46c7cdcd",
  },
}

export class IncompatibilityError extends Schema.TaggedErrorClass<IncompatibilityError>()(
  "ModelHarness.IncompatibilityError",
  {
    profileID: ID,
    missing: Schema.Array(Capability),
  },
) {}

export const resolve = (model: ModelV2.Info): Profile | undefined =>
  Object.hasOwn(profiles, model.api.id) ? profiles[model.api.id as ID] : undefined

export const validate = (profile: Profile, capabilities: readonly Capability[]) => {
  const available = new Set(capabilities)
  const missing = profile.transport.required.filter((capability) => !available.has(capability))
  if (missing.length > 0) return Effect.fail(new IncompatibilityError({ profileID: profile.id, missing }))
  return Effect.void
}
