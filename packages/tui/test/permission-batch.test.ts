import { expect, test } from "bun:test"
import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import {
  createPermissionBatchState,
  permissionBatchMove,
  permissionBatchReply,
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

test("persistent batch approval requires confirmation and skip selects nothing", () => {
  const requests = [request("per_a", "forecast", "pmb_one"), request("per_b", "forecast", "pmb_one")]
  const initial = createPermissionBatchState(requests)
  const confirm = permissionBatchReply(initial, requests, "always")

  expect(confirm.state.stage).toBe("always")
  expect(confirm.reply).toBeUndefined()
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
