import {
  parseInteraction,
  record,
  type OrchestratorInteraction,
} from "./ssh-orchestrator"
import type { SshWorkspaceState } from "./ssh-workspace-state"

export const REVIEW_TABS = ["changes", "files", "tests", "screenshots"] as const
export type ReviewTab = (typeof REVIEW_TABS)[number]

type TextEntry = { id: string; type: "user" | "output" | "reasoning" | "retry"; text: string }
export type AgentSessionEntry =
  | TextEntry
  | { id: string; type: "tool"; title: string; status: string; kind?: string }
  | { id: string; type: "plan"; content: string }
  | { id: string; type: "artifact"; name: string; path: string; kind: string; size?: number; mime?: string }
  | {
      id: string
      type: "approval" | "question"
      interaction: OrchestratorInteraction
      resolved: boolean
    }
  | { id: string; type: "completion"; status: "completed" | "failed" | "stopped"; message?: string }
  | { id: string; type: "failure"; message: string }

export type AgentSessionState = {
  version: 1
  draft: string
  selectedReview: ReviewTab
  lastCursor?: string
  transcript: AgentSessionEntry[]
}

export type AgentSessionAction =
  | { type: "draft.changed"; value: string }
  | { type: "review.selected"; value: ReviewTab }
  | { type: "prompt.submitted"; id: string; text: string }
  | { type: "event.received"; value: Record<string, unknown> }
  | { type: "interaction.resolved"; id: string }
  | { type: "failure.added"; id: string; message: string }

type Storage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

const MAX_DRAFT = 16 * 1024
const MAX_TEXT = 64 * 1024
const MAX_ENTRIES = 160
const TOOL_STATUSES = ["pending", "in_progress", "completed", "failed"]
const TOOL_KINDS = ["read", "edit", "delete", "move", "search", "execute", "think", "fetch", "other"]
const ARTIFACT_KINDS = ["file", "directory", "image", "diff", "log", "plan", "report"]

function text(value: unknown, limit = MAX_TEXT, empty = false) {
  if (typeof value !== "string" || value.length > limit || /\u0000/.test(value) || (!empty && value.length === 0)) return
  return value
}

function id(value: unknown) {
  return text(value, 256)
}

function oneOf(value: unknown, values: readonly string[]) {
  return typeof value === "string" && values.includes(value) ? value : undefined
}

function entry(value: unknown): AgentSessionEntry | undefined {
  if (!record(value)) return
  const entryID = id(value.id)
  const type = text(value.type, 32)
  if (!entryID || !type) return
  if (type === "user" || type === "output" || type === "reasoning" || type === "retry") {
    const content = text(value.text)
    return content ? { id: entryID, type, text: content } : undefined
  }
  if (type === "tool") {
    const title = text(value.title, 512)
    const status = oneOf(value.status, TOOL_STATUSES)
    const kind = oneOf(value.kind, TOOL_KINDS)
    return title && status ? { id: entryID, type, title, status, ...(kind ? { kind } : {}) } : undefined
  }
  if (type === "plan") {
    const content = text(value.content)
    return content ? { id: entryID, type, content } : undefined
  }
  if (type === "artifact") {
    const name = text(value.name, 256)
    const path = text(value.path, 4_096)
    const kind = oneOf(value.kind, ARTIFACT_KINDS)
    if (!name || !path || !kind) return
    const size = typeof value.size === "number" && Number.isSafeInteger(value.size) && value.size >= 0 ? value.size : undefined
    const mime = text(value.mime, 128)
    return { id: entryID, type, name, path, kind, ...(size !== undefined ? { size } : {}), ...(mime ? { mime } : {}) }
  }
  if (type === "approval" || type === "question") {
    const interaction = parseInteraction(value.interaction, type)
    return interaction ? { id: entryID, type, interaction, resolved: value.resolved === true } : undefined
  }
  if (type === "completion") {
    const status = oneOf(value.status, ["completed", "failed", "stopped"])
    const message = text(value.message, 2_048)
    return status
      ? { id: entryID, type, status: status as "completed" | "failed" | "stopped", ...(message ? { message } : {}) }
      : undefined
  }
  if (type === "failure") {
    const message = text(value.message, 2_048)
    return message ? { id: entryID, type, message } : undefined
  }
}

function append(state: AgentSessionState, value: AgentSessionEntry) {
  return { ...state, transcript: [...state.transcript, value].slice(-MAX_ENTRIES) }
}

function replace(state: AgentSessionState, value: AgentSessionEntry) {
  const index = state.transcript.findIndex((item) => item.id === value.id)
  if (index < 0) return append(state, value)
  return {
    ...state,
    transcript: state.transcript.map((item, current) => (current === index ? value : item)),
  }
}

export function initialAgentSessionState(): AgentSessionState {
  return { version: 1, draft: "", selectedReview: "changes", transcript: [] }
}

export function normalizeAgentSession(value: unknown): AgentSessionState {
  if (!record(value) || value.version !== 1) return initialAgentSessionState()
  const draft = text(value.draft, MAX_DRAFT, true) ?? ""
  const selectedReview = oneOf(value.selectedReview, REVIEW_TABS) as ReviewTab | undefined
  const lastCursor = text(value.lastCursor, 128)
  const transcript = Array.isArray(value.transcript)
    ? value.transcript.flatMap((item) => {
        const next = entry(item)
        return next ? [next] : []
      }).slice(-MAX_ENTRIES)
    : []
  return {
    version: 1,
    draft,
    selectedReview: selectedReview ?? "changes",
    ...(lastCursor ? { lastCursor } : {}),
    transcript,
  }
}

