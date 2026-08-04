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
const capabilities: Record<Exclude<AgentOrchestrationAgentID, "codex">, readonly AgentOrchestrationCapability[]> = {
  slopcode: ["workspace", "sessions", "turns", "approvals", "questions", "streaming"],
  opencode: ["workspace", "sessions", "turns", "approvals", "questions", "streaming"],
  claude: ["workspace", "sessions", "turns", "approvals", "streaming", "permissions"],
  antigravity: ["workspace", "sessions", "turns", "streaming", "sandboxed"],
}
const codex = {
  app_server: ["workspace", "sessions", "turns", "approvals", "questions", "plans", "artifacts", "replay", "streaming", "cancel", "steer"],
  cli: ["workspace", "sessions", "turns", "streaming"],
} as const satisfies Record<"app_server" | "cli", readonly AgentOrchestrationCapability[]>

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

export type Execute = (
  argv: readonly string[],
  cwd: string,
) => Promise<{ code: number; stdout: string; stderr: string }>

const run: Execute = async (argv, cwd) => {
  let child: ReturnType<typeof Bun.spawn>
  try {
    child = Bun.spawn([...argv], { cwd, stdout: "pipe", stderr: "pipe" })
  } catch (error) {
    return { code: -1, stdout: "", stderr: error instanceof Error ? error.message : "spawn failed" }
  }
  const timer = setTimeout(() => child.kill(), 5_000)
  if (!child.stdout || typeof child.stdout === "number" || !child.stderr || typeof child.stderr === "number") {
    child.kill()
    clearTimeout(timer)
    return { code: -1, stdout: "", stderr: "version check did not provide output streams" }
  }
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]).finally(() => clearTimeout(timer))
  return { code, stdout, stderr }
}

export const inspect = async (
  agent: AgentOrchestrationAgentID,
  cwd: string,
  execute: Execute = run,
): Promise<Result> => {
  const version = await execute(commands[agent], cwd)
  if (version.code !== 0) throw new Error(clean(version.stderr) || `${agent} version check failed`)
  if (agent === "codex") {
    const app = await execute(["codex", "app-server", "--help"], cwd)
    if (app.code === 0)
      return { version: clean(version.stdout || version.stderr), mode: "app_server", capabilities: codex.app_server }
    const cli = await execute(["codex", "exec", "--help"], cwd)
    if (cli.code !== 0) throw new Error(clean(cli.stderr) || "codex exec is unavailable")
    return { version: clean(version.stdout || version.stderr), mode: "cli", capabilities: codex.cli }
  }
  if (agent === "slopcode" || agent === "opencode") {
    const acp = await execute([agent, "acp", "--help"], cwd)
    if (acp.code !== 0) throw new Error(clean(acp.stderr) || `${agent} ACP mode is unavailable`)
    return { version: clean(version.stdout || version.stderr), mode: "acp", capabilities: capabilities[agent] }
  }
  return {
    version: clean(version.stdout || version.stderr),
    mode: agent === "antigravity" ? "sandboxed_cli" : "streaming_cli",
    capabilities: capabilities[agent],
  }
}

export const probe: Probe = (agent, cwd) => inspect(agent, cwd)
