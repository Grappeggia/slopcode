import { EventV2 } from "@slopcode-ai/core/event"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { Location } from "@slopcode-ai/core/location"
import { Pty } from "@slopcode-ai/core/pty"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { AppProcess } from "@slopcode-ai/core/process"
import {
  MAX_REMOTE_JOB_EVENTS,
  MAX_REMOTE_JOB_OUTPUT_BYTES,
  MAX_REMOTE_REVIEW_COMMENTS,
  MAX_REMOTE_REVIEW_DIFF_BYTES,
  MAX_REMOTE_REVIEW_FILES,
  MAX_REMOTE_REVIEW_SCREENSHOTS,
  MAX_REMOTE_REVIEW_TESTS,
  RemoteAgent,
  RemoteAgentConfig,
  RemoteAgentJobAction,
  RemoteAgentJobEvent,
  RemoteAgentJobState,
  RemoteCommandPreview,
  RemoteReview,
} from "../groups/remote-runtime"
import { ChildProcess } from "effect/unstable/process"
import { Context, Deferred, Effect, Layer, Queue, Scope, Stream } from "effect"
import path from "node:path"

type Agent = typeof RemoteAgent.Type
type Config = typeof RemoteAgentConfig.Type
type State = typeof RemoteAgentJobState.Type
type Event = typeof RemoteAgentJobEvent.Type
type Action = typeof RemoteAgentJobAction.Type
type Data = Event["data"]

type StartInput = {
  readonly id: string
  readonly workspaceID: string
  readonly root: string
  readonly directory: string
  readonly agent: Agent
  readonly prompt: string
  readonly config?: Config
}

type Job = {
  state: State
  root: string
  prompt: string
  config?: Config
  ptyID: Pty.Info["id"]
  sequence: number
  events: Event[]
  listeners: Set<Queue.Queue<Event>>
  exitCode?: number
  write?: (value: string) => void
  stop?: () => Effect.Effect<boolean>
  input: string[]
  pending: string
}

export class RemoteAgentJobNotFoundError extends Error {
  readonly _tag = "RemoteAgentJobNotFoundError"

  constructor(readonly jobID: string) {
    super(`Remote agent job not found: ${jobID}`)
  }
}

