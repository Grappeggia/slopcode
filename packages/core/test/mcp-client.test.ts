import { expect } from "bun:test"
import path from "node:path"
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { ConfigMCP } from "@slopcode-ai/core/config/mcp"
import { MCPClient } from "@slopcode-ai/core/mcp/client"
import { MCPOAuthStore } from "@slopcode-ai/core/mcp/oauth-store"
import { MCPOAuthProvider } from "@slopcode-ai/core/mcp/oauth-provider"
import { Context, Effect, Fiber, Layer } from "effect"
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
            oauth: false,
          }),
        })
        expect(remote.transport).toBe("remote")
        expect((yield* Effect.promise(() => remote.list(undefined, 5_000))).tools.map((tool) => tool.name)).toEqual([
          "echo",
        ])
        yield* Effect.sleep("100 millis")
        yield* Effect.promise(() => remote.close())

        const sse = yield* clients.connect({
          name: "sse",
          directory: "/tmp",
          timeout: 5_000,
          config: new ConfigMCP.Remote({
            type: "remote",
            url: `${fixture.url}/sse`,
            headers: { Authorization: "Bearer sse" },
            oauth: false,
          }),
        })
        expect(sse.transport).toBe("sse")
        expect((yield* Effect.promise(() => sse.list(undefined, 5_000))).tools.map((tool) => tool.name)).toEqual([
          "echo",
        ])
        yield* Effect.promise(() => sse.close())
        expect(fixture.headers).toContain("Bearer streamable")
        expect(fixture.headers).toContain("Bearer sse")
        expect(fixture.requests).toEqual(expect.arrayContaining([
          expect.objectContaining({ method: "POST", path: "/mcp", contentType: expect.stringContaining("application/json") }),
          expect.objectContaining({ method: "GET", path: "/sse", accept: "text/event-stream" }),
          expect.objectContaining({ method: "GET", path: "/mcp", accept: "text/event-stream" }),
          expect.objectContaining({ method: "POST", path: "/messages", contentType: expect.stringContaining("application/json") }),
        ]))
        expect(fixture.requests).toEqual(expect.arrayContaining([
          expect.objectContaining({
            method: "GET",
            path: "/mcp",
            last: "event-1",
            session: expect.any(String),
            protocol: expect.any(String),
          }),
        ]))
        expect(fixture.requests).toEqual(expect.arrayContaining([
          expect.objectContaining({
            method: "GET",
            path: "/mcp",
            authorization: "Bearer streamable",
            session: expect.any(String),
            protocol: expect.any(String),
          }),
        ]))
      }),
    ),
  ),
)

it.live("uses OAuth bearer precedence and generated headers on real SSE traffic", () =>
  Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
    Effect.flatMap((tmp) =>
      Effect.acquireRelease(Effect.promise(server), (fixture) => Effect.promise(fixture.close)).pipe(
        Effect.flatMap((fixture) =>
          Effect.scoped(
            Effect.gen(function* () {
              const store = MCPOAuthStore.make({ data: tmp.path })
              const endpoint = `${fixture.url}/sse`
              yield* store.update({ directory: tmp.path, name: "oauth-sse", endpoint }, () => ({
                compatibility: MCPOAuthProvider.compatibility(
                  endpoint,
                  {},
                  "http://127.0.0.1:19876/mcp/oauth/callback",
                ),
                tokens: { access_token: "oauth-token", token_type: "Bearer" },
              }))
              const context = yield* Layer.build(MCPClient.layerWith(store))
              const connection = yield* Context.get(context, MCPClient.Service).connect({
                name: "oauth-sse",
                directory: tmp.path,
                timeout: 5_000,
                config: new ConfigMCP.Remote({
                  type: "remote",
                  url: endpoint,
                  oauth: {},
                  headers: { Authorization: "Bearer configured", "X-Custom": "configured" },
                }),
              })
              yield* Effect.promise(() => connection.list(undefined, 5_000))
              yield* Effect.promise(() => connection.close())
              expect(fixture.requests.filter((request) => ["/sse", "/messages"].includes(request.path))).toEqual(
                expect.arrayContaining([
                  expect.objectContaining({
                    method: "GET",
                    path: "/sse",
                    accept: "text/event-stream",
                    authorization: "Bearer oauth-token",
                    custom: "configured",
                  }),
                  expect.objectContaining({
                    method: "POST",
                    path: "/messages",
                    authorization: "Bearer oauth-token",
                    custom: "configured",
                  }),
                ]),
              )
            }),
          ),
        ),
      ),
    ),
  ),
)

