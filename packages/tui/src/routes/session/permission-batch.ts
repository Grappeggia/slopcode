import type { PermissionRequest } from "@slopcode-ai/sdk/v2"

export type PermissionBatchState = {
  stage: "review" | "project"
  focused: number
  requestIDs: string[]
  selected: string[]
}

export type PermissionBatchOption = "once" | "always" | "project" | "skip" | "confirm" | "cancel"

export type PermissionBatchReply = {
  batchID: string
  requestIDs: string[]
  reply: "once" | "always" | "project" | "reject"
}

export async function permissionBatchSubmit(input: {
  send: () => Promise<{ error?: unknown }>
  error: (error: unknown) => void
  done: () => void
}) {
  try {
    const result = await input.send()
    if (result.error) throw result.error
    return true
  } catch (error) {
    input.error(error)
    return false
  } finally {
    input.done()
  }
}

export function permissionQueue(requests: PermissionRequest[]) {
  const blocking = requests.find((item) => item.kind !== "forecast")
  if (blocking) return [blocking]
  const first = requests[0]
  if (!first?.batchID) return first ? [first] : []
  return requests.filter((item) => item.kind === "forecast" && item.batchID === first.batchID)
}

export function createPermissionBatchState(requests: PermissionRequest[]): PermissionBatchState {
  const requestIDs = requests.map((item) => item.id)
  return { stage: "review", focused: 0, requestIDs, selected: requestIDs }
}

export function permissionBatchSync(state: PermissionBatchState, requests: PermissionRequest[]): PermissionBatchState {
  const requestIDs = requests.map((item) => item.id)
  const known = new Set(state.requestIDs)
  return {
    ...state,
    focused: Math.min(state.focused, Math.max(requestIDs.length - 1, 0)),
    requestIDs,
    selected: [...state.selected.filter((id) => requestIDs.includes(id)), ...requestIDs.filter((id) => !known.has(id))],
  }
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
  if (option === "project" && state.stage === "review") return { state: { ...state, stage: "project" } }
  if (option === "cancel") return { state: { ...state, stage: "review" } }
  const batchID = requests[0]?.batchID
  if (!batchID) return { state }
  if (option === "skip") return { state, reply: { batchID, requestIDs: [], reply: "reject" } }
  if (!state.selected.length) return { state }
  if (option === "once") return { state, reply: { batchID, requestIDs: state.selected, reply: "once" } }
  if (option === "always") return { state, reply: { batchID, requestIDs: state.selected, reply: "always" } }
  if (option === "confirm" && state.stage === "project") {
    return { state, reply: { batchID, requestIDs: state.selected, reply: "project" } }
  }
  return { state }
}
