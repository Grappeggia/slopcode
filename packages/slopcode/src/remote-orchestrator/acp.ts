import { ChildProcess, spawn } from "node:child_process"
import path from "node:path"
import { Readable, Writable } from "node:stream"
import {
  ClientSideConnection,
  PROTOCOL_VERSION,
  ndJsonStream,
  type Client,
  type CreateElicitationRequest,
  type RequestPermissionRequest,
  type SessionNotification,
} from "@agentclientprotocol/sdk"
import {
  AgentOrchestrationLimits,
  type AgentOrchestrationAgentID,
  type AgentOrchestrationBackendMode,
  type AgentOrchestrationCapability,
} from "@slopcode-ai/protocol"
import { approvalCwd, contained, readText, writeText } from "./workspace"
import { connect as connectCli, type Launch as CliLaunch } from "./cli"
import { connect as connectCodex, type Launch as CodexLaunch } from "./codex-app-server"

export type ACPEvent =
  | { type: "output"; text: string; nativeID?: string }
  | { type: "reasoning"; text: string; nativeID?: string }
  | {
      type: "tool"
      id: string
      title: string
      status: "pending" | "in_progress" | "completed" | "failed"
      kind?: string
    }
  | {
      type: "approval"
      id: string
      title: string
      command?: string
      cwd?: string
      resolve: (approved: boolean) => void
    }
  | { type: "question"; id: string; prompt: string; options?: string[]; resolve: (answer?: string) => void }
  | { type: "plan"; id: string; content: string }
  | { type: "artifact"; id: string; name: string; path: string; kind: "file" | "image" | "diff" | "log" | "report" }
  | { type: "retry"; reason: string }
  | { type: "unsupported"; feature: string }

export interface Session {
  readonly nativeID: string
  readonly capabilities: readonly AgentOrchestrationCapability[]
  readonly mode?: AgentOrchestrationBackendMode
  readonly version?: string
  readonly resumable?: boolean
  turn: (prompt: string) => Promise<void>
  cancel?: (turnID: string) => Promise<boolean>
  retry?: (turnID: string) => Promise<boolean>
  steer?: (turnID: string, instruction: string) => Promise<boolean>
  approval: (id: string, approved: boolean) => boolean
  question: (id: string, answer: string) => boolean
  close: () => Promise<void>
}

type Launch = (agent: "slopcode" | "opencode", cwd: string) => ChildProcess

const programs: Record<"slopcode" | "opencode", readonly string[]> = {
  slopcode: ["slopcode", "acp"],
  opencode: ["opencode", "acp"],
}

export const launch: Launch = (agent, cwd) =>
  spawn(programs[agent][0], programs[agent].slice(1), {
    cwd,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  })

const clipped = (value: string, size = 64 * 1024) => value.replaceAll("\u0000", "").slice(0, size)
const bytes = (value: string) => Buffer.byteLength(value)
const safe = (value: string, size: number, fallback = "") => {
  const clean = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").trim()
  const output = [...clean].reduce(
    (result, character) => (bytes(result) + bytes(character) <= size ? result + character : result),
    "",
  )
  return output || fallback
}
const streamText = (value: unknown, size = AgentOrchestrationLimits.maxTextBytes) => {
  if (typeof value !== "string") return ""
  const clean = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
  return [...clean].reduce(
    (result, character) => (bytes(result) + bytes(character) <= size ? result + character : result),
    "",
  )
}
const text = (value: unknown, size = AgentOrchestrationLimits.maxTextBytes, fallback = "") =>
  typeof value === "string" ? safe(value, size, fallback) : fallback
const status = (value: unknown): "pending" | "in_progress" | "completed" | "failed" =>
  value === "in_progress" || value === "completed" || value === "failed" ? value : "pending"
