import { describe, expect, test } from "bun:test"
import {
  autocompleteLines,
  autocompleteSingleWidth,
} from "../../../src/cli/cmd/tui/component/prompt/autocomplete-layout"

function maxWidth(lines: { text: string }[]) {
  return lines.reduce((best, item) => Math.max(best, Bun.stringWidth(item.text)), 0)
}

describe("prompt autocomplete overflow", () => {
  test("reproduces previous overflow for long suggestion descriptions", () => {
    const option = {
      display: "@src/server/routes/session.ts",
      description: " model fallback routing and provider override behavior details",
    }

    expect(autocompleteSingleWidth(option)).toBeGreaterThan(42)
  })

  test("wraps long suggestion descriptions to available width", () => {
    const option = {
      display: "@src/server/routes/session.ts",
      description: " model fallback routing and provider override behavior details",
    }

    const lines = autocompleteLines(option, 42)
    expect(lines.length).toBeGreaterThan(1)
    expect(maxWidth(lines)).toBeLessThanOrEqual(42)
  })

  test("wraps long slash command labels to available width", () => {
    const option = {
      display: "/very-very-very-very-long-command-name",
    }

    const lines = autocompleteLines(option, 24)
    expect(lines.length).toBeGreaterThan(1)
    expect(maxWidth(lines)).toBeLessThanOrEqual(24)
  })
})
