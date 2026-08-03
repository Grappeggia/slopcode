import { describe, expect, test } from "bun:test"
import {
  agentID,
  parseInteraction,
  parseOrchestratorEvent,
  parseOrchestratorLine,
  reduceOrchestratorEvent,
  replyFrame,
  turnFrame,
  workspaceFrame,
} from "./ssh-orchestrator"

describe("SSH agent orchestration frames", () => {
  test("maps all Android agents and uses protocol-safe reply fields", () => {
    expect(agentID("slopcode-cli")).toBe("slopcode")
    expect(agentID("codex-cli")).toBe("codex")
    expect(agentID("opencode-cli")).toBe("opencode")
    expect(agentID("claude-code")).toBe("claude")
    const approval = replyFrame(
      "ses_1",
      { id: "int_1", revision: 1, kind: "approval", title: "Run command" },
      undefined,
      "rejected",
    )
    expect(approval).not.toHaveProperty("agent")
    expect(approval.type).toBe("interaction.approval.reply")
    expect(turnFrame("ses_1", "review", "claude-code").agent).toBe("claude")
    expect(workspaceFrame("/tmp/work", "codex-cli").agent.id).toBe("codex")
  })

  test("bounds and parses trusted protocol event lines", () => {
    const value = { kind: "event", sessionID: "ses_1", type: "turn.output", cursor: "cur_1", text: "hello" }
    expect(parseOrchestratorLine(JSON.stringify(value))).toEqual(value)
    expect(parseOrchestratorLine("not-json")).toBeUndefined()
    expect(parseOrchestratorLine("x".repeat(256 * 1024 + 1))).toBeUndefined()
    expect(parseOrchestratorEvent(value)).toEqual({ kind: "event", value })
    expect(parseOrchestratorEvent({ kind: "error", message: "failed" })).toEqual({ kind: "error", message: "failed" })
  })

  test("reduces plans, interactions, and terminal turn state", () => {
    const initial = { phase: "ready" as const, items: [], sessionID: "ses_1" }
    const planned = reduceOrchestratorEvent(initial, {
      kind: "event",
      sessionID: "ses_1",
      type: "plan.available",
      cursor: "cur_1",
      plan: { id: "plan_1", content: "- [ ] inspect" },
    })
    expect(planned.items).toHaveLength(1)
    const interaction = parseInteraction(
      { id: "int_1", revision: 1, prompt: "Continue?", options: ["Yes"] },
      "question",
    )
    expect(interaction?.options).toEqual(["Yes"])
    const waiting = reduceOrchestratorEvent(planned, {
      kind: "event",
      sessionID: "ses_1",
      type: "interaction.question.requested",
      cursor: "cur_2",
      interaction: interaction!,
    })
    expect(waiting.phase).toBe("waiting")
    expect(waiting.interaction?.id).toBe("int_1")
    const completed = reduceOrchestratorEvent(waiting, {
      kind: "event",
      sessionID: "ses_1",
      type: "turn.completed",
      cursor: "cur_3",
      status: "completed",
    })
    expect(completed.phase).toBe("completed")
    expect(completed.interaction).toBeUndefined()
  })
})
