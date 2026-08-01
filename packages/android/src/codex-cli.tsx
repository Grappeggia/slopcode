import { createSignal, Show } from "solid-js"
import { normalizeHttpsUrl, type RemoteAgent } from "./remote-workspace-state"

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>

const MAX_PROMPT_LENGTH = 32 * 1024
const MAX_RESPONSE_BYTES = 128 * 1024
const MAX_OUTPUT_LENGTH = 64 * 1024
const MAX_CONFIG_VALUE_LENGTH = 128
const REQUEST_TIMEOUT_MS = 60_000
const statuses = ["completed", "failed", "timed_out"] as const
const sandboxes = ["read-only", "workspace-write", "danger-full-access"] as const
const approvals = ["untrusted", "on-failure", "on-request", "never"] as const

export type RemoteAgentStatus = (typeof statuses)[number]
export type RemoteCliAgent = Exclude<RemoteAgent, "local-slopcode">
export type RemoteAgentConfig = {
  model?: string
  profile?: string
  sandbox?: (typeof sandboxes)[number]
  approval?: (typeof approvals)[number]
}
export type RemoteAgentResult = {
  output: string
  status: RemoteAgentStatus
  exitCode?: number
}
export type CodexCliStatus = RemoteAgentStatus
export type CodexCliResult = RemoteAgentResult

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
  ) return
  if (next.split("/").some((part) => part === "." || part === "..")) return
  return next
}

function workspaceID(value: unknown) {
  const next = text(value, 256)
  if (!next || !/^wrk[a-zA-Z0-9._:-]+$/.test(next)) return
  return next
}

function agent(value: unknown): RemoteCliAgent | undefined {
  if (value === "codex-cli" || value === "opencode-cli") return value
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
  if (Object.keys(value).some((key) => !["model", "profile", "sandbox", "approval"].includes(key))) return
  const next: RemoteAgentConfig = {}
  for (const key of ["model", "profile"] as const) {
    if (value[key] === undefined) continue
    if (
      typeof value[key] !== "string" ||
      value[key].length < 1 ||
      value[key].length > MAX_CONFIG_VALUE_LENGTH ||
      !/^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/.test(value[key])
    ) return
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
  return next
}

async function json(response: Response) {
  const length = Number(response.headers.get("content-length"))
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) throw new Error("Remote agent response exceeded the Android limit.")
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

export function parseRemoteAgentResult(value: unknown): RemoteAgentResult | undefined {
  if (!isRecord(value) || Object.keys(value).some((key) => !["output", "status", "exitCode"].includes(key))) return
  const output = text(value.output, MAX_OUTPUT_LENGTH)
  const status = statuses.find((item) => item === value.status)
  if (output === undefined || !status) return
  if (value.exitCode !== undefined && (typeof value.exitCode !== "number" || !Number.isSafeInteger(value.exitCode))) return
  return value.exitCode === undefined ? { output, status } : { output, status, exitCode: value.exitCode }
}

export function parseCodexCliResult(value: unknown): CodexCliResult | undefined {
  return parseRemoteAgentResult(value)
}

export async function promptRemoteAgent(input: RemoteAgentPromptInput, fetcher: Fetcher = fetch): Promise<RemoteAgentResult> {
  const serverUrl = normalizeHttpsUrl(input.serverUrl)
  const workspace = workspaceID(input.workspaceID)
  const remoteDirectory = directory(input.directory)
  const selectedAgent = agent(input.agent)
  const prompt = typeof input.prompt === "string" ? text(input.prompt.trim(), MAX_PROMPT_LENGTH) : undefined
  const parsedConfig = input.config === undefined ? undefined : config(input.config)
  if (!serverUrl) throw new Error("Remote agent requires an exact HTTPS desktop or relay URL.")
  if (!workspace || !remoteDirectory || !selectedAgent || !prompt) throw new Error("Remote agent requires a workspace, folder, agent, and prompt.")
  if (input.config !== undefined && !parsedConfig) throw new Error("Remote agent configuration is invalid.")
  if (selectedAgent === "opencode-cli" && (parsedConfig?.sandbox !== undefined || parsedConfig?.approval !== undefined)) {
    throw new Error("OpenCode configuration supports only model and profile.")
  }

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

export function promptCodexCli(input: CodexCliPromptInput, fetcher: Fetcher = fetch) {
  return promptRemoteAgent({ ...input, agent: "codex-cli" }, fetcher)
}

export function promptOpencodeCli(input: OpencodeCliPromptInput, fetcher: Fetcher = fetch) {
  return promptRemoteAgent({ ...input, agent: "opencode-cli" }, fetcher)
}

type Props = Omit<RemoteAgentPromptInput, "prompt">

export function RemoteAgentSession(props: Props) {
  const [prompt, setPrompt] = createSignal("")
  const [result, setResult] = createSignal<RemoteAgentResult>()
  const [error, setError] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const name = () => props.agent === "opencode-cli" ? "OpenCode CLI" : "Codex CLI"

  const send = async () => {
    if (busy()) return
    setBusy(true)
    setError("")
    try {
      setResult(await promptRemoteAgent({ ...props, prompt: prompt() }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Remote agent request failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main class="min-h-screen bg-surface-base text-text-strong flex items-center justify-center p-6">
      <section class="w-full max-w-2xl rounded-xl border border-border-weak-base bg-surface-raised-base p-6 flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-20-medium">{name()} remote session</h1>
          <p class="text-14-regular text-text-weak">
            Prompts are sent through the authenticated desktop or relay connection for the selected remote folder.
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

        <div class="rounded-md border border-border-weak-base p-3 text-12-regular text-text-weak">
          Workspace: {props.workspaceID} · {props.directory}
        </div>

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
          {busy() ? `Running ${name()}…` : "Send prompt"}
        </button>

        <Show when={result()}>
          <article class="rounded-md border border-border-weak-base p-3 flex flex-col gap-3">
            <div class="text-14-medium">Status: {result()?.status}</div>
            <pre class="whitespace-pre-wrap text-14-regular">{result()?.output}</pre>
            <Show when={result()?.exitCode !== undefined}>
              <p class="text-12-regular text-text-weak">Exit code: {result()?.exitCode}</p>
            </Show>
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
