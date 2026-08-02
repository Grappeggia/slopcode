import { createHash, randomUUID } from "node:crypto"
import path from "node:path"
import { Schema } from "effect"
import {
  AgentOrchestrationFrame,
  AgentOrchestrationLimits,
  type AgentOrchestrationAgentID,
  type AgentOrchestrationRequest,
} from "@slopcode-ai/protocol"
import { connect, type ACPEvent, type Session } from "./acp"
import { approvalCwd, contained, WorkspaceError } from "./workspace"

const decode = Schema.decodeUnknownSync(AgentOrchestrationFrame)
const bytes = (value: string) => Buffer.byteLength(value)
const clean = (value: string, size = 2_000, fallback = "") => {
  const normalized = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").trim()
  const output = [...normalized].reduce(
    (result, character) => (bytes(result) + bytes(character) <= size ? result + character : result),
    "",
  )
  return output || fallback
}
const native = (value: string) => clean(value, 512, "native")
const identifier = (prefix: string, value: string = randomUUID()) =>
  `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 48)}`
const artifactPath = (root: string, value: string) =>
  path.resolve(root, ".slopcode", "remote-artifacts", `${identifier("item", value)}.md`)

type Stored = {
  adapter: Session
  agent: "slopcode" | "opencode"
  workspaceID: string
  workspace: string
  turnID?: string
}

type Interaction = {
  sessionID: string
  kind: "approval" | "question"
  revision: number
  nativeID: string
}

type Open = (input: {
  agent: AgentOrchestrationAgentID
  cwd: string
  emit: (event: ACPEvent) => void
}) => Promise<Session>

export class Bridge {
  readonly workspaces = new Map<string, string>()
  readonly sessions = new Map<string, Stored>()
  readonly native = new Map<string, string>()
  readonly interactions = new Map<string, Interaction>()
  #sequence = 0
  #closed = false

  constructor(
    private readonly root: string,
    private readonly write: (frame: AgentOrchestrationFrame) => void,
    private readonly open: Open = connect,
  ) {}

