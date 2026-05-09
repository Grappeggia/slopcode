import { describe, expect, test } from "bun:test"
import { FollowupRecommendationsTool } from "../../src/tool/recommendation"
import { ToolRegistry } from "../../src/tool/registry"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

const ctx = {
  sessionID: "test-session",
  messageID: "test-message",
  callID: "test-call",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: async () => {},
  ask: async () => {},
}

describe("tool.followup_recommendations", () => {
  test("dedupes and sorts recommendations", async () => {
    const tool = await FollowupRecommendationsTool.init()
    const result = await tool.execute(
      {
        recommendations: [
          {
            kind: "test",
            label: "Run targeted tests",
            reason: "The permission copy changed and should be verified.",
            priority: "high",
            command: "bun test permission.test.ts",
          },
          {
            kind: "verify",
            label: "Smoke test the permission prompt",
            reason: "Confirm the updated selection copy reads clearly in the UI.",
            priority: "medium",
          },
          {
            kind: "test",
            label: "Run targeted tests",
            reason: "Duplicate recommendation should be removed.",
            priority: "low",
            command: "bun test permission.test.ts",
          },
        ],
      },
      ctx,
    )

    expect(result.title).toBe("Suggested next actions")
    expect(result.output).toContain("Run targeted tests")
    expect(result.output).toContain("Smoke test the permission prompt")
    expect(result.metadata.recommendations).toHaveLength(2)
    expect(result.metadata.recommendations[0].priority).toBe("high")
    expect(result.metadata.recommendations[1].priority).toBe("medium")
  })

  test("is available in the tool registry", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const ids = (await ToolRegistry.tools({ providerID: "openai", modelID: "gpt-5" })).map((tool) => tool.id)
        expect(ids).toContain("followup_recommendations")
      },
    })
  })
})
