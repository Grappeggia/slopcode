import { Identifier } from "@/id/id"
import { promptHistoryPath, readPromptHistory, writePromptHistory } from "@/cli/cmd/tui/component/prompt/history-store"

export type PortableArgs = {
  model?: string
  agent?: string
  prompt?: string
  continue?: boolean
  sessionID?: string
  fork?: boolean
}

type Input = NodeJS.ReadStream & { setRawMode?: (mode: boolean) => void; isTTY?: boolean }
type Output = NodeJS.WriteStream & { columns?: number; rows?: number; isTTY?: boolean }

type SessionInfo = {
  id: string
  title?: string
  parentID?: string
  time?: { created?: number; updated?: number }
}

type MessageInfo = {
  id: string
  sessionID: string
  role: "user" | "assistant"
  agent?: string
  model?: { providerID: string; modelID: string }
  providerID?: string
  modelID?: string
  time?: { created?: number; completed?: number }
  error?: { name?: string; data?: unknown }
}

type Part = {
  id: string
  sessionID: string
  messageID: string
  type: string
  text?: string
  tool?: string
  state?: { status?: string; error?: string; input?: unknown }
  time?: { start?: number; end?: number }
  metadata?: Record<string, unknown>
}

type Chunk = {
  messageID: string
  parts: Part[]
}

type PermissionRequest = {
  id: string
  sessionID: string
  permission: string
  patterns: Array<string | { pattern?: string }>
  reason?: string
  metadata?: Record<string, unknown>
}

type QuestionInfo = {
  question: string
  header: string
  options: Array<{ label: string; description: string }>
  multiple?: boolean
  custom?: boolean
}

type QuestionRequest = {
  id: string
  sessionID: string
  questions: QuestionInfo[]
}

type PortableEvent = {
  type: string
  properties?: Record<string, unknown>
}

type MessageRecord = {
  info: MessageInfo
  parts: Map<string, Part>
}

type Notice = {
  id: string
  text: string
  kind: "info" | "error" | "warning"
}

export type PortableState = {
  sessionID?: string
  model?: string
  agent?: string
  variant?: string
  status: string
  input: string
  cursor: number
  history: string[]
  historyIndex?: number
  historyDraft?: string
  mode: "prompt" | "permission" | "question"
  permission?: PermissionRequest
  question?: {
    request: QuestionRequest
    index: number
    answers: string[][]
    input: string
  }
  sessions: Map<string, SessionInfo>
  messages: Map<string, MessageRecord>
  order: string[]
  notices: Notice[]
  connected: boolean
}

export function createPortableState(args: PortableArgs = {}): PortableState {
  return {
    sessionID: args.sessionID,
    model: args.model,
    agent: args.agent,
    status: "starting",
    input: "",
    cursor: 0,
    history: [],
    mode: "prompt",
    sessions: new Map(),
    messages: new Map(),
    order: [],
    notices: [],
    connected: false,
  }
}

function object(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null
}

function string(input: unknown): input is string {
  return typeof input === "string"
}

function info(input: unknown): MessageInfo | undefined {
  if (!object(input)) return
  if (!string(input.id) || !string(input.sessionID)) return
  if (input.role !== "user" && input.role !== "assistant") return
  return input as MessageInfo
}

function part(input: unknown): Part | undefined {
  if (!object(input)) return
  if (!string(input.id) || !string(input.sessionID) || !string(input.messageID) || !string(input.type)) return
  return input as Part
}

function session(input: unknown): SessionInfo | undefined {
  if (!object(input)) return
  if (!string(input.id)) return
  return input as SessionInfo
}

function permission(input: unknown): PermissionRequest | undefined {
  if (!object(input)) return
  if (!string(input.id) || !string(input.sessionID) || !string(input.permission) || !Array.isArray(input.patterns))
    return
  return input as PermissionRequest
}

function question(input: unknown): QuestionRequest | undefined {
  if (!object(input)) return
  if (!string(input.id) || !string(input.sessionID) || !Array.isArray(input.questions)) return
  return input as QuestionRequest
}

