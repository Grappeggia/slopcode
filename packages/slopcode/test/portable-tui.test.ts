import { describe, expect, test } from "bun:test"
import {
  applyPortableEvent,
  createPortableState,
  parseModel,
  parseQuestionAnswer,
  parseSseBlock,
  renderPortableLines,
} from "@/cli/cmd/tui/portable"

describe("portable Termux TUI", () => {
  test("parses models and server-sent events", () => {
    expect(parseModel("anthropic/claude-sonnet-4-5")).toEqual({
      providerID: "anthropic",
      modelID: "claude-sonnet-4-5",
    })
    expect(parseModel("badmodel")).toBeUndefined()
    expect(parseSseBlock('event: message\ndata: {"type":"server.connected","properties":{}}')).toEqual({
      type: "server.connected",
      properties: {},
    })
  })

  test("reduces message, status, permission, and question events", () => {
    const state = createPortableState({ sessionID: "ses_test", model: "test/model" })

    applyPortableEvent(state, { type: "server.connected", properties: {} })
    applyPortableEvent(state, {
      type: "session.updated",
      properties: { info: { id: "ses_test", title: "Test Session" } },
    })
    applyPortableEvent(state, {
      type: "session.status",
      properties: { sessionID: "ses_test", status: { type: "busy", phase: "running", since: 1, updated: 2 } },
    })
    applyPortableEvent(state, {
      type: "message.updated",
      properties: {
        info: { id: "msg_user", sessionID: "ses_test", role: "user", time: { created: 1 } },
      },
    })
    applyPortableEvent(state, {
      type: "message.part.updated",
      properties: {
        part: { id: "prt_user", sessionID: "ses_test", messageID: "msg_user", type: "text", text: "hello" },
      },
    })
    applyPortableEvent(state, {
      type: "message.updated",
      properties: {
        info: { id: "msg_assistant", sessionID: "ses_test", role: "assistant", time: { created: 2 } },
      },
    })
    applyPortableEvent(state, {
      type: "message.part.updated",
      properties: {
        part: {
          id: "prt_tool",
          sessionID: "ses_test",
          messageID: "msg_assistant",
          type: "tool",
          tool: "bash",
          state: { status: "completed" },
        },
      },
    })
    applyPortableEvent(state, {
      type: "message.part.updated",
      properties: {
        part: { id: "prt_text", sessionID: "ses_test", messageID: "msg_assistant", type: "text", text: "hi" },
      },
    })
    applyPortableEvent(state, {
      type: "permission.asked",
      properties: {
        id: "per_test",
        sessionID: "ses_test",
        permission: "edit",
        patterns: ["*"],
      },
    })

    expect(state.connected).toBe(true)
    expect(state.status).toBe("running")
    expect(state.mode).toBe("permission")
    expect(renderPortableLines(state, 80, 20).join("\n")).toContain("Assistant: hi")
    expect(renderPortableLines(state, 80, 20).join("\n")).toContain("tool bash completed")

    applyPortableEvent(state, {
      type: "permission.replied",
      properties: { sessionID: "ses_test", requestID: "per_test", reply: "once" },
    })
    expect(state.mode).toBe("prompt")

    applyPortableEvent(state, {
      type: "question.asked",
      properties: {
        id: "que_test",
        sessionID: "ses_test",
        questions: [
          {
            header: "Choice",
            question: "Pick one",
            options: [{ label: "Yes", description: "accept" }],
          },
        ],
      },
    })
    expect(state.mode).toBe("question")
  })

  test("parses question answers by option number, label, or custom text", () => {
    const info = {
      header: "Mode",
      question: "Select mode",
      multiple: true,
      options: [
        { label: "Build", description: "build" },
        { label: "Plan", description: "plan" },
      ],
    }

    expect(parseQuestionAnswer("1, Plan", info)).toEqual(["Build", "Plan"])
    expect(parseQuestionAnswer("custom", { ...info, multiple: false })).toEqual(["custom"])
    expect(parseQuestionAnswer("custom", { ...info, custom: false })).toEqual([])
  })
})
