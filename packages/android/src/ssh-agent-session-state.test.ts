import { describe, expect, test } from "bun:test"
import {
  MAX_PERSISTED_AGENT_SESSION_BYTES,
  initialAgentSessionState,
  normalizeAgentSession,
  pendingInteraction,
  readAgentSession,
  reduceAgentSession,
  reviewItems,
  sessionKey,
  writeAgentSession,
} from "./ssh-agent-session-state"

const workspace = {
  profile: "agent@void:22",
  directory: "/work/project",
  agent: "codex-cli",
} as const

const frame = (sequence: number, type: string, value: Record<string, unknown> = {}) => ({
  version: "v1",
  kind: "event",
  cursor: `cur_${sequence}`,
  sequence,
  sessionID: "ses_android_1",
  turnID: "trn_android_1",
  type,
  ...value,
})

function memory() {
  const values = new Map<string, string>()
  return {
    values,
    storage: {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => void values.set(key, value),
      removeItem: async (key: string) => void values.delete(key),
    },
  }
}

describe("Android agent session projection", () => {
  test("projects protocol events and keeps stable tool progress bound to one remote session", () => {
    let state = reduceAgentSession(initialAgentSessionState("ses_android_1"), {
      type: "prompt.submitted",
      id: "usr_android_1",
      text: "Build the fixture",
    })
    expect(state.transcript).toEqual([{ id: "usr_android_1", type: "user", text: "Build the fixture" }])
    ;[
      frame(1, "turn.output", { text: "I’ll inspect the workspace." }),
      frame(2, "turn.reasoning", { text: "Finding the smallest change." }),
      frame(3, "plan.available", {
        plan: {
          id: "pln_android_1",
          path: "/work/project/.slopcode/plans/current.md",
          revision: 1,
          content: "1. Inspect\n2. Build",
        },
      }),
      frame(4, "tool.updated", {
        tool: {
          id: "tol_android_1",
          title: "Run tests",
          status: "in_progress",
          kind: "execute",
          metadata: { progress: "1/2", path: "/work/project", test: "unit", result: "running" },
        },
      }),
      frame(5, "turn.retry", { reason: "The first check timed out." }),
      frame(6, "artifact.created", {
        artifact: {
          id: "art_android_1",
          name: "result.png",
          path: "/work/project/result.png",
          kind: "image",
          size: 42,
          mime: "image/png",
        },
      }),
    ].forEach((value) => {
      state = reduceAgentSession(state, { type: "event.received", value })
    })

    const before = state.transcript.map((item) => item.id)
    state = reduceAgentSession(state, {
      type: "event.received",
      value: frame(7, "tool.updated", {
        tool: {
          id: "tol_android_1",
          title: "Run tests",
          status: "completed",
          kind: "execute",
          metadata: { progress: "2/2", path: "/work/project", test: "unit", result: "passed", exitCode: "0" },
        },
      }),
    })
    expect(state.transcript.map((item) => item.id)).toEqual(before)
    expect(state.transcript.find((item) => item.id === "tol_android_1")).toMatchObject({
      status: "completed",
      metadata: { progress: "2/2", test: "unit", result: "passed", exitCode: "0" },
    })
    expect(state.lastCursor).toBe("cur_7")

    state = reduceAgentSession(state, {
      type: "event.received",
      value: frame(12, "turn.output", { text: "Global sequence gaps belong to other sessions." }),
    })
    expect(state.transcript.at(-1)).toMatchObject({
      type: "output",
      text: "Global sequence gaps belong to other sessions.",
    })
    expect(state.lastCursor).toBe("cur_12")

    const crossed = reduceAgentSession(state, {
      type: "event.received",
      value: { ...frame(13, "turn.output", { text: "Wrong session" }), sessionID: "ses_android_2" },
    })
    expect(crossed).toEqual(state)
  })

  test("projects approval, question, completion, and local failure as typed entries", () => {
    let state = initialAgentSessionState("ses_android_1")
    state = reduceAgentSession(state, {
      type: "event.received",
      value: frame(1, "interaction.approval.requested", {
        interaction: {
          id: "int_approval_1",
          revision: 1,
          title: "Write files",
          command: "mkdir fixture",
          cwd: "/work/project",
          risk: "low",
        },
      }),
    })
    state = reduceAgentSession(state, {
      type: "interaction.resolved",
      id: "int_approval_1",
      decision: "rejected",
    })
    state = reduceAgentSession(state, {
      type: "event.received",
      value: frame(2, "interaction.question.requested", {
        interaction: {
          id: "int_question_1",
          revision: 1,
          prompt: "Use TypeScript?",
          options: ["Yes", "No"],
          allowFreeform: true,
        },
      }),
    })
    state = reduceAgentSession(state, {
      type: "event.received",
      value: frame(3, "turn.completed", { status: "completed", message: "Done" }),
    })
    state = reduceAgentSession(state, {
      type: "interaction.resolved",
      id: "int_question_1",
      answer: "Use TypeScript",
    })
    state = reduceAgentSession(state, { type: "failure.added", id: "failure_1", message: "Connection lost" })

    expect(state.transcript.map((item) => item.type)).toEqual(["approval", "question", "completion", "failure"])
    expect(state.transcript[0]).toMatchObject({ type: "approval", resolved: true, decision: "rejected" })
    expect(state.transcript[1]).toMatchObject({ type: "question", resolved: true, answer: "Use TypeScript" })
    expect(state.transcript[2]).toMatchObject({ type: "completion", status: "completed", message: "Done" })
  })

  test("derives honest review metadata without manufacturing unavailable content", () => {
    const transcript = [
      {
        id: "tol_edit_1",
        type: "tool" as const,
        title: "Edit app.ts",
        status: "completed",
        kind: "edit",
        metadata: { path: "/work/project/app.ts", progress: "done" },
      },
      {
        id: "tol_test_1",
        type: "tool" as const,
        title: "Run unit tests",
        status: "completed",
        kind: "execute",
        metadata: { test: "unit", result: "passed", exitCode: "0" },
      },
      {
        id: "art_diff_1",
        type: "artifact" as const,
        name: "changes.diff",
        path: "/work/project/changes.diff",
        kind: "diff",
        size: 128,
      },
      {
        id: "art_file_1",
        type: "artifact" as const,
        name: "app.ts",
        path: "/work/project/app.ts",
        kind: "file",
        size: 256,
      },
      {
        id: "art_image_1",
        type: "artifact" as const,
        name: "result.png",
        path: "/work/project/result.png",
        kind: "image",
        size: 512,
        mime: "image/png",
      },
    ]

    expect(reviewItems(transcript, "changes").map((item) => item.id)).toEqual(["tol_edit_1", "art_diff_1"])
    expect(reviewItems(transcript, "files").map((item) => item.id)).toEqual(["tol_edit_1", "art_diff_1", "art_file_1"])
    expect(reviewItems(transcript, "tests").map((item) => item.id)).toEqual(["tol_test_1"])
    expect(reviewItems(transcript, "screenshots").map((item) => item.id)).toEqual(["art_image_1"])
    expect(reviewItems([], "changes")).toEqual([])
  })
})

