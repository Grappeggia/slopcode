import fs from "node:fs/promises"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

const child = Bun.spawn(["bun", "-e", 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1_000)'], {
  stdin: "ignore",
  stdout: "ignore",
  stderr: "ignore",
})
await fs.writeFile(process.env.MCP_CHILD_PID!, String(child.pid))

const server = new McpServer({ name: "stubborn-test", version: "1" })
server.registerTool("alive", {}, () => ({ content: [{ type: "text", text: "alive" }] }))
await server.connect(new StdioServerTransport())
