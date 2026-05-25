import path from "path"
import { describe, expect, test } from "bun:test"
import { tmpdir } from "../../fixture/fixture"
import {
  createPromptHistorySessionForTest,
  readPromptHistory,
  writePromptHistory,
  type PromptInfo,
} from "../../../src/cli/cmd/tui/component/prompt/history-store"

const prompt = (input: string): PromptInfo => ({
  input,
  parts: [],
  mode: "normal",
})

describe("prompt history", () => {
  test("keeps session stores isolated", () => {
    const a = createPromptHistorySessionForTest()
    const b = createPromptHistorySessionForTest()

    a.append(prompt("alpha-1"))
    a.append(prompt("alpha-2"))
    b.append(prompt("beta-1"))

    const latest = a.move(-1, prompt(""))
    expect(latest?.input).toBe("alpha-2")

    const previous = latest ? a.move(-1, latest) : undefined
    expect(previous?.input).toBe("alpha-1")

    const other = b.move(-1, prompt(""))
    expect(other?.input).toBe("beta-1")
  })

  test("reads persisted history from disk", async () => {
    await using tmp = await tmpdir()
    const file = path.join(tmp.path, "prompt-history", "ses_1.jsonl")

    await writePromptHistory(file, [prompt("first"), prompt("second")])

    const result = readPromptHistory(file)
    expect(result.dirty).toBe(false)
    expect(result.history.map((item) => item.input)).toEqual(["first", "second"])
  })
})
