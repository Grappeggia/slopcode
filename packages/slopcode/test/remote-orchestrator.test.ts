import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import path from "node:path"
import { PassThrough } from "node:stream"
import { spawn } from "node:child_process"
import { Schema } from "effect"
import { AgentOrchestrationFrame } from "@slopcode-ai/protocol"
import { connect, type ACPEvent, type Session } from "@/remote-orchestrator/acp"
import { Bridge, run } from "@/remote-orchestrator/bridge"
import { contained } from "@/remote-orchestrator/workspace"

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
    await Bun.sleep(50)
    const approval = events.find((event) => event.type === "approval")
    expect(approval?.type).toBe("approval")
    if (approval?.type === "approval") expect(session.approval(approval.id, true)).toBe(true)
    await Bun.sleep(50)
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
    await Bun.sleep(0)
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
        }),
      )
      expect(approvals).toBe(0)
      await bridge.handle(
        frame("interaction.approval.reply", {
          sessionID,
          interactionID: approval.interaction.id,
          revision: 1,
          decision: "approved",
        }),
      )
      await bridge.handle(
        frame("interaction.approval.reply", {
          sessionID,
          interactionID: approval.interaction.id,
          revision: 1,
          decision: "approved",
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
        }),
      )
      expect(questions).toBe(0)
      await bridge.handle(
        frame("interaction.question.reply", {
          sessionID,
          interactionID: question.interaction.id,
          revision: 1,
          answer: "yes",
        }),
      )
      await bridge.handle(
        frame("interaction.question.reply", {
          sessionID,
          interactionID: question.interaction.id,
          revision: 1,
          answer: "yes",
        }),
      )
      expect(questions).toBe(1)
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
