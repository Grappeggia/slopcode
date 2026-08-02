import type { SnapshotFileDiff, VcsFileDiff } from "@slopcode-ai/sdk/v2"
import type { Kind } from "@/components/file-tree-v2"
import { normalizeFileTreeV2Path } from "@/components/file-tree-v2-model"

export type RenderDiff = (SnapshotFileDiff & { file: string }) | VcsFileDiff

export function filterRenderableDiff(value: SnapshotFileDiff | VcsFileDiff): value is RenderDiff {
  return typeof value.file === "string"
}

export function reviewDiffKinds(diffs: RenderDiff[]) {
  const merge = (a: Kind | undefined, b: Kind) => {
    if (!a) return b
    if (a === b) return a
    return "mix" as const
  }

  const result = new Map<string, Kind>()
  diffs.forEach((diff) => {
    const file = normalizeFileTreeV2Path(diff.file)
    const kind = diff.status === "added" ? "add" : diff.status === "deleted" ? "del" : "mix"
    result.set(file, kind)
    const parts = file.split("/")
    parts.slice(0, -1).forEach((_, index) => {
      const dir = parts.slice(0, index + 1).join("/")
      if (dir) result.set(dir, merge(result.get(dir), kind))
    })
  })
  return result
}

export function filterReviewFiles(files: readonly string[], query: string) {
  const value = query.trim().toLowerCase()
  if (!value) return files
  return files.filter((file) => file.toLowerCase().includes(value))
}

export function activeReviewFile(files: readonly string[], filtered: readonly string[], active?: string) {
  if (active && files.includes(active)) return active
  return filtered[0] ?? files[0]
}
