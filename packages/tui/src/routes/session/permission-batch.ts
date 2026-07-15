import type { PermissionRequest } from "@slopcode-ai/sdk/v2"

export type PermissionBatchState = {
  stage: "review" | "always"
  focused: number
  selected: string[]
}

export type PermissionBatchOption = "once" | "always" | "skip" | "confirm" | "cancel"

export type PermissionBatchReply = {
  batchID: string
  requestIDs: string[]
  reply: "once" | "always" | "reject"
}

export function permissionQueue(requests: PermissionRequest[]) {
  const blocking = requests.find((item) => item.kind !== "forecast")
  if (blocking) return [blocking]
  const first = requests[0]
  if (!first?.batchID) return first ? [first] : []
  return requests.filter((item) => item.kind === "forecast" && item.batchID === first.batchID)
}

export function createPermissionBatchState(requests: PermissionRequest[]): PermissionBatchState {
  return { stage: "review", focused: 0, selected: requests.map((item) => item.id) }
}

export function permissionBatchMove(state: PermissionBatchState, requests: PermissionRequest[], step: number) {
  if (!requests.length) return state
  return { ...state, focused: (state.focused + step + requests.length) % requests.length }
}

export function permissionBatchToggle(state: PermissionBatchState, requestID: string) {
  return {
    ...state,
    selected: state.selected.includes(requestID)
      ? state.selected.filter((item) => item !== requestID)
      : [...state.selected, requestID],
  }
}

export function permissionBatchReply(
  state: PermissionBatchState,
  requests: PermissionRequest[],
  option: PermissionBatchOption,
): { state: PermissionBatchState; reply?: PermissionBatchReply } {
  if (option === "always" && state.stage === "review") return { state: { ...state, stage: "always" } }
  if (option === "cancel") return { state: { ...state, stage: "review" } }
  const batchID = requests[0]?.batchID
  if (!batchID) return { state }
  if (option === "skip") return { state, reply: { batchID, requestIDs: [], reply: "reject" } }
  if (!state.selected.length) return { state }
  if (option === "once") return { state, reply: { batchID, requestIDs: state.selected, reply: "once" } }
  if (option === "confirm" && state.stage === "always") {
    return { state, reply: { batchID, requestIDs: state.selected, reply: "always" } }
  }
  return { state }
}
