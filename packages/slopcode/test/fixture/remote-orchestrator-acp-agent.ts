import { AgentSideConnection, PROTOCOL_VERSION, ndJsonStream, type Agent } from "@agentclientprotocol/sdk"
import path from "node:path"
import { Readable, Writable } from "node:stream"

class Fixture {
  constructor(private readonly connection: AgentSideConnection) {}

  async initialize() {
    return { protocolVersion: PROTOCOL_VERSION, agentCapabilities: { loadSession: true } }
  }

  async newSession() {
    return { sessionId: "fixture-session" }
  }

  async prompt(params: { sessionId: string }) {
    await Bun.write(path.join(process.cwd(), "fixture.ts"), "fixture")
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "fixture output" },
        messageId: "native-message",
      },
    })
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: "fixture reasoning" },
        messageId: "native-thought",
      },
    })
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId: "native-tool",
        title: "Fixture tool",
        status: "in_progress",
        kind: "execute",
        content: [{ type: "diff", path: path.join(process.cwd(), "fixture.ts"), oldText: "old", newText: "new" }],
      },
    })
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: { sessionUpdate: "plan", entries: [{ content: "Run fixture", priority: "high", status: "pending" }] },
    })
    await this.connection.requestPermission({
      sessionId: params.sessionId,
      toolCall: {
        toolCallId: "native-approval",
        title: "Approve fixture",
        status: "pending",
        rawInput: { command: "echo fixture" },
      },
      options: [
        { optionId: "yes", name: "Allow", kind: "allow_once" },
        { optionId: "no", name: "Reject", kind: "reject_once" },
      ],
    })
    await this.connection.unstable_createElicitation({
      mode: "form",
      sessionId: params.sessionId,
      message: "Fixture question",
      requestedSchema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
    })
    return { stopReason: "end_turn" }
  }
}

const stream = ndJsonStream(
  Writable.toWeb(process.stdout),
  Readable.toWeb(process.stdin) as unknown as ReadableStream<Uint8Array>,
)
new AgentSideConnection((connection) => new Fixture(connection) as unknown as Agent, stream)
process.stdin.resume()
