import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import type { SshTransport } from "./ssh"
import type { SshWorkspaceState } from "./ssh-workspace-state"
import {
  agentID,
  cancelFrame,
  helloFrame,
  initialOrchestratorState,
  isOrchestratorAvailable,
  parseAttach,
  parseHello,
  parseReplay,
  parseSnapshot,
  reduceOrchestratorEvent,
  replayFrame,
  replyFrame,
  retryFrame,
  sessionAttachFrame,
  sessionFrame,
  snapshotFrame,
  steerFrame,
  turnFrame,
  wire,
  workspaceFrame,
  type OrchestratorInteraction,
  OrchestratorError,
  type OrchestratorState,
  type OrchestratorWire,
} from "./ssh-orchestrator"
import {
  AGENT_SESSION_STORAGE,
  REVIEW_TABS,
  initialAgentSessionState,
  lastPrompt,
  pendingInteraction,
  readAgentSession,
  reduceAgentSession,
  reviewItems,
  writeAgentSession,
  type AgentSessionEntry,
  type AgentSessionState,
  type ReviewTab,
} from "./ssh-agent-session-state"
import { SshShell } from "./ssh-shell"
import { installAndroidBack } from "./android-back"
import { appStorage } from "./platform"
import { canRetry, canSubmit, cleanupAgenticStart, handoffToInteractive, reconnectAgentic } from "./ssh-session-flow"

type Props = {
  ssh: SshTransport
  workspace: SshWorkspaceState
  onInteractive: () => void
  onDisconnected: () => void
}

