import { describe, expect, test } from "bun:test"
import {
  canRetry,
  canSubmit,
  handoffToInteractive,
  reconnectAgentic,
  returnToAgentic,
  stopAgentic,
} from "./ssh-session-flow"

describe("SSH session handoff", () => {
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

  test("stops before reconnecting and cleans only the PTY before returning", async () => {
    const calls: string[] = []
    await reconnectAgentic(
      { orchestratorStop: async () => void calls.push("stop") },
      () => void calls.push("close"),
      async () => void calls.push("start"),
    )
    await returnToAgentic({ cleanup: async () => void calls.push("cleanup") }, (view) => void calls.push(view))
    expect(calls).toEqual(["stop", "close", "start", "cleanup", "agentic"])
  })

  test("requires reconnect before stopped sessions can submit or retry", () => {
    expect(canSubmit("stopped")).toBe(false)
    expect(canRetry("stopped")).toBe(false)
    expect(canSubmit("ready")).toBe(true)
    expect(canRetry("error")).toBe(true)
  })
})
