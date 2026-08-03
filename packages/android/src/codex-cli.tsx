import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { bakedRemoteCommandCatalog, fetchRemoteAgentCatalog } from "./remote-commands"
import { normalizeHttpsUrl, type RemoteAgent } from "./remote-workspace-state"
import type { RemoteCommandCatalog } from "./remote-workspace-state"
import {
  remoteJobResultStatus,
  remoteJobStatusLabel,
  parseRemoteCommandPreview,
  parseRemoteReview,
  type AndroidRemoteJobs,
  type RemoteJob,
  type RemoteJobAction,
  type RemoteJobActionPayload,
  type RemoteReview,
} from "./remote-jobs"

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>

const MAX_PROMPT_LENGTH = 32 * 1024
const MAX_RESPONSE_BYTES = 128 * 1024
const MAX_OUTPUT_LENGTH = 64 * 1024
const MAX_CONFIG_VALUE_LENGTH = 128
const REQUEST_TIMEOUT_MS = 60_000
const MAX_TERMINAL_OUTPUT_LENGTH = 128 * 1024
const statuses = ["completed", "failed", "timed_out"] as const
const sandboxes = ["read-only", "workspace-write", "danger-full-access"] as const
const approvals = ["untrusted", "on-failure", "on-request", "never"] as const
const permissionModes = ["acceptEdits", "auto", "bypassPermissions", "manual", "dontAsk", "plan"] as const

export type RemoteAgentStatus = (typeof statuses)[number]
export type RemoteCliAgent = Exclude<RemoteAgent, "local-slopcode">
export type RemoteAgentConfig = {
  model?: string
  profile?: string
  sandbox?: (typeof sandboxes)[number]
  approval?: (typeof approvals)[number]
  permissionMode?: (typeof permissionModes)[number]
}
export type RemoteAgentResult = {
  output: string
  status: RemoteAgentStatus
  exitCode?: number
  commandPreview?: RemoteJob["commandPreview"]
  review?: RemoteReview
}
export type CodexCliStatus = RemoteAgentStatus
export type CodexCliResult = RemoteAgentResult

export type RemoteAgentTerminalSession = {
  ptyID: string
  directory: string
  ticket: string
  expiresIn: number
}

export type RemoteAgentPromptInput = {
  agent: RemoteCliAgent
  serverUrl: string
  username?: string
  password: string
  workspaceID: string
  directory: string
  prompt: string
  config?: RemoteAgentConfig
}

export type CodexCliPromptInput = Omit<RemoteAgentPromptInput, "agent">
export type OpencodeCliPromptInput = CodexCliPromptInput
export type ClaudeCodePromptInput = CodexCliPromptInput

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function text(value: unknown, limit: number) {
  if (typeof value !== "string" || value.length > limit || /\u0000/.test(value)) return
  return value
}

function directory(value: unknown) {
  const next = text(value, 4_096)
  if (
    !next ||
    !next.startsWith("/") ||
    (next !== "/" && next.endsWith("/")) ||
    next.includes("\\") ||
    next.includes("//") ||
    /[\u0000-\u001f\u007f\r\n?#]/.test(next)
  )
    return
  if (next.split("/").some((part) => part === "." || part === "..")) return
  return next
}

function workspaceID(value: unknown) {
  const next = text(value, 256)
  if (!next || !/^wrk[a-zA-Z0-9._:-]+$/.test(next)) return
  return next
}

function agent(value: unknown): RemoteCliAgent | undefined {
  if (value === "codex-cli" || value === "opencode-cli" || value === "claude-code") return value
}

function authorization(username: unknown, password: unknown) {
  const user = typeof username === "string" ? username.trim() || "slopcode" : "slopcode"
  if (
    typeof password !== "string" ||
    !password ||
    user.length > 512 ||
    password.length > 512 ||
    /[\u0000\r\n]/.test(user + password)
  ) {
    throw new Error("Desktop authentication is required for the remote agent.")
  }
  try {
    return `Basic ${btoa(`${user}:${password}`)}`
  } catch {
    throw new Error("Desktop credentials must use a supported encoding.")
  }
}

function config(value: unknown) {
  if (!isRecord(value)) return
  if (Object.keys(value).some((key) => !["model", "profile", "sandbox", "approval", "permissionMode"].includes(key)))
    return
  const next: RemoteAgentConfig = {}
  for (const key of ["model", "profile"] as const) {
    if (value[key] === undefined) continue
    if (
      typeof value[key] !== "string" ||
      value[key].length < 1 ||
      value[key].length > MAX_CONFIG_VALUE_LENGTH ||
      !/^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/.test(value[key])
    )
      return
    next[key] = value[key]
  }
  if (value.sandbox !== undefined) {
    if (!sandboxes.includes(value.sandbox as (typeof sandboxes)[number])) return
    next.sandbox = value.sandbox as RemoteAgentConfig["sandbox"]
  }
  if (value.approval !== undefined) {
    if (!approvals.includes(value.approval as (typeof approvals)[number])) return
    next.approval = value.approval as RemoteAgentConfig["approval"]
  }
  if (value.permissionMode !== undefined) {
    if (!permissionModes.includes(value.permissionMode as (typeof permissionModes)[number])) return
    next.permissionMode = value.permissionMode as RemoteAgentConfig["permissionMode"]
  }
  return next
}

async function json(response: Response) {
  const length = Number(response.headers.get("content-length"))
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES)
    throw new Error("Remote agent response exceeded the Android limit.")
  if (!response.body) return
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > MAX_RESPONSE_BYTES) {
        void reader.cancel()
        throw new Error("Remote agent response exceeded the Android limit.")
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  })
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    return
  }
}