function ensure(state: PortableState, message: MessageInfo) {
  const existing = state.messages.get(message.id)
  if (existing) {
    existing.info = message
    return existing
  }
  const next = { info: message, parts: new Map<string, Part>() }
  state.messages.set(message.id, next)
  state.order.push(message.id)
  return next
}

function notice(state: PortableState, text: string, kind: Notice["kind"] = "info") {
  state.notices.push({ id: Identifier.ascending("message"), text, kind })
  if (state.notices.length > 20) state.notices.shift()
}

const commands = ["/new", "/sessions", "/session", "/continue", "/model", "/agent", "/interrupt", "/help", "/exit", "/quit"]

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function insert(state: PortableState, text: string) {
  state.input = state.input.slice(0, state.cursor) + text + state.input.slice(state.cursor)
  state.cursor += text.length
}

function backspace(state: PortableState) {
  if (state.cursor === 0) return
  state.input = state.input.slice(0, state.cursor - 1) + state.input.slice(state.cursor)
  state.cursor--
}

function remove(state: PortableState) {
  if (state.cursor >= state.input.length) return
  state.input = state.input.slice(0, state.cursor) + state.input.slice(state.cursor + 1)
}

function wordLeft(state: PortableState) {
  while (state.cursor > 0 && /\s/.test(state.input[state.cursor - 1] ?? "")) state.cursor--
  while (state.cursor > 0 && !/\s/.test(state.input[state.cursor - 1] ?? "")) state.cursor--
}

function wordRight(state: PortableState) {
  while (state.cursor < state.input.length && !/\s/.test(state.input[state.cursor] ?? "")) state.cursor++
  while (state.cursor < state.input.length && /\s/.test(state.input[state.cursor] ?? "")) state.cursor++
}

function deleteWordBefore(state: PortableState) {
  while (state.cursor > 0 && /\s/.test(state.input[state.cursor - 1] ?? "")) backspace(state)
  while (state.cursor > 0 && !/\s/.test(state.input[state.cursor - 1] ?? "")) backspace(state)
}

function complete(state: PortableState) {
  if (state.cursor !== state.input.length || !state.input.startsWith("/") || state.input.includes(" ")) return
  const matches = commands.filter((item) => item.startsWith(state.input))
  if (matches.length === 1) {
    state.input = `${matches[0]} `
    state.cursor = state.input.length
  }
}

function shown(input: string, cursor: number) {
  return input.slice(0, cursor) + "|" + input.slice(cursor)
}

export function parseModel(input?: string) {
  if (!input) return
  const split = input.split("/")
  if (split.length < 2) return
  const providerID = split.shift()!
  const modelID = split.join("/")
  if (!providerID || !modelID) return
  return { providerID, modelID }
}

export function parseSseBlock(block: string): PortableEvent | undefined {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n")
  if (!data) return
  const parsed = JSON.parse(data) as unknown
  if (!object(parsed) || !string(parsed.type)) return
  return parsed as PortableEvent
}

export function parseQuestionAnswer(input: string, info: QuestionInfo) {
  const text = input.trim()
  if (!text) return []
  const tokens = info.multiple
    ? text
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [text]
  const labels = tokens.flatMap((token) => {
    const index = Number(token)
    const option = Number.isInteger(index) ? info.options[index - 1] : undefined
    if (option) return [option.label]
    const found = info.options.find((item) => item.label.toLowerCase() === token.toLowerCase())
    if (found) return [found.label]
    return info.custom === false ? [] : [token]
  })
  return info.multiple ? labels : labels.slice(0, 1)
}

