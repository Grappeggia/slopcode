import { describe, expect, test } from "bun:test"
import { createPromptFilePart, promptFileVirtualText } from "../../../src/cli/cmd/tui/component/prompt/file-part"

describe("prompt file part", () => {
  test("builds file urls from the project directory", () => {
    const part = createPromptFilePart({
      directory: "/tmp/project",
      path: "src/index.ts",
    })

    expect(part.filename).toBe("src/index.ts")
    expect(part.url).toBe("file:///tmp/project/src/index.ts")
    expect(part.source.path).toBe("src/index.ts")
  })

  test("adds line ranges to the filename and url", () => {
    const part = createPromptFilePart({
      directory: "/tmp/project",
      path: "src/index.ts",
      lineRange: {
        startLine: 12,
        endLine: 18,
      },
    })
    const url = new URL(part.url)

    expect(part.filename).toBe("src/index.ts#12-18")
    expect(url.searchParams.get("start")).toBe("12")
    expect(url.searchParams.get("end")).toBe("18")
  })

  test("renders virtual text with an at sign", () => {
    expect(promptFileVirtualText("src/index.ts")).toBe("@src/index.ts")
  })
})
