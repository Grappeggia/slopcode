import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import type { ACPEvent } from "./acp"

const serverName = "slopcode_approval"
export const tool = `mcp__${serverName}__approval_prompt`

type Input = Record<string, unknown>
type Pending = { resolve: (value: string) => void; input: Input }

export type ClaudePermission = {
  config: string
  approval: (id: string, approved: boolean) => boolean
  close: () => Promise<void>
}

const bytes = (value: string) => Buffer.byteLength(value)
const text = (value: unknown, size = 4 * 1024) => {
  if (typeof value !== "string") return ""
  const clean = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").trim()
  return [...clean].reduce(
    (result, character) => (bytes(result) + bytes(character) <= size ? result + character : result),
    "",
  )
}
const record = (value: unknown): value is Input => typeof value === "object" && value !== null && !Array.isArray(value)
const detail = (value: Input) => {
  for (const key of ["command", "file_path", "path", "query", "url"]) {
    const output = text(value[key])
    if (output) return output
  }
  return text(JSON.stringify(value) ?? "{}") || "Tool input unavailable"
}
const response = (approved: boolean, input: Input) =>
  JSON.stringify(
    approved
      ? { behavior: "allow", updatedInput: input }
      : { behavior: "deny", message: "The user declined this action in Slopcode." },
  )
const socketPath = (dir: string) =>
  process.platform === "win32"
    ? `\\\\.\\pipe\\slopcode-${randomBytes(16).toString("hex")}`
    : path.join(dir, "approval.sock")

export async function create(input: { cwd: string; emit: (event: ACPEvent) => void }): Promise<ClaudePermission> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "slopcode-claude-"))
  const socket = socketPath(dir)
  const token = randomBytes(32).toString("hex")
  const pending = new Map<string, Pending>()
  const clients = new Set<net.Socket>()
  let closed = false
  const server = net.createServer((client) => {
    clients.add(client)
    let authorized = false
    let rest = ""
    const reject = () => client.destroy()
    const handle = (line: string) => {
      let value: unknown
      try {
        value = JSON.parse(line)
      } catch {
        reject()
        return
      }
      if (!record(value)) return reject()
      if (!authorized) {
        if (value.token !== token) return reject()
        authorized = true
        return
      }
      const id = text(value.id, 256)
      const name = text(value.tool, 256)
      const args = value.input
      if (!id || !name || !record(args) || pending.has(id) || closed) return reject()
      pending.set(id, { resolve: (output) => client.write(`${JSON.stringify({ id, output })}\n`), input: args })
      input.emit({
        type: "approval",
        id,
        title: `Claude wants to use ${name}`,
        command: detail(args),
        cwd: input.cwd,
        resolve: (approved) => {
          const item = pending.get(id)
          if (!item) return
          pending.delete(id)
          item.resolve(response(approved, item.input))
        },
      })
    }
    client.setEncoding("utf8")
    client.on("data", (chunk: string) => {
      rest += chunk
      if (bytes(rest) > 64 * 1024) return reject()
      let index = rest.indexOf("\n")
      while (index >= 0) {
        handle(rest.slice(0, index).replace(/\r$/, ""))
        rest = rest.slice(index + 1)
        index = rest.indexOf("\n")
      }
    })
    client.once("close", () => clients.delete(client))
    client.once("error", () => clients.delete(client))
  })
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(socket, () => {
      server.off("error", reject)
      resolve()
    })
  })
  const config = path.join(dir, "mcp.json")
  await writeFile(
    config,
    JSON.stringify({
      mcpServers: {
        [serverName]: {
          type: "stdio",
          command: "slopcode",
          args: ["remote-orchestrator-permission", "--socket", socket, "--token", token],
        },
      },
    }),
    { mode: 0o600 },
  )
  await chmod(config, 0o600)
  return {
    config,
    approval(id, approved) {
      const item = pending.get(id)
      if (!item) return false
      pending.delete(id)
      item.resolve(response(approved, item.input))
      return true
    },
    async close() {
      if (closed) return
      closed = true
      for (const item of pending.values()) item.resolve(response(false, item.input))
      pending.clear()
      for (const client of clients) client.destroy()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await rm(dir, { recursive: true, force: true })
    },
  }
}

const request = (input: { socket: string; token: string; tool: string; value: Input }) =>
  new Promise<string>((resolve, reject) => {
    const client = net.createConnection(input.socket)
    const id = randomUUID()
    let rest = ""
    const done = (value: string) => {
      client.destroy()
      resolve(value)
    }
    client.once("connect", () => {
      client.write(`${JSON.stringify({ token: input.token })}\n`)
      client.write(`${JSON.stringify({ id, tool: input.tool, input: input.value })}\n`)
    })
    client.setEncoding("utf8")
    client.on("data", (chunk: string) => {
      rest += chunk
      if (bytes(rest) > 64 * 1024) return client.destroy(new Error("Claude permission response is too large"))
      const index = rest.indexOf("\n")
      if (index < 0) return
      let value: unknown
      try {
        value = JSON.parse(rest.slice(0, index).replace(/\r$/, ""))
      } catch {
        return client.destroy(new Error("Claude permission response is invalid"))
      }
      if (!record(value) || value.id !== id || typeof value.output !== "string")
        return client.destroy(new Error("Claude permission response was rejected"))
      done(value.output)
    })
    client.once("error", reject)
  })

const reply = (id: unknown, result: unknown) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`)
const fail = (id: unknown, code: number, message: string) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`)

export async function serve(input: { socket: string; token: string }) {
  let rest = ""
  for await (const chunk of process.stdin) {
    rest += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk)
    if (bytes(rest) > 64 * 1024) {
      process.stderr.write("Claude permission bridge input is too large.\n")
      return
    }
    let index = rest.indexOf("\n")
    while (index >= 0) {
      const line = rest.slice(0, index).replace(/\r$/, "")
      rest = rest.slice(index + 1)
      index = rest.indexOf("\n")
      let value: unknown
      try {
        value = JSON.parse(line)
      } catch {
        continue
      }
      if (!record(value) || typeof value.method !== "string") continue
      const params = record(value.params) ? value.params : {}
      if (value.method === "notifications/initialized") continue
      if (value.method === "initialize") {
        reply(value.id, {
          protocolVersion: text(params.protocolVersion, 64) || "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: serverName, version: "v1" },
        })
        continue
      }
      if (value.method === "ping") {
        reply(value.id, {})
        continue
      }
      if (value.method === "tools/list") {
        reply(value.id, {
          tools: [
            {
              name: "approval_prompt",
              description: "Ask the Slopcode user to approve a Claude tool action.",
              inputSchema: {
                type: "object",
                properties: {
                  tool_name: { type: "string" },
                  input: { type: "object", additionalProperties: true },
                },
                required: ["tool_name", "input"],
                additionalProperties: false,
              },
            },
          ],
        })
        continue
      }
      if (value.method !== "tools/call") {
        fail(value.id, -32601, "Method not found")
        continue
      }
      const args = record(params.arguments) ? params.arguments : undefined
      const name = args && text(args.tool_name, 256)
      const action = args?.input
      if (params.name !== "approval_prompt" || !name || !record(action)) {
        fail(value.id, -32602, "Claude permission request is invalid")
        continue
      }
      try {
        reply(value.id, {
          content: [
            {
              type: "text",
              text: await request({ socket: input.socket, token: input.token, tool: name, value: action }),
            },
          ],
        })
      } catch (cause) {
        reply(value.id, {
          content: [
            { type: "text", text: cause instanceof Error ? cause.message : "Claude permission bridge is unavailable" },
          ],
          isError: true,
        })
      }
    }
  }
}
