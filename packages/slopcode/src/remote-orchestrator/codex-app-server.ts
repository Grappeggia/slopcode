import { ChildProcess, spawn } from "node:child_process"
import path from "node:path"
import { AgentOrchestrationLimits, type AgentOrchestrationCapability } from "@slopcode-ai/protocol"
import type { ACPEvent, Session } from "./acp"
import { approvalCwd, contained } from "./workspace"

export type Launch = (cwd: string) => ChildProcess

export const argv = ["codex", "app-server", "--stdio"] as const

export const launch: Launch = (cwd) =>
  spawn(argv[0], argv.slice(1), {
    cwd,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  })

type RecordValue = Record<string, unknown>
type Pending = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}
type Turn = {
  resolve: () => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const record = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const bytes = (value: string) => Buffer.byteLength(value)
const MAX_APP_SERVER_FRAME_BYTES = 4 * 1024 * 1024
const clean = (value: unknown, size = AgentOrchestrationLimits.maxTextBytes, fallback = "") => {
  if (typeof value !== "string") return fallback
  const normalized = value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, " ")
    .replace(/\r\n?/g, "\n")
    .trim()
  const output = [...normalized].reduce(
    (result, character) => (bytes(result) + bytes(character) <= size ? result + character : result),
    "",
  )
  return output || fallback
}
const delta = (value: unknown) => {
  if (typeof value !== "string") return ""
  const normalized = value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, " ")
    .replace(/\r\n?/g, "\n")
  return [...normalized].reduce(
    (result, character) =>
      bytes(result) + bytes(character) <= AgentOrchestrationLimits.maxTextBytes ? result + character : result,
    "",
  )
}
const object = (value: unknown) => (record(value) ? value : {})
const id = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : "")
const status = (value: unknown, done: boolean): "pending" | "in_progress" | "completed" | "failed" => {
  if (!done) return "in_progress"
  return value === "failed" || value === "declined" ? "failed" : "completed"
}
const message = (value: unknown, fallback: string) => {
  const item = object(value)
  return clean(item.message ?? item.additionalDetails, 4 * 1024, fallback)
}
const itemID = (value: RecordValue) => clean(value.id, 512, `codex_${crypto.randomUUID()}`)
const title = (value: RecordValue) => {
  if (value.type === "commandExecution") return clean(value.command, 512, "Run command")
  if (value.type === "fileChange") {
    const changes = Array.isArray(value.changes) ? value.changes.length : 0
    return changes === 1 ? "Change 1 file" : `Change ${changes} files`
  }
  if (value.type === "mcpToolCall") return `${clean(value.server, 128, "MCP")}: ${clean(value.tool, 256, "tool")}`
  if (value.type === "dynamicToolCall") return clean(value.tool, 256, "Dynamic tool")
  if (value.type === "collabAgentToolCall") return clean(value.tool, 256, "Agent collaboration")
  if (value.type === "webSearch") return "Search the web"
  if (value.type === "imageView") return "View image"
  if (value.type === "imageGeneration") return "Generate image"
  return clean(value.type, 256, "Codex tool")
}
const kind = (value: RecordValue) => {
  if (value.type === "commandExecution") return "execute"
  if (value.type === "fileChange") return "edit"
  if (value.type === "webSearch") return "search"
  if (value.type === "imageView") return "read"
  if (value.type === "reasoning") return "think"
  return "other"
}
const wait = (child: ChildProcess, ms: number) =>
  new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve()
    const timer = setTimeout(resolve, ms)
    child.once("exit", () => {
      clearTimeout(timer)
      resolve()
    })
    child.once("error", () => {
      clearTimeout(timer)
      resolve()
    })
  })
const stop = async (child: ChildProcess) => {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill("SIGTERM")
  await wait(child, 250)
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill("SIGKILL")
  await wait(child, 250)
}

