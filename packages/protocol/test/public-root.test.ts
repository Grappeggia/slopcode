import { describe, expect, test } from "bun:test"
import * as Protocol from "@slopcode-ai/protocol"
import * as AgentOrchestration from "@slopcode-ai/protocol/agent-orchestration"
import * as Remote from "@slopcode-ai/protocol/remote"

describe("protocol package root exports", () => {
  test("re-exports remote and orchestration contracts from the public root entrypoint", () => {
    expect(Protocol.RemoteWorkspace).toBe(Remote.RemoteWorkspace)
    expect(Protocol.RemoteEnvelope).toBe(Remote.RemoteEnvelope)
    expect(Protocol.RemotePairing).toBe(Remote.RemotePairing)
    expect(Protocol.AgentOrchestrationFrame).toBe(AgentOrchestration.AgentOrchestrationFrame)
    expect(Protocol.AgentOrchestrationPath).toBe(AgentOrchestration.AgentOrchestrationPath)
  })
})
