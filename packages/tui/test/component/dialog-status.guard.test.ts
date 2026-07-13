import { expect, test } from "bun:test"

const source = await Bun.file(new URL("../../src/component/dialog-status.tsx", import.meta.url)).text()

test("status dialog retains V2-first ChatGPT Codex usage wiring", () => {
  const start = source.indexOf("const [openai] = createResource(")
  const end = source.indexOf("\n\n  const messages", start)
  const resource = source.slice(start, end)
  const load = resource.indexOf("return loadOpenAIUsage(")
  const v2 = resource.indexOf(
    "() => sdk.client.v2.provider.openai.usage({}, { throwOnError: true }).then((response) => response.data.data)",
  )
  const legacy = resource.indexOf(
    "() => sdk.client.provider.openai.usage({}, { throwOnError: true }).then((response) => response.data)",
  )

  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)
  expect(resource).toContain('() => local.model.current()?.providerID === "openai"')
  expect(load).toBeGreaterThanOrEqual(0)
  expect(v2).toBeGreaterThan(load)
  expect(legacy).toBeGreaterThan(v2)
  expect(source).toContain("ChatGPT Codex usage")
  expect(source).toContain("<scrollbox")
})
