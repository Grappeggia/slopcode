import { describe, expect, mock, test } from "bun:test"
import { OpenAIResponsesLanguageModel } from "../../src/github-copilot/responses/openai-responses-language-model"
import { convertToOpenAIResponsesInput } from "../../src/github-copilot/responses/convert-to-openai-responses-input"
import type { LanguageModelV3Prompt } from "@ai-sdk/provider"

const prompt: LanguageModelV3Prompt = [{ role: "user", content: [{ type: "text", text: "Hello" }] }]

describe("GitHub Copilot Responses metadata", () => {
  test("attaches response item metadata to the copilot namespace", async () => {
    const fetch = mock(
      async () =>
        new Response(
          JSON.stringify({
            id: "resp_1",
            created_at: 0,
            model: "gpt-5.5",
            output: [
              {
                type: "reasoning",
                id: "rs_1",
                encrypted_content: "enc_1",
                summary: [{ type: "summary_text", text: "thinking..." }],
              },
              {
                type: "message",
                role: "assistant",
                id: "msg_1",
                content: [{ type: "output_text", text: "Hello there", annotations: [] }],
              },
              {
                type: "function_call",
                call_id: "call_1",
                name: "bash",
                arguments: "{}",
                id: "fc_1",
              },
            ],
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    )
    const model = new OpenAIResponsesLanguageModel("test-model", {
      provider: "copilot",
      url: () => "https://api.test.com/responses",
      headers: () => ({ Authorization: "Bearer test-token" }),
      fetch: fetch as typeof globalThis.fetch,
    })

    const result = await model.doGenerate({ prompt, includeRawChunks: false })
    const reasoning = result.content.find((part) => part.type === "reasoning")
    const text = result.content.find((part) => part.type === "text")
    const tool = result.content.find((part) => part.type === "tool-call")

    expect(reasoning?.providerMetadata?.copilot?.itemId).toBe("rs_1")
    expect(reasoning?.providerMetadata?.openai).toBeUndefined()
    expect(text?.providerMetadata?.copilot?.itemId).toBe("msg_1")
    expect(tool?.providerMetadata?.copilot?.itemId).toBe("fc_1")
    expect(result.providerMetadata?.copilot?.responseId).toBe("resp_1")
  })

  test("reads stored tool item IDs from the copilot namespace", async () => {
    const result = await convertToOpenAIResponsesInput({
      prompt: [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "bash",
              input: { command: "ls" },
              providerOptions: { copilot: { itemId: "fc_1" } },
            },
          ],
        },
      ],
      systemMessageMode: "system",
      store: true,
    })

    expect(result.input[0]).toMatchObject({ type: "function_call", call_id: "call_1", id: "fc_1" })
  })
})
