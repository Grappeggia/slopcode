import { createHash, randomUUID } from "node:crypto"
import path from "node:path"
import { Schema } from "effect"
import {
  AgentOrchestrationFrame,
  AgentOrchestrationInteractionID,
  AgentOrchestrationLimits,
  AgentOrchestrationSessionID,
  AgentOrchestrationTurnID,
  AgentOrchestrationWorkspace,
  type AgentOrchestrationAgentID,
  type AgentOrchestrationBackendMode,
  type AgentOrchestrationCapability,
  type AgentOrchestrationEvent,
  type AgentOrchestrationFrame as Frame,
  type AgentOrchestrationRequest,
} from "@slopcode-ai/protocol"
import { connect, type ACPEvent, type Session } from "./acp"
import { bridgeVersion, probe, type Probe, type Result } from "./preflight"
import {
  limits as stateLimits,
  redact,
  StateError,
  Store,
  type Request as SavedRequest,
  type Session as SavedSession,
} from "./state"
import { approvalCwd, contained, WorkspaceError } from "./workspace"

const decode = Schema.decodeUnknownSync(AgentOrchestrationFrame)
const decodeWorkspace = Schema.decodeUnknownSync(AgentOrchestrationWorkspace)
const decodeSessionID = Schema.decodeUnknownSync(AgentOrchestrationSessionID)
const decodeInteractionID = Schema.decodeUnknownSync(AgentOrchestrationInteractionID)
const decodeTurnID = Schema.decodeUnknownSync(AgentOrchestrationTurnID)
const bytes = (value: string) => Buffer.byteLength(value)
const clean = (value: string, size = 2_000, fallback = "") => {
  const normalized = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").trim()
  const output = [...normalized].reduce(
    (result, character) => (bytes(result) + bytes(character) <= size ? result + character : result),
    "",
  )
  return output || fallback
}
const streamText = (value: string, size = AgentOrchestrationLimits.maxTextBytes) => {
  const normalized = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
  return [...normalized].reduce(
    (result, character) => (bytes(result) + bytes(character) <= size ? result + character : result),
    "",
  )
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
const number = (cursor: string) => Number(cursor.slice(4))
const fallbackMode = (agent: AgentOrchestrationAgentID): AgentOrchestrationBackendMode => {
  if (agent === "slopcode" || agent === "opencode") return "acp"
  if (agent === "codex") return "app_server"
  if (agent === "antigravity") return "sandboxed_cli"
  return "streaming_cli"
}
const safeVersion = (value: string | undefined) => clean(value ?? "unknown", 256, "unknown")
const supported = (value: AgentOrchestrationAgentID) =>
  value === "slopcode" || value === "opencode" || value === "codex" || value === "claude" || value === "antigravity"

type Stored = {
  record: SavedSession
  store: Store
  workspace: string
  adapter?: Session
  queue: Promise<void>
  run: number
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
  resume?: string
}) => Promise<Session>
type RequestRecord = {
  requestID: string
  idempotencyKey: string
  fingerprint: string
  done: Promise<Frame>
  resolve: (frame: Frame) => void
  response?: Frame
}
type Code =
  | "bad_request"
  | "unsupported_agent"
  | "unsupported_operation"
  | "not_found"
  | "cursor_gap"
  | "interaction_conflict"
  | "idempotency_conflict"
  | "path_forbidden"
  | "too_large"
  | "internal"

const persistedResponse = (frame: Frame): Frame => {
  if (frame.kind === "error")
    return decode({
      ...frame,
      message:
        frame.code === "cursor_gap"
          ? "Event cursor is outside the retained tail"
          : frame.code === "unsupported_operation"
            ? "Provider operation is unsupported"
            : "Request failed",
      ...(frame.code === "cursor_gap" ? { details: { snapshotRequired: "true" } } : { details: undefined }),
    })
  if (frame.kind !== "response") return frame
  if (frame.type === "event.replay") return decode({ ...frame, events: frame.events.map(redact) })
  if (frame.type === "workspace.open" && frame.workspace)
    return decode({ ...frame, workspace: { id: frame.workspace.id, path: frame.workspace.path } })
  return frame
}

