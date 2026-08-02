import { describe, expect, test } from "bun:test"
import { activeReviewFile, filterReviewFiles, reviewDiffKinds } from "./review-diff-kinds"

describe("review v2 file model", () => {
  test("merges normalized child statuses into directory status", () => {
    const kinds = reviewDiffKinds([
      { file: "\\src//a.ts/", additions: 1, deletions: 0, status: "added" },
      { file: "src/b.ts", additions: 0, deletions: 1, status: "deleted" },
    ])

    expect(kinds.get("src/a.ts")).toBe("add")
    expect(kinds.get("src/b.ts")).toBe("del")
    expect(kinds.get("src")).toBe("mix")
  })

  test("filters case-insensitively without reordering files", () => {
    const files = ["src/App.tsx", "src/model.ts", "README.md"]
    expect(filterReviewFiles(files, "SRC/")).toEqual(files.slice(0, 2))
    expect(filterReviewFiles(files, "  ")).toBe(files)
  })

  test("keeps a valid selection and falls back when it disappears", () => {
    const files = ["src/a.ts", "src/b.ts"]
    expect(activeReviewFile(files, files, "src/b.ts")).toBe("src/b.ts")
    expect(activeReviewFile(files, ["src/b.ts"], "old.ts")).toBe("src/b.ts")
    expect(activeReviewFile([], [], "old.ts")).toBeUndefined()
  })
})
