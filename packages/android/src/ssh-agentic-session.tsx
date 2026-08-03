import { createSignal, For, onCleanup, onMount, Show } from "solid-js"
import type { SshTransport } from "./ssh"
import type { SshWorkspaceState } from "./ssh-workspace-state"
import {
  agentID,
  initialOrchestratorState,
  isOrchestratorAvailable,
  reduceOrchestratorEvent,
  replyFrame,
  sessionFrame,
  turnFrame,
  wire,
  workspaceFrame,
  type OrchestratorInteraction,
  type OrchestratorState,
  type OrchestratorWire,
} from "./ssh-orchestrator"
import { SshShell } from "./ssh-shell"
import { canRetry, canSubmit, handoffToInteractive, reconnectAgentic, stopAgentic } from "./ssh-session-flow"

type Props = {
  ssh: SshTransport
  workspace: SshWorkspaceState
  onInteractive: () => void
  onDisconnected: () => void
}

function agentName(value: SshWorkspaceState["agent"]) {
  if (value === "slopcode-cli") return "Slopcode"
  if (value === "codex-cli") return "Codex"
  if (value === "opencode-cli") return "OpenCode"
  if (value === "antigravity-cli") return "Antigravity"
  return "Claude Code"
}

function phaseLabel(value: OrchestratorState["phase"]) {
  if (value === "connecting") return "Connecting"
  if (value === "opening") return "Preparing workspace"
  if (value === "ready") return "Ready"
  if (value === "running") return "Working"
  if (value === "waiting") return "Needs your input"
  if (value === "completed") return "Complete"
  if (value === "stopped") return "Stopped"
  return "Needs attention"
}

function responseID(value: unknown, key: "sessionID" | "turnID") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  const next = (value as Record<string, unknown>)[key]
  return typeof next === "string" && next.length > 0 && next.length <= 256 ? next : undefined
}

function itemLabel(value: OrchestratorState["items"][number]) {
  if (value.type === "output") return "Agent"
  if (value.type === "reasoning") return "Thinking"
  if (value.type === "retry") return "Retrying"
  if (value.type === "tool") return value.title
  if (value.type === "plan") return "Plan"
  if (value.type === "artifact") return value.name
  return "Activity"
}

