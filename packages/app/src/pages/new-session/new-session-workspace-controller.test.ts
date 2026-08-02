import { describe, expect, test } from "bun:test"
import {
  CREATE_NEW_SESSION_WORKTREE,
  MAIN_NEW_SESSION_WORKTREE,
  newSessionWorkspaceOptions,
  normalizeNewSessionWorktree,
  resolveNewSessionWorktree,
  shouldResetNewSessionWorktree,
} from "./new-session-workspace-controller"

describe("new session workspace selection", () => {
  test("uses the draft directory when it is an existing sandbox", () => {
    expect(
      resolveNewSessionWorktree({
        directory: "/project/feature",
        projectWorktree: "/project",
      }),
    ).toBe("/project/feature")
  })

  test("uses main for a draft at the project root", () => {
    expect(
      resolveNewSessionWorktree({
        directory: "/project",
        projectWorktree: "/project",
      }),
    ).toBe(MAIN_NEW_SESSION_WORKTREE)
  })

  test("keeps an explicit create or sandbox selection", () => {
    expect(
      resolveNewSessionWorktree({
        selected: "create",
        directory: "/project",
        projectWorktree: "/project",
      }),
    ).toBe("create")
    expect(
      resolveNewSessionWorktree({
        selected: "/project/feature",
        directory: "/project",
        projectWorktree: "/project",
      }),
    ).toBe("/project/feature")
  })

  test("maps main to the project root when retargeting a sandbox draft", () => {
    expect(normalizeNewSessionWorktree("main", "/project/feature", "/project")).toBe("/project")
    expect(normalizeNewSessionWorktree("main", "/project", "/project")).toBe("main")
  })

  test("exposes accessible picker values and create only for Git projects", () => {
    expect(
      newSessionWorkspaceOptions({
        worktree: "/project",
        sandboxes: ["/project/feature", "/project", "/project/fix"],
        vcs: "git",
      }),
    ).toEqual({
      items: [MAIN_NEW_SESSION_WORKTREE, "/project/feature", "/project/fix"],
      action: CREATE_NEW_SESSION_WORKTREE,
    })

    expect(
      newSessionWorkspaceOptions({
        worktree: "/project",
        sandboxes: ["/project/feature"],
        vcs: "none",
      }),
    ).toEqual({
      items: [MAIN_NEW_SESSION_WORKTREE, "/project/feature"],
      action: undefined,
    })
  })

  test("resets the workspace only when changing projects", () => {
    expect(shouldResetNewSessionWorktree("/project", "/project")).toBe(false)
    expect(shouldResetNewSessionWorktree("/project", "/other-project")).toBe(true)
  })
})
