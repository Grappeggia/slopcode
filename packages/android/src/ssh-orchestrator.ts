import type { SshAgent, SshOrchestratorEvent, SshTransport } from "./ssh"

export type OrchestratorAgent = "slopcode" | "opencode" | "codex" | "claude" | "antigravity"

export type OrchestratorInteraction = {
  id: string
  revision: number
  kind: "approval" | "question"
  title?: string
  prompt?: string
  command?: string
  cwd?: string
  reason?: string
  risk?: "low" | "medium" | "high"
  options?: string[]
  allowFreeform?: boolean
}

export type OrchestratorItem =
  | { id: string; type: "output" | "reasoning" | "retry"; text: string }
  | { id: string; type: "tool"; title: string; status: string; kind?: string }
  | { id: string; type: "plan"; content: string }
  | { id: string; type: "artifact"; name: string; path: string; kind: string }

export type OrchestratorState = {
  phase: "connecting" | "opening" | "ready" | "running" | "waiting" | "completed" | "error" | "stopped"
  sessionID?: string
  turnID?: string
  cursor?: string
  items: OrchestratorItem[]
  interaction?: OrchestratorInteraction
  error?: string
  lastPrompt?: string
}

type RecordValue = Record<string, unknown>

const MAX_LINE = 256 * 1024
const MAX_TEXT = 64 * 1024
const MAX_ITEMS = 160

