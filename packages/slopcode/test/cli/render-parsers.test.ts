import { describe, expect, test } from "bun:test"
import parsers from "../../parsers-config"

describe("render parsers config", () => {
  test("includes Vue parser highlight queries", () => {
    const vue = parsers.parsers.find((item) => item.filetype === "vue")

    expect(vue?.wasm).toContain("tree-sitter-vue")
    expect(vue?.queries.highlights).toEqual([
      "https://raw.githubusercontent.com/anomalyco/tree-sitter-vue/v0.1.2/queries/html_tags/highlights.scm",
      "https://raw.githubusercontent.com/anomalyco/tree-sitter-vue/v0.1.2/queries/vue/highlights.scm",
    ])
  })
})
