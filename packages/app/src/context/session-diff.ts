import type { SessionDiffEntry } from "@slopcode-ai/sdk/v2/client"

export const diffBatchBytes = 1_000_000

function size(input: SessionDiffEntry) {
  if (typeof input.bytes === "number") return Math.max(input.bytes, 1)
  const before = typeof input.before === "string" ? input.before.length * 2 : 0
  const after = typeof input.after === "string" ? input.after.length * 2 : 0
  return Math.max(before + after, 1)
}

export function diffHydrated(input: SessionDiffEntry) {
  return typeof input.before === "string" && typeof input.after === "string"
}

export function diffComplete(input: SessionDiffEntry[] | undefined) {
  return input !== undefined && input.every(diffHydrated)
}

export function diffBatches(input: SessionDiffEntry[], max = diffBatchBytes) {
  const out: string[][] = []
  const pending = input.filter((item) => !diffHydrated(item)).toSorted((a, b) => size(a) - size(b))
  let batch: string[] = []
  let total = 0

  for (const item of pending) {
    const next = size(item)
    if (batch.length > 0 && total + next > max) {
      out.push(batch)
      batch = []
      total = 0
    }
    batch.push(item.file)
    total += next
  }

  if (batch.length > 0) out.push(batch)
  return out
}

export function mergeDiffs(current: SessionDiffEntry[] | undefined, incoming: SessionDiffEntry[]) {
  if (!current || current.length === 0) {
    return incoming.map((item) => ({
      ...item,
      bytes: item.bytes ?? size(item),
    }))
  }

  const map = new Map(current.map((item) => [item.file, item]))
  const order = current.map((item) => item.file)

  for (const item of incoming) {
    const prev = map.get(item.file)
    const next = {
      ...prev,
      ...item,
      before: item.before ?? prev?.before,
      after: item.after ?? prev?.after,
      bytes: item.bytes ?? prev?.bytes ?? size({ ...prev, ...item }),
    } satisfies SessionDiffEntry
    if (!map.has(item.file)) order.push(item.file)
    map.set(item.file, next)
  }

  return order.flatMap((file) => {
    const item = map.get(file)
    if (!item) return []
    return [item]
  })
}
