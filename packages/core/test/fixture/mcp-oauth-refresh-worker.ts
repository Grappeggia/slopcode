import { Context, Effect, Layer } from "effect"
import { ConfigMCP } from "@slopcode-ai/core/config/mcp"
import { MCPClient } from "@slopcode-ai/core/mcp/client"
import { MCPOAuthStore } from "@slopcode-ai/core/mcp/oauth-store"

const [data, endpoint] = process.argv.slice(2)
if (!data || !endpoint) process.exit(2)
const store = MCPOAuthStore.make({ data })
await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const context = yield* Layer.build(MCPClient.layerWith(store))
      yield* Effect.exit(
        Context.get(context, MCPClient.Service).connect({
          name: "refresh-process",
          directory: data,
          timeout: 2_000,
          config: new ConfigMCP.Remote({ type: "remote", url: endpoint, oauth: { client_id: "static" } }),
        }),
      )
    }),
  ),
)
process.stdout.write("done")
