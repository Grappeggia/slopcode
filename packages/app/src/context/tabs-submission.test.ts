import { describe, expect, test } from "bun:test"
import { createDraftSubmissionStore, draftSubmissionOwner } from "./tabs"
import { ServerConnection } from "./server"

const local = ServerConnection.Key.make("local")

describe("draft submission store", () => {
  test("clears draft and server-owned admission state", () => {
    const store = createDraftSubmissionStore()
    const draft = draftSubmissionOwner(local, "draft-1", "/repo")
    const legacy = draftSubmissionOwner(local, undefined, "/repo")
    const state = { directory: "/repo", worktree: "main" }

    store.set(draft, state)
    store.set(legacy, state)
    store.clearDraft(local, "draft-1")
    expect(store.get(draft)).toBeUndefined()
    expect(store.get(legacy)).toBe(state)

    store.clearServer(local)
    expect(store.get(legacy)).toBeUndefined()
  })

  test("runs cleanup before invalidation and skips it for successful release", () => {
    const store = createDraftSubmissionStore()
    const owner = draftSubmissionOwner(local, "draft-1", "/repo")
    const calls: boolean[] = []
    const state = {
      directory: "/repo",
      worktree: "main",
      dispose: () => calls.push(store.get(owner) !== undefined),
    }

    store.set(owner, state)
    store.clear(owner)
    expect(calls).toEqual([true])
    expect(store.get(owner)).toBeUndefined()

    store.set(owner, state)
    store.release(owner)
    expect(calls).toEqual([true])
  })
})