function detail(value: unknown) {
  if (!isRecord(value)) return
  const message = value.message
  if (typeof message === "string" && message.length <= 512) return message
}

function connection(input: Omit<RemoteAgentPromptInput, "prompt">) {
  const serverUrl = normalizeHttpsUrl(input.serverUrl)
  const workspace = workspaceID(input.workspaceID)
  const remoteDirectory = directory(input.directory)
  const selectedAgent = agent(input.agent)
  const parsedConfig = input.config === undefined ? undefined : config(input.config)
  if (!serverUrl) throw new Error("Remote agent requires an exact HTTPS desktop or relay URL.")
  if (!workspace || !remoteDirectory || !selectedAgent)
    throw new Error("Remote agent requires a workspace, folder, and agent.")
  if (input.config !== undefined && !parsedConfig) throw new Error("Remote agent configuration is invalid.")
  if (
    selectedAgent === "opencode-cli" &&
    (parsedConfig?.sandbox !== undefined ||
      parsedConfig?.approval !== undefined ||
      parsedConfig?.permissionMode !== undefined)
  ) {
    throw new Error("OpenCode configuration supports only model and profile.")
  }
  if (
    selectedAgent === "claude-code" &&
    (parsedConfig?.profile !== undefined || parsedConfig?.sandbox !== undefined || parsedConfig?.approval !== undefined)
  ) {
    throw new Error("Claude Code configuration supports only model and permission mode.")
  }
  if (selectedAgent === "codex-cli" && parsedConfig?.permissionMode !== undefined) {
    throw new Error("Codex configuration does not support Claude Code permission mode.")
  }
  return { serverUrl, workspace, remoteDirectory, selectedAgent, parsedConfig }
}

function terminalSession(value: unknown): RemoteAgentTerminalSession | undefined {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !["ptyID", "directory", "ticket", "expires_in"].includes(key))
  )
    return
  const ptyID = text(value.ptyID, 256)
  const remoteDirectory = directory(value.directory)
  const ticket = text(value.ticket, 512)
  const expiresIn = value.expires_in
  if (
    !ptyID ||
    !/^pty_[A-Za-z0-9._:-]+$/.test(ptyID) ||
    !remoteDirectory ||
    !ticket ||
    typeof expiresIn !== "number" ||
    !Number.isSafeInteger(expiresIn) ||
    expiresIn < 1
  )
    return
  return { ptyID, directory: remoteDirectory, ticket, expiresIn }
}

export function remoteAgentTerminalUrl(
  serverUrl: string,
  workspace: string,
  session: Pick<RemoteAgentTerminalSession, "ptyID" | "directory" | "ticket">,
  credentials?: { username?: string; password: string },
) {
  const origin = normalizeHttpsUrl(serverUrl)
  const workspaceIDValue = workspaceID(workspace)
  if (!origin || !workspaceIDValue) throw new Error("Remote agent WebSocket routing is invalid.")
  const endpoint = new URL(`${origin}/pty/${encodeURIComponent(session.ptyID)}/connect`)
  endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:"
  endpoint.searchParams.set("workspace", workspaceIDValue)
  endpoint.searchParams.set("directory", session.directory)
  endpoint.searchParams.set("cursor", "-1")
  endpoint.searchParams.set("ticket", session.ticket)
  if (credentials?.password)
    endpoint.searchParams.set("auth_token", authorization(credentials.username, credentials.password).slice(6))
  return endpoint.toString()
}

