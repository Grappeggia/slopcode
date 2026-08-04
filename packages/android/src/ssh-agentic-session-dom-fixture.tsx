import "@slopcode-ai/app/index.css"
import { render } from "solid-js/web"
import type { SshOrchestratorEvent, SshTransport } from "./ssh"
import { SshAgenticSession } from "./ssh-agentic-session"
import type { SshWorkspaceState } from "./ssh-workspace-state"

const workspace: SshWorkspaceState = {
  version: 1,
  target: "agent@void",
  profile: "agent@void:22",
  host: "void",
  port: 22,
  username: "agent",
  directory: "/work/fixture",
  agent: "codex-cli",
  recentTargets: [],
  recentFolders: [],
}

function storage() {
  const values = new Map<string, string>()
  const port: NonNullable<Window["SlopcodeAndroid"]> = {
    onmessage: null,
    postMessage(raw) {
      const request = JSON.parse(raw) as { id: string; method: string; args?: unknown[] }
      const args = request.args ?? []
      const key = `${String(args[0] ?? "")}:${String(args[1] ?? "")}`
      const result =
        request.method === "storageGet"
          ? values.get(key) ?? null
          : request.method === "systemInsets"
            ? { top: 0, right: 0, bottom: 0, left: 0, imeBottom: 0 }
            : null
      if (request.method === "storageSet" && typeof args[2] === "string") values.set(key, args[2])
      if (request.method === "storageRemove") values.delete(key)
      queueMicrotask(() => port.onmessage?.({ data: JSON.stringify({ id: request.id, ok: true, result }) }))
    },
  }
  window.SlopcodeAndroid = port
  return values
}

function transport() {
  let listener: (event: SshOrchestratorEvent) => void = () => undefined
  let turn: Record<string, unknown> | undefined
  let starts = 0
  const replies: Record<string, unknown>[] = []
  const line = (value: Record<string, unknown>) =>
    listener({ type: "output", id: "chn_dom_fixture", data: JSON.stringify(value) })
  const response = (value: Record<string, unknown>, result: Record<string, unknown> = {}) =>
    queueMicrotask(() => line({ kind: "response", requestID: value.requestID, ...result }))
  const ssh: SshTransport = {
    connect: async () => ({
      status: "connected",
      profile: workspace.profile,
      host: workspace.host,
      port: workspace.port,
      remoteTransport: true,
    }),
    cancelConnect: async () => undefined,
    trustHostKey: async () => ({
      status: "connected",
      profile: workspace.profile,
      host: workspace.host,
      port: workspace.port,
      remoteTransport: true,
    }),
    status: async () => ({ connected: true, remoteTransport: true, profile: workspace.profile }),
    disconnect: async () => undefined,
    cleanup: async () => undefined,
    home: async () => workspace.directory,
    list: async (path) => ({ path, entries: [] }),
    selectWorkspace: async (path) => path,
    execVersion: async (agent) => ({ agent, executable: agent, exitCode: 0, output: "ready", ok: true }),
    execAuthStatus: async (agent) => ({
      agent,
      executable: agent,
      exitCode: 0,
      output: "ready",
      ok: true,
      loggedIn: true,
    }),
    codexAppServerStatus: async () => ({
      executable: "codex",
      state: "ready",
      ready: true,
      handshake: "verified",
      message: "ready",
      output: "ready",
      preflight: { agent: "codex-cli", executable: "codex", exitCode: 0, output: "ready", ok: true },
    }),
    start: async (input) => ({ id: "pty_dom_fixture", status: "started", operation: input.operation }),
    orchestratorStart: async () => {
      starts += 1
      return { id: "chn_dom_fixture", status: "started" }
    },
    orchestratorInput: async (raw) => {
      const value = JSON.parse(raw) as Record<string, unknown>
      if (value.type === "workspace.open") response(value, { workspace: { id: "wrk_android" } })
      if (value.type === "session.create") response(value, { sessionID: "ses_dom_fixture" })
      if (value.type === "turn.create") turn = value
      if (value.type === "interaction.approval.reply" || value.type === "interaction.question.reply") {
        replies.push(value)
        response(value)
      }
    },
    orchestratorStop: async () => undefined,
    input: async () => undefined,
    resize: async () => undefined,
    interrupt: async () => undefined,
    credentialGet: async () => undefined,
    credentialSet: async () => undefined,
    credentialClear: async () => undefined,
    subscribe: () => () => undefined,
    subscribeOrchestrator: (next) => {
      listener = next
      return () => {
        if (listener === next) listener = () => undefined
      }
    },
  }
  return {
    ssh,
    event(type: string, value: Record<string, unknown> = {}) {
      line({
        version: "v1",
        kind: "event",
        cursor: `cur_${type}_${String(value.sequence ?? 1)}`,
        sequence: value.sequence ?? 1,
        sessionID: "ses_dom_fixture",
        turnID: "trn_dom_fixture",
        type,
        ...value,
      })
    },
    release() {
      if (!turn) throw new Error("The deterministic transport did not receive the prompt")
      response(turn, { turnID: "trn_dom_fixture" })
      turn = undefined
    },
    pending: () => !!turn,
    starts: () => starts,
    replies,
  }
}