export interface Interface {
  readonly start: (input: StartInput) => Effect.Effect<State>
  readonly stream: (input: { readonly jobID: string; readonly cursor?: string }) => Effect.Effect<Stream.Stream<Event>, RemoteAgentJobNotFoundError, Scope.Scope>
  readonly action: (input: { readonly jobID: string; readonly action: Action }) => Effect.Effect<State, Error>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/RemoteAgentJobs") {}

const executable = {
  "codex-cli": "codex",
  "opencode-cli": "opencode",
  "claude-code": "claude",
} as const

const outputLimit = MAX_REMOTE_JOB_OUTPUT_BYTES
const textLimit = 4096

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`
}

function text(value: unknown, limit = textLimit) {
  if (typeof value !== "string" || !value || value.length > limit || /\u0000/.test(value)) return
  return value
}

function reviewText(value: unknown, limit: number) {
  if (typeof value !== "string" || value.length > limit || /\u0000/.test(value)) return
  return value
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function command(agent: Agent, prompt: string, config?: Config) {
  const args = [agent === "codex-cli" ? "exec" : agent === "opencode-cli" ? "run" : "-p"]
  if (config?.model) args.push("--model", config.model)
  if (agent === "codex-cli") {
    if (config?.profile) args.push("--profile", config.profile)
    if (config?.sandbox) args.push("--sandbox", config.sandbox)
    if (config?.approval) args.push("--ask-for-approval", config.approval)
    args.push("--json")
  }
  if (agent === "opencode-cli") {
    if (config?.profile) args.push("--agent", config.profile)
    args.push("--format", "json")
  }
  if (agent === "claude-code") {
    if (config?.permissionMode) args.push("--permission-mode", config.permissionMode)
    args.push("--output-format", "stream-json", "--include-partial-messages")
  }
  args.push("--", prompt)
  return { executable: executable[agent], args }
}

function environment() {
  return {
    ...Object.fromEntries(Object.entries(process.env).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : [])),
    SLOPCODE_REMOTE_SUPERVISOR_TOKEN: "",
    SLOPCODE_SERVER_PASSWORD: "",
    TERM: "xterm-256color",
    SLOPCODE_TERMINAL: "1",
  }
}

function preview(agent: Agent, directory: string, prompt: string, config?: Config): RemoteCommandPreview {
  const selected = command(agent, prompt, config)
  return {
    executable: selected.executable,
    args: selected.args.map((value) => (value === prompt ? "<prompt>" : value)),
    cwd: directory,
  }
}

function strip(value: string) {
  return value.replaceAll(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
}

function boundedOutput(value: string) {
  return value.slice(-outputLimit)
}

function approval(value: unknown) {
  if (typeof value === "string") return { title: text(value) ?? "Approval required" }
  if (!record(value)) return
  const title = text(value.title ?? value.message ?? value.reason)
  if (!title) return
  const command = text(value.command)
  const cwd = text(value.cwd ?? value.directory, 4096)
  const reason = text(value.reason)
  const risk: "low" | "medium" | "high" | undefined = value.risk === "low" || value.risk === "medium" || value.risk === "high" ? value.risk : undefined
  return {
    ...(text(value.id) ? { id: text(value.id) } : {}),
    title,
    ...(command ? { command } : {}),
    ...(cwd ? { cwd } : {}),
    ...(reason ? { reason } : {}),
    ...(risk ? { risk } : {}),
  }
}

function question(value: unknown) {
  if (typeof value === "string") return { prompt: text(value) ?? "The agent needs an answer." }
  if (!record(value)) return
  const prompt = text(value.prompt ?? value.question ?? value.message)
  if (!prompt) return
  const options = Array.isArray(value.options)
    ? value.options.flatMap((item) => {
        const next = text(item, 512)
        return next ? [next] : []
      }).slice(0, 32)
    : undefined
  return {
    ...(text(value.id) ? { id: text(value.id) } : {}),
    prompt,
    ...(options?.length ? { options } : {}),
    ...(typeof value.allowFreeform === "boolean" ? { allowFreeform: value.allowFreeform } : {}),
  }
}

function firstQuestion(value: Record<string, unknown>) {
  if (value.question !== undefined) return value.question
  if (Array.isArray(value.questions)) return value.questions[0]
  return undefined
}

function commandPreview(value: unknown) {
  if (!record(value)) return
  const executable = text(value.executable ?? value.command, 256)
  const cwd = text(value.cwd ?? value.directory, 4096)
  if (!executable || !cwd) return
  const args = Array.isArray(value.args)
    ? value.args.flatMap((item) => {
        const next = text(item, 512)
        return next ? [next] : []
      }).slice(0, 64)
    : []
  return { executable, args, cwd } satisfies RemoteCommandPreview
}

function review(value: unknown): RemoteReview | undefined {
  if (!record(value)) return
  const files = Array.isArray(value.files)
    ? value.files.flatMap((item) => {
        if (!record(item)) return []
        const file = text(item.path, 4096)
        const diff = reviewText(item.diff, MAX_REMOTE_REVIEW_DIFF_BYTES)
        const status = item.status
        if (!file || diff === undefined || !["added", "modified", "deleted", "renamed", "untracked"].includes(status as string)) return []
        return [{
          path: file,
          status: status as "added" | "modified" | "deleted" | "renamed" | "untracked",
          additions: typeof item.additions === "number" ? Math.max(0, Math.trunc(item.additions)) : 0,
          deletions: typeof item.deletions === "number" ? Math.max(0, Math.trunc(item.deletions)) : 0,
          diff,
        }]
      }).slice(0, MAX_REMOTE_REVIEW_FILES)
    : []
  const tests = Array.isArray(value.tests)
    ? value.tests.flatMap((item) => {
        if (!record(item)) return []
        const name = text(item.name, 256)
        const status = item.status
        if (!name || !["passed", "failed", "skipped"].includes(status as string)) return []
        const output = text(item.output, MAX_REMOTE_REVIEW_DIFF_BYTES)
        return [{
          name,
          status: status as "passed" | "failed" | "skipped",
          ...(typeof item.durationMs === "number" ? { durationMs: Math.max(0, Math.trunc(item.durationMs)) } : {}),
          ...(output ? { output } : {}),
        }]
      }).slice(0, MAX_REMOTE_REVIEW_TESTS)
    : []
  const screenshots = Array.isArray(value.screenshots)
    ? value.screenshots.flatMap((item) => {
        if (!record(item)) return []
        const name = text(item.name, 256)
        const mime = text(item.mime, 128)
        const data = text(item.data, 512 * 1024)
        if (!name || !mime?.startsWith("image/") || !data?.startsWith("data:image/")) return []
        return [{ name, mime, data }]
      }).slice(0, MAX_REMOTE_REVIEW_SCREENSHOTS)
    : []
  const comments = Array.isArray(value.comments)
    ? value.comments.flatMap((item) => {
        if (!record(item)) return []
        const path = text(item.path, 4096)
        const body = text(item.body, 4096)
        if (!path || !body) return []
        return [{
          id: text(item.id) ?? id("comment"),
          path,
          ...(typeof item.line === "number" ? { line: Math.max(1, Math.trunc(item.line)) } : {}),
          body,
          createdAt: typeof item.createdAt === "number" ? Math.trunc(item.createdAt) : Date.now(),
        }]
      }).slice(0, MAX_REMOTE_REVIEW_COMMENTS)
    : []
  return { files, tests, screenshots, comments }
}

function mergeReview(left: RemoteReview | undefined, right: RemoteReview | undefined) {
  if (!left) return right
  if (!right) return left
  return {
    files: right.files.length ? right.files : left.files,
    tests: right.tests.length ? right.tests : left.tests,
    screenshots: [...left.screenshots, ...right.screenshots].slice(-MAX_REMOTE_REVIEW_SCREENSHOTS),
    comments: [...left.comments, ...right.comments].slice(-MAX_REMOTE_REVIEW_COMMENTS),
  }
}

function structured(line: string): { type: string; data: Data } | undefined {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return
  }
  if (!record(value)) return
  const type = text(value.type ?? value.event, 256)
  if (!type) return
  const raw = record(value.data) ? value.data : value
  const source = record(raw.item) ? raw.item : raw
  const output = text(source.output ?? source.text ?? source.message ?? value.output ?? value.text, MAX_REMOTE_JOB_OUTPUT_BYTES)
  const parsedApproval = approval(
    source.approval ?? source.permission ??
      ((type.includes("approval") || source.status === "requires_approval" || source.status === "waiting_approval") ? source : undefined),
  )
  const parsedQuestion = question(firstQuestion(source) ?? (type.includes("question") ? source : undefined))
  const parsedCommand = commandPreview(source.commandPreview ?? (type.includes("command") ? source : undefined))
  const parsedReview = review(source.review)
  if (parsedApproval) return { type: "job.approval", data: { ...(output ? { output } : {}), approval: parsedApproval, ...(parsedCommand ? { commandPreview: parsedCommand } : {}) } }
  if (parsedQuestion) return { type: "job.question", data: { ...(output ? { output } : {}), question: parsedQuestion } }
  if (parsedReview) return { type: "job.review.updated", data: { ...(output ? { output } : {}), review: parsedReview } }
  if (parsedCommand) return { type: "job.command.preview", data: { ...(output ? { output } : {}), commandPreview: parsedCommand } }
  if (output) return { type: "job.output", data: { output } }
  return { type: "job.progress", data: { message: type } }
}

function terminal(type: string) {
  if (type.endsWith("completed")) return "completed" as const
  if (type.endsWith("failed")) return "failed" as const
  if (type.endsWith("stopped")) return "stopped" as const
}

function nextState(state: State, event: Event): State {
  const done = terminal(event.type)
  const data = event.data
  const status = done ??
    (event.type.endsWith("queued") ? "queued" :
      event.type.endsWith("approval") ? "waiting_approval" :
        event.type.endsWith("question") ? "waiting_question" :
          event.type.endsWith("retry") ? "retrying" :
            event.type.endsWith("review.updated") || event.type.endsWith("command.preview") ? state.status : "running")
  const output = data.output ? boundedOutput(`${state.output ?? ""}${data.output}`) : state.output
  return {
    ...state,
    status,
    cursor: event.cursor,
    ...(output ? { output } : {}),
    ...(data.error ? { error: data.error } : {}),
    ...(data.progress === undefined ? {} : { progress: data.progress }),
    ...(data.sessionID ? { sessionID: data.sessionID } : {}),
    ...(data.commandPreview ? { commandPreview: data.commandPreview } : {}),
    ...(data.approval ? { approval: data.approval } : {}),
    ...(data.question ? { question: data.question } : {}),
    ...(data.review ? { review: mergeReview(state.review, data.review) } : {}),
    updatedAt: Date.now(),
  }
}

function data(value: Record<string, unknown>): Data {
  return value as Data
}

function statusData(job: Job, type: string, values: Record<string, unknown> = {}) {
  const event = {
    id: id("evt"),
    cursor: String(++job.sequence),
    jobID: job.state.id,
    type,
    data: data(values),
  } satisfies Event
  job.events.push(event)
  if (job.events.length > MAX_REMOTE_JOB_EVENTS) job.events.shift()
  job.state = nextState(job.state, event)
  for (const listener of job.listeners) Queue.offerUnsafe(listener, event)
  return event
}

function changedFiles(value: string, root: string) {
  return value.split(/\r?\n/).flatMap((line) => {
    if (line.length < 4) return []
    const relative = line.slice(3).trim().split(" -> ").at(-1)
    if (!relative || relative.startsWith("/")) return []
    const status = line.slice(0, 2).trim()
    const kind = status.includes("?") ? "untracked" : status.includes("D") ? "deleted" : status.includes("R") ? "renamed" : status.includes("A") ? "added" : "modified"
    return [{ path: path.join(root, relative), status: kind as "added" | "modified" | "deleted" | "renamed" | "untracked" }]
  })
}

function diffFiles(value: string, files: ReturnType<typeof changedFiles>, root: string) {
  const blocks = value.split(/^diff --git /m).slice(1)
  return files.map((file) => {
    const relative = path.relative(root, file.path).replaceAll(path.sep, "/")
    const block = blocks.find((item) => item.includes(` b/${relative}`)) ?? ""
    const diff = (block ? `diff --git ${block}` : "").slice(0, MAX_REMOTE_REVIEW_DIFF_BYTES)
    const additions = diff.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++" )).length
    const deletions = diff.split("\n").filter((line) => line.startsWith("-") && !line.startsWith("---" )).length
    return { ...file, additions, deletions, diff }
  })
}

function emptyReview(): RemoteReview {
  return { files: [], tests: [], screenshots: [], comments: [] }
}

export function collectRemoteAgentReview(directory: string, process: AppProcess.Interface) {
  const run = (args: string[]) =>
    process.run(
      ChildProcess.make("git", ["-C", directory, ...args], {
        cwd: directory,
        extendEnv: true,
        stdin: "ignore",
      }),
      { timeout: "10 seconds", maxOutputBytes: MAX_REMOTE_REVIEW_DIFF_BYTES, maxErrorBytes: 4096 },
    ).pipe(Effect.option)
  return Effect.gen(function* () {
    const root = yield* run(["rev-parse", "--is-inside-work-tree"])
    if (root._tag !== "Some" || root.value.exitCode !== 0 || root.value.stdout.toString("utf8").trim() !== "true") {
      return emptyReview()
    }
    const status = yield* run(["status", "--short"])
    const diff = yield* run(["diff", "--no-ext-diff", "--unified=40"])
    const check = yield* run(["diff", "--check"])
    const files = status.pipe((value) => value._tag === "Some" ? changedFiles(value.value.stdout.toString("utf8"), directory) : [])
    const diffText = diff.pipe((value) => value._tag === "Some" ? value.value.stdout.toString("utf8") : "")
    const checked = check._tag === "Some"
    return {
      files: diffFiles(diffText, files, directory).slice(0, MAX_REMOTE_REVIEW_FILES),
      tests: checked
        ? [{
            name: "git diff --check",
            status: check.value.exitCode === 0 ? ("passed" as const) : ("failed" as const),
            output: boundedOutput(`${check.value.stdout.toString("utf8")}${check.value.stderr.toString("utf8")}`),
          }]
        : [],
      screenshots: [],
      comments: [],
    } satisfies RemoteReview
  })
}

function locationLayer<K, E, R>(
  locations: { readonly get: (key: Location.Ref) => Layer.Layer<K, E, R> },
  root: string,
) {
  return locations.get(Location.Ref.make({ directory: AbsolutePath.make(root) }))
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const locations = yield* LocationServiceMap
    const jobs = new Map<string, Job>()
    const context = yield* Effect.context<unknown>()
    const runFork = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      Effect.runFork(effect.pipe(Effect.provide(context)))

    const create = (input: {
      readonly root: string
      readonly directory: string
      readonly agent: Agent
      readonly prompt: string
      readonly config?: Config
    }) => {
      const selected = command(input.agent, input.prompt, input.config)
      return Effect.provide(
        Pty.Service.use((service) => service.create({
          command: selected.executable,
          args: selected.args,
          cwd: input.directory,
          title: `${input.agent} remote job`,
          env: environment(),
        })),
        locationLayer(locations, input.root),
      )
    }

    const terminate = (job: Job) => {
      return Effect.provide(
        Pty.Service.use((service) => service.remove(job.ptyID)).pipe(Effect.catch(() => Effect.void)),
        locationLayer(locations, job.root),
      )
    }

    const run = (job: Job) =>
      Effect.provide(
        Effect.gen(function* () {
          statusData(job, "job.running", { progress: 0 })
          const pty = yield* Pty.Service
          const events = yield* EventV2.Service
          const process = yield* AppProcess.Service
          const exited = yield* Deferred.make<{ id: Pty.Info["id"]; exitCode: number }>()
          job.stop = () => Deferred.succeed(exited, { id: job.ptyID, exitCode: 143 })
          const unsubscribe = yield* events.listen((event) => {
            if (event.type !== Pty.Event.Exited.type) return Effect.void
            const value = event.data as { id?: Pty.Info["id"]; exitCode?: number }
            if (value.id !== job.ptyID || typeof value.exitCode !== "number") return Effect.void
            job.exitCode = value.exitCode
            return Deferred.succeed(exited, { id: value.id, exitCode: value.exitCode })
          })
          yield* Effect.addFinalizer(() => unsubscribe)
          statusData(job, "job.progress", { message: "Connecting to remote agent process" })
          const info = yield* pty.get(job.ptyID)
          const socket = {
            readyState: 1,
            send: (value: string | Uint8Array | ArrayBuffer) => {
              const chunk = typeof value === "string"
                ? value
                : new TextDecoder().decode(value instanceof ArrayBuffer ? new Uint8Array(value) : value)
              if (!chunk || chunk.charCodeAt(0) === 0) return
              let next = `${job.pending}${strip(chunk)}`
              const lines = next.split(/\r?\n/)
              job.pending = lines.pop() ?? ""
              for (const line of lines) {
                const parsed = structured(line.trim())
                if (parsed) statusData(job, parsed.type, parsed.data)
                else if (line) statusData(job, "job.output", { output: line + "\n" })
              }
              if (job.pending.length > 16 * 1024) {
                statusData(job, "job.output", { output: job.pending.slice(0, 16 * 1024) })
                job.pending = job.pending.slice(16 * 1024)
              }
            },
            close: () => {
              runFork(Deferred.succeed(exited, { id: job.ptyID, exitCode: job.exitCode ?? 0 }))
            },
          }
          const connection = yield* pty.connect(info.id, socket, -1)
          if (!connection) return yield* Effect.fail(new Error("remote job PTY connection failed"))
          job.write = connection.onMessage as (value: string) => void
          job.input.splice(0).forEach((value) => job.write?.(value))
          statusData(job, "job.progress", { sessionID: info.id, commandPreview: preview(job.state.agent, job.state.directory, job.prompt, job.config) })
          const poll = Effect.gen(function* () {
            while (true) {
              const current = yield* pty.get(info.id).pipe(Effect.option)
              if (current._tag === "None") return { id: info.id, exitCode: job.exitCode ?? 0 }
              yield* Effect.sleep("50 millis")
            }
          })
          const exit = yield* Effect.raceFirst(Deferred.await(exited), poll)
          connection.onClose()
          if (job.pending) {
            const parsed = structured(job.pending.trim())
            if (parsed) statusData(job, parsed.type, parsed.data)
            else statusData(job, "job.output", { output: job.pending })
            job.pending = ""
          }
          if (job.state.status === "stopped") return
          const collected = yield* collectRemoteAgentReview(job.state.directory, process)
          const reviewValue = mergeReview(job.state.review, collected)
          statusData(job, exit.exitCode === 0 ? "job.completed" : "job.failed", {
            ...(exit.exitCode === 0 ? {} : { error: `Remote agent exited with code ${exit.exitCode}` }),
            review: reviewValue,
          })
        }),
        locationLayer(locations, job.root),
      ).pipe(
        Effect.catch((error) => {
          if (job.state.status === "stopped") return Effect.void
          const message = error instanceof Error ? error.message : "Remote agent job failed"
          statusData(job, "job.failed", { error: message })
          return Effect.void
        }),
      )

    const start: Interface["start"] = (input) =>
      Effect.gen(function* () {
        const existing = jobs.get(input.id)
        if (existing) return existing.state
        const info = yield* create(input)
        const job: Job = {
          state: {
            id: input.id,
            workspaceID: input.workspaceID,
            directory: input.directory,
            agent: input.agent,
            status: "queued",
            sessionID: info.id,
            commandPreview: preview(input.agent, input.directory, input.prompt, input.config),
            updatedAt: Date.now(),
          },
          root: input.root,
          prompt: input.prompt,
          config: input.config,
          ptyID: info.id,
          sequence: 0,
          events: [],
          listeners: new Set(),
          input: [],
          pending: "",
        }
        jobs.set(job.state.id, job)
        statusData(job, "job.queued", { commandPreview: job.state.commandPreview })
        runFork(run(job))
        return job.state
      })

    const stream: Interface["stream"] = (input) =>
      Effect.gen(function* () {
        const job = jobs.get(input.jobID)
        if (!job) return yield* Effect.fail(new RemoteAgentJobNotFoundError(input.jobID))
        const queue = yield* Queue.unbounded<Event>()
        const cursor = input.cursor && /^\d+$/.test(input.cursor) ? Number(input.cursor) : 0
        job.events.filter((event) => Number(event.cursor) > cursor).forEach((event) => Queue.offerUnsafe(queue, event))
        job.listeners.add(queue)
        yield* Effect.addFinalizer(() => Effect.sync(() => job.listeners.delete(queue)))
        return Stream.fromQueue(queue)
      })

    const action: Interface["action"] = (input) =>
      Effect.gen(function* () {
        const job = jobs.get(input.jobID)
        if (!job) return yield* Effect.fail(new RemoteAgentJobNotFoundError(input.jobID))
        const value = input.action
        if (value.action === "comment") {
          const item = value.comment
          if (!item) return yield* Effect.fail(new Error("review comment is required"))
          const current = job.state.review ?? emptyReview()
          const comments = [...current.comments, {
            id: id("comment"),
            path: item.path,
            ...(item.line === undefined ? {} : { line: item.line }),
            body: item.body,
            createdAt: Date.now(),
          }].slice(-MAX_REMOTE_REVIEW_COMMENTS)
          statusData(job, "job.review.updated", { review: { ...current, comments } })
          return job.state
        }
        if (value.action === "retry") {
          if (!job.state.status || !["failed", "stopped", "completed"].includes(job.state.status)) return job.state
          const info = yield* create({
            root: job.root,
            directory: job.state.directory,
            agent: job.state.agent,
            prompt: job.prompt,
            config: job.config,
          })
          job.ptyID = info.id
          job.write = undefined
          job.pending = ""
          job.exitCode = undefined
          job.state = { ...job.state, status: "retrying", error: undefined, approval: undefined, question: undefined, updatedAt: Date.now() }
          statusData(job, "job.retry", { message: "Retrying remote agent job", sessionID: info.id })
          runFork(run(job))
          return job.state
        }
        if (value.action === "stop") {
          statusData(job, "job.stopped", { message: "Stopped by user" })
          yield* terminate(job)
          yield* job.stop?.() ?? Effect.void
          return job.state
        }
        const inputValue = value.action === "approve" ? "y\r" : value.action === "reject" ? "n\r" : `${value.answer ?? value.prompt ?? ""}\r`
        if (!inputValue.trim()) return yield* Effect.fail(new Error("answer or steering prompt is required"))
        if (job.write) job.write(inputValue)
        else job.input.push(inputValue)
        job.state = { ...job.state, approval: undefined, question: undefined, updatedAt: Date.now() }
        statusData(job, "job.progress", { message: value.action === "steer" ? "Steering prompt sent" : "Agent action accepted" })
        return job.state
      })

    yield* Effect.addFinalizer(() => Effect.sync(() => jobs.clear()))
    return Service.of({ start, stream, action })
  }),
)
