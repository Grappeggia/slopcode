import { expect, test } from "bun:test"
import { SessionCompaction } from "@slopcode-ai/core/session/compaction"

test("compaction describes tool media without embedding base64", () => {
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
  const serialized = SessionCompaction.serializeToolContent([
    { type: "text", text: "Image read successfully" },
    {
      type: "file",
      uri: `data:image/png;base64,${base64}`,
      mime: "image/png",
      name: "pixel.png",
    },
  ])

  expect(serialized).toBe("Image read successfully\n[Attached image/png: pixel.png]")
  expect(serialized).not.toContain(base64)
})

test("manual compaction adds a custom instruction to the shared summary prompt", () => {
  const prompt = SessionCompaction.buildPrompt({
    context: ["[User]: Keep this history"],
    instruction: "Emphasize unresolved test failures",
  })

  expect(prompt).toContain("Additional summary instruction")
  expect(prompt).toContain("Emphasize unresolved test failures")
  expect(prompt).toContain("[User]: Keep this history")
})
