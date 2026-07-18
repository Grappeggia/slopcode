import type { PermissionRequest } from "@slopcode-ai/sdk/v2"

export type PermissionBatchState = {
  stage: "review" | "project"
  focused: number
  requestIDs: string[]
  selected: string[]
}

export type PermissionBatchOption = "once" | "always" | "project" | "reject" | "confirm" | "cancel"

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
  const next = {
    ...state,
    focused: Math.min(state.focused, Math.max(requestIDs.length - 1, 0)),
    requestIDs,
    selected: [...state.selected.filter((id) => requestIDs.includes(id)), ...requestIDs.filter((id) => !known.has(id))],
  }
  if (next.stage === "project" && !permissionBatchPersistent(next, requests)) return { ...next, stage: "review" }
  return next
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

export function permissionBatchPersistent(state: PermissionBatchState, requests: PermissionRequest[]) {
  if (!state.selected.length) return false
  return state.selected.every((id) => Boolean(requests.find((item) => item.id === id)?.always.length))
}

export function permissionBatchActions(
  state: PermissionBatchState,
  requests: PermissionRequest[],
  scope?: "project" | "folder",
): Record<string, string> {
  if (state.stage === "project" && scope) return { confirm: "Confirm", cancel: "Cancel" }
  if (!permissionBatchPersistent(state, requests)) return { once: "Allow selected once", reject: "Reject all" }
  return {
    once: "Allow selected once",
    always: "Allow selected for this session",
    ...(scope ? { project: `Always allow selected patterns for this ${scope}` } : {}),
    reject: "Reject all",
  }
}

export function permissionBatchReply(
  state: PermissionBatchState,
  requests: PermissionRequest[],
  option: PermissionBatchOption,
): { state: PermissionBatchState; reply?: PermissionBatchReply } {
  if (option === "project" && state.stage === "review") {
    return permissionBatchPersistent(state, requests) ? { state: { ...state, stage: "project" } } : { state }
  }
  if (option === "cancel") return { state: { ...state, stage: "review" } }
  const batchID = requests[0]?.batchID
  if (!batchID) return { state }
  if (option === "reject") return { state, reply: { batchID, requestIDs: [], reply: "reject" } }
  if (!state.selected.length) return { state }
  if (option === "once") return { state, reply: { batchID, requestIDs: state.selected, reply: "once" } }
  if (option === "always") {
    if (!permissionBatchPersistent(state, requests)) return { state }
    return { state, reply: { batchID, requestIDs: state.selected, reply: "always" } }
  }
  if (option === "confirm" && state.stage === "project") {
    if (!permissionBatchPersistent(state, requests)) return { state: { ...state, stage: "review" } }
    return { state, reply: { batchID, requestIDs: state.selected, reply: "project" } }
  }
  return { state }
}
