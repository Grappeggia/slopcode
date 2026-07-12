import { expect } from "bun:test"
import path from "node:path"
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { ConfigMCP } from "@slopcode-ai/core/config/mcp"
import { MCPClient } from "@slopcode-ai/core/mcp/client"
import { Effect } from "effect"
import { testEffect } from "./lib/effect"
import { tmpdir } from "./fixture/tmpdir"
import { z } from "zod"

const it = testEffect(MCPClient.layer)

it.live("connects a real local SDK stdio client with resolved cwd, environment, discovery, calls, and cleanup", () =>
  Effect.gen(function* () {
    const tmp = yield* Effect.acquireRelease(Effect.promise(tmpdir), (tmp) =>
      Effect.promise(() => tmp[Symbol.asyncDispose]()),
    )
    const nested = path.join(tmp.path, "nested")
    yield* Effect.promise(() => Bun.write(path.join(tmp.path, ".keep"), ""))
    yield* Effect.promise(() => import("node:fs/promises").then((fs) => fs.mkdir(nested)))
    const clients = yield* MCPClient.Service
    const client = yield* clients.connect({
      name: "local",
      directory: tmp.path,
      timeout: 5_000,
      config: new ConfigMCP.Local({
        type: "local",
        command: ["bun", path.join(import.meta.dir, "fixture/mcp-server.ts")],
        cwd: "nested",
        environment: { MCP_TEST_ENV: "configured" },
      }),
    })
    expect(client.transport).toBe("local")
    expect((yield* Effect.promise(() => client.list(undefined, 5_000))).tools.map((tool) => tool.name)).toEqual([
      "inspect",
    ])
    const options = { signal: new AbortController().signal, timeout: 5_000 }
    expect(
      (yield* Effect.promise(() => client.listPrompts(undefined, options))).prompts.map((item) => item.name),
    ).toEqual(["review"])
    expect(
      yield* Effect.promise(() => client.getPrompt({ name: "review", arguments: { value: "hello" } }, options)),
    ).toMatchObject({
      messages: [{ role: "user", content: { type: "text", text: "hello" } }],
    })
    expect(
      (yield* Effect.promise(() => client.listResources(undefined, options))).resources.map((item) => item.name),
    ).toEqual(["guide"])
    expect(yield* Effect.promise(() => client.readResource({ uri: "file:///guide.txt" }, options))).toMatchObject({
      contents: [{ uri: "file:///guide.txt", text: "guide" }],
    })
    const result = yield* Effect.promise(() =>
      client.call(
        { name: "inspect", arguments: { value: "ok" } },
        { signal: new AbortController().signal, timeout: 5_000, resetTimeoutOnProgress: true },
      ),
    )
    expect(result).toMatchObject({ content: [{ type: "text", text: `ok:${nested}:configured` }] })
    yield* Effect.promise(() => client.close())
    yield* Effect.promise(() => client.close())
  }),
)

it.live("times out and cleans up an unresponsive local SDK transport", () =>
  Effect.gen(function* () {
    const clients = yield* MCPClient.Service
    const error = yield* Effect.flip(
      clients.connect({
        name: "timeout",
        directory: "/tmp",
        timeout: 25,
        config: new ConfigMCP.Local({ type: "local", command: ["bun", "-e", "await new Promise(() => {})"] }),
      }),
    )
    expect(error).toBeInstanceOf(MCPClient.ConnectionError)
    expect(error.message).toContain("timed out")
  }),
)

