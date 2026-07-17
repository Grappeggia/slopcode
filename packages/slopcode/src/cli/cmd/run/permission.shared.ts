// Pure state machine for the permission UI.
//
// Lives outside the JSX component so it can be tested independently. The
// machine has three stages:
//
//   permission → initial view with Allow once / Always / Reject options
//   project    → confirmation step (Confirm / Cancel)
//   reject     → text input for rejection message
//
// permissionRun() is the main transition: given the current state and the
// selected option, it returns a new state and optionally a PermissionReply
// to send to the SDK. The component calls this on enter/click.
//
// permissionInfo() extracts display info (icon, title, lines, diff) from
// the request, delegating to tool.ts for tool-specific formatting.
import type { PermissionRequest } from "@slopcode-ai/sdk/v2"
import type { PermissionReply } from "./types"
import { toolPath, toolPermissionInfo } from "./tool"

type Dict = Record<string, unknown>

export type PermissionStage = "permission" | "project" | "reject"
export type PermissionScopeLabel = "project" | "folder"
export type PermissionOption = "once" | "always" | "project" | "reject" | "confirm" | "cancel"
export type PermissionBatchOption = "once" | "always" | "project" | "reject" | "confirm" | "cancel"

export type PermissionBodyState = {
  requestID: string
  stage: PermissionStage
  selected: PermissionOption
  message: string
  submitting: boolean
}

export type PermissionInfo = {
  icon: string
  title: string
  lines: string[]
  diff?: string
  file?: string
}

export type PermissionStep = {
  state: PermissionBodyState
  reply?: PermissionReply
}

export type PermissionBatchState = {
  stage: "review" | "project"
  focused: number
  requestIDs: string[]
  selected: string[]
}

export type PermissionBatchReply = {
  batchID: string
  requestIDs: string[]
  reply: "once" | "always" | "project" | "reject"
}

export async function permissionBatchSubmit(input: {
  send: () => Promise<void>
  error: (error: unknown) => void
  done: () => void
}) {
  try {
    await input.send()
    return true
  } catch (error) {
    input.error(error)
    return false
  } finally {
    input.done()
  }
}

function dict(v: unknown): Dict {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    return {}
  }

  return { ...v }
}

function text(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function data(request: PermissionRequest): Dict {
  const meta = dict(request.metadata)
  return {
    ...meta,
    ...dict(meta.input),
  }
}

function patterns(request: PermissionRequest): string[] {
  return request.patterns.filter((item): item is string => typeof item === "string")
}

export function createPermissionBodyState(requestID: string): PermissionBodyState {
  return {
    requestID,
    stage: "permission",
    selected: "once",
    message: "",
    submitting: false,
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
  if (option === "always") return { state, reply: { batchID, requestIDs: state.selected, reply: "always" } }
  if (option === "confirm" && state.stage === "project") {
    if (!permissionBatchPersistent(state, requests)) return { state: { ...state, stage: "review" } }
    return { state, reply: { batchID, requestIDs: state.selected, reply: "project" } }
  }
  return { state }
}

export function permissionOptions(stage: PermissionStage, persistent = true): PermissionOption[] {
  if (stage === "permission") {
    return persistent ? ["once", "always", "project", "reject"] : ["once", "reject"]
  }

  if (stage === "project") {
    return ["confirm", "cancel"]
  }

  return []
}

export function permissionInfo(request: PermissionRequest): PermissionInfo {
  const pats = patterns(request)
  const input = data(request)
  const info = toolPermissionInfo(request.permission, input, dict(request.metadata), pats)
  if (info) {
    return info
  }

  if (request.permission === "external_directory") {
    const meta = dict(request.metadata)
    const raw = text(meta.parentDir) || text(meta.filepath) || pats[0] || ""
    const dir = raw.includes("*") ? raw.slice(0, raw.indexOf("*")).replace(/[\\/]+$/, "") : raw
    return {
      icon: "←",
      title: `Access external directory ${toolPath(dir, { home: true })}`,
      lines: pats.map((item) => `- ${item}`),
    }
  }

  if (request.permission === "doom_loop") {
    return {
      icon: "⟳",
      title: "Continue after repeated failures",
      lines: ["This keeps the session running despite repeated failures."],
    }
  }

  return {
    icon: "⚙",
    title: `Call tool ${request.permission}`,
    lines: [`Tool: ${request.permission}`],
  }
}

export function permissionProjectLines(request: PermissionRequest, scope: PermissionScopeLabel): string[] {
  if (!request.always.length) return []
  return [
    `This approval survives restarts and remains active for this ${scope} until revoked.`,
    "The following exact patterns will always be allowed:",
    ...request.always.map((item) => `- ${item}`),
  ]
}

export function permissionLabel(option: PermissionOption, scope: PermissionScopeLabel): string {
  if (option === "once") return "Allow once"
  if (option === "always") return "Allow for this session"
  if (option === "project") return `Always allow for this ${scope}`
  if (option === "reject") return "Reject"
  if (option === "confirm") return "Confirm"
  return "Cancel"
}

export function permissionReply(requestID: string, reply: PermissionReply["reply"], message?: string): PermissionReply {
  return {
    requestID,
    reply,
    ...(message && message.trim() ? { message: message.trim() } : {}),
  }
}

export function permissionShift(state: PermissionBodyState, dir: -1 | 1, persistent = true): PermissionBodyState {
  const list = permissionOptions(state.stage, persistent)
  if (list.length === 0) {
    return state
  }

  const idx = Math.max(0, list.indexOf(state.selected))
  const selected = list[(idx + dir + list.length) % list.length]
  return {
    ...state,
    selected,
  }
}

export function permissionHover(state: PermissionBodyState, option: PermissionOption): PermissionBodyState {
  return {
    ...state,
    selected: option,
  }
}

export function permissionRun(state: PermissionBodyState, requestID: string, option: PermissionOption): PermissionStep {
  if (state.submitting) {
    return { state }
  }

  if (state.stage === "permission") {
    if (option === "project") {
      return {
        state: {
          ...state,
          stage: "project",
          selected: "confirm",
        },
      }
    }

    if (option === "reject") {
      return {
        state: {
          ...state,
          stage: "reject",
          selected: "reject",
        },
      }
    }

    return {
      state,
      reply: permissionReply(requestID, option === "always" ? "always" : "once"),
    }
  }

  if (state.stage !== "project") {
    return { state }
  }

  if (option === "cancel") {
    return {
      state: {
        ...state,
        stage: "permission",
        selected: "project",
      },
    }
  }

  return {
    state,
    reply: permissionReply(requestID, "project"),
  }
}

export function permissionReject(state: PermissionBodyState, requestID: string): PermissionReply | undefined {
  if (state.submitting) {
    return undefined
  }

  return permissionReply(requestID, "reject", state.message)
}

export function permissionCancel(state: PermissionBodyState): PermissionBodyState {
  return {
    ...state,
    stage: "permission",
    selected: "reject",
  }
}

export function permissionEscape(state: PermissionBodyState): PermissionBodyState {
  if (state.stage === "project") {
    return {
      ...state,
      stage: "permission",
      selected: "project",
    }
  }

  return {
    ...state,
    stage: "reject",
    selected: "reject",
  }
}