export function applyPortableEvent(state: PortableState, event: PortableEvent) {
  const props = event.properties ?? {}
  if (event.type === "server.connected") {
    state.connected = true
    return
  }
  if (event.type === "session.status") {
    if (props.sessionID !== state.sessionID) return
    const status = object(props.status) && string(props.status.type) ? props.status.type : "idle"
    state.status = status === "busy" && object(props.status) && string(props.status.phase) ? props.status.phase : status
    return
  }
  if (event.type === "session.created" || event.type === "session.updated") {
    const next = session(props.info)
    if (!next) return
    state.sessions.set(next.id, next)
    return
  }
  if (event.type === "message.updated") {
    const next = info(props.info)
    if (!next || next.sessionID !== state.sessionID) return
    ensure(state, next)
    return
  }
  if (event.type === "message.part.updated") {
    const next = part(props.part)
    if (!next || next.sessionID !== state.sessionID) return
    const record =
      state.messages.get(next.messageID) ??
      ensure(state, {
        id: next.messageID,
        sessionID: next.sessionID,
        role: "assistant",
        time: { created: Date.now() },
      })
    record.parts.set(next.id, next)
    return
  }
  if (event.type === "message.part.delta") {
    if (!string(props.partID) || !string(props.messageID) || !string(props.field) || !string(props.delta)) return
    if (string(props.sessionID) && props.sessionID !== state.sessionID) return
    const record =
      state.messages.get(props.messageID) ??
      ensure(state, {
        id: props.messageID,
        sessionID: string(props.sessionID) ? props.sessionID : (state.sessionID ?? "ses_unknown"),
        role: "assistant",
        time: { created: Date.now() },
      })
    const current = record.parts.get(props.partID) ?? {
      id: props.partID,
      sessionID: record.info.sessionID,
      messageID: props.messageID,
      type: "text",
      text: "",
    }
    if (props.field !== "text") return
    current.text = (current.text ?? "") + props.delta
    record.parts.set(current.id, current)
    return
  }
  if (event.type === "message.part.removed") {
    if (!string(props.messageID) || !string(props.partID)) return
    state.messages.get(props.messageID)?.parts.delete(props.partID)
    return
  }
  if (event.type === "permission.asked") {
    const request = permission(props)
    if (!request || request.sessionID !== state.sessionID) return
    state.permission = request
    state.mode = "permission"
    notice(state, `permission requested: ${request.permission}`, "warning")
    return
  }
  if (event.type === "permission.replied") {
    if (props.sessionID !== state.sessionID) return
    if (state.permission?.id === props.requestID) {
      state.permission = undefined
      state.mode = "prompt"
    }
    return
  }
  if (event.type === "question.asked") {
    const request = question(props)
    if (!request || request.sessionID !== state.sessionID) return
    state.question = { request, index: 0, answers: [], input: "" }
    state.mode = "question"
    notice(state, "assistant asked a question", "warning")
    return
  }
  if (event.type === "question.replied" || event.type === "question.rejected") {
    if (props.sessionID !== state.sessionID) return
    if (state.question?.request.id === props.requestID) {
      state.question = undefined
      state.mode = "prompt"
    }
    return
  }
  if (event.type === "session.error") {
    if (string(props.sessionID) && props.sessionID !== state.sessionID) return
    const err = object(props.error) && string(props.error.name) ? props.error.name : "session error"
    notice(state, err, "error")
  }
}

function clean(input: string) {
  return input.replace(
    /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g,
    "",
  )
}

function wrap(input: string, width: number) {
  const limit = Math.max(8, width)
  const lines: string[] = []
  for (const raw of input.split("\n")) {
    let line = raw
    while (clean(line).length > limit) {
      lines.push(line.slice(0, limit))
      line = line.slice(limit)
    }
    lines.push(line)
  }
  return lines
}

function parts(record: MessageRecord, type: string) {
  return [...record.parts.values()].filter((item) => item.type === type).sort((a, b) => a.id.localeCompare(b.id))
}

function partText(record: MessageRecord) {
  return parts(record, "text")
    .map((item) => item.text ?? "")
    .join("\n")
    .trim()
}

function toolLines(record: MessageRecord) {
  return parts(record, "tool").map((item) => {
    const status = item.state?.status ?? "pending"
    const suffix = status === "error" && item.state?.error ? `: ${item.state.error}` : ""
    return `tool ${item.tool ?? "unknown"} ${status}${suffix}`
  })
}

