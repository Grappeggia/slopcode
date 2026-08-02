export const MAIN_NEW_SESSION_WORKTREE = "main"
export const CREATE_NEW_SESSION_WORKTREE = "create"

type Project = {
  worktree: string
  sandboxes?: string[]
  vcs?: string
}

export function resolveNewSessionWorktree(input: { selected?: string; directory: string; projectWorktree?: string }) {
  if (input.selected) return input.selected
  if (input.projectWorktree && input.directory !== input.projectWorktree) return input.directory
  return MAIN_NEW_SESSION_WORKTREE
}

export function normalizeNewSessionWorktree(value: string, directory: string, projectWorktree?: string) {
  if (value === MAIN_NEW_SESSION_WORKTREE && projectWorktree && projectWorktree !== directory) return projectWorktree
  return value
}

export function newSessionWorkspaceOptions(project?: Project) {
  if (!project) return { items: [MAIN_NEW_SESSION_WORKTREE], action: undefined }
  return {
    items: [MAIN_NEW_SESSION_WORKTREE, ...(project.sandboxes ?? []).filter((item) => item !== project.worktree)],
    action: project.vcs === "git" ? CREATE_NEW_SESSION_WORKTREE : undefined,
  }
}

export function shouldResetNewSessionWorktree(current: string | undefined, next: string) {
  return current !== next
}
