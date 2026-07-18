export type PermissionScopeLabel = "project" | "folder"

export function permissionProjectLines(patterns: string[], scope?: PermissionScopeLabel) {
  if (!patterns.length || !scope) return []
  return [
    `This approval survives restarts and remains active for this ${scope} until revoked.`,
    "The following exact patterns will always be allowed:",
    ...patterns.map((pattern) => `- ${pattern}`),
  ]
}

export function permissionActions(patterns: string[], scope?: PermissionScopeLabel): Record<string, string> {
  if (!patterns.length) return { once: "Allow once", reject: "Reject" } as const
  return {
    once: "Allow once",
    always: "Allow for this session",
    ...(scope ? { project: `Always allow these patterns for this ${scope}` } : {}),
    reject: "Reject",
  } as const
}
