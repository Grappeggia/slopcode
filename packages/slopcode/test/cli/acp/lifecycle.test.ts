import { describe, expect } from "bun:test"
import type {
  CloseSessionResponse,
  ListSessionsResponse,
  LoadSessionResponse,
  ResumeSessionResponse,
} from "@agentclientprotocol/sdk"
import { Duration, Effect } from "effect"
import { cliIt } from "../../lib/cli-process"
import { createAcpClient as createJsonRpcAcpClient, expectOk, selectConfigOption } from "./acp-test-client"
import { createAcpClient, initialize, newSession, verifierConfig } from "./helpers"

describe("slopcode acp lifecycle subprocess", () => {
  cliIt.live(
    "stdin EOF during startup exits cleanly within startup allowance",
    ({ slopcode }) =>
      Effect.gen(function* () {
        const acp = yield* slopcode.acp()
        acp.close()

        const code = yield* Effect.promise(() => acp.exited).pipe(Effect.timeout(Duration.seconds(15)))
        expect(code).toBe(0)
      }),
    60_000,
  )

  cliIt.live(
    "stdin EOF after startup tears down promptly",
    ({ slopcode }) =>
      Effect.gen(function* () {
        const handle = yield* slopcode.acp()
        yield* initialize(createJsonRpcAcpClient(handle))
        const started = performance.now()
        handle.close()

        // The generated SSE client observes abort after its 3s retry sleep; this
        // remains a teardown-only bound, separate from the cold-start allowance.
        const code = yield* Effect.promise(() => handle.exited).pipe(Effect.timeout(Duration.seconds(5)))
        expect(code).toBe(0)
        expect(performance.now() - started).toBeLessThan(5_000)
      }),
    60_000,
  )

  cliIt.live(
    "close capability and close request",
    ({ home, llm, slopcode }) =>
      Effect.gen(function* () {
        const acp = yield* createAcpClient(
          { slopcode },
          { SLOPCODE_CONFIG_CONTENT: JSON.stringify(verifierConfig(llm.url)) },
        )
        const initialized = yield* initialize(acp)
        expect(initialized.agentCapabilities?.sessionCapabilities?.close).toEqual({})

        const session = yield* newSession(acp, home)
        expectOk(yield* acp.request<CloseSessionResponse>("session/close", { sessionId: session.sessionId }))
      }),
    60_000,
  )

  cliIt.live(
    "loadSession capability and load request return session config options",
    ({ home, llm, slopcode }) =>
      Effect.gen(function* () {
        const acp = yield* createAcpClient(
          { slopcode },
          { SLOPCODE_CONFIG_CONTENT: JSON.stringify(verifierConfig(llm.url)) },
        )
        const initialized = yield* initialize(acp)
        expect(initialized.agentCapabilities?.loadSession).toBe(true)
        const session = yield* newSession(acp, home)
        const loaded = expectOk(
          yield* acp.request<LoadSessionResponse>("session/load", {
            cwd: home,
            sessionId: session.sessionId,
            mcpServers: [],
          }),
        )

        expect(selectConfigOption(loaded.configOptions, "model")?.category).toBe("model")
      }),
    60_000,
  )

  cliIt.live(
    "list request includes a live ACP-created session",
    ({ home, llm, slopcode }) =>
      Effect.gen(function* () {
        const acp = yield* createAcpClient(
          { slopcode },
          { SLOPCODE_CONFIG_CONTENT: JSON.stringify(verifierConfig(llm.url)) },
        )
        yield* initialize(acp)
        const session = yield* newSession(acp, home)
        const listed = expectOk(yield* acp.request<ListSessionsResponse>("session/list", { cwd: home }))

        expect(listed.sessions.some((item) => item.sessionId === session.sessionId)).toBe(true)
      }),
    60_000,
  )

  cliIt.live(
    "resume capability advertisement",
    ({ slopcode }) =>
      Effect.gen(function* () {
        const initialized = yield* initialize(yield* createAcpClient({ slopcode }))

        expect(initialized.agentCapabilities?.sessionCapabilities?.resume).toEqual({})
      }),
    60_000,
  )

  cliIt.live(
    "resume request returns session config options",
    ({ home, llm, slopcode }) =>
      Effect.gen(function* () {
        const acp = yield* createAcpClient(
          { slopcode },
          { SLOPCODE_CONFIG_CONTENT: JSON.stringify(verifierConfig(llm.url)) },
        )
        yield* initialize(acp)
        const session = yield* newSession(acp, home)
        const resumed = expectOk(
          yield* acp.request<ResumeSessionResponse>("session/resume", {
            cwd: home,
            sessionId: session.sessionId,
            mcpServers: [],
          }),
        )

        expect(selectConfigOption(resumed.configOptions, "model")?.category).toBe("model")
      }),
    60_000,
  )
})
