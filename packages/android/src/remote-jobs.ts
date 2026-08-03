import type { RemoteAgent } from "./remote-workspace-state"

export const REMOTE_JOB_STATUSES = [
  "queued",
  "running",
  "waiting_approval",
  "waiting_question",
  "retrying",
  "completed",
  "failed",
  "stopped",
  "revoked",
  "expired",
] as const

export type RemoteJobStatus = (typeof REMOTE_JOB_STATUSES)[number]

export type RemoteCommandPreview = {
  executable: string
  args: string[]
  cwd: string
}

export type RemoteApproval = {
  id?: string
  revision?: number
  title: string
  command?: string
  cwd?: string
  reason?: string
  risk?: "low" | "medium" | "high"
}

export type RemoteQuestion = {
  id?: string
  revision?: number
  prompt: string
  options?: string[]
  allowFreeform?: boolean
}

export type RemoteReviewFile = {
  path: string
  status: "added" | "modified" | "deleted" | "renamed" | "untracked"
  additions: number
  deletions: number
  diff: string
}

export type RemoteReviewTest = {
  name: string
  status: "passed" | "failed" | "skipped"
  durationMs?: number
  output?: string
}

export type RemoteReviewScreenshot = {
  name: string
  mime: string
  data: string
}

export type RemoteReviewComment = {
  id: string
  path: string
  line?: number
  body: string
  createdAt: number
}

export type RemoteReview = {
  files: RemoteReviewFile[]
  tests: RemoteReviewTest[]
  screenshots: RemoteReviewScreenshot[]
  comments: RemoteReviewComment[]
}

export type RemoteJob = {
  id: string
  sessionID?: string
  serverUrl: string
  workspaceID: string
  directory: string
  agent: Exclude<RemoteAgent, "local-slopcode">
  status: RemoteJobStatus
  cursor?: string
  output?: string
  error?: string
  progress?: number
  commandPreview?: RemoteCommandPreview
  approval?: RemoteApproval
  question?: RemoteQuestion
  review?: RemoteReview
  seen?: string[]
  updatedAt: number
}

export type RemoteJobStartInput = {
  serverUrl: string
  username?: string
  password: string
  workspaceID: string
  directory: string
  agent: Exclude<RemoteAgent, "local-slopcode">
  prompt: string
  config?: Record<string, string>
}

export type RemoteJobAction = "approve" | "reject" | "answer" | "steer" | "comment" | "stop" | "retry"

export type RemoteJobActionPayload = {
  answer?: string
  prompt?: string
  comment?: {
    path: string
    line?: number
    body: string
  }
}

export type RemoteJobEvent = {
  id?: string
  cursor?: string
  jobID: string
  type: string
  data: {
    output?: string
    error?: string
    progress?: number
    commandPreview?: RemoteCommandPreview
    approval?: RemoteApproval
    question?: RemoteQuestion
    review?: RemoteReview
    sessionID?: string
    message?: string
  }
}

export type RemoteJobMessage = {
  event: RemoteJobEvent
  job?: RemoteJob
}

export type RemoteSessionDeepLink = {
  jobID: string
  sessionID?: string
}

export type AndroidRemoteJobs = {
  list(): Promise<RemoteJob[]>
  start(input: RemoteJobStartInput): Promise<RemoteJob>
  action(jobID: string, action: RemoteJobAction, payload?: RemoteJobActionPayload): Promise<RemoteJob | undefined>
  subscribe(listener: (message: RemoteJobMessage) => void): () => void
}

const MAX_ID_LENGTH = 256
const MAX_OUTPUT_LENGTH = 64 * 1024
const MAX_ERROR_LENGTH = 2 * 1024
const MAX_MESSAGE_LENGTH = 512
const MAX_REVIEW_DIFF_LENGTH = 64 * 1024
const MAX_REVIEW_FILES = 64
const MAX_REVIEW_TESTS = 64
const MAX_REVIEW_SCREENSHOTS = 16
const MAX_REVIEW_COMMENTS = 128
const MAX_SEEN_EVENTS = 64

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function text(value: unknown, max: number) {
  if (typeof value !== "string" || value.length === 0 || value.length > max || /[\u0000\r\n]/.test(value)) return
  return value
}

function body(value: unknown, max: number) {
  if (typeof value !== "string" || value.length === 0 || value.length > max || /\u0000/.test(value)) return
  return value
}

function reviewText(value: unknown, max: number) {
  if (typeof value !== "string" || value.length > max || /\u0000/.test(value)) return
  return value
}