export class Bridge {
  readonly workspaces = new Map<string, { path: string; store: Store }>()
  readonly sessions = new Map<string, Stored>()
  readonly native = new Map<string, string>()
  readonly interactions = new Map<string, Interaction>()
  #requests = new Map<string, RequestRecord>()
  #events = new Map<string, AgentOrchestrationEvent[]>()
  #stores = new Map<string, Store>()
  #preflights = new Map<AgentOrchestrationAgentID, Result>()
  #tasks = new Set<Promise<void>>()
  #sequence = 0
  #closed = false

  constructor(
    private readonly root: string,
    private readonly write: (frame: Frame) => void,
    private readonly open: Open = connect,
    private readonly preflight: Probe = probe,
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

  private errorFrame(code: Code, message: string, frame?: Partial<AgentOrchestrationRequest>) {
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
      ...(code === "cursor_gap" ? { details: { snapshotRequired: "true" } } : {}),
    })
  }

  private error(code: Code, message: string, frame?: Partial<AgentOrchestrationRequest>) {
    const value = this.errorFrame(code, message, frame)
    this.out(value)
    return value
  }

  private remember(record: RequestRecord) {
    this.#requests.set(`request:${record.requestID}`, record)
    this.#requests.set(`idempotency:${record.idempotencyKey}`, record)
    while (new Set(this.#requests.values()).size > stateLimits.requests) {
      const first = this.#requests.values().next().value as RequestRecord | undefined
      if (!first) return
      this.#requests.delete(`request:${first.requestID}`)
      this.#requests.delete(`idempotency:${first.idempotencyKey}`)
    }
  }

  private hydrate(store: Store) {
    this.#sequence = Math.max(this.#sequence, store.state.cursor)
    for (const event of store.state.events) {
      const events = this.#events.get(event.sessionID) ?? []
      events.push(event)
      this.#events.set(event.sessionID, events.slice(-stateLimits.events))
    }
    for (const record of store.state.sessions) {
      if (this.sessions.has(record.id)) continue
      this.sessions.set(record.id, { record, store, workspace: store.workspace, queue: Promise.resolve(), run: 0 })
      this.native.set(record.id, scoped(record.id, record.nativeID))
      for (const item of record.pending)
        this.interactions.set(item.id, {
          sessionID: record.id,
          kind: item.kind,
          revision: item.revision,
          nativeID: item.nativeID,
        })
    }
    for (const saved of store.state.requests) {
      if (this.#requests.has(`request:${saved.requestID}`) || this.#requests.has(`idempotency:${saved.idempotencyKey}`))
        continue
      const response = decode(saved.response)
      this.remember({
        requestID: saved.requestID,
        idempotencyKey: saved.idempotencyKey,
        fingerprint: saved.fingerprint,
        done: Promise.resolve(response),
        resolve: () => undefined,
        response,
      })
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

  private async complete(record: RequestRecord, frame: unknown, store?: Store) {
    const value = decode(frame)
    if (store) {
      const response = persistedResponse(value)
      const saved: SavedRequest = {
        requestID: record.requestID,
        idempotencyKey: record.idempotencyKey,
        fingerprint: record.fingerprint,
        response,
      }
      const previous = store.state.requests
      store.state.requests = [
        ...store.state.requests.filter(
          (item) => item.requestID !== saved.requestID && item.idempotencyKey !== saved.idempotencyKey,
        ),
        saved,
      ].slice(-stateLimits.requests)
      await store.save().catch((error: unknown) => {
        store.state.requests = previous
        throw error
      })
    }
    record.response = value
    record.resolve(value)
    this.out(value)
  }

  private async fail(
    record: RequestRecord,
    code: Code,
    message: string,
    frame: AgentOrchestrationRequest,
    store?: Store,
  ) {
    await this.complete(record, this.errorFrame(code, message, frame), store)
  }

  private summary(session: Stored) {
    const value = session.record
    return {
      id: value.id,
      workspaceID: value.workspaceID,
      agent: value.agent,
      state: value.state,
      backendVersion: value.backendVersion,
      backendMode: value.backendMode,
      capabilities: value.capabilities,
      ...(value.activeTurnID ? { activeTurnID: value.activeTurnID } : {}),
      ...(value.lastTurnID ? { lastTurnID: value.lastTurnID } : {}),
      ...(value.lastCursor ? { lastCursor: value.lastCursor } : {}),
    }
  }

  private snapshot(session: Stored) {
    return {
      session: this.summary(session),
      pending: session.record.pending.map((item) => ({
        id: item.id,
        kind: item.kind,
        revision: item.revision,
        title: item.title,
      })),
      artifacts: session.record.artifacts,
      authoritative: true as const,
    }
  }

  private async event(
    sessionID: string,
    input: Omit<Record<string, unknown>, "version" | "kind" | "cursor" | "sequence" | "sessionID">,
  ) {
    const session = this.sessions.get(sessionID)
    if (!session) return
    const sequence = ++this.#sequence
    const frame = decode({ version: "v1", kind: "event", cursor: `cur_${sequence}`, sequence, sessionID, ...input })
    if (frame.kind !== "event") throw new Error("orchestrator event projection failed")
    const events = [...(this.#events.get(sessionID) ?? []), frame].slice(-stateLimits.events)
    this.#events.set(sessionID, events)
    session.store.state.cursor = sequence
    session.store.state.events = [...session.store.state.events, redact(frame)].slice(-stateLimits.events)
    session.record.lastCursor = frame.cursor
    if (frame.type === "artifact.created") {
      session.record.artifacts = [
        ...session.record.artifacts.filter((item) => item.id !== frame.artifact.id),
        { ...frame.artifact, metadata: undefined },
      ].slice(-AgentOrchestrationLimits.maxArtifacts)
    }
    if (frame.type === "interaction.approval.requested" || frame.type === "interaction.question.requested")
      session.record.state = "waiting"
    if (frame.type === "turn.completed") {
      session.record.activeTurnID = undefined
      session.record.state = session.record.pending.length ? "waiting" : frame.status
    }
    await session.store.save()
    this.out(frame)
  }

  private async mapped(sessionID: string, session: Stored, event: ACPEvent, turnID: string | undefined) {
    if (event.type === "output" && turnID)
      return this.event(sessionID, {
        type: "turn.output",
        turnID,
        text: streamText(event.text),
        ...(event.nativeID ? { metadata: { nativeID: native(event.nativeID) } } : {}),
      })
    if (event.type === "reasoning" && turnID)
      return this.event(sessionID, {
        type: "turn.reasoning",
        turnID,
        text: streamText(event.text),
        ...(event.nativeID ? { metadata: { nativeID: native(event.nativeID) } } : {}),
      })
    if (event.type === "tool" && turnID) {
      const id = identifier("tol", scoped(sessionID, event.id))
      this.native.set(id, scoped(sessionID, event.id))
      return this.event(sessionID, {
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
    }
    if (event.type === "approval" && turnID) {
      const id = decodeInteractionID(identifier("int", scoped(sessionID, event.id)))
      const item = { id, kind: "approval" as const, revision: 1, nativeID: event.id, title: "Approval pending" }
      this.interactions.set(id, { sessionID, kind: item.kind, revision: item.revision, nativeID: item.nativeID })
      session.record.pending = [...session.record.pending.filter((value) => value.id !== id), item].slice(
        -AgentOrchestrationLimits.maxPendingInteractions,
      )
      const cwd = await approvalCwd(session.workspace, event.cwd)
      return this.event(sessionID, {
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
    }
    if (event.type === "question" && turnID) {
      const id = decodeInteractionID(identifier("int", scoped(sessionID, event.id)))
      const item = { id, kind: "question" as const, revision: 1, nativeID: event.id, title: "Input required" }
      this.interactions.set(id, { sessionID, kind: item.kind, revision: item.revision, nativeID: item.nativeID })
      session.record.pending = [...session.record.pending.filter((value) => value.id !== id), item].slice(
        -AgentOrchestrationLimits.maxPendingInteractions,
      )
      return this.event(sessionID, {
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
    }
    if (event.type === "plan") {
      const id = identifier("pln", scoped(sessionID, event.id))
      this.native.set(id, scoped(sessionID, event.id))
      return this.event(sessionID, {
        type: "plan.available",
        plan: {
          id,
          path: artifactPath(session.workspace, scoped(sessionID, event.id)),
          revision: 1,
          content: clean(event.content, AgentOrchestrationLimits.maxTextBytes, "Plan unavailable"),
          metadata: { nativeID: native(event.id), persisted: "false" },
        },
      })
    }
    if (event.type === "artifact") {
      const value = await contained(session.workspace, event.path).catch(() => undefined)
      if (!value) {
        if (turnID)
          await this.event(sessionID, {
            type: "turn.output",
            turnID,
            text: "Dropped ACP artifact outside the active workspace.",
          })
        return
      }
      const id = identifier("art", scoped(sessionID, event.id))
      this.native.set(id, scoped(sessionID, event.id))
      return this.event(sessionID, {
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
    }
    if (event.type === "retry" && turnID)
      return this.event(sessionID, {
        type: "turn.retry",
        turnID,
        reason: clean(event.reason, 2 * 1024, "Agent retry requested"),
      })
    if (event.type === "unsupported" && ["available_commands_update", "usage_update"].includes(event.feature)) return
    const message =
      event.type === "unsupported"
        ? `Unsupported ACP capability: ${event.feature}`
        : `Dropped ACP ${event.type} update outside the active workspace.`
    if (turnID) await this.event(sessionID, { type: "turn.reasoning", turnID, text: message })
  }

  private enqueue(sessionID: string, session: Stored, event: ACPEvent) {
    const turnID = session.record.activeTurnID ?? session.record.lastTurnID
    session.queue = session.queue
      .then(() => this.mapped(sessionID, session, event, turnID))
      .catch((error: unknown) => {
        this.error("internal", error instanceof Error ? error.message : "ACP event mapping failed")
      })
  }

  private async workspace(frame: Extract<AgentOrchestrationRequest, { type: "workspace.open" }>) {
    let request: RequestRecord | undefined
    try {
      if (!supported(frame.agent.id)) {
        request = await this.begin(frame)
        if (request)
          await this.fail(request, "unsupported_agent", `${frame.agent.id} is not available in the bridge`, frame)
        return
      }
      const workspace = await contained(this.root, frame.workspace.path)
      let store = this.#stores.get(workspace)
      if (!store) {
        store = await Store.open(decodeWorkspace({ ...frame.workspace, path: workspace }))
        this.#stores.set(workspace, store)
        this.hydrate(store)
      }
      request = await this.begin(frame)
      if (!request) return
      this.workspaces.set(frame.workspace.id, { path: workspace, store })
      await this.complete(
        request,
        {
          version: "v1",
          kind: "response",
          type: "workspace.open",
          requestID: frame.requestID,
          idempotencyKey: frame.idempotencyKey,
          workspace: { ...frame.workspace, path: workspace },
        },
        store,
      )
    } catch (error) {
      if (!request) request = await this.begin(frame)
      if (!request) return
      const code =
        error instanceof WorkspaceError || (error instanceof StateError && error.code === "path_forbidden")
          ? "path_forbidden"
          : error instanceof StateError && error.code === "too_large"
            ? "too_large"
            : error instanceof StateError && error.code === "corrupt"
              ? "bad_request"
              : "internal"
      await this.fail(request, code, error instanceof Error ? error.message : "workspace open failed", frame)
    }
  }

  async handle(frame: Frame) {
    if (frame.kind !== "request") return this.error("bad_request", "bridge accepts request frames only")
    if (frame.type === "workspace.open") return this.workspace(frame)
    const record = await this.begin(frame)
    if (!record) return
    try {
      if (frame.type === "bridge.hello") {
        const result = await this.preflight(frame.agent, this.root)
        this.#preflights.set(frame.agent, result)
        await this.complete(record, {
          version: "v1",
          kind: "response",
          type: "bridge.hello",
          requestID: frame.requestID,
          idempotencyKey: frame.idempotencyKey,
          bridgeVersion,
          protocolVersion: "v1",
          agent: frame.agent,
          backendVersion: result.version,
          backendMode: result.mode,
          capabilities: result.capabilities,
        })
        return
      }
      if (frame.type === "session.create") {
        if (!supported(frame.agent))
          return this.fail(record, "unsupported_agent", `${frame.agent} is unavailable`, frame)
        const opened = this.workspaces.get(frame.workspaceID)
        if (!opened) return this.fail(record, "not_found", "workspace was not opened", frame)
        if (opened.store.state.sessions.length >= stateLimits.sessions)
          return this.fail(record, "too_large", "workspace session journal is full", frame, opened.store)
        const id = decodeSessionID(identifier("ses"))
        const pending: ACPEvent[] = []
        let stored: Stored | undefined
        const adapter = await this.open({
          agent: frame.agent,
          cwd: opened.path,
          emit: (event) => {
            if (stored) return this.enqueue(id, stored, event)
            pending.push(event)
          },
        })
        const check = this.#preflights.get(frame.agent)
        const saved: SavedSession = {
          id,
          workspaceID: frame.workspaceID,
          agent: frame.agent,
          nativeID: native(adapter.nativeID),
          backendVersion: safeVersion(adapter.version === "unknown" ? check?.version : adapter.version),
          backendMode: adapter.mode ?? check?.mode ?? fallbackMode(frame.agent),
          capabilities: [...adapter.capabilities],
          state: "idle",
          pending: [],
          artifacts: [],
        }
        stored = {
          record: saved,
          store: opened.store,
          workspace: opened.path,
          adapter,
          queue: Promise.resolve(),
          run: 0,
        }
        this.sessions.set(id, stored)
        opened.store.state.sessions = [...opened.store.state.sessions, saved]
        this.native.set(id, scoped(id, adapter.nativeID))
        await this.complete(
          record,
          {
            version: "v1",
            kind: "response",
            type: "session.create",
            requestID: frame.requestID,
            idempotencyKey: frame.idempotencyKey,
            sessionID: id,
            capabilities: adapter.capabilities,
          },
          opened.store,
        )
        for (const event of pending) this.enqueue(id, stored, event)
        await stored.queue
        return
      }
      if (frame.type === "session.list") {
        const opened = this.workspaces.get(frame.workspaceID)
        if (!opened) return this.fail(record, "not_found", "workspace was not opened", frame)
        const sessions = [...this.sessions.values()]
          .filter(
            (item) =>
              item.record.workspaceID === frame.workspaceID && (!frame.agent || item.record.agent === frame.agent),
          )
          .map((item) => this.summary(item))
          .slice(0, AgentOrchestrationLimits.maxSessions)
        await this.complete(
          record,
          {
            version: "v1",
            kind: "response",
            type: "session.list",
            requestID: frame.requestID,
            idempotencyKey: frame.idempotencyKey,
            sessions,
          },
          opened.store,
        )
        return
      }
      if (frame.type === "session.attach") {
        const session = this.sessions.get(frame.sessionID)
        if (!session) return this.fail(record, "not_found", "session was not found", frame)
        if (!session.adapter && session.record.capabilities.includes("replay")) {
          const pending: ACPEvent[] = []
          let adapter: Session | undefined
          adapter = await this.open({
            agent: session.record.agent,
            cwd: session.workspace,
            resume: session.record.nativeID,
            emit: (event) => {
              if (adapter) return this.enqueue(frame.sessionID, session, event)
              pending.push(event)
            },
          })
          if (adapter.resumable !== false) {
            session.adapter = adapter
            session.record.nativeID = native(adapter.nativeID)
            session.record.backendMode = adapter.mode ?? session.record.backendMode
            session.record.backendVersion = safeVersion(
              adapter.version === "unknown" ? session.record.backendVersion : adapter.version,
            )
            session.record.capabilities = [...adapter.capabilities]
            session.record.state = session.record.pending.length ? "waiting" : "idle"
            for (const event of pending) this.enqueue(frame.sessionID, session, event)
            await session.queue
          } else await adapter.close()
        }
        await this.complete(
          record,
          {
            version: "v1",
            kind: "response",
            type: "session.attach",
            requestID: frame.requestID,
            idempotencyKey: frame.idempotencyKey,
            attached: !!session.adapter,
            snapshot: this.snapshot(session),
          },
          session.store,
        )
        return
      }
      if (frame.type === "session.snapshot") {
        const session = this.sessions.get(frame.sessionID)
        if (!session) return this.fail(record, "not_found", "session was not found", frame)
        await this.complete(
          record,
          {
            version: "v1",
            kind: "response",
            type: "session.snapshot",
            requestID: frame.requestID,
            idempotencyKey: frame.idempotencyKey,
            snapshot: this.snapshot(session),
          },
          session.store,
        )
        return
      }
      if (frame.type === "turn.create") {
        const session = this.sessions.get(frame.sessionID)
        if (!session || session.record.agent !== frame.agent)
          return this.fail(record, "not_found", "session was not found for this agent", frame)
        if (!session.adapter)
          return this.fail(record, "not_found", "session is detached and cannot start a turn", frame, session.store)
        if (session.record.activeTurnID)
          return this.fail(record, "bad_request", "a turn is already active for this session", frame, session.store)
        const turnID = frame.turnID ?? decodeTurnID(identifier("trn"))
        session.record.activeTurnID = turnID
        session.record.lastTurnID = turnID
        session.record.state = "running"
        const run = ++session.run
        await this.complete(
          record,
          {
            version: "v1",
            kind: "response",
            type: "turn.create",
            requestID: frame.requestID,
            idempotencyKey: frame.idempotencyKey,
            sessionID: frame.sessionID,
            turnID,
          },
          session.store,
        )
        let message: string | undefined
        const task = session.adapter
          .turn(frame.prompt)
          .catch((error: unknown) => {
            message = error instanceof Error ? error.message : "agent turn failed"
          })
          .then(async () => {
            await session.queue
            if (session.record.activeTurnID !== turnID || session.run !== run) return
            await this.event(frame.sessionID, {
              type: "turn.completed",
              turnID,
              status: message ? "failed" : "completed",
              ...(message ? { message: clean(message, 2 * 1024) } : {}),
            })
          })
          .catch((error: unknown) => {
            this.error("internal", error instanceof Error ? error.message : "turn state persistence failed")
          })
          .finally(() => this.#tasks.delete(task))
        this.#tasks.add(task)
        return
      }
      if (frame.type === "turn.cancel" || frame.type === "turn.retry" || frame.type === "turn.steer") {
        const session = this.sessions.get(frame.sessionID)
        if (!session || !session.adapter) return this.fail(record, "not_found", "attached session was not found", frame)
        const operation = frame.type.slice(5) as "cancel" | "retry" | "steer"
        const action = session.adapter[operation]
        if (!action || !session.record.capabilities.includes(operation as AgentOrchestrationCapability))
          return this.fail(
            record,
            "unsupported_operation",
            `${frame.type} is not supported by ${session.record.agent} in ${session.record.backendMode} mode`,
            frame,
            session.store,
          )
        const current =
          frame.type === "turn.retry"
            ? !session.record.activeTurnID && session.record.lastTurnID === frame.turnID
            : session.record.activeTurnID === frame.turnID
        if (!current)
          return this.fail(
            record,
            "bad_request",
            `${frame.turnID} is not the current ${operation} target`,
            frame,
            session.store,
          )
        const accepted =
          frame.type === "turn.steer"
            ? await session.adapter.steer?.(frame.turnID, frame.instruction)
            : frame.type === "turn.cancel"
              ? await session.adapter.cancel?.(frame.turnID)
              : await session.adapter.retry?.(frame.turnID)
        if (!accepted)
          return this.fail(
            record,
            "unsupported_operation",
            `${frame.type} was rejected by the provider`,
            frame,
            session.store,
          )
        if (frame.type === "turn.retry") {
          session.run++
          session.record.activeTurnID = frame.turnID
          session.record.state = "running"
        }
        await this.complete(
          record,
          {
            version: "v1",
            kind: "response",
            type: frame.type,
            requestID: frame.requestID,
            idempotencyKey: frame.idempotencyKey,
            sessionID: frame.sessionID,
            turnID: frame.turnID,
          },
          session.store,
        )
        if (frame.type === "turn.cancel") {
          session.run++
          await this.event(frame.sessionID, {
            type: "turn.completed",
            turnID: frame.turnID,
            status: "stopped",
          })
        }
        return
      }
      if (frame.type === "interaction.approval.reply" || frame.type === "interaction.question.reply") {
        const session = this.sessions.get(frame.sessionID)
        const interaction = this.interactions.get(frame.interactionID)
        const kind = frame.type === "interaction.approval.reply" ? "approval" : "question"
        const accepted =
          !!session &&
          !!session.adapter &&
          !!interaction &&
          interaction.sessionID === frame.sessionID &&
          interaction.kind === kind &&
          interaction.revision === frame.revision &&
          (frame.type === "interaction.approval.reply"
            ? session.adapter.approval(interaction.nativeID, frame.decision === "approved")
            : session.adapter.question(interaction.nativeID, frame.answer))
        if (!session || !accepted)
          return this.fail(record, "interaction_conflict", `${kind} is no longer pending`, frame, session?.store)
        this.interactions.delete(frame.interactionID)
        session.record.pending = session.record.pending.filter((item) => item.id !== frame.interactionID)
        session.record.state = session.record.activeTurnID ? "running" : "idle"
        await this.complete(
          record,
          {
            version: "v1",
            kind: "response",
            type: frame.type,
            requestID: frame.requestID,
            idempotencyKey: frame.idempotencyKey,
            sessionID: frame.sessionID,
          },
          session.store,
        )
        return
      }
      if (frame.type === "event.replay") {
        const session = this.sessions.get(frame.sessionID)
        if (!session) return this.fail(record, "not_found", "session was not found", frame)
        const after = frame.afterCursor ? number(frame.afterCursor) : undefined
        const first = session.store.state.events[0]?.sequence
        if (after !== undefined && (after > session.store.state.cursor || (first !== undefined && after < first - 1)))
          return this.fail(
            record,
            "cursor_gap",
            "event cursor is outside the retained tail; request a snapshot",
            frame,
            session.store,
          )
        const available = (this.#events.get(frame.sessionID) ?? []).filter(
          (event) => after === undefined || event.sequence > after,
        )
        const events = available.slice(0, frame.limit)
        const hasMore = available.length > events.length
        await this.complete(
          record,
          {
            version: "v1",
            kind: "response",
            type: "event.replay",
            requestID: frame.requestID,
            idempotencyKey: frame.idempotencyKey,
            events,
            ...(hasMore ? { nextCursor: available[events.length]!.cursor } : {}),
            hasMore,
          },
          session.store,
        )
        return
      }
      await this.fail(record, "unsupported_operation", `${frame.type} is not available in the bridge`, frame)
    } catch (error) {
      const code =
        error instanceof WorkspaceError || (error instanceof StateError && error.code === "path_forbidden")
          ? "path_forbidden"
          : error instanceof StateError && error.code === "too_large"
            ? "too_large"
            : error instanceof StateError && error.code === "corrupt"
              ? "bad_request"
              : "internal"
      await this.fail(record, code, error instanceof Error ? error.message : "remote orchestrator failed", frame)
    }
  }

  async close() {
    this.#closed = true
    await Promise.allSettled([...this.sessions.values()].map((session) => session.adapter?.close()))
    await Promise.allSettled([...this.#tasks])
    await Promise.allSettled([...this.#stores.values()].map((store) => store.close()))
    this.sessions.clear()
    this.interactions.clear()
    this.#requests.clear()
    this.#events.clear()
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
