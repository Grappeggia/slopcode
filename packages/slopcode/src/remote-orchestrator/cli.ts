import { ChildProcess, spawn } from "node:child_process"
import {
  AgentOrchestrationLimits,
  type AgentOrchestrationAgentID,
  type AgentOrchestrationCapability,
} from "@slopcode-ai/protocol"
import type { ACPEvent, Session } from "./acp"
import { create as createPermission, tool as permissionTool, type ClaudePermission } from "./claude-permission"

type Agent = Extract<AgentOrchestrationAgentID, "codex" | "claude" | "antigravity">
type Format = "stream" | "text"
type Permission = Pick<ClaudePermission, "config">
export type Launch = (
  agent: Agent,
  cwd: string,
  prompt: string,
  format: Format,
  permission?: Permission,
) => ChildProcess

const programs: Record<Exclude<Agent, "antigravity">, readonly string[]> = {
  codex: ["codex", "exec", "--json"],
  claude: ["claude", "-p", "--output-format", "stream-json", "--verbose"],
}

export const argv = (agent: Agent, prompt: string, format: Format = "stream", permission?: Permission, cwd = ".") => {
  if (agent === "antigravity")
    return format === "text"
      ? ["agy", "--new-project", "--add-dir", cwd, "--sandbox", "--dangerously-skip-permissions", "--prompt", prompt]
      : [
          "agy",
          "--new-project",
          "--add-dir",
          cwd,
          "--sandbox",
          "--dangerously-skip-permissions",
          "--prompt",
          prompt,
          "--output-format",
          "stream-json",
        ]
  if (agent === "claude" && permission)
    return [
      ...programs.claude,
      "--mcp-config",
      permission.config,
      "--strict-mcp-config",
      "--permission-prompt-tool",
      permissionTool,
    ]
  return programs[agent]
}

export const launch: Launch = (agent, cwd, prompt, format, permission) => {
  const args = argv(agent, prompt, format, permission, cwd)
  return spawn(args[0], args.slice(1), {
    cwd,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  })
}

const bytes = (value: string) => Buffer.byteLength(value)
const clean = (value: string, size = AgentOrchestrationLimits.maxTextBytes) => {
  const normalized = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").trim()
  return [...normalized].reduce(
    (result, character) => (bytes(result) + bytes(character) <= size ? result + character : result),
    "",
  )
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown) => (typeof value === "string" ? clean(value) : "")

const unsupported = (value: string) =>
  /(?:(?:unknown|unrecognized|unsupported|invalid)\s+(?:option|argument)[^\r\n]*(?:--output-format|stream-json)|(?:--output-format|stream-json)[^\r\n]*(?:unknown|unrecognized|unsupported|invalid)\s+(?:option|argument))/i.test(
    value,
  )

function output(value: unknown, depth = 0): string {
  if (depth > 5) return ""
  const direct = text(value)
  if (direct) return direct
  if (Array.isArray(value))
    return value
      .map((item) => output(item, depth + 1))
      .filter(Boolean)
      .join("\n")
  if (!record(value)) return ""
  for (const key of ["text", "result", "output", "delta", "content", "message", "item", "aggregated_output", "error"]) {
    const next = output(value[key], depth + 1)
    if (next) return next
  }
  return ""
}

function control(value: unknown) {
  if (!record(value) || typeof value.type !== "string") return false
  return /^(thread|turn|item)\.(started|completed|failed)$/.test(value.type)
}

function line(agent: Agent, value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (agent === "claude") {
      if (!record(parsed)) return ""
      if (parsed.type === "assistant") return output(parsed.message)
      if (parsed.type === "result" || parsed.type === "error") return output(parsed.result) || output(parsed.error)
      return ""
    }
    if (agent === "antigravity") {
      if (!record(parsed)) return output(parsed)
      if (parsed.event === "step_update" && record(parsed.step_update)) {
        const update = parsed.step_update
        if (update.step_type !== "tool" || !record(update.tool_info)) return ""
        const name = text(update.tool_name) || text(update.tool_info.name) || "Tool"
        const state = text(update.state).toLowerCase()
        const error = record(update.tool_info.error) ? text(update.tool_info.error.message) : ""
        return error || (state ? `Antigravity ${name}: ${state}` : `Antigravity ${name}`)
      }
      if (parsed.event === "result" && record(parsed.result)) return output(parsed.result.response)
      if (parsed.event === "init") return ""
    }
    return output(parsed) || (control(parsed) ? "" : clean(trimmed))
  } catch {
    return clean(trimmed)
  }
}

const wait = (child: ChildProcess, ms: number) =>
  new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve()
    const timer = setTimeout(resolve, ms)
    child.once("exit", () => {
      clearTimeout(timer)
      resolve()
    })
    child.once("error", () => {
      clearTimeout(timer)
      resolve()
    })
  })

