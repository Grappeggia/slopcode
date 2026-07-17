import type { PermissionRequest, SlopcodeClient } from "@slopcode-ai/sdk/v2"

export type PermissionDecision = "once" | "always" | "project" | "reject"

export function permissionScope(vcs?: string) {
  return vcs === "git" ? ("project" as const) : ("folder" as const)
}

export function permissionRespond(
  client: SlopcodeClient,
  request: Pick<PermissionRequest, "id" | "sessionID">,
  response: PermissionDecision,
  directory?: string,
) {
  return client.permission.respond({
    sessionID: request.sessionID,
    permissionID: request.id,
    response,
    directory,
  })
}
