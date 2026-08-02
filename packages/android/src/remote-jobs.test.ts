import { describe, expect, test } from "bun:test"
import {
  applyRemoteJobEvent,
  parseRemoteJob,
  parseRemoteJobEvent,
  parseRemoteJobMessage,
  parseRemoteSessionDeepLink,
  remoteJobDeepLink,
  remoteJobStatusLabel,
} from "./remote-jobs"

const job = parseRemoteJob({
  id: "job_1",
  sessionID: "ses_1",
  serverUrl: "https://desktop.example.test",
  workspaceID: "wrk_1",
  directory: "/repo",
  agent: "codex-cli",
  status: "running",
  updatedAt: 1,
})!

describe("Android durable remote jobs", () => {
  test("parses bounded persisted job state and creates an exact-session deep link", () => {
    expect(job.id).toBe("job_1")
    expect(remoteJobDeepLink(job)).toBe("slopcode://remote-session?job=job_1&session=ses_1")
    expect(remoteJobStatusLabel("waiting_approval")).toBe("waiting approval")
    expect(parseRemoteJob({ ...job, directory: "../escape" })).toBeUndefined()
    expect(parseRemoteSessionDeepLink(remoteJobDeepLink(job))).toEqual({ jobID: "job_1", sessionID: "ses_1" })
    expect(parseRemoteSessionDeepLink("slopcode://remote-session?job=job_1&session=")).toBeUndefined()
  })

  test("applies progress, approval, completion, and failure events", () => {
    const progress = applyRemoteJobEvent(
      job,
      parseRemoteJobEvent({ id: "evt_1", jobID: "job_1", type: "job.progress", data: { progress: 0.5 } })!,
    )
    expect(progress.status).toBe("running")
    expect(progress.progress).toBe(0.5)

    const approval = applyRemoteJobEvent(
      progress,
      parseRemoteJobEvent({ id: "evt_2", jobID: "job_1", type: "job.approval", data: { approval: "Write files" } })!,
    )
    expect(approval.status).toBe("waiting_approval")
    expect(approval.approval).toEqual({ title: "Write files" })

    const completed = applyRemoteJobEvent(
      approval,
      parseRemoteJobEvent({
        id: "evt_3",
        jobID: "job_1",
        type: "job.completed",
        data: { output: "done" },
      })!,
    )
    expect(completed.status).toBe("completed")
    expect(completed.output).toBe("done")

    const failed = applyRemoteJobEvent(
      job,
      parseRemoteJobEvent({ id: "evt_4", jobID: "job_1", type: "job.failed", data: { error: "offline" } })!,
    )
    expect(failed.status).toBe("failed")
    expect(failed.error).toBe("offline")
  })

  test("ignores duplicate cursors and rejects untrusted event envelopes", () => {
    const event = parseRemoteJobEvent({
      id: "evt_1",
      cursor: "42",
      jobID: "job_1",
      type: "job.progress",
      data: { output: "a" },
    })!
    const next = applyRemoteJobEvent(job, event)
    expect(applyRemoteJobEvent(next, event)).toEqual(next)
    expect(parseRemoteJobMessage({ type: "slopcode.remote-job", channel: "bad", nonce: "n", event }, "n")).toBeUndefined()
    expect(
      parseRemoteJobMessage(
        { type: "slopcode.remote-job", channel: "slopcode.android.remote-jobs", nonce: "n", event },
        "n",
      ),
    ).toEqual({ event })
  })

  test("parses structured approval context, questions, and review artifacts", () => {
    const event = parseRemoteJobEvent({
      id: "evt_5",
      jobID: "job_1",
      type: "job.question",
      data: {
        commandPreview: { executable: "codex", args: ["exec", "<prompt>"], cwd: "/repo" },
        question: { prompt: "Which test suite?", options: ["unit", "integration"] },
        review: {
          files: [{ path: "/repo/a.ts", status: "modified", additions: 2, deletions: 1, diff: "@@" }],
          tests: [{ name: "unit", status: "passed" }],
          screenshots: [{ name: "preview", mime: "image/png", data: "data:image/png;base64,AA==" }],
          comments: [],
        },
      },
    })!
    const next = applyRemoteJobEvent(job, event)
    expect(next.status).toBe("waiting_question")
    expect(next.commandPreview?.executable).toBe("codex")
    expect(next.question?.options).toEqual(["unit", "integration"])
    expect(next.review?.files[0]?.path).toBe("/repo/a.ts")
    expect(next.review?.tests[0]?.status).toBe("passed")
    expect(next.review?.screenshots[0]?.mime).toBe("image/png")
  })

  test("keeps review comments actionable after a terminal event", () => {
    const completed = applyRemoteJobEvent(
      job,
      parseRemoteJobEvent({ id: "evt_6", jobID: "job_1", type: "job.completed", data: {} })!,
    )
    const commented = applyRemoteJobEvent(
      completed,
      parseRemoteJobEvent({
        id: "evt_7",
        jobID: "job_1",
        type: "job.review.updated",
        data: {
          review: {
            files: [],
            tests: [],
            screenshots: [],
            comments: [{ id: "comment_1", path: "/repo/a.ts", line: 4, body: "Please add a test.", createdAt: 1 }],
          },
        },
      })!,
    )
    expect(commented.status).toBe("completed")
    expect(commented.review?.comments[0]?.body).toBe("Please add a test.")
  })
})