export function reduceAgentSession(state: AgentSessionState, action: AgentSessionAction): AgentSessionState {
  if (action.type === "draft.changed") {
    const draft = text(action.value, MAX_DRAFT, true)
    return draft === undefined ? state : { ...state, draft }
  }
  if (action.type === "review.selected") return { ...state, selectedReview: action.value }
  if (action.type === "prompt.submitted") {
    const entryID = id(action.id)
    const content = text(action.text, MAX_DRAFT)
    return entryID && content ? append({ ...state, draft: "" }, { id: entryID, type: "user", text: content }) : state
  }
  if (action.type === "interaction.resolved") {
    return {
      ...state,
      transcript: state.transcript.map((item) =>
        (item.type === "approval" || item.type === "question") && item.id === action.id
          ? { ...item, resolved: true }
          : item,
      ),
    }
  }
  if (action.type === "failure.added") {
    const entryID = id(action.id)
    const message = text(action.message, 2_048)
    return entryID && message ? append(state, { id: entryID, type: "failure", message }) : state
  }

  const value = action.value
  const cursor = text(value.cursor, 128)
  const current = cursor ? { ...state, lastCursor: cursor } : state
  const type = text(value.type, 128)
  if (!type) return current
  if (type === "turn.output" || type === "turn.reasoning" || type === "turn.retry") {
    const content = text(value.text ?? value.reason)
    if (!content) return current
    const kind = type === "turn.output" ? "output" : type === "turn.reasoning" ? "reasoning" : "retry"
    const last = current.transcript.at(-1)
    if (last?.type === kind) {
      const merged = text(last.text + content)
      return merged ? replace(current, { ...last, text: merged }) : current
    }
    return append(current, { id: `${type}:${cursor ?? crypto.randomUUID()}`, type: kind, text: content })
  }
  if (type === "tool.updated" && record(value.tool)) {
    const item = entry({ id: value.tool.id, type: "tool", ...value.tool })
    return item ? replace(current, item) : current
  }
  if (type === "plan.available" && record(value.plan)) {
    const item = entry({ id: value.plan.id, type: "plan", content: value.plan.content })
    return item ? replace(current, item) : current
  }
  if (type === "artifact.created" && record(value.artifact)) {
    const item = entry({ id: value.artifact.id, type: "artifact", ...value.artifact })
    return item ? replace(current, item) : current
  }
  if ((type === "interaction.approval.requested" || type === "interaction.question.requested") && record(value.interaction)) {
    const kind = type === "interaction.approval.requested" ? "approval" : "question"
    const interaction = parseInteraction(value.interaction, kind)
    return interaction
      ? replace(current, { id: interaction.id, type: kind, interaction, resolved: false })
      : current
  }
  if (type === "turn.completed") {
    const status = oneOf(value.status, ["completed", "failed", "stopped"])
    const message = text(value.message, 2_048)
    if (!status) return current
    const turn = id(value.turnID)
    return replace(current, {
      id: `completion:${turn ?? cursor ?? crypto.randomUUID()}`,
      type: "completion",
      status: status as "completed" | "failed" | "stopped",
      ...(message ? { message } : {}),
    })
  }
  return current
}

export function reviewItems(transcript: AgentSessionEntry[], tab: ReviewTab) {
  if (tab === "changes")
    return transcript.filter(
      (item) =>
        (item.type === "tool" && (item.kind === "edit" || item.kind === "delete" || item.kind === "move")) ||
        (item.type === "artifact" && item.kind === "diff"),
    )
  if (tab === "files") return transcript.filter((item) => item.type === "artifact" && item.kind !== "image")
  if (tab === "tests")
    return transcript.filter(
      (item) => item.type === "tool" && item.kind === "execute" && /\b(test|tests|testing|verify|verification|check|lint)\b/i.test(item.title),
    )
  return transcript.filter((item) => item.type === "artifact" && item.kind === "image")
}

export function lastPrompt(state: AgentSessionState) {
  const item = state.transcript.findLast((entry) => entry.type === "user")
  return item?.type === "user" ? item.text : undefined
}

export function sessionKey(workspace: Pick<SshWorkspaceState, "profile" | "directory" | "agent">) {
  const value = `${workspace.profile}\u0000${workspace.directory}\u0000${workspace.agent}`
  const hash = [...value].reduce((result, character) => Math.imul(result ^ character.charCodeAt(0), 16_777_619) >>> 0, 2_166_136_261)
  return `ssh.agent-session.v1.${hash.toString(36)}`
}

export async function readAgentSession(storage: Storage, key: string) {
  const raw = await storage.getItem(key)
  if (!raw) return initialAgentSessionState()
  try {
    return normalizeAgentSession(JSON.parse(raw))
  } catch {
    return initialAgentSessionState()
  }
}

export async function writeAgentSession(storage: Storage, key: string, state: AgentSessionState) {
  await storage.setItem(key, JSON.stringify(normalizeAgentSession(state)))
}