it.live("fails auth-required before network or store mutation when credentials are unusable", () =>
  Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
    Effect.flatMap((tmp) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          let requests = 0
          const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => (requests++, new Response(null, { status: 401 })) })
          return { server, requests: () => requests }
        }),
        (fixture) => Effect.sync(() => fixture.server.stop(true)),
      ).pipe(
        Effect.flatMap((fixture) =>
          Effect.scoped(
            Effect.gen(function* () {
              const store = MCPOAuthStore.make({ data: tmp.path })
              const context = yield* Layer.build(
                MCPClient.layerWith(store),
              )
              const clients = Context.get(context, MCPClient.Service)
              const error = yield* clients.connect({
                name: "missing",
                directory: tmp.path,
                timeout: 1_000,
                config: new ConfigMCP.Remote({ type: "remote", url: `${fixture.server.url}mcp` }),
              }).pipe(Effect.flip)
              expect(error).toMatchObject({ code: "auth-required" })
              expect(fixture.requests()).toBe(0)
              expect(yield* Effect.promise(() => Bun.file(path.join(tmp.path, "mcp-oauth/store.json")).exists())).toBe(false)
            }),
          ),
        ),
      ),
    ),
  ),
)

it.live("does not leak configured authorization across redirects", () =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const received: Array<string | null> = []
      const destination = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch: (request) => {
          received.push(request.headers.get("x-secret"))
          return new Response("missing", { status: 404 })
        },
      })
      const source = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch: () => Response.redirect(`${destination.url}mcp`, 302),
      })
      return { source, destination, received }
    }),
    (fixture) => Effect.sync(() => {
      fixture.source.stop(true)
      fixture.destination.stop(true)
    }),
  ).pipe(
    Effect.flatMap((fixture) =>
      Effect.gen(function* () {
        yield* (yield* MCPClient.Service).connect({
          name: "redirect",
          directory: "/tmp",
          timeout: 1_000,
          config: new ConfigMCP.Remote({
            type: "remote",
            url: `${fixture.source.url}mcp`,
            oauth: false,
            headers: { Authorization: "Bearer private", "X-Secret": "private" },
          }),
        }).pipe(Effect.ignore)
        expect(fixture.received.length).toBeGreaterThan(0)
        expect(fixture.received.every((value) => value === null)).toBe(true)
      }),
    ),
  ),
)

it.live("leaves the exact store bytes unchanged when a server rejects a stored access token", () =>
  Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
    Effect.flatMap((tmp) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const requests: string[] = []
          const server = Bun.serve({
            hostname: "127.0.0.1",
            port: 0,
            fetch: (request) => {
              requests.push(new URL(request.url).pathname)
              return new Response(null, { status: 401 })
            },
          })
          return { server, requests }
        }),
        (fixture) => Effect.sync(() => fixture.server.stop(true)),
      ).pipe(
        Effect.flatMap((fixture) =>
          Effect.scoped(
            Effect.gen(function* () {
              const store = MCPOAuthStore.make({ data: tmp.path })
              const endpoint = new URL("mcp", fixture.server.url).toString()
              const target = { directory: tmp.path, name: "rejected", endpoint }
              const redirect = "http://127.0.0.1:19876/mcp/oauth/callback"
              const compatibility = MCPOAuthProvider.compatibility(endpoint, {}, redirect)
              yield* store.update(target, () => ({
                compatibility,
                tokens: { access_token: "rejected-token", refresh_token: "must-not-refresh", token_type: "Bearer" },
                client: {
                  client_id: "expired-dynamic-client",
                  client_secret: "must-not-register",
                  client_secret_expires_at: 1,
                  redirect_uris: [redirect],
                },
              }))
              const file = path.join(tmp.path, "mcp-oauth/store.json")
              const before = yield* Effect.promise(() => Bun.file(file).bytes())
              const seen: MCPOAuthStore.Entry[] = []
              const observed: MCPOAuthStore.Interface = {
                ...store,
                get: (value) => store.get(value).pipe(Effect.tap((entry) => Effect.sync(() => seen.push(entry)))),
              }
              const context = yield* Layer.build(
                MCPClient.layerWith(observed),
              )
              expect((yield* store.get(target)).compatibility).toBe(
                MCPOAuthProvider.compatibility(MCPOAuthStore.normalizeEndpoint(endpoint), {}, redirect),
              )
              expect((yield* store.get(target)).tokens?.access_token).toBe("rejected-token")
              const error = yield* Context.get(context, MCPClient.Service).connect({
                name: target.name,
                directory: target.directory,
                timeout: 1_000,
                config: new ConfigMCP.Remote({ type: "remote", url: endpoint, oauth: {} }),
              }).pipe(Effect.flip)
              expect(error).toMatchObject({ code: "auth-required" })
              expect(seen.at(0)?.tokens?.access_token).toBe("rejected-token")
              expect(yield* Effect.promise(() => Bun.file(file).bytes())).toEqual(before)
              expect(fixture.requests).toEqual(["/mcp"])
            }),
          ),
        ),
      ),
    ),
  ),
)

