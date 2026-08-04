import { describe, expect, test } from "bun:test"
import {
  canRetry,
  canSubmit,
  cleanupAgenticStart,
  handoffToInteractive,
  initialSshMode,
  reconnectAgentic,
  returnToAgentic,
  stopAgentic,
} from "./ssh-session-flow"

describe("SSH session handoff", () => {
  test("opens Antigravity directly in interactive PTY mode", () => {
    expect(initialSshMode("antigravity-cli")).toBe("interactive")
    expect(initialSshMode("opencode-cli")).toBe("prompt")
    expect(initialSshMode("codex-cli")).toBe("prompt")
  })

  test("stops and closes the agentic bridge before opening the interactive CLI", async () => {
    const calls: string[] = []
    await handoffToInteractive(
      { orchestratorStop: async () => void calls.push("stop") },
      () => void calls.push("close"),
      (view) => void calls.push(view),
    )
    expect(calls).toEqual(["stop", "close", "interactive"])
  })

  test("keeps the agentic screen selected when stopping the orchestrator fails", async () => {
    const calls: string[] = []
    await expect(
      handoffToInteractive(
        { orchestratorStop: async () => Promise.reject(new Error("stop failed")) },
        () => void calls.push("close"),
        (view) => void calls.push(view),
      ),
    ).rejects.toThrow("stop failed")
    expect(calls).toEqual([])
  })

  test("clears and closes a failed startup before stopping its native orchestrator", async () => {
    const calls: string[] = []
    await cleanupAgenticStart(
      { orchestratorStop: async () => void calls.push("stop") },
      () => void calls.push("clear"),
      () => void calls.push("close"),
      true,
    )
    expect(calls).toEqual(["clear", "close", "stop"])
  })

  test("does not stop a native orchestrator that never started", async () => {
    const calls: string[] = []
    await cleanupAgenticStart(
      { orchestratorStop: async () => void calls.push("stop") },
      () => void calls.push("clear"),
      () => void calls.push("close"),
      false,
    )
    expect(calls).toEqual(["clear", "close"])
  })

  test("stops before reconnecting and cleans only the PTY before returning", async () => {
    const calls: string[] = []
    await reconnectAgentic(
      { orchestratorStop: async () => void calls.push("stop") },
      () => void calls.push("close"),
      undefined,
      async () => void calls.push("start"),
    )
    await returnToAgentic({ cleanup: async () => void calls.push("cleanup") }, (view) => void calls.push(view))
    expect(calls).toEqual(["stop", "close", "start", "cleanup", "agentic"])
  })

  test("requires reconnect before stopped sessions can submit or retry", () => {
    expect(canSubmit("stopped")).toBe(false)
    expect(canRetry("stopped", "ses_stopped", true)).toBe(false)
    expect(canSubmit("ready")).toBe(true)
    expect(canRetry("error", "ses_error", true)).toBe(true)
  })

  test("preserves the stopped prompt through reconnect before retry becomes available", async () => {
    const calls: string[] = []
    await reconnectAgentic(
      { orchestratorStop: async () => void calls.push("stop") },
      () => void calls.push("close"),
      "review the diff",
      async (prompt) => void calls.push(`start:${prompt}`),
    )
    expect(calls).toEqual(["stop", "close", "start:review the diff"])
    expect(canRetry("ready", "ses_fresh", true)).toBe(true)
  })
})
