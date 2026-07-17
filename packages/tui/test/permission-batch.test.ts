import { expect, test } from "bun:test"
import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import {
  createPermissionBatchState,
  permissionBatchActions,
  permissionBatchMove,
  permissionBatchPersistent,
  permissionBatchReply,
  permissionBatchSubmit,
  permissionBatchSync,
  permissionBatchToggle,
  permissionQueue,
} from "../src/routes/session/permission-batch"

function request(id: string, kind?: "forecast", batchID?: string, always = [id]): PermissionRequest {
  return {
    id,
    sessionID: "ses_test",
    permission: "bash",
    patterns: [id],
    metadata: {},
    always,
    grant: { resources: [id], scopes: ["session", "global"] },
    kind,
    batchID,
  }
}

test("ordinary permissions remain FIFO and are never mixed into forecast batches", () => {
  const forecast = request("per_forecast", "forecast", "pmb_one")
  const first = request("per_first")
  const second = request("per_second")

  expect(permissionQueue([forecast, first, second])).toEqual([first])
  expect(permissionQueue([forecast, request("per_other", "forecast", "pmb_two")])).toEqual([forecast])
  expect(permissionQueue([forecast, request("per_same", "forecast", "pmb_one")])).toHaveLength(2)
})

test("batch keyboard and mouse state wraps focus and toggles exact rows", () => {
  const requests = [request("per_a", "forecast", "pmb_one"), request("per_b", "forecast", "pmb_one")]
  const initial = createPermissionBatchState(requests)

  expect(initial).toMatchObject({ focused: 0, selected: ["per_a", "per_b"], stage: "review" })
  expect(permissionBatchMove(initial, requests, -1).focused).toBe(1)
  expect(permissionBatchToggle(initial, "per_a").selected).toEqual(["per_b"])
  expect(permissionBatchToggle(permissionBatchToggle(initial, "per_a"), "per_a").selected).toEqual(["per_b", "per_a"])
})

test("session batch approval is immediate while project approval requires confirmation", () => {
  const requests = [request("per_a", "forecast", "pmb_one"), request("per_b", "forecast", "pmb_one")]
  const initial = createPermissionBatchState(requests)
  expect(permissionBatchReply(initial, requests, "always").reply).toEqual({
    batchID: "pmb_one",
    requestIDs: ["per_a", "per_b"],
    reply: "always",
  })
  const confirm = permissionBatchReply(initial, requests, "project")

  expect(confirm.state.stage).toBe("project")
  expect(confirm.reply).toBeUndefined()
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
  expect(permissionBatchActions(initial, requests, "project")).toEqual({
    once: "Allow selected once",
    always: "Allow selected for this session",
    project: "Always allow selected for this project",
    reject: "Reject all",
  })
  expect(permissionBatchActions(initial, requests, undefined)).toEqual({
    once: "Allow selected once",
    always: "Allow selected for this session",
    reject: "Reject all",
  })
})

test("project batch approval derives eligibility from selected rows and revalidates confirmation", () => {
  const requests = [request("per_saved", "forecast", "pmb_one"), request("per_once", "forecast", "pmb_one", [])]
  const initial = createPermissionBatchState(requests)

  expect(permissionBatchPersistent(initial, requests)).toBe(false)
  expect(permissionBatchActions(initial, requests, "folder")).toEqual({
    once: "Allow selected once",
    reject: "Reject all",
  })
  expect(permissionBatchReply(initial, requests, "project").state.stage).toBe("review")
  expect(permissionBatchReply(initial, requests, "always").reply).toBeUndefined()

  const selected = permissionBatchToggle(initial, "per_once")
  expect(permissionBatchPersistent(selected, requests)).toBe(true)
  expect(permissionBatchActions(selected, requests, "folder")).toHaveProperty(
    "project",
    "Always allow selected for this folder",
  )
  const confirm = permissionBatchReply(selected, requests, "project")
  expect(confirm.state.stage).toBe("project")

  const changed = requests.map((item) => (item.id === "per_saved" ? { ...item, always: [] } : item))
  const invalid = permissionBatchReply(confirm.state, changed, "confirm")
  expect(invalid.state.stage).toBe("review")
  expect(invalid.reply).toBeUndefined()
})

test("late non-persistable rows close project confirmation", () => {
  const initial = [request("per_saved", "forecast", "pmb_one")]
  const confirm = permissionBatchReply(createPermissionBatchState(initial), initial, "project").state
  const requests = [...initial, request("per_once", "forecast", "pmb_one", [])]

  expect(permissionBatchSync(confirm, requests)).toMatchObject({
    stage: "review",
    selected: ["per_saved", "per_once"],
  })
})

test("incremental batch events preserve deselection and select only new requests", () => {
  const initial = [request("per_a", "forecast", "pmb_one"), request("per_b", "forecast", "pmb_one")]
  const deselected = permissionBatchToggle(createPermissionBatchState(initial), "per_a")
  const requests = [...initial, request("per_c", "forecast", "pmb_one")]

  expect(permissionBatchSync(deselected, requests)).toMatchObject({
    requestIDs: ["per_a", "per_b", "per_c"],
    selected: ["per_b", "per_c"],
  })
})

test("generated SDK errors reset submission state and allow a successful retry", async () => {
  let submitting = true
  const errors: unknown[] = []
  let attempt = 0
  const send = () =>
    attempt++ === 0
      ? Promise.resolve({ error: new Error("temporary persistence failure") })
      : attempt === 2
        ? Promise.reject(new Error("temporary transport failure"))
        : Promise.resolve({ data: true, error: undefined })

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
  ).toBe(false)
  expect(submitting).toBe(false)
  expect(attempt).toBe(2)

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
  expect(errors).toHaveLength(2)
  expect(attempt).toBe(3)
})