export function renderPortableLines(state: PortableState, width = 80, height = 24) {
  const session = state.sessionID ? state.sessions.get(state.sessionID) : undefined
  const model = state.model ? ` model ${state.model}` : ""
  const agent = state.agent ? ` agent ${state.agent}` : ""
  const header = `SlopCode Android fallback | ${state.status}${model}${agent}`
  const title = session?.title ?? state.sessionID ?? "new session"
  const body: string[] = []
  body.push(`session ${title}`)
  body.push("")
  for (const id of state.order) {
    const record = state.messages.get(id)
    if (!record) continue
    const label = record.info.role === "user" ? "You" : "Assistant"
    const text = partText(record)
    if (text) body.push(...wrap(`${label}: ${text}`, width))
    for (const line of toolLines(record)) body.push(...wrap(`  ${line}`, width))
    if (record.info.role === "assistant" && record.info.error?.name) body.push(`  error ${record.info.error.name}`)
    if (text || toolLines(record).length > 0) body.push("")
  }
  for (const item of state.notices) body.push(...wrap(`${item.kind}: ${item.text}`, width))
  if (state.mode === "permission" && state.permission) {
    body.push(...wrap(`permission requested: ${state.permission.permission}`, width))
    body.push(
      ...state.permission.patterns.flatMap((item) =>
        wrap(`  ${typeof item === "string" ? item : (item.pattern ?? "*")}`, width),
      ),
    )
  }
  const footer = (() => {
    if (state.mode === "permission" && state.permission) return "permission | o once, a always, r reject"
    if (state.mode === "question" && state.question) {
      const item = state.question.request.questions[state.question.index]
      if (!item) return "question | enter answer"
      const options = item.options.map((option, index) => `${index + 1}) ${option.label}`).join("  ")
      return `${item.header}: ${item.question} ${options} > ${state.question.input}`
    }
    return `> ${shown(state.input, clamp(state.cursor, 0, state.input.length))}`
  })()
  const footerLines = wrap(footer, width)
  const maxBody = Math.max(1, height - 1 - footerLines.length)
  return [header.slice(0, width), ...body.slice(-maxBody), ...footerLines.map((item) => item.slice(0, width))]
}

function screen(lines: string[], width: number, height: number) {
  const rows = lines.slice(0, height).map((line) => {
    const raw = clean(line)
    return line + " ".repeat(Math.max(0, width - raw.length))
  })
  while (rows.length < height) rows.push(" ".repeat(width))
  return "\x1b[H" + rows.join("\n")
}

function writeLine(output: Output, text: string) {
  output.write(text + "\n")
}

