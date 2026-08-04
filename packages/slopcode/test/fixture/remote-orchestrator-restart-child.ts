import { Schema } from "effect"
import { AgentOrchestrationFrame } from "@slopcode-ai/protocol"
import type { ACPEvent, Session } from "@/remote-orchestrator/acp"
import { Bridge } from "@/remote-orchestrator/bridge"

const root = process.argv[2]
if (!root) throw new Error("missing restart fixture root")

const decode = Schema.decodeUnknownSync(AgentOrchestrationFrame)
const bridge = new Bridge(
  root,
  (frame) => process.stdout.write(`${JSON.stringify(frame)}\n`),
  async (input): Promise<Session> => ({
    nativeID: "restart-child-native",
    capabilities: ["workspace", "sessions", "turns", "replay"],
    mode: "acp",
    version: "fixture 1.0.0",
    resumable: true,
    async turn() {
      input.emit({ type: "output", text: "child process output" } satisfies ACPEvent)
    },
    approval: () => false,
    question: () => false,
    async close() {},
  }),
)

let rest = ""
for await (const chunk of process.stdin) {
  rest += chunk.toString()
  let index = rest.indexOf("\n")
  while (index >= 0) {
    const line = rest.slice(0, index)
    rest = rest.slice(index + 1)
    if (line) await bridge.handle(decode(JSON.parse(line)))
    index = rest.indexOf("\n")
  }
}
await bridge.close()
