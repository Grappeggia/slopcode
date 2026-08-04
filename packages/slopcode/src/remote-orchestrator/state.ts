import { randomUUID } from "node:crypto"
import { constants } from "node:fs"
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises"
import path from "node:path"
import { Schema, SchemaParser } from "effect"
import {
  AgentOrchestrationArtifact,
  AgentOrchestrationBackendMode,
  AgentOrchestrationBackendVersion,
  AgentOrchestrationCapabilities,
  AgentOrchestrationEvent,
  AgentOrchestrationEventCursor,
  AgentOrchestrationFrame,
  AgentOrchestrationInteractionID,
  AgentOrchestrationSessionID,
  AgentOrchestrationSessionState,
  AgentOrchestrationTurnID,
  AgentOrchestrationWorkspace,
  AgentOrchestrationWorkspaceID,
  type AgentOrchestrationEvent as Event,
} from "@slopcode-ai/protocol"

export const limits = {
  bytes: 2 * 1024 * 1024,
  events: 128,
  requests: 256,
  sessions: 64,
} as const

export class StateError extends Error {
  constructor(
    readonly code: "corrupt" | "too_large" | "path_forbidden",
    message: string,
  ) {
    super(message)
  }
}

const exact = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S) =>
  Schema.declareConstructor<S["Type"], S["Encoded"]>()(
    [schema],
    ([codec]) =>
      (value, _ast, options) =>
        SchemaParser.decodeUnknownEffect(codec, { ...options, onExcessProperty: "error" })(value),
  )
const text = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(512))
const count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(2_147_483_647))
const pending = exact(
  Schema.Struct({
    id: AgentOrchestrationInteractionID,
    kind: Schema.Literals(["approval", "question"]),
    revision: Schema.Int.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(1_000_000)),
    nativeID: text,
    title: text,
  }),
)
const session = exact(
  Schema.Struct({
    id: AgentOrchestrationSessionID,
    workspaceID: AgentOrchestrationWorkspaceID,
    agent: Schema.Literals(["slopcode", "opencode", "codex", "claude", "antigravity"]),
    nativeID: text,
    backendVersion: AgentOrchestrationBackendVersion,
    backendMode: AgentOrchestrationBackendMode,
    capabilities: AgentOrchestrationCapabilities,
    state: AgentOrchestrationSessionState,
    activeTurnID: Schema.optional(AgentOrchestrationTurnID),
    lastTurnID: Schema.optional(AgentOrchestrationTurnID),
    lastCursor: Schema.optional(AgentOrchestrationEventCursor),
    pending: Schema.Array(pending).check(Schema.isMaxLength(32)),
    artifacts: Schema.Array(AgentOrchestrationArtifact).check(Schema.isMaxLength(64)),
  }),
)
const response = AgentOrchestrationFrame.check(
  Schema.makeFilter((value) =>
    value.kind === "response" || value.kind === "error" ? undefined : "request record response is invalid",
  ),
)
const request = exact(
  Schema.Struct({
    requestID: text,
    idempotencyKey: text,
    fingerprint: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
    response,
  }),
)
const schema = exact(
  Schema.Struct({
    version: Schema.Literal(1),
    workspace: AgentOrchestrationWorkspace,
    cursor: count,
    sessions: Schema.Array(session).check(Schema.isMaxLength(limits.sessions)),
    events: Schema.Array(AgentOrchestrationEvent).check(Schema.isMaxLength(limits.events)),
    requests: Schema.Array(request).check(Schema.isMaxLength(limits.requests)),
  }),
)

type Mutable<T> = { -readonly [K in keyof T]: T[K] }
export type Pending = Mutable<typeof pending.Type>
export type Session = Omit<Mutable<typeof session.Type>, "pending" | "artifacts"> & {
  pending: Pending[]
  artifacts: Array<typeof AgentOrchestrationArtifact.Type>
}
export type Request = Mutable<typeof request.Type>
export type State = Omit<Mutable<typeof schema.Type>, "sessions" | "events" | "requests"> & {
  sessions: Session[]
  events: Event[]
  requests: Request[]
}

