import { expect, test } from "bun:test"

const source = await Bun.file(new URL("../../src/component/dialog-status.tsx", import.meta.url)).text()

test("status dialog retains V2-first ChatGPT Codex usage wiring", () => {
  expect(source).toContain("loadOpenAIUsage(")
  expect(source).toContain("sdk.client.v2.provider.openai.usage(")
  expect(source).toContain("sdk.client.provider.openai.usage(")
  expect(source).toContain("ChatGPT Codex usage")
  expect(source).toContain("<scrollbox")
})
