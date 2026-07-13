import { Effect } from "effect"
import { MCPOAuthStore } from "@slopcode-ai/core/mcp/oauth-store"

const [data, index] = process.argv.slice(2)
if (!data || !index) process.exit(2)
const store = MCPOAuthStore.make({ data })
await Effect.runPromise(
  store.update({ directory: "/workspace", name: "spawn-update", endpoint: "https://example.com/mcp" }, (entry) => ({
    ...entry,
    attempts: {
      ...entry.attempts,
      [`attempt-${index}`]: {
        state: `state-${index}`,
        mode: "manual",
        redirect: "https://client.example/callback",
        created: Number(index),
        expires: 100,
        phase: "initializing",
      },
    },
  })),
)
