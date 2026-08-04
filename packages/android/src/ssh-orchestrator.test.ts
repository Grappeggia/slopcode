import { describe, expect, test } from "bun:test"
import type { SshOrchestratorEvent, SshTransport } from "./ssh"
import {
  agentID,
  cancelFrame,
  helloFrame,
  parseAttach,
  parseHello,
  parseReplay,
  retryFrame,
  sessionAttachFrame,
  snapshotFrame,
  steerFrame,
  parseInteraction,
  parseOrchestratorEvent,
  parseOrchestratorLine,
  reduceOrchestratorEvent,
  replyFrame,
  turnFrame,
  wire,
  workspaceFrame,
} from "./ssh-orchestrator"

describe("SSH agent orchestration frames", () => {
  test("maps all Android agents and uses protocol-safe reply fields", () => {
    expect(agentID("codex-cli")).toBe("codex")
    expect(agentID("opencode-cli")).toBe("opencode")
    expect(agentID("claude-code")).toBe("claude")
    expect(agentID("antigravity-cli")).toBe("antigravity")
    const approval = replyFrame(
      "ses_1",
      { id: "int_1", revision: 1, kind: "approval", title: "Run command" },
      undefined,
      "rejected",
    )
    expect(approval).not.toHaveProperty("agent")
    expect(approval.type).toBe("interaction.approval.reply")
    expect(turnFrame("ses_1", "review", "claude-code").agent).toBe("claude")
    expect(turnFrame("ses_1", "review", "antigravity-cli").agent).toBe("antigravity")
    expect(workspaceFrame("/tmp/work", "codex-cli").agent.id).toBe("codex")
    expect(helloFrame("opencode-cli")).toMatchObject({ type: "bridge.hello", agent: "opencode" })
    expect(sessionAttachFrame("ses_1")).toMatchObject({ type: "session.attach", sessionID: "ses_1" })
    expect(snapshotFrame("ses_1")).toMatchObject({ type: "session.snapshot", sessionID: "ses_1" })
    expect(cancelFrame("ses_1", "trn_1")).toMatchObject({ type: "turn.cancel" })
    expect(retryFrame("ses_1", "trn_1")).toMatchObject({ type: "turn.retry" })
    expect(steerFrame("ses_1", "trn_1", "focus tests")).toMatchObject({
      type: "turn.steer",
      instruction: "focus tests",
    })
  })

  test("strictly parses bridge negotiation, snapshots, and replay", () => {
    expect(
      parseHello({
        type: "bridge.hello",
        bridgeVersion: "1.0.0",
        protocolVersion: "v1",
        agent: "codex",
        backendVersion: "codex 2.0.0",
        backendMode: "app_server",
        capabilities: ["workspace", "sessions", "turns", "replay", "cancel"],
      }),
    ).toMatchObject({ agent: "codex", backendMode: "app_server" })
    const snapshot = {
      session: {
        id: "ses_1",
        state: "running",
        backendVersion: "codex 2.0.0",
        backendMode: "app_server",
        capabilities: ["workspace", "sessions", "turns", "replay"],
        activeTurnID: "trn_1",
        lastCursor: "cur_1",
      },
      pending: [],
      artifacts: [],
      authoritative: true,
    }
    expect(parseAttach({ type: "session.attach", attached: true, snapshot })).toMatchObject({
      attached: true,
      snapshot: { session: { id: "ses_1" } },
    })
    expect(
      parseReplay({
        type: "event.replay",
        events: [
          {
            kind: "event",
            sessionID: "ses_1",
            type: "turn.output",
            cursor: "cur_2",
            sequence: 2,
            turnID: "trn_1",
            text: "done",
          },
        ],
        hasMore: false,
      }),
    ).toMatchObject({ hasMore: false, events: [{ cursor: "cur_2" }] })
    expect(parseHello({ protocolVersion: "v2" })).toBeUndefined()
  })

  test("uses stable idempotency keys for interaction and turn controls", () => {
    const interaction = { id: "int_1", revision: 2, kind: "approval" as const, title: "Write" }
    const first = replyFrame("ses_1", interaction, undefined, "approved")
    const repeated = replyFrame("ses_1", interaction, undefined, "approved")
    expect(first.idempotencyKey).toBe(repeated.idempotencyKey)
    expect(first.requestID).toBe(repeated.requestID)
    expect(cancelFrame("ses_1", "trn_1")).toMatchObject(cancelFrame("ses_1", "trn_1"))
    expect(retryFrame("ses_1", "trn_1")).toMatchObject(retryFrame("ses_1", "trn_1"))
    expect(sessionAttachFrame("ses_1")).toMatchObject(sessionAttachFrame("ses_1"))
    const question = replyFrame(
      "ses_1",
      { id: "int_2", revision: 1, kind: "question", prompt: "Token?" },
      "secret-answer",
      undefined,
    )
    expect(question.idempotencyKey).not.toContain("secret-answer")
    expect(steerFrame("ses_1", "trn_1", "use password=secret").idempotencyKey).not.toContain("secret")
  })

  test("bounds and parses trusted protocol event lines", () => {
    const value = { kind: "event", sessionID: "ses_1", type: "turn.output", cursor: "cur_1", text: "hello" }
    expect(parseOrchestratorLine(JSON.stringify(value))).toEqual(value)
    expect(parseOrchestratorLine("not-json")).toBeUndefined()
    expect(parseOrchestratorLine("x".repeat(256 * 1024 + 1))).toBeUndefined()
    expect(parseOrchestratorEvent(value)).toEqual({ kind: "event", value })
    expect(parseOrchestratorEvent({ kind: "error", message: "failed" })).toEqual({
      kind: "error",
      message: "failed",
      code: "internal",
      retryable: false,
    })
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

  test("joins adjacent streamed output chunks into one readable item", () => {
    const initial = { phase: "ready" as const, items: [], sessionID: "ses_1" }
    const first = reduceOrchestratorEvent(initial, {
      kind: "event",
      sessionID: "ses_1",
      type: "turn.output",
      cursor: "cur_1",
      text: "Created ",
    })
    const second = reduceOrchestratorEvent(first, {
      kind: "event",
      sessionID: "ses_1",
      type: "turn.output",
      cursor: "cur_2",
      text: "tetris.html",
    })
    expect(second.items).toEqual([{ id: "turn.output:cur_1", type: "output", text: "Created tetris.html" }])
  })

  test("updates tools in place so streamed status changes do not reorder the transcript", () => {
    const initial = { phase: "ready" as const, items: [], sessionID: "ses_1" }
    const first = reduceOrchestratorEvent(initial, {
      type: "tool.updated",
      cursor: "cur_1",
      tool: { id: "tool_1", title: "Run tests", status: "in_progress", kind: "execute" },
    })
    const output = reduceOrchestratorEvent(first, { type: "turn.output", cursor: "cur_2", text: "Checking…" })
    const completed = reduceOrchestratorEvent(output, {
      type: "tool.updated",
      cursor: "cur_3",
      tool: { id: "tool_1", title: "Run tests", status: "completed", kind: "execute" },
    })

    expect(completed.items.map((item) => item.id)).toEqual(["tool_1", "turn.output:cur_2"])
    expect(completed.items[0]).toMatchObject({ id: "tool_1", status: "completed" })
  })

  test("scopes native events to the active orchestrator channel", async () => {
    let emit: (event: SshOrchestratorEvent) => void = () => undefined
    const inputs: string[] = []
    const ssh = {
      orchestratorInput: async (value: string) => void inputs.push(value),
      subscribeOrchestrator(listener: (event: SshOrchestratorEvent) => void) {
        emit = listener
        return () => undefined
      },
    } as SshTransport
    const events: Record<string, unknown>[] = []
    const next = wire(ssh)
    const close = next.connect((value) => events.push(value))
    await expect(next.send({ requestID: "req_unscoped" })).rejects.toThrow("no active native channel")
    next.scope("ssh_current")
    const pending = next.send({ requestID: "req_scoped", kind: "request" })
    expect(inputs).toHaveLength(1)
    emit({
      type: "output",
      id: "ssh_stale",
      data: JSON.stringify({ kind: "response", requestID: "req_scoped", source: "stale" }),
    })
    emit({ type: "error", id: "ssh_stale", message: "stale failure" })
    emit({ type: "completed", id: "ssh_stale", exitCode: 1 })
    emit({
      type: "output",
      id: "ssh_stale",
      data: JSON.stringify({ kind: "event", sessionID: "ses_1", type: "turn.output", text: "stale" }),
    })
    emit({
      type: "output",
      id: "ssh_current",
      data: JSON.stringify({ kind: "event", sessionID: "ses_1", type: "turn.output", text: "current" }),
    })
    emit({
      type: "output",
      id: "ssh_current",
      data: JSON.stringify({ kind: "response", requestID: "req_scoped", source: "current" }),
    })
    await expect(pending).resolves.toMatchObject({ source: "current" })
    expect(events).toEqual([expect.objectContaining({ kind: "event", sessionID: "ses_1", text: "current" })])
    close()
  })
})
