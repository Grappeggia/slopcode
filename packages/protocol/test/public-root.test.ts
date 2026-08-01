import { describe, expect, test } from "bun:test"
import * as Protocol from "@slopcode-ai/protocol"
import * as Remote from "@slopcode-ai/protocol/remote"

describe("protocol package root exports", () => {
  test("re-exports remote contracts from the public root entrypoint", () => {
    expect(Protocol.RemoteWorkspace).toBe(Remote.RemoteWorkspace)
    expect(Protocol.RemoteEnvelope).toBe(Remote.RemoteEnvelope)
    expect(Protocol.RemotePairing).toBe(Remote.RemotePairing)
  })
})