function reviewPath(value: unknown) {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_096 || /[\u0000\r\n?#]/.test(value)) return
  return value
}

export function parseRemoteCommandPreview(value: unknown): RemoteCommandPreview | undefined {
  if (!record(value)) return
  const executable = text(value.executable, 256)
  const cwd = directory(value.cwd)
  if (!executable || !cwd || !Array.isArray(value.args) || value.args.length > 64) return
  const args = value.args.flatMap((item) => {
    const next = text(item, 512)
    return next ? [next] : []
  })
  if (args.length !== value.args.length) return
  return { executable, args, cwd }
}

export function parseRemoteApproval(value: unknown): RemoteApproval | undefined {
  if (typeof value === "string")
    return value.length > 0 && value.length <= MAX_MESSAGE_LENGTH ? { title: value } : undefined
  if (!record(value)) return
  const title = text(value.title, MAX_MESSAGE_LENGTH)
  if (!title) return
  const result: RemoteApproval = { title }
  for (const key of ["id", "command", "reason"] as const) {
    if (value[key] === undefined) continue
    const next = text(value[key], key === "id" ? MAX_ID_LENGTH : MAX_MESSAGE_LENGTH)
    if (!next) return
    result[key] = next
  }
  if (value.revision !== undefined) {
    if (typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 1) return
    result.revision = value.revision
  }
  if (value.cwd !== undefined) {
    const cwd = directory(value.cwd)
    if (!cwd) return
    result.cwd = cwd
  }
  if (value.risk !== undefined) {
    if (value.risk !== "low" && value.risk !== "medium" && value.risk !== "high") return
    result.risk = value.risk
  }
  return result
}

export function parseRemoteQuestion(value: unknown): RemoteQuestion | undefined {
  if (!record(value)) return
  const prompt = text(value.prompt, MAX_MESSAGE_LENGTH)
  if (!prompt) return
  const result: RemoteQuestion = { prompt }
  if (value.id !== undefined) {
    const id = text(value.id, MAX_ID_LENGTH)
    if (!id) return
    result.id = id
  }
  if (value.revision !== undefined) {
    if (typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 1) return
    result.revision = value.revision
  }
  if (value.options !== undefined) {
    if (!Array.isArray(value.options) || value.options.length > 32) return
    const options = value.options.flatMap((item) => {
      const next = text(item, MAX_MESSAGE_LENGTH)
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

export function parseRemoteReview(value: unknown): RemoteReview | undefined {
  if (!record(value)) return
  const files = Array.isArray(value.files)
    ? value.files
        .flatMap((item) => {
          if (!record(item)) return []
          const path = reviewPath(item.path)
          const diff = reviewText(item.diff, MAX_REVIEW_DIFF_LENGTH)
          const status = item.status
          if (
            !path ||
            diff === undefined ||
            !["added", "modified", "deleted", "renamed", "untracked"].includes(status as string)
          )
            return []
          return [
            {
              path,
              status: status as RemoteReviewFile["status"],
              additions:
                typeof item.additions === "number" && Number.isSafeInteger(item.additions)
                  ? Math.max(0, item.additions)
                  : 0,
              deletions:
                typeof item.deletions === "number" && Number.isSafeInteger(item.deletions)
                  ? Math.max(0, item.deletions)
                  : 0,
              diff,
            },
          ]
        })
        .slice(0, MAX_REVIEW_FILES)
    : []
  const tests = Array.isArray(value.tests)
    ? value.tests
        .flatMap((item) => {
          if (!record(item)) return []
          const name = text(item.name, MAX_MESSAGE_LENGTH)
          const status = item.status
          if (!name || !["passed", "failed", "skipped"].includes(status as string)) return []
          const output = item.output === undefined ? undefined : body(item.output, MAX_REVIEW_DIFF_LENGTH)
          if (item.output !== undefined && output === undefined) return []
          return [
            {
              name,
              status: status as RemoteReviewTest["status"],
              ...(typeof item.durationMs === "number" && Number.isSafeInteger(item.durationMs)
                ? { durationMs: Math.max(0, item.durationMs) }
                : {}),
              ...(output ? { output } : {}),
            },
          ]
        })
        .slice(0, MAX_REVIEW_TESTS)
    : []
  const screenshots = Array.isArray(value.screenshots)
    ? value.screenshots
        .flatMap((item) => {
          if (!record(item)) return []
          const name = text(item.name, MAX_MESSAGE_LENGTH)
          const mime = text(item.mime, 128)
          const data = text(item.data, 512 * 1024)
          if (!name || !mime?.startsWith("image/") || !data?.startsWith("data:image/")) return []
          return [{ name, mime, data }]
        })
        .slice(0, MAX_REVIEW_SCREENSHOTS)
    : []
  const comments = Array.isArray(value.comments)
    ? value.comments
        .flatMap((item) => {
          if (!record(item)) return []
          const id = text(item.id, MAX_ID_LENGTH)
          const path = reviewPath(item.path)
          const bodyValue = body(item.body, MAX_MESSAGE_LENGTH)
          if (!id || !path || !bodyValue || typeof item.createdAt !== "number" || !Number.isSafeInteger(item.createdAt))
            return []
          return [
            {
              id,
              path,
              ...(typeof item.line === "number" && Number.isSafeInteger(item.line)
                ? { line: Math.max(1, item.line) }
                : {}),
              body: bodyValue,
              createdAt: item.createdAt,
            },
          ]
        })
        .slice(0, MAX_REVIEW_COMMENTS)
    : []
  return { files, tests, screenshots, comments }
}

function status(value: unknown): RemoteJobStatus | undefined {
  return REMOTE_JOB_STATUSES.includes(value as RemoteJobStatus) ? (value as RemoteJobStatus) : undefined
}

function agent(value: unknown): RemoteJob["agent"] | undefined {
  if (value === "codex-cli" || value === "opencode-cli" || value === "claude-code") return value
}

function directory(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 4_096) return
  if (value.includes("\\") || value.includes("//") || /[\u0000-\u001f\u007f\r\n?#]/.test(value)) return
  if (value.split("/").some((part) => part === "." || part === "..")) return
  return value
}

function url(value: unknown) {
  if (typeof value !== "string" || value.length > 2_048) return
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) return
    return parsed.toString().replace(/\/+$/, "")
  } catch {
    return
  }
}

function config(value: unknown) {
  if (value === undefined) return
  if (!record(value)) return
  const next: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (!(key === "model" || key === "profile") || typeof item !== "string" || item.length > 128) return
    next[key] = item
  }
  return next
}

function eventHistory(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_SEEN_EVENTS) return
  const values = value.flatMap((item) => {
    const next = text(item, MAX_ID_LENGTH)
    return next ? [next] : []
  })
  if (values.length !== value.length) return
  return [...new Set(values)].slice(-MAX_SEEN_EVENTS)
}

export function parseRemoteJob(value: unknown): RemoteJob | undefined {
  if (!record(value)) return
  const id = text(value.id ?? value.jobID, MAX_ID_LENGTH)
  const serverUrl = url(value.serverUrl)
  const workspaceID = text(value.workspaceID, MAX_ID_LENGTH)
  const remoteDirectory = directory(value.directory)
  const selectedAgent = agent(value.agent)
  const selectedStatus = status(value.status)
  const updatedAt = value.updatedAt
  if (
    !id ||
    !serverUrl ||
    !workspaceID ||
    !remoteDirectory ||
    !selectedAgent ||
    !selectedStatus ||
    typeof updatedAt !== "number" ||
    !Number.isSafeInteger(updatedAt)
  )
    return
  const sessionID = value.sessionID === undefined ? undefined : text(value.sessionID, MAX_ID_LENGTH)
  const cursor = value.cursor === undefined ? undefined : text(value.cursor, MAX_ID_LENGTH)
  const output = value.output === undefined ? undefined : body(value.output, MAX_OUTPUT_LENGTH)
  const error = value.error === undefined ? undefined : text(value.error, MAX_ERROR_LENGTH)
  const approvalValue = value.approval === undefined ? undefined : parseRemoteApproval(value.approval)
  const commandPreview =
    value.commandPreview === undefined ? undefined : parseRemoteCommandPreview(value.commandPreview)
  const questionValue = value.question === undefined ? undefined : parseRemoteQuestion(value.question)
  const reviewValue = value.review === undefined ? undefined : parseRemoteReview(value.review)
  const seen = value.seen === undefined ? undefined : eventHistory(value.seen)
  const progress = value.progress
  if (
    (value.sessionID !== undefined && !sessionID) ||
    (value.cursor !== undefined && !cursor) ||
    (value.output !== undefined && output === undefined) ||
    (value.error !== undefined && error === undefined) ||
    (value.approval !== undefined && approvalValue === undefined) ||
    (value.commandPreview !== undefined && commandPreview === undefined) ||
    (value.question !== undefined && questionValue === undefined) ||
    (value.review !== undefined && reviewValue === undefined) ||
    (value.seen !== undefined && seen === undefined) ||
    (progress !== undefined && (typeof progress !== "number" || progress < 0 || progress > 1))
  )
    return
  return {
    id,
    ...(sessionID ? { sessionID } : {}),
    serverUrl,
    workspaceID,
    directory: remoteDirectory,
    agent: selectedAgent,
    status: selectedStatus,
    ...(cursor ? { cursor } : {}),
    ...(output ? { output } : {}),
    ...(error ? { error } : {}),
    ...(progress === undefined ? {} : { progress }),
    ...(commandPreview ? { commandPreview } : {}),
    ...(approvalValue ? { approval: approvalValue } : {}),
    ...(questionValue ? { question: questionValue } : {}),
    ...(reviewValue ? { review: reviewValue } : {}),
    ...(seen?.length ? { seen } : {}),
    updatedAt,
  }
}

function eventData(value: unknown): RemoteJobEvent["data"] | undefined {
  if (!record(value)) return
  const output = value.output === undefined ? undefined : body(value.output, MAX_OUTPUT_LENGTH)
  const error = value.error === undefined ? undefined : text(value.error, MAX_ERROR_LENGTH)
  const approvalValue = value.approval === undefined ? undefined : parseRemoteApproval(value.approval)
  const message = value.message === undefined ? undefined : text(value.message, MAX_MESSAGE_LENGTH)
  const sessionID = value.sessionID === undefined ? undefined : text(value.sessionID, MAX_ID_LENGTH)
  const progress = value.progress
  if (
    (value.output !== undefined && output === undefined) ||
    (value.error !== undefined && error === undefined) ||
    (value.approval !== undefined && approvalValue === undefined) ||
    (value.message !== undefined && message === undefined) ||
    (value.sessionID !== undefined && sessionID === undefined) ||
    (progress !== undefined && (typeof progress !== "number" || progress < 0 || progress > 1))
  )
    return
  const commandPreview =
    value.commandPreview === undefined ? undefined : parseRemoteCommandPreview(value.commandPreview)
  const questionValue = value.question === undefined ? undefined : parseRemoteQuestion(value.question)
  const reviewValue = value.review === undefined ? undefined : parseRemoteReview(value.review)
  if (
    (value.commandPreview !== undefined && !commandPreview) ||
    (value.question !== undefined && !questionValue) ||
    (value.review !== undefined && !reviewValue)
  )
    return
  return {
    output,
    error,
    approval: approvalValue,
    message,
    sessionID,
    ...(progress === undefined ? {} : { progress }),
    ...(commandPreview ? { commandPreview } : {}),
    ...(questionValue ? { question: questionValue } : {}),
    ...(reviewValue ? { review: reviewValue } : {}),
  }
}

export function parseRemoteJobEvent(value: unknown): RemoteJobEvent | undefined {
  if (!record(value)) return
  const jobID = text(value.jobID ?? value.jobId, MAX_ID_LENGTH)
  const type = text(value.type ?? value.event, MAX_MESSAGE_LENGTH)
  const data = eventData(value.data ?? value)
  if (!jobID || !type || !data) return
  const id = value.id === undefined ? undefined : text(value.id, MAX_ID_LENGTH)
  const cursor = value.cursor === undefined ? undefined : text(value.cursor, MAX_ID_LENGTH)
  if (value.id !== undefined && !id) return
  if (value.cursor !== undefined && !cursor) return
  return { ...(id ? { id } : {}), ...(cursor ? { cursor } : {}), jobID, type, data }
}

export function parseRemoteJobMessage(value: unknown, nonce: string, channel = "slopcode.android.remote-jobs") {
  if (!record(value) || value.type !== "slopcode.remote-job" || value.channel !== channel || value.nonce !== nonce)
    return
  const event = parseRemoteJobEvent(value.event)
  if (!event) return
  const job = value.job === undefined ? undefined : parseRemoteJob(value.job)
  if (value.job !== undefined && !job) return
  return { event, ...(job ? { job } : {}) }
}

function terminal(type: string) {
  if (type.endsWith("completed")) return "completed" as const
  if (type.endsWith("failed")) return "failed" as const
  if (type.endsWith("stopped") || type.endsWith("stop")) return "stopped" as const
  if (type.endsWith("revoked")) return "revoked" as const
  if (type.endsWith("expired")) return "expired" as const
  if (type.endsWith("retry") || type.endsWith("retried")) return "retrying" as const
}

export function remoteJobStatusTerminal(value: RemoteJobStatus) {
  return (
    value === "completed" || value === "failed" || value === "stopped" || value === "revoked" || value === "expired"
  )
}

export function applyRemoteJobEvent(current: RemoteJob, event: RemoteJobEvent): RemoteJob {
  if (event.jobID !== current.id) return current
  const seen = [event.id, event.cursor].flatMap((value) => (value ? [value] : []))
  if (seen.some((value) => value === current.cursor || current.seen?.includes(value))) return current
  const reviewEvent = event.type.endsWith("review.updated") || event.type.endsWith("comment")
  const retryEvent = event.type.endsWith("retry") || event.type.endsWith("retried")
  if (remoteJobStatusTerminal(current.status) && !reviewEvent && !retryEvent) return current
  const done = terminal(event.type)
  const approval =
    event.type.endsWith("approval") ||
    event.type.endsWith("approval_required") ||
    event.type.endsWith("waiting_approval")
  const nextStatus =
    done ??
    (approval
      ? "waiting_approval"
      : event.type.endsWith("question")
        ? "waiting_question"
        : reviewEvent
          ? current.status
          : "running")
  const output =
    event.data.output === undefined
      ? current.output
      : `${current.output ?? ""}${event.data.output}`.slice(-MAX_OUTPUT_LENGTH)
  const error =
    event.data.error ?? (done && remoteJobStatusTerminal(done) ? event.data.message : undefined) ?? current.error
  return {
    ...current,
    status: nextStatus,
    ...(event.id || event.cursor ? { cursor: event.cursor ?? event.id } : {}),
    ...(event.data.sessionID ? { sessionID: event.data.sessionID } : {}),
    ...(output ? { output } : {}),
    ...(error ? { error } : {}),
    ...(event.data.commandPreview ? { commandPreview: event.data.commandPreview } : {}),
    ...(event.data.approval ? { approval: event.data.approval } : {}),
    ...(event.data.question ? { question: event.data.question } : {}),
    ...(event.data.review ? { review: event.data.review } : {}),
    ...(event.data.progress === undefined ? {} : { progress: event.data.progress }),
    ...(seen.length
      ? {
          seen: [...(current.seen ?? []), ...seen]
            .filter((value, index, values) => values.indexOf(value) === index)
            .slice(-MAX_SEEN_EVENTS),
        }
      : {}),
    updatedAt: Date.now(),
  }
}

export function remoteJobDeepLink(job: Pick<RemoteJob, "id" | "sessionID">) {
  const query = new URLSearchParams({ job: job.id })
  if (job.sessionID) query.set("session", job.sessionID)
  return `slopcode://remote-session?${query.toString()}`
}

export function parseRemoteSessionDeepLink(value: string): RemoteSessionDeepLink | undefined {
  try {
    const url = new URL(value)
    const jobs = url.searchParams.getAll("job")
    const sessions = url.searchParams.getAll("session")
    if (
      url.protocol !== "slopcode:" ||
      url.hostname !== "remote-session" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      (url.pathname !== "" && url.pathname !== "/") ||
      jobs.length !== 1 ||
      !/^(?:job|pty|ses)_[A-Za-z0-9._:-]+$/.test(jobs[0] ?? "") ||
      sessions.length > 1 ||
      (sessions.length === 1 && !/^(?:ses|pty)_[A-Za-z0-9._:-]+$/.test(sessions[0] ?? ""))
    )
      return
    for (const key of url.searchParams.keys()) if (key !== "job" && key !== "session") return
    return { jobID: jobs[0]!, ...(sessions[0] ? { sessionID: sessions[0] } : {}) }
  } catch {
    return
  }
}

export function remoteJobStatusLabel(value: RemoteJobStatus) {
  return value.replaceAll("_", " ")
}

export function remoteJobResultStatus(value: RemoteJobStatus) {
  if (value === "completed") return "completed" as const
  if (value === "failed" || value === "revoked" || value === "expired") return "failed" as const
  return "timed_out" as const
}

export function remoteJobAction(value: unknown): RemoteJobAction | undefined {
  if (
    value === "approve" ||
    value === "reject" ||
    value === "answer" ||
    value === "steer" ||
    value === "comment" ||
    value === "stop" ||
    value === "retry"
  )
    return value
}

export function parseRemoteJobList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = parseRemoteJob(item)
    return parsed ? [parsed] : []
  })
}

export function parseRemoteJobAction(value: unknown) {
  if (value === null || value === undefined) return
  return parseRemoteJob(value)
}

export function encodeRemoteJobStart(input: RemoteJobStartInput) {
  return JSON.stringify(input)
}
