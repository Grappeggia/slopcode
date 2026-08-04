import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises"
import net from "node:net"
import path from "node:path"
import { PassThrough } from "node:stream"
import { spawn } from "node:child_process"
import { Schema } from "effect"
import { AgentOrchestrationFrame, AgentOrchestrationLimits } from "@slopcode-ai/protocol"
import { connect, type ACPEvent, type Session } from "@/remote-orchestrator/acp"
import { argv as appServerArgv, connect as connectCodex } from "@/remote-orchestrator/codex-app-server"
import { argv, connect as connectCli } from "@/remote-orchestrator/cli"
import { Bridge, run } from "@/remote-orchestrator/bridge"
import { approvalCwd, contained } from "@/remote-orchestrator/workspace"
import { create as createClaudePermission } from "@/remote-orchestrator/claude-permission"

const dirs: string[] = []
type Frame = typeof AgentOrchestrationFrame.Type
const temp = async () => {
  const dir = await mkdtemp(path.join(process.cwd(), ".remote-orchestrator-test-"))
  dirs.push(dir)
  return dir
}
const decode = Schema.decodeUnknownSync(AgentOrchestrationFrame)
const frame = (type: string, value: Record<string, unknown>) =>
  decode({
    version: "v1",
    kind: "request",
    type,
    requestID: `req_${type.replaceAll(".", "_")}`,
    idempotencyKey: `idem_${type.replaceAll(".", "_")}`,
    ...value,
  })