export function parseRemoteAgentCommand(value: string) {
  const match = value.trim().match(/^\/([A-Za-z0-9][A-Za-z0-9._:-]*)(?:\s+([^\r\n]*))?$/)
  if (!match) return
  return { name: match[1]!, args: match[2]?.trim() ?? "" }
}

export function parseRemoteAgentResult(value: unknown): RemoteAgentResult | undefined {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !["output", "status", "exitCode", "commandPreview", "review"].includes(key))
  )
    return
  const output = text(value.output, MAX_OUTPUT_LENGTH)
  const status = statuses.find((item) => item === value.status)
  if (output === undefined || !status) return
  if (value.exitCode !== undefined && (typeof value.exitCode !== "number" || !Number.isSafeInteger(value.exitCode)))
    return
  const commandPreview =
    value.commandPreview === undefined ? undefined : parseRemoteCommandPreview(value.commandPreview)
  const review = value.review === undefined ? undefined : parseRemoteReview(value.review)
  if ((value.commandPreview !== undefined && !commandPreview) || (value.review !== undefined && !review)) return
  return {
    output,
    status,
    ...(value.exitCode === undefined ? {} : { exitCode: value.exitCode }),
    ...(commandPreview ? { commandPreview } : {}),
    ...(review ? { review } : {}),
  }
}

export function parseCodexCliResult(value: unknown): CodexCliResult | undefined {
  return parseRemoteAgentResult(value)
}

export async function promptRemoteAgent(
  input: RemoteAgentPromptInput,
  fetcher: Fetcher = fetch,
): Promise<RemoteAgentResult> {
  const { serverUrl, workspace, remoteDirectory, selectedAgent, parsedConfig } = connection(input)
  const prompt = typeof input.prompt === "string" ? text(input.prompt.trim(), MAX_PROMPT_LENGTH) : undefined
  if (!prompt) throw new Error("Remote agent requires a workspace, folder, agent, and prompt.")

  const endpoint = new URL(`${serverUrl}/remote/agent/prompt`)
  endpoint.searchParams.set("workspace", workspace)
  endpoint.searchParams.set("path", remoteDirectory)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  let value: unknown
  try {
    response = await fetcher(endpoint.toString(), {
      method: "POST",
      headers: {
        authorization: authorization(input.username, input.password),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agent: selectedAgent,
        prompt,
        ...(parsedConfig === undefined ? {} : { config: parsedConfig }),
      }),
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    })
    value = await json(response)
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) throw new Error(detail(value) ?? `Remote agent request failed (${response.status}).`)
  const result = parseRemoteAgentResult(value)
  if (!result) throw new Error("Remote agent returned an invalid bounded response.")
  return result
}

export async function createRemoteAgentSession(
  input: Omit<RemoteAgentPromptInput, "prompt">,
  fetcher: Fetcher = fetch,
): Promise<RemoteAgentTerminalSession> {
  const { serverUrl, workspace, remoteDirectory, selectedAgent, parsedConfig } = connection(input)
  const endpoint = new URL(`${serverUrl}/remote/agent/session`)
  endpoint.searchParams.set("workspace", workspace)
  endpoint.searchParams.set("path", remoteDirectory)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  let value: unknown
  try {
    response = await fetcher(endpoint.toString(), {
      method: "POST",
      headers: {
        authorization: authorization(input.username, input.password),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agent: selectedAgent,
        ...(parsedConfig === undefined ? {} : { config: parsedConfig }),
      }),
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    })
    value = await json(response)
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) throw new Error(detail(value) ?? `Remote agent session failed (${response.status}).`)
  const result = terminalSession(value)
  if (!result) throw new Error("Remote agent returned an invalid PTY session.")
  return result
}

async function removeRemoteAgentSession(
  input: Omit<RemoteAgentPromptInput, "prompt">,
  current: Pick<RemoteAgentTerminalSession, "ptyID" | "directory">,
) {
  try {
    const { serverUrl, workspace } = connection(input)
    const endpoint = new URL(`${serverUrl}/pty/${encodeURIComponent(current.ptyID)}`)
    endpoint.searchParams.set("workspace", workspace)
    endpoint.searchParams.set("directory", current.directory)
    await fetch(endpoint.toString(), {
      method: "DELETE",
      headers: { authorization: authorization(input.username, input.password) },
      credentials: "omit",
      redirect: "error",
    })
  } catch {
    return
  }
}