describe("Android agent session persistence", () => {
  test("persists negotiated backend metadata and deduplicates replayed events", async () => {
    const data = memory()
    let state = reduceAgentSession(initialAgentSessionState("ses_android_1"), {
      type: "backend.connected",
      version: "codex 2.0.0",
      mode: "app_server",
      capabilities: ["workspace", "sessions", "turns", "replay", "cancel"],
    })
    state = reduceAgentSession(state, { type: "event.received", value: frame(1, "turn.output", { text: "once" }) })
    state = reduceAgentSession(state, { type: "event.received", value: frame(1, "turn.output", { text: "duplicate" }) })
    await writeAgentSession(data.storage, workspace, state)
    const restored = await readAgentSession(data.storage, workspace)
    expect(restored).toMatchObject({ backendVersion: "codex 2.0.0", backendMode: "app_server", lastSequence: 1 })
    expect(restored?.capabilities).toContain("cancel")
    expect(restored?.transcript.filter((item) => item.type === "output")).toHaveLength(1)
  })

  test("persists a session-bound redacted projection without interaction commands", async () => {
    const data = memory()
    let state = reduceAgentSession(initialAgentSessionState("ses_android_1"), {
      type: "draft.changed",
      value: "password=draft-secret",
    })
    state = reduceAgentSession(state, {
      type: "prompt.submitted",
      id: "usr_android_1",
      text: "Use api_key=prompt-secret and continue",
    })
    state = reduceAgentSession(state, {
      type: "event.received",
      value: frame(1, "turn.output", {
        text: "Authorization: Bearer output-secret-token and ghp_123456789012345678901234567890123456",
      }),
    })
    state = reduceAgentSession(state, {
      type: "event.received",
      value: frame(2, "interaction.question.requested", {
        interaction: {
          id: "int_question_1",
          revision: 1,
          prompt: "What should the deployment use?",
          allowFreeform: true,
        },
      }),
    })
    state = reduceAgentSession(state, {
      type: "interaction.resolved",
      id: "int_question_1",
      answer: "The password is answer-secret",
    })
    state = reduceAgentSession(state, {
      type: "event.received",
      value: frame(3, "turn.reasoning", {
        text: "-----BEGIN OPENSSH PRIVATE KEY-----\nprivate-key-secret\n-----END OPENSSH PRIVATE KEY-----",
      }),
    })
    state = reduceAgentSession(state, {
      type: "event.received",
      value: frame(4, "tool.updated", {
        tool: {
          id: "tol_android_1",
          title: "Deploy token=tool-secret",
          status: "in_progress",
          kind: "execute",
          metadata: { summary: "password: metadata-secret", progress: "1/3", command: "unsafe-secret" },
        },
      }),
    })
    state = reduceAgentSession(state, {
      type: "event.received",
      value: frame(5, "interaction.approval.requested", {
        interaction: {
          id: "int_approval_1",
          revision: 1,
          title: "Deploy apiKey=approval-secret",
          command: "deploy --token command-secret",
          cwd: "/work/project",
          reason: "Use password=reason-secret",
          risk: "high",
        },
      }),
    })
    state = reduceAgentSession(state, {
      type: "interaction.resolved",
      id: "int_approval_1",
      decision: "approved",
    })

    await writeAgentSession(data.storage, workspace, state)
    const raw = data.values.get(sessionKey(workspace, "ses_android_1")) ?? ""
    ;[
      "draft-secret",
      "prompt-secret",
      "output-secret-token",
      "ghp_123456789012345678901234567890123456",
      "private-key-secret",
      "tool-secret",
      "metadata-secret",
      "unsafe-secret",
      "approval-secret",
      "command-secret",
      "reason-secret",
      "answer-secret",
    ].forEach((secret) => expect(raw).not.toContain(secret))
    expect(raw).toContain("[REDACTED")
    expect(raw).not.toContain("deploy --token")

    const restored = await readAgentSession(data.storage, workspace)
    expect(restored).toMatchObject({ version: 2, sessionID: "ses_android_1" })
    expect(restored?.transcript.find((item) => item.type === "approval")).toMatchObject({ detailsOmitted: true })
    expect(restored?.transcript.find((item) => item.type === "approval")).toMatchObject({
      resolved: true,
      decision: "approved",
    })
    expect(restored?.transcript.find((item) => item.type === "question")).toMatchObject({
      resolved: true,
      answerOmitted: true,
    })
    expect(restored?.transcript.find((item) => item.type === "question")).not.toHaveProperty("answer")
    expect(
      normalizeAgentSession({
        ...restored,
        password: "structural-secret",
        privateKey: "structural-secret",
        transcript: [{ id: "usr_safe", type: "user", text: "Safe", credential: "structural-secret" }],
      }),
    ).not.toHaveProperty("password")
  })

  test("never serializes natural-language credentials, OAuth codes, or provider tokens", async () => {
    const data = memory()
    const secrets = [
      "natural-password-value",
      "WDJB-MJHT",
      "access-token-value-123456",
      "refresh-token-value-123456",
      "api-token-value-123456",
      "authorization-code-value",
      "login-code-value",
      "credential-sentence-value",
      "4/0AXEQxICqNuVRq4CH9V0lLfUgGcsQ_pKJnSVwHw0UiQ373mKC",
      "a1b2-c3d4",
    ]
    const lines = [
      `The password is ${secrets[0]}`,
      `Use device code ${secrets[1]} to sign in`,
      `My access token is ${secrets[2]}`,
      `The refresh token: ${secrets[3]}`,
      `API token = ${secrets[4]}`,
      `Authorization code is ${secrets[5]}`,
      `Your login code is ${secrets[6]}`,
      `Use this credential ${secrets[7]} for the account`,
      `Continue with ${secrets[8]}`,
      `Enter ${secrets[9]} on the device page`,
    ]
    let state = reduceAgentSession(initialAgentSessionState("ses_android_1"), {
      type: "draft.changed",
      value: lines.join("\n"),
    })
    lines.forEach((line, index) => {
      state = reduceAgentSession(state, {
        type: "prompt.submitted",
        id: `usr_secret_${index}`,
        text: line,
      })
    })
    state = reduceAgentSession(state, {
      type: "event.received",
      value: frame(20, "interaction.question.requested", {
        interaction: {
          id: "int_secret_answer",
          revision: 1,
          prompt: "Paste the login result",
          allowFreeform: true,
        },
      }),
    })
    state = reduceAgentSession(state, {
      type: "interaction.resolved",
      id: "int_secret_answer",
      answer: lines.join("\n"),
    })

    await writeAgentSession(data.storage, workspace, state)
    const raw = data.values.get(sessionKey(workspace, "ses_android_1")) ?? ""
    secrets.forEach((secret) => expect(raw).not.toContain(secret))
    expect(raw).toContain("[REDACTED")
    const restored = await readAgentSession(data.storage, workspace)
    expect(restored?.transcript.find((item) => item.id === "int_secret_answer")).toMatchObject({
      type: "question",
      resolved: true,
      answerOmitted: true,
    })
    expect(restored?.transcript.find((item) => item.id === "int_secret_answer")).not.toHaveProperty("answer")
    secrets.forEach((secret) => expect(JSON.stringify(restored)).not.toContain(secret))
  })

  test("enforces a total UTF-8 serialized bound below the Android bridge value limit", async () => {
    const data = memory()
    let state = initialAgentSessionState("ses_android_1")
    Array.from({ length: 220 }, (_, index) => index + 1).forEach((sequence) => {
      state = reduceAgentSession(state, {
        type: "event.received",
        value: frame(sequence, sequence % 2 ? "turn.output" : "turn.reasoning", {
          text: `${sequence}:${"🙂".repeat(4_000)}`,
        }),
      })
    })

    await writeAgentSession(data.storage, workspace, state)
    const raw = data.values.get(sessionKey(workspace, "ses_android_1")) ?? ""
    expect(new TextEncoder().encode(raw).byteLength).toBeLessThanOrEqual(MAX_PERSISTED_AGENT_SESSION_BYTES)
    expect(MAX_PERSISTED_AGENT_SESSION_BYTES).toBeLessThan(192 * 1024)
    expect((await readAgentSession(data.storage, workspace))?.transcript.at(-1)?.id).toBe(state.transcript.at(-1)?.id)
  })

  test("keeps concurrent provider interactions available until each one is resolved", () => {
    const state = [
      frame(1, "interaction.approval.requested", {
        interaction: { id: "int_permissions", revision: 1, title: "Allow workspace access" },
      }),
      frame(2, "interaction.approval.requested", {
        interaction: { id: "int_command", revision: 1, title: "Create project", command: "mkdir project" },
      }),
    ].reduce(
      (current, value) => reduceAgentSession(current, { type: "event.received", value }),
      initialAgentSessionState("ses_android_1"),
    )

    expect(pendingInteraction(state.transcript)?.id).toBe("int_command")
    expect(pendingInteraction(state.transcript, "int_command")?.id).toBe("int_permissions")
    const resolved = reduceAgentSession(state, {
      type: "interaction.resolved",
      id: "int_command",
      decision: "approved",
    })
    expect(pendingInteraction(resolved.transcript)?.id).toBe("int_permissions")
  })

  test("uses opaque workspace and remote-session scope and refuses a different expected session", async () => {
    const data = memory()
    const first = sessionKey(workspace, "ses_android_1")
    expect(sessionKey(workspace, "ses_android_1")).toBe(first)
    expect(sessionKey({ ...workspace, directory: "/work/other" }, "ses_android_1")).not.toBe(first)
    expect(sessionKey(workspace, "ses_android_2")).not.toBe(first)
    expect(first).not.toContain(workspace.profile)
    expect(first).not.toContain(workspace.directory)
    expect(first).not.toContain("ses_android_1")

    await writeAgentSession(data.storage, workspace, initialAgentSessionState("ses_android_1"))
    await expect(readAgentSession(data.storage, workspace, "ses_android_2")).resolves.toBeUndefined()
    await expect(readAgentSession(data.storage, workspace, "ses_android_1")).resolves.toMatchObject({
      sessionID: "ses_android_1",
    })
  })
})
