import { createSignal, onCleanup, onMount, Show } from "solid-js"
import type { SshEvent, SshTransport } from "./ssh"
import type { SshWorkspaceState } from "./ssh-workspace-state"
import { initialSshMode, returnToAgentic } from "./ssh-session-flow"
import { installAndroidBack } from "./android-back"
import { SshShell } from "./ssh-shell"

type Props = {
  ssh: SshTransport
  workspace: SshWorkspaceState
  onAgentic: () => void
  onDisconnected: () => void
}

const MAX_OUTPUT = 128 * 1024

function name(agent: SshWorkspaceState["agent"]) {
  if (agent === "slopcode-cli") return "Slopcode CLI"
  if (agent === "codex-cli") return "Codex CLI"
  if (agent === "opencode-cli") return "OpenCode CLI"
  if (agent === "antigravity-cli") return "Antigravity CLI"
  return "Claude Code"
}

export function SshSession(props: Props) {
  const [output, setOutput] = createSignal("")
  const [prompt, setPrompt] = createSignal("")
  const [mode, setMode] = createSignal<"prompt" | "interactive">(initialSshMode(props.workspace.agent))
  const [activeID, setActiveID] = createSignal<string>()
  const [busy, setBusy] = createSignal(true)
  const [connected, setConnected] = createSignal(false)
  const [error, setError] = createSignal("")
  const [preflight, setPreflight] = createSignal("")
  const [exitCode, setExitCode] = createSignal<number>()
  const [cols, setCols] = createSignal("120")
  const [rows, setRows] = createSignal("40")

  const append = (value: string) => setOutput((current) => `${current}${value}`.slice(-MAX_OUTPUT))

  const handle = (event: SshEvent) => {
    if (event.type === "started") {
      if (event.agent !== props.workspace.agent || (event.operation !== "interactive" && event.operation !== "prompt"))
        return
      setActiveID(event.id)
      return
    }
    if (!activeID() || event.id !== activeID()) return
    if (event.type === "output") {
      append(event.data)
      return
    }
    if (event.type === "error") {
      setError(event.message)
      setBusy(false)
      return
    }
    if (event.type === "completed") {
      setExitCode(event.exitCode)
      setBusy(false)
      if (mode() === "prompt") setActiveID()
    }
  }

  const connect = async () => {
    let ready = false
    setBusy(true)
    setError("")
    try {
      const status = await props.ssh.status()
      if (!status.connected || status.profile !== props.workspace.profile) {
        const result = await props.ssh.connect({
          profile: props.workspace.profile,
          host: props.workspace.host,
          port: props.workspace.port,
          username: props.workspace.username,
          directory: props.workspace.directory,
          saveCredentials: false,
        })
        if (result.status === "host_key_required")
          throw new Error("The SSH host key is not trusted yet. Return to SSH setup to verify it.")
      }
      setConnected(true)
      await props.ssh.selectWorkspace(props.workspace.directory)
      const result = await props.ssh.execVersion(props.workspace.agent, props.workspace.directory)
      setPreflight(result.output || result.error || "")
      if (!result.ok) throw new Error(result.error ?? `The ${name(props.workspace.agent)} preflight failed.`)
      ready = true
    } catch (cause) {
      setConnected(false)
      setError(cause instanceof Error ? cause.message : "SSH session could not be opened.")
    } finally {
      setBusy(false)
    }
    if (ready && initialSshMode(props.workspace.agent) === "interactive") await startInteractive()
  }

  onMount(() => {
    const stop = props.ssh.subscribe(handle)
    const releaseBack = installAndroidBack(() => {
      if (busy()) return true
      void agentic()
      return true
    })
    void connect()
    onCleanup(() => {
      stop()
      releaseBack()
      void props.ssh.cleanup()
    })
  })

  const startInteractive = async () => {
    if (busy() || !connected()) return
    setBusy(true)
    setError("")
    try {
      const session = await props.ssh.start({
        operation: "interactive",
        agent: props.workspace.agent,
        directory: props.workspace.directory,
        cols: Number(cols()),
        rows: Number(rows()),
      })
      setMode("interactive")
      setActiveID(session.id)
      setExitCode()
      append(`\n[interactive ${name(props.workspace.agent)} started]\n`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the interactive SSH PTY.")
    } finally {
      setBusy(false)
    }
  }

  const send = async () => {
    const value = prompt()
    if (!value || busy() || !connected()) return
    setBusy(true)
    setError("")
    try {
      if (mode() === "interactive") {
        if (!activeID()) throw new Error("Start the interactive PTY first.")
        await props.ssh.input(`${value}\n`)
      } else {
        const session = await props.ssh.start({
          operation: "prompt",
          agent: props.workspace.agent,
          directory: props.workspace.directory,
          prompt: value,
          cols: Number(cols()),
          rows: Number(rows()),
        })
        setActiveID(session.id)
      }
      setPrompt("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the prompt to the SSH host.")
      setBusy(false)
    }
  }

  const resize = async () => {
    try {
      await props.ssh.resize(Number(cols()), Number(rows()))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not resize the remote PTY.")
    }
  }

  const interrupt = async () => {
    try {
      await props.ssh.interrupt()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not interrupt the remote agent.")
    }
  }

  const disconnect = async () => {
    await props.ssh.disconnect().catch(() => undefined)
    props.onDisconnected()
  }

  const sessionState = () => {
    if (error()) return "Needs attention"
    if (busy()) return connected() ? (activeID() ? "Working" : "Connecting") : "Connecting"
    if (!connected()) return "Disconnected"
    if (activeID() && mode() === "interactive") return "Interactive PTY"
    if (activeID()) return "Active"
    return "Ready"
  }

  const agentic = async () => {
    if (busy()) return
    setBusy(true)
    setError("")
    try {
      await returnToAgentic(props.ssh, props.onAgentic)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not close the interactive SSH session.")
      setBusy(false)
    }
  }

  return (
    <SshShell workspace={props.workspace} sessionID={activeID()} sessionState={sessionState()}>
      <main
        data-ssh-interactive
        class="ssh-shell-page min-h-screen bg-surface-base text-text-strong flex items-center justify-center p-6"
      >
        <section
          data-ssh-interactive-panel
          class="ssh-shell-panel w-full max-w-3xl rounded-xl border border-border-weak-base bg-surface-raised-base p-6 flex flex-col gap-4"
        >
          <div class="flex flex-col gap-1">
            <h1 class="text-20-medium">{name(props.workspace.agent)} over SSH</h1>
            <p class="text-14-regular text-text-weak">
              {props.workspace.username}@{props.workspace.host}:{props.workspace.port}
            </p>
            <p class="text-14-regular text-text-weak">Working directory: {props.workspace.directory}</p>
          </div>

          <Show when={preflight()}>
            <div class="rounded-md border border-border-weak-base p-3 text-12-regular">
              <span class="text-12-regular text-text-weak">Preflight</span>
              <pre class="whitespace-pre-wrap">{preflight()}</pre>
            </div>
          </Show>

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy() || !connected() || mode() === "interactive"}
              onClick={() => void startInteractive()}
              class="rounded-md border border-border-weak-base px-3 py-2 disabled:opacity-50"
            >
              Start interactive PTY
            </button>
            <button
              type="button"
              disabled={busy() || !connected()}
              onClick={() => void interrupt()}
              class="rounded-md border border-border-weak-base px-3 py-2 disabled:opacity-50"
            >
              Ctrl-C
            </button>
            <button
              type="button"
              disabled={busy() || !connected()}
              onClick={() => void resize()}
              class="rounded-md border border-border-weak-base px-3 py-2 disabled:opacity-50"
            >
              Resize PTY
            </button>
            <button
              type="button"
              disabled={busy()}
              onClick={() => void disconnect()}
              class="rounded-md border border-border-weak-base px-3 py-2 disabled:opacity-50"
            >
              Disconnect
            </button>
            <button
              type="button"
              disabled={busy()}
              onClick={() => void agentic()}
              class="rounded-md border border-border-weak-base px-3 py-2 disabled:opacity-50"
            >
              Return to agentic session
            </button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-1 text-12-regular">
              Columns
              <input
                value={cols()}
                onInput={(event) => setCols(event.currentTarget.value)}
                class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
              />
            </label>
            <label class="flex flex-col gap-1 text-12-regular">
              Rows
              <input
                value={rows()}
                onInput={(event) => setRows(event.currentTarget.value)}
                class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
              />
            </label>
          </div>

          <div class="grid grid-cols-2 gap-2" role="tablist" aria-label="SSH agent input mode">
            <button
              type="button"
              id="ssh-mode-prompt"
              role="tab"
              aria-selected={mode() === "prompt"}
              aria-controls="ssh-session-input"
              tabIndex={mode() === "prompt" ? 0 : -1}
              onClick={() => setMode("prompt")}
              class={`rounded-md border px-3 py-2 ${mode() === "prompt" ? "border-border-brand-base" : "border-border-weak-base"}`}
            >
              One-shot prompt
            </button>
            <button
              type="button"
              disabled={!activeID()}
              id="ssh-mode-interactive"
              role="tab"
              aria-selected={mode() === "interactive"}
              aria-controls="ssh-session-input"
              tabIndex={mode() === "interactive" ? 0 : -1}
              onClick={() => setMode("interactive")}
              class={`rounded-md border px-3 py-2 disabled:opacity-50 ${mode() === "interactive" ? "border-border-brand-base" : "border-border-weak-base"}`}
            >
              Interactive input
            </button>
          </div>

          <textarea
            id="ssh-session-input"
            aria-label="Prompt or interactive PTY input"
            rows="4"
            value={prompt()}
            disabled={!connected() || busy()}
            onInput={(event) => setPrompt(event.currentTarget.value)}
            placeholder={
              mode() === "interactive" ? "Input sent to the remote PTY" : "Prompt sent through the CLI's one-shot mode"
            }
            class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={!prompt() || busy() || !connected()}
            onClick={() => void send()}
            class="rounded-md bg-surface-brand-base text-text-on-brand-base px-4 py-2 disabled:opacity-50"
          >
            {busy() ? "Working…" : mode() === "interactive" ? "Send PTY input" : "Run one-shot prompt"}
          </button>

          <pre
            aria-label="SSH agent output"
            class="min-h-48 max-h-96 overflow-auto rounded-md bg-surface-base p-3 whitespace-pre-wrap text-12-regular"
          >
            {output() || (busy() ? "Connecting to SSH host…" : "No output yet.")}
          </pre>
          <Show when={exitCode() !== undefined}>
            <p class="text-12-regular text-text-weak">Last exit code: {exitCode()}</p>
          </Show>
          <Show when={error()}>
            <div class="flex flex-col gap-2">
              <p role="alert" class="text-14-regular text-text-on-critical-base">
                {error()}
              </p>
              <Show when={!connected()}>
                <button
                  type="button"
                  onClick={() => props.onDisconnected()}
                  class="rounded-md border border-border-weak-base px-3 py-2"
                >
                  Return to SSH setup
                </button>
              </Show>
            </div>
          </Show>
        </section>
      </main>
    </SshShell>
  )
}