export function promptCodexCli(input: CodexCliPromptInput, fetcher: Fetcher = fetch) {
  return promptRemoteAgent({ ...input, agent: "codex-cli" }, fetcher)
}

export function promptOpencodeCli(input: OpencodeCliPromptInput, fetcher: Fetcher = fetch) {
  return promptRemoteAgent({ ...input, agent: "opencode-cli" }, fetcher)
}

export function promptClaudeCode(input: ClaudeCodePromptInput, fetcher: Fetcher = fetch) {
  return promptRemoteAgent({ ...input, agent: "claude-code" }, fetcher)
}

type Props = Omit<RemoteAgentPromptInput, "prompt"> & {
  catalog?: RemoteCommandCatalog
  onCatalog?: (catalog: RemoteCommandCatalog) => void
  background?: AndroidRemoteJobs
  jobID?: string
  sessionID?: string
}

function CommandPreviewPanel(props: { value?: RemoteJob["commandPreview"] }) {
  return (
    <Show when={props.value}>
      {(value) => (
        <div class="rounded-md border border-border-weak-base p-3 flex flex-col gap-1 text-12-regular">
          <div class="text-14-medium">Command preview</div>
          <code class="whitespace-pre-wrap break-all">{[value().executable, ...value().args].join(" ")}</code>
          <span class="text-text-weak">Working folder: {value().cwd}</span>
        </div>
      )}
    </Show>
  )
}

function ReviewPanel(props: { review?: RemoteReview }) {
  return (
    <Show when={props.review}>
      {(review) => (
        <article
          class="rounded-md border border-border-weak-base p-3 flex flex-col gap-3"
          aria-label="Review artifacts"
        >
          <div class="text-14-medium">Review</div>
          <Show when={review().files.length > 0}>
            <section class="flex flex-col gap-2">
              <div class="text-12-regular text-text-weak">Files and diffs</div>
              <For each={review().files}>
                {(file) => (
                  <details class="rounded-md border border-border-weak-base p-2">
                    <summary class="cursor-pointer text-12-regular">
                      {file.path} · {file.status} · +{file.additions} / -{file.deletions}
                    </summary>
                    <pre class="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-12-regular">{file.diff}</pre>
                  </details>
                )}
              </For>
            </section>
          </Show>
          <Show when={review().tests.length > 0}>
            <section class="flex flex-col gap-1">
              <div class="text-12-regular text-text-weak">Tests</div>
              <For each={review().tests}>
                {(test) => (
                  <div class="flex items-start justify-between gap-2 text-12-regular">
                    <span>{test.name}</span>
                    <span class={test.status === "passed" ? "text-text-success-base" : "text-text-on-critical-base"}>
                      {test.status}
                    </span>
                  </div>
                )}
              </For>
            </section>
          </Show>
          <Show when={review().screenshots.length > 0}>
            <section class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <For each={review().screenshots}>
                {(screenshot) => (
                  <figure class="rounded-md border border-border-weak-base p-2">
                    <img src={screenshot.data} alt={screenshot.name} class="max-h-64 w-full object-contain" />
                    <figcaption class="text-12-regular text-text-weak">{screenshot.name}</figcaption>
                  </figure>
                )}
              </For>
            </section>
          </Show>
          <Show when={review().comments.length > 0}>
            <section class="flex flex-col gap-1">
              <div class="text-12-regular text-text-weak">Comments</div>
              <For each={review().comments}>
                {(comment) => (
                  <p class="text-12-regular">
                    {comment.path}
                    {comment.line ? `:${comment.line}` : ""}: {comment.body}
                  </p>
                )}
              </For>
            </section>
          </Show>
        </article>
      )}
    </Show>
  )
}