export function SshAgenticSession(props: Props) {
  const [state, setState] = createSignal<OrchestratorState>(initialOrchestratorState())
  const [prompt, setPrompt] = createSignal("")
  const [answer, setAnswer] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal("")
  const [wireState, setWireState] = createSignal<OrchestratorWire>()
  let closeWire: () => void = () => undefined
  let stopped = false

  const showError = (cause: unknown, fallback: string) => {
    const message = cause instanceof Error ? cause.message : fallback
    setError(message)
    setState((current) => ({ ...current, phase: "error", error: message }))
  }

  const event = (value: Record<string, unknown>) => {
    if (stopped) return
    setState((current) => reduceOrchestratorEvent(current, value))
  }

  const start = async () => {
    if (!isOrchestratorAvailable(props.ssh)) {
      showError(
        new Error("Native SSH orchestration is unavailable on this device."),
        "Native SSH orchestration is unavailable.",
      )
      return
    }
    stopped = false
    setBusy(true)
    setError("")
    setState({ ...initialOrchestratorState(), phase: "opening" })
    closeWire()
    const next = wire(props.ssh)
    setWireState(next)
    closeWire = next.connect(event)
    try {
      await props.ssh.orchestratorStart(props.workspace.directory)
      const workspace = await next.send(workspaceFrame(props.workspace.directory, props.workspace.agent))
      const workspaceValue = workspace.workspace
      const workspaceObject =
        workspaceValue && typeof workspaceValue === "object" && !Array.isArray(workspaceValue)
          ? (workspaceValue as { id?: unknown })
          : undefined
      const workspaceID = workspaceObject && typeof workspaceObject.id === "string" ? workspaceObject.id : ""
      if (workspaceID !== "wrk_android") throw new Error("The remote workspace response was invalid.")
      const session = await next.send(sessionFrame(props.workspace.agent))
      const sessionID = responseID(session, "sessionID")
      if (!sessionID) throw new Error("The remote agent did not return a session.")
      setState((current) => ({ ...current, phase: "ready", sessionID }))
    } catch (cause) {
      closeWire()
      showError(cause, "Could not start the remote agent session.")
    } finally {
      setBusy(false)
    }
  }

  onMount(() => void start())

  onCleanup(() => {
    stopped = true
    closeWire()
    void props.ssh.orchestratorStop().catch(() => undefined)
  })

  const send = async () => {
    const value = prompt().trim()
    const currentState = state()
    const sessionID = currentState.sessionID
    const current = wireState()
    if (!value || !sessionID || !current || busy() || !canSubmit(currentState.phase)) return
    setPrompt("")
    setError("")
    setBusy(true)
    setState((previous) => ({ ...previous, phase: "running", lastPrompt: value, error: undefined }))
    try {
      const response = await current.send(turnFrame(sessionID, value, props.workspace.agent))
      const turnID = responseID(response, "turnID")
      if (turnID) setState((previous) => ({ ...previous, turnID }))
    } catch (cause) {
      showError(cause, "The remote agent could not start this turn.")
    } finally {
      setBusy(false)
    }
  }

  const respond = async (interaction: OrchestratorInteraction, decision?: "approved" | "rejected") => {
    const sessionID = state().sessionID
    const current = wireState()
    if (!sessionID || !current || busy()) return
    const value = answer().trim()
    if (interaction.kind === "question" && !value) return
    setBusy(true)
    setError("")
    try {
      await current.send(replyFrame(sessionID, interaction, value, decision))
      setAnswer("")
      setState((previous) => ({ ...previous, phase: "running", interaction: undefined, error: undefined }))
    } catch (cause) {
      showError(cause, "The remote agent did not accept that response.")
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    if (busy()) return
    setBusy(true)
    try {
      await stopAgentic(props.ssh, closeWire)
      setWireState()
      setState({ ...initialOrchestratorState(), phase: "stopped", lastPrompt: state().lastPrompt })
    } catch (cause) {
      showError(cause, "Could not stop the remote agent.")
    }
    setBusy(false)
  }

  const disconnect = async () => {
    setBusy(true)
    stopped = true
    closeWire()
    await props.ssh.orchestratorStop().catch(() => undefined)
    await props.ssh.disconnect().catch(() => undefined)
    props.onDisconnected()
  }

  const retry = () => {
    const value = state().lastPrompt
    if (!value || busy() || !canRetry(state().phase)) return
    setPrompt(value)
    queueMicrotask(() => void send())
  }

  const reconnect = async () => {
    if (busy()) return
    setBusy(true)
    setError("")
    try {
      await reconnectAgentic(props.ssh, closeWire, start)
    } catch (cause) {
      showError(cause, "Could not reconnect the remote agent session.")
    } finally {
      setBusy(false)
    }
  }

  const interactive = async () => {
    if (busy()) return
    setBusy(true)
    setError("")
    try {
      await handoffToInteractive(props.ssh, closeWire, props.onInteractive)
    } catch (cause) {
      showError(cause, "Could not stop the remote agent before opening the interactive CLI.")
      setBusy(false)
    }
  }

  const choose = (value: string) => {
    setAnswer(value)
    const interaction = state().interaction
    if (interaction?.kind === "question") void respond(interaction)
  }

  return (
    <SshShell workspace={props.workspace} sessionID={state().sessionID} sessionState={phaseLabel(state().phase)}>
      <main class="min-h-screen bg-surface-base text-text-strong flex items-start justify-center p-4 pt-20 sm:p-6 sm:pt-20">
        <section class="w-full max-w-3xl rounded-2xl border border-border-weak-base bg-surface-raised-base p-4 sm:p-6 flex flex-col gap-5">
          <header class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-1">
              <p class="text-12-regular text-text-weak uppercase tracking-wide">Remote agent session</p>
              <h1 class="text-20-medium">Your agent is in control</h1>
              <p class="text-14-regular text-text-weak">
                Ask for an outcome. Slopcode will plan, act, and show you what changed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void disconnect()}
              class="shrink-0 rounded-md border border-border-weak-base px-3 py-2 text-12-regular"
            >
              Disconnect
            </button>
          </header>

          <section class="grid grid-cols-1 sm:grid-cols-3 gap-2" aria-label="Remote session summary">
            <div class="rounded-xl border border-border-weak-base bg-surface-base p-3">
              <p class="text-12-regular text-text-weak">Computer</p>
              <p class="text-14-medium mt-1 break-all">{props.workspace.target}</p>
            </div>
            <div class="rounded-xl border border-border-weak-base bg-surface-base p-3">
              <p class="text-12-regular text-text-weak">Workspace</p>
              <p class="text-14-medium mt-1 break-all">{props.workspace.directory}</p>
            </div>
            <div class="rounded-xl border border-border-weak-base bg-surface-base p-3">
              <p class="text-12-regular text-text-weak">Agent</p>
              <p class="text-14-medium mt-1">{agentName(props.workspace.agent)}</p>
            </div>
          </section>

          <section
            class="rounded-xl border border-border-weak-base bg-surface-base p-4"
            aria-label="Connection progress"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-12-regular text-text-weak">Connection progress</p>
                <p class="text-16-medium mt-1">{phaseLabel(state().phase)}</p>
              </div>
              <Show when={busy()}>
                <span class="text-12-regular text-text-weak" aria-live="polite">
                  Working…
                </span>
              </Show>
            </div>
            <div class="grid grid-cols-4 gap-2 mt-4">
              <For each={["Connecting", "Workspace", "Agent", "Session"]}>
                {(label, index) => (
                  <div class="flex flex-col gap-2" aria-label={label}>
                    <div
                      class={`h-2 rounded-full ${index() <= (state().phase === "connecting" ? 0 : state().phase === "opening" ? 1 : state().phase === "ready" ? 2 : 3) ? "bg-surface-brand-base" : "bg-surface-weak-base"}`}
                    />
                    <span class="text-12-regular text-text-weak">{label}</span>
                  </div>
                )}
              </For>
            </div>
          </section>

          <Show when={error() || state().error}>
            <div
              role="alert"
              class="rounded-xl border border-border-critical-base bg-surface-critical-weak p-4 flex flex-col gap-3"
            >
              <p class="text-14-regular">{error() || state().error}</p>
              <p class="text-12-regular text-text-weak">
                {props.workspace.agent === "antigravity-cli"
                  ? "Check the SSH connection, Antigravity sign-in, and workspace access, then reconnect."
                  : "Check the SSH connection and workspace access, then reconnect."}
              </p>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void reconnect()}
                  class="rounded-md bg-surface-brand-base text-text-on-brand-base px-3 py-2 text-12-medium"
                >
                  Reconnect
                </button>
                <Show when={state().lastPrompt}>
                  <button
                    type="button"
                    onClick={retry}
                    class="rounded-md border border-border-weak-base px-3 py-2 text-12-medium"
                  >
                    Retry last request
                  </button>
                </Show>
              </div>
            </div>
          </Show>

          <Show when={props.workspace.agent === "antigravity-cli"}>
            <section
              class="rounded-xl border border-border-weak-base bg-surface-base p-4"
              aria-label="Antigravity limitations"
            >
              <p class="text-14-medium">Antigravity headless session</p>
              <p class="mt-1 text-12-regular text-text-weak">
                Antigravity runs through its one-shot CLI. Prompts and text output are supported; structured tool and
                approval events are not available here.
              </p>
            </section>
          </Show>

          <Show when={state().items.length > 0}>
            <section class="flex flex-col gap-3" aria-label="Agent activity">
              <h2 class="text-16-medium">Activity</h2>
              <For each={state().items}>
                {(item) => (
                  <article class="rounded-xl border border-border-weak-base bg-surface-base p-4 flex flex-col gap-2">
                    <p class="text-12-regular text-text-weak">{itemLabel(item)}</p>
                    <Show when={item.type === "output" || item.type === "reasoning" || item.type === "retry"}>
                      <p class="text-14-regular whitespace-pre-wrap break-words">
                        {item.type === "output" || item.type === "reasoning" || item.type === "retry" ? item.text : ""}
                      </p>
                    </Show>
                    <Show when={item.type === "tool"}>
                      <div class="flex items-center justify-between gap-3">
                        <span class="text-14-regular">{item.type === "tool" ? item.title : ""}</span>
                        <span class="text-12-regular text-text-weak">{item.type === "tool" ? item.status : ""}</span>
                      </div>
                    </Show>
                    <Show when={item.type === "plan"}>
                      <pre class="text-12-regular whitespace-pre-wrap">{item.type === "plan" ? item.content : ""}</pre>
                    </Show>
                    <Show when={item.type === "artifact"}>
                      <div class="flex items-center justify-between gap-3">
                        <span class="text-14-regular">{item.type === "artifact" ? item.name : ""}</span>
                        <span class="text-12-regular text-text-weak">{item.type === "artifact" ? item.kind : ""}</span>
                      </div>
                      <p class="text-12-regular text-text-weak break-all">
                        {item.type === "artifact" ? item.path : ""}
                      </p>
                    </Show>
                  </article>
                )}
              </For>
            </section>
          </Show>

          <Show when={state().interaction}>
            {(interaction) => (
              <section
                class="rounded-xl border border-border-brand-base bg-surface-base p-4 flex flex-col gap-3"
                aria-label={interaction().kind === "approval" ? "Approval required" : "Question from agent"}
              >
                <div>
                  <p class="text-12-regular text-text-weak">
                    {interaction().kind === "approval" ? "Approval required" : "Question"}
                  </p>
                  <h2 class="text-16-medium mt-1">{interaction().title ?? interaction().prompt}</h2>
                </div>
                <Show when={interaction().command}>
                  <pre class="rounded-lg bg-surface-raised-base p-3 text-12-regular whitespace-pre-wrap break-words">
                    {interaction().command}
                  </pre>
                </Show>
                <Show when={interaction().reason || interaction().cwd}>
                  <p class="text-12-regular text-text-weak">
                    {interaction().reason ?? ""}
                    {interaction().cwd ? ` · ${interaction().cwd}` : ""}
                  </p>
                </Show>
                <Show when={interaction().kind === "approval"}>
                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy()}
                      onClick={() => void respond(interaction(), "approved")}
                      class="rounded-md bg-surface-brand-base text-text-on-brand-base px-4 py-2 text-12-medium disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy()}
                      onClick={() => void respond(interaction(), "rejected")}
                      class="rounded-md border border-border-weak-base px-4 py-2 text-12-medium disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </Show>
                <Show when={interaction().kind === "question"}>
                  <Show when={interaction().options?.length}>
                    <div class="flex flex-wrap gap-2">
                      <For each={interaction().options ?? []}>
                        {(option) => (
                          <button
                            type="button"
                            disabled={busy()}
                            onClick={() => choose(option)}
                            class="rounded-md border border-border-weak-base px-3 py-2 text-12-medium disabled:opacity-50"
                          >
                            {option}
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                  <Show when={interaction().allowFreeform !== false}>
                    <div class="flex gap-2">
                      <input
                        value={answer()}
                        onInput={(event) => setAnswer(event.currentTarget.value)}
                        placeholder="Your answer"
                        class="min-w-0 flex-1 rounded-md border border-border-weak-base bg-surface-raised-base px-3 py-2 text-14-regular"
                      />
                      <button
                        type="button"
                        disabled={busy() || !answer().trim()}
                        onClick={() => void respond(interaction())}
                        class="rounded-md bg-surface-brand-base text-text-on-brand-base px-3 py-2 text-12-medium disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  </Show>
                </Show>
              </section>
            )}
          </Show>

          <form
            class="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            <label class="text-14-medium" for="agent-prompt">
              What should the agent do?
            </label>
            <div class="flex gap-2">
              <textarea
                id="agent-prompt"
                rows="3"
                value={prompt()}
                onInput={(event) => setPrompt(event.currentTarget.value)}
                placeholder="e.g. Review the latest changes and summarize any risks"
                disabled={busy() || !canSubmit(state().phase)}
                class="min-w-0 flex-1 resize-y rounded-xl border border-border-weak-base bg-surface-base px-3 py-3 text-14-regular disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={busy() || !prompt().trim() || !state().sessionID || !canSubmit(state().phase)}
                class="self-end rounded-md bg-surface-brand-base text-text-on-brand-base px-4 py-3 text-12-medium disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>

          <div class="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={busy() || state().phase !== "running"}
              onClick={() => void stop()}
              class="rounded-md border border-border-weak-base px-3 py-2 text-12-medium disabled:opacity-50"
            >
              Stop
            </button>
            <Show when={state().phase === "completed"}>
              <span class="text-12-regular text-text-weak">Turn complete. Ask for the next outcome when ready.</span>
            </Show>
            <Show when={state().phase === "stopped"}>
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-12-regular text-text-weak">Stopped. Reconnect, then retry the last request.</span>
                <button
                  type="button"
                  onClick={() => void reconnect()}
                  class="rounded-md border border-border-weak-base px-3 py-2 text-12-medium"
                >
                  Reconnect
                </button>
              </div>
            </Show>
          </div>

          <details class="rounded-xl border border-border-weak-base bg-surface-base p-3">
            <summary class="cursor-pointer text-12-medium">Diagnostics</summary>
            <div class="mt-3 flex flex-col gap-2 text-12-regular text-text-weak">
              <p>Transport: native SSH · backend: {agentID(props.workspace.agent)}</p>
              <p>Session: {state().sessionID ?? "starting"}</p>
              <p>Cursor: {state().cursor ?? "none"}</p>
              <p>
                Raw PTY output is kept out of the primary experience. Use Interactive CLI for terminal prompts and
                sign-in.
              </p>
              <button
                type="button"
                disabled={busy()}
                onClick={() => void interactive()}
                class="w-fit rounded-md border border-border-weak-base px-3 py-2 text-12-medium disabled:opacity-50"
              >
                Open Interactive CLI
              </button>
              <p>Opening it stops this agentic session and keeps this SSH workspace connected.</p>
            </div>
          </details>
        </section>
      </main>
    </SshShell>
  )
}