const decode = Schema.decodeUnknownSync(schema)
const missing = (error: unknown) =>
  !!error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ENOENT"
const checked = async (value: string, kind: "directory" | "file") => {
  const info = await lstat(value).catch((error: unknown) => {
    if (missing(error)) return undefined
    throw error
  })
  if (!info) return false
  if (info.isSymbolicLink() || (kind === "directory" ? !info.isDirectory() : !info.isFile()))
    throw new StateError("path_forbidden", `orchestrator state ${kind} is not a regular ${kind}`)
  return true
}
type Identity = { dev: number | bigint; ino: number | bigint }
const identity = async (value: string): Promise<Identity> => {
  const info = await lstat(value)
  if (info.isSymbolicLink() || !info.isDirectory())
    throw new StateError("path_forbidden", "orchestrator state directory is not a regular directory")
  if ((await realpath(value)) !== value)
    throw new StateError("path_forbidden", "orchestrator state directory is not canonical")
  return { dev: info.dev, ino: info.ino }
}
const stable = async (value: string, expected: Identity) => {
  const actual = await identity(value)
  if (actual.dev !== expected.dev || actual.ino !== expected.ino)
    throw new StateError("path_forbidden", "orchestrator state directory changed during access")
}
const directory = async (workspace: string) => {
  const base = path.join(workspace, ".slopcode")
  if (!(await checked(base, "directory"))) await mkdir(base, { mode: 0o700 })
  await identity(base)
  const dir = path.join(base, "remote-orchestrator")
  if (!(await checked(dir, "directory"))) await mkdir(dir, { mode: 0o700 })
  await identity(dir)
  return dir
}
const json = (state: State) => {
  try {
    return `${JSON.stringify(decode(JSON.parse(JSON.stringify(state))))}\n`
  } catch {
    throw new StateError("corrupt", "orchestrator state mutation is invalid")
  }
}
const inside = (base: string, value: string) => {
  const relative = path.relative(base, value)
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
}
const safe = async (base: string, value: string) => {
  if (!inside(base, value)) return false
  const relative = path.relative(base, value)
  const segments = relative ? relative.split(path.sep) : []
  let current = base
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment)
    const info = await lstat(current).catch((error: unknown) => {
      if (missing(error)) return undefined
      throw error
    })
    if (!info) return true
    if (info.isSymbolicLink()) return false
    if (index < segments.length - 1 && !info.isDirectory()) return false
  }
  return true
}

const write = async (workspace: string, state: State) => {
  const value = json(state)
  if (Buffer.byteLength(value) > limits.bytes)
    throw new StateError("too_large", "orchestrator state journal is too large")
  const dir = await directory(workspace)
  const owner = await identity(dir)
  const target = path.join(dir, "v1.json")
  if (await checked(target, "file")) {
    const info = await lstat(target)
    if (info.size > limits.bytes) throw new StateError("too_large", "orchestrator state journal is too large")
  }
  const temp = path.join(dir, `.v1-${randomUUID()}.tmp`)
  const file = await open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600)
  const saved = file.writeFile(value).then(() => file.sync())
  await saved
    .finally(() => file.close())
    .catch(async (error: unknown) => {
      await rm(temp, { force: true })
      throw error
    })
  await stable(dir, owner).catch(async (error: unknown) => {
    await rm(temp, { force: true })
    throw error
  })
  if (!inside(dir, await realpath(temp))) {
    await rm(temp, { force: true })
    throw new StateError("path_forbidden", "orchestrator temporary journal escaped its state directory")
  }
  await rename(temp, target).catch(async (error: unknown) => {
    await rm(temp, { force: true })
    throw error
  })
  await stable(dir, owner)
  const folder = await open(dir, "r")
  await folder.sync().finally(() => folder.close())
}