export function RemoteAgentSession(props: Props) {
  const [prompt, setPrompt] = createSignal("")
  const [model, setModel] = createSignal("")
  const [profile, setProfile] = createSignal("")
  const [sandbox, setSandbox] = createSignal<RemoteAgentConfig["sandbox"]>()
  const [approval, setApproval] = createSignal<RemoteAgentConfig["approval"]>()
  const [permissionMode, setPermissionMode] = createSignal<RemoteAgentConfig["permissionMode"]>()
  const [result, setResult] = createSignal<RemoteAgentResult>()
  const [error, setError] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [terminalOutput, setTerminalOutput] = createSignal("")
  const [backgroundJob, setBackgroundJob] = createSignal<RemoteJob>()
  const [answer, setAnswer] = createSignal("")
  const [steering, setSteering] = createSignal("")
  const [commentPath, setCommentPath] = createSignal("")
  const [commentBody, setCommentBody] = createSignal("")
  let socket: WebSocket | undefined
  let session: RemoteAgentTerminalSession | undefined
  let opening: Promise<void> | undefined
  const initialCatalog = () =>
    props.catalog?.agent === props.agent ? props.catalog : bakedRemoteCommandCatalog(props.agent)
  const [commands, setCommands] = createSignal(initialCatalog().commands)
  const [agentVersion, setAgentVersion] = createSignal(initialCatalog().version)
  let savedCatalog = initialCatalog()
  const name = () => {
    if (props.agent === "opencode-cli") return "OpenCode CLI"
    if (props.agent === "claude-code") return "Claude Code"
    return "Codex CLI"
  }
  const config = () => {
    const next: RemoteAgentConfig = {
      ...(model().trim() ? { model: model().trim() } : {}),
      ...(profile().trim() ? { profile: profile().trim() } : {}),
      ...(props.agent === "codex-cli" && sandbox() ? { sandbox: sandbox() } : {}),
      ...(props.agent === "codex-cli" && approval() ? { approval: approval() } : {}),
      ...(props.agent === "claude-code" && permissionMode() ? { permissionMode: permissionMode() } : {}),
    }
    return Object.keys(next).length > 0 ? next : props.config
  }

  const input = () => {
    const { catalog: _catalog, onCatalog: _onCatalog, background: _background, ...rest } = props
    return { ...rest, config: config() }
  }

  const match = (item: RemoteJob) =>
    item.workspaceID === props.workspaceID &&
    item.directory === props.directory &&
    item.agent === props.agent &&
    (props.jobID === undefined ||
      (item.id === props.jobID && (props.sessionID === undefined || item.sessionID === props.sessionID)))

  const selectJob = async () => {
    const items = await props.background?.list()
    const current = items?.filter(match).toSorted((left, right) => right.updatedAt - left.updatedAt)[0]
    if (current) setBackgroundJob(current)
  }

  const action = async (value: RemoteJobAction, payload?: RemoteJobActionPayload) => {
    const current = backgroundJob()
    if (!current || !props.background) return
    const next = await props.background.action(current.id, value, payload)
    if (next) setBackgroundJob(next)
  }

  const appendTerminalOutput = (chunk: string) => {
    if (!chunk) return
    const next = `${terminalOutput()}${chunk}`.slice(-MAX_TERMINAL_OUTPUT_LENGTH)
    setTerminalOutput(next)
    setResult({ output: next, status: "completed" })
  }

  const terminalMessage = (event: MessageEvent) => {
    if (typeof event.data === "string") {
      appendTerminalOutput(event.data)
      return
    }
    if (!(event.data instanceof ArrayBuffer)) return
    const bytes = new Uint8Array(event.data)
    if (bytes[0] === 0) return
    appendTerminalOutput(new TextDecoder().decode(bytes))
  }

  const openTerminal = () => {
    if (socket?.readyState === WebSocket.OPEN) return Promise.resolve()
    if (opening) return opening
    const task = (async () => {
      const created = await createRemoteAgentSession(input())
      setTerminalOutput("")
      const next = new WebSocket(
        remoteAgentTerminalUrl(props.serverUrl, props.workspaceID, created, {
          username: props.username,
          password: props.password,
        }),
      )
      next.binaryType = "arraybuffer"
      next.onmessage = terminalMessage
      let opened = false
      const ready = new Promise<void>((resolve, reject) => {
        next.onopen = () => {
          opened = true
          resolve()
        }
        next.onclose = () => {
          if (!opened) reject(new Error("Remote agent PTY connection closed during handshake."))
          if (socket !== next) return
          socket = undefined
          session = undefined
        }
        next.onerror = () => {
          if (!opened) reject(new Error("Remote agent PTY connection failed."))
          else setError("Remote agent PTY connection failed.")
        }
      })
      try {
        await ready
      } catch (cause) {
        next.close()
        await removeRemoteAgentSession(input(), created)
        throw cause
      }
      session = created
      socket = next
    })()
    opening = task
    void task.then(
      () => {
        if (opening === task) opening = undefined
      },
      () => {
        if (opening === task) opening = undefined
      },
    )
    return task
  }

  const closeTerminal = async () => {
    const current = session
    const currentSocket = socket
    session = undefined
    socket = undefined
    currentSocket?.close()
    if (!current) return
    await removeRemoteAgentSession(input(), current)
  }

  const refresh = async () => {
    try {
      const catalog = await fetchRemoteAgentCatalog({
        serverUrl: props.serverUrl,
        username: props.username,
        password: props.password,
        workspaceID: props.workspaceID,
        directory: props.directory,
        agent: props.agent,
      })
      setCommands(catalog.commands)
      setAgentVersion(catalog.version)
      if (
        savedCatalog.agent !== catalog.agent ||
        savedCatalog.version !== catalog.version ||
        JSON.stringify(savedCatalog.commands) !== JSON.stringify(catalog.commands)
      ) {
        props.onCatalog?.(catalog)
        savedCatalog = catalog
      }
    } catch {
      return
    }
  }

  onMount(() => {
    void refresh()
    const stopJobs = props.background?.subscribe((message) => {
      if (!message.job || !match(message.job)) return
      setBackgroundJob(message.job)
      if (["completed", "failed", "stopped", "revoked", "expired"].includes(message.job.status)) {
        setResult({
          output: message.job.output ?? message.job.error ?? "",
          status: remoteJobResultStatus(message.job.status),
          ...(message.job.commandPreview ? { commandPreview: message.job.commandPreview } : {}),
          ...(message.job.review ? { review: message.job.review } : {}),
        })
      }
    })
    const timer = setInterval(() => void refresh(), 30_000)
    const onFocus = () => void refresh()
    window.addEventListener("focus", onFocus)
    onCleanup(() => {
      stopJobs?.()
      clearInterval(timer)
      window.removeEventListener("focus", onFocus)
      void closeTerminal()
    })
  })

  createEffect(() => {
    props.background
    props.jobID
    props.sessionID
    void selectJob()
  })

  const execute = async (raw: string) => {
    if (busy()) return
    setBusy(true)
    setError("")
    try {
      const value = raw.trim()
      if (!value) throw new Error("Enter a prompt or choose a remote slash command.")
      const command = parseRemoteAgentCommand(value)
      if (command || socket) {
        await openTerminal()
        if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("Remote agent PTY is not connected.")
        socket.send(`${command ? `/${command.name}${command.args ? ` ${command.args}` : ""}` : value}\r`)
        setResult({ output: terminalOutput(), status: "completed" })
      } else if (props.background) {
        const selectedConfig = Object.fromEntries(
          Object.entries(config() ?? {}).flatMap(([key, item]) => (typeof item === "string" ? [[key, item]] : [])),
        )
        const queued = await props.background.start({
          ...input(),
          prompt: value,
          config: selectedConfig,
        })
        setBackgroundJob(queued)
        setResult({
          output: `Background job ${queued.id} queued.`,
          status: "completed",
          ...(queued.commandPreview ? { commandPreview: queued.commandPreview } : {}),
          ...(queued.review ? { review: queued.review } : {}),
        })
        setPrompt("")
      } else {
        setResult(await promptRemoteAgent({ ...input(), prompt: value }))
      }
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Remote agent request failed.")
    } finally {
      setBusy(false)
    }
  }

  const send = () => void execute(prompt())

  return (
    <main class="min-h-screen bg-surface-base text-text-strong flex items-center justify-center p-6">
      <section class="w-full max-w-2xl rounded-xl border border-border-weak-base bg-surface-raised-base p-6 flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-20-medium">{name()} remote session</h1>
          <p class="text-14-regular text-text-weak">
            Prompts and slash commands are sent through the authenticated desktop or relay connection for the selected
            remote folder. Slash commands open a persistent PTY session so the selected harness executes them itself.
          </p>
          <p class="text-12-regular text-text-weak">{props.directory}</p>
        </div>

        <label class="flex flex-col gap-1 text-14-medium">
          Prompt
          <textarea
            required
            rows="6"
            value={prompt()}
            onInput={(event) => setPrompt(event.currentTarget.value)}
            class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
          />
        </label>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-12-regular text-text-weak">
            <span>Remote slash commands</span>
            <span>agent {agentVersion()}</span>
          </div>
          <div class="flex flex-wrap gap-2" aria-label="Remote slash commands">
            <For each={commands()}>
              {(item) => (
                <button
                  type="button"
                  class="rounded-md border border-border-weak-base px-2 py-1 text-12-regular"
                  onClick={() => void execute(`/${item.name}`)}
                  title={item.description}
                >
                  /{item.name}
                </button>
              )}
            </For>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="flex flex-col gap-1 text-14-medium">
            Model (optional)
            <input
              type="text"
              autocomplete="off"
              placeholder={
                props.agent === "opencode-cli"
                  ? "provider/model"
                  : props.agent === "claude-code"
                    ? "sonnet"
                    : "model ID"
              }
              value={model()}
              onInput={(event) => setModel(event.currentTarget.value)}
              class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
            />
          </label>
          <Show when={props.agent !== "claude-code"}>
            <label class="flex flex-col gap-1 text-14-medium">
              {props.agent === "opencode-cli" ? "OpenCode agent (optional)" : "Codex profile (optional)"}
              <input
                type="text"
                autocomplete="off"
                placeholder={props.agent === "opencode-cli" ? "build" : "default"}
                value={profile()}
                onInput={(event) => setProfile(event.currentTarget.value)}
                class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
              />
            </label>
          </Show>
        </div>

        <Show when={props.agent === "codex-cli"}>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="flex flex-col gap-1 text-14-medium">
              Sandbox
              <select
                value={sandbox() ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setSandbox(value ? (value as RemoteAgentConfig["sandbox"]) : undefined)
                }}
                class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
              >
                <option value="">Remote default</option>
                {sandboxes.map((value) => (
                  <option value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label class="flex flex-col gap-1 text-14-medium">
              Approval
              <select
                value={approval() ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setApproval(value ? (value as RemoteAgentConfig["approval"]) : undefined)
                }}
                class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
              >
                <option value="">Remote default</option>
                {approvals.map((value) => (
                  <option value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
        </Show>

        <Show when={props.agent === "opencode-cli"}>
          <p class="text-12-regular text-text-weak">
            OpenCode forwards the model and agent fields to the interactive CLI; its permissions remain controlled by
            the remote OpenCode configuration.
          </p>
        </Show>

        <Show when={props.agent === "claude-code"}>
          <label class="flex flex-col gap-1 text-14-medium">
            Permission mode
            <select
              value={permissionMode() ?? ""}
              onChange={(event) => {
                const value = event.currentTarget.value
                setPermissionMode(value ? (value as RemoteAgentConfig["permissionMode"]) : undefined)
              }}
              class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
            >
              <option value="">Remote default</option>
              {permissionModes.map((value) => (
                <option value={value}>{value}</option>
              ))}
            </select>
          </label>
          <p class="text-12-regular text-text-weak">
            Claude Code runs interactively with the selected model and permission mode on the SSH host.
          </p>
        </Show>

        <div class="rounded-md border border-border-weak-base p-3 text-12-regular text-text-weak">
          Workspace: {props.workspaceID} · {props.directory}
        </div>

        <Show when={backgroundJob()}>
          {(job) => (
            <article
              class="rounded-md border border-border-weak-base p-3 flex flex-col gap-2"
              aria-label="Background job"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-14-medium">Background job</span>
                <span class="text-12-regular text-text-weak">{remoteJobStatusLabel(job().status)}</span>
              </div>
              <CommandPreviewPanel value={job().commandPreview} />
              <Show when={job().approval}>
                {(approval) => (
                  <div class="rounded-md bg-surface-base p-2 flex flex-col gap-1 text-12-regular">
                    <div class="text-14-medium">Approval context</div>
                    <p>{approval().title}</p>
                    <Show when={approval().command}>
                      <code class="whitespace-pre-wrap break-all">{approval().command}</code>
                    </Show>
                    <Show when={approval().reason}>
                      <p class="text-text-weak">{approval().reason}</p>
                    </Show>
                    <Show when={approval().risk}>
                      <p class="text-text-weak">Risk: {approval().risk}</p>
                    </Show>
                  </div>
                )}
              </Show>
              <Show when={job().question}>
                {(question) => (
                  <div class="rounded-md bg-surface-base p-2 flex flex-col gap-2 text-12-regular">
                    <div class="text-14-medium">Agent question</div>
                    <p>{question().prompt}</p>
                    <Show when={question().options}>
                      {(options) => (
                        <div class="flex flex-wrap gap-2">
                          <For each={options()}>
                            {(option) => (
                              <button
                                type="button"
                                class="rounded-md border border-border-weak-base px-2 py-1"
                                onClick={() => void action("answer", { answer: option })}
                              >
                                {option}
                              </button>
                            )}
                          </For>
                        </div>
                      )}
                    </Show>
                    <div class="flex gap-2">
                      <input
                        value={answer()}
                        onInput={(event) => setAnswer(event.currentTarget.value)}
                        placeholder="Answer"
                        class="min-w-0 flex-1 rounded-md border border-border-weak-base bg-surface-base px-2 py-1"
                      />
                      <button
                        type="button"
                        class="rounded-md border border-border-weak-base px-3 py-1"
                        onClick={() => void action("answer", { answer: answer() })}
                      >
                        Answer
                      </button>
                    </div>
                  </div>
                )}
              </Show>
              <div class="flex gap-2">
                <input
                  value={steering()}
                  onInput={(event) => setSteering(event.currentTarget.value)}
                  placeholder="Steer the agent"
                  class="min-w-0 flex-1 rounded-md border border-border-weak-base bg-surface-base px-2 py-1 text-12-regular"
                />
                <button
                  type="button"
                  class="rounded-md border border-border-weak-base px-3 py-1 text-12-regular"
                  onClick={() => void action("steer", { prompt: steering() })}
                >
                  Steer
                </button>
              </div>
              <Show when={job().review}>
                <div class="flex flex-col gap-2 rounded-md bg-surface-base p-2">
                  <span class="text-12-regular text-text-weak">Add a review comment</span>
                  <input
                    value={commentPath() || job().review?.files[0]?.path || ""}
                    onInput={(event) => setCommentPath(event.currentTarget.value)}
                    placeholder="File path"
                    class="rounded-md border border-border-weak-base bg-surface-raised-base px-2 py-1 text-12-regular"
                  />
                  <div class="flex gap-2">
                    <input
                      value={commentBody()}
                      onInput={(event) => setCommentBody(event.currentTarget.value)}
                      placeholder="Comment"
                      class="min-w-0 flex-1 rounded-md border border-border-weak-base bg-surface-raised-base px-2 py-1 text-12-regular"
                    />
                    <button
                      type="button"
                      class="rounded-md border border-border-weak-base px-3 py-1 text-12-regular"
                      onClick={() =>
                        void action("comment", {
                          comment: { path: commentPath() || job().review?.files[0]?.path || "", body: commentBody() },
                        })
                      }
                    >
                      Comment
                    </button>
                  </div>
                </div>
              </Show>
              <div class="flex flex-wrap gap-2">
                <Show when={job().status === "waiting_approval"}>
                  <button
                    type="button"
                    class="rounded-md border border-border-weak-base px-3 py-1"
                    onClick={() => void action("approve")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    class="rounded-md border border-border-weak-base px-3 py-1"
                    onClick={() => void action("reject")}
                  >
                    Reject
                  </button>
                </Show>
                <Show
                  when={["queued", "running", "waiting_approval", "waiting_question", "retrying"].includes(
                    job().status,
                  )}
                >
                  <button
                    type="button"
                    class="rounded-md border border-border-weak-base px-3 py-1"
                    onClick={() => void action("stop")}
                  >
                    Stop
                  </button>
                </Show>
                <Show when={job().status === "failed"}>
                  <button
                    type="button"
                    class="rounded-md border border-border-weak-base px-3 py-1"
                    onClick={() => void action("retry")}
                  >
                    Retry
                  </button>
                </Show>
              </div>
            </article>
          )}
        </Show>

        <Show when={error()}>
          <p role="alert" class="text-14-regular text-text-on-critical-base">
            {error()}
          </p>
        </Show>

        <button
          type="button"
          disabled={busy()}
          onClick={() => void send()}
          class="rounded-md bg-surface-brand-base text-text-on-brand-base px-4 py-2 disabled:opacity-50"
        >
          {busy() ? `Running ${name()}…` : parseRemoteAgentCommand(prompt()) ? "Run slash command" : "Send prompt"}
        </button>

        <Show when={result()}>
          <article class="rounded-md border border-border-weak-base p-3 flex flex-col gap-3">
            <div class="text-14-medium">Status: {result()?.status}</div>
            <CommandPreviewPanel value={result()?.commandPreview} />
            <pre class="whitespace-pre-wrap text-14-regular">{result()?.output}</pre>
            <Show when={result()?.exitCode !== undefined}>
              <p class="text-12-regular text-text-weak">Exit code: {result()?.exitCode}</p>
            </Show>
            <ReviewPanel review={result()?.review} />
          </article>
        </Show>
      </section>
    </main>
  )
}

export function CodexCliSession(props: Omit<CodexCliPromptInput, "prompt">) {
  return <RemoteAgentSession {...props} agent="codex-cli" />
}

export function OpencodeCliSession(props: Omit<OpencodeCliPromptInput, "prompt">) {
  return <RemoteAgentSession {...props} agent="opencode-cli" />
}

export function ClaudeCodeSession(props: Omit<ClaudeCodePromptInput, "prompt">) {
  return <RemoteAgentSession {...props} agent="claude-code" />
}
