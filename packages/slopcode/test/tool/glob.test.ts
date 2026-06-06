import { describe, expect, test } from "bun:test"
import path from "path"
import { GlobTool } from "../../src/tool/glob"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

const ctx = {
  sessionID: "test",
  messageID: "",
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => {},
  ask: async () => {},
}

describe("tool.glob", () => {
  test("matches files in a directory", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "a.ts"), "export const a = 1")
        await Bun.write(path.join(dir, "b.txt"), "b")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const glob = await GlobTool.init()
        const result = await glob.execute({ pattern: "*.ts", path: tmp.path }, ctx)
        expect(result.metadata.count).toBe(1)
        expect(result.output).toContain("a.ts")
        expect(result.output).not.toContain("b.txt")
      },
    })
  })

  test("rejects file paths", async () => {
    await using tmp = await tmpdir({
      init: (dir) => Bun.write(path.join(dir, "a.ts"), "export const a = 1"),
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const glob = await GlobTool.init()
        await expect(glob.execute({ pattern: "*.ts", path: path.join(tmp.path, "a.ts") }, ctx)).rejects.toThrow(
          "glob path must be a directory",
        )
      },
    })
  })
})
