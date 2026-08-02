import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  AgentOrchestrationApprovalReply,
  AgentOrchestrationArtifact,
  AgentOrchestrationCapabilities,
  AgentOrchestrationError,
  AgentOrchestrationEventReplayResponse,
  AgentOrchestrationFrame,
  AgentOrchestrationFrameJson,
  AgentOrchestrationLimits,
  AgentOrchestrationMetadata,
  AgentOrchestrationPath,
  AgentOrchestrationQuestionReply,
  AgentOrchestrationQuestion,
  AgentOrchestrationWorkspaceRequest,
  agentOrchestrationInteractionRevisionIsCurrent,
} from "../src/agent-orchestration"

const decode = <S extends Schema.Top>(schema: S, input: unknown) =>
  Effect.runPromise(Schema.decodeUnknownEffect(schema)(input) as Effect.Effect<S["Type"], Schema.SchemaError>)

const request = {
  version: "v1",
  kind: "request",
  requestID: "req_orchestration_1",
  idempotencyKey: "idem_orchestration_1",
} as const

const workspace = {
  id: "wrk_orchestration_1",
  path: "/srv/slopcode",
  name: "slopcode",
  metadata: { source: "android" },
} as const

const event = {
  version: "v1",
  kind: "event",
  type: "turn.output",
  cursor: "cur_1",
  sequence: 1,
  sessionID: "ses_orchestration_1",
  turnID: "trn_orchestration_1",
  text: "Working on the protocol.",
} as const