const waitFor = async (condition: () => boolean) => {
  for (let index = 0; index < 2_000 && !condition(); index++) await Bun.sleep(1)
  expect(condition()).toBe(true)
}
const claudePermissionRequest = async (config: string, tool: string, input: Record<string, unknown>) => {
  const value = await Bun.file(config).json()
  const server = value.mcpServers.slopcode_approval
  const socket = server.args[2]
  const token = server.args[4]
  return new Promise<string>((resolve, reject) => {
    const client = net.createConnection(socket)
    const id = crypto.randomUUID()
    let rest = ""
    client.once("connect", () => {
      client.write(`${JSON.stringify({ token })}\n`)
      client.write(`${JSON.stringify({ id, tool, input })}\n`)
    })
    client.setEncoding("utf8")
    client.on("data", (chunk: string) => {
      rest += chunk
      const index = rest.indexOf("\n")
      if (index < 0) return
      const response = JSON.parse(rest.slice(0, index))
      client.destroy()
      if (response.id !== id || typeof response.output !== "string")
        return reject(new Error("unexpected Claude approval"))
      resolve(response.output)
    })
    client.once("error", reject)
  })
}
type SessionResponse = Frame & { kind: "response"; type: "session.create"; sessionID: string }
const sessionResponses = (output: Frame[]) =>
  output.filter(
    (item): item is SessionResponse =>
      item.kind === "response" && item.type === "session.create" && typeof item.sessionID === "string",
  )

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe("remote orchestrator", () => {
  test("contains realpaths inside the configured root", async () => {
    const root = await temp()
    const child = path.join(root, "child")
    await mkdir(child)
    await Bun.write(path.join(child, ".keep"), "")
    expect(await contained(root, child)).toBe(child)
    await expect(contained(root, path.dirname(root))).rejects.toThrow("outside")
  })

  test("maps a real ACP subprocess lifecycle and preserves native IDs", async () => {
    const cwd = await temp()
    const events: ACPEvent[] = []
    const fixture = path.join(import.meta.dir, "fixture", "remote-orchestrator-acp-agent.ts")
    const session = await connect({
      agent: "slopcode",
      cwd,
      emit: (event) => events.push(event),
      start: () => spawn(process.execPath, [fixture], { cwd, shell: false, stdio: ["pipe", "pipe", "pipe"] }),
    })
    const turn = session.turn("fixture prompt")
    await waitFor(() => events.some((event) => event.type === "approval"))
    const approval = events.find((event) => event.type === "approval")
    expect(approval?.type).toBe("approval")
    if (approval?.type === "approval") expect(session.approval(approval.id, true)).toBe(true)
    await waitFor(() => events.some((event) => event.type === "question"))
    const question = events.find((event) => event.type === "question")
    expect(question?.type).toBe("question")
    if (question?.type === "question") expect(session.question(question.id, "yes")).toBe(true)
    await turn
    expect(session.nativeID).toBe("fixture-session")
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["output", "reasoning", "tool", "plan", "approval", "question", "artifact"]),
    )
    expect(events.find((event) => event.type === "output")).toMatchObject({ nativeID: "native-message" })
    await session.close()
  })

  test("wraps Codex and Claude one-shot CLIs through stdin", async () => {
    const cwd = await temp()
    const fixture = path.join(import.meta.dir, "fixture", "remote-orchestrator-cli-agent.ts")
    for (const agent of ["codex", "claude"] as const) {
      const events: ACPEvent[] = []
      const session = await connectCli({
        agent,
        cwd,
        emit: (event) => events.push(event),
        start: () => spawn(process.execPath, [fixture, agent], { cwd, shell: false, stdio: ["pipe", "pipe", "pipe"] }),
      })
      await session.turn("safe prompt")
      expect(session.capabilities).toEqual(
        agent === "claude"
          ? ["workspace", "sessions", "turns", "streaming", "approvals", "permissions"]
          : ["workspace", "sessions", "turns", "streaming"],
      )
      expect(events).toContainEqual(expect.objectContaining({ type: "output", text: `${agent}:safe prompt` }))
      expect(events).not.toContainEqual(expect.objectContaining({ text: expect.stringContaining('"thread.started"') }))
      expect(events).not.toContainEqual(expect.objectContaining({ text: expect.stringContaining('"turn.completed"') }))
      expect(session.approval("unknown", true)).toBe(false)
      expect(session.question("unknown", "answer")).toBe(false)
      await session.close()
    }
  })

  test("round-trips Claude CLI permissions through the native approval seam", async () => {
    const cwd = await temp()
    const events: ACPEvent[] = []
    const permission = await createClaudePermission({ cwd, emit: (event) => events.push(event) })
    const request = claudePermissionRequest(permission.config, "Write", { file_path: "index.html", content: "safe" })
    await waitFor(() => events.some((event) => event.type === "approval"))
    const approval = events.find((event): event is Extract<ACPEvent, { type: "approval" }> => event.type === "approval")
    expect(approval).toMatchObject({ title: "Claude wants to use Write", command: "index.html", cwd })
    if (approval) expect(permission.approval(approval.id, true)).toBe(true)
    expect(JSON.parse(await request)).toEqual({
      behavior: "allow",
      updatedInput: { file_path: "index.html", content: "safe" },
    })
    await permission.close()
  })

  test("uses the allowlisted Codex App Server lifecycle and maps rich events", async () => {
    const cwd = await temp()
    const events: ACPEvent[] = []
    const fixture = path.join(import.meta.dir, "fixture", "remote-orchestrator-codex-app-server.ts")
    const session = await connectCodex({
      cwd,
      emit: (event) => events.push(event),
      start: () => spawn(process.execPath, [fixture], { cwd, shell: false, stdio: ["pipe", "pipe", "pipe"] }),
    })
    expect(appServerArgv).toEqual(["codex", "app-server", "--stdio"])
    expect(session.nativeID).toBe("codex-thread")
    expect(session.capabilities).toEqual([
      "workspace",
      "sessions",
      "turns",
      "approvals",
      "questions",
      "plans",
      "artifacts",
      "replay",
      "streaming",
    ])
    const turn = session.turn("safe prompt")
    await waitFor(() => events.filter((event) => event.type === "approval").length >= 2)
    const approval = events.find((event) => event.type === "approval" && event.title === "Run fixture command")
    expect(approval).toMatchObject({
      type: "approval",
      title: "Run fixture command",
      command: "printf fixture",
      cwd,
    })
    for (const item of events.filter(
      (event): event is Extract<ACPEvent, { type: "approval" }> => event.type === "approval",
    ))
      expect(session.approval(item.id, true)).toBe(true)
    await waitFor(() => events.filter((event) => event.type === "question").length >= 2)
    const question = events.find((event) => event.type === "question" && event.prompt === "Continue fixture?")
    expect(question).toMatchObject({ type: "question", prompt: "Continue fixture?", options: ["Yes"] })
    for (const item of events.filter(
      (event): event is Extract<ACPEvent, { type: "question" }> => event.type === "question",
    ))
      expect(session.question(item.id, "Yes")).toBe(true)
    await turn
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["output", "reasoning", "tool", "plan", "approval", "question", "artifact"]),
    )
    expect(events.find((event) => event.type === "output")).toMatchObject({
      text: "Fixture complete",
      nativeID: "codex-message",
    })
    expect(events.find((event) => event.type === "artifact")).toMatchObject({
      name: "created.txt",
      path: path.join(cwd, "created.txt"),
      kind: "diff",
    })
    await session.close()
  })

  test("resumes Codex App Server threads through the adapter seam", async () => {
    const cwd = await temp()
    const fixture = path.join(import.meta.dir, "fixture", "remote-orchestrator-codex-app-server.ts")
    const session = await connectCodex({
      cwd,
      resume: "codex-thread",
      emit: () => undefined,
      start: () => spawn(process.execPath, [fixture], { cwd, shell: false, stdio: ["pipe", "pipe", "pipe"] }),
    })
    expect(session.nativeID).toBe("codex-thread")
    await session.close()
  })

  test("falls back to codex exec when Codex App Server cannot start", async () => {
    const cwd = await temp()
    const events: ACPEvent[] = []
    const fixture = path.join(import.meta.dir, "fixture", "remote-orchestrator-cli-agent.ts")
    const session = await connect({
      agent: "codex",
      cwd,
      emit: (event) => events.push(event),
      codexStart: () =>
        spawn(process.execPath, ["-e", 'process.stderr.write("app-server unavailable\\n"); process.exit(2)'], {
          cwd,
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
        }),
      cliStart: (_agent, dir) =>
        spawn(process.execPath, [fixture, "codex"], { cwd: dir, shell: false, stdio: ["pipe", "pipe", "pipe"] }),
    })
    expect(session.capabilities).toEqual(["workspace", "sessions", "turns", "streaming"])
    await session.turn("fallback prompt")
    expect(events).toContainEqual(expect.objectContaining({ type: "output", text: "codex:fallback prompt" }))
    await session.close()
  })

  test("passes Antigravity prompts as a single argv value and parses stream JSON", async () => {
    const cwd = await temp()
    const fixture = path.join(import.meta.dir, "fixture", "remote-orchestrator-cli-agent.ts")
    const prompt = 'safe; $(not-a-command) "quoted"\nnext line'
    const events: ACPEvent[] = []
    let value: readonly string[] = []
    const session = await connectCli({
      agent: "antigravity",
      cwd,
      emit: (event) => events.push(event),
      start: (agent, dir, text, format) => {
        value = argv(agent, text, format, undefined, dir)
        return spawn(process.execPath, [fixture, agent, text], {
          cwd: dir,
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
        })
      },
    })
    await session.turn(prompt)
    expect(value).toEqual([
      "agy",
      "--new-project",
      "--add-dir",
      cwd,
      "--sandbox",
      "--dangerously-skip-permissions",
      "--prompt",
      prompt,
      "--output-format",
      "stream-json",
    ])
    expect(events).toContainEqual(
      expect.objectContaining({ type: "output", text: `antigravity:${prompt.replaceAll("\n", " ")}` }),
    )
    await session.close()
  })

  test("keeps option-shaped Antigravity prompts in the named prompt argument", () => {
    for (const prompt of ["--help", "--dangerously-skip-permissions"]) {
      const value = argv("antigravity", prompt)
      expect(value).toEqual([
        "agy",
        "--new-project",
        "--add-dir",
        ".",
        "--sandbox",
        "--dangerously-skip-permissions",
        "--prompt",
        prompt,
        "--output-format",
        "stream-json",
      ])
      expect(argv("antigravity", prompt, "text")).toEqual([
        "agy",
        "--new-project",
        "--add-dir",
        ".",
        "--sandbox",
        "--dangerously-skip-permissions",
        "--prompt",
        prompt,
      ])
    }
  })

  test("falls back once to fixed text argv only for an unsupported stream-json option", async () => {
    const cwd = await temp()
    const fixture = path.join(import.meta.dir, "fixture", "remote-orchestrator-antigravity.ts")
    const prompt = 'safe; $(not-a-command) "quoted"\nnext line'
    const events: ACPEvent[] = []
    const launches: Array<readonly string[]> = []
    const session = await connectCli({
      agent: "antigravity",
      cwd,
      emit: (event) => events.push(event),
      start: (agent, dir, text, format) => {
        const value = argv(agent, text, format, undefined, dir)
        launches.push(value)
        return spawn(process.execPath, [fixture, ...value.slice(1)], {
          cwd: dir,
          env: { ...process.env, AGY_TEST_PROMPT: text },
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
        })
      },
    })
    await session.turn(prompt)
    expect(launches).toEqual([
      [
        "agy",
        "--new-project",
        "--add-dir",
        cwd,
        "--sandbox",
        "--dangerously-skip-permissions",
        "--prompt",
        prompt,
        "--output-format",
        "stream-json",
      ],
      ["agy", "--new-project", "--add-dir", cwd, "--sandbox", "--dangerously-skip-permissions", "--prompt", prompt],
    ])
    expect(events).toContainEqual(expect.objectContaining({ type: "output", text: "fallback-ok" }))
    await session.close()
  })

  test("does not launch text fallback after the session closes at the transition", async () => {
    const cwd = await temp()
    let launches = 0
    let session: Session | undefined
    const current = await connectCli({
      agent: "antigravity",
      cwd,
      emit: () => undefined,
      start: (_agent, dir) => {
        launches += 1
        const next = spawn(
          process.execPath,
          ["-e", "process.stderr.write(\"Error: unknown option '--output-format'\\n\"); process.exit(2)"],
          { cwd: dir, shell: false, stdio: ["pipe", "pipe", "pipe"] },
        )
        if (launches === 1) next.once("close", () => void session?.close())
        return next
      },
    })
    session = current
    await expect(current.turn("safe prompt")).rejects.toThrow("antigravity session is closed")
    expect(launches).toBe(1)
    await current.close()
  })

  test("does not retry arbitrary Antigravity failures", async () => {
    const cwd = await temp()
    let launches = 0
    const session = await connectCli({
      agent: "antigravity",
      cwd,
      emit: () => undefined,
      start: () => {
        launches += 1
        return spawn(process.execPath, ["-e", 'process.stderr.write("network failed\\n"); process.exit(7)'], {
          cwd,
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
        })
      },
    })
    await expect(session.turn("safe prompt")).rejects.toThrow("network failed")
    expect(launches).toBe(1)
    await session.close()
  })

  test("drops an oversized partial output record and parses the following record", async () => {
    const cwd = await temp()
    const events: ACPEvent[] = []
    const record = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "recovered output" }] },
    })
    const script = `process.stdout.write(${JSON.stringify("x".repeat(AgentOrchestrationLimits.maxTextBytes + 1))}); setTimeout(() => process.stdout.write(${JSON.stringify(`\n${record}\n`)}), 10)`
    const session = await connectCli({
      agent: "antigravity",
      cwd,
      emit: (event) => events.push(event),
      start: () => spawn(process.execPath, ["-e", script], { cwd, shell: false, stdio: ["pipe", "pipe", "pipe"] }),
    })
    await session.turn("ignored")
    expect(events.filter((event) => event.type === "output").map((event) => event.text)).toEqual(["recovered output"])
    await session.close()
  })

  test("falls back to text output and reports a missing Antigravity CLI", async () => {
    const cwd = await temp()
    const events: ACPEvent[] = []
    const text = await connectCli({
      agent: "antigravity",
      cwd,
      emit: (event) => events.push(event),
      start: () =>
        spawn(process.execPath, ["-e", 'process.stdout.write("plain output")'], {
          cwd,
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
        }),
    })
    await text.turn("ignored")
    expect(events).toContainEqual(expect.objectContaining({ type: "output", text: "plain output" }))
    const missing = await connectCli({
      agent: "antigravity",
      cwd,
      emit: () => undefined,
      start: () => spawn(path.join(cwd, "missing-agy"), [], { cwd, shell: false, stdio: ["pipe", "pipe", "pipe"] }),
    })
    await expect(missing.turn("ignored")).rejects.toThrow("ENOENT")
    await text.close()
    await missing.close()
  })

  test("routes Antigravity through the supported bridge adapter", async () => {
    const root = await temp()
    const output: Frame[] = []
    const opened: string[] = []
    let closed = 0
    const bridge = new Bridge(
      root,
      (value) => output.push(value),
      async (input) => {
        opened.push(input.agent)
        return {
          nativeID: "antigravity-session",
          capabilities: ["workspace", "sessions", "turns"],
          async turn() {},
          approval: () => false,
          question: () => false,
          async close() {
            closed += 1
          },
        }
      },
    )
    await bridge.handle(
      frame("workspace.open", {
        workspace: { id: "wrk_antigravity", path: root },
        agent: { id: "antigravity", capabilities: ["workspace", "sessions", "turns"] },
      }),
    )
    await bridge.handle(
      frame("session.create", {
        workspaceID: "wrk_antigravity",
        agent: "antigravity",
        requestID: "req_antigravity_session",
        idempotencyKey: "idem_antigravity_session",
      }),
    )
    expect(opened).toEqual(["antigravity"])
    expect(sessionResponses(output)).toHaveLength(1)
    await bridge.close()
    expect(closed).toBe(1)
  })

  test("omits invalid ACP approval locations without stranding permission requests", async () => {
    const cwd = await temp()
    const outside = await temp()
    const escape = path.join(cwd, "escape")
    await symlink(outside, escape)
    const invalidTarget = path.join(cwd, "invalid\nname")
    await Bun.write(invalidTarget, "invalid")
    const invalidLink = path.join(cwd, "invalid-link")
    await symlink(invalidTarget, invalidLink)
    const fixture = path.join(import.meta.dir, "fixture", "remote-orchestrator-acp-agent.ts")
    const values = [`${cwd}/bad\npath`, path.join(cwd, ".."), escape, invalidLink]
    await Promise.all(
      values.map(async (value) => {
        const events: ACPEvent[] = []
        const session = await connect({
          agent: "slopcode",
          cwd,
          emit: (event) => events.push(event),
          start: () =>
            spawn(process.execPath, [fixture], {
              cwd,
              env: { ...process.env, ACP_APPROVAL_CWD: value },
              shell: false,
              stdio: ["pipe", "pipe", "pipe"],
            }),
        })
        const turn = session.turn("fixture prompt")
        await waitFor(() => events.some((event) => event.type === "approval"))
        const approval = events.find((event) => event.type === "approval")
        expect(approval?.type).toBe("approval")
        if (approval?.type === "approval") {
          expect(approval.cwd).toBeUndefined()
          expect(session.approval(approval.id, true)).toBe(true)
        }
        await waitFor(() => events.some((event) => event.type === "question"))
        const question = events.find((event) => event.type === "question")
        expect(question?.type).toBe("question")
        if (question?.type === "question") expect(session.question(question.id, "yes")).toBe(true)
        await turn
        await session.close()
      }),
    )
  })

  test("uses fixed workspace/session/turn frames and only writes validated protocol JSON", async () => {
    const root = await temp()
    await Bun.write(path.join(root, "fixture.md"), "fixture")
    const output: Frame[] = []
    let approvals = 0
    let questions = 0
    let emit: ((event: ACPEvent) => void) | undefined
    const adapter: Session = {
      nativeID: "fixture-session",
      capabilities: ["workspace", "sessions", "turns", "approvals"],
      async turn() {
        emit?.({ type: "output", text: "hello", nativeID: "native-message" })
        emit?.({ type: "reasoning", text: "think", nativeID: "native-thought" })
        emit?.({ type: "tool", id: "native-tool", title: "run", status: "in_progress", kind: "execute" })
        emit?.({ type: "approval", id: "native-approval", title: "approve", resolve: () => undefined })
        emit?.({ type: "question", id: "native-question", prompt: "continue?", resolve: () => undefined })
        emit?.({ type: "plan", id: "native-plan", content: "- [ ] fixture" })
        emit?.({
          type: "artifact",
          id: "native-artifact",
          name: "fixture",
          path: path.join(root, "fixture.md"),
          kind: "report",
        })
        emit?.({ type: "retry", reason: "fixture retry" })
      },
      approval: () => ++approvals === 1,
      question: () => ++questions === 1,
      async close() {},
    }
    const bridge = new Bridge(
      root,
      (value) => output.push(value),
      async (input) => {
        emit = input.emit
        return adapter
      },
    )
    await bridge.handle(
      frame("workspace.open", {
        workspace: { id: "wrk_fixture", path: root },
        agent: { id: "slopcode", capabilities: ["workspace", "sessions", "turns"] },
      }),
    )
    await bridge.handle(frame("session.create", { workspaceID: "wrk_fixture", agent: "slopcode" }))
    const created = output.find((item) => item.kind === "response" && item.type === "session.create")
    const sessionID = created && "sessionID" in created ? created.sessionID : undefined
    expect(sessionID).toStartWith("ses_")
    await bridge.handle(frame("turn.create", { sessionID, agent: "slopcode", prompt: "hello" }))
    await waitFor(() => output.filter((item) => item.kind === "event").length >= 8)
    expect(output.filter((item) => item.kind === "event").map((item) => item.type)).toEqual(
      expect.arrayContaining([
        "turn.output",
        "turn.reasoning",
        "tool.updated",
        "interaction.approval.requested",
        "interaction.question.requested",
        "plan.available",
        "turn.retry",
      ]),
    )
    expect(() => output.forEach((item) => decode(item))).not.toThrow()
    const approval = output.find((item) => item.kind === "event" && item.type === "interaction.approval.requested")
    const question = output.find((item) => item.kind === "event" && item.type === "interaction.question.requested")
    if (approval?.kind === "event" && approval.type === "interaction.approval.requested") {
      await bridge.handle(
        frame("interaction.approval.reply", {
          sessionID,
          interactionID: approval.interaction.id,
          revision: 2,
          decision: "approved",
          requestID: "req_stale_approval",
          idempotencyKey: "idem_stale_approval",
        }),
      )
      expect(approvals).toBe(0)
      await bridge.handle(
        frame("interaction.approval.reply", {
          sessionID,
          interactionID: approval.interaction.id,
          revision: 1,
          decision: "approved",
          requestID: "req_approval",
          idempotencyKey: "idem_approval",
        }),
      )
      await bridge.handle(
        frame("interaction.approval.reply", {
          sessionID,
          interactionID: approval.interaction.id,
          revision: 1,
          decision: "approved",
          requestID: "req_replayed_approval",
          idempotencyKey: "idem_replayed_approval",
        }),
      )
      expect(approvals).toBe(1)
    }
    if (question?.kind === "event" && question.type === "interaction.question.requested") {
      await bridge.handle(
        frame("interaction.approval.reply", {
          sessionID,
          interactionID: question.interaction.id,
          revision: 1,
          decision: "approved",
          requestID: "req_wrong_question_kind",
          idempotencyKey: "idem_wrong_question_kind",
        }),
      )
      expect(questions).toBe(0)
      await bridge.handle(
        frame("interaction.question.reply", {
          sessionID,
          interactionID: question.interaction.id,
          revision: 1,
          answer: "yes",
          requestID: "req_question",
          idempotencyKey: "idem_question",
        }),
      )
      await bridge.handle(
        frame("interaction.question.reply", {
          sessionID,
          interactionID: question.interaction.id,
          revision: 1,
          answer: "yes",
          requestID: "req_replayed_question",
          idempotencyKey: "idem_replayed_question",
        }),
      )
      expect(questions).toBe(1)
    }
    await bridge.close()
  })

  test("keeps duplicate native approval IDs independent across sessions", async () => {
    const root = await temp()
    const output: Frame[] = []
    const approvals = new Set<number>()
    let count = 0
    const bridge = new Bridge(
      root,
      (value) => output.push(value),
      async (input) => {
        const owner = ++count
        return {
          nativeID: `native-${owner}`,
          capabilities: ["workspace", "sessions", "turns", "approvals"],
          async turn() {
            input.emit({ type: "approval", id: "shared-native-id", title: "approve", resolve: () => undefined })
          },
          approval(id) {
            if (id === "shared-native-id") approvals.add(owner)
            return id === "shared-native-id"
          },
          question: () => false,
          async close() {},
        }
      },
    )
    await bridge.handle(
      frame("workspace.open", {
        workspace: { id: "wrk_fixture", path: root },
        agent: { id: "slopcode", capabilities: ["workspace", "sessions", "turns"] },
      }),
    )
    await bridge.handle(
      frame("session.create", {
        workspaceID: "wrk_fixture",
        agent: "slopcode",
        requestID: "req_session_one",
        idempotencyKey: "idem_session_one",
      }),
    )
    await bridge.handle(
      frame("session.create", {
        workspaceID: "wrk_fixture",
        agent: "slopcode",
        requestID: "req_session_two",
        idempotencyKey: "idem_session_two",
      }),
    )
    const sessions = sessionResponses(output).map((item) => item.sessionID)
    await Promise.all(
      sessions.map((sessionID, index) =>
        bridge.handle(
          frame("turn.create", {
            sessionID,
            agent: "slopcode",
            prompt: "hello",
            requestID: `req_turn_session_${index}`,
            idempotencyKey: `idem_turn_session_${index}`,
          }),
        ),
      ),
    )
    await waitFor(
      () =>
        output.filter((item) => item.kind === "event" && item.type === "interaction.approval.requested").length >= 2,
    )
    const interactions = output.filter(
      (item): item is Extract<Frame, { kind: "event"; type: "interaction.approval.requested" }> =>
        item.kind === "event" && item.type === "interaction.approval.requested",
    )
    expect(interactions).toHaveLength(2)
    expect(new Set(interactions.map((item) => item.interaction.id)).size).toBe(2)
    await Promise.all(
      interactions.map((item, index) =>
        bridge.handle(
          frame("interaction.approval.reply", {
            sessionID: item.sessionID,
            interactionID: item.interaction.id,
            revision: 1,
            decision: "approved",
            requestID: `req_session_approval_${index}`,
            idempotencyKey: `idem_session_approval_${index}`,
          }),
        ),
      ),
    )
    expect(approvals).toEqual(new Set([1, 2]))
    await bridge.close()
  })

  test("revalidates canonical approval paths before protocol projection", async () => {
    const cwd = await temp()
    const invalid = path.join(cwd, "invalid\nname")
    await Bun.write(invalid, "invalid")
    const link = path.join(cwd, "link")
    await symlink(invalid, link)
    expect(await approvalCwd(cwd, link)).toBeUndefined()
    expect(await approvalCwd(cwd, `${cwd}/${"x".repeat(5_000)}`)).toBeUndefined()
    expect(await approvalCwd(cwd, `${cwd}/../outside`)).toBeUndefined()
  })

  test("rejects overlapping turns and keeps delayed events on their originating turn", async () => {
    const root = await temp()
    const output: Frame[] = []
    let emit: ((event: ACPEvent) => void) | undefined
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    let finish: () => void = () => undefined
    const done = new Promise<void>((resolve) => (finish = resolve))
    const bridge = new Bridge(
      root,
      (value) => output.push(value),
      async (input) => {
        emit = input.emit
        return {
          nativeID: "native-session",
          capabilities: ["workspace", "sessions", "turns"],
          async turn(prompt) {
            await gate
            emit?.({ type: "output", text: prompt })
            finish()
          },
          approval: () => false,
          question: () => false,
          async close() {},
        }
      },
    )
    await bridge.handle(
      frame("workspace.open", {
        workspace: { id: "wrk_overlap", path: root },
        agent: { id: "slopcode", capabilities: ["workspace", "sessions", "turns"] },
      }),
    )
    await bridge.handle(
      frame("session.create", {
        workspaceID: "wrk_overlap",
        agent: "slopcode",
        requestID: "req_overlap_session",
        idempotencyKey: "idem_overlap_session",
      }),
    )
    const created = output.find((item) => item.kind === "response" && item.type === "session.create")
    const sessionID = created && "sessionID" in created ? created.sessionID : undefined
    expect(sessionID).toStartWith("ses_")
    await bridge.handle(
      frame("turn.create", {
        sessionID,
        agent: "slopcode",
        prompt: "first",
        turnID: "trn_first",
        requestID: "req_first_turn",
        idempotencyKey: "idem_first_turn",
      }),
    )
    await bridge.handle(
      frame("turn.create", {
        sessionID,
        agent: "slopcode",
        prompt: "second",
        turnID: "trn_second",
        requestID: "req_second_turn",
        idempotencyKey: "idem_second_turn",
      }),
    )
    const conflict = output.find(
      (item): item is Extract<Frame, { kind: "error" }> =>
        item.kind === "error" && item.requestID === "req_second_turn",
    )
    expect(conflict).toMatchObject({ code: "bad_request", message: "a turn is already active for this session" })
    release()
    await done
    await waitFor(() => output.some((item) => item.kind === "event" && item.type === "turn.output"))
    const event = output.find(
      (item): item is Extract<Frame, { kind: "event"; type: "turn.output" }> =>
        item.kind === "event" && item.type === "turn.output",
    )
    expect(event).toMatchObject({ turnID: "trn_first", text: "first" })
    await bridge.close()
  })

  test("replays equivalent requests and rejects conflicting request reuse", async () => {
    const root = await temp()
    const output: Frame[] = []
    let opens = 0
    let turns = 0
    const bridge = new Bridge(
      root,
      (value) => output.push(value),
      async () => {
        opens++
        return {
          nativeID: "native-session",
          capabilities: ["workspace", "sessions", "turns"],
          async turn() {
            turns++
          },
          approval: () => false,
          question: () => false,
          async close() {},
        }
      },
    )
    await bridge.handle(
      frame("workspace.open", {
        workspace: { id: "wrk_idempotency", path: root },
        agent: { id: "slopcode", capabilities: ["workspace", "sessions", "turns"] },
      }),
    )
    const request = frame("session.create", {
      workspaceID: "wrk_idempotency",
      agent: "slopcode",
      requestID: "req_session_duplicate",
      idempotencyKey: "idem_session_duplicate",
    })
    await Promise.all([bridge.handle(request), bridge.handle(request)])
    expect(opens).toBe(1)
    const sessions = sessionResponses(output)
    expect(sessions).toHaveLength(2)
    expect(sessions[0]?.sessionID).toBe(sessions[1]?.sessionID)
    const sessionID = sessions[0]?.sessionID
    await bridge.handle(
      frame("session.create", {
        workspaceID: "wrk_idempotency",
        agent: "slopcode",
        title: "different payload",
        requestID: "req_session_duplicate",
        idempotencyKey: "idem_session_duplicate",
      }),
    )
    expect(output.at(-1)).toMatchObject({ kind: "error", code: "idempotency_conflict" })
    const turn = frame("turn.create", {
      sessionID,
      agent: "slopcode",
      prompt: "same prompt",
      requestID: "req_turn_duplicate",
      idempotencyKey: "idem_turn_duplicate",
    })
    await bridge.handle(turn)
    await bridge.handle(turn)
    expect(turns).toBe(1)
    expect(output.filter((item) => item.kind === "response" && item.type === "turn.create")).toHaveLength(2)
    await bridge.handle(
      frame("turn.create", {
        sessionID,
        agent: "slopcode",
        prompt: "different prompt",
        requestID: "req_turn_duplicate",
        idempotencyKey: "idem_turn_duplicate",
      }),
    )
    expect(output.at(-1)).toMatchObject({ kind: "error", code: "idempotency_conflict" })
    await bridge.close()
  })

  test("scopes public IDs and preserves per-session event order", async () => {
    const root = await temp()
    await Bun.write(path.join(root, "fixture.md"), "fixture")
    const output: Frame[] = []
    let owner = 0
    const bridge = new Bridge(
      root,
      (value) => output.push(value),
      async (input) => {
        const number = ++owner
        return {
          nativeID: "shared-native-session",
          capabilities: ["workspace", "sessions", "turns", "plans", "artifacts"],
          async turn() {
            input.emit({
              type: "artifact",
              id: "shared-artifact",
              name: "fixture",
              path: path.join(root, "fixture.md"),
              kind: "report",
            })
            input.emit({ type: "tool", id: "shared-tool", title: "tool", status: "completed", kind: "read" })
            input.emit({ type: "plan", id: "shared-plan", content: `plan ${number}` })
            input.emit({ type: "output", text: `output ${number}` })
          },
          approval: () => false,
          question: () => false,
          async close() {},
        }
      },
    )
    await bridge.handle(
      frame("workspace.open", {
        workspace: { id: "wrk_scoped", path: root },
        agent: { id: "slopcode", capabilities: ["workspace", "sessions", "turns"] },
      }),
    )
    await bridge.handle(
      frame("session.create", {
        workspaceID: "wrk_scoped",
        agent: "slopcode",
        requestID: "req_scope_one",
        idempotencyKey: "idem_scope_one",
      }),
    )
    await bridge.handle(
      frame("session.create", {
        workspaceID: "wrk_scoped",
        agent: "slopcode",
        requestID: "req_scope_two",
        idempotencyKey: "idem_scope_two",
      }),
    )
    const sessions = sessionResponses(output).map((item) => item.sessionID)
    await Promise.all(
      sessions.map((sessionID, index) =>
        bridge.handle(
          frame("turn.create", {
            sessionID,
            agent: "slopcode",
            prompt: `prompt ${index}`,
            requestID: `req_scope_turn_${index}`,
            idempotencyKey: `idem_scope_turn_${index}`,
          }),
        ),
      ),
    )
    await waitFor(() => output.filter((item) => item.kind === "event").length >= 10)
    const scoped = sessions.map((sessionID) =>
      output.filter((item) => item.kind === "event" && item.sessionID === sessionID),
    )
    expect(scoped.map((items) => items.map((item) => item.type))).toEqual([
      ["artifact.created", "tool.updated", "plan.available", "turn.output", "turn.completed"],
      ["artifact.created", "tool.updated", "plan.available", "turn.output", "turn.completed"],
    ])
    for (const items of scoped) {
      const tool = items.find((item) => item.kind === "event" && item.type === "tool.updated")
      const plan = items.find((item) => item.kind === "event" && item.type === "plan.available")
      const artifact = items.find((item) => item.kind === "event" && item.type === "artifact.created")
      if (tool?.kind === "event" && tool.type === "tool.updated") expect(tool.tool.id).toStartWith("tol_")
      if (plan?.kind === "event" && plan.type === "plan.available") expect(plan.plan.id).toStartWith("pln_")
      if (artifact?.kind === "event" && artifact.type === "artifact.created")
        expect(artifact.artifact.id).toStartWith("art_")
    }
    expect(
      new Set(
        scoped.flatMap((items) =>
          items.flatMap((item) => (item.kind === "event" && item.type === "tool.updated" ? [item.tool.id] : [])),
        ),
      ).size,
    ).toBe(2)
    expect(
      new Set(
        scoped.flatMap((items) =>
          items.flatMap((item) => (item.kind === "event" && item.type === "plan.available" ? [item.plan.id] : [])),
        ),
      ).size,
    ).toBe(2)
    expect(
      new Set(
        scoped.flatMap((items) =>
          items.flatMap((item) =>
            item.kind === "event" && item.type === "artifact.created" ? [item.artifact.id] : [],
          ),
        ),
      ).size,
    ).toBe(2)
    await bridge.close()
  })

  test("returns explicit backend preflight details", async () => {
    const root = await temp()
    const output: Frame[] = []
    const bridge = new Bridge(
      root,
      (value) => output.push(value),
      async () => {
        throw new Error("session open is not part of preflight")
      },
      async (agent) => ({
        version: `${agent} 1.2.3`,
        mode: agent === "codex" ? "app_server" : "acp",
        capabilities: ["workspace", "sessions", "turns", "replay"],
      }),
    )
    await bridge.handle(frame("bridge.hello", { agent: "codex" }))
    expect(output.at(-1)).toMatchObject({
      kind: "response",
      type: "bridge.hello",
      bridgeVersion: "1.0.0",
      protocolVersion: "v1",
      agent: "codex",
      backendVersion: "codex 1.2.3",
      backendMode: "app_server",
      capabilities: ["workspace", "sessions", "turns", "replay"],
    })
    await bridge.close()
  })

  test("survives bridge restart with redacted replay, snapshots, and durable idempotency", async () => {
    const root = await temp()
    const first: Frame[] = []
    let opens = 0
    const session = (emit: (event: ACPEvent) => void): Session => ({
      nativeID: "durable-native-session",
      capabilities: ["workspace", "sessions", "turns", "replay"],
      mode: "acp",
      version: "fixture 1.0.0",
      resumable: true,
      async turn() {
        emit({ type: "output", text: "sensitive model output", nativeID: "native-output" })
        emit({ type: "reasoning", text: "sensitive reasoning", nativeID: "native-reasoning" })
      },
      approval: () => false,
      question: () => false,
      async close() {},
    })
    const bridge = new Bridge(
      root,
      (value) => first.push(value),
      async (input) => {
        opens++
        return session(input.emit)
      },
    )
    const opened = frame("workspace.open", {
      workspace: { id: "wrk_durable", path: root, metadata: { note: "sensitive workspace value" } },
      agent: { id: "opencode", capabilities: ["workspace", "sessions", "turns", "replay"] },
      requestID: "req_durable_workspace",
      idempotencyKey: "idem_durable_workspace",
    })
    const created = frame("session.create", {
      workspaceID: "wrk_durable",
      agent: "opencode",
      requestID: "req_durable_session",
      idempotencyKey: "idem_durable_session",
    })
    await bridge.handle(opened)
    await bridge.handle(created)
    const response = sessionResponses(first).at(-1)
    expect(response?.sessionID).toStartWith("ses_")
    await bridge.handle(
      frame("turn.create", {
        sessionID: response?.sessionID,
        turnID: "trn_durable",
        agent: "opencode",
        prompt: "sensitive user prompt",
        requestID: "req_durable_turn",
        idempotencyKey: "idem_durable_turn",
      }),
    )
    await waitFor(() => first.some((item) => item.kind === "event" && item.type === "turn.completed"))
    const journal = await Bun.file(path.join(root, ".slopcode", "remote-orchestrator", "v1.json")).text()
    expect(journal).not.toContain("sensitive user prompt")
    expect(journal).not.toContain("sensitive model output")
    expect(journal).not.toContain("sensitive reasoning")
    expect(journal).not.toContain("sensitive workspace value")
    expect(journal).toContain("[output redacted for resume]")

    const second: Frame[] = []
    const restarted = new Bridge(
      root,
      (value) => second.push(value),
      async (input) => {
        opens++
        return session(input.emit)
      },
    )
    await restarted.handle(
      frame("workspace.open", {
        workspace: { id: "wrk_durable", path: root },
        agent: { id: "opencode", capabilities: ["workspace", "sessions", "turns", "replay"] },
        requestID: "req_durable_restart",
        idempotencyKey: "idem_durable_restart",
      }),
    )
    await restarted.handle(created)
    expect(opens).toBe(1)
    expect(sessionResponses(second).at(-1)?.sessionID).toBe(response?.sessionID)
    await restarted.handle(
      frame("session.list", {
        workspaceID: "wrk_durable",
        requestID: "req_durable_list",
        idempotencyKey: "idem_durable_list",
      }),
    )
    expect(second.at(-1)).toMatchObject({
      kind: "response",
      type: "session.list",
      sessions: [{ id: response?.sessionID, state: "completed", lastCursor: expect.stringMatching(/^cur_/) }],
    })
    await restarted.handle(
      frame("session.snapshot", {
        sessionID: response?.sessionID,
        requestID: "req_durable_snapshot",
        idempotencyKey: "idem_durable_snapshot",
      }),
    )
    expect(second.at(-1)).toMatchObject({
      kind: "response",
      type: "session.snapshot",
      snapshot: { authoritative: true, session: { id: response?.sessionID, state: "completed" } },
    })
    await restarted.handle(
      frame("event.replay", {
        sessionID: response?.sessionID,
        limit: 1,
        requestID: "req_durable_replay_one",
        idempotencyKey: "idem_durable_replay_one",
      }),
    )
    const replay = second.at(-1)
    expect(replay).toMatchObject({ kind: "response", type: "event.replay", hasMore: true })
    if (replay?.kind === "response" && replay.type === "event.replay") {
      expect(replay.events[0]).toMatchObject({ type: "turn.output", text: "[output redacted for resume]" })
      await restarted.handle(
        frame("event.replay", {
          sessionID: response?.sessionID,
          afterCursor: replay.events[0]?.cursor,
          limit: 100,
          requestID: "req_durable_replay_next",
          idempotencyKey: "idem_durable_replay_next",
        }),
      )
      const continued = second.at(-1)
      expect(continued).toMatchObject({ kind: "response", type: "event.replay", hasMore: false })
      if (continued?.kind === "response" && continued.type === "event.replay")
        expect(continued.events.map((item) => item.sequence)).toEqual(
          [...continued.events].map((item) => item.sequence).sort((a, b) => a - b),
        )
    }
    await bridge.close()
    await restarted.close()
  })

  test("replays persisted events after an actual bridge subprocess restart", async () => {
    const root = await temp()
    const fixture = path.join(import.meta.dir, "fixture", "remote-orchestrator-restart-child.ts")
    const start = () => {
      const child = spawn(process.execPath, [fixture, root], {
        cwd: root,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      })
      const output: Frame[] = []
      let rest = ""
      child.stdout?.setEncoding("utf8")
      child.stdout?.on("data", (chunk: string) => {
        rest += chunk
        let index = rest.indexOf("\n")
        while (index >= 0) {
          const line = rest.slice(0, index)
          rest = rest.slice(index + 1)
          if (line) output.push(decode(JSON.parse(line)))
          index = rest.indexOf("\n")
        }
      })
      return { child, output }
    }
    const stop = async (child: ReturnType<typeof spawn>) => {
      child.stdin?.end()
      await new Promise<void>((resolve, reject) => {
        child.once("error", reject)
        child.once("close", (code) => (code === 0 ? resolve() : reject(new Error(`restart fixture exited ${code}`))))
      })
    }
    const opened = frame("workspace.open", {
      workspace: { id: "wrk_process_restart", path: root },
      agent: { id: "opencode", capabilities: ["workspace", "sessions", "turns", "replay"] },
      requestID: "req_process_workspace",
      idempotencyKey: "idem_process_workspace",
    })
    const created = frame("session.create", {
      workspaceID: "wrk_process_restart",
      agent: "opencode",
      requestID: "req_process_session",
      idempotencyKey: "idem_process_session",
    })
    const first = start()
    first.child.stdin?.write(`${JSON.stringify(opened)}\n`)
    await waitFor(() => first.output.some((item) => item.kind === "response" && item.type === "workspace.open"))
    first.child.stdin?.write(`${JSON.stringify(created)}\n`)
    await waitFor(() => sessionResponses(first.output).length === 1)
    const id = sessionResponses(first.output)[0]!.sessionID
    first.child.stdin?.write(
      `${JSON.stringify(
        frame("turn.create", {
          sessionID: id,
          turnID: "trn_process_restart",
          agent: "opencode",
          prompt: "process restart prompt",
          requestID: "req_process_turn",
          idempotencyKey: "idem_process_turn",
        }),
      )}\n`,
    )
    await waitFor(() => first.output.some((item) => item.kind === "event" && item.type === "turn.completed"))
    await stop(first.child)

    const second = start()
    second.child.stdin?.write(
      `${JSON.stringify(
        frame("workspace.open", {
          workspace: { id: "wrk_process_restart", path: root },
          agent: { id: "opencode", capabilities: ["workspace", "sessions", "turns", "replay"] },
          requestID: "req_process_workspace_restart",
          idempotencyKey: "idem_process_workspace_restart",
        }),
      )}\n`,
    )
    await waitFor(() => second.output.some((item) => item.kind === "response" && item.type === "workspace.open"))
    second.child.stdin?.write(`${JSON.stringify(created)}\n`)
    await waitFor(() => sessionResponses(second.output).length === 1)
    expect(sessionResponses(second.output)[0]?.sessionID).toBe(id)
    second.child.stdin?.write(
      `${JSON.stringify(
        frame("event.replay", {
          sessionID: id,
          limit: 100,
          requestID: "req_process_replay",
          idempotencyKey: "idem_process_replay",
        }),
      )}\n`,
    )
    await waitFor(() => second.output.some((item) => item.kind === "response" && item.type === "event.replay"))
    const replay = second.output.find((item) => item.kind === "response" && item.type === "event.replay")
    if (replay?.kind === "response" && replay.type === "event.replay")
      expect(replay.events.map((item) => item.type)).toEqual(["turn.output", "turn.completed"])
    await stop(second.child)
  })

  test("recovers an abrupt active turn as an authoritative interrupted snapshot", async () => {
    const root = await temp()
    const first: Frame[] = []
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    const bridge = new Bridge(
      root,
      (value) => first.push(value),
      async () => ({
        nativeID: "interrupted-native",
        capabilities: ["workspace", "sessions", "turns", "replay"],
        mode: "acp",
        version: "fixture 1.0.0",
        resumable: true,
        turn: () => gate,
        approval: () => false,
        question: () => false,
        async close() {},
      }),
    )
    await bridge.handle(
      frame("workspace.open", {
        workspace: { id: "wrk_interrupted", path: root },
        agent: { id: "opencode", capabilities: ["workspace", "sessions", "turns", "replay"] },
      }),
    )
    await bridge.handle(frame("session.create", { workspaceID: "wrk_interrupted", agent: "opencode" }))
    const id = sessionResponses(first).at(-1)?.sessionID
    await bridge.handle(
      frame("turn.create", { sessionID: id, turnID: "trn_interrupted", agent: "opencode", prompt: "go" }),
    )

    const output: Frame[] = []
    const restarted = new Bridge(root, (value) => output.push(value))
    await restarted.handle(
      frame("workspace.open", {
        workspace: { id: "wrk_interrupted", path: root },
        agent: { id: "opencode", capabilities: ["workspace", "sessions", "turns", "replay"] },
        requestID: "req_interrupted_restart",
        idempotencyKey: "idem_interrupted_restart",
      }),
    )
    await restarted.handle(
      frame("session.snapshot", {
        sessionID: id,
        requestID: "req_interrupted_snapshot",
        idempotencyKey: "idem_interrupted_snapshot",
      }),
    )
    expect(output.at(-1)).toMatchObject({
      kind: "response",
      type: "session.snapshot",
      snapshot: {
        authoritative: true,
        session: { id, state: "interrupted", lastTurnID: "trn_interrupted" },
      },
    })
    expect(JSON.stringify(output.at(-1))).not.toContain("activeTurnID")
    release()
    await waitFor(() => first.some((item) => item.kind === "event" && item.type === "turn.completed"))
    await bridge.close()
    await restarted.close()
  })

  test("returns a cursor gap and authoritative snapshot after the retained tail advances", async () => {
    const root = await temp()
    const output: Frame[] = []
    const bridge = new Bridge(
      root,
      (value) => output.push(value),
      async (input) => ({
        nativeID: "tail-native",
        capabilities: ["workspace", "sessions", "turns", "replay"],
        mode: "acp",
        version: "fixture 1.0.0",
        resumable: true,
        async turn() {
          for (let index = 0; index < 130; index++) input.emit({ type: "output", text: `event ${index}` })
        },
        approval: () => false,
        question: () => false,
        async close() {},
      }),
    )
    await bridge.handle(
      frame("workspace.open", {
        workspace: { id: "wrk_tail", path: root },
        agent: { id: "opencode", capabilities: ["workspace", "sessions", "turns", "replay"] },
      }),
    )
    await bridge.handle(frame("session.create", { workspaceID: "wrk_tail", agent: "opencode" }))
    const id = sessionResponses(output).at(-1)?.sessionID
    await bridge.handle(frame("turn.create", { sessionID: id, agent: "opencode", prompt: "tail" }))
    await waitFor(() => output.some((item) => item.kind === "event" && item.type === "turn.completed"))
    await bridge.handle(
      frame("event.replay", {
        sessionID: id,
        afterCursor: "cur_1",
        limit: 100,
        requestID: "req_tail_gap",
        idempotencyKey: "idem_tail_gap",
      }),
    )
    expect(output.at(-1)).toMatchObject({
      kind: "error",
      code: "cursor_gap",
      retryable: false,
      details: { snapshotRequired: "true" },
    })
    await bridge.handle(
      frame("session.snapshot", {
        sessionID: id,
        requestID: "req_tail_snapshot",
        idempotencyKey: "idem_tail_snapshot",
      }),
    )
    expect(output.at(-1)).toMatchObject({
      kind: "response",
      type: "session.snapshot",
      snapshot: { authoritative: true },
    })
    await bridge.close()
  })

  test("rejects corrupt, oversized, and symlinked state journals", async () => {
    const cases = ["corrupt", "oversized", "symlink"] as const
    for (const item of cases) {
      const root = await temp()
      const dir = path.join(root, ".slopcode", "remote-orchestrator")
      if (item === "symlink") {
        const outside = await temp()
        await symlink(outside, path.join(root, ".slopcode"), "dir")
      }
      if (item !== "symlink") {
        await mkdir(dir, { recursive: true })
        await Bun.write(path.join(dir, "v1.json"), item === "corrupt" ? "not json" : "x".repeat(2 * 1024 * 1024 + 1))
      }
      const output: Frame[] = []
      const bridge = new Bridge(root, (value) => output.push(value))
      await bridge.handle(
        frame("workspace.open", {
          workspace: { id: `wrk_${item}`, path: root },
          agent: { id: "opencode", capabilities: ["workspace"] },
          requestID: `req_${item}_journal`,
          idempotencyKey: `idem_${item}_journal`,
        }),
      )
      expect(output.at(-1)).toMatchObject({
        kind: "error",
        code: item === "corrupt" ? "bad_request" : item === "oversized" ? "too_large" : "path_forbidden",
        retryable: false,
      })
      await bridge.close()
    }
  })

  test("routes supported turn controls only to the active provider turn", async () => {
    const root = await temp()
    const output: Frame[] = []
    const calls: string[] = []
    let release: () => void = () => undefined
    let finish: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    const finished = new Promise<void>((resolve) => (finish = resolve))
    const bridge = new Bridge(
      root,
      (value) => output.push(value),
      async () => ({
        nativeID: "controls-native",
        capabilities: ["workspace", "sessions", "turns", "cancel", "retry", "steer"],
        mode: "app_server",
        version: "fixture 1.0.0",
        resumable: true,
        async turn() {
          await gate
          finish()
        },
        async cancel(id) {
          calls.push(`cancel:${id}`)
          return true
        },
        async retry(id) {
          calls.push(`retry:${id}`)
          return true
        },
        async steer(id, instruction) {
          calls.push(`steer:${id}:${instruction}`)
          return true
        },
        approval: () => false,
        question: () => false,
        async close() {},
      }),
    )
    await bridge.handle(
      frame("workspace.open", {
        workspace: { id: "wrk_controls", path: root },
        agent: { id: "codex", capabilities: ["workspace", "sessions", "turns"] },
      }),
    )
    await bridge.handle(frame("session.create", { workspaceID: "wrk_controls", agent: "codex" }))
    const id = sessionResponses(output).at(-1)?.sessionID
    await bridge.handle(
      frame("turn.create", { sessionID: id, turnID: "trn_controls", agent: "codex", prompt: "start" }),
    )
    await bridge.handle(
      frame("turn.steer", {
        sessionID: id,
        turnID: "trn_controls",
        instruction: "focus tests",
        requestID: "req_controls_steer",
        idempotencyKey: "idem_controls_steer",
      }),
    )
    await bridge.handle(
      frame("turn.cancel", {
        sessionID: id,
        turnID: "trn_controls",
        requestID: "req_controls_cancel",
        idempotencyKey: "idem_controls_cancel",
      }),
    )
    expect(output.filter((item) => item.kind === "event" && item.type === "turn.completed")).toHaveLength(1)
    await bridge.handle(
      frame("turn.retry", {
        sessionID: id,
        turnID: "trn_controls",
        requestID: "req_controls_retry",
        idempotencyKey: "idem_controls_retry",
      }),
    )
    expect(calls).toEqual(["steer:trn_controls:focus tests", "cancel:trn_controls", "retry:trn_controls"])
    expect(output.at(-1)).toMatchObject({ kind: "response", type: "turn.retry", turnID: "trn_controls" })
    release()
    await finished
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(output.filter((item) => item.kind === "event" && item.type === "turn.completed")).toHaveLength(1)
    await bridge.close()
  })

  test("returns stable non-retryable errors for provider-unsupported turn operations", async () => {
    const root = await temp()
    const output: Frame[] = []
    const bridge = new Bridge(
      root,
      (value) => output.push(value),
      async () => ({
        nativeID: "limited-native",
        capabilities: ["workspace", "sessions", "turns"],
        mode: "streaming_cli",
        version: "fixture 1.0.0",
        resumable: false,
        async turn() {},
        approval: () => false,
        question: () => false,
        async close() {},
      }),
    )
    await bridge.handle(
      frame("workspace.open", {
        workspace: { id: "wrk_limited", path: root },
        agent: { id: "claude", capabilities: ["workspace", "sessions", "turns"] },
      }),
    )
    await bridge.handle(frame("session.create", { workspaceID: "wrk_limited", agent: "claude" }))
    const id = sessionResponses(output).at(-1)?.sessionID
    for (const type of ["turn.cancel", "turn.retry", "turn.steer"] as const) {
      await bridge.handle(
        frame(type, {
          sessionID: id,
          turnID: "trn_unsupported",
          ...(type === "turn.steer" ? { instruction: "change direction" } : {}),
          requestID: `req_${type.replace(".", "_")}`,
          idempotencyKey: `idem_${type.replace(".", "_")}`,
        }),
      )
      expect(output.at(-1)).toMatchObject({
        kind: "error",
        code: "unsupported_operation",
        retryable: false,
      })
    }
    await bridge.close()
  })

  test("bounds JSON lines and never sends diagnostics to stdout", async () => {
    const root = await temp()
    const stdin = new PassThrough()
    const stdout = new PassThrough()
    let output = ""
    stdout.on("data", (chunk: Buffer) => (output += chunk.toString()))
    const done = run({ root, stdin, stdout })
    stdin.end(
      `${JSON.stringify({ version: "v1", kind: "request", type: "workspace.open", requestID: "req_fixture", idempotencyKey: "idem_fixture", workspace: { id: "wrk_fixture", path: root }, agent: { id: "slopcode", capabilities: ["workspace"] } })}\nnot-json\n`,
    )
    await done
    const frames = output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => decode(JSON.parse(line)))
    expect(frames).toHaveLength(1)
    expect(frames[0]?.type).toBe("workspace.open")
  })
})