  private out(frame: unknown) {
    if (this.#closed) return
    try {
      this.write(decode(frame))
    } catch (error) {
      this.write(
        decode({
          version: "v1",
          kind: "error",
          type: "error",
          code: "internal",
          message: clean(
            error instanceof Error ? error.message : "invalid bridge event",
            2_000,
            "invalid bridge event",
          ),
          retryable: false,
        }),
      )
    }
  }

  private error(
    code: "bad_request" | "unsupported_agent" | "not_found" | "interaction_conflict" | "path_forbidden" | "internal",
    message: string,
    frame?: Partial<AgentOrchestrationRequest>,
  ) {
    this.out({
      version: "v1",
      kind: "error",
      type: "error",
      ...(frame?.requestID && frame.idempotencyKey
        ? { requestID: frame.requestID, idempotencyKey: frame.idempotencyKey }
        : {}),
      code,
      message: clean(message),
      retryable: code === "internal",
    })
  }

  private event(
    sessionID: string,
    input: Omit<Record<string, unknown>, "version" | "kind" | "cursor" | "sequence" | "sessionID">,
  ) {
    const sequence = ++this.#sequence
    this.out({ version: "v1", kind: "event", cursor: `cur_${sequence}`, sequence, sessionID, ...input })
  }

  private async mapped(sessionID: string, session: Stored, event: ACPEvent) {
    const turnID = session.turnID
    if (event.type === "output" && turnID) {
      this.event(sessionID, {
        type: "turn.output",
        turnID,
        text: clean(event.text, AgentOrchestrationLimits.maxTextBytes, "Agent output unavailable"),
        ...(event.nativeID ? { metadata: { nativeID: native(event.nativeID) } } : {}),
      })
      return
    }
    if (event.type === "reasoning" && turnID) {
      this.event(sessionID, {
        type: "turn.reasoning",
        turnID,
        text: clean(event.text, AgentOrchestrationLimits.maxTextBytes, "Agent reasoning unavailable"),
        ...(event.nativeID ? { metadata: { nativeID: native(event.nativeID) } } : {}),
      })
      return
    }
    if (event.type === "tool" && turnID) {
      const id = identifier("tol", event.id)
      this.native.set(id, event.id)
      this.event(sessionID, {
        type: "tool.updated",
        turnID,
        tool: {
          id,
          title: clean(event.title, 512, "Tool call"),
          status: event.status,
          ...(event.kind &&
          ["read", "edit", "delete", "move", "search", "execute", "think", "fetch", "other"].includes(event.kind)
            ? { kind: event.kind }
            : {}),
          metadata: { nativeID: native(event.id) },
        },
      })
      return
    }
    if (event.type === "approval" && turnID) {
      const id = identifier("int", `${sessionID}:${event.id}`)
      this.interactions.set(id, { sessionID, kind: "approval", revision: 1, nativeID: event.id })
      const cwd = await approvalCwd(session.workspace, event.cwd)
      this.event(sessionID, {
        type: "interaction.approval.requested",
        turnID,
        interaction: {
          id,
          revision: 1,
          title: clean(event.title, 512, "Approve tool call"),
          ...(event.command ? { command: clean(event.command, 4 * 1024) } : {}),
          ...(cwd ? { cwd } : {}),
          risk: "medium",
          metadata: { nativeID: native(event.id) },
        },
      })
      return
    }
    if (event.type === "question" && turnID) {
      const id = identifier("int", `${sessionID}:${event.id}`)
      this.interactions.set(id, { sessionID, kind: "question", revision: 1, nativeID: event.id })
      this.event(sessionID, {
        type: "interaction.question.requested",
        turnID,
        interaction: {
          id,
          revision: 1,
          prompt: clean(event.prompt, 4 * 1024, "Input required"),
          ...(event.options
            ? {
                options: event.options
                  .map((option) => clean(option, 512))
                  .filter(Boolean)
                  .filter((option, index, all) => all.indexOf(option) === index)
                  .slice(0, AgentOrchestrationLimits.maxQuestionOptions),
              }
            : {}),
          allowFreeform: true,
          metadata: { nativeID: native(event.id) },
        },
      })
      return
    }
    if (event.type === "plan") {
      const id = identifier("pln", event.id)
      this.native.set(id, event.id)
      this.event(sessionID, {
        type: "plan.available",
        plan: {
          id,
          path: artifactPath(session.workspace, event.id),
          revision: 1,
          content: clean(event.content, AgentOrchestrationLimits.maxTextBytes, "Plan unavailable"),
          metadata: { nativeID: native(event.id), persisted: "false" },
        },
      })
      return
    }
    if (event.type === "artifact") {
      const value = await contained(session.workspace, event.path).catch(() => undefined)
      if (!value) {
        if (turnID)
          this.event(sessionID, {
            type: "turn.output",
            turnID,
            text: "Dropped ACP artifact outside the active workspace.",
          })
        return
      }
      const id = identifier("art", event.id)
      this.native.set(id, event.id)
      this.event(sessionID, {
        type: "artifact.created",
        ...(turnID ? { turnID } : {}),
        artifact: {
          id,
          name: clean(event.name, 256, "artifact"),
          kind: event.kind,
          path: value,
          size: 0,
          metadata: { nativeID: native(event.id) },
        },
      })
      return
    }
    if (event.type === "retry" && turnID) {
      this.event(sessionID, {
        type: "turn.retry",
        turnID,
        reason: clean(event.reason, 2 * 1024, "Agent retry requested"),
      })
      return
    }
    const message =
      event.type === "unsupported"
        ? `Unsupported ACP capability: ${event.feature}`
        : `Dropped ACP ${event.type} update outside the active workspace.`
    if (turnID) this.event(sessionID, { type: "turn.output", turnID, text: message })
  }

  async handle(frame: AgentOrchestrationFrame) {
    if (frame.kind !== "request") return this.error("bad_request", "bridge accepts request frames only")
    try {
      if (frame.type === "workspace.open") {
        if (frame.agent.id !== "slopcode" && frame.agent.id !== "opencode")
          return this.error("unsupported_agent", `${frame.agent.id} is not available in the ACP bridge`, frame)
        const workspace = await contained(this.root, frame.workspace.path)
        this.workspaces.set(frame.workspace.id, workspace)
        this.out({
          version: "v1",
          kind: "response",
          type: "workspace.open",
          requestID: frame.requestID,
          idempotencyKey: frame.idempotencyKey,
          workspace: { ...frame.workspace, path: workspace },
        })
        return
      }
      if (frame.type === "session.create") {
        if (frame.agent !== "slopcode" && frame.agent !== "opencode")
          return this.error("unsupported_agent", `${frame.agent} does not support the ACP bridge`, frame)
        const workspace = this.workspaces.get(frame.workspaceID)
        if (!workspace) return this.error("not_found", "workspace was not opened", frame)
        const sessionID = identifier("ses")
        const pending: ACPEvent[] = []
        let stored: Stored | undefined
        const adapter = await this.open({
          agent: frame.agent,
          cwd: workspace,
          emit: (event) => {
            if (stored) {
              void this.mapped(sessionID, stored, event).catch((error: unknown) =>
                this.error("internal", error instanceof Error ? error.message : "ACP event mapping failed"),
              )
              return
            }
            pending.push(event)
          },
        })
        stored = { adapter, agent: frame.agent, workspaceID: frame.workspaceID, workspace }
        this.sessions.set(sessionID, stored)
        this.native.set(sessionID, adapter.nativeID)
        this.out({
          version: "v1",
          kind: "response",
          type: "session.create",
          requestID: frame.requestID,
          idempotencyKey: frame.idempotencyKey,
          sessionID,
          capabilities: adapter.capabilities,
        })
        for (const event of pending) {
          await this.mapped(sessionID, stored, event)
        }
        return
      }
      if (frame.type === "turn.create") {
        const session = this.sessions.get(frame.sessionID)
        if (!session || session.agent !== frame.agent)
          return this.error("not_found", "session was not found for this agent", frame)
        const turnID = frame.turnID ?? identifier("trn")
        session.turnID = turnID
        this.out({
          version: "v1",
          kind: "response",
          type: "turn.create",
          requestID: frame.requestID,
          idempotencyKey: frame.idempotencyKey,
          sessionID: frame.sessionID,
          turnID,
        })
        void session.adapter
          .turn(frame.prompt)
          .catch((error: unknown) => this.error("internal", error instanceof Error ? error.message : "ACP turn failed"))
        return
      }
      if (frame.type === "interaction.approval.reply") {
        const session = this.sessions.get(frame.sessionID)
        const interaction = this.interactions.get(frame.interactionID)
        if (
          !session ||
          !interaction ||
          interaction.sessionID !== frame.sessionID ||
          interaction.kind !== "approval" ||
          interaction.revision !== frame.revision ||
          !session.adapter.approval(interaction.nativeID, frame.decision === "approved")
        )
          return this.error("interaction_conflict", "approval is no longer pending", frame)
        this.interactions.delete(frame.interactionID)
        this.out({
          version: "v1",
          kind: "response",
          type: "interaction.approval.reply",
          requestID: frame.requestID,
          idempotencyKey: frame.idempotencyKey,
          sessionID: frame.sessionID,
        })
        return
      }
      if (frame.type === "interaction.question.reply") {
        const session = this.sessions.get(frame.sessionID)
        const interaction = this.interactions.get(frame.interactionID)
        if (
          !session ||
          !interaction ||
          interaction.sessionID !== frame.sessionID ||
          interaction.kind !== "question" ||
          interaction.revision !== frame.revision ||
          !session.adapter.question(interaction.nativeID, frame.answer)
        )
          return this.error("interaction_conflict", "question is no longer pending", frame)
        this.interactions.delete(frame.interactionID)
        this.out({
          version: "v1",
          kind: "response",
          type: "interaction.question.reply",
          requestID: frame.requestID,
          idempotencyKey: frame.idempotencyKey,
          sessionID: frame.sessionID,
        })
        return
      }
      return this.error("bad_request", `${frame.type} is not available in the ACP bridge`, frame)
    } catch (error) {
      if (error instanceof WorkspaceError) return this.error("path_forbidden", error.message, frame)
      return this.error("internal", error instanceof Error ? error.message : "remote orchestrator failed", frame)
    }
  }

  async close() {
    this.#closed = true
    await Promise.allSettled([...this.sessions.values()].map((session) => session.adapter.close()))
    this.sessions.clear()
    this.interactions.clear()
  }
}

export async function run(input: { root: string; stdin?: NodeJS.ReadableStream; stdout?: NodeJS.WritableStream }) {
  const stdin = input.stdin ?? process.stdin
  const stdout = input.stdout ?? process.stdout
  const bridge = new Bridge(input.root, (frame) => stdout.write(`${JSON.stringify(frame)}\n`))
  let rest = Buffer.alloc(0)
  try {
    for await (const chunk of stdin) {
      rest = Buffer.concat([rest, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)])
      if (rest.byteLength > AgentOrchestrationLimits.maxFrameBytes + 1 && !rest.includes(10)) {
        stdout.write(
          `${JSON.stringify(decode({ version: "v1", kind: "error", type: "error", code: "too_large", message: "orchestration input line is too large", retryable: false }))}\n`,
        )
        break
      }
      let index = rest.indexOf(10)
      while (index >= 0) {
        const line = rest.subarray(0, index).toString().replace(/\r$/, "")
        rest = rest.subarray(index + 1)
        if (line && bytes(line) <= AgentOrchestrationLimits.maxFrameBytes) {
          try {
            await bridge.handle(decode(JSON.parse(line)))
          } catch (error) {
            process.stderr.write(
              `[remote-orchestrator] rejected frame: ${clean(error instanceof Error ? error.message : "invalid JSON")}\n`,
            )
          }
        }
        if (line && bytes(line) > AgentOrchestrationLimits.maxFrameBytes)
          process.stderr.write("[remote-orchestrator] rejected oversized frame\n")
        index = rest.indexOf(10)
      }
    }
  } finally {
    await bridge.close()
  }
}
