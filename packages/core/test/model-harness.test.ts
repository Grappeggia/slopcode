import { describe, expect, it } from "bun:test"
import { ModelHarness } from "@slopcode-ai/core/model-harness"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProjectV2 } from "@slopcode-ai/core/project"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { SessionRunnerModel } from "@slopcode-ai/core/session/runner/model"
import { DateTime, Effect } from "effect"
import { it as effectIt } from "./lib/effect"

const ids = ["gpt-5.6", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"] as const

const model = (id: string, api = id) =>
  new ModelV2.Info({
    id: ModelV2.ID.make(id),
    providerID: ProviderV2.ID.openai,
    name: id,
    api: {
      id: ModelV2.ID.make(api),
      type: "aisdk",
      package: "@ai-sdk/openai",
      url: "https://api.openai.com/v1",
      settings: {},
    },
    capabilities: { tools: true, input: ["text", "image"], output: ["text"] },
    request: { headers: {}, body: {}, generation: {}, options: {} },
    variants: [],
    time: { released: DateTime.makeUnsafe(0) },
    cost: [],
    status: "active",
    enabled: true,
    limit: { context: 1_050_000, input: 922_000, output: 128_000 },
  })

const session = (catalog: ModelV2.Info) =>
  SessionV2.Info.make({
    id: SessionV2.ID.make("ses_harness"),
    projectID: ProjectV2.ID.global,
    title: "test",
    model: { id: catalog.id, providerID: catalog.providerID },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: DateTime.makeUnsafe(0), updated: DateTime.makeUnsafe(0) },
    location: { directory: AbsolutePath.make("/project") },
  })

