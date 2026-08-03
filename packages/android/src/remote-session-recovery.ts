import type { RemoteJob, RemoteSessionDeepLink } from "./remote-jobs"

export type RemoteSessionResolution =
  | { job: RemoteJob }
  | { error: "Session unavailable or expired. Choose a workspace or start a new session." }

export function resolveRemoteSession(link: RemoteSessionDeepLink, jobs: RemoteJob[]): RemoteSessionResolution {
  if (!link.sessionID) return { error: "Session unavailable or expired. Choose a workspace or start a new session." }
  const job = jobs.find(
    (item) => item.id === link.jobID && item.sessionID === link.sessionID,
  )
  if (job) return { job }
  return { error: "Session unavailable or expired. Choose a workspace or start a new session." }
}
