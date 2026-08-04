import { describe, expect, test } from "bun:test"
import {
  initialAgentSessionState,
  normalizeAgentSession,
  readAgentSession,
  reduceAgentSession,
  reviewItems,
  sessionKey,
  writeAgentSession,
} from "./ssh-agent-session-state"

describe("Android agent session projection", () => {
  test("projects prompts and typed stream events while preserving stable tool order", () => {
    let state = reduceAgentSession(initialAgentSessionState(), {
      type: "prompt.submitted",
      id: "user_1",
      text: "Build the fixture",
    })
    expect(state.transcript).toEqual([{ id: "user_1", type: "user", text: "Build the fixture" }])

    ;[
      { type: "turn.output", cursor: "cur_1", text: "I’ll inspect the workspace." },
      { type: "turn.reasoning", cursor: "cur_2", text: "Finding the smallest change." },
      { type: "plan.available", cursor: "cur_3", plan: { id: "plan_1", content: "1. Inspect\n2. Build" } },
      {
        type: "tool.updated",
        cursor: "cur_4",
        tool: { id: "tool_1", title: "Run tests", status: "in_progress", kind: "execute" },
      },
      { type: "turn.retry", cursor: "cur_5", reason: "The first check timed out." },
      {
        type: "artifact.created",
        cursor: "cur_6",
        artifact: { id: "artifact_1", name: "result.png", path: "/work/result.png", kind: "image", size: 42 },
      },
    ].forEach((value) => {
      state = reduceAgentSession(state, { type: "event.received", value })
    })

    const before = state.transcript.map((item) => item.id)
    state = reduceAgentSession(state, {
      type: "event.received",
      value: {
        type: "tool.updated",
        cursor: "cur_7",
        tool: { id: "tool_1", title: "Run tests", status: "completed", kind: "execute" },
      },
    })
    expect(state.transcript.map((item) => item.id)).toEqual(before)
    expect(state.transcript.find((item) => item.id === "tool_1")).toMatchObject({ status: "completed" })
    expect(state.lastCursor).toBe("cur_7")
  })

  test("projects approval, question, completion, and local failure as typed entries", () => {
    let state = initialAgentSessionState()
    state = reduceAgentSession(state, {
      type: "event.received",
      value: {
        type: "interaction.approval.requested",
        cursor: "cur_1",
        interaction: { id: "approval_1", revision: 1, title: "Write files", command: "mkdir fixture", risk: "low" },
      },
    })
    state = reduceAgentSession(state, { type: "interaction.resolved", id: "approval_1" })
    state = reduceAgentSession(state, {
      type: "event.received",
      value: {
        type: "interaction.question.requested",
        cursor: "cur_2",
        interaction: {
          id: "question_1",
          revision: 1,
          prompt: "Use TypeScript?",
          options: ["Yes", "No"],
          allowFreeform: true,
        },
      },
    })
    state = reduceAgentSession(state, {
      type: "event.received",
      value: { type: "turn.completed", cursor: "cur_3", status: "completed", message: "Done" },
    })
    state = reduceAgentSession(state, { type: "failure.added", id: "failure_1", message: "Connection lost" })

    expect(state.transcript.map((item) => item.type)).toEqual(["approval", "question", "completion", "failure"])
    expect(state.transcript[0]).toMatchObject({ type: "approval", resolved: true })
    expect(state.transcript[2]).toMatchObject({ type: "completion", status: "completed", message: "Done" })
  })

  test("derives honest review metadata without manufacturing unavailable content", () => {
    const transcript = [
      { id: "edit_1", type: "tool" as const, title: "Edit app.ts", status: "completed", kind: "edit" },
      { id: "test_1", type: "tool" as const, title: "Run unit tests", status: "completed", kind: "execute" },
      { id: "diff_1", type: "artifact" as const, name: "changes.diff", path: "/work/changes.diff", kind: "diff" },
      { id: "file_1", type: "artifact" as const, name: "app.ts", path: "/work/app.ts", kind: "file" },
      { id: "image_1", type: "artifact" as const, name: "result.png", path: "/work/result.png", kind: "image" },
    ]

    expect(reviewItems(transcript, "changes").map((item) => item.id)).toEqual(["edit_1", "diff_1"])
    expect(reviewItems(transcript, "files").map((item) => item.id)).toEqual(["diff_1", "file_1"])
    expect(reviewItems(transcript, "tests").map((item) => item.id)).toEqual(["test_1"])
    expect(reviewItems(transcript, "screenshots").map((item) => item.id)).toEqual(["image_1"])
  })
})

describe("Android agent session persistence", () => {
  test("round trips the bounded allowlisted projection and strips unknown credential fields", async () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => void values.set(key, value),
      removeItem: async (key: string) => void values.delete(key),
    }
    const restored = normalizeAgentSession({
      version: 1,
      draft: "Follow up",
      selectedReview: "files",
      lastCursor: "cur_9",
      transcript: [{ id: "user_1", type: "user", text: "Review the app", metadata: { apiKey: "placeholder" } }],
      password: "placeholder",
      privateKey: "placeholder",
    })
    expect(restored).toEqual({
      version: 1,
      draft: "Follow up",
      selectedReview: "files",
      lastCursor: "cur_9",
      transcript: [{ id: "user_1", type: "user", text: "Review the app" }],
    })

    await writeAgentSession(storage, "scope", restored)
    expect(values.get("scope")).not.toContain("password")
    expect(values.get("scope")).not.toContain("privateKey")
    expect(values.get("scope")).not.toContain("apiKey")
    await expect(readAgentSession(storage, "scope")).resolves.toEqual(restored)
  })

  test("uses an opaque stable workspace scope key", () => {
    const workspace = { profile: "agent@fixture.test:22", directory: "/work/project", agent: "codex-cli" } as const
    const first = sessionKey(workspace)
    expect(sessionKey(workspace)).toBe(first)
    expect(sessionKey({ ...workspace, directory: "/work/other" })).not.toBe(first)
    expect(first).not.toContain(workspace.profile)
    expect(first).not.toContain(workspace.directory)
  })
})
