import { expect, test } from "bun:test"
import { selectDirectoryStore } from "./directory-sync"

test("selected-worktree optimistic updates target only the destination store", () => {
  const source = { messages: [] as string[] }
  const destination = { messages: [] as string[] }
  const store = selectDirectoryStore("/repo/main", "/repo/worktree", source, () => destination)

  store.messages.push("optimistic prompt")

  expect(destination.messages).toEqual(["optimistic prompt"])
  expect(source.messages).toEqual([])
})