function agentName(value: SshWorkspaceState["agent"]) {
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

function snapshotPhase(value: string): OrchestratorState["phase"] {
  if (value === "running") return "running"
  if (value === "waiting") return "waiting"
  if (value === "completed") return "completed"
  if (value === "failed") return "error"
  if (value === "stopped" || value === "interrupted" || value === "detached") return "stopped"
  return "ready"
}

function reviewLabel(value: ReviewTab) {
  return value[0]!.toUpperCase() + value.slice(1)
}

function emptyReview(value: ReviewTab) {
  if (value === "changes") return "No change metadata was reported for this session."
  if (value === "files") return "No file metadata was reported for this session."
  if (value === "tests") return "No test runs were reported for this session."
  return "No screenshots were reported. Previews are unavailable unless the agent reports an image artifact."
}

function activity(value: AgentSessionEntry) {
  if (value.type === "user" || value.type === "output" || value.type === "reasoning" || value.type === "retry")
    return `${value.id}:${value.type}:${value.text.length}`
  if (value.type === "tool")
    return `${value.id}:${value.status}:${value.metadata?.progress ?? ""}:${value.metadata?.result ?? ""}`
  if (value.type === "approval") return `${value.id}:${value.resolved}:${value.decision ?? ""}`
  if (value.type === "question") return `${value.id}:${value.resolved}:${value.answer ?? ""}`
  if (value.type === "completion") return `${value.id}:${value.status}:${value.message ?? ""}`
  if (value.type === "failure") return `${value.id}:${value.message}`
  if (value.type === "plan") return `${value.id}:${value.revision ?? ""}:${value.content.length}`
  if (value.type === "artifact") return `${value.id}:${value.path}:${value.size ?? ""}`
  return value.id
}

function announcement(value: AgentSessionEntry | undefined, status: string) {
  if (!value) return `Remote agent status: ${status}`
  if (value.type === "user") return "Message sent."
  if (value.type === "output") return `Agent: ${value.text.slice(-180)}`
  if (value.type === "reasoning") return "Agent reasoning updated."
  if (value.type === "retry") return `Retrying: ${value.text.slice(-160)}`
  if (value.type === "tool")
    return `${value.title}: ${value.status.replaceAll("_", " ")}${value.metadata?.progress ? `, ${value.metadata.progress}` : ""}`
  if (value.type === "plan") return "Agent plan updated."
  if (value.type === "artifact") return `${value.name} was added to the review.`
  if (value.type === "approval")
    return value.resolved
      ? `Request ${value.decision === "approved" ? "approved" : "rejected"}.`
      : `Approval required: ${value.interaction.title}`
  if (value.type === "question")
    return value.resolved ? "Answer sent." : `Question from agent: ${value.interaction.prompt}`
  if (value.type === "completion") return `Turn ${value.status}${value.message ? `: ${value.message}` : ""}`
  if (value.type === "failure") return `Session problem: ${value.message}`
  return `Remote agent status: ${status}`
}

function ReviewItem(props: { entry: AgentSessionEntry; tab: ReviewTab }) {
  if (props.entry.type === "tool")
    return (
      <article class="rounded-lg border border-border-weak-base bg-surface-base p-3" data-review-item="tool">
        <div class="flex items-start justify-between gap-3">
          <p class="text-14-medium">{props.entry.title}</p>
          <span class="text-12-regular text-text-weak">{props.entry.status.replaceAll("_", " ")}</span>
        </div>
        <Show when={props.entry.metadata?.path}>
          <p class="mt-2 break-all text-12-regular text-text-weak">{props.entry.metadata?.path}</p>
        </Show>
        <Show when={props.entry.metadata?.progress || props.entry.metadata?.result || props.entry.metadata?.exitCode}>
          <p class="mt-2 text-12-regular text-text-weak">
            {[
              props.entry.metadata?.progress,
              props.entry.metadata?.result,
              props.entry.metadata?.exitCode && `exit ${props.entry.metadata.exitCode}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </Show>
      </article>
    )
  if (props.entry.type === "artifact")
    return (
      <article class="rounded-lg border border-border-weak-base bg-surface-base p-3" data-review-item="artifact">
        <div class="flex items-start justify-between gap-3">
          <p class="text-14-medium">{props.entry.name}</p>
          <span class="text-12-regular text-text-weak">{props.entry.kind}</span>
        </div>
        <p class="mt-2 break-all text-12-regular text-text-weak">{props.entry.path}</p>
        <p class="mt-2 text-12-regular text-text-weak">
          {props.entry.size !== undefined ? `${props.entry.size} bytes` : "Size not reported"}
          {props.entry.mime ? ` · ${props.entry.mime}` : ""}
        </p>
        <p class="mt-2 text-12-regular text-text-weak">
          {props.tab === "screenshots"
            ? "Screenshot metadata only; preview unavailable."
            : "Metadata only; content not loaded."}
        </p>
      </article>
    )
  return null
}

function Entry(props: {
  entry: AgentSessionEntry
  active?: OrchestratorInteraction
  busy: boolean
  answer: string
  onAnswer: (value: string) => void
  onRespond: (interaction: OrchestratorInteraction, decision?: "approved" | "rejected", answer?: string) => void
}) {
  const item = props.entry
  if (item.type === "user")
    return (
      <article
        data-agent-entry="user"
        aria-label="You"
        class="ml-auto max-w-[88%] rounded-2xl bg-surface-brand-base px-4 py-3 text-text-on-brand-base"
      >
        <p class="whitespace-pre-wrap break-words text-14-regular">{item.text}</p>
      </article>
    )
  if (item.type === "output")
    return (
      <article
        data-agent-entry="output"
        aria-label="Agent response"
        class="max-w-[94%] rounded-2xl border border-border-weak-base bg-surface-base px-4 py-3"
      >
        <p class="text-12-medium text-text-weak">Agent</p>
        <p class="mt-1 whitespace-pre-wrap break-words text-14-regular">{item.text}</p>
      </article>
    )
  if (item.type === "reasoning")
    return (
      <details data-agent-entry="reasoning" class="rounded-xl border border-border-weak-base bg-surface-base px-3">
        <summary class="cursor-pointer text-12-medium text-text-weak">Reasoning</summary>
        <p class="pb-3 whitespace-pre-wrap break-words text-12-regular text-text-weak">{item.text}</p>
      </details>
    )
  if (item.type === "retry")
    return (
      <aside data-agent-entry="retry" class="rounded-xl border border-border-weak-base bg-surface-weak-base p-3">
        <p class="text-12-medium">Retrying</p>
        <p class="mt-1 whitespace-pre-wrap text-12-regular text-text-weak">{item.text}</p>
      </aside>
    )
  if (item.type === "plan")
    return (
      <section
        data-agent-entry="plan"
        aria-label="Agent plan"
        class="rounded-xl border border-border-weak-base bg-surface-base p-4"
      >
        <p class="text-12-medium text-text-weak">Plan</p>
        <pre class="mt-2 whitespace-pre-wrap break-words text-12-regular">{item.content}</pre>
      </section>
    )
  if (item.type === "tool")
    return (
      <article data-agent-entry="tool" class="rounded-xl border border-border-weak-base bg-surface-base p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-12-medium text-text-weak">Tool</p>
            <p class="mt-1 text-14-medium">{item.title}</p>
          </div>
          <span class="rounded-full bg-surface-weak-base px-2 py-1 text-12-regular">
            {item.status.replaceAll("_", " ")}
          </span>
        </div>
        <Show when={item.metadata?.progress || item.metadata?.summary || item.metadata?.path}>
          <p class="mt-2 break-all text-12-regular text-text-weak">
            {[item.metadata?.progress, item.metadata?.summary, item.metadata?.path].filter(Boolean).join(" · ")}
          </p>
        </Show>
      </article>
    )
  if (item.type === "artifact")
    return (
      <article data-agent-entry="artifact" class="rounded-xl border border-border-weak-base bg-surface-base p-4">
        <p class="text-12-medium text-text-weak">Reported {item.kind}</p>
        <p class="mt-1 text-14-medium">{item.name}</p>
        <p class="mt-1 break-all text-12-regular text-text-weak">{item.path}</p>
      </article>
    )
  if (item.type === "approval" || item.type === "question") {
    const active = () => !item.resolved && props.active?.id === item.id
    const title = item.type === "approval" ? item.interaction.title : item.interaction.prompt
    return (
      <section
        data-agent-entry={item.type}
        data-agent-interaction-active={active() ? "true" : undefined}
        data-interaction-id={item.id}
        role="group"
        aria-label={
          item.type === "approval"
            ? item.resolved
              ? "Approval response"
              : "Approval required"
            : item.resolved
              ? "Question response"
              : "Question from agent"
        }
        class={`rounded-xl border p-4 ${active() ? "border-border-brand-base bg-surface-base" : "border-border-weak-base bg-surface-base"}`}
      >
        <p class="text-12-medium text-text-weak">
          {item.type === "approval" ? (item.resolved ? "Approval" : "Approval required") : "Question"}
        </p>
        <h2 class="mt-1 text-16-medium">{title}</h2>
        <Show when={item.interaction.command}>
          <pre class="mt-3 rounded-lg bg-surface-raised-base p-3 whitespace-pre-wrap break-words text-12-regular">
            {item.interaction.command}
          </pre>
        </Show>
        <Show when={item.detailsOmitted}>
          <p class="mt-2 text-12-regular text-text-weak">Command details were not saved in the local snapshot.</p>
        </Show>
        <Show when={item.interaction.reason || item.interaction.cwd}>
          <p class="mt-2 text-12-regular text-text-weak">
            {[item.interaction.reason, item.interaction.cwd].filter(Boolean).join(" · ")}
          </p>
        </Show>
        <Show when={active() && item.type === "approval"}>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              data-agent-action="approve"
              disabled={props.busy}
              onClick={() => props.onRespond(item.interaction, "approved")}
              class="min-h-12 rounded-md bg-surface-brand-base px-4 py-2 text-12-medium text-text-on-brand-base disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              data-agent-action="reject"
              disabled={props.busy}
              onClick={() => props.onRespond(item.interaction, "rejected")}
              class="min-h-12 rounded-md border border-border-weak-base px-4 py-2 text-12-medium disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </Show>
        <Show when={active() && item.type === "question"}>
          <div class="mt-3 flex flex-col gap-3">
            <Show when={item.interaction.options?.length}>
              <div class="flex flex-wrap gap-2">
                <For each={item.interaction.options ?? []}>
                  {(option) => (
                    <button
                      type="button"
                      data-agent-action="option"
                      disabled={props.busy}
                      onClick={() => props.onRespond(item.interaction, undefined, option)}
                      class="min-h-12 rounded-md border border-border-weak-base px-3 py-2 text-12-medium disabled:opacity-50"
                    >
                      {option}
                    </button>
                  )}
                </For>
              </div>
            </Show>
            <Show when={item.interaction.allowFreeform !== false}>
              <div class="flex flex-col gap-2">
                <label for={`agent-answer-${item.id}`} class="text-12-medium">
                  Your answer
                </label>
                <div class="flex gap-2">
                  <input
                    id={`agent-answer-${item.id}`}
                    data-agent-answer={item.id}
                    value={props.answer}
                    onInput={(event) => props.onAnswer(event.currentTarget.value)}
                    class="min-w-0 flex-1 rounded-md border border-border-weak-base bg-surface-raised-base px-3 py-2 text-14-regular"
                  />
                  <button
                    type="button"
                    data-agent-action="answer"
                    disabled={props.busy || !props.answer.trim()}
                    onClick={() => props.onRespond(item.interaction, undefined, props.answer)}
                    class="min-h-12 rounded-md bg-surface-brand-base px-3 py-2 text-12-medium text-text-on-brand-base disabled:opacity-50"
                  >
                    Send answer
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </Show>
        <Show when={item.resolved}>
          <p class="mt-3 text-12-regular text-text-weak" data-agent-resolution>
            {item.type === "approval"
              ? item.decision === "approved"
                ? "Approved"
                : item.decision === "rejected"
                  ? "Rejected"
                  : "Response sent"
              : item.answer
                ? `Your answer: ${item.answer}`
                : item.answerOmitted
                  ? "Answer sent · not saved for security"
                  : "Answer sent"}
          </p>
        </Show>
      </section>
    )
  }
  if (item.type === "completion")
    return (
      <section
        data-agent-entry="completion"
        data-agent-completion-status={item.status}
        class="rounded-xl border border-border-weak-base bg-surface-success-weak p-4"
      >
        <p class="text-14-medium">
          {item.status === "completed" ? "Turn complete" : item.status === "stopped" ? "Turn stopped" : "Turn failed"}
        </p>
        <Show when={item.message}>
          <p class="mt-1 text-12-regular">{item.message}</p>
        </Show>
      </section>
    )
  return (
    <section
      data-agent-entry="failure"
      class="rounded-xl border border-border-critical-base bg-surface-critical-weak p-4"
    >
      <p class="text-14-medium">Session problem</p>
      <p class="mt-1 text-12-regular">{item.type === "failure" ? item.message : "The session could not continue."}</p>
    </section>
  )
}

export function SshAgenticSession(props: Props) {
  const [state, setState] = createSignal<OrchestratorState>(initialOrchestratorState())
  const [session, setSession] = createSignal(initialAgentSessionState())
  const [answer, setAnswer] = createSignal("")
  const [busy, setBusy] = createSignal(true)
  const [error, setError] = createSignal("")
  const [restored, setRestored] = createSignal(false)
  const [wireState, setWireState] = createSignal<OrchestratorWire>()
  const [following, setFollowing] = createSignal(true)
  const [newActivity, setNewActivity] = createSignal(false)
  const storage = appStorage()(AGENT_SESSION_STORAGE)
  let scroll: HTMLDivElement | undefined
  let closeWire: () => void = () => undefined
  let stopped = false
  let active = false
  let hydrated = false
  let reconciling = false
  let saves = Promise.resolve()

  createEffect(() => {
    const value = session()
    if (!hydrated || !value.sessionID) return
    saves = saves.then(() => writeAgentSession(storage, props.workspace, value)).catch(() => undefined)
  })

  const project = (action: Parameters<typeof reduceAgentSession>[1]) =>
    setSession((current) => reduceAgentSession(current, action))

  const showError = (cause: unknown, fallback: string) => {
    const message = cause instanceof Error ? cause.message : fallback
    setError(message)
    setState((current) => ({ ...current, phase: "error", error: message }))
    if (
      session().sessionID &&
      !/\b(?:ssh|transport|connection|network|orchestrator exited|transport closed)\b/i.test(message)
    )
      project({ type: "failure.added", id: `failure:${crypto.randomUUID()}`, message })
  }

  const event = (value: Record<string, unknown>) => {
    if (stopped || value.sessionID !== state().sessionID) return
    setState((current) => reduceOrchestratorEvent(current, value))
    project({ type: "event.received", value })
    if (value.type === "interaction.approval.requested" || value.type === "interaction.question.requested")
      queueMicrotask(() =>
        document
          .querySelector<HTMLElement>(
            "[data-agent-interaction-active='true'] button, [data-agent-interaction-active='true'] input",
          )
          ?.focus(),
      )
  }

  const applySnapshot = (value: ReturnType<typeof parseSnapshot> & {}) => {
    const pending = value.pending.map((item) =>
      item.kind === "approval"
        ? ({ id: item.id, revision: item.revision, kind: "approval", title: item.title } as const)
        : ({
            id: item.id,
            revision: item.revision,
            kind: "question",
            prompt: item.title,
            allowFreeform: true,
          } as const),
    )
    setState((current) => ({
      ...current,
      phase: snapshotPhase(value.session.state),
      sessionID: value.session.id,
      turnID: value.session.activeTurnID ?? value.session.lastTurnID,
      cursor: value.session.lastCursor,
      interaction: pending.at(-1),
      error: undefined,
    }))
    project({
      type: "backend.connected",
      version: value.session.backendVersion,
      mode: value.session.backendMode,
      capabilities: value.session.capabilities,
    })
    pending.forEach((interaction) =>
      project({
        type: "event.received",
        value: {
          kind: "event",
          type: interaction.kind === "approval" ? "interaction.approval.requested" : "interaction.question.requested",
          sessionID: value.session.id,
          interaction,
        },
      }),
    )
    value.artifacts.forEach((artifact) =>
      project({
        type: "event.received",
        value: { kind: "event", type: "artifact.created", sessionID: value.session.id, artifact },
      }),
    )
  }

  const replay = async (current: OrchestratorWire, sessionID: string, after?: string) => {
    let cursor = after
    for (let page = 0; page < 100; page++) {
      const result = parseReplay(await current.send(replayFrame(sessionID, cursor)))
      if (!result) throw new Error("The remote event replay response was invalid.")
      result.events.forEach(event)
      if (!result.hasMore) return
      const last = result.events.at(-1)
      if (!last || typeof last.cursor !== "string" || last.cursor === cursor)
        throw new Error("The remote replay cursor did not advance.")
      cursor = last.cursor
    }
    throw new Error("The remote event replay exceeded its safe page limit.")
  }

  const reconcile = async () => {
    const current = wireState()
    const sessionID = state().sessionID
    if (!current || !sessionID || reconciling) return
    reconciling = true
    try {
      const response = await current.send(snapshotFrame(sessionID))
      const snapshot = parseSnapshot(response.snapshot)
      if (!snapshot) throw new Error("The remote session snapshot was invalid.")
      applySnapshot(snapshot)
      await replay(current, sessionID, session().lastCursor).catch((cause) => {
        if (!(cause instanceof OrchestratorError) || cause.code !== "cursor_gap") throw cause
      })
    } catch (cause) {
      showError(cause, "Could not reconcile the remote agent session.")
    } finally {
      reconciling = false
    }
  }

  const start = async (saved?: AgentSessionState) => {
    if (!isOrchestratorAvailable(props.ssh)) {
      showError(
        new Error("Native SSH orchestration is unavailable on this device."),
        "Native SSH orchestration is unavailable.",
      )
      setBusy(false)
      return
    }
    stopped = false
    setRestored(Boolean(saved))
    setSession(saved ?? initialAgentSessionState())
    setBusy(true)
    setError("")
    setState({ ...initialOrchestratorState(), phase: "opening", ...(saved ? { lastPrompt: lastPrompt(saved) } : {}) })
    closeWire()
    if (active) await props.ssh.orchestratorStop().catch(() => undefined)
    active = false
    const next = wire(props.ssh)
    setWireState(next)
    closeWire = next.connect(event)
    let started = false
    try {
      const channel = await props.ssh.orchestratorStart(props.workspace.directory)
      next.scope(channel.id)
      started = true
      active = true
      const hello = parseHello(await next.send(helloFrame(props.workspace.agent)))
      if (!hello || hello.agent !== agentID(props.workspace.agent))
        throw new Error("The remote bridge does not support this agent with protocol v1.")
      const opened = await next.send(workspaceFrame(props.workspace.directory, props.workspace.agent))
      const workspace = opened.workspace
      if (
        !workspace ||
        typeof workspace !== "object" ||
        Array.isArray(workspace) ||
        (workspace as { id?: unknown }).id !== "wrk_android"
      )
        throw new Error("The remote workspace response was invalid.")
      project({
        type: "backend.connected",
        version: hello.backendVersion,
        mode: hello.backendMode,
        capabilities: hello.capabilities,
      })
      if (saved?.sessionID) {
        const attached = parseAttach(await next.send(sessionAttachFrame(saved.sessionID)))
        if (!attached) throw new Error("The remote session attach response was invalid.")
        applySnapshot(attached.snapshot)
        if (!attached.attached) {
          setState((current) => ({ ...current, phase: "stopped" }))
          setRestored(true)
          return
        }
        setRestored(false)
        try {
          await replay(next, saved.sessionID, saved.lastCursor)
        } catch (cause) {
          if (!(cause instanceof OrchestratorError) || cause.code !== "cursor_gap") throw cause
          applySnapshot(attached.snapshot)
        }
        return
      }
      const created = await next.send(sessionFrame(props.workspace.agent))
      const sessionID = responseID(created, "sessionID")
      if (!sessionID) throw new Error("The remote agent did not return a session.")
      setSession((current) => ({ ...current, sessionID }))
      setState((current) => ({ ...current, phase: "ready", sessionID }))
    } catch (cause) {
      await cleanupAgenticStart(props.ssh, () => setWireState(), closeWire, started)
      active = false
      closeWire = () => undefined
      showError(cause, "Could not start the remote agent session.")
    } finally {
      setBusy(false)
    }
  }

  onMount(() => {
    void readAgentSession(storage, props.workspace)
      .then((saved) => {
        if (stopped) return
        hydrated = true
        return start(saved)
      })
      .catch(() => {
        hydrated = true
        return start()
      })
  })

  onMount(() => {
    const releaseBack = installAndroidBack(() => busy())
    onCleanup(releaseBack)
  })

  onCleanup(() => {
    stopped = true
    closeWire()
    if (active) void props.ssh.orchestratorStop().catch(() => undefined)
  })

  const send = async () => {
    const value = session().draft.trim()
    const currentState = state()
    const current = wireState()
    if (!value || !currentState.sessionID || !current || busy() || !canSubmit(currentState.phase) || restored()) return
    project({ type: "prompt.submitted", id: `usr_${crypto.randomUUID().replaceAll("-", "")}`, text: value })
    setError("")
    setBusy(true)
    setState((previous) => ({ ...previous, phase: "running", lastPrompt: value, error: undefined }))
    try {
      const response = await current.send(
        currentState.phase === "running" && currentState.turnID && session().capabilities?.includes("steer")
          ? steerFrame(currentState.sessionID, currentState.turnID, value)
          : turnFrame(currentState.sessionID, value, props.workspace.agent),
      )
      const turnID = responseID(response, "turnID")
      if (turnID) setState((previous) => ({ ...previous, turnID }))
    } catch (cause) {
      showError(cause, "The remote agent could not start this turn.")
    } finally {
      setBusy(false)
    }
  }

  const respond = async (
    interaction: OrchestratorInteraction,
    decision?: "approved" | "rejected",
    supplied?: string,
  ) => {
    const sessionID = state().sessionID
    const current = wireState()
    const value = (supplied ?? answer()).trim()
    if (!sessionID || !current || busy() || (interaction.kind === "question" && !value)) return
    setBusy(true)
    setError("")
    try {
      await current.send(replyFrame(sessionID, interaction, value, decision))
      setAnswer("")
      project({
        type: "interaction.resolved",
        id: interaction.id,
        ...(interaction.kind === "approval" ? { decision } : { answer: value }),
      })
      const next = pendingInteraction(session().transcript, interaction.id)
      setState((previous) => ({
        ...previous,
        phase: next ? "waiting" : "running",
        interaction: next,
        error: undefined,
      }))
      queueMicrotask(() =>
        (next
          ? document.querySelector<HTMLElement>(
              "[data-agent-interaction-active='true'] button, [data-agent-interaction-active='true'] input",
            )
          : document.querySelector<HTMLTextAreaElement>("#agent-prompt")
        )?.focus(),
      )
    } catch (cause) {
      showError(cause, "The remote agent did not accept that response.")
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    const current = wireState()
    const value = state()
    if (busy() || !current || !value.sessionID || !value.turnID || !session().capabilities?.includes("cancel")) return
    setBusy(true)
    try {
      await current.send(cancelFrame(value.sessionID, value.turnID))
      setState((previous) => ({ ...previous, phase: "stopped" }))
    } catch (cause) {
      showError(cause, "Could not stop the remote agent.")
    }
    setBusy(false)
  }

  const disconnect = async () => {
    setBusy(true)
    stopped = true
    closeWire()
    active = false
    await props.ssh.orchestratorStop().catch(() => undefined)
    await props.ssh.disconnect().catch(() => undefined)
    props.onDisconnected()
  }

  const retry = async () => {
    const current = wireState()
    const value = state()
    if (busy() || !current || !value.sessionID || !value.turnID || !session().capabilities?.includes("retry")) return
    setBusy(true)
    try {
      await current.send(retryFrame(value.sessionID, value.turnID))
      setState((previous) => ({ ...previous, phase: "running", error: undefined }))
    } catch (cause) {
      showError(cause, "The remote agent could not retry this turn.")
    } finally {
      setBusy(false)
    }
  }

  const reconnect = async () => {
    if (busy()) return
    const value = state().lastPrompt ?? lastPrompt(session())
    setBusy(true)
    setError("")
    try {
      await reconnectAgentic(props.ssh, closeWire, value, () => start(session()))
      active = true
    } catch (cause) {
      showError(cause, "Could not reconnect the remote agent session.")
    } finally {
      setBusy(false)
    }
  }

  const interactive = async () => {
    if (busy() || restored()) return
    setBusy(true)
    setError("")
    try {
      await handoffToInteractive(props.ssh, closeWire, props.onInteractive)
      active = false
    } catch (cause) {
      showError(cause, "Could not stop the remote agent before opening the interactive CLI.")
      setBusy(false)
    }
  }

  const selectReview = (value: ReviewTab, focus = false) => {
    project({ type: "review.selected", value })
    if (focus) queueMicrotask(() => document.querySelector<HTMLButtonElement>(`[data-review-tab='${value}']`)?.focus())
  }

  const reviewKey = (event: KeyboardEvent, value: ReviewTab) => {
    const index = REVIEW_TABS.indexOf(value)
    const next =
      event.key === "ArrowRight"
        ? REVIEW_TABS[(index + 1) % REVIEW_TABS.length]
        : event.key === "ArrowLeft"
          ? REVIEW_TABS[(index - 1 + REVIEW_TABS.length) % REVIEW_TABS.length]
          : event.key === "Home"
            ? REVIEW_TABS[0]
            : event.key === "End"
              ? REVIEW_TABS.at(-1)
              : undefined
    if (!next) return
    event.preventDefault()
    selectReview(next, true)
  }

  const status = () => (restored() ? "Local snapshot" : phaseLabel(state().phase))
  const reviewed = () => reviewItems(session().transcript, session().selectedReview)
  const revision = createMemo(() => session().transcript.map(activity).join("\u0000"))
  const live = createMemo(() => (error() || state().error ? "" : announcement(session().transcript.at(-1), status())))

  createEffect(() => {
    revision()
    if (!scroll || session().transcript.length === 0) return
    requestAnimationFrame(() => {
      if (!scroll) return
      if (!following()) {
        setNewActivity(true)
        return
      }
      scroll.scrollTop = scroll.scrollHeight
      setNewActivity(false)
    })
  })

  const scrolled = () => {
    if (!scroll) return
    const near = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight <= 96
    setFollowing(near)
    if (near) setNewActivity(false)
  }

  const latest = () => {
    setFollowing(true)
    setNewActivity(false)
    if (scroll) scroll.scrollTop = scroll.scrollHeight
    requestAnimationFrame(() => {
      if (scroll) scroll.scrollTop = scroll.scrollHeight
    })
  }

  return (
    <SshShell
      workspace={props.workspace}
      sessionID={restored() ? undefined : state().sessionID}
      sessionState={status()}
    >
      <main
        data-agent-workspace
        data-agent-phase={state().phase}
        data-agent-detached={restored() ? "true" : undefined}
        class="min-h-screen bg-surface-base text-text-strong"
      >
        <section
          data-agent-panel
          class="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border-weak-base bg-surface-raised-base"
        >
          <header
            data-agent-app-bar
            data-agent-status={status()}
            class="flex items-center justify-between gap-3 border-b border-border-weak-base px-4 py-3"
          >
            <div class="min-w-0 pl-12">
              <p class="truncate text-14-medium">
                {agentName(props.workspace.agent)} · {status()}
              </p>
              <p class="truncate text-12-regular text-text-weak">{props.workspace.directory}</p>
            </div>
            <button
              type="button"
              data-agent-action="disconnect"
              onClick={() => void disconnect()}
              class="min-h-12 shrink-0 rounded-md border border-border-weak-base px-3 py-2 text-12-regular"
            >
              Disconnect
            </button>
          </header>

          <div
            ref={scroll}
            data-agent-scroll
            onScroll={scrolled}
            class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
          >
            <details data-agent-context class="mb-4 rounded-xl border border-border-weak-base bg-surface-base px-3">
              <summary class="cursor-pointer text-12-medium">Remote agent session context</summary>
              <dl class="grid gap-2 pb-3 text-12-regular">
                <div>
                  <dt class="text-text-weak">Computer</dt>
                  <dd class="break-all">{props.workspace.target}</dd>
                </div>
                <div>
                  <dt class="text-text-weak">Workspace</dt>
                  <dd class="break-all">{props.workspace.directory}</dd>
                </div>
                <div>
                  <dt class="text-text-weak">Agent</dt>
                  <dd>{agentName(props.workspace.agent)}</dd>
                </div>
              </dl>
            </details>

            <div data-agent-status-live role="status" aria-live="polite" aria-atomic="true" class="sr-only">
              {live()}
            </div>

            <Show when={restored()}>
              <section class="mb-4 rounded-xl border border-border-brand-base bg-surface-base p-4" data-agent-restored>
                <h1 class="text-16-medium">Local session snapshot restored</h1>
                <p class="mt-1 text-12-regular text-text-weak">
                  The remote session is detached. Its safe local transcript remains available, but it cannot receive
                  replies or events.
                </p>
                <button
                  type="button"
                  data-agent-action="start"
                  disabled={busy()}
                  onClick={() => void start()}
                  class="mt-3 min-h-12 rounded-md bg-surface-brand-base px-4 py-2 text-12-medium text-text-on-brand-base disabled:opacity-50"
                >
                  Start new session
                </button>
              </section>
            </Show>

            <Show when={!restored() && (state().phase === "completed" || state().phase === "stopped")}>
              <section
                class="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border-weak-base bg-surface-base p-4"
                data-agent-finished
              >
                <div>
                  <h1 class="text-14-medium">
                    {state().phase === "completed" ? "Session complete" : "Session stopped"}
                  </h1>
                  <p class="mt-1 text-12-regular text-text-weak">
                    Keep this result or begin with a clean conversation.
                  </p>
                </div>
                <button
                  type="button"
                  data-agent-action="new-session"
                  disabled={busy()}
                  onClick={() => void start()}
                  class="min-h-12 shrink-0 rounded-md bg-surface-brand-base px-4 py-2 text-12-medium text-text-on-brand-base disabled:opacity-50"
                >
                  Start new
                </button>
              </section>
            </Show>

            <Show when={error() || state().error}>
              <section
                role="alert"
                class="mb-4 rounded-xl border border-border-critical-base bg-surface-critical-weak p-4"
              >
                <p class="text-14-medium">{error() || state().error}</p>
                <p class="mt-1 text-12-regular text-text-weak">
                  Check the SSH connection and workspace access, then reconnect.
                </p>
                <button
                  type="button"
                  onClick={() => void reconnect()}
                  class="mt-3 min-h-12 rounded-md bg-surface-brand-base px-3 py-2 text-12-medium text-text-on-brand-base"
                >
                  Reconnect
                </button>
              </section>
            </Show>

            <Show when={props.workspace.agent === "antigravity-cli"}>
              <aside class="mb-4 rounded-xl border border-border-weak-base bg-surface-base p-3 text-12-regular text-text-weak">
                Antigravity runs in a sandboxed project scoped to this workspace. Its one-shot CLI does not expose
                structured approvals, so this mode automatically accepts its in-project actions.
              </aside>
            </Show>

            <section aria-label="Conversation" class="flex flex-col gap-3" data-agent-transcript>
              <Show when={session().transcript.length === 0 && !restored()}>
                <div class="py-6 text-center">
                  <h1 class="text-20-medium">What should the agent do?</h1>
                  <p class="mt-2 text-14-regular text-text-weak">
                    Ask for an outcome. Progress, decisions, and reported results will appear here.
                  </p>
                </div>
              </Show>
              <For each={session().transcript}>
                {(entry) => (
                  <Entry
                    entry={entry}
                    active={restored() ? undefined : state().interaction}
                    busy={busy()}
                    answer={answer()}
                    onAnswer={setAnswer}
                    onRespond={(interaction, decision, value) => void respond(interaction, decision, value)}
                  />
                )}
              </For>
            </section>

            <Show when={newActivity()}>
              <button
                type="button"
                data-agent-new-activity
                aria-label="Jump to new activity"
                onClick={latest}
                class="sticky bottom-2 z-10 mx-auto mt-3 block min-h-12 rounded-full bg-surface-brand-base px-4 py-2 text-12-medium text-text-on-brand-base shadow-md"
              >
                New activity
              </button>
            </Show>

            <section
              class="mt-6 border-t border-border-weak-base pt-4"
              aria-labelledby="review-title"
              data-agent-review
            >
              <div class="flex items-center justify-between gap-3">
                <h2 id="review-title" class="text-16-medium">
                  Review
                </h2>
                <span class="text-12-regular text-text-weak">Reported metadata only</span>
              </div>
              <div role="tablist" aria-label="Session review" class="mt-3 flex gap-1 overflow-x-auto pb-1">
                <For each={REVIEW_TABS}>
                  {(tab) => (
                    <button
                      id={`review-tab-${tab}`}
                      type="button"
                      role="tab"
                      data-review-tab={tab}
                      aria-selected={session().selectedReview === tab}
                      aria-controls={`review-panel-${tab}`}
                      tabIndex={session().selectedReview === tab ? 0 : -1}
                      onClick={() => selectReview(tab)}
                      onKeyDown={(event) => reviewKey(event, tab)}
                      class={`min-h-12 shrink-0 rounded-md px-3 py-2 text-12-medium ${session().selectedReview === tab ? "bg-surface-brand-base text-text-on-brand-base" : "border border-border-weak-base"}`}
                    >
                      {reviewLabel(tab)}
                    </button>
                  )}
                </For>
              </div>
              <div
                id={`review-panel-${session().selectedReview}`}
                data-review-panel
                data-review-selected={session().selectedReview}
                role="tabpanel"
                aria-labelledby={`review-tab-${session().selectedReview}`}
                tabIndex={0}
                class="mt-3 flex flex-col gap-2 rounded-xl bg-surface-raised-base p-3"
              >
                <Show
                  when={reviewed().length > 0}
                  fallback={
                    <p class="py-4 text-12-regular text-text-weak" data-review-empty>
                      {emptyReview(session().selectedReview)}
                    </p>
                  }
                >
                  <For each={reviewed()}>{(entry) => <ReviewItem entry={entry} tab={session().selectedReview} />}</For>
                </Show>
              </div>
            </section>

            <details class="mt-4 rounded-xl border border-border-weak-base bg-surface-base px-3">
              <summary class="cursor-pointer text-12-medium">Diagnostics</summary>
              <div class="pb-3 text-12-regular text-text-weak">
                <p>Transport: native SSH · backend: {agentID(props.workspace.agent)}</p>
                <p>
                  Backend version: {session().backendVersion ?? "checking"} · mode: {session().backendMode ?? "unknown"}
                </p>
                <p>Session: {restored() ? "not attached" : (state().sessionID ?? "starting")}</p>
                <p>Cursor: {session().lastCursor ?? state().cursor ?? "none"}</p>
                <p>
                  Raw PTY output is kept out of the primary experience. Use Interactive CLI for terminal prompts and
                  sign-in.
                </p>
                <button
                  type="button"
                  disabled={busy() || restored()}
                  onClick={() => void interactive()}
                  class="mt-3 min-h-12 rounded-md border border-border-weak-base px-3 py-2 text-12-medium disabled:opacity-50"
                >
                  Open Interactive CLI
                </button>
                <p class="mt-2">Opening it stops this agentic session and keeps this SSH workspace connected.</p>
              </div>
            </details>
          </div>

          <form
            data-agent-composer
            class="border-t border-border-weak-base bg-surface-raised-base p-3"
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            <label class="text-12-medium" for="agent-prompt">
              Message the agent
            </label>
            <div class="mt-2 flex items-end gap-2">
              <textarea
                id="agent-prompt"
                data-agent-prompt
                rows="2"
                value={session().draft}
                onInput={(event) => project({ type: "draft.changed", value: event.currentTarget.value })}
                placeholder={state().phase === "running" ? "Steer the current turn" : "Describe the outcome you want"}
                disabled={
                  busy() ||
                  restored() ||
                  !state().sessionID ||
                  (!canSubmit(state().phase) &&
                    !(state().phase === "running" && session().capabilities?.includes("steer")))
                }
                class="min-w-0 flex-1 resize-none rounded-xl border border-border-weak-base bg-surface-base px-3 py-3 text-14-regular disabled:opacity-50"
              />
              <button
                type="submit"
                data-agent-action="send"
                aria-label="Send message"
                disabled={
                  busy() ||
                  restored() ||
                  !session().draft.trim() ||
                  !state().sessionID ||
                  (!canSubmit(state().phase) &&
                    !(state().phase === "running" && session().capabilities?.includes("steer")))
                }
                class="min-h-12 rounded-xl bg-surface-brand-base px-4 py-3 text-12-medium text-text-on-brand-base disabled:opacity-50"
              >
                {state().phase === "running" ? "Steer" : "Send"}
              </button>
              <button
                type="button"
                data-agent-action="stop"
                aria-label="Stop agent"
                disabled={busy() || state().phase !== "running" || !session().capabilities?.includes("cancel")}
                onClick={() => void stop()}
                class="min-h-12 rounded-xl border border-border-weak-base px-3 py-3 text-12-medium disabled:opacity-50"
              >
                Stop
              </button>
            </div>
            <Show
              when={
                state().phase === "ready" &&
                state().lastPrompt &&
                canRetry(state().phase, state().sessionID, !!wireState())
              }
            >
              <button
                type="button"
                disabled={busy() || !session().capabilities?.includes("retry")}
                onClick={() => void retry()}
                class="mt-2 min-h-12 rounded-md border border-border-weak-base px-3 py-2 text-12-medium disabled:opacity-50"
              >
                Retry last request
              </button>
            </Show>
          </form>
        </section>
      </main>
    </SshShell>
  )
}
