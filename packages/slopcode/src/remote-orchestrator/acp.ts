import { ChildProcess, spawn } from "node:child_process"
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
import type { AgentOrchestrationAgentID, AgentOrchestrationCapability } from "@slopcode-ai/protocol"

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
  turn: (prompt: string) => Promise<void>
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
const text = (value: unknown) => (typeof value === "string" ? clipped(value) : "")
const status = (value: unknown): "pending" | "in_progress" | "completed" | "failed" =>
  value === "in_progress" || value === "completed" || value === "failed" ? value : "pending"
const content = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined
  const item = value as { type?: unknown; text?: unknown; uri?: unknown; name?: unknown }
  if (item.type === "text") return { text: text(item.text) }
  if (item.type === "resource_link") return { path: text(item.uri), name: text(item.name) || "resource" }
  return undefined
}
const command = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined
  const item = value as { command?: unknown }
  return typeof item.command === "string" ? clipped(item.command, 4096) : undefined
}
const questionOptions = (input: CreateElicitationRequest) => {
  if (input.mode !== "form") return undefined
  const fields = Object.values(input.requestedSchema.properties ?? {})
  const values = fields.flatMap((field) =>
    "enum" in field && Array.isArray(field.enum)
      ? field.enum.filter((item): item is string => typeof item === "string")
      : [],
  )
  return values.length ? values.slice(0, 32) : undefined
}
const questionField = (input: CreateElicitationRequest) =>
  input.mode === "form" ? Object.keys(input.requestedSchema.properties ?? {})[0] : undefined

export async function connect(input: {
  agent: AgentOrchestrationAgentID
  cwd: string
  emit: (event: ACPEvent) => void
  start?: Launch
}): Promise<Session> {
  if (input.agent !== "slopcode" && input.agent !== "opencode")
    throw new Error(`agent ${input.agent} does not support ACP`)
  const child = (input.start ?? launch)(input.agent, input.cwd)
  if (!child.stdin || !child.stdout || !child.stderr) throw new Error("ACP subprocess did not provide stdio")
  child.stderr.on("data", (chunk: Buffer) =>
    process.stderr.write(`[remote-orchestrator/${input.agent}] ${clipped(chunk.toString(), 4096)}\n`),
  )
  const approvals = new Map<string, (approved: boolean) => void>()
  const questions = new Map<string, (answer?: string) => void>()
  let nativeID = ""

  const client: Client = {
    sessionUpdate(params: SessionNotification) {
      const update = params.update
      if (update.sessionUpdate === "agent_message_chunk" || update.sessionUpdate === "user_message_chunk") {
        const item = content(update.content)
        if (item && "text" in item && item.text)
          input.emit({ type: "output", text: item.text, nativeID: update.messageId ?? undefined })
        if (item && "path" in item && item.path?.startsWith("/")) {
          input.emit({
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
          input.emit({ type: "reasoning", text: item.text, nativeID: update.messageId ?? undefined })
        return Promise.resolve()
      }
      if (update.sessionUpdate === "tool_call" || update.sessionUpdate === "tool_call_update") {
        const item = update
        input.emit({
          type: "tool",
          id: item.toolCallId,
          title: text(item.title) || "Tool call",
          status: status(item.status),
          kind: typeof item.kind === "string" ? item.kind : undefined,
        })
        for (const result of item.content ?? []) {
          if (result.type === "diff")
            input.emit({ type: "artifact", id: item.toolCallId, name: "diff", path: result.path, kind: "diff" })
          if (result.type === "content") {
            const entry = content(result.content)
            if (entry && "path" in entry && entry.path?.startsWith("/")) {
              input.emit({
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
        input.emit({
          type: "plan",
          id: `${params.sessionId}:plan`,
          content:
            update.entries.map((item) => `- [${item.status === "completed" ? "x" : " "}] ${item.content}`).join("\n") ||
            "Plan is empty.",
        })
        return Promise.resolve()
      }
      input.emit({ type: "unsupported", feature: update.sessionUpdate })
      return Promise.resolve()
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
        input.emit({
          type: "approval",
          id,
          title: text(params.toolCall.title) || "Approve tool call",
          command: command(params.toolCall.rawInput),
          cwd: params.toolCall.locations?.[0]?.path,
          resolve: (approved) => approvals.get(id)?.(approved),
        })
      })
    },
    unstable_createElicitation(params: CreateElicitationRequest) {
      return new Promise((resolve) => {
        if (params.mode !== "form") {
          input.emit({ type: "unsupported", feature: "ACP URL elicitation" })
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
        input.emit({
          type: "question",
          id,
          prompt: clipped(params.message, 4096),
          options: questionOptions(params),
          resolve: (answer) => questions.get(id)?.(answer),
        })
      })
    },
  }

  const stream = ndJsonStream(
    Writable.toWeb(child.stdin),
    Readable.toWeb(child.stdout) as unknown as ReadableStream<Uint8Array>,
  )
  const connection = new ClientSideConnection(() => client, stream)
  connection.closed
    .then(() => input.emit({ type: "retry", reason: "ACP connection closed; reconnect and retry the turn." }))
    .catch(() => undefined)
  const initialized = await connection.initialize({
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: { elicitation: { form: {} } },
    clientInfo: { name: "slopcode-remote-orchestrator", version: "v1" },
  })
  const created = await connection.newSession({ cwd: input.cwd, mcpServers: [] })
  nativeID = created.sessionId
  const capabilities: AgentOrchestrationCapability[] = ["workspace", "sessions", "turns", "approvals"]
  if (initialized.agentCapabilities?.loadSession) capabilities.push("replay")
  return {
    nativeID,
    capabilities,
    async turn(prompt) {
      const result = await connection.prompt({ sessionId: nativeID, prompt: [{ type: "text", text: prompt }] })
      if (result.stopReason !== "end_turn")
        input.emit({ type: "retry", reason: `ACP turn stopped: ${result.stopReason}` })
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
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM")
      await new Promise<void>((resolve) => child.once("exit", () => resolve()))
    },
  }
}
