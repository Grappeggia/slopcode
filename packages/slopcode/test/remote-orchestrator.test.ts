import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises"
import path from "node:path"
import { PassThrough } from "node:stream"
import { spawn } from "node:child_process"
import { Schema } from "effect"
import { AgentOrchestrationFrame, AgentOrchestrationLimits } from "@slopcode-ai/protocol"
import { connect, type ACPEvent, type Session } from "@/remote-orchestrator/acp"
import { argv, connect as connectCli } from "@/remote-orchestrator/cli"
import { Bridge, run } from "@/remote-orchestrator/bridge"
import { approvalCwd, contained } from "@/remote-orchestrator/workspace"

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
  for (let index = 0; index < 100 && !condition(); index++) await Bun.sleep(1)
  expect(condition()).toBe(true)
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

  test("wraps Codex and Claude one-shot CLIs through stdin with reduced capabilities", async () => {
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
      expect(session.capabilities).toEqual(["workspace", "sessions", "turns"])
      expect(events).toContainEqual(expect.objectContaining({ type: "output", text: `${agent}:safe prompt` }))
      expect(events).not.toContainEqual(expect.objectContaining({ text: expect.stringContaining('"thread.started"') }))
      expect(events).not.toContainEqual(expect.objectContaining({ text: expect.stringContaining('"turn.completed"') }))
      expect(session.approval("unknown", true)).toBe(false)
      expect(session.question("unknown", "answer")).toBe(false)
      await session.close()
    }
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
      start: (agent, dir, text) => {
        value = argv(agent, text)
        return spawn(process.execPath, [fixture, agent, text], {
          cwd: dir,
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
        })
      },
    })
    await session.turn(prompt)
    expect(value).toEqual(["agy", "--print", "--output-format", "stream-json", "--", prompt])
    expect(events).toContainEqual(
      expect.objectContaining({ type: "output", text: `antigravity:${prompt.replaceAll("\n", " ")}` }),
    )
    await session.close()
  })

  test("keeps option-shaped Antigravity prompts after the end-of-options delimiter", () => {
    for (const prompt of ["--help", "--dangerously-skip-permissions"]) {
      const value = argv("antigravity", prompt)
      expect(value).toEqual(["agy", "--print", "--output-format", "stream-json", "--", prompt])
      expect(value.slice(value.indexOf("--") + 1)).toEqual([prompt])
    }
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
          async close() {},
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
    await waitFor(() => output.filter((item) => item.kind === "event").length >= 8)
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
