import type {
  AgentOrchestrationAgentID,
  AgentOrchestrationBackendMode,
  AgentOrchestrationCapability,
} from "@slopcode-ai/protocol"

export const bridgeVersion = "1.0.0"

const commands: Record<AgentOrchestrationAgentID, readonly string[]> = {
  slopcode: ["slopcode", "--version"],
  opencode: ["opencode", "--version"],
  codex: ["codex", "--version"],
  claude: ["claude", "--version"],
  antigravity: ["agy", "--version"],
}
const modes: Record<AgentOrchestrationAgentID, AgentOrchestrationBackendMode> = {
  slopcode: "acp",
  opencode: "acp",
  codex: "app_server",
  claude: "streaming_cli",
  antigravity: "sandboxed_cli",
}
const capabilities: Record<AgentOrchestrationAgentID, readonly AgentOrchestrationCapability[]> = {
  slopcode: ["workspace", "sessions", "turns", "approvals", "questions", "replay", "streaming"],
  opencode: ["workspace", "sessions", "turns", "approvals", "questions", "replay", "streaming"],
  codex: ["workspace", "sessions", "turns", "approvals", "questions", "plans", "artifacts", "replay", "streaming"],
  claude: ["workspace", "sessions", "turns", "approvals", "streaming", "permissions"],
  antigravity: ["workspace", "sessions", "turns", "streaming", "sandboxed"],
}

export type Result = {
  version: string
  mode: AgentOrchestrationBackendMode
  capabilities: readonly AgentOrchestrationCapability[]
}
export type Probe = (agent: AgentOrchestrationAgentID, cwd: string) => Promise<Result>

const clean = (value: string) =>
  value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .trim()
    .slice(0, 256) || "unknown"

export const probe: Probe = async (agent, cwd) => {
  let child: ReturnType<typeof Bun.spawn>
  try {
    child = Bun.spawn([...commands[agent]], { cwd, stdout: "pipe", stderr: "pipe" })
  } catch (error) {
    throw new Error(`${agent} executable is unavailable: ${error instanceof Error ? error.message : "spawn failed"}`)
  }
  const timer = setTimeout(() => child.kill(), 5_000)
  if (!child.stdout || typeof child.stdout === "number" || !child.stderr || typeof child.stderr === "number")
    throw new Error(`${agent} version check did not provide output streams`)
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]).finally(() => clearTimeout(timer))
  if (code !== 0) throw new Error(clean(stderr) || `${agent} version check failed`)
  return { version: clean(stdout || stderr), mode: modes[agent], capabilities: capabilities[agent] }
}
