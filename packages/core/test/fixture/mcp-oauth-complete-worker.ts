import { Context, Effect, Layer } from "effect"
import { MCPOAuth } from "@slopcode-ai/core/mcp/oauth"
import { MCPOAuthCallback } from "@slopcode-ai/core/mcp/oauth-callback"
import { MCPOAuthStore } from "@slopcode-ai/core/mcp/oauth-store"

const [data, endpoint, attemptID, state, code] = process.argv.slice(2)
if (!data || !endpoint || !attemptID || !state || !code) process.exit(2)
const store = MCPOAuthStore.make({ data })
const result = await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const context = yield* Layer.build(
        MCPOAuth.layer.pipe(
          Layer.provide(Layer.succeed(MCPOAuthStore.Service, MCPOAuthStore.Service.of(store))),
          Layer.provide(MCPOAuthCallback.layer),
        ),
      )
      return yield* Effect.exit(
        Context.get(context, MCPOAuth.Service).complete({
          target: { directory: "/workspace", name: "process", endpoint },
          config: { client_id: "static-client", redirect_uri: "https://client.example/callback" },
          attemptID: attemptID as MCPOAuth.AttemptID,
          state,
          code,
        }),
      )
    }),
  ),
)
process.stdout.write(result._tag === "Success" ? "won" : "lost")
