import { describe, expect, test } from "bun:test"
import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import {
  createPermissionBodyState,
  permissionProjectLines,
  permissionCancel,
  permissionEscape,
  permissionInfo,
  permissionOptions,
  permissionReject,
  permissionRun,
  permissionShift,
  createPermissionBatchState,
  permissionBatchMove,
  permissionBatchPersistent,
  permissionBatchReply,
  permissionBatchSubmit,
  permissionBatchSync,
  permissionBatchToggle,
  permissionQueue,
} from "@/cli/cmd/run/permission.shared"

function req(input: Partial<PermissionRequest> = {}): PermissionRequest {
  return {
    id: "perm-1",
    sessionID: "session-1",
    permission: "read",
    patterns: [],
    metadata: {},
    always: [],
    ...input,
  }
}

describe("run permission shared", () => {
  test("replies immediately for allow once", () => {
    const out = permissionRun(createPermissionBodyState("perm-1"), "perm-1", "once")

    expect(out.reply).toEqual({
      requestID: "perm-1",
      reply: "once",
    })
  })

  test("allows a session grant directly and requires confirmation for project grants", () => {
    expect(permissionRun(createPermissionBodyState("perm-1"), "perm-1", "always").reply).toEqual({
      requestID: "perm-1",
      reply: "always",
    })
    const next = permissionRun(createPermissionBodyState("perm-1"), "perm-1", "project")
    expect(next.state.stage).toBe("project")
    expect(next.state.selected).toBe("confirm")
    expect(next.reply).toBeUndefined()

    expect(permissionRun(next.state, "perm-1", "confirm").reply).toEqual({
      requestID: "perm-1",
      reply: "project",
    })

    expect(permissionRun(next.state, "perm-1", "cancel").state).toMatchObject({
      stage: "permission",
      selected: "project",
    })
  })

  test("builds trimmed reject replies and stage transitions", () => {
    const next = permissionRun(createPermissionBodyState("perm-1"), "perm-1", "reject")
    expect(next.state.stage).toBe("reject")

    const out = permissionReject({ ...next.state, message: "  use rg  " }, "perm-1")
    expect(out).toEqual({
      requestID: "perm-1",
      reply: "reject",
      message: "use rg",
    })

    expect(permissionCancel(next.state)).toMatchObject({
      stage: "permission",
      selected: "reject",
    })

    expect(permissionEscape(createPermissionBodyState("perm-1"))).toMatchObject({
      stage: "reject",
      selected: "reject",
    })

    expect(permissionEscape({ ...next.state, stage: "project", selected: "confirm" })).toMatchObject({
      stage: "permission",
      selected: "project",
    })
  })

  test("maps supported permission types into display info", () => {
    expect(
      permissionInfo(
        req({
          permission: "bash",
          metadata: {
            input: {
              command: "git status --short",
            },
          },
        }),
      ),
    ).toMatchObject({
      title: "Shell command",
      lines: ["$ git status --short"],
    })

    expect(
      permissionInfo(
        req({
          permission: "task",
          metadata: {
            description: "investigate stream",
            subagent_type: "general",
          },
        }),
      ),
    ).toMatchObject({
      title: "General Task",
      lines: ["◉ investigate stream"],
    })

    expect(
      permissionInfo(
        req({
          permission: "external_directory",
          patterns: ["/tmp/work/**/*.ts", "/tmp/work/**/*.tsx"],
        }),
      ),
    ).toMatchObject({
      title: "Access external directory /tmp/work",
      lines: ["- /tmp/work/**/*.ts", "- /tmp/work/**/*.tsx"],
    })

    expect(permissionInfo(req({ permission: "doom_loop" }))).toMatchObject({
      title: "Continue after repeated failures",
    })

    expect(permissionInfo(req({ permission: "custom_tool" }))).toMatchObject({
      title: "Call tool custom_tool",
      lines: ["Tool: custom_tool"],
    })
  })

  test("formats durable copy without interpreting wildcard characters", () => {
    expect(permissionProjectLines(req({ permission: "bash", always: ["echo *", "file?.txt"] }), "folder")).toEqual([
      "This approval survives restarts and remains active for this folder until revoked.",
      "The following exact patterns will always be allowed:",
      "- echo *",
      "- file?.txt",
    ])
  })

  test("hides persistent actions and copy when no resources can be saved", () => {
    expect(permissionOptions("permission", false)).toEqual(["once", "reject"])
    expect(permissionProjectLines(req(), "project")).toEqual([])
  })

  test("keeps session approval but hides durable approval when scope is unknown", () => {
    expect(permissionOptions("permission", true, false)).toEqual(["once", "always", "reject"])
    const initial = createPermissionBodyState("perm-1")
    const always = permissionShift(initial, 1, true, false)
    const reject = permissionShift(always, 1, true, false)
    const wrapped = permissionShift(reject, 1, true, false)

    expect([initial.selected, always.selected, reject.selected, wrapped.selected]).toEqual([
      "once",
      "always",
      "reject",
      "once",
    ])
  })

  test("keeps ordinary requests FIFO and groups only one forecast batch", () => {
    const forecast = req({ id: "per_forecast", kind: "forecast", batchID: "pmb_one" })
    const first = req({ id: "per_first" })
    const second = req({ id: "per_second" })

    expect(permissionQueue([forecast, first, second])).toEqual([first])
    expect(
      permissionQueue([
        forecast,
        req({ id: "per_same", kind: "forecast", batchID: "pmb_one" }),
        req({ id: "per_other", kind: "forecast", batchID: "pmb_two" }),
      ]),
    ).toHaveLength(2)
  })

  test("supports keyboard selection and confirmed persistent replies for forecast batches", () => {
    const requests = [
      req({ id: "per_a", kind: "forecast", batchID: "pmb_one", always: ["git status"] }),
      req({ id: "per_b", kind: "forecast", batchID: "pmb_one", always: ["README.md"] }),
    ]
    const initial = createPermissionBatchState(requests)

    expect(permissionBatchMove(initial, requests, -1).focused).toBe(1)
    expect(permissionBatchToggle(initial, "per_a").selected).toEqual(["per_b"])
    expect(permissionBatchReply(initial, requests, "always").reply).toMatchObject({ reply: "always" })
    const confirm = permissionBatchReply(initial, requests, "project")
    expect(confirm.reply).toBeUndefined()
    expect(confirm.state.stage).toBe("project")
    expect(permissionBatchReply(confirm.state, requests, "confirm").reply).toEqual({
      batchID: "pmb_one",
      requestIDs: ["per_a", "per_b"],
      reply: "project",
    })
    expect(permissionBatchReply(initial, requests, "reject").reply).toEqual({
      batchID: "pmb_one",
      requestIDs: [],
      reply: "reject",
    })
  })

  test("validates selected persistence before and during project confirmation", () => {
    const requests = [
      req({ id: "per_saved", kind: "forecast", batchID: "pmb_one", always: ["git status"] }),
      req({ id: "per_once", kind: "forecast", batchID: "pmb_one", always: [] }),
    ]
    const initial = createPermissionBatchState(requests)

    expect(permissionBatchPersistent(initial, requests)).toBe(false)
    expect(permissionBatchReply(initial, requests, "project").state.stage).toBe("review")

    const selected = permissionBatchToggle(initial, "per_once")
    expect(permissionBatchPersistent(selected, requests)).toBe(true)
    const confirm = permissionBatchReply(selected, requests, "project").state
    const changed = requests.map((item) => (item.id === "per_saved" ? { ...item, always: [] } : item))
    const invalid = permissionBatchReply(confirm, changed, "confirm")
    expect(invalid.state.stage).toBe("review")
    expect(invalid.reply).toBeUndefined()
    expect(permissionBatchReply(initial, requests, "always").reply).toBeUndefined()
  })

  test("late selected non-persistable rows close project confirmation", () => {
    const initial = [req({ id: "per_saved", kind: "forecast", batchID: "pmb_one", always: ["git status"] })]
    const confirm = permissionBatchReply(createPermissionBatchState(initial), initial, "project").state
    const requests = [...initial, req({ id: "per_once", kind: "forecast", batchID: "pmb_one", always: [] })]

    expect(permissionBatchSync(confirm, requests)).toMatchObject({
      stage: "review",
      selected: ["per_saved", "per_once"],
    })
  })

  test("preserves batch deselection when a later event adds a request", () => {
    const initial = [
      req({ id: "per_a", kind: "forecast", batchID: "pmb_one" }),
      req({ id: "per_b", kind: "forecast", batchID: "pmb_one" }),
    ]
    const deselected = permissionBatchToggle(createPermissionBatchState(initial), "per_a")
    const requests = [...initial, req({ id: "per_c", kind: "forecast", batchID: "pmb_one" })]

    expect(permissionBatchSync(deselected, requests)).toMatchObject({
      requestIDs: ["per_a", "per_b", "per_c"],
      selected: ["per_b", "per_c"],
    })
  })

  test("batch submission surfaces a failure, resets busy state, and retries", async () => {
    let submitting = true
    const errors: unknown[] = []
    let attempt = 0
    const send = async () => {
      attempt += 1
      if (attempt === 1) throw new Error("temporary API failure")
    }

    expect(
      await permissionBatchSubmit({
        send,
        error: (error) => errors.push(error),
        done: () => {
          submitting = false
        },
      }),
    ).toBe(false)
    expect(submitting).toBe(false)
    expect(errors[0]).toBeInstanceOf(Error)

    submitting = true
    expect(
      await permissionBatchSubmit({
        send,
        error: (error) => errors.push(error),
        done: () => {
          submitting = false
        },
      }),
    ).toBe(true)
    expect(submitting).toBe(false)
    expect(attempt).toBe(2)
  })
})