it.live("single-flights proactive refresh in-process and preserves an interrupted waiter", () =>
  Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
    Effect.flatMap((tmp) =>
      Effect.acquireRelease(Effect.sync(refreshFixture), (fixture) => Effect.sync(() => fixture.server.stop(true))).pipe(
        Effect.flatMap((fixture) =>
          Effect.scoped(
            Effect.gen(function* () {
              const store = MCPOAuthStore.make({ data: tmp.path })
              const target = { directory: tmp.path, name: "refresh", endpoint: `${fixture.server.url}mcp` }
              yield* seedRefresh(store, target, fixture.server.url.origin)
              const context = yield* Layer.build(MCPClient.layerWith(store))
              const clients = Context.get(context, MCPClient.Service)
              const connect = () => clients.connect({
                name: target.name,
                directory: target.directory,
                timeout: 2_000,
                config: new ConfigMCP.Remote({ type: "remote", url: target.endpoint, oauth: { client_id: "static" } }),
              }).pipe(Effect.exit)
              const owner = yield* connect().pipe(Effect.forkChild)
              yield* Effect.promise(() => fixture.started)
              const waiter = yield* connect().pipe(Effect.forkChild)
              yield* Fiber.interrupt(waiter).pipe(Effect.forkChild)
              fixture.release()
              yield* Fiber.join(owner)
              expect(fixture.refreshes()).toBe(1)
              expect((yield* store.get(target)).tokens?.access_token).toBe("fresh")
            }),
          ),
        ),
      ),
    ),
  ),
)

it.live("single-flights proactive refresh across spawned processes", () =>
  Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
    Effect.flatMap((tmp) =>
      Effect.acquireRelease(Effect.sync(refreshFixture), (fixture) => Effect.sync(() => fixture.server.stop(true))).pipe(
        Effect.flatMap((fixture) =>
          Effect.gen(function* () {
            const endpoint = `${fixture.server.url}mcp`
            const store = MCPOAuthStore.make({ data: tmp.path })
            yield* seedRefresh(store, { directory: tmp.path, name: "refresh-process", endpoint }, fixture.server.url.origin)
            const worker = `${import.meta.dir}/fixture/mcp-oauth-refresh-worker.ts`
            const children = [0, 1].map(() => Bun.spawn(["bun", worker, tmp.path, endpoint], {
              cwd: `${import.meta.dir}/..`,
              stdout: "pipe",
            }))
            yield* Effect.promise(() => fixture.started)
            fixture.release()
            expect(yield* Effect.promise(() => Promise.all(children.map((child) => child.exited)))).toEqual([0, 0])
            expect(fixture.refreshes()).toBe(1)
            expect((yield* store.get({ directory: tmp.path, name: "refresh-process", endpoint })).tokens?.access_token).toBe("fresh")
          }),
        ),
      ),
    ),
  ),
)

it.live("bounds invalid grant malformed and interaction refresh failures", () =>
  Effect.acquireRelease(Effect.promise(tmpdir), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]())).pipe(
    Effect.flatMap((tmp) =>
      Effect.forEach(["invalid", "malformed", "interaction"] as const, (mode, index) =>
        Effect.acquireRelease(Effect.sync(() => refreshFailure(mode)), (server) => Effect.sync(() => server.stop(true))).pipe(
          Effect.flatMap((server) =>
            Effect.scoped(
              Effect.gen(function* () {
                const store = MCPOAuthStore.make({ data: path.join(tmp.path, String(index)) })
                const target = { directory: path.join(tmp.path, String(index)), name: mode, endpoint: `${server.url}mcp` }
                yield* seedRefresh(store, target, server.url.origin)
                const context = yield* Layer.build(MCPClient.layerWith(store))
                const error = yield* Context.get(context, MCPClient.Service).connect({
                  name: target.name,
                  directory: target.directory,
                  timeout: 1_000,
                  config: new ConfigMCP.Remote({ type: "remote", url: target.endpoint, oauth: { client_id: "static" } }),
                }).pipe(Effect.flip)
                expect(["auth-required", "refresh"]).toContain(error.code)
                expect(error.message).not.toContain("invalid_grant")
                expect((yield* store.get(target)).attempts).toBeUndefined()
              }),
            ),
          ),
        ), { discard: true }),
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

function refreshFixture() {
  let refreshes = 0
  const started = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      const url = new URL(request.url)
      if (url.pathname === "/token") {
        refreshes++
        started.resolve()
        await release.promise
        return Response.json({ access_token: "fresh", refresh_token: "refresh", token_type: "Bearer", expires_in: 3600 })
      }
      return new Response("missing", { status: 404 })
    },
  })
  return { server, started: started.promise, release: release.resolve, refreshes: () => refreshes }
}

