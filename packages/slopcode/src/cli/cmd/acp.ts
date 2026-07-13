import { Effect } from "effect"
import { effectCmd } from "../effect-cmd"
import { AgentSideConnection, ndJsonStream, type Stream } from "@agentclientprotocol/sdk"
import { ServerAuth } from "@/server/auth"
import { createSlopcodeClient } from "@slopcode-ai/sdk/v2"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { ACPProfile } from "@/acp/profile"
import type { Readable } from "node:stream"
import type { Writable } from "node:stream"

export function createTransport(input: Readable, output: Writable) {
  const closed = Promise.withResolvers<void>()
  const state = { closed: false }
  let controller: ReadableStreamDefaultController<Uint8Array>
  const cleanup = () => {
    input.off("data", onData)
    input.off("end", onEnd)
    input.off("error", onError)
    output.off("close", onClose)
    output.off("error", onError)
  }
  const close = (error?: Error) => {
    if (state.closed) return
    state.closed = true
    cleanup()
    if (error) controller.error(error)
    if (!error) controller.close()
    closed.resolve()
  }
  const onData = (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk))
  const onEnd = () => close()
  const onClose = () => close()
  const onError = (error: Error) => close(error)
  const readable = new ReadableStream<Uint8Array>({
    start(next) {
      controller = next
      input.on("end", onEnd)
      input.on("error", onError)
      output.on("close", onClose)
      output.on("error", onError)
      if (input.readableEnded || output.closed || output.destroyed) {
        close()
        return
      }
      // Register data last because it puts Node streams into flowing mode.
      input.on("data", onData)
    },
  })
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      return new Promise<void>((resolve, reject) => {
        output.write(chunk, (error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
    },
  })
  return {
    stream: ndJsonStream(writable, readable),
    closed: closed.promise,
    close: () => close(),
    dispose: cleanup,
  }
}

export async function runConnection(input: {
  input: Readable
  output: Writable
  create: () => {
    connect: (stream: Stream) => Pick<AgentSideConnection, "closed">
    cleanup: () => Promise<void>
  }
  stop: () => Promise<void>
}) {
  let transport: ReturnType<typeof createTransport> | undefined
  let connection: Pick<AgentSideConnection, "closed"> | undefined
  let cleanup = () => Promise.resolve()
  try {
    transport = createTransport(input.input, input.output)
    const owner = input.create()
    cleanup = owner.cleanup
    connection = owner.connect(transport.stream)
    await Promise.race([transport.closed, connection.closed])
  } finally {
    transport?.close()
    try {
      if (connection) await connection.closed
    } finally {
      transport?.dispose()
      const results = await Promise.allSettled([cleanup(), input.stop()])
      const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected")
      if (failure) throw failure.reason
    }
  }
}

function once<A>(fn: () => Promise<A>) {
  let pending: Promise<A> | undefined
  return () => (pending ??= fn())
}

export const AcpCommand = effectCmd({
  command: "acp",
  describe: "start ACP (Agent Client Protocol) server",
  instance: false,
  builder: (yargs) => {
    return withNetworkOptions(yargs).option("cwd", {
      describe: "working directory",
      type: "string",
      default: process.cwd(),
    })
  },
  handler: Effect.fn("Cli.acp")(function* (args) {
    const { Server } = yield* Effect.promise(() => import("@/server/server"))
    const { ACP } = yield* Effect.promise(() => import("@/acp/agent"))
    ACPProfile.mark("cli.acp.handler")
    process.env.SLOPCODE_CLIENT = "acp"
    const opts = yield* resolveNetworkOptions(args)
    yield* Effect.logInfo("setup connection")
    yield* Effect.acquireUseRelease(
      Effect.promise(async () => {
        const server = await ACPProfile.measure("cli.acp.server.listen", () => Server.listen(opts))
        return { server, stop: once(() => server.stop(true)) }
      }),
      ({ server, stop }) =>
        Effect.promise(() =>
          runConnection({
            input: process.stdin,
            output: process.stdout,
            create() {
              const sdk = createSlopcodeClient({
                baseUrl: `http://${server.hostname}:${server.port}`,
                headers: ServerAuth.headers(),
              })
              const agent = ACP.init({ sdk })
              return {
                connect: (stream) =>
                  new AgentSideConnection((conn) => {
                    ACPProfile.mark("cli.acp.connection.create")
                    return agent.create(conn)
                  }, stream),
                cleanup: agent.close,
              }
            },
            stop,
          }),
        ),
      ({ stop }) => Effect.promise(stop),
    )
  }),
})
