export type Goal = {
  text: string
  status: "active" | "paused"
  updatedAt: number
}

export function goal(input: unknown) {
  if (!input || typeof input !== "object") return
  const item = input as Record<string, unknown>
  if (typeof item.text !== "string" || item.text.trim() === "") return
  return {
    text: item.text,
    status: item.status === "paused" ? "paused" : "active",
    updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : 0,
  } satisfies Goal
}

export function message(item: Goal | undefined) {
  if (!item) return "No goal is set."
  return `${item.status === "paused" ? "Paused" : "Active"}: ${item.text}`
}

export function metadata(metadata: Record<string, unknown> | undefined, item: Goal | undefined) {
  const next = { ...(metadata ?? {}) }
  if (!item) delete next.goal
  else next.goal = item
  return next
}

export function action(input: string, existing: Goal | undefined, now = Date.now()) {
  const text = input.trim()
  const command = text.toLowerCase()
  if (command === "" || command === "show" || command === "status") {
    return { type: "show" as const, message: message(existing) }
  }
  if ((command === "pause" || command === "resume") && !existing) {
    return { type: "missing" as const, message: "No goal is set" }
  }
  const next =
    command === "clear"
      ? undefined
      : command === "pause" && existing
        ? { ...existing, status: "paused" as const, updatedAt: now }
        : command === "resume" && existing
          ? { ...existing, status: "active" as const, updatedAt: now }
          : { text, status: "active" as const, updatedAt: now }
  return { type: "update" as const, next, message: next ? message(next) : "Goal cleared" }
}
