import { describe, expect, test } from "bun:test"
import { resolveRemoteSession } from "./remote-session-recovery"
import type { RemoteJob } from "./remote-jobs"

const job = {
  id: "job_1",
  sessionID: "ses_1",
  serverUrl: "https://desktop.example.test",
  workspaceID: "wrk_1",
  directory: "/repo",
  agent: "codex-cli",
  status: "stopped",
  cursor: "evt_4",
  updatedAt: 1,
} satisfies RemoteJob

describe("remote session deep-link recovery", () => {
  test("keeps an exact stopped session actionable after process relaunch", () => {
    expect(resolveRemoteSession({ jobID: "job_1", sessionID: "ses_1" }, [job])).toEqual({
      session: { jobID: "job_1", sessionID: "ses_1" },
    })
  })

  test("explains stale or mismatched deep links instead of silently routing", () => {
    expect(resolveRemoteSession({ jobID: "job_missing" }, [job])).toEqual({
      error: "Session unavailable or expired. Choose a workspace or start a new session.",
    })
    expect(resolveRemoteSession({ jobID: "job_1", sessionID: "ses_other" }, [job])).toEqual({
      error: "Session unavailable or expired. Choose a workspace or start a new session.",
    })
  })
})