it.live("escalates cleanup for a real stdio grandchild that ignores SIGTERM", () =>
  Effect.gen(function* () {
    if (process.platform === "win32") return
    const tmp = yield* Effect.acquireRelease(Effect.promise(tmpdir), (tmp) =>
      Effect.promise(() => tmp[Symbol.asyncDispose]()),
    )
    const pidfile = path.join(tmp.path, "child.pid")
    const client = yield* (yield* MCPClient.Service).connect({
      name: "stubborn",
      directory: tmp.path,
      timeout: 5_000,
      config: new ConfigMCP.Local({
        type: "local",
        command: ["bun", path.join(import.meta.dir, "fixture/mcp-stubborn-server.ts")],
        environment: { MCP_CHILD_PID: pidfile },
      }),
    })
    const pid = Number(yield* Effect.promise(() => Bun.file(pidfile).text()))
    expect(() => process.kill(pid, 0)).not.toThrow()
    yield* Effect.promise(() => client.close())
    yield* Effect.sleep("50 millis")
    expect(() => process.kill(pid, 0)).toThrow()
  }),
)

it.live("connects Streamable HTTP with configured headers and falls back to legacy SSE", () =>
  Effect.acquireRelease(Effect.promise(server), (fixture) => Effect.promise(fixture.close)).pipe(
    Effect.flatMap((fixture) =>
      Effect.gen(function* () {
        const clients = yield* MCPClient.Service
        const remote = yield* clients.connect({
          name: "remote",
          directory: "/tmp",
          timeout: 5_000,
          config: new ConfigMCP.Remote({
            type: "remote",
            url: `${fixture.url}/mcp`,
            headers: { Authorization: "Bearer streamable" },
          }),
        })
        expect(remote.transport).toBe("remote")
        expect((yield* Effect.promise(() => remote.list(undefined, 5_000))).tools.map((tool) => tool.name)).toEqual([
          "echo",
        ])
        yield* Effect.promise(() => remote.close())

        const sse = yield* clients.connect({
          name: "sse",
          directory: "/tmp",
          timeout: 5_000,
          config: new ConfigMCP.Remote({
            type: "remote",
            url: `${fixture.url}/sse`,
            headers: { Authorization: "Bearer sse" },
          }),
        })
        expect(sse.transport).toBe("sse")
        expect((yield* Effect.promise(() => sse.list(undefined, 5_000))).tools.map((tool) => tool.name)).toEqual([
          "echo",
        ])
        yield* Effect.promise(() => sse.close())
        expect(fixture.headers).toContain("Bearer streamable")
        expect(fixture.headers).toContain("Bearer sse")
      }),
    ),
  ),
)

function mcp() {
  const server = new McpServer({ name: "http-test", version: "1" })
  server.registerTool("echo", { inputSchema: { value: z.string().optional() } }, ({ value }) => ({
    content: [{ type: "text", text: value ?? "ok" }],
  }))
  return server
}

async function server() {
  const app = createMcpExpressApp()
  const headers: string[] = []
  const streams = new Map<string, SSEServerTransport>()
  const servers = new Set<McpServer>()
  app.use((request, _response, next) => {
    const authorization = request.headers.authorization
    if (authorization) headers.push(authorization)
    next()
  })
  app.post("/mcp", async (request, response) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    const current = mcp()
    servers.add(current)
    await current.connect(transport)
    await transport.handleRequest(request, response, request.body)
    response.on("close", () => void current.close().finally(() => servers.delete(current)))
  })
  app.get("/sse", async (_request, response) => {
    const transport = new SSEServerTransport("/messages", response)
    const current = mcp()
    streams.set(transport.sessionId, transport)
    servers.add(current)
    transport.onclose = () => {
      streams.delete(transport.sessionId)
      servers.delete(current)
    }
    await current.connect(transport)
  })
  app.post("/messages", async (request, response) => {
    const id = typeof request.query.sessionId === "string" ? request.query.sessionId : ""
    const transport = streams.get(id)
    if (!transport) {
      response.status(404).send("missing session")
      return
    }
    await transport.handlePostMessage(request, response, request.body)
  })
  const listener = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener))
  })
  const address = listener.address()
  if (!address || typeof address === "string") throw new Error("HTTP MCP test server did not bind")
  return {
    url: `http://127.0.0.1:${address.port}`,
    headers,
    close: async () => {
      await Promise.all([...servers].map((server) => server.close()))
      await new Promise<void>((resolve, reject) => listener.close((error) => (error ? reject(error) : resolve())))
    },
  }
}
