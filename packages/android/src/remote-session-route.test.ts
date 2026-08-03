import { describe, expect, test } from "bun:test"
import { sshRemoteSessionRoute } from "./ssh-remote-session"
import type { RemoteJob } from "./remote-jobs"

const job = {
  id: "job_1",
  sessionID: "ses_1",
  serverUrl: "https://desktop.example.test",
  workspaceID: "wrk_1",
  directory: "/repo",
  agent: "codex-cli",
  status: "stopped",
  updatedAt: 1,
} satisfies RemoteJob

describe("remote-session recovery routes", () => {
  test("opens an exact persisted remote session in the SSH durable-job view", () => {
    expect(sshRemoteSessionRoute({ jobID: "job_1", sessionID: "ses_1" }, [job])).toEqual({
      kind: "durable-job",
      job,
    })
  })

  test("keeps stale SSH links actionable recovery instead of opening an unrelated session", () => {
    expect(sshRemoteSessionRoute({ jobID: "job_1", sessionID: "ses_other" }, [job])).toEqual({
      kind: "recovery",
      message: "Session unavailable or expired. Choose a workspace or start a new session.",
    })
  })
})
