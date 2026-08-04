import readline from "node:readline"

const send = (value: unknown) => process.stdout.write(`${JSON.stringify(value)}\n`)
const thread = {
  id: "codex-thread",
  sessionId: "codex-session",
  cwd: process.cwd(),
}
let approval = false
let question = false
let permission = false
let elicitation = false

const complete = async () => {
  if (!approval || !question || !permission || !elicitation) return
  await Bun.write(`${process.cwd()}/created.txt`, "fixture")
  send({
    method: "turn/plan/updated",
    params: {
      threadId: thread.id,
      turnId: "codex-turn",
      plan: [
        { step: "Inspect workspace", status: "completed" },
        { step: "Create fixture", status: "inProgress" },
      ],
    },
  })
  send({
    method: "item/started",
    params: {
      threadId: thread.id,
      turnId: "codex-turn",
      item: {
        type: "commandExecution",
        id: "codex-command",
        command: "printf fixture",
        cwd: process.cwd(),
        status: "inProgress",
      },
    },
  })
  send({
    method: "item/completed",
    params: {
      threadId: thread.id,
      turnId: "codex-turn",
      item: {
        type: "commandExecution",
        id: "codex-command",
        command: "printf fixture",
        cwd: process.cwd(),
        status: "completed",
      },
    },
  })
  send({
    method: "item/reasoning/summaryTextDelta",
    params: { threadId: thread.id, turnId: "codex-turn", itemId: "codex-reasoning", delta: "Thinking safely" },
  })
  send({
    method: "item/agentMessage/delta",
    params: { threadId: thread.id, turnId: "codex-turn", itemId: "codex-message", delta: " Fixture complete " },
  })
  send({
    method: "item/completed",
    params: {
      threadId: thread.id,
      turnId: "codex-turn",
      item: {
        type: "fileChange",
        id: "codex-file",
        status: "completed",
        changes: [{ path: "created.txt", kind: "add", diff: "+fixture" }],
      },
    },
  })
  send({
    method: "turn/completed",
    params: {
      threadId: thread.id,
      turn: { id: "codex-turn", items: [], status: "completed", error: null },
    },
  })
}

for await (const line of readline.createInterface({ input: process.stdin })) {
  const value = JSON.parse(line) as { id?: number; method: string; params?: Record<string, unknown>; result?: unknown }
  if (value.method === "initialize") {
    send({ id: value.id, result: { userAgent: "fixture", codexHome: process.cwd() } })
    continue
  }
  if (value.method === "initialized") continue
  if (value.method === "thread/start" || value.method === "thread/resume") {
    send({ id: value.id, result: { thread } })
    continue
  }
  if (value.method === "turn/start") {
    send({ id: value.id, result: { turn: { id: "codex-turn", items: [], status: "inProgress", error: null } } })
    send({
      id: 70,
      method: "item/commandExecution/requestApproval",
      params: {
        threadId: thread.id,
        turnId: "codex-turn",
        itemId: "codex-command",
        command: "printf fixture",
        cwd: process.cwd(),
        reason: "Run fixture command",
      },
    })
    send({
      id: 71,
      method: "item/tool/requestUserInput",
      params: {
        threadId: thread.id,
        turnId: "codex-turn",
        itemId: "codex-question",
        questions: [
          {
            id: "continue",
            header: "Continue",
            question: "Continue fixture?",
            isOther: true,
            isSecret: false,
            options: [{ label: "Yes", description: "Continue" }],
          },
        ],
      },
    })
    send({
      id: 72,
      method: "item/permissions/requestApproval",
      params: {
        threadId: thread.id,
        turnId: "codex-turn",
        itemId: "codex-permission",
        environmentId: null,
        startedAtMs: Date.now(),
        cwd: process.cwd(),
        reason: "Allow fixture access",
        permissions: {},
      },
    })
    send({
      id: 73,
      method: "mcpServer/elicitation/request",
      params: {
        threadId: thread.id,
        turnId: "codex-turn",
        serverName: "fixture",
        mode: "form",
        _meta: null,
        message: "Confirm fixture?",
        requestedSchema: { type: "object", properties: { answer: { type: "string", enum: ["Yes"] } } },
      },
    })
    send({
      id: 74,
      method: "item/commandExecution/requestApproval",
      params: {
        threadId: thread.id,
        turnId: "codex-turn",
        itemId: "codex-large-command",
        command: "x".repeat(70 * 1024),
        cwd: process.cwd(),
        reason: "Approve large fixture frame",
      },
    })
    continue
  }
  if (value.method === "turn/steer") {
    send({ id: value.id, result: { turnId: "codex-turn" } })
    continue
  }
  if (value.method === "turn/interrupt") {
    send({ id: value.id, result: {} })
    send({
      method: "turn/completed",
      params: {
        threadId: thread.id,
        turn: { id: "codex-turn", items: [], status: "interrupted", error: null },
      },
    })
    continue
  }
  if (value.id === 70) approval = true
  if (value.id === 71) question = true
  if (value.id === 72 && (value.result as { scope?: string } | undefined)?.scope === "turn") permission = true
  if (value.id === 73 && (value.result as { action?: string } | undefined)?.action === "accept") elicitation = true
  await complete()
}
