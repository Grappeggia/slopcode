import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const server = new McpServer({ name: "core-test", version: "1" })

server.registerTool(
  "inspect",
  {
    description: "Inspect stdio launch configuration",
    inputSchema: { value: z.string() },
  },
  ({ value }) => ({
    content: [{ type: "text", text: `${value}:${process.cwd()}:${process.env.MCP_TEST_ENV}` }],
  }),
)

server.registerPrompt("review", { argsSchema: { value: z.string() } }, ({ value }) => ({
  messages: [{ role: "user", content: { type: "text", text: value } }],
}))

server.registerResource("guide", "file:///guide.txt", { mimeType: "text/plain" }, (uri) => ({
  contents: [{ uri: uri.href, text: "guide" }],
}))

await server.connect(new StdioServerTransport())
