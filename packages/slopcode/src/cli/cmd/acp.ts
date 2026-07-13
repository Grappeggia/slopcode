import { Effect } from "effect"
import { effectCmd } from "../effect-cmd"
import { AgentSideConnection, ndJsonStream } from "@agentclientprotocol/sdk"
import { ServerAuth } from "@/server/auth"
import { createSlopcodeClient } from "@slopcode-ai/sdk/v2"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { ACPProfile } from "@/acp/profile"
import { once } from "node:events"
import type { Readable } from "node:stream"

export function waitForEnd(input: Readable) {
  if (input.readableEnded) return Promise.resolve()
  return once(input, "end").then(() => undefined)
}

export const AcpCommand = effectCmd({
  command: "acp",
  describe: "start ACP (Agent Client Protocol) server",
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
    const server = yield* Effect.promise(() => ACPProfile.measure("cli.acp.server.listen", () => Server.listen(opts)))

    const sdk = createSlopcodeClient({
      baseUrl: `http://${server.hostname}:${server.port}`,
      headers: ServerAuth.headers(),
    })

    // Latch EOF before the data listener puts stdin into flowing mode.
    const ended = waitForEnd(process.stdin)
    const input = new WritableStream<Uint8Array>({
      write(chunk) {
        return new Promise<void>((resolve, reject) => {
          process.stdout.write(chunk, (err) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          })
        })
      },
    })
    const output = new ReadableStream<Uint8Array>({
      start(controller) {
        if (process.stdin.readableEnded) {
          controller.close()
          return
        }
        process.stdin.on("end", () => controller.close())
        process.stdin.on("error", (err) => controller.error(err))
        process.stdin.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk))
        })
      },
    })

    const stream = ndJsonStream(input, output)
    const agent = ACP.init({ sdk })

    new AgentSideConnection((conn) => {
      ACPProfile.mark("cli.acp.connection.create")
      return agent.create(conn)
    }, stream)

    yield* Effect.logInfo("setup connection")
    process.stdin.resume()
    yield* Effect.promise(() => ended)
  }),
})
