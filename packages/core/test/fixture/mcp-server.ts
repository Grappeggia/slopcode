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

await server.connect(new StdioServerTransport())
