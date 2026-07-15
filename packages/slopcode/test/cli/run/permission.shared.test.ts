import { describe, expect, test } from "bun:test"
import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import {
  createPermissionBodyState,
  permissionAlwaysLines,
  permissionCancel,
  permissionEscape,
  permissionInfo,
  permissionOptions,
  permissionReject,
  permissionRun,
  createPermissionBatchState,
  permissionBatchMove,
  permissionBatchReply,
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

  test("requires confirmation for allow always", () => {
    const next = permissionRun(createPermissionBodyState("perm-1"), "perm-1", "always")
    expect(next.state.stage).toBe("always")
    expect(next.state.selected).toBe("confirm")
    expect(next.reply).toBeUndefined()

    expect(permissionRun(next.state, "perm-1", "confirm").reply).toEqual({
      requestID: "perm-1",
      reply: "always",
    })

    expect(permissionRun(next.state, "perm-1", "cancel").state).toMatchObject({
      stage: "permission",
      selected: "always",
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

    expect(permissionEscape({ ...next.state, stage: "always", selected: "confirm" })).toMatchObject({
      stage: "permission",
      selected: "always",
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

  test("formats always-allow copy for wildcard and explicit patterns", () => {
    expect(permissionAlwaysLines(req({ permission: "bash", always: ["*"] }))).toEqual([
      "This will remember bash for this project until revoked.",
    ])

    expect(permissionAlwaysLines(req({ always: ["src/**/*.ts", "src/**/*.tsx"] }))).toEqual([
      "This will remember the following patterns for this project until revoked.",
      "- src/**/*.ts",
      "- src/**/*.tsx",
    ])
  })

  test("hides persistent actions and copy when no resources can be saved", () => {
    expect(permissionOptions("permission", false)).toEqual(["once", "reject"])
    expect(permissionAlwaysLines(req({ always: [] }))).toEqual([])
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
    const confirm = permissionBatchReply(initial, requests, "always")
    expect(confirm.reply).toBeUndefined()
    expect(confirm.state.stage).toBe("always")
    expect(permissionBatchReply(confirm.state, requests, "confirm").reply).toEqual({
      batchID: "pmb_one",
      requestIDs: ["per_a", "per_b"],
      reply: "always",
    })
    expect(permissionBatchReply(initial, requests, "skip").reply).toEqual({
      batchID: "pmb_one",
      requestIDs: [],
      reply: "reject",
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
})
