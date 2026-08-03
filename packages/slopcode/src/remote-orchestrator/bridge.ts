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
type Frame = typeof AgentOrchestrationFrame.Type
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
const scoped = (sessionID: string, value: string) => `${sessionID}:${value}`
const artifactPath = (root: string, value: string) =>
  path.resolve(root, ".slopcode", "remote-artifacts", `${identifier("item", value)}.md`)
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== "object") return value
  const object = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(object)
      .sort()
      .map((key) => [key, canonical(object[key])]),
  )
}
const fingerprint = (frame: AgentOrchestrationRequest) => {
  const value = { ...frame } as Record<string, unknown>
  delete value.requestID
  delete value.idempotencyKey
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)) ?? "")
    .digest("hex")
}

type Stored = {
  adapter: Session
  agent: AgentOrchestrationAgentID
  workspaceID: string
  workspace: string
  activeTurnID?: string
  lastTurnID?: string
  queue: Promise<void>
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

type RequestRecord = {
  requestID: string
  idempotencyKey: string
  fingerprint: string
  done: Promise<Frame>
  resolve: (frame: Frame) => void
  response?: Frame
}

const maxRequests = 256
const isSupportedAgent = (value: AgentOrchestrationAgentID) =>
  value === "slopcode" || value === "opencode" || value === "codex" || value === "claude"

export class Bridge {
  readonly workspaces = new Map<string, string>()
  readonly sessions = new Map<string, Stored>()
  readonly native = new Map<string, string>()
  readonly interactions = new Map<string, Interaction>()
  #requests = new Map<string, RequestRecord>()
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

  private errorFrame(
    code:
      | "bad_request"
      | "unsupported_agent"
      | "not_found"
      | "interaction_conflict"
      | "idempotency_conflict"
      | "path_forbidden"
      | "internal",
    message: string,
    frame?: Partial<AgentOrchestrationRequest>,
  ) {
    return decode({
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

  private error(
    code:
      | "bad_request"
      | "unsupported_agent"
      | "not_found"
      | "interaction_conflict"
      | "idempotency_conflict"
      | "path_forbidden"
      | "internal",
    message: string,
    frame?: Partial<AgentOrchestrationRequest>,
  ) {
    const value = this.errorFrame(code, message, frame)
    this.out(value)
    return value
  }

  private complete(record: RequestRecord, frame: unknown) {
    const value = decode(frame)
    record.response = value
    record.resolve(value)
    this.out(value)
  }

  private fail(
    record: RequestRecord,
    code:
      | "bad_request"
      | "unsupported_agent"
      | "not_found"
      | "interaction_conflict"
      | "idempotency_conflict"
      | "path_forbidden"
      | "internal",
    message: string,
    frame: AgentOrchestrationRequest,
  ) {
    this.complete(record, this.errorFrame(code, message, frame))
  }

  private remember(record: RequestRecord) {
    this.#requests.set(`request:${record.requestID}`, record)
    this.#requests.set(`idempotency:${record.idempotencyKey}`, record)
    while (new Set(this.#requests.values()).size > maxRequests) {
      const first = this.#requests.values().next().value as RequestRecord | undefined
      if (!first) return
      this.#requests.delete(`request:${first.requestID}`)
      this.#requests.delete(`idempotency:${first.idempotencyKey}`)
    }
  }

  private async begin(frame: AgentOrchestrationRequest) {
    const request = this.#requests.get(`request:${frame.requestID}`)
    const idempotency = this.#requests.get(`idempotency:${frame.idempotencyKey}`)
    if (request || idempotency) {
      if (!request || !idempotency || request !== idempotency || request.fingerprint !== fingerprint(frame)) {
        this.error("idempotency_conflict", "request ID or idempotency key was reused with a different payload", frame)
        return undefined
      }
      this.out(await request.done)
      return undefined
    }
    let resolve: (frame: Frame) => void = () => undefined
    const done = new Promise<Frame>((value) => (resolve = value))
    const record = {
      requestID: frame.requestID,
      idempotencyKey: frame.idempotencyKey,
      fingerprint: fingerprint(frame),
      done,
      resolve,
    }
    this.remember(record)
    return record
  }

  private event(
    sessionID: string,
    input: Omit<Record<string, unknown>, "version" | "kind" | "cursor" | "sequence" | "sessionID">,
  ) {
    const sequence = ++this.#sequence
    this.out({ version: "v1", kind: "event", cursor: `cur_${sequence}`, sequence, sessionID, ...input })
  }

  private async mapped(sessionID: string, session: Stored, event: ACPEvent, turnID: string | undefined) {
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
      const id = identifier("tol", scoped(sessionID, event.id))
      this.native.set(id, scoped(sessionID, event.id))
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
      const id = identifier("int", scoped(sessionID, event.id))
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
      const id = identifier("int", scoped(sessionID, event.id))
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
      const id = identifier("pln", scoped(sessionID, event.id))
      this.native.set(id, scoped(sessionID, event.id))
      this.event(sessionID, {
        type: "plan.available",
        plan: {
          id,
          path: artifactPath(session.workspace, scoped(sessionID, event.id)),
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
      const id = identifier("art", scoped(sessionID, event.id))
      this.native.set(id, scoped(sessionID, event.id))
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
    if (event.type === "unsupported" && ["available_commands_update", "usage_update"].includes(event.feature)) return
    const message =
      event.type === "unsupported"
        ? `Unsupported ACP capability: ${event.feature}`
        : `Dropped ACP ${event.type} update outside the active workspace.`
    if (turnID) this.event(sessionID, { type: "turn.reasoning", turnID, text: message })
  }

  private enqueue(sessionID: string, session: Stored, event: ACPEvent) {
    const turnID = session.activeTurnID ?? session.lastTurnID
    session.queue = session.queue
      .then(() => this.mapped(sessionID, session, event, turnID))
      .catch((error: unknown) => {
        this.error("internal", error instanceof Error ? error.message : "ACP event mapping failed")
      })
  }

  async handle(frame: AgentOrchestrationFrame) {
    if (frame.kind !== "request") return this.error("bad_request", "bridge accepts request frames only")
    const record = await this.begin(frame)
    if (!record) return
    try {
      if (frame.type === "workspace.open") {
        if (!isSupportedAgent(frame.agent.id))
          return this.fail(record, "unsupported_agent", `${frame.agent.id} is not available in the ACP bridge`, frame)
        const workspace = await contained(this.root, frame.workspace.path)
        this.workspaces.set(frame.workspace.id, workspace)
        this.complete(record, {
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
        if (!isSupportedAgent(frame.agent))
          return this.fail(record, "unsupported_agent", `${frame.agent} does not support the ACP bridge`, frame)
        const workspace = this.workspaces.get(frame.workspaceID)
        if (!workspace) return this.fail(record, "not_found", "workspace was not opened", frame)
        const sessionID = identifier("ses")
        const pending: ACPEvent[] = []
        let stored: Stored | undefined
        const adapter = await this.open({
          agent: frame.agent,
          cwd: workspace,
          emit: (event) => {
            if (stored) return this.enqueue(sessionID, stored, event)
            pending.push(event)
          },
        })
        stored = { adapter, agent: frame.agent, workspaceID: frame.workspaceID, workspace, queue: Promise.resolve() }
        this.sessions.set(sessionID, stored)
        this.native.set(sessionID, scoped(sessionID, adapter.nativeID))
        this.complete(record, {
          version: "v1",
          kind: "response",
          type: "session.create",
          requestID: frame.requestID,
          idempotencyKey: frame.idempotencyKey,
          sessionID,
          capabilities: adapter.capabilities,
        })
        for (const event of pending) this.enqueue(sessionID, stored, event)
        await stored.queue
        return
      }
      if (frame.type === "turn.create") {
        const session = this.sessions.get(frame.sessionID)
        if (!session || session.agent !== frame.agent)
          return this.fail(record, "not_found", "session was not found for this agent", frame)
        if (session.activeTurnID)
          return this.fail(record, "bad_request", "a turn is already active for this session", frame)
        const turnID = frame.turnID ?? identifier("trn")
        session.activeTurnID = turnID
        session.lastTurnID = turnID
        this.complete(record, {
          version: "v1",
          kind: "response",
          type: "turn.create",
          requestID: frame.requestID,
          idempotencyKey: frame.idempotencyKey,
          sessionID: frame.sessionID,
          turnID,
        })
        let message: string | undefined
        void session.adapter
          .turn(frame.prompt)
          .catch((error: unknown) => {
            message = error instanceof Error ? error.message : "ACP turn failed"
            this.error("internal", message)
          })
          .then(async () => {
            await session.queue
            this.event(frame.sessionID, {
              type: "turn.completed",
              turnID,
              status: message ? "failed" : "completed",
              ...(message ? { message: clean(message, 2 * 1024) } : {}),
            })
            if (session.activeTurnID === turnID) session.activeTurnID = undefined
          })
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
          return this.fail(record, "interaction_conflict", "approval is no longer pending", frame)
        this.interactions.delete(frame.interactionID)
        this.complete(record, {
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
          return this.fail(record, "interaction_conflict", "question is no longer pending", frame)
        this.interactions.delete(frame.interactionID)
        this.complete(record, {
          version: "v1",
          kind: "response",
          type: "interaction.question.reply",
          requestID: frame.requestID,
          idempotencyKey: frame.idempotencyKey,
          sessionID: frame.sessionID,
        })
        return
      }
      return this.fail(record, "bad_request", `${frame.type} is not available in the ACP bridge`, frame)
    } catch (error) {
      if (error instanceof WorkspaceError) return this.fail(record, "path_forbidden", error.message, frame)
      return this.fail(record, "internal", error instanceof Error ? error.message : "remote orchestrator failed", frame)
    }
  }

  async close() {
    this.#closed = true
    await Promise.allSettled([...this.sessions.values()].map((session) => session.adapter.close()))
    this.sessions.clear()
    this.interactions.clear()
    this.#requests.clear()
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