const read = async (workspace: AgentOrchestrationWorkspace): Promise<State> => {
  const dir = await directory(workspace.path)
  const owner = await identity(dir)
  const target = path.join(dir, "v1.json")
  if (!(await checked(target, "file")))
    return { version: 1, workspace, cursor: 0, sessions: [], events: [], requests: [] } as State
  const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ELOOP")
      throw new StateError("path_forbidden", "orchestrator state journal became a symlink")
    throw error
  })
  await stable(dir, owner).catch(async (error: unknown) => {
    await file.close()
    throw error
  })
  if (!inside(dir, await realpath(target))) {
    await file.close()
    throw new StateError("path_forbidden", "orchestrator state journal escaped its state directory")
  }
  const info = await file.stat()
  if (!info.isFile()) {
    await file.close()
    throw new StateError("path_forbidden", "orchestrator state journal is not a regular file")
  }
  if (info.size > limits.bytes) {
    await file.close()
    throw new StateError("too_large", "orchestrator state journal is too large")
  }
  const value = await file.readFile("utf8").finally(() => file.close())
  let input: unknown
  try {
    input = JSON.parse(value)
  } catch {
    throw new StateError("corrupt", "orchestrator state journal is corrupt")
  }
  let state: State
  try {
    state = decode(input) as State
  } catch {
    throw new StateError("corrupt", "orchestrator state journal is corrupt")
  }
  if (state.workspace.id !== workspace.id || state.workspace.path !== workspace.path)
    throw new StateError("path_forbidden", "orchestrator state belongs to another workspace")
  const paths = state.sessions
    .flatMap((item) => item.artifacts.map((artifact) => artifact.path))
    .concat(
      state.events.flatMap((event) => {
        if (event.type === "artifact.created") return [event.artifact.path]
        if (event.type === "plan.available" || event.type === "plan.saved") return [event.plan.path]
        if (event.type === "interaction.approval.requested" && event.interaction.cwd) return [event.interaction.cwd]
        return []
      }),
    )
  if ((await Promise.all(paths.map((value) => safe(workspace.path, value)))).some((value) => !value))
    throw new StateError("path_forbidden", "orchestrator state contains a path outside its workspace")
  state.workspace = { id: state.workspace.id, path: state.workspace.path }
  return state as State
}

export const redact = (event: Event): Event => {
  const metadata = { redacted: "true" }
  if (event.type === "turn.output") return { ...event, text: "[output redacted for resume]", metadata }
  if (event.type === "turn.reasoning") return { ...event, text: "[reasoning redacted for resume]", metadata }
  if (event.type === "tool.updated") return { ...event, tool: { ...event.tool, title: "Tool update", metadata } }
  if (event.type === "turn.retry") return { ...event, reason: "Agent requested retry" }
  if (event.type === "turn.completed") {
    const { message: _message, ...value } = event
    return value
  }
  if (event.type === "interaction.approval.requested")
    return {
      ...event,
      interaction: {
        id: event.interaction.id,
        revision: event.interaction.revision,
        title: "Approval pending",
        metadata,
      },
    }
  if (event.type === "interaction.question.requested")
    return {
      ...event,
      interaction: {
        id: event.interaction.id,
        revision: event.interaction.revision,
        prompt: "Input required",
        allowFreeform: true,
        metadata,
      },
    }
  if (event.type === "plan.available" || event.type === "plan.saved")
    return { ...event, plan: { ...event.plan, content: "[plan redacted for resume]", metadata } }
  return { ...event, artifact: { ...event.artifact, metadata: undefined } }
}

export class Store {
  #queue = Promise.resolve()

  private constructor(
    readonly workspace: string,
    readonly state: State,
  ) {}

  static async open(workspace: AgentOrchestrationWorkspace) {
    const state = await read({ id: workspace.id, path: workspace.path })
    const interrupted = state.sessions.some((item) => item.activeTurnID || item.state === "running")
    if (interrupted)
      state.sessions = state.sessions.map((item) =>
        item.activeTurnID || item.state === "running"
          ? { ...item, state: "interrupted" as const, activeTurnID: undefined }
          : item,
      )
    const store = new Store(workspace.path, state)
    if (interrupted) await store.save()
    return store
  }

  save() {
    const task = () => write(this.workspace, this.state)
    const next = this.#queue.then(task, task)
    this.#queue = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  async close() {
    await this.#queue
  }
}
