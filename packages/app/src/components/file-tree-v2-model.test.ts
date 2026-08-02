import { describe, expect, test } from "bun:test"
import type { FileNode } from "@slopcode-ai/sdk/v2"
import { buildFileTreeV2Model, flattenFileTreeV2, flattenLiveFileTreeV2 } from "./file-tree-v2-model"

describe("file tree v2 model", () => {
  test("normalizes, sorts, and flattens filtered paths", () => {
    const model = buildFileTreeV2Model(["src/z.ts", "src/lib/b.ts", "src\\lib\\a.ts", "/README.md/"])

    expect(model.total).toBe(6)
    expect(flattenFileTreeV2(model, () => true).map((row) => [row.node.path, row.node.type, row.level])).toEqual([
      ["src", "directory", 0],
      ["src/lib", "directory", 1],
      ["src/lib/a.ts", "file", 2],
      ["src/lib/b.ts", "file", 2],
      ["src/z.ts", "file", 1],
      ["README.md", "file", 0],
    ])
  })

  test("keeps collapsed descendants out of the rendered window", () => {
    const model = buildFileTreeV2Model(["src/lib/a.ts", "src/z.ts"])
    expect(flattenFileTreeV2(model, (path) => path !== "src/lib").map((row) => row.node.path)).toEqual([
      "src",
      "src/lib",
      "src/z.ts",
    ])
  })

  test("promotes a deleted file into a directory when a replacement adds descendants", () => {
    const model = buildFileTreeV2Model(["src", "src/a.ts", "src/z.ts"])

    expect(flattenFileTreeV2(model, () => true).map((row) => [row.node.path, row.node.type, row.level])).toEqual([
      ["src", "directory", 0],
      ["src/a.ts", "file", 1],
      ["src/z.ts", "file", 1],
    ])
  })

  test("flattens large live trees iteratively", () => {
    const count = 2_000
    const nodes: Record<string, FileNode[]> = {
      "": [{ name: "src", path: "src", absolute: "/repo/src", type: "directory", ignored: false }],
      src: Array.from({ length: count }, (_, index) => ({
        name: `${index}.ts`,
        path: `src/${index}.ts`,
        absolute: `/repo/src/${index}.ts`,
        type: "file" as const,
        ignored: false,
      })),
    }

    const rows = flattenLiveFileTreeV2(
      (path) => nodes[path] ?? [],
      (path) => path === "src",
    )
    expect(rows).toHaveLength(count + 1)
    expect(rows.at(-1)?.node.originalPath).toBe(`src/${count - 1}.ts`)
  })
})