export async function connect(input: {
  cwd: string
  emit: (event: ACPEvent) => void
  start?: Launch
  resume?: string
}): Promise<Session> {
  const child = (input.start ?? launch)(input.cwd)
  if (!child.stdin || !child.stdout || !child.stderr) {
    await stop(child)
    throw new Error("Codex App Server did not provide stdio")
  }
  const stdin = child.stdin
  const pending = new Map<string, Pending>()
  const turns = new Map<string, Turn>()
  const approvals = new Map<string, (approved: boolean) => void>()
  const questions = new Map<string, (answer?: string) => void>()
  const deltas = new Set<string>()
  let sequence = 0
  let buffer = Buffer.alloc(0)
  let stderr = ""
  let closed = false
  let ready = false
  let queue = Promise.resolve()
  const emit = (event: ACPEvent) => {
    try {
      input.emit(event)
    } catch (error) {
      process.stderr.write(
        `[remote-orchestrator/codex] dropped App Server event: ${clean(error instanceof Error ? error.message : "invalid event", 512, "invalid event")}\n`,
      )
    }
  }
  const write = (value: RecordValue) => {
    if (closed || stdin.destroyed) throw new Error("Codex App Server connection is closed")
    stdin.write(`${JSON.stringify(value)}\n`)
  }
  const fail = (error: Error) => {
    for (const value of pending.values()) {
      clearTimeout(value.timer)
      value.reject(error)
    }
    pending.clear()
    for (const value of turns.values()) {
      clearTimeout(value.timer)
      value.reject(error)
    }
    turns.clear()
  }
  const request = (method: string, params: RecordValue, ms = 15_000) => {
    const requestID = String(++sequence)
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestID)
        reject(new Error(`Codex App Server ${method} timed out`))
      }, ms)
      pending.set(requestID, { resolve, reject, timer })
      write({ method, id: sequence, params })
    })
  }
  const respond = (requestID: unknown, result: unknown) => write({ id: requestID, result })
  const artifact = async (value: RecordValue) => {
    if (value.type !== "fileChange" || !Array.isArray(value.changes)) return
    await Promise.all(
      value.changes.map(async (entry) => {
        const change = object(entry)
        const target = clean(change.path, AgentOrchestrationLimits.maxPathBytes)
        if (!target) return
        const absolute = path.isAbsolute(target) ? target : path.resolve(input.cwd, target)
        const safe = await contained(input.cwd, absolute).catch(() => undefined)
        if (!safe) return
        emit({
          type: "artifact",
          id: `${itemID(value)}:${target}`,
          name: path.basename(safe),
          path: safe,
          kind: "diff",
        })
      }),
    )
  }
  const item = async (value: unknown, done: boolean) => {
    const current = object(value)
    const nativeID = itemID(current)
    if (current.type === "agentMessage") {
      if (!deltas.has(nativeID)) emit({ type: "output", text: clean(current.text), nativeID })
      return
    }
    if (current.type === "reasoning") {
      if (deltas.has(nativeID)) return
      const summary = Array.isArray(current.summary) ? current.summary.map((part) => clean(part)).filter(Boolean) : []
      const content = Array.isArray(current.content) ? current.content.map((part) => clean(part)).filter(Boolean) : []
      const text = [...summary, ...content].join("\n")
      if (text) emit({ type: "reasoning", text, nativeID })
      return
    }
    if (current.type === "plan") {
      emit({
        type: "plan",
        id: nativeID,
        content: clean(current.text, AgentOrchestrationLimits.maxTextBytes, "Plan unavailable"),
      })
      return
    }
    if (current.type === "userMessage" || current.type === "hookPrompt" || current.type === "contextCompaction") return
    emit({
      type: "tool",
      id: nativeID,
      title: title(current),
      status: status(current.status, done),
      kind: kind(current),
    })
    if (done) await artifact(current)
  }
  const plan = (params: RecordValue) => {
    if (!Array.isArray(params.plan)) return
    const content = params.plan
      .map((entry) => {
        const value = object(entry)
        const checked = value.status === "completed" ? "x" : " "
        return `- [${checked}] ${clean(value.step, 2048, "Untitled step")}`
      })
      .join("\n")
    emit({ type: "plan", id: `${clean(params.turnId, 512, "turn")}:plan`, content })
  }
  const approval = async (requestID: unknown, method: string, params: RecordValue) => {
    const nativeID = `${method}:${id(params.approvalId) || id(params.itemId) || id(params.callId) || id(requestID)}`
    approvals.set(nativeID, (approved) => {
      approvals.delete(nativeID)
      if (method === "item/permissions/requestApproval") {
        const permissions = approved && record(params.permissions) ? params.permissions : {}
        respond(requestID, { permissions, scope: "turn", strictAutoReview: false })
        return
      }
      if (method === "applyPatchApproval" || method === "execCommandApproval") {
        respond(
          requestID,
          approved ? { decision: "approved" } : { decision: { denied: { rejection: "Rejected in Slopcode" } } },
        )
        return
      }
      respond(requestID, { decision: approved ? "accept" : "decline" })
    })
    const cwd = await approvalCwd(input.cwd, clean(params.cwd, AgentOrchestrationLimits.maxPathBytes))
    emit({
      type: "approval",
      id: nativeID,
      title:
        method === "item/fileChange/requestApproval" || method === "applyPatchApproval"
          ? clean(params.reason, 512, "Approve file changes")
          : clean(params.reason, 512, "Approve command"),
      ...(clean(params.command, 4 * 1024) ? { command: clean(params.command, 4 * 1024) } : {}),
      ...(cwd ? { cwd } : {}),
      resolve: (approved) => approvals.get(nativeID)?.(approved),
    })
  }
  const question = (requestID: unknown, params: RecordValue) => {
    const values = Array.isArray(params.questions) ? params.questions.map(object) : []
    if (!values.length) {
      respond(requestID, { answers: {} })
      return
    }
    const answers = new Map<string, string>()
    const finish = () => {
      if (answers.size < values.length) return
      respond(requestID, {
        answers: Object.fromEntries(
          values.map((value) => [id(value.id), { answers: [answers.get(id(value.id)) ?? ""] }]),
        ),
      })
    }
    for (const value of values) {
      const key = id(value.id) || crypto.randomUUID()
      const nativeID = `question:${id(requestID)}:${key}`
      questions.set(nativeID, (answer) => {
        questions.delete(nativeID)
        answers.set(key, answer ?? "")
        finish()
      })
      emit({
        type: "question",
        id: nativeID,
        prompt: clean(value.question, 4 * 1024, "Input required"),
        options: Array.isArray(value.options)
          ? value.options
              .map((entry) => clean(object(entry).label, 512))
              .filter(Boolean)
              .slice(0, AgentOrchestrationLimits.maxQuestionOptions)
          : undefined,
        resolve: (answer) => questions.get(nativeID)?.(answer),
      })
    }
  }
  const elicitation = (requestID: unknown, params: RecordValue) => {
    if (params.mode !== "form" && params.mode !== "openai/form") {
      respond(requestID, { action: "decline", content: null, _meta: null })
      emit({ type: "unsupported", feature: "Codex App Server URL elicitation" })
      return
    }
    const schema = object(params.requestedSchema)
    const properties = record(schema.properties) ? schema.properties : {}
    const field = Object.keys(properties)[0]
    const nativeID = `elicitation:${id(requestID)}`
    questions.set(nativeID, (answer) => {
      questions.delete(nativeID)
      if (answer === undefined) {
        respond(requestID, { action: "decline", content: null, _meta: null })
        return
      }
      respond(requestID, {
        action: "accept",
        content: field ? { [field]: answer } : {},
        _meta: null,
      })
    })
    const options = field ? object(properties[field]) : {}
    emit({
      type: "question",
      id: nativeID,
      prompt: clean(params.message, 4 * 1024, "Input required"),
      options:
        options && Array.isArray(options.enum)
          ? options.enum
              .map((value) => clean(value, 512))
              .filter(Boolean)
              .slice(0, AgentOrchestrationLimits.maxQuestionOptions)
          : undefined,
      resolve: (answer) => questions.get(nativeID)?.(answer),
    })
  }
  const serverRequest = (value: RecordValue) => {
    const method = clean(value.method, 256)
    const params = object(value.params)
    if (
      method === "item/commandExecution/requestApproval" ||
      method === "item/fileChange/requestApproval" ||
      method === "item/permissions/requestApproval" ||
      method === "applyPatchApproval" ||
      method === "execCommandApproval"
    ) {
      void approval(value.id, method, params)
      return
    }
    if (method === "item/tool/requestUserInput") {
      question(value.id, params)
      return
    }
    if (method === "mcpServer/elicitation/request") {
      elicitation(value.id, params)
      return
    }
    if (method === "item/tool/call") {
      respond(value.id, { contentItems: [], success: false })
      emit({ type: "unsupported", feature: "Codex App Server dynamic tool call" })
      return
    }
    if (method === "currentTime/read") {
      respond(value.id, { currentTimeAt: Math.floor(Date.now() / 1_000) })
      return
    }
    write({ id: value.id, error: { code: -32601, message: `Unsupported Codex App Server request: ${method}` } })
    emit({ type: "unsupported", feature: `Codex App Server request ${method}` })
  }
  const notification = async (value: RecordValue) => {
    const method = clean(value.method, 256)
    const params = object(value.params)
    if (method === "item/agentMessage/delta") {
      const nativeID = clean(params.itemId, 512, "codex-message")
      deltas.add(nativeID)
      const text = delta(params.delta)
      if (text) emit({ type: "output", text, nativeID })
      return
    }
    if (method === "item/reasoning/summaryTextDelta" || method === "item/reasoning/textDelta") {
      const nativeID = clean(params.itemId, 512, "codex-reasoning")
      deltas.add(nativeID)
      const text = delta(params.delta)
      if (text) emit({ type: "reasoning", text, nativeID })
      return
    }
    if (method === "item/started" || method === "item/completed") {
      await item(params.item, method === "item/completed")
      return
    }
    if (method === "turn/plan/updated") {
      plan(params)
      return
    }
    if (method === "error") {
      emit({ type: "retry", reason: message(params.error, "Codex App Server turn failed") })
      return
    }
    if (method === "warning" || method === "configWarning" || method === "deprecationNotice") {
      emit({ type: "reasoning", text: message(params, `Codex App Server ${method}`) })
      return
    }
    if (method !== "turn/completed") return
    const current = object(params.turn)
    const nativeID = id(current.id)
    const turn = turns.get(nativeID)
    if (!turn) return
    turns.delete(nativeID)
    clearTimeout(turn.timer)
    if (current.status === "failed") {
      turn.reject(new Error(message(current.error, "Codex turn failed")))
      return
    }
    turn.resolve()
  }
  const receive = (value: unknown) => {
    if (!record(value)) return
    const requestID = id(value.id)
    const current = requestID ? pending.get(requestID) : undefined
    if (current && ("result" in value || "error" in value)) {
      pending.delete(requestID)
      clearTimeout(current.timer)
      if ("error" in value) {
        current.reject(new Error(message(value.error, "Codex App Server request failed")))
        return
      }
      current.resolve(value.result)
      return
    }
    if ("id" in value && typeof value.method === "string") {
      serverRequest(value)
      return
    }
    if (typeof value.method === "string")
      queue = queue
        .then(() => notification(value))
        .catch((error: unknown) => {
          emit({
            type: "retry",
            reason: clean(error instanceof Error ? error.message : "Codex App Server event failed", 2 * 1024),
          })
        })
  }
  child.stdout.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk])
    while (true) {
      const index = buffer.indexOf(10)
      if (index < 0) {
        if (buffer.byteLength <= MAX_APP_SERVER_FRAME_BYTES) return
        const error = new Error("Codex App Server sent an oversized protocol frame")
        buffer = Buffer.alloc(0)
        fail(error)
        child.kill("SIGTERM")
        return
      }
      const line = buffer.subarray(0, index).toString("utf8").replace(/\r$/, "")
      buffer = buffer.subarray(index + 1)
      if (!line) continue
      if (Buffer.byteLength(line) > MAX_APP_SERVER_FRAME_BYTES) {
        const error = new Error("Codex App Server sent an oversized protocol frame")
        fail(error)
        child.kill("SIGTERM")
        return
      }
      try {
        receive(JSON.parse(line))
      } catch {
        process.stderr.write("[remote-orchestrator/codex] dropped invalid App Server JSON\n")
      }
    }
  })
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = clean(`${stderr}${chunk.toString("utf8")}`, 8 * 1024)
  })
  child.once("error", (error) => fail(error))
  child.once("close", (code, signal) => {
    const detail = stderr || (signal ? `stopped with ${signal}` : `exited with code ${code}`)
    const error = new Error(`Codex App Server ${detail}`)
    fail(error)
    if (ready && !closed) emit({ type: "retry", reason: `${error.message}; reconnect and retry the turn.` })
  })

  let thread: unknown
  try {
    await request("initialize", {
      clientInfo: { name: "slopcode-remote-orchestrator", title: "Slopcode", version: "v1" },
      capabilities: { experimentalApi: true, requestAttestation: false },
    })
    write({ method: "initialized" })
    thread = await request(input.resume ? "thread/resume" : "thread/start", {
      ...(input.resume ? { threadId: input.resume } : {}),
      cwd: input.cwd,
    })
  } catch (error) {
    closed = true
    fail(error instanceof Error ? error : new Error("Codex App Server startup failed"))
    await stop(child)
    throw error
  }
  const nativeID = clean(object(object(thread).thread).id, 512)
  if (!nativeID) {
    closed = true
    await stop(child)
    throw new Error("Codex App Server did not return a thread ID")
  }
  ready = true
  const capabilities: readonly AgentOrchestrationCapability[] = [
    "workspace",
    "sessions",
    "turns",
    "approvals",
    "questions",
    "plans",
    "artifacts",
    "replay",
    "streaming",
    "cancel",
    "steer",
  ]
  return {
    nativeID,
    capabilities,
    mode: "app_server",
    version: "unknown",
    resumable: true,
    async turn(prompt) {
      if (closed) throw new Error("Codex App Server session is closed")
      if (turns.size) throw new Error("Codex already has an active turn")
      const result = object(
        await request("turn/start", {
          threadId: nativeID,
          input: [{ type: "text", text: prompt, text_elements: [] }],
        }),
      )
      const nativeTurn = clean(object(result.turn).id, 512)
      if (!nativeTurn) throw new Error("Codex App Server did not return a turn ID")
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => {
            turns.delete(nativeTurn)
            reject(new Error("Codex App Server turn timed out"))
          },
          10 * 60 * 1_000,
        )
        turns.set(nativeTurn, { resolve, reject, timer })
      })
    },
    async cancel() {
      const turn = [...turns.keys()][0]
      if (!turn) return false
      await request("turn/interrupt", { threadId: nativeID, turnId: turn })
      return true
    },
    async steer(_turnID, instruction) {
      const turn = [...turns.keys()][0]
      if (!turn) return false
      const result = object(
        await request("turn/steer", {
          threadId: nativeID,
          expectedTurnId: turn,
          input: [{ type: "text", text: instruction, text_elements: [] }],
        }),
      )
      return result.turnId === turn
    },
    approval(nativeID, approved) {
      const handler = approvals.get(nativeID)
      if (!handler) return false
      handler(approved)
      return true
    },
    question(nativeID, answer) {
      const handler = questions.get(nativeID)
      if (!handler) return false
      handler(answer)
      return true
    },
    async close() {
      if (closed) return
      for (const handler of approvals.values()) handler(false)
      for (const handler of questions.values()) handler(undefined)
      closed = true
      fail(new Error("Codex App Server session closed"))
      await stop(child)
    },
  }
}
