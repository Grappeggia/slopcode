import path from "path"

export function readResource(worktree: string, filepath: string) {
  return path.relative(worktree, filepath)
}
