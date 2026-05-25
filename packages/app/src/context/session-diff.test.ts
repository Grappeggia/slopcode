import { describe, expect, test } from "bun:test"
import type { SessionDiffEntry } from "@slopcode-ai/sdk/v2/client"
import { diffBatches, diffComplete, mergeDiffs } from "./session-diff"

const entry = (input: Partial<SessionDiffEntry> & Pick<SessionDiffEntry, "file" | "additions" | "deletions">) => input

describe("mergeDiffs", () => {
  test("keeps index order while hydrating content", () => {
    const current = [
      entry({ file: "b.ts", additions: 2, deletions: 1, bytes: 200 }),
      entry({ file: "a.ts", additions: 1, deletions: 0, bytes: 100 }),
    ]
    const next = mergeDiffs(current, [entry({ file: "a.ts", additions: 1, deletions: 0, before: "old", after: "new" })])

    expect(next.map((item) => item.file)).toEqual(["b.ts", "a.ts"])
    expect(next[1]).toMatchObject({
      file: "a.ts",
      before: "old",
      after: "new",
      bytes: 100,
    })
  })
})

describe("diffComplete", () => {
  test("returns false for partial diffs", () => {
    expect(diffComplete([entry({ file: "a.ts", additions: 1, deletions: 0 })])).toBe(false)
  })

  test("returns true when every diff is hydrated", () => {
    expect(
      diffComplete([
        entry({ file: "a.ts", additions: 1, deletions: 0, before: "old", after: "new" }),
        entry({ file: "b.ts", additions: 0, deletions: 1, before: "left", after: "" }),
      ]),
    ).toBe(true)
  })
})

describe("diffBatches", () => {
  test("sorts pending files by size and skips hydrated ones", () => {
    const batches = diffBatches(
      [
        entry({ file: "hydrated.ts", additions: 1, deletions: 0, before: "a", after: "b", bytes: 50 }),
        entry({ file: "large.ts", additions: 10, deletions: 4, bytes: 700 }),
        entry({ file: "small.ts", additions: 1, deletions: 1, bytes: 100 }),
        entry({ file: "medium.ts", additions: 4, deletions: 2, bytes: 400 }),
      ],
      500,
    )

    expect(batches).toEqual([["small.ts", "medium.ts"], ["large.ts"]])
  })
})
