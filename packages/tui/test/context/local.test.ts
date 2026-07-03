import { describe, expect, test } from "bun:test"
import { parseModel, primaryAgents, recentModels } from "../../src/context/local"

test("parses model IDs containing slashes", () => {
  expect(parseModel("provider/family/model")).toEqual({
    providerID: "provider",
    modelID: "family/model",
  })
})

test("moves a model to the front, deduplicates, and limits recents", () => {
  const recent = Array.from({ length: 12 }, (_, index) => ({
    providerID: "provider",
    modelID: `model-${index}`,
  }))

  expect(recentModels({ providerID: "provider", modelID: "model-5" }, recent)).toEqual([
    { providerID: "provider", modelID: "model-5" },
    ...recent.slice(0, 5),
    ...recent.slice(6, 10),
  ])
})

describe("local agent selection", () => {
  test("keeps subagents and hidden agents out of primary tab rotation", () => {
    expect(
      primaryAgents([
        { name: "build", mode: "primary" },
        { name: "goal", mode: "primary" },
        { name: "docs", mode: "subagent" },
        { name: "compaction", mode: "primary", hidden: true },
      ]).map((agent) => agent.name),
    ).toEqual(["build", "goal"])
  })
})
