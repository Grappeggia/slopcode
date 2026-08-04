import { ORCHESTRATOR_CAPABILITIES, parseInteraction, record, type OrchestratorBackendMode, type OrchestratorCapability, type OrchestratorInteraction } from "./ssh-orchestrator"
import type { SshWorkspaceState } from "./ssh-workspace-state"

export const REVIEW_TABS = ["changes", "files", "tests", "screenshots"] as const
export const AGENT_SESSION_STORAGE = "slopcode.draft.android.agent-session.dat"
export const MAX_PERSISTED_AGENT_SESSION_BYTES = 96 * 1024
export type ReviewTab = (typeof REVIEW_TABS)[number]

export type AgentToolMetadata = Partial<
  Record<"path" | "progress" | "summary" | "test" | "result" | "exitCode", string>
>
type TextEntry = { id: string; type: "user" | "output" | "reasoning" | "retry"; text: string }
export type AgentSessionEntry =
  | TextEntry
  | { id: string; type: "tool"; title: string; status: string; kind?: string; metadata?: AgentToolMetadata }
  | { id: string; type: "plan"; content: string; path?: string; revision?: number }
  | { id: string; type: "artifact"; name: string; path: string; kind: string; size?: number; mime?: string }
  | {
      id: string
      type: "approval" | "question"
      interaction: OrchestratorInteraction
      resolved: boolean
      decision?: "approved" | "rejected"
      answer?: string
      answerOmitted?: boolean
      detailsOmitted?: boolean
    }
  | { id: string; type: "completion"; status: "completed" | "failed" | "stopped"; message?: string }
  | { id: string; type: "failure"; message: string }

export type AgentSessionState = {
  version: 2
  sessionID?: string
  draft: string
  selectedReview: ReviewTab
  lastCursor?: string
  lastSequence?: number
  backendVersion?: string
  backendMode?: OrchestratorBackendMode
  capabilities?: OrchestratorCapability[]
  transcript: AgentSessionEntry[]
}

export type AgentSessionAction =
  | { type: "draft.changed"; value: string }
  | { type: "review.selected"; value: ReviewTab }
  | { type: "prompt.submitted"; id: string; text: string }
  | { type: "event.received"; value: Record<string, unknown> }
  | {
      type: "interaction.resolved"
      id: string
      decision?: "approved" | "rejected"
      answer?: string
    }
  | { type: "failure.added"; id: string; message: string }
  | { type: "backend.connected"; version: string; mode: OrchestratorBackendMode; capabilities: OrchestratorCapability[] }

type Storage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

const MAX_DRAFT = 16 * 1024
const MAX_TEXT = 64 * 1024
const MAX_ENTRIES = 160
const MAX_PERSISTED_TEXT = 8 * 1024
const MAX_PERSISTED_PLAN = 12 * 1024
const MAX_PERSISTED_ENTRIES = 120
const TOOL_STATUSES = ["pending", "in_progress", "completed", "failed"]
const TOOL_KINDS = ["read", "edit", "delete", "move", "search", "execute", "think", "fetch", "other"]
const TOOL_METADATA = ["path", "progress", "summary", "test", "result", "exitCode"] as const
const ARTIFACT_KINDS = ["file", "directory", "image", "diff", "log", "plan", "report"]
const encoder = new TextEncoder()

function bytes(value: string) {
  return encoder.encode(value).byteLength
}

function text(value: unknown, limit = MAX_TEXT, empty = false) {
  if (typeof value !== "string" || bytes(value) > limit || /\u0000/.test(value) || (!empty && value.length === 0)) return
  return value
}

function clip(value: string, limit: number) {
  if (bytes(value) <= limit) return value
  let low = 0
  let high = value.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (bytes(value.slice(0, middle)) <= limit) low = middle
    else high = middle - 1
  }
  return value.slice(0, low)
}

