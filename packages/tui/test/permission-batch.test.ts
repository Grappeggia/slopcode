import { expect, test } from "bun:test"
import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import {
  createPermissionBatchState,
  permissionBatchMove,
  permissionBatchReply,
  permissionBatchSubmit,
  permissionBatchSync,
  permissionBatchToggle,
  permissionQueue,
} from "../src/routes/session/permission-batch"

function request(id: string, kind?: "forecast", batchID?: string): PermissionRequest {
  return {
    id,
    sessionID: "ses_test",
    permission: "bash",
    patterns: [id],
    metadata: {},
    always: [id],
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

test("session batch approval is immediate while global approval requires confirmation", () => {
  const requests = [request("per_a", "forecast", "pmb_one"), request("per_b", "forecast", "pmb_one")]
  const initial = createPermissionBatchState(requests)
  expect(permissionBatchReply(initial, requests, "session").reply).toEqual({
    batchID: "pmb_one",
    requestIDs: ["per_a", "per_b"],
    reply: "session",
  })
  const confirm = permissionBatchReply(initial, requests, "global")

  expect(confirm.state.stage).toBe("global")
  expect(confirm.reply).toBeUndefined()
  expect(permissionBatchReply(confirm.state, requests, "confirm").reply).toEqual({
    batchID: "pmb_one",
    requestIDs: ["per_a", "per_b"],
    reply: "global",
  })
  expect(permissionBatchReply(initial, requests, "skip").reply).toEqual({
    batchID: "pmb_one",
    requestIDs: [],
    reply: "reject",
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
