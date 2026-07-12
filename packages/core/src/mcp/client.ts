export * as MCPClient from "./client"

import path from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import {
  CallToolResultSchema,
  ListToolsResultSchema,
  ToolSchema,
  ToolListChangedNotificationSchema,
  type CallToolResult,
  type Tool as SDKTool,
} from "@modelcontextprotocol/sdk/types.js"
import { Context, Effect, Layer, Schema } from "effect"
import type { ConfigMCP } from "../config/mcp"
import { InstallationVersion } from "../installation/version"

export interface Tool extends Omit<SDKTool, "inputSchema" | "outputSchema"> {
  readonly inputSchema: Readonly<Record<string, unknown>>
  readonly outputSchema?: Readonly<Record<string, unknown>>
}

export interface Page {
  readonly tools: ReadonlyArray<Tool>
  readonly nextCursor?: string
}

export interface Interface {
  readonly connect: (input: ConnectInput) => Effect.Effect<Connection, ConnectionError>
}

export interface ConnectInput {
  readonly name: string
  readonly directory: string
  readonly timeout: number
  readonly config: typeof ConfigMCP.Server.Type
}

export interface Connection {
  readonly transport: "local" | "remote" | "sse"
  readonly capabilities: Readonly<Record<string, unknown>>
  readonly list: (cursor: string | undefined, timeout: number, tolerant?: boolean) => Promise<Page>
  readonly call: (
    input: { readonly name: string; readonly arguments?: Record<string, unknown> },
    options: { readonly signal: AbortSignal; readonly timeout: number; readonly resetTimeoutOnProgress: true },
  ) => Promise<CallToolResult | unknown>
  readonly changed: (handler: () => void | Promise<void>) => void
  readonly closed: (handler: () => void) => void
  readonly close: () => Promise<void>
}

export interface ProcessAdapter {
  readonly platform: NodeJS.Platform
  readonly tree: (pid: number) => Promise<ReadonlyArray<number>>
  readonly signal: (pids: ReadonlyArray<number>, signal: "SIGTERM" | "SIGKILL") => Promise<void>
  readonly alive: (pids: ReadonlyArray<number>) => Promise<ReadonlyArray<number>>
  readonly windows?: (pid: number) => Promise<void>
  readonly sleep: (milliseconds: number) => Promise<void>
}

export class ConnectionError extends Schema.TaggedErrorClass<ConnectionError>()("MCP.ConnectionError", {
  message: Schema.String,
}) {}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/MCPClient") {}

export function make(input: {
  readonly transport?: Connection["transport"]
  readonly capabilities?: Readonly<Record<string, unknown>>
  readonly list: Connection["list"]
  readonly call: Connection["call"]
  readonly changed?: Connection["changed"]
  readonly closed?: Connection["closed"]
  readonly close: Connection["close"]
}): Connection {
  let closing: Promise<void> | undefined
  return {
    transport: input.transport ?? "local",
    capabilities: input.capabilities ?? {},
    list: input.list,
    call: input.call,
    changed: input.changed ?? (() => {}),
    closed: input.closed ?? (() => {}),
    close: () => (closing ??= Promise.resolve().then(input.close)),
  }
}

export function interruptible(run: (signal: AbortSignal) => Promise<Connection>) {
  return Effect.callback<Connection, ConnectionError>((resume) => {
    const controller = new AbortController()
    let active = true
    const pending = Promise.resolve().then(() => run(controller.signal))
    pending.then(
      (client) => {
        if (!active) {
          void client.close().catch(() => undefined)
          return
        }
        resume(Effect.succeed(client))
      },
      (cause) => {
        if (active) resume(Effect.fail(new ConnectionError({ message: message(cause) })))
      },
    )
    return Effect.uninterruptible(
      Effect.promise(async () => {
        active = false
        controller.abort()
        const client = await pending.catch(() => undefined)
        await client?.close().catch(() => undefined)
      }),
    )
  })
}

export function headers(generated?: HeadersInit, configured?: Readonly<Record<string, string>>) {
  const result = new Headers(generated)
  Object.entries(configured ?? {}).forEach(([name, value]) => result.set(name, value))
  return result
}

export async function cleanup(pid: number | null, close: () => Promise<void>, adapter: ProcessAdapter = system) {
  if (!pid) return close()
  const found = new Set<number>([pid, ...(await adapter.tree(pid).catch(() => []))])
  const closing = Promise.resolve().then(close)
  await adapter.sleep(0)
  ;(await adapter.tree(pid).catch(() => [])).forEach((child) => found.add(child))
  const failure = await closing.then(
    () => undefined,
    (cause) => cause,
  )
  ;(await adapter.tree(pid).catch(() => [])).forEach((child) => found.add(child))
  if (adapter.platform === "win32") {
    await adapter.windows?.(pid)
  } else {
    const pids = [...found].toReversed()
    await adapter.signal(pids, "SIGTERM")
    await adapter.sleep(500)
    const alive = await adapter.alive(pids)
    if (alive.length > 0) {
      await adapter.signal(alive, "SIGKILL")
      await adapter.sleep(100)
    }
  }
  if (failure !== undefined) throw failure
}