export function redactAgentSessionText(value: string) {
  return value
    .replace(/-----BEGIN [^-\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\n]*PRIVATE KEY-----/gi, "[REDACTED PRIVATE KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [REDACTED]")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}|npm_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9_-]{16,}|AKIA[A-Z0-9]{16})\b/g, "[REDACTED TOKEN]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED TOKEN]")
    .replace(/\b\d+\/[A-Za-z0-9._~-]{20,}(?:#[A-Za-z0-9._~-]{8,})?/g, "[REDACTED OAUTH CODE]")
    .replace(/(?<![A-Za-z0-9._~-])[A-Za-z0-9._~-]{32,}(?:#[A-Za-z0-9._~-]{8,})?(?![A-Za-z0-9._~-])/g, "[REDACTED TOKEN]")
    .replace(/https?:\/\/[^\s/:@]+:[^\s/@]+@/gi, "https://[REDACTED]@")
    .replace(
      /(\b(?:(?:my|the|your|our|this)\s+)?(?:password|passwd|pwd|passphrase|api[_. -]?(?:key|token)|access[_. -]?token|refresh[_. -]?token|auth(?:entication|orization)?[_. -]?(?:code|token)|device[_. -]?code|verification[_. -]?code|login[_. -]?code|one[_. -]?time[_. -]?code|otp|client[_. -]?secret|secret|credential|cookie)\b)\s*(?:(?:is|was|equals?)\s+|(?:=|:)\s*|\s+)[^\r\n]+/gi,
      "$1 [REDACTED CREDENTIAL]",
    )
    .replace(/\b(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9]{4}(?:-[A-Z0-9]{4}){1,3}\b/gi, "[REDACTED DEVICE CODE]")
    .replace(
      /(\b(?:password|passwd|pwd|passphrase|api[_.-]?(?:key|token)|access[_.-]?token|refresh[_.-]?token|auth(?:entication|orization)?(?:[_.-]?(?:code|token))?|device[_.-]?code|verification[_.-]?code|login[_.-]?code|one[_.-]?time[_.-]?code|otp|secret|client[_.-]?secret|credential|cookie|token)\b\s*(?:=|:|\s+)\s*)(?!\[REDACTED\b)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;&|}]+)/gi,
      "$1[REDACTED]",
    )
}

function safe(value: unknown, limit: number, empty = false) {
  if (typeof value !== "string" || /\u0000/.test(value) || (!empty && value.length === 0)) return
  return clip(redactAgentSessionText(value), limit)
}

function id(value: unknown) {
  return text(value, 256)
}

function oneOf(value: unknown, values: readonly string[]) {
  return typeof value === "string" && values.includes(value) ? value : undefined
}

function metadata(value: unknown, persisted = false): AgentToolMetadata | undefined {
  if (!record(value)) return
  const result = Object.fromEntries(
    TOOL_METADATA.flatMap((key) => {
      const next = persisted ? safe(value[key], 2 * 1024) : text(value[key], 2 * 1024)
      return next ? [[key, next]] : []
    }),
  ) as AgentToolMetadata
  return Object.keys(result).length ? result : undefined
}

function interaction(value: unknown, kind: "approval" | "question") {
  const parsed = parseInteraction(value, kind)
  if (!parsed) return
  if (kind === "approval") {
    const title = safe(parsed.title, 512)
    if (!title) return
    const cwd = safe(parsed.cwd, 4 * 1024)
    const reason = safe(parsed.reason, 2 * 1024)
    return {
      id: parsed.id,
      revision: parsed.revision,
      kind,
      title,
      ...(cwd ? { cwd } : {}),
      ...(reason ? { reason } : {}),
      ...(parsed.risk ? { risk: parsed.risk } : {}),
    } satisfies OrchestratorInteraction
  }
  const prompt = safe(parsed.prompt, 4 * 1024)
  if (!prompt) return
  const options = parsed.options?.flatMap((item) => {
    const next = safe(item, 512)
    return next ? [next] : []
  })
  return {
    id: parsed.id,
    revision: parsed.revision,
    kind,
    prompt,
    ...(options?.length ? { options } : {}),
    ...(parsed.allowFreeform !== undefined ? { allowFreeform: parsed.allowFreeform } : {}),
  } satisfies OrchestratorInteraction
}

function persistedEntry(value: unknown): AgentSessionEntry | undefined {
  if (!record(value)) return
  const entryID = id(value.id)
  const type = text(value.type, 32)
  if (!entryID || !type) return
  if (type === "user" || type === "output" || type === "reasoning" || type === "retry") {
    const content = safe(value.text, MAX_PERSISTED_TEXT)
    return content ? { id: entryID, type, text: content } : undefined
  }
  if (type === "tool") {
    const title = safe(value.title, 512)
    const status = oneOf(value.status, TOOL_STATUSES)
    const kind = oneOf(value.kind, TOOL_KINDS)
    const detail = metadata(value.metadata, true)
    return title && status
      ? { id: entryID, type, title, status, ...(kind ? { kind } : {}), ...(detail ? { metadata: detail } : {}) }
      : undefined
  }
  if (type === "plan") {
    const content = safe(value.content, MAX_PERSISTED_PLAN)
    const path = safe(value.path, 4 * 1024)
    const revision = typeof value.revision === "number" && Number.isSafeInteger(value.revision) && value.revision > 0 ? value.revision : undefined
    return content ? { id: entryID, type, content, ...(path ? { path } : {}), ...(revision ? { revision } : {}) } : undefined
  }
  if (type === "artifact") {
    const name = safe(value.name, 256)
    const path = safe(value.path, 4 * 1024)
    const kind = oneOf(value.kind, ARTIFACT_KINDS)
    if (!name || !path || !kind) return
    const size = typeof value.size === "number" && Number.isSafeInteger(value.size) && value.size >= 0 ? value.size : undefined
    const mime = safe(value.mime, 128)
    return { id: entryID, type, name, path, kind, ...(size !== undefined ? { size } : {}), ...(mime ? { mime } : {}) }
  }
  if (type === "approval" || type === "question") {
    const next = interaction(value.interaction, type)
    const resolved = value.resolved === true
    const decision = type === "approval" && resolved ? oneOf(value.decision, ["approved", "rejected"]) : undefined
    const answerOmitted = type === "question" && resolved && (typeof value.answer === "string" || value.answerOmitted === true)
    return next
      ? {
          id: entryID,
          type,
          interaction: next,
          resolved,
          ...(decision ? { decision: decision as "approved" | "rejected" } : {}),
          ...(answerOmitted ? { answerOmitted: true } : {}),
          ...((record(value.interaction) && typeof value.interaction.command === "string") || value.detailsOmitted === true
            ? { detailsOmitted: true }
            : {}),
        }
      : undefined
  }
  if (type === "completion") {
    const status = oneOf(value.status, ["completed", "failed", "stopped"])
    const message = safe(value.message, 2 * 1024)
    return status
      ? { id: entryID, type, status: status as "completed" | "failed" | "stopped", ...(message ? { message } : {}) }
      : undefined
  }
  if (type === "failure") {
    const message = safe(value.message, 2 * 1024)
    return message ? { id: entryID, type, message } : undefined
  }
}

function fit(state: AgentSessionState): AgentSessionState {
  if (bytes(JSON.stringify(state)) <= MAX_PERSISTED_AGENT_SESSION_BYTES || state.transcript.length === 0) return state
  return fit({ ...state, transcript: state.transcript.slice(1) })
}

function append(state: AgentSessionState, value: AgentSessionEntry) {
  return { ...state, transcript: [...state.transcript, value].slice(-MAX_ENTRIES) }
}

function replace(state: AgentSessionState, value: AgentSessionEntry) {
  const index = state.transcript.findIndex((item) => item.id === value.id)
  if (index < 0) return append(state, value)
  return { ...state, transcript: state.transcript.map((item, current) => (current === index ? value : item)) }
}

export function initialAgentSessionState(sessionID?: string): AgentSessionState {
  return { version: 2, ...(sessionID ? { sessionID } : {}), draft: "", selectedReview: "changes", transcript: [] }
}

export function normalizeAgentSession(value: unknown): AgentSessionState {
  if (!record(value) || value.version !== 2) return initialAgentSessionState()
  const sessionID = id(value.sessionID)
  const draft = safe(value.draft, MAX_PERSISTED_TEXT, true) ?? ""
  const selectedReview = oneOf(value.selectedReview, REVIEW_TABS) as ReviewTab | undefined
  const lastCursor = text(value.lastCursor, 128)
  const lastSequence = typeof value.lastSequence === "number" && Number.isSafeInteger(value.lastSequence) && value.lastSequence > 0 ? value.lastSequence : undefined
  const backendVersion = safe(value.backendVersion, 256)
  const backendMode = oneOf(value.backendMode, ["acp", "app_server", "cli", "streaming_cli", "sandboxed_cli"]) as OrchestratorBackendMode | undefined
  const raw = Array.isArray(value.capabilities) ? value.capabilities : undefined
  const capabilities = raw
    ? raw.filter((item): item is OrchestratorCapability => typeof item === "string" && ORCHESTRATOR_CAPABILITIES.includes(item as OrchestratorCapability))
    : undefined
  const validCapabilities = capabilities && capabilities.length === raw?.length && capabilities.length ? capabilities : undefined
  const transcript = Array.isArray(value.transcript)
    ? value.transcript.flatMap((item) => {
        const next = persistedEntry(item)
        return next ? [next] : []
      }).slice(-MAX_PERSISTED_ENTRIES)
    : []
  return fit({
    version: 2,
    ...(sessionID ? { sessionID } : {}),
    draft,
    selectedReview: selectedReview ?? "changes",
    ...(lastCursor ? { lastCursor } : {}),
    ...(lastSequence ? { lastSequence } : {}),
    ...(backendVersion ? { backendVersion } : {}),
    ...(backendMode ? { backendMode } : {}),
    ...(validCapabilities ? { capabilities: validCapabilities } : {}),
    transcript,
  })
}

export function reduceAgentSession(state: AgentSessionState, action: AgentSessionAction): AgentSessionState {
  if (action.type === "backend.connected")
    return { ...state, backendVersion: action.version, backendMode: action.mode, capabilities: action.capabilities }
  if (action.type === "draft.changed") {
    const draft = text(action.value, MAX_DRAFT, true)
    return draft === undefined ? state : { ...state, draft }
  }
  if (action.type === "review.selected") return { ...state, selectedReview: action.value }
  if (action.type === "prompt.submitted") {
    const entryID = id(action.id)
    const content = text(action.text, MAX_DRAFT)
    return state.sessionID && entryID && content
      ? append({ ...state, draft: "" }, { id: entryID, type: "user", text: content })
      : state
  }
  if (action.type === "interaction.resolved") {
    return {
      ...state,
      transcript: state.transcript.map((item) =>
        (item.type === "approval" || item.type === "question") && item.id === action.id
          ? item.type === "approval" && (action.decision === "approved" || action.decision === "rejected")
            ? { ...item, resolved: true, decision: action.decision }
            : item.type === "question" && safe(action.answer, 4 * 1024)
              ? { ...item, resolved: true, answer: safe(action.answer, 4 * 1024) }
              : item
          : item,
      ),
    }
  }
  if (action.type === "failure.added") {
    const entryID = id(action.id)
    const message = text(action.message, 2 * 1024)
    return entryID && message ? append(state, { id: entryID, type: "failure", message }) : state
  }

  const value = action.value
  const remote = id(value.sessionID)
  if (!state.sessionID || !remote || remote !== state.sessionID) return state
  const cursor = text(value.cursor, 128)
  const sequence = typeof value.sequence === "number" && Number.isSafeInteger(value.sequence) && value.sequence > 0 ? value.sequence : undefined
  if (cursor && state.lastCursor === cursor) return state
  if (sequence && state.lastSequence && sequence <= state.lastSequence) return state
  const current = { ...state, ...(cursor ? { lastCursor: cursor } : {}), ...(sequence ? { lastSequence: sequence } : {}) }
  const type = text(value.type, 128)
  if (!type) return current
  if (type === "turn.output" || type === "turn.reasoning" || type === "turn.retry") {
    const content = text(value.text ?? value.reason)
    if (!content) return current
    const kind = type === "turn.output" ? "output" : type === "turn.reasoning" ? "reasoning" : "retry"
    const last = current.transcript.at(-1)
    if (last?.type === kind) {
      const merged = text(last.text + content)
      if (merged) return replace(current, { ...last, text: merged })
    }
    return append(current, { id: `${type}:${cursor ?? crypto.randomUUID()}`, type: kind, text: content })
  }
  if (type === "tool.updated" && record(value.tool)) {
    const toolID = id(value.tool.id)
    const title = text(value.tool.title, 512)
    const status = oneOf(value.tool.status, TOOL_STATUSES)
    const kind = oneOf(value.tool.kind, TOOL_KINDS)
    const detail = metadata(value.tool.metadata)
    return toolID && title && status
      ? replace(current, { id: toolID, type: "tool", title, status, ...(kind ? { kind } : {}), ...(detail ? { metadata: detail } : {}) })
      : current
  }
  if (type === "plan.available" && record(value.plan)) {
    const planID = id(value.plan.id)
    const content = text(value.plan.content)
    const path = text(value.plan.path, 4 * 1024)
    const revision = typeof value.plan.revision === "number" && Number.isSafeInteger(value.plan.revision) && value.plan.revision > 0 ? value.plan.revision : undefined
    return planID && content
      ? replace(current, { id: planID, type: "plan", content, ...(path ? { path } : {}), ...(revision ? { revision } : {}) })
      : current
  }
  if (type === "artifact.created" && record(value.artifact)) {
    const artifactID = id(value.artifact.id)
    const name = text(value.artifact.name, 256)
    const path = text(value.artifact.path, 4 * 1024)
    const kind = oneOf(value.artifact.kind, ARTIFACT_KINDS)
    if (!artifactID || !name || !path || !kind) return current
    const size = typeof value.artifact.size === "number" && Number.isSafeInteger(value.artifact.size) && value.artifact.size >= 0 ? value.artifact.size : undefined
    const mime = text(value.artifact.mime, 128)
    return replace(current, { id: artifactID, type: "artifact", name, path, kind, ...(size !== undefined ? { size } : {}), ...(mime ? { mime } : {}) })
  }
  if ((type === "interaction.approval.requested" || type === "interaction.question.requested") && record(value.interaction)) {
    const kind = type === "interaction.approval.requested" ? "approval" : "question"
    const next = parseInteraction(value.interaction, kind)
    return next ? replace(current, { id: next.id, type: kind, interaction: next, resolved: false }) : current
  }
  if (type === "turn.completed") {
    const status = oneOf(value.status, ["completed", "failed", "stopped"])
    const message = text(value.message, 2 * 1024)
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
  if (tab === "files")
    return transcript.filter(
      (item) =>
        (item.type === "artifact" && item.kind !== "image") ||
        (item.type === "tool" && !!item.metadata?.path && ["read", "edit", "delete", "move"].includes(item.kind ?? "")),
    )
  if (tab === "tests")
    return transcript.filter(
      (item) =>
        item.type === "tool" &&
        item.kind === "execute" &&
        (!!item.metadata?.test || /\b(test|tests|testing|verify|verification|check|lint)\b/i.test(item.title)),
    )
  return transcript.filter((item) => item.type === "artifact" && item.kind === "image")
}

export function lastPrompt(state: AgentSessionState) {
  const item = state.transcript.findLast((entry) => entry.type === "user")
  return item?.type === "user" ? item.text : undefined
}

export function pendingInteraction(transcript: AgentSessionEntry[], exclude?: string) {
  const item = transcript.findLast(
    (entry) =>
      (entry.type === "approval" || entry.type === "question") && !entry.resolved && entry.id !== exclude,
  )
  return item?.type === "approval" || item?.type === "question" ? item.interaction : undefined
}

function hash(value: string) {
  return [...value].reduce((result, character) => Math.imul(result ^ character.charCodeAt(0), 16_777_619) >>> 0, 2_166_136_261).toString(36)
}

function workspaceKey(workspace: Pick<SshWorkspaceState, "profile" | "directory" | "agent">) {
  return `ssh.agent-session.latest.v2.${hash(`${workspace.profile}\u0000${workspace.directory}\u0000${workspace.agent}`)}`
}

export function sessionKey(
  workspace: Pick<SshWorkspaceState, "profile" | "directory" | "agent">,
  sessionID: string,
) {
  return `ssh.agent-session.v2.${hash(`${workspace.profile}\u0000${workspace.directory}\u0000${workspace.agent}\u0000${sessionID}`)}`
}

function json(value: string | null) {
  if (!value) return
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed
  } catch {
    return
  }
}

export async function readAgentSession(
  storage: Storage,
  workspace: Pick<SshWorkspaceState, "profile" | "directory" | "agent">,
  expectedSessionID?: string,
) {
  const pointer = json(await storage.getItem(workspaceKey(workspace)))
  if (!record(pointer) || pointer.version !== 2) return
  const sessionID = id(pointer.sessionID)
  if (!sessionID || (expectedSessionID && expectedSessionID !== sessionID)) return
  const state = normalizeAgentSession(json(await storage.getItem(sessionKey(workspace, sessionID))))
  return state.sessionID === sessionID ? state : undefined
}

export async function writeAgentSession(
  storage: Storage,
  workspace: Pick<SshWorkspaceState, "profile" | "directory" | "agent">,
  state: AgentSessionState,
) {
  const value = normalizeAgentSession(state)
  if (!value.sessionID) return
  const key = sessionKey(workspace, value.sessionID)
  const prior = json(await storage.getItem(workspaceKey(workspace)))
  const previous = record(prior) ? id(prior.sessionID) : undefined
  await storage.setItem(key, JSON.stringify(value))
  await storage.setItem(workspaceKey(workspace), JSON.stringify({ version: 2, sessionID: value.sessionID }))
  if (previous && previous !== value.sessionID) await storage.removeItem(sessionKey(workspace, previous))
}
