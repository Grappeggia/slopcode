import type { SshTransport } from "./ssh"
import type { OrchestratorState } from "./ssh-orchestrator"

type View = "agentic" | "interactive"

export function canSubmit(phase: OrchestratorState["phase"]) {
  return phase !== "waiting" && phase !== "stopped"
}

export function canRetry(phase: OrchestratorState["phase"], sessionID: string | undefined, connected: boolean) {
  return phase !== "stopped" && !!sessionID && connected
}

export async function stopAgentic(ssh: Pick<SshTransport, "orchestratorStop">, close: () => void) {
  await ssh.orchestratorStop()
  close()
}

export async function reconnectAgentic(
  ssh: Pick<SshTransport, "orchestratorStop">,
  close: () => void,
  prompt: string | undefined,
  start: (prompt: string | undefined) => Promise<void>,
) {
  await stopAgentic(ssh, close)
  await start(prompt)
}

export async function handoffToInteractive(
  ssh: Pick<SshTransport, "orchestratorStop">,
  close: () => void,
  select: (view: View) => void,
) {
  await stopAgentic(ssh, close)
  select("interactive")
}

export async function returnToAgentic(ssh: Pick<SshTransport, "cleanup">, select: (view: View) => void) {
  await ssh.cleanup()
  select("agentic")
}