function refreshFailure(mode: "invalid" | "malformed" | "interaction") {
  return Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => {
      if (new URL(request.url).pathname !== "/token") return new Response("missing", { status: 404 })
      if (mode === "invalid") return Response.json({ error: "invalid_grant", error_description: "private" }, { status: 400 })
      if (mode === "malformed") return new Response("private malformed body", { status: 500 })
      return Response.json({ error: "invalid_request", error_description: "private" }, { status: 400 })
    },
  })
}

function seedRefresh(store: MCPOAuthStore.Interface, target: MCPOAuthStore.Target, authorization: string) {
  const redirect = "http://127.0.0.1:19876/mcp/oauth/callback"
  return store.update(target, () => ({
    compatibility: MCPOAuthProvider.compatibility(target.endpoint, { client_id: "static" }, redirect),
    tokens: { access_token: "expired", refresh_token: "refresh", token_type: "Bearer", expires_at: 1 },
    discovery: {
      authorizationServerUrl: authorization,
      authorizationServerMetadata: {
        issuer: authorization,
        authorization_endpoint: `${authorization}/authorize`,
        token_endpoint: `${authorization}/token`,
        response_types_supported: ["code"],
      },
      resourceMetadata: { resource: target.endpoint, authorization_servers: [authorization] },
    },
  }))
}

async function server() {
  const app = createMcpExpressApp()
  const headers: string[] = []
  const requests: Array<{
    method: string
    path: string
    accept: string | undefined
    contentType: string | undefined
    authorization: string | undefined
    custom: string | undefined
    session: string | undefined
    protocol: string | undefined
    last: string | undefined
  }> = []
  const streams = new Map<string, SSEServerTransport>()
  const sessions = new Map<string, StreamableHTTPServerTransport>()
  let resumed = false
  const servers = new Set<McpServer>()
  app.use((request, _response, next) => {
    const authorization = request.headers.authorization
    if (authorization) headers.push(authorization)
    requests.push({
      method: request.method,
      path: request.path,
      accept: request.headers.accept,
      contentType: request.headers["content-type"],
      authorization: request.headers.authorization,
      custom: request.headers["x-custom"] as string | undefined,
      session: request.headers["mcp-session-id"] as string | undefined,
      protocol: request.headers["mcp-protocol-version"] as string | undefined,
      last: request.headers["last-event-id"] as string | undefined,
    })
    next()
  })
  app.post("/mcp", async (request, response) => {
    const id = request.headers["mcp-session-id"] as string | undefined
    const existing = id ? sessions.get(id) : undefined
    const transport = existing ?? new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (session) => sessions.set(session, transport),
    })
    if (!existing) {
      const current = mcp()
      servers.add(current)
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId)
        servers.delete(current)
      }
      await current.connect(transport)
    }
    await transport.handleRequest(request, response, request.body)
  })
  app.get("/mcp", async (request, response) => {
    const id = request.headers["mcp-session-id"] as string | undefined
    const transport = id ? sessions.get(id) : undefined
    if (!transport) return response.status(404).end()
    if (!resumed && !request.headers["last-event-id"]) {
      resumed = true
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" })
      response.end('retry: 10\nid: event-1\nevent: message\ndata: {"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info","data":"resume"}}\n\n')
      return
    }
    await transport.handleRequest(request, response)
  })
  app.delete("/mcp", async (request, response) => {
    const id = request.headers["mcp-session-id"] as string | undefined
    const transport = id ? sessions.get(id) : undefined
    if (!transport) return response.status(404).end()
    await transport.handleRequest(request, response)
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
    requests,
    close: async () => {
      await Promise.all([...servers].map((server) => server.close()))
      await new Promise<void>((resolve, reject) => listener.close((error) => (error ? reject(error) : resolve())))
    },
  }
}