export const layer = Layer.succeed(
  Service,
  Service.of({
    connect: (input) =>
      interruptible(async (signal) => {
        if (input.config.type === "local") {
          const command = input.config.command[0]
          if (!command) throw new Error(`MCP server "${input.name}" has an empty command`)
          const transport = new StdioClientTransport({
            command,
            args: input.config.command.slice(1),
            cwd: path.resolve(input.directory, input.config.cwd ?? "."),
            env: { ...getDefaultEnvironment(), ...input.config.environment },
            stderr: "pipe",
          })
          return connect(transport, "local", input.timeout, signal)
        }

        const url = new URL(input.config.url)
        if (url.protocol !== "http:" && url.protocol !== "https:")
          throw new Error(`Unsupported MCP URL protocol: ${url.protocol}`)
        const headers = input.config.headers
        const options = headers ? { requestInit: { headers } } : undefined
        const first = new StreamableHTTPClientTransport(url, options)
        const remote = await connect(first, "remote", input.timeout, signal).catch((cause) => {
          if (signal.aborted) throw cause
          return undefined
        })
        if (remote) return remote
        return connect(
          new SSEClientTransport(url, {
            requestInit: options?.requestInit,
            eventSourceInit: headers
              ? {
                  fetch: (url: string | URL, init?: RequestInit) =>
                    fetch(url, { ...init, headers: MCPClientHeaders(init?.headers, headers) }),
                }
              : undefined,
          }),
          "sse",
          input.timeout,
          signal,
        )
      }),
  }),
)

async function connect(
  transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport,
  kind: Connection["transport"],
  timeout: number,
  signal: AbortSignal,
) {
  const client = new Client({ name: "slopcode", version: InstallationVersion })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      client.connect(transport, { timeout, signal }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`MCP connection timed out after ${timeout}ms`)), timeout)
      }),
    ])
  } catch (error) {
    await cleanup(transport instanceof StdioClientTransport ? transport.pid : null, () => client.close()).catch(
      () => undefined,
    )
    throw error
  } finally {
    if (timer) clearTimeout(timer)
  }

  return make({
    transport: kind,
    capabilities: client.getServerCapabilities() ?? {},
    list: async (cursor, timeout, tolerant) => {
      const params = cursor === undefined ? undefined : { cursor }
      if (!tolerant) return (await client.listTools(params, { timeout })) as Page
      return (await client.request({ method: "tools/list", params }, TolerantListToolsResultSchema, {
        timeout,
      })) as Page
    },
    call: (request, options) => client.callTool(request, CallToolResultSchema, options),
    changed: (handler) => client.setNotificationHandler(ToolListChangedNotificationSchema, handler),
    closed: (handler) => {
      client.onclose = handler
    },
    close: async () => {
      await cleanup(transport instanceof StdioClientTransport ? transport.pid : null, () => client.close())
    },
  })
}

const TolerantListToolsResultSchema = ListToolsResultSchema.extend({
  tools: ToolSchema.omit({ outputSchema: true }).passthrough().array(),
})

async function descendants(pid: number) {
  if (process.platform === "win32") return []
  const output = await new Response(Bun.spawn(["ps", "-eo", "pid=,ppid="], { stdout: "pipe" }).stdout).text()
  const pairs = output
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter((pair): pair is [number, number] => pair.length === 2 && pair.every(Number.isFinite))
  const result: number[] = []
  const queue = [pid]
  queue.forEach((parent) =>
    pairs.forEach(([child, owner]) => {
      if (owner === parent && !result.includes(child)) {
        result.push(child)
        queue.push(child)
      }
    }),
  )
  return result
}

const system: ProcessAdapter = {
  platform: process.platform,
  tree: descendants,
  signal: async (pids, signal) => {
    pids.forEach((pid) => {
      try {
        process.kill(pid, signal)
      } catch {}
    })
  },
  alive: async (pids) =>
    pids.filter((pid) => {
      try {
        process.kill(pid, 0)
        return true
      } catch {
        return false
      }
    }),
  windows: async (pid) => {
    const child = Bun.spawn(["taskkill", "/PID", String(pid), "/T", "/F"], { stdout: "ignore", stderr: "ignore" })
    await child.exited
  },
  sleep: Bun.sleep,
}

function MCPClientHeaders(generated: HeadersInit | undefined, configured: Readonly<Record<string, string>>) {
  return headers(generated, configured)
}

function message(value: unknown) {
  return value instanceof Error ? value.message : String(value)
}