export async function portableTui(input: {
  url: string
  headers?: RequestInit["headers"]
  directory: string
  viewID?: string
  args: PortableArgs
  stdin?: Input
  stdout?: Output
}) {
  const stdin = input.stdin ?? process.stdin
  const stdout = input.stdout ?? process.stdout
  const state = createPortableState(input.args)
  const abort = new AbortController()
  let done: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let raw = false
  let paste: string | undefined
  let historyFile: string | undefined

  const base = input.url.endsWith("/") ? input.url : input.url + "/"
  const url = (path: string) => new URL(path.replace(/^\//, ""), base).toString()
  const headers = (json: boolean) => {
    const result = new Headers(input.headers)
    result.set("accept", "application/json")
    if (json) result.set("content-type", "application/json")
    return result
  }
  const request = async <T>(method: string, path: string, body?: unknown) => {
    const res = await fetch(url(path), {
      method,
      headers: headers(body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: abort.signal,
    })
    if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`)
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  const loadHistory = (sessionID?: string) => {
    historyFile = promptHistoryPath({ dir: input.directory, sessionID })
    state.history = readPromptHistory(historyFile).history.map((item) => item.input).filter(Boolean)
    state.historyIndex = undefined
    state.historyDraft = undefined
  }

  const saveHistory = () => {
    if (!historyFile) return
    void writePromptHistory(
      historyFile,
      state.history.map((item) => ({ input: item, mode: "normal" as const, parts: [] })),
    ).catch(() => {})
  }

  const draw = () => {
    timer = undefined
    const width = Math.max(40, stdout.columns ?? 80)
    const height = Math.max(10, stdout.rows ?? 24)
    const lines = renderPortableLines(state, width, height)
    if (!stdout.isTTY) {
      writeLine(stdout, lines.join("\n"))
      return
    }
    stdout.write(screen(lines, width, height))
  }
  const schedule = () => {
    if (timer) return
    timer = setTimeout(draw, 16)
  }

  const sync = async (sessionID: string) => {
    const current = await request<SessionInfo>("GET", `/session/${sessionID}`)
    state.sessions.set(current.id, current)
    state.messages.clear()
    state.order = []
    const index = await request<MessageInfo[]>("GET", `/session/${sessionID}/message/index?limit=40`)
    for (const item of index) ensure(state, item)
    if (index.length > 0) {
      const chunks = await request<Chunk[]>("POST", `/session/${sessionID}/message/chunk`, {
        messageIDs: index.map((item) => item.id),
      })
      for (const chunk of chunks) {
        const record = state.messages.get(chunk.messageID)
        if (!record) continue
        for (const item of chunk.parts) record.parts.set(item.id, item)
      }
    }
    schedule()
  }

  const activate = async (sessionID: string) => {
    state.sessionID = sessionID
    state.status = "idle"
    loadHistory(sessionID)
    await sync(sessionID)
  }

  const create = async () => {
    const next = await request<SessionInfo>("POST", "/session", {})
    await activate(next.id)
    return next.id
  }

  const last = async () => {
    const sessions = await request<SessionInfo[]>("GET", "/session?roots=true&limit=1")
    return sessions[0]?.id
  }

  const submitPrompt = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return true
    if (trimmed.startsWith("/")) return command(trimmed)
    const sessionID = state.sessionID ?? (await create())
    const model = parseModel(state.model)
    await request<void>("POST", `/session/${sessionID}/prompt_async`, {
      messageID: Identifier.ascending("message"),
      ...(state.agent ? { agent: state.agent } : {}),
      ...(model ? { model } : {}),
      ...(state.variant ? { variant: state.variant } : {}),
      parts: [{ id: Identifier.ascending("part"), type: "text", text: trimmed }],
    })
    if (state.history.at(-1) !== trimmed) state.history.push(trimmed)
    if (state.history.length > 50) state.history = state.history.slice(-50)
    state.historyIndex = undefined
    state.historyDraft = undefined
    saveHistory()
    state.status = "sent"
    return true
  }

  const command = async (line: string) => {
    const [name = "", ...rest] = line.slice(1).split(" ")
    const value = rest.join(" ").trim()
    if (["exit", "quit", "q"].includes(name)) return false
    if (name === "help") {
      notice(state, "/new /sessions /session <id> /continue /model <provider/model> /agent <name> /interrupt /exit")
      return true
    }
    if (name === "new") {
      await create()
      notice(state, "created new session")
      return true
    }
    if (name === "continue") {
      const found = await last()
      if (!found) notice(state, "no previous session", "warning")
      else await activate(found)
      return true
    }
    if (name === "sessions") {
      const list = await request<SessionInfo[]>("GET", "/session?roots=true&limit=10")
      for (const item of list) notice(state, `${item.id} ${item.title ?? "untitled"}`)
      return true
    }
    if (name === "session") {
      if (!value) notice(state, "usage: /session <id>", "warning")
      else await activate(value)
      return true
    }
    if (name === "model") {
      if (!parseModel(value)) notice(state, "usage: /model provider/model", "warning")
      else state.model = value
      return true
    }
    if (name === "agent") {
      state.agent = value || undefined
      notice(state, state.agent ? `agent ${state.agent}` : "agent cleared")
      return true
    }
    if (name === "interrupt") {
      if (state.sessionID) await request<boolean>("POST", `/session/${state.sessionID}/abort`, {})
      return true
    }
    notice(state, `unknown command: /${name}`, "warning")
    return true
  }

  const replyPermission = async (reply: "once" | "always" | "reject") => {
    if (!state.permission) return
    await request<boolean>("POST", `/permission/${state.permission.id}/reply?sessionID=${state.permission.sessionID}`, {
      reply,
    })
    state.permission = undefined
    state.mode = "prompt"
    notice(state, `permission ${reply}`)
  }

  const replyQuestion = async () => {
    const active = state.question
    if (!active) return
    const item = active.request.questions[active.index]
    if (!item) return
    const answer = parseQuestionAnswer(active.input, item)
    if (answer.length === 0) {
      notice(state, "answer required", "warning")
      return
    }
    active.answers[active.index] = answer
    active.input = ""
    if (active.index + 1 < active.request.questions.length) {
      active.index++
      return
    }
    await request<boolean>("POST", `/question/${active.request.id}/reply?sessionID=${active.request.sessionID}`, {
      answers: active.answers,
    })
    state.question = undefined
    state.mode = "prompt"
    notice(state, "question answered")
  }

  const events = async () => {
    while (!abort.signal.aborted) {
      const res = await fetch(url("/event"), { headers: headers(false), signal: abort.signal }).catch(() => undefined)
      if (!res?.body) {
        await Bun.sleep(250)
        continue
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      try {
        while (!abort.signal.aborted) {
          const chunk = await reader.read()
          if (chunk.done) break
          buffer += decoder.decode(chunk.value, { stream: true })
          let split = buffer.search(/\r?\n\r?\n/)
          while (split >= 0) {
            const block = buffer.slice(0, split)
            buffer = buffer.slice(buffer[split] === "\r" ? split + 4 : split + 2)
            const event = parseSseBlock(block)
            if (event) {
              applyPortableEvent(state, event)
              schedule()
            }
            split = buffer.search(/\r?\n\r?\n/)
          }
        }
      } catch {
        if (abort.signal.aborted) break
      }
      await Bun.sleep(250)
    }
  }

  const stop = () => {
    abort.abort()
    if (timer) clearTimeout(timer)
    if (raw) stdin.setRawMode?.(false)
    stdin.off("data", onData)
    process.off("SIGWINCH", draw)
    if (stdout.isTTY) stdout.write("\x1b[?25h\x1b[?1049l")
    done?.()
  }

  const submit = async () => {
    if (state.mode === "question") {
      await replyQuestion()
      schedule()
      return
    }
    const text = state.input
    state.input = ""
    state.cursor = 0
    const keep = await submitPrompt(text).catch((error) => {
      notice(state, error instanceof Error ? error.message : String(error), "error")
      return true
    })
    schedule()
    if (!keep) stop()
  }

  const history = (step: 1 | -1) => {
    if (state.history.length === 0) return
    if (state.historyIndex === undefined) state.historyDraft = state.input
    const index = state.historyIndex ?? state.history.length
    if (step === 1 && index >= state.history.length - 1) {
      state.historyIndex = undefined
      state.input = state.historyDraft ?? ""
      state.cursor = state.input.length
      return
    }
    const next = clamp(index + step, 0, state.history.length - 1)
    state.historyIndex = next
    state.input = state.history[next] ?? ""
    state.cursor = state.input.length
  }

  const promptData = (text: string) => {
    for (let i = 0; i < text.length; ) {
      if (paste !== undefined) {
        const end = text.indexOf("\x1b[201~", i)
        if (end < 0) {
          paste += text.slice(i)
          return
        }
        insert(state, (paste + text.slice(i, end)).replace(/\r\n/g, "\n").replace(/\r/g, "\n"))
        paste = undefined
        i = end + "\x1b[201~".length
        continue
      }
      const rest = text.slice(i)
      if (rest.startsWith("\x1b[200~")) {
        paste = ""
        i += "\x1b[200~".length
        continue
      }
      if (rest.startsWith("\x1b[A")) {
        history(-1)
        i += 3
        continue
      }
      if (rest.startsWith("\x1b[B")) {
        history(1)
        i += 3
        continue
      }
      if (rest.startsWith("\x1b[D")) {
        state.cursor = Math.max(0, state.cursor - 1)
        i += 3
        continue
      }
      if (rest.startsWith("\x1b[C")) {
        state.cursor = Math.min(state.input.length, state.cursor + 1)
        i += 3
        continue
      }
      if (rest.startsWith("\x1b[H") || rest.startsWith("\x1b[1~")) {
        state.cursor = 0
        i += rest.startsWith("\x1b[1~") ? 4 : 3
        continue
      }
      if (rest.startsWith("\x1b[F") || rest.startsWith("\x1b[4~")) {
        state.cursor = state.input.length
        i += rest.startsWith("\x1b[4~") ? 4 : 3
        continue
      }
      if (rest.startsWith("\x1b[3~")) {
        remove(state)
        i += 4
        continue
      }
      if (rest.startsWith("\x1bb") || rest.startsWith("\x1bB")) {
        wordLeft(state)
        i += 2
        continue
      }
      if (rest.startsWith("\x1bf") || rest.startsWith("\x1bF")) {
        wordRight(state)
        i += 2
        continue
      }
      const ch = text[i] ?? ""
      i++
      if (ch === "\x03") {
        if (state.status !== "idle" && state.sessionID) void request<boolean>("POST", `/session/${state.sessionID}/abort`, {}).then(schedule)
        else stop()
      } else if (ch === "\x04") {
        if (state.input) remove(state)
        else stop()
      } else if (ch === "\r" || ch === "\n") void submit()
      else if (ch === "\t") complete(state)
      else if (ch === "\x01") state.cursor = 0
      else if (ch === "\x05") state.cursor = state.input.length
      else if (ch === "\x15") {
        state.input = state.input.slice(state.cursor)
        state.cursor = 0
      } else if (ch === "\x0b") state.input = state.input.slice(0, state.cursor)
      else if (ch === "\x17") deleteWordBefore(state)
      else if (ch === "\u007f" || ch === "\b") backspace(state)
      else if (ch === "\f") draw()
      else if (ch >= " " && ch !== "\u007f") insert(state, ch)
    }
  }

  const onData = (data: Buffer) => {
    const text = data.toString("utf8")
    if (state.mode === "permission") {
      if (text === "\x03" || text === "\x04") stop()
      else if (text === "o") void replyPermission("once").then(schedule)
      else if (text === "a") void replyPermission("always").then(schedule)
      else if (text === "r" || text === "\x1b") void replyPermission("reject").then(schedule)
      return
    }
    if (state.mode === "question") {
      for (const ch of text) {
        if (ch === "\x03" || ch === "\x04") stop()
        else if (ch === "\r" || ch === "\n") void submit()
        else if (ch === "\u007f" || ch === "\b") state.question ? (state.question.input = state.question.input.slice(0, -1)) : undefined
        else if (ch >= " " && ch !== "\u007f") state.question ? (state.question.input += ch) : undefined
      }
    } else promptData(text)
    schedule()
  }

  if (input.args.continue && !state.sessionID) state.sessionID = await last()
  if (state.sessionID && input.args.fork)
    state.sessionID = (await request<SessionInfo>("POST", `/session/${state.sessionID}/fork`, {})).id
  if (!state.sessionID) await create()
  else await activate(state.sessionID)

  void events()
  if (stdout.isTTY) stdout.write("\x1b[?1049h\x1b[?25l\x1b[2J")
  if (stdin.isTTY && stdin.setRawMode) {
    stdin.setRawMode(true)
    raw = true
  }
  stdin.on("data", onData)
  stdin.resume()
  process.on("SIGWINCH", draw)
  notice(state, "portable fallback active; shared Android TUI was unavailable")
  notice(state, "type /help for commands")
  schedule()

  if (input.args.prompt) {
    await submitPrompt(input.args.prompt).catch((error) =>
      notice(state, error instanceof Error ? error.message : String(error), "error"),
    )
    schedule()
  }

  await new Promise<void>((resolve) => {
    done = resolve
  })
}