describe("agent orchestration protocol contracts", () => {
  test("accepts strict workspace, session, turn, interaction, plan, artifact, event, and error frames", async () => {
    const frames = [
      {
        ...request,
        type: "workspace.open",
        workspace,
        agent: { id: "slopcode", capabilities: ["workspace", "sessions", "turns", "replay"] },
      },
      {
        ...request,
        type: "session.create",
        requestID: "req_session_1",
        idempotencyKey: "idem_session_1",
        workspaceID: workspace.id,
        agent: "codex",
        title: "Protocol task",
      },
      {
        ...request,
        type: "turn.create",
        requestID: "req_turn_1",
        idempotencyKey: "idem_turn_1",
        sessionID: "ses_orchestration_1",
        turnID: "trn_orchestration_1",
        agent: "claude",
        prompt: "Implement the bounded protocol.",
      },
      {
        ...request,
        type: "interaction.approval.reply",
        requestID: "req_approval_1",
        idempotencyKey: "idem_approval_1",
        sessionID: "ses_orchestration_1",
        interactionID: "int_approval_1",
        revision: 2,
        decision: "approved",
      },
      {
        ...request,
        type: "interaction.question.reply",
        requestID: "req_question_1",
        idempotencyKey: "idem_question_1",
        sessionID: "ses_orchestration_1",
        interactionID: "int_question_1",
        revision: 3,
        answer: "Use Effect Schema.",
      },
      {
        ...request,
        type: "plan.save.prepare",
        requestID: "req_plan_prepare_1",
        idempotencyKey: "idem_plan_prepare_1",
        sessionID: "ses_orchestration_1",
        plan: {
          id: "pln_orchestration_1",
          path: "/srv/slopcode/.superpowers/sdd/plan.md",
          revision: 1,
          content: "# Plan\n\nShip the strict protocol.",
        },
      },
      {
        ...request,
        type: "plan.save.commit",
        requestID: "req_plan_commit_1",
        idempotencyKey: "idem_plan_commit_1",
        sessionID: "ses_orchestration_1",
        prepareID: "prp_orchestration_1",
        planID: "pln_orchestration_1",
        revision: 1,
      },
      event,
      {
        version: "v1",
        kind: "event",
        type: "interaction.approval.requested",
        cursor: "cur_2",
        sequence: 2,
        sessionID: "ses_orchestration_1",
        turnID: "trn_orchestration_1",
        interaction: {
          id: "int_approval_1",
          revision: 2,
          title: "Run tests?",
          command: "bun test",
          cwd: "/srv/slopcode/packages/protocol",
          risk: "low",
        },
      },
      {
        version: "v1",
        kind: "event",
        type: "interaction.question.requested",
        cursor: "cur_3",
        sequence: 3,
        sessionID: "ses_orchestration_1",
        turnID: "trn_orchestration_1",
        interaction: {
          id: "int_question_1",
          revision: 3,
          prompt: "Which agent?",
          options: ["slopcode", "codex"],
          allowFreeform: true,
        },
      },
      {
        version: "v1",
        kind: "event",
        type: "plan.saved",
        cursor: "cur_4",
        sequence: 4,
        sessionID: "ses_orchestration_1",
        plan: {
          id: "pln_orchestration_1",
          path: "/srv/slopcode/.superpowers/sdd/plan.md",
          revision: 1,
          content: "# Plan\n\nShip the strict protocol.",
        },
      },
      {
        version: "v1",
        kind: "event",
        type: "artifact.created",
        cursor: "cur_5",
        sequence: 5,
        sessionID: "ses_orchestration_1",
        turnID: "trn_orchestration_1",
        artifact: {
          id: "art_orchestration_1",
          name: "report",
          kind: "report",
          path: "/srv/slopcode/.superpowers/sdd/task-1-report.md",
          size: 128,
          mime: "text/markdown",
          metadata: { generatedBy: "slopcode" },
        },
      },
      {
        version: "v1",
        kind: "response",
        type: "event.replay",
        requestID: "req_replay_1",
        idempotencyKey: "idem_replay_1",
        events: [event],
        nextCursor: "cur_2",
        hasMore: true,
      },
      {
        version: "v1",
        kind: "error",
        type: "error",
        requestID: "req_turn_1",
        idempotencyKey: "idem_turn_1",
        code: "interaction_conflict",
        message: "The approval has changed.",
        retryable: true,
        details: { interaction: "int_approval_1" },
      },
    ]

    const values = await Promise.all(frames.map((frame) => decode(AgentOrchestrationFrame, frame)))

    expect(values).toHaveLength(frames.length)
    expect(values[0]?.type).toBe("workspace.open")
    expect(values[7]?.kind).toBe("event")
    expect(values[13]?.kind).toBe("error")
  })

  test("rejects excess properties, malformed or oversized frames, unsafe metadata, and invalid agents", async () => {
    await expect(
      decode(AgentOrchestrationWorkspaceRequest, {
        ...request,
        type: "workspace.open",
        workspace,
        agent: { id: "shell", capabilities: ["workspace"] },
        extra: true,
      }),
    ).rejects.toThrow()

    await expect(
      decode(AgentOrchestrationWorkspaceRequest, {
        ...request,
        type: "workspace.open",
        workspace: { ...workspace, extra: true },
        agent: { id: "slopcode", capabilities: ["workspace"] },
      }),
    ).rejects.toThrow()

    await expect(decode(AgentOrchestrationCapabilities, ["workspace", "workspace"])).rejects.toThrow()
    await expect(decode(AgentOrchestrationCapabilities, Array(AgentOrchestrationLimits.maxCapabilities + 1).fill("turns"))).rejects.toThrow()
    await expect(
      decode(AgentOrchestrationError, {
        version: "v1",
        kind: "error",
        type: "error",
        code: "internal",
        message: "nope",
        retryable: false,
        details: { apiKey: "must-not-be-metadata" },
      }),
    ).rejects.toThrow()
    await expect(
      decode(
        AgentOrchestrationFrameJson,
        JSON.stringify({
          ...event,
          text: "x".repeat(AgentOrchestrationLimits.maxFrameBytes),
        }),
      ),
    ).rejects.toThrow()
  })

  test("rejects traversal and non-normalized absolute POSIX paths", async () => {
    await expect(decode(AgentOrchestrationPath, "/srv/../etc")).rejects.toThrow()
    await expect(decode(AgentOrchestrationPath, "/srv//slopcode")).rejects.toThrow()
    await expect(decode(AgentOrchestrationPath, "relative/path")).rejects.toThrow()
    await expect(decode(AgentOrchestrationPath, "/srv\\slopcode")).rejects.toThrow()
    await expect(decode(AgentOrchestrationPath, `/${"x".repeat(AgentOrchestrationLimits.maxPathBytes)}`)).rejects.toThrow()
    expect(String(await decode(AgentOrchestrationPath, "/srv/slopcode"))).toBe("/srv/slopcode")
  })

  test("requires interaction revisions and detects stale replies", async () => {
    const approval = await decode(AgentOrchestrationApprovalReply, {
      ...request,
      type: "interaction.approval.reply",
      sessionID: "ses_orchestration_1",
      interactionID: "int_approval_1",
      revision: 2,
      decision: "approved",
    })
    const question = await decode(AgentOrchestrationQuestionReply, {
      ...request,
      type: "interaction.question.reply",
      sessionID: "ses_orchestration_1",
      interactionID: "int_question_1",
      revision: 2,
      answer: "Proceed",
    })

    const interaction = await decode(AgentOrchestrationQuestion, {
      id: "int_question_1",
      revision: 3,
      prompt: "Proceed?",
    })

    expect(agentOrchestrationInteractionRevisionIsCurrent({ id: approval.interactionID, revision: approval.revision }, approval)).toBe(true)
    expect(agentOrchestrationInteractionRevisionIsCurrent(interaction, question)).toBe(false)
    await expect(
      decode(AgentOrchestrationApprovalReply, {
        ...approval,
        revision: 0,
      }),
    ).rejects.toThrow()
  })

  test("bounds metadata and artifact values", async () => {
    await expect(
      decode(
        AgentOrchestrationMetadata,
        Object.fromEntries(Array.from({ length: AgentOrchestrationLimits.maxMetadataEntries + 1 }, (_, index) => [`field${index}`, "x"])),
      ),
    ).rejects.toThrow()
    await expect(
      decode(AgentOrchestrationMetadata, { field: "x".repeat(AgentOrchestrationLimits.maxMetadataValueBytes + 1) }),
    ).rejects.toThrow()
    await expect(
      decode(
        AgentOrchestrationMetadata,
        Object.fromEntries(Array.from({ length: AgentOrchestrationLimits.maxMetadataEntries }, (_, index) => [`field${index}`, "x".repeat(1024)])),
      ),
    ).rejects.toThrow()
    await expect(
      decode(AgentOrchestrationArtifact, {
        id: "art_orchestration_1",
        name: "report",
        kind: "report",
        path: "/srv/slopcode/report.md",
        size: -1,
      }),
    ).rejects.toThrow()
    await expect(
      decode(AgentOrchestrationArtifact, {
        id: "art_orchestration_1",
        name: "report",
        kind: "report",
        path: "/srv/slopcode/report.md",
        size: AgentOrchestrationLimits.maxArtifactBytes + 1,
      }),
    ).rejects.toThrow()
  })

  test("accepts only ordered replay events with advancing cursors and idempotency fields", async () => {
    const value = {
      version: "v1",
      kind: "response",
      type: "event.replay",
      requestID: "req_replay_1",
      idempotencyKey: "idem_replay_1",
      events: [
        event,
        { ...event, cursor: "cur_2", sequence: 2, text: "Finished." },
      ],
      nextCursor: "cur_3",
      hasMore: true,
    }

    expect((await decode(AgentOrchestrationEventReplayResponse, value)).events.map((item) => item.sequence)).toEqual([1, 2])
    await expect(
      decode(AgentOrchestrationEventReplayResponse, {
        ...value,
        events: [value.events[1], value.events[0]],
      }),
    ).rejects.toThrow()
    await expect(
      decode(AgentOrchestrationEventReplayResponse, {
        ...value,
        events: [event, { ...event, sequence: 2 }],
      }),
    ).rejects.toThrow()
    await expect(
      decode(AgentOrchestrationEventReplayResponse, {
        ...value,
        nextCursor: "cur_0",
      }),
    ).rejects.toThrow()
    await expect(
      decode(AgentOrchestrationEventReplayResponse, {
        ...value,
        nextCursor: "cur_invalid",
      }),
    ).rejects.toThrow()
    await expect(
      decode(AgentOrchestrationEventReplayResponse, {
        ...value,
        nextCursor: undefined,
      }),
    ).rejects.toThrow()
    await expect(
      decode(AgentOrchestrationEventReplayResponse, {
        ...value,
        hasMore: false,
      }),
    ).rejects.toThrow()
    await expect(
      decode(AgentOrchestrationEventReplayResponse, {
        ...value,
        idempotencyKey: "x",
      }),
    ).rejects.toThrow()
  })
})
