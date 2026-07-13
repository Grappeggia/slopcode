import { MCPOAuthStore } from "@slopcode-ai/core/mcp/oauth-store"
import { Effect } from "effect"

const [data, attempt, token] = process.argv.slice(2)
if (!data || !attempt || !token) process.exit(2)
const store = MCPOAuthStore.make({ data })
const target = { directory: "/workspace", name: "server", endpoint: "https://example.com/mcp" }
const won = await Effect.runPromise(
  store.finishExchange(target, attempt, { access_token: token, token_type: "Bearer" }, 10),
)
process.stdout.write(won.won ? "won" : "lost")