const stop = async (child: ChildProcess) => {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill("SIGTERM")
  await wait(child, 250)
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill("SIGKILL")
  await wait(child, 250)
}

export async function connect(input: {
  agent: Agent
  cwd: string
  emit: (event: ACPEvent) => void
  start?: Launch
}): Promise<Session> {
  let active: ChildProcess | undefined
  let permission: ClaudePermission | undefined
  let closed = false
  const nativeID = `${input.agent}_${crypto.randomUUID().replaceAll("-", "")}`
  const capabilities: readonly AgentOrchestrationCapability[] = ["workspace", "sessions", "turns", "streaming"]
  const turn = async (prompt: string) => {
    if (closed) throw new Error(`${input.agent} session is closed`)
    if (active) throw new Error(`${input.agent} already has an active turn`)
    const run = async (format: Format) => {
      permission = input.agent === "claude" ? await createPermission({ cwd: input.cwd, emit: input.emit }) : undefined
      const next = (input.start ?? launch)(input.agent, input.cwd, prompt, format, permission)
      const stdin = next.stdin
      const stdout = next.stdout
      const stderrStream = next.stderr
      if (!stdin || !stdout || !stderrStream) {
        await stop(next)
        throw new Error(`${input.agent} CLI did not provide stdio`)
      }
      active = next
      const result = await new Promise<{ code: number | null; error?: string; stderr: string }>((resolve) => {
        let buffer = Buffer.alloc(0)
        let stderr = ""
        let settled = false
        let dropped = false
        const done = (value: { code: number | null; error?: string }) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve({ ...value, stderr })
        }
        const flush = () => {
          if (dropped) return
          const value = line(input.agent, buffer.toString("utf8"))
          if (value) input.emit({ type: "output", text: value, nativeID })
          buffer = Buffer.alloc(0)
        }
        stdout.on("data", (chunk: Buffer) => {
          let rest = chunk
          while (rest.byteLength) {
            if (dropped) {
              const index = rest.indexOf(10)
              if (index < 0) return
              rest = rest.subarray(index + 1)
              dropped = false
              continue
            }
            const index = rest.indexOf(10)
            if (index < 0) {
              if (buffer.byteLength + rest.byteLength > AgentOrchestrationLimits.maxTextBytes) {
                buffer = Buffer.alloc(0)
                dropped = true
                return
              }
              buffer = Buffer.concat([buffer, rest])
              return
            }
            const value = rest.subarray(0, index)
            rest = rest.subarray(index + 1)
            if (buffer.byteLength + value.byteLength > AgentOrchestrationLimits.maxTextBytes) {
              buffer = Buffer.alloc(0)
              continue
            }
            const output = line(input.agent, Buffer.concat([buffer, value]).toString("utf8").replace(/\r$/, ""))
            buffer = Buffer.alloc(0)
            if (output) input.emit({ type: "output", text: output, nativeID })
          }
        })
        stderrStream.on("data", (chunk: Buffer) => {
          stderr = clean(`${stderr}${chunk.toString("utf8")}`, 8 * 1024)
        })
        next.once("error", (error) => done({ code: null, error: error.message }))
        next.once("close", (code, signal) => {
          flush()
          if (code === 0) return done({ code })
          const detail = clean(stderr, 2_048)
          done({
            code,
            error:
              detail || (signal ? `${input.agent} stopped with ${signal}` : `${input.agent} exited with code ${code}`),
          })
        })
        const timer = setTimeout(
          () => {
            void stop(next).then(() => done({ code: null, error: `${input.agent} turn timed out` }))
          },
          10 * 60 * 1_000,
        )
        stdin.end(input.agent === "antigravity" ? undefined : `${prompt}\n`)
      })
      if (active === next) active = undefined
      await permission?.close()
      permission = undefined
      return result
    }
    const first = await run("stream")
    if (closed) throw new Error(`${input.agent} session is closed`)
    const result = input.agent === "antigravity" && first.error && unsupported(first.stderr) ? await run("text") : first
    if (result.error) throw new Error(result.error)
  }
  return {
    nativeID,
    capabilities:
      input.agent === "claude"
        ? [...capabilities, "approvals", "permissions"]
        : input.agent === "antigravity"
          ? [...capabilities, "sandboxed"]
          : capabilities,
    mode: input.agent === "antigravity" ? "sandboxed_cli" : "streaming_cli",
    version: "unknown",
    resumable: false,
    turn,
    approval(id, approved) {
      return permission?.approval(id, approved) ?? false
    },
    question: () => false,
    close: async () => {
      closed = true
      await permission?.close()
      permission = undefined
      if (active) await stop(active)
    },
  }
}