export function record(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function text(value: unknown, limit = MAX_TEXT) {
  if (typeof value !== "string" || value.length === 0 || value.length > limit || /\u0000/.test(value)) return
  return value
}

function id(value: unknown) {
  return text(value, 256)
}

export function agentID(value: SshAgent): OrchestratorAgent {
  if (value === "slopcode-cli") return "slopcode"
  if (value === "opencode-cli") return "opencode"
  if (value === "codex-cli") return "codex"
  if (value === "antigravity-cli") return "antigravity"
  return "claude"
}

export function requestID(prefix: string) {
  return `req_${prefix}_${crypto.randomUUID().replaceAll("-", "")}`
}

export function idempotencyKey(prefix: string) {
  return `idem_${prefix}_${crypto.randomUUID().replaceAll("-", "")}`
}

export function workspaceFrame(directory: string, agent: SshAgent) {
  return {
    version: "v1",
    kind: "request",
    type: "workspace.open",
    requestID: requestID("workspace"),
    idempotencyKey: idempotencyKey("workspace"),
    workspace: { id: "wrk_android", path: directory, name: "Android remote workspace" },
    agent: { id: agentID(agent), capabilities: ["workspace", "sessions", "turns"] },
  }
}

export function sessionFrame(agent: SshAgent) {
  return {
    version: "v1",
    kind: "request",
    type: "session.create",
    requestID: requestID("session"),
    idempotencyKey: idempotencyKey("session"),
    workspaceID: "wrk_android",
    agent: agentID(agent),
    title: "Android remote session",
  }
}

export function turnFrame(sessionID: string, prompt: string, agent: SshAgent) {
  return {
    version: "v1",
    kind: "request",
    type: "turn.create",
    requestID: requestID("turn"),
    idempotencyKey: idempotencyKey("turn"),
    sessionID,
    agent: agentID(agent),
    prompt,
  }
}

export function replyFrame(
  sessionID: string,
  interaction: OrchestratorInteraction,
  answer: string | undefined,
  decision: "approved" | "rejected" | undefined,
) {
  const base = {
    version: "v1",
    kind: "request",
    requestID: requestID("interaction"),
    idempotencyKey: idempotencyKey("interaction"),
    sessionID,
    interactionID: interaction.id,
    revision: interaction.revision,
  }
  if (interaction.kind === "approval")
    return { ...base, type: "interaction.approval.reply", decision: decision ?? "rejected" }
  return { ...base, type: "interaction.question.reply", answer: answer ?? "" }
}

export function parseOrchestratorLine(line: string): RecordValue | undefined {
  if (line.length === 0 || line.length > MAX_LINE) return
  try {
    const value: unknown = JSON.parse(line)
    return record(value) ? value : undefined
  } catch {
    return
  }
}

export function parseOrchestratorEvent(
  value: RecordValue,
):
  | { kind: "response"; requestID: string; value: RecordValue }
  | { kind: "error"; requestID?: string; message: string }
  | { kind: "event"; value: RecordValue }
  | undefined {
  if (value.kind === "response") {
    const request = id(value.requestID)
    return request ? { kind: "response", requestID: request, value } : undefined
  }
  if (value.kind === "error") {
    const message = text(value.message, 2_048)
    if (!message) return
    const requestID = value.requestID === undefined ? undefined : id(value.requestID)
    if (value.requestID !== undefined && !requestID) return
    return { kind: "error", ...(requestID ? { requestID } : {}), message }
  }
  if (value.kind === "event" && id(value.sessionID)) return { kind: "event", value }
}

export function parseInteraction(
  value: unknown,
  kind: OrchestratorInteraction["kind"],
): OrchestratorInteraction | undefined {
  if (!record(value)) return
  const interactionID = id(value.id)
  const revision = value.revision
  if (!interactionID || typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) return
  const result: OrchestratorInteraction = { id: interactionID, revision, kind }
  if (kind === "approval") {
    const title = text(value.title, 512)
    if (!title) return
    result.title = title
    for (const key of ["command", "cwd", "reason"] as const) {
      if (value[key] === undefined) continue
      const next = text(value[key], key === "command" ? 4_096 : 2_048)
      if (!next) return
      result[key] = next
    }
    if (value.risk === "low" || value.risk === "medium" || value.risk === "high") result.risk = value.risk
    return result
  }
  const prompt = text(value.prompt, 4_096)
  if (!prompt) return
  result.prompt = prompt
  if (value.options !== undefined) {
    if (!Array.isArray(value.options) || value.options.length > 32) return
    const options = value.options.flatMap((item) => {
      const next = text(item, 512)
      return next ? [next] : []
    })
    if (options.length !== value.options.length) return
    result.options = options
  }
  if (value.allowFreeform !== undefined) {
    if (typeof value.allowFreeform !== "boolean") return
    result.allowFreeform = value.allowFreeform
  }
  return result
}

export function reduceOrchestratorEvent(state: OrchestratorState, value: RecordValue): OrchestratorState {
  const type = text(value.type, 128)
  if (!type) return state
  const cursor = text(value.cursor, 128)
  const turnID = id(value.turnID)
  const base = { ...state, ...(cursor ? { cursor } : {}), ...(turnID ? { turnID } : {}) }
  if (type === "turn.output" || type === "turn.reasoning" || type === "turn.retry") {
    const content = text(value.text ?? value.reason, MAX_TEXT)
    if (!content) return base
    const item: OrchestratorItem = {
      id: `${type}:${cursor ?? crypto.randomUUID()}`,
      type: type === "turn.output" ? "output" : type === "turn.reasoning" ? "reasoning" : "retry",
      text: content,
    }
    return {
      ...base,
      phase: type === "turn.retry" ? "running" : "running",
      items: [...state.items, item].slice(-MAX_ITEMS),
    }
  }
  if (type === "tool.updated" && record(value.tool)) {
    const toolID = id(value.tool.id)
    const title = text(value.tool.title, 512)
    const status = text(value.tool.status, 64)
    if (!toolID || !title || !status) return base
    const item: OrchestratorItem = {
      id: toolID,
      type: "tool",
      title,
      status,
      ...(text(value.tool.kind, 64) ? { kind: text(value.tool.kind, 64) } : {}),
    }
    const items = [...state.items.filter((current) => current.id !== toolID), item].slice(-MAX_ITEMS)
    return { ...base, phase: "running", items }
  }
  if (type === "plan.available" && record(value.plan)) {
    const planID = id(value.plan.id)
    const content = text(value.plan.content, MAX_TEXT)
    if (!planID || !content) return base
    const item: OrchestratorItem = { id: planID, type: "plan", content }
    return {
      ...base,
      phase: "running",
      items: [...state.items, item].slice(-MAX_ITEMS),
    }
  }
  if (type === "artifact.created" && record(value.artifact)) {
    const artifactID = id(value.artifact.id)
    const name = text(value.artifact.name, 256)
    const path = text(value.artifact.path, 4_096)
    const kind = text(value.artifact.kind, 64)
    if (!artifactID || !name || !path || !kind) return base
    const item: OrchestratorItem = { id: artifactID, type: "artifact", name, path, kind }
    return { ...base, phase: "running", items: [...state.items, item].slice(-MAX_ITEMS) }
  }
  if (type === "interaction.approval.requested" && record(value.interaction)) {
    const interaction = parseInteraction(value.interaction, "approval")
    return interaction ? { ...base, phase: "waiting", interaction } : base
  }
  if (type === "interaction.question.requested" && record(value.interaction)) {
    const interaction = parseInteraction(value.interaction, "question")
    return interaction ? { ...base, phase: "waiting", interaction } : base
  }
  if (type === "turn.completed") {
    const status = value.status === "failed" ? "error" : value.status === "stopped" ? "stopped" : "completed"
    const message = text(value.message, 2_048)
    return { ...base, phase: status, interaction: undefined, ...(message ? { error: message } : {}) }
  }
  return base
}

export function initialOrchestratorState(): OrchestratorState {
  return { phase: "connecting", items: [] }
}

export function isOrchestratorAvailable(ssh: SshTransport) {
  return typeof ssh.orchestratorStart === "function" && typeof ssh.orchestratorInput === "function"
}

export type OrchestratorWire = {
  ssh: SshTransport
  send(value: RecordValue): Promise<RecordValue>
  connect(onEvent: (value: RecordValue) => void): () => void
  scope(id: string): void
}

export function wire(ssh: SshTransport): OrchestratorWire {
  const pending = new Map<
    string,
    { resolve: (value: RecordValue) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  >()
  let unsubscribe: () => void = () => undefined
  let channel: string | undefined
  const send = (value: RecordValue) => {
    if (!channel) return Promise.reject(new Error("The orchestration transport has no active native channel."))
    const request = id(value.requestID)
    if (!request) return Promise.reject(new Error("The orchestration request has no valid request ID."))
    const task = new Promise<RecordValue>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(request)
        reject(new Error("The remote orchestrator did not respond in time."))
      }, REQUEST_TIMEOUT)
      pending.set(request, { resolve, reject, timer })
    })
    void ssh.orchestratorInput(JSON.stringify(value)).catch((error) => {
      const item = pending.get(request)
      if (!item) return
      pending.delete(request)
      clearTimeout(item.timer)
      item.reject(error instanceof Error ? error : new Error("Could not send orchestration request."))
    })
    return task
  }
  const connect = (onEvent: (value: RecordValue) => void) => {
    unsubscribe = ssh.subscribeOrchestrator((event: SshOrchestratorEvent) => {
      if (!channel || event.id !== channel) return
      if (event.type === "error") {
        for (const [request, item] of pending) {
          pending.delete(request)
          clearTimeout(item.timer)
          item.reject(new Error(event.message))
        }
        return
      }
      if (event.type === "completed") {
        for (const [request, item] of pending) {
          pending.delete(request)
          clearTimeout(item.timer)
          item.reject(new Error(`Remote orchestrator exited with code ${event.exitCode}.`))
        }
        return
      }
      if (event.type !== "output") return
      const parsed = parseOrchestratorLine(event.data)
      const message = parsed && parseOrchestratorEvent(parsed)
      if (!message) return
      if (message.kind === "response" && pending.has(message.requestID)) {
        const item = pending.get(message.requestID)!
        pending.delete(message.requestID)
        clearTimeout(item.timer)
        item.resolve(message.value)
        return
      }
      if (message.kind === "error" && message.requestID && pending.has(message.requestID)) {
        const item = pending.get(message.requestID)!
        pending.delete(message.requestID)
        clearTimeout(item.timer)
        item.reject(new Error(message.message))
        return
      }
      if (message.kind === "event") onEvent(message.value)
    })
    return () => {
      unsubscribe()
      channel = undefined
      for (const item of pending.values()) {
        clearTimeout(item.timer)
        item.reject(new Error("Orchestration transport closed."))
      }
      pending.clear()
    }
  }
  return {
    ssh,
    send,
    connect,
    scope(value) {
      const next = id(value)
      if (!next) throw new Error("The native orchestration channel ID is invalid.")
      channel = next
    },
  }
}

const REQUEST_TIMEOUT = 30_000
