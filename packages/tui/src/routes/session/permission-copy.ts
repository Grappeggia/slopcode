export function permissionAlwaysLines(permission: string, patterns: string[]) {
  if (patterns.length === 1 && patterns[0] === "*") {
    return [`This will remember ${permission} for this project until revoked.`]
  }
  return [
    "This will remember the following patterns for this project until revoked.",
    ...patterns.map((pattern) => `- ${pattern}`),
  ]
}
