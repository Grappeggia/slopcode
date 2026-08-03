import type { RemoteJob, RemoteSessionDeepLink } from "./remote-jobs"
import { resolveRemoteSession } from "./remote-session-recovery"

export type SshRemoteSessionRoute =
  | { kind: "agentic" }
  | { kind: "durable-job"; job: RemoteJob }
  | { kind: "recovery"; message: string }

export function sshRemoteSessionRoute(
  link: RemoteSessionDeepLink | undefined,
  jobs: RemoteJob[],
): SshRemoteSessionRoute {
  if (!link) return { kind: "agentic" }
  const result = resolveRemoteSession(link, jobs)
  if ("error" in result) return { kind: "recovery", message: result.error }
  return { kind: "durable-job", job: result.job }
}
