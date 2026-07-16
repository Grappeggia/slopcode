export function permissionGrantLines(scope: "session" | "global", permission: string, resources: string[]) {
  if (!resources.length) return []
  const lifetime = scope === "session" ? "for this session until revoked" : "globally across projects until revoked"
  return [
    `${resources.length === 1 ? "This exact" : "These exact"} ${permission} resource${resources.length === 1 ? "" : "s"} will be allowed ${lifetime}.`,
    ...resources.map((resource) => `- ${resource}`),
  ]
}

export function permissionActions(resources: string[]): Record<string, string> {
  if (!resources.length) return { once: "Allow once", reject: "Reject" } as const
  return {
    once: "Allow once",
    session: "Allow for session",
    global: "Remember globally",
    reject: "Reject",
  } as const
}
