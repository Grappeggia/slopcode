export type MemorySettings = {
  status: "enabled" | "disabled"
}

export function settings(input: unknown) {
  if (!input || typeof input !== "object") return
  const item = input as Record<string, unknown>
  if (item.status === "enabled" || item.status === "disabled") return { status: item.status } satisfies MemorySettings
}

export function active(metadata: Record<string, unknown> | undefined, config: { enabled?: boolean } | undefined) {
  const current = settings(metadata?.memory)
  if (current?.status === "enabled") return true
  if (current?.status === "disabled") return false
  return config?.enabled === true
}

export function metadata(metadata: Record<string, unknown> | undefined, item: MemorySettings | undefined) {
  const next = { ...(metadata ?? {}) }
  if (!item) delete next.memory
  else next.memory = item
  return next
}
