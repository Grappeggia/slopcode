import { describe, expect, test } from "bun:test"
import type { AssistantMessage, Part } from "@slopcode-ai/sdk/v2"
import * as TokenLimit from "../../../src/cli/cmd/tui/component/prompt/token-limit"

function assistant(id: string, model: { providerID: string; modelID: string }): AssistantMessage {
  return {
    id,
    sessionID: "ses_1",
    role: "assistant",
    time: { created: 1, completed: 2 },
    parentID: "msg_user",
    modelID: model.modelID,
    providerID: model.providerID,
    mode: "primary",
    agent: "build",
    path: { cwd: "/tmp", root: "/tmp" },
    cost: 0,
    tokens: {
      total: 0,
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
  }
}

function finish(consumedPct?: number): Part {
  return {
    id: "part_1",
    messageID: "msg_1",
    sessionID: "ses_1",
    type: "step-finish",
    reason: "stop",
    cost: 0,
    tokens: {
      total: 0,
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
    ...(consumedPct === undefined
      ? {}
      : {
          metadata: {
            slopcode: {
              tokenLimit: {
                consumedPct,
              },
            },
          },
        }),
  }
}

describe("prompt token limit", () => {
  test("formats the latest matching model limit", () => {
    const model = { providerID: "openai", modelID: "gpt-5.4" }
    const value = TokenLimit.consumed({
      model,
      messages: [assistant("msg_old", model), assistant("msg_new", model)],
      parts: {
        msg_old: [{ ...finish(41), messageID: "msg_old" }],
        msg_new: [{ ...finish(63), messageID: "msg_new" }],
      },
    })

    expect(value).toBe(63)
    expect(TokenLimit.label(value)).toBe("63% limit consumed")
  })

  test("ignores assistant turns from other models", () => {
    const value = TokenLimit.consumed({
      model: { providerID: "openai", modelID: "gpt-5.4" },
      messages: [
        assistant("msg_other", { providerID: "anthropic", modelID: "claude-sonnet-4" }),
        assistant("msg_current", { providerID: "openai", modelID: "gpt-5.4" }),
      ],
      parts: {
        msg_other: [{ ...finish(99), messageID: "msg_other" }],
        msg_current: [{ ...finish(58), messageID: "msg_current" }],
      },
    })

    expect(value).toBe(58)
  })

  test("falls back to the last completed turn with metadata", () => {
    const model = { providerID: "openai", modelID: "gpt-5.4" }
    const value = TokenLimit.consumed({
      model,
      messages: [assistant("msg_old", model), assistant("msg_new", model)],
      parts: {
        msg_old: [{ ...finish(63), messageID: "msg_old" }],
        msg_new: [{ ...finish(), messageID: "msg_new" }],
      },
    })

    expect(value).toBe(63)
  })
})
