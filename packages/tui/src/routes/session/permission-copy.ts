export function permissionAlwaysLines(permission: string, patterns: string[]) {
  if (!patterns.length) return []
  if (patterns.length === 1 && patterns[0] === "*") {
    return [`This will remember ${permission} for this project until revoked.`]
  }
  return [
    "This will remember the following patterns for this project until revoked.",
    ...patterns.map((pattern) => `- ${pattern}`),
  ]
}

export function permissionActions(patterns: string[]): Record<string, string> {
  if (!patterns.length) return { once: "Allow once", reject: "Reject" } as const
  return { once: "Allow once", always: "Allow always", reject: "Reject" } as const
}