describe("ModelHarness", () => {
  it("resolves all canonical GPT-5.6 API IDs", () => {
    expect(ids.map((id) => ModelHarness.resolve(model(id))?.id)).toEqual(ids)
  })

  it("inherits the base profile through the catalog API ID", () => {
    expect(ModelHarness.resolve(model("gpt-5.6-sol-fast", "gpt-5.6-sol"))?.id).toBe("gpt-5.6-sol")
  })

  it("does not attach a harness to unrelated models", () => {
    expect(ModelHarness.resolve(model("gpt-5.5"))).toBeUndefined()
    expect(ModelHarness.resolve(model("contains-gpt-5.6-sol"))).toBeUndefined()
    expect(ModelHarness.resolve(model("toString"))).toBeUndefined()
  })

  it("pins source, template, and profile hashes", () => {
    const profiles = ids.map((id) => ModelHarness.resolve(model(id))!)

    expect(ModelHarness.source).toEqual({
      repository: "openai/codex",
      commit: "bfe31598c79bd2e5b9089030ae7f2978457015c8",
      path: "codex-rs/models-manager/models.json",
      contentHash: "sha256:58852101e0de20048bd9878a48fa78f6040c89628d0b0a421d080da47e7f03e6",
    })
    expect(profiles.map((profile) => profile.instruction)).toEqual([
      ModelHarness.templates["gpt-5.6-sol-v1"],
      ModelHarness.templates["gpt-5.6-sol-v1"],
      ModelHarness.templates["gpt-5.6-general-v1"],
      ModelHarness.templates["gpt-5.6-general-v1"],
    ])
    expect(profiles.map((profile) => profile.sourceModel)).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
    ])
    expect(ModelHarness.templates).toEqual({
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
    })
    expect(profiles.map((profile) => profile.profileHash)).toEqual([
      "sha256:5d727c29a47b42a85e4a653f428cfe24a802615b70b3da4f325e718f282c6b87",
      "sha256:4b4fc2f50c2eec0cd208430eced7f04665e2f0d6827eeb896231bbbf8e23db42",
      "sha256:44b764825455ae23fb572218522248497be9e587da3f2f50098e87343d5b882c",
      "sha256:68b571fede4f2b1518c58c389ea859816ed4f58b6895a367fb2508bc46c7cdcd",
    ])
    for (const profile of profiles) {
      const { profileHash, ...content } = profile
      expect(profileHash).toBe(`sha256:${Bun.CryptoHasher.hash("sha256", JSON.stringify(content), "hex")}`)
    }
  })

  effectIt.effect("resolves versioned local instructions with their pinned hashes", () =>
    Effect.gen(function* () {
      const sol = yield* ModelHarness.instructions(ModelHarness.profiles["gpt-5.6-sol"])
      const terra = yield* ModelHarness.instructions(ModelHarness.profiles["gpt-5.6-terra"])
      const luna = yield* ModelHarness.instructions(ModelHarness.profiles["gpt-5.6-luna"])

      expect(Bun.CryptoHasher.hash("sha256", sol, "hex")).toBe(
        ModelHarness.templates["gpt-5.6-sol-v1"].contentHash.slice(7),
      )
      expect(Bun.CryptoHasher.hash("sha256", terra, "hex")).toBe(
        ModelHarness.templates["gpt-5.6-general-v1"].contentHash.slice(7),
      )
      expect(luna).toBe(terra)
      expect(sol).not.toBe(terra)
    }),
  )

  it("represents the pinned model-visible behavior", () => {
    const profiles = ids.map((id) => ModelHarness.resolve(model(id))!)

    expect(profiles.map((profile) => profile.version)).toEqual([1, 1, 1, 1])
    expect(profiles.map((profile) => profile.tools)).toEqual(
      ids.map(() => ({
        mode: "code-only",
        shell: "shell_command",
        patch: "freeform",
        discovery: "code-mode",
        parallel: true,
      })),
    )
    expect(profiles.map((profile) => profile.reasoning.default)).toEqual(["low", "low", "medium", "medium"])
    expect(profiles.map((profile) => profile.reasoning.supported)).toEqual([
      ["low", "medium", "high", "xhigh", "max", "ultra"],
      ["low", "medium", "high", "xhigh", "max", "ultra"],
      ["low", "medium", "high", "xhigh", "max", "ultra"],
      ["low", "medium", "high", "xhigh", "max"],
    ])
    expect(profiles.map((profile) => profile.multiAgent)).toEqual(["v2", "v2", "v2", "v1"])
    expect(profiles.map((profile) => profile.context)).toEqual(
      ids.map(() => ({
        limit: 372_000,
        truncation: { mode: "tokens", limit: 10_000 },
        compaction: { compatible: true, hash: "3000" },
      })),
    )
    expect(profiles.map((profile) => profile.transport)).toEqual(
      ids.map(() => ({ required: ["code-mode", "responses-lite"], websocket: "preferred" })),
    )
  })

  effectIt.effect("reports unmet model transport requirements without claiming route support", () =>
    Effect.gen(function* () {
      const profile = ModelHarness.resolve(model("gpt-5.6-sol"))!
      const failure = yield* ModelHarness.validate(profile, ["websocket"]).pipe(Effect.flip)

      expect(failure).toEqual(
        new ModelHarness.IncompatibilityError({
          profileID: "gpt-5.6-sol",
          missing: ["code-mode", "responses-lite"],
        }),
      )
      yield* ModelHarness.validate(profile, ["code-mode", "responses-lite"])
    }),
  )

  effectIt.effect("resolves defaults and validates explicit reasoning variants", () =>
    Effect.gen(function* () {
      expect(yield* ModelHarness.reasoning(ModelHarness.profiles["gpt-5.6-sol"])).toBe("low")
      expect(yield* ModelHarness.reasoning(ModelHarness.profiles["gpt-5.6-terra"], "xhigh")).toBe("xhigh")
      expect(yield* ModelHarness.reasoning(ModelHarness.profiles["gpt-5.6-sol"], "ultra")).toBe("ultra")

      const failure = yield* ModelHarness.reasoning(ModelHarness.profiles["gpt-5.6-luna"], "ultra").pipe(Effect.flip)
      expect(failure).toEqual(
        new ModelHarness.UnsupportedReasoningError({
          profileID: "gpt-5.6-luna",
          variant: "ultra",
          supported: ["low", "medium", "high", "xhigh", "max"],
        }),
      )
    }),
  )

  effectIt.effect("propagates the catalog model and harness with the executable model", () =>
    Effect.gen(function* () {
      const catalog = model("gpt-5.6-sol-fast", "gpt-5.6-sol")
      const resolved = yield* SessionRunnerModel.resolve(session(catalog), catalog)

      expect(resolved.model.id).toBe("gpt-5.6-sol")
      expect(resolved.catalog).toBe(catalog)
      expect(resolved.harness).toBe(ModelHarness.resolve(catalog))
    }),
  )
})