function wait(check: () => boolean, message: string) {
  return new Promise<void>((resolve, reject) => {
    let attempts = 0
    const poll = () => {
      if (check()) return resolve()
      attempts += 1
      if (attempts >= 200) return reject(new Error(message))
      setTimeout(poll, 10)
    }
    poll()
  })
}

function input(node: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), "value")?.set
  setter?.call(node, value)
  node.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }))
}

function mark(name: string, value: boolean | string) {
  document.body.setAttribute(`data-${name}`, String(value))
}

async function journey() {
  const values = storage()
  const remote = transport()
  const root = document.getElementById("root")
  if (!(root instanceof HTMLElement)) throw new Error("SSH agentic session fixture root is unavailable")
  const mount = () =>
    render(
      () => (
        <SshAgenticSession
          ssh={remote.ssh}
          workspace={workspace}
          onInteractive={() => undefined}
          onDisconnected={() => undefined}
        />
      ),
      root,
    )
  const dispose = mount()
  await wait(
    () => document.querySelector("[data-agent-workspace]")?.getAttribute("data-agent-phase") === "ready",
    "The agent session did not become ready",
  )

  const panel = document.querySelector<HTMLElement>("[data-agent-panel]")
  const appbar = document.querySelector<HTMLElement>("[data-agent-app-bar]")
  const scroll = document.querySelector<HTMLElement>("[data-agent-scroll]")
  const context = document.querySelector<HTMLDetailsElement>("[data-agent-context]")
  const composer = document.querySelector<HTMLElement>("[data-agent-composer]")
  const prompt = document.querySelector<HTMLTextAreaElement>("[data-agent-prompt]")
  if (!panel || !appbar || !scroll || !context || !composer || !prompt)
    throw new Error("The first viewport structure is incomplete")
  const box = composer.getBoundingClientRect()
  mark(
    "first-viewport",
    panel.firstElementChild === appbar &&
      panel.lastElementChild === composer &&
      !context.open &&
      context.getBoundingClientRect().height <= 64 &&
      scroll.scrollTop === 0 &&
      box.top >= 0 &&
      box.bottom <= (window.visualViewport?.height ?? window.innerHeight) &&
      getComputedStyle(composer).position === "sticky",
  )

  const tabs = [...document.querySelectorAll<HTMLButtonElement>("[data-review-tab]")]
  mark("review-labels", tabs.map((tab) => tab.textContent?.trim()).join("|"))
  const empty = []
  for (const tab of tabs) {
    tab.click()
    await wait(
      () => document.querySelector("[data-review-panel]")?.getAttribute("data-review-selected") === tab.dataset.reviewTab,
      `The ${tab.dataset.reviewTab} review tab did not activate`,
    )
    empty.push(document.querySelector("[data-review-empty]")?.textContent?.trim() ?? "")
  }
  mark(
    "empty-states",
    empty.length === 4 &&
      empty[0]?.includes("change metadata") &&
      empty[1]?.includes("file metadata") &&
      empty[2]?.includes("test runs") &&
      empty[3]?.includes("screenshots"),
  )

  input(prompt, "Build the rendered fixture")
  prompt.form?.requestSubmit()
  await wait(() => !!document.querySelector('[data-agent-entry="user"]'), "The user prompt was not projected")
  mark(
    "immediate-prompt",
    remote.pending() &&
      document.querySelector('[data-agent-entry="user"]')?.textContent?.includes("Build the rendered fixture") === true &&
      !document.querySelector('[data-agent-entry="output"]'),
  )
  remote.release()
  await wait(() => !remote.pending(), "The turn response was not released")
  remote.event("turn.output", { sequence: 1, text: "Inspecting " })
  remote.event("turn.output", { sequence: 2, text: "the workspace." })
  remote.event("turn.reasoning", { sequence: 3, text: "Use the smallest safe change." })
  remote.event("tool.updated", {
    sequence: 4,
    tool: {
      id: "tol_edit_fixture",
      title: "Edit fixture.ts",
      status: "in_progress",
      kind: "edit",
      metadata: { path: "/work/fixture/fixture.ts", progress: "1/2", summary: "Writing fixture" },
    },
  })
  await wait(
    () => document.querySelector('[data-agent-entry="tool"]')?.textContent?.includes("1/2") === true,
    "The streamed tool was not rendered",
  )
  remote.event("tool.updated", {
    sequence: 5,
    tool: {
      id: "tol_edit_fixture",
      title: "Edit fixture.ts",
      status: "completed",
      kind: "edit",
      metadata: { path: "/work/fixture/fixture.ts", progress: "2/2", summary: "Fixture written" },
    },
  })
  await wait(
    () => document.querySelector('[data-agent-entry="tool"]')?.textContent?.includes("2/2") === true,
    "The streamed tool update was not rendered",
  )
  mark(
    "streamed-entries",
    document.querySelectorAll('[data-agent-entry="output"]').length === 1 &&
      document.querySelector('[data-agent-entry="output"]')?.textContent?.includes("Inspecting the workspace.") === true &&
      document.querySelectorAll('[data-agent-entry="reasoning"]').length === 1 &&
      document.querySelectorAll('[data-agent-entry="tool"]').length === 1,
  )

  remote.event("interaction.approval.requested", {
    sequence: 6,
    interaction: {
      id: "int_approval_fixture",
      revision: 1,
      title: "Apply fixture changes?",
      command: "write fixture.ts",
      cwd: workspace.directory,
      reason: "The fixture needs one file.",
      risk: "low",
    },
  })
  await wait(
    () => document.activeElement?.getAttribute("data-agent-action") === "approve",
    "Approval focus did not move to the primary response",
  )
  document.querySelector<HTMLButtonElement>('[data-agent-action="approve"]')?.click()
  await wait(
    () =>
      remote.replies.some((reply) => reply.type === "interaction.approval.reply") &&
      document.querySelector('[data-agent-entry="approval"]')?.textContent?.includes("Approved") === true,
    "The approval response was not sent",
  )
  mark(
    "approval",
    remote.replies.some((reply) => reply.type === "interaction.approval.reply" && reply.decision === "approved") &&
      document.querySelector('[data-agent-entry="approval"]')?.textContent?.includes("Approved") === true,
  )

  remote.event("interaction.question.requested", {
    sequence: 7,
    interaction: {
      id: "int_question_fixture",
      revision: 1,
      prompt: "Which fixture style should be used?",
      allowFreeform: true,
    },
  })
  await wait(
    () => document.activeElement?.getAttribute("data-agent-answer") === "int_question_fixture",
    "Question focus did not move to the labeled answer",
  )
  const answer = document.querySelector<HTMLInputElement>('[data-agent-answer="int_question_fixture"]')
  const label = document.querySelector<HTMLLabelElement>('label[for="agent-answer-int_question_fixture"]')
  if (!answer || !label) throw new Error("The labeled question answer was not rendered")
  input(answer, "Use the accessible style")
  document.querySelector<HTMLButtonElement>('[data-agent-action="answer"]')?.click()
  await wait(
    () =>
      remote.replies.some((reply) => reply.type === "interaction.question.reply") &&
      document.querySelector('[data-agent-entry="question"]')?.textContent?.includes("Use the accessible style") === true,
    "The question response was not sent",
  )
  mark(
    "question",
    label.textContent?.trim() === "Your answer" &&
      remote.replies.some(
        (reply) => reply.type === "interaction.question.reply" && reply.answer === "Use the accessible style",
      ) && document.querySelector('[data-agent-entry="question"]')?.textContent?.includes("Your answer") === true,
  )

  Array.from({ length: 18 }, (_, index) => index).forEach((index) => {
    remote.event(index % 2 ? "turn.output" : "turn.reasoning", {
      sequence: 20 + index,
      text: `Streaming activity ${index} ${"detail ".repeat(20)}`,
    })
  })
  await wait(() => scroll.scrollHeight > scroll.clientHeight, "The transcript did not become scrollable")
  scroll.scrollTop = 0
  scroll.dispatchEvent(new Event("scroll"))
  remote.event("turn.output", { sequence: 40, text: "New activity while reading history." })
  await wait(() => !!document.querySelector("[data-agent-new-activity]"), "New activity control was not shown")
  const beforeJump = scroll.scrollTop
  document.querySelector<HTMLButtonElement>("[data-agent-new-activity]")?.click()
  await wait(
    () => scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight <= 96,
    `New activity control did not jump to the latest output (${scroll.scrollHeight}:${scroll.scrollTop}:${scroll.clientHeight})`,
  )
  mark("scroll-follow", beforeJump <= 96 && !document.querySelector("[data-agent-new-activity]"))

  remote.event("tool.updated", {
    sequence: 8,
    tool: {
      id: "tol_test_fixture",
      title: "Run fixture tests",
      status: "completed",
      kind: "execute",
      metadata: { test: "DOM", result: "passed", exitCode: "0" },
    },
  })
  remote.event("artifact.created", {
    sequence: 9,
    artifact: {
      id: "art_diff_fixture",
      name: "fixture.diff",
      path: "/work/fixture/fixture.diff",
      kind: "diff",
      size: 128,
    },
  })
  remote.event("artifact.created", {
    sequence: 10,
    artifact: {
      id: "art_file_fixture",
      name: "fixture.ts",
      path: "/work/fixture/fixture.ts",
      kind: "file",
      size: 256,
    },
  })
  remote.event("artifact.created", {
    sequence: 11,
    artifact: {
      id: "art_image_fixture",
      name: "fixture.png",
      path: "/work/fixture/fixture.png",
      kind: "image",
      size: 512,
      mime: "image/png",
    },
  })
  const counts: string[] = []
  for (const tab of tabs) {
    tab.click()
    await wait(
      () => document.querySelector("[data-review-panel]")?.getAttribute("data-review-selected") === tab.dataset.reviewTab,
      `The populated ${tab.dataset.reviewTab} tab did not activate`,
    )
    counts.push(`${tab.dataset.reviewTab}:${document.querySelectorAll("[data-review-item]").length}`)
  }
  mark("review-projection", counts.join("|") === "changes:2|files:3|tests:1|screenshots:1")
  mark(
    "artifact-projection",
    document.querySelector('[data-review-item="artifact"]')?.textContent?.includes("fixture.png") === true &&
      document.querySelector('[data-review-item="artifact"]')?.textContent?.includes("preview unavailable") === true,
  )

  remote.event("turn.completed", { sequence: 12, status: "completed", message: "Fixture verified." })
  await wait(
    () => document.querySelector('[data-agent-entry="completion"]')?.textContent?.includes("Fixture verified.") === true,
    "Completion was not rendered",
  )
  mark(
    "completion-live",
    !document.querySelector('[data-agent-entry][aria-live]') &&
      !document.querySelector('[data-agent-transcript][aria-live]') &&
      document.querySelector("[data-agent-status-live]")?.getAttribute("role") === "status" &&
      document.querySelector("[data-agent-status-live]")?.getAttribute("aria-live") === "polite",
  )
  await wait(
    () => [...values.values()].some((value) => value.includes('"type":"completion"')),
    "The completed projection was not persisted",
  )

  const before = document.querySelectorAll("[data-agent-entry]").length
  dispose()
  const restore = mount()
  await wait(() => !!document.querySelector("[data-agent-restored]"), "The detached snapshot was not restored")
  const restored = document.querySelector<HTMLElement>("[data-agent-restored]")
  mark(
    "detached-restore",
    remote.starts() === 1 &&
      restored?.textContent?.includes("not attached") === true &&
      document.querySelectorAll("[data-agent-entry]").length === before &&
      document.querySelector<HTMLTextAreaElement>("[data-agent-prompt]")?.disabled === true &&
      document.querySelector('[data-review-tab="screenshots"]')?.getAttribute("aria-selected") === "true" &&
      document.querySelector('[data-agent-entry="approval"]')?.textContent?.includes("Approved") === true &&
      document.querySelector('[data-agent-entry="question"]')?.textContent?.includes("Use the accessible style") === true &&
      !document.querySelector("[data-ssh-active-session]"),
  )
  mark("fixture-complete", true)
  void restore
}

void journey().catch((error: unknown) => {
  mark("fixture-error", error instanceof Error ? error.message : "Unknown fixture failure")
})
