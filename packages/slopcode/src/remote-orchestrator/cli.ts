import { ChildProcess, spawn } from "node:child_process"
import {
  AgentOrchestrationLimits,
  type AgentOrchestrationAgentID,
  type AgentOrchestrationCapability,
} from "@slopcode-ai/protocol"
import type { ACPEvent, Session } from "./acp"

type Agent = Extract<AgentOrchestrationAgentID, "codex" | "claude" | "antigravity">
type Launch = (agent: Agent, cwd: string, prompt: string) => ChildProcess

const programs: Record<Agent, readonly string[]> = {
  codex: ["codex", "exec", "--json"],
  claude: ["claude", "-p", "--output-format", "stream-json", "--verbose"],
  antigravity: ["agy", "--print", "--output-format", "stream-json"],
}

export const argv = (agent: Agent, prompt: string) =>
  agent === "antigravity" ? [...programs[agent], prompt] : programs[agent]

export const launch: Launch = (agent, cwd, prompt) => {
  const args = argv(agent, prompt)
  return spawn(args[0], args.slice(1), {
    cwd,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  })
}

const bytes = (value: string) => Buffer.byteLength(value)
const clip = (value: string, size: number) =>
  bytes(value) <= size ? value : Buffer.from(value).subarray(0, size).toString("utf8")
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

function line(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  try {
    const parsed: unknown = JSON.parse(trimmed)
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
  let closed = false
  const nativeID = `${input.agent}_${crypto.randomUUID().replaceAll("-", "")}`
  const capabilities: readonly AgentOrchestrationCapability[] = ["workspace", "sessions", "turns"]
  const turn = async (prompt: string) => {
    if (closed) throw new Error(`${input.agent} session is closed`)
    if (active) throw new Error(`${input.agent} already has an active turn`)
    const next = (input.start ?? launch)(input.agent, input.cwd, prompt)
    const stdin = next.stdin
    const stdout = next.stdout
    const stderrStream = next.stderr
    if (!stdin || !stdout || !stderrStream) {
      await stop(next)
      throw new Error(`${input.agent} CLI did not provide stdio`)
    }
    active = next
    const result = await new Promise<{ code: number | null; error?: string }>((resolve) => {
      let buffer = ""
      let stderr = ""
      let settled = false
      const done = (value: { code: number | null; error?: string }) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      }
      const flush = () => {
        const value = line(buffer)
        if (value) input.emit({ type: "output", text: value, nativeID })
        buffer = ""
      }
      stdout.on("data", (chunk: Buffer) => {
        buffer = clip(`${buffer}${chunk.toString("utf8")}`, AgentOrchestrationLimits.maxTextBytes)
        const values = buffer.split(/\r?\n/)
        buffer = values.pop() ?? ""
        values
          .map(line)
          .filter(Boolean)
          .forEach((value) => input.emit({ type: "output", text: value, nativeID }))
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
    active = undefined
    if (result.error) throw new Error(result.error)
  }
  return {
    nativeID,
    capabilities,
    turn,
    approval: () => false,
    question: () => false,
    close: async () => {
      closed = true
      if (active) await stop(active)
    },
  }
}