const content = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined
  const item = value as { type?: unknown; text?: unknown; uri?: unknown; name?: unknown }
  if (item.type === "text") return { text: streamText(item.text) }
  if (item.type === "resource_link")
    return { path: text(item.uri, AgentOrchestrationLimits.maxPathBytes), name: text(item.name, 256, "resource") }
  return undefined
}
const command = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined
  const item = value as { command?: unknown }
  return typeof item.command === "string" ? safe(item.command, 4096) : undefined
}
const questionOptions = (input: CreateElicitationRequest) => {
  if (input.mode !== "form") return undefined
  const fields = Object.values(input.requestedSchema.properties ?? {})
  const values = fields.flatMap((field) =>
    "enum" in field && Array.isArray(field.enum)
      ? field.enum.filter((item): item is string => typeof item === "string")
      : [],
  )
  const output = values
    .map((value) => text(value, 512))
    .filter((value) => value.length > 0)
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, AgentOrchestrationLimits.maxQuestionOptions)
  return output.length ? output : undefined
}
const questionField = (input: CreateElicitationRequest) =>
  input.mode === "form" ? Object.keys(input.requestedSchema.properties ?? {})[0] : undefined

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
  agent: AgentOrchestrationAgentID
  cwd: string
  emit: (event: ACPEvent) => void
  start?: Launch
  codexStart?: CodexLaunch
  cliStart?: CliLaunch
  resume?: string
  mode?: AgentOrchestrationBackendMode
}): Promise<Session> {
  if (input.agent === "codex") {
    if (input.mode === "cli")
      return connectCli({ agent: input.agent, cwd: input.cwd, emit: input.emit, start: input.cliStart })
    try {
      return await connectCodex({ cwd: input.cwd, emit: input.emit, start: input.codexStart, resume: input.resume })
    } catch (error) {
      if (input.resume || input.mode === "app_server") throw error
      process.stderr.write(
        `[remote-orchestrator/codex] App Server unavailable; using CLI fallback: ${safe(error instanceof Error ? error.message : "startup failed", 512, "startup failed")}\n`,
      )
      return connectCli({ agent: input.agent, cwd: input.cwd, emit: input.emit, start: input.cliStart })
    }
  }
  if (input.agent === "claude" || input.agent === "antigravity")
    return connectCli({ agent: input.agent, cwd: input.cwd, emit: input.emit, start: input.cliStart })
  if (input.agent !== "slopcode" && input.agent !== "opencode")
    throw new Error(`agent ${input.agent} does not support ACP`)
  const child = (input.start ?? launch)(input.agent, input.cwd)
  if (!child.stdin || !child.stdout || !child.stderr) {
    await stop(child)
    throw new Error("ACP subprocess did not provide stdio")
  }
  child.stderr.on("data", (chunk: Buffer) =>
    process.stderr.write(`[remote-orchestrator/${input.agent}] ${safe(chunk.toString(), 4096)}\n`),
  )
  const approvals = new Map<string, (approved: boolean) => void>()
  const questions = new Map<string, (answer?: string) => void>()
  let nativeID = ""
  const emit = (event: ACPEvent) => {
    try {
      input.emit(event)
      return true
    } catch (error) {
      process.stderr.write(
        `[remote-orchestrator/${input.agent}] dropped ACP event: ${safe(error instanceof Error ? error.message : "invalid event", 512, "invalid event")}\n`,
      )
      return false
    }
  }
  const artifact = async (event: Omit<Extract<ACPEvent, { type: "artifact" }>, "path"> & { path: string }) => {
    const value = await contained(input.cwd, event.path).catch(() => undefined)
    if (!value) {
      emit({ type: "unsupported", feature: "ACP artifact path outside workspace" })
      return
    }
    emit({ ...event, path: value, name: text(event.name, 256, "artifact") })
  }

  const client: Client = {
    async sessionUpdate(params: SessionNotification) {
      const update = params.update
      if (update.sessionUpdate === "user_message_chunk") return Promise.resolve()
      if (update.sessionUpdate === "agent_message_chunk") {
        const item = content(update.content)
        if (item && "text" in item && item.text)
          emit({ type: "output", text: item.text, nativeID: update.messageId ?? undefined })
        if (item && "path" in item && item.path?.startsWith("/")) {
          await artifact({
            type: "artifact",
            id: update.messageId ?? item.path,
            path: item.path,
            name: item.name ?? "resource",
            kind: "file",
          })
        }
        return Promise.resolve()
      }
      if (update.sessionUpdate === "agent_thought_chunk") {
        const item = content(update.content)
        if (item && "text" in item && item.text)
          emit({ type: "reasoning", text: item.text, nativeID: update.messageId ?? undefined })
        return Promise.resolve()
      }
      if (update.sessionUpdate === "tool_call" || update.sessionUpdate === "tool_call_update") {
        const item = update
        emit({
          type: "tool",
          id: item.toolCallId,
          title: text(item.title) || "Tool call",
          status: status(item.status),
          kind: typeof item.kind === "string" ? item.kind : undefined,
        })
        for (const result of item.content ?? []) {
          if (result.type === "diff")
            await artifact({ type: "artifact", id: item.toolCallId, name: "diff", path: result.path, kind: "diff" })
          if (result.type === "content") {
            const entry = content(result.content)
            if (entry && "path" in entry && entry.path?.startsWith("/")) {
              await artifact({
                type: "artifact",
                id: item.toolCallId,
                name: entry.name ?? "resource",
                path: entry.path,
                kind: "file",
              })
            }
          }
        }
        return Promise.resolve()
      }
      if (update.sessionUpdate === "plan") {
        emit({
          type: "plan",
          id: `${params.sessionId}:plan`,
          content: text(
            update.entries
              .map(
                (item) => `- [${item.status === "completed" ? "x" : " "}] ${text(item.content, 2048, "Untitled step")}`,
              )
              .join("\n"),
            AgentOrchestrationLimits.maxTextBytes,
            "Plan is empty.",
          ),
        })
        return Promise.resolve()
      }
      emit({ type: "unsupported", feature: text(update.sessionUpdate, 256, "ACP update") })
      return Promise.resolve()
    },
    async readTextFile(params) {
      if (params.sessionId !== nativeID) throw new Error("ACP file read belongs to another session")
      return { content: await readText(input.cwd, params.path, params.line ?? 1, params.limit ?? undefined) }
    },
    async writeTextFile(params) {
      if (params.sessionId !== nativeID) throw new Error("ACP file write belongs to another session")
      const value = await writeText(input.cwd, params.path, params.content)
      await artifact({ type: "artifact", id: `write:${value}`, path: value, name: path.basename(value), kind: "file" })
      return {}
    },
    requestPermission(params: RequestPermissionRequest) {
      return new Promise((resolve) => {
        const id = params.toolCall.toolCallId
        approvals.set(id, (approved) => {
          approvals.delete(id)
          const option = params.options.find((item) =>
            approved ? item.kind.startsWith("allow") : item.kind.startsWith("reject"),
          )
          resolve(
            option
              ? { outcome: { outcome: "selected", optionId: option.optionId } }
              : { outcome: { outcome: "cancelled" } },
          )
        })
        void approvalCwd(input.cwd, params.toolCall.locations?.[0]?.path).then((cwd) => {
          if (!approvals.has(id)) return
          if (
            !emit({
              type: "approval",
              id,
              title: text(params.toolCall.title, 512, "Approve tool call"),
              command: command(params.toolCall.rawInput),
              ...(cwd ? { cwd } : {}),
              resolve: (approved) => approvals.get(id)?.(approved),
            })
          )
            approvals.get(id)?.(false)
        })
      })
    },
    unstable_createElicitation(params: CreateElicitationRequest) {
      return new Promise((resolve) => {
        if (params.mode !== "form") {
          emit({ type: "unsupported", feature: "ACP URL elicitation" })
          resolve({ action: "decline" })
          return
        }
        const id = `${"sessionId" in params ? params.sessionId : "request"}:${"toolCallId" in params ? (params.toolCallId ?? "question") : "question"}:${crypto.randomUUID()}`
        const field = questionField(params)
        questions.set(id, (answer) => {
          questions.delete(id)
          resolve(
            answer === undefined
              ? { action: "decline" }
              : { action: "accept", content: field ? { [field]: answer } : undefined },
          )
        })
        if (
          !emit({
            type: "question",
            id,
            prompt: text(params.message, 4096, "Input required"),
            options: questionOptions(params),
            resolve: (answer) => questions.get(id)?.(answer),
          })
        )
          questions.get(id)?.(undefined)
      })
    },
  }

  const stream = ndJsonStream(
    Writable.toWeb(child.stdin),
    Readable.toWeb(child.stdout) as unknown as ReadableStream<Uint8Array>,
  )
  const connection = new ClientSideConnection(() => client, stream)
  connection.closed
    .then(() => emit({ type: "retry", reason: "ACP connection closed; reconnect and retry the turn." }))
    .catch(() => undefined)
  let initialized: Awaited<ReturnType<typeof connection.initialize>>
  try {
    initialized = await connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {
        elicitation: { form: {} },
        fs: { readTextFile: true, writeTextFile: true },
      },
      clientInfo: { name: "slopcode-remote-orchestrator", version: "v1" },
    })
    const created = await (async () => {
      if (!input.resume) return connection.newSession({ cwd: input.cwd, mcpServers: [] })
      await connection.loadSession({ cwd: input.cwd, sessionId: input.resume, mcpServers: [] })
      return { sessionId: input.resume }
    })()
    nativeID = created.sessionId
  } catch (error) {
    await stop(child)
    throw error
  }
  const capabilities: AgentOrchestrationCapability[] = [
    "workspace",
    "sessions",
    "turns",
    "approvals",
    "questions",
    "streaming",
  ]
  if (initialized.agentCapabilities?.loadSession) capabilities.push("replay")
  return {
    nativeID,
    capabilities,
    mode: "acp",
    version: initialized.agentInfo?.version ?? "unknown",
    resumable: !!initialized.agentCapabilities?.loadSession,
    async turn(prompt) {
      const result = await connection.prompt({ sessionId: nativeID, prompt: [{ type: "text", text: prompt }] })
      if (result.stopReason !== "end_turn") emit({ type: "retry", reason: `ACP turn stopped: ${result.stopReason}` })
    },
    approval(id, approved) {
      const handler = approvals.get(id)
      if (!handler) return false
      handler(approved)
      return true
    },
    question(id, answer) {
      const handler = questions.get(id)
      if (!handler) return false
      handler(answer)
      return true
    },
    async close() {
      for (const handler of approvals.values()) handler(false)
      for (const handler of questions.values()) handler(undefined)
      await stop(child)
    },
  }
}
