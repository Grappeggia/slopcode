import { describe, expect } from "bun:test"
import { ConfigProvider, Effect, Layer, Schema, Stream } from "effect"
import { Headers, HttpClientRequest } from "effect/unstable/http"
import {
  CustomToolDefinition,
  CacheHint,
  LLM,
  LLMError,
  LLMEvent,
  Message,
  Model,
  Tool,
  ToolCallPart,
  ToolResultPart,
  ToolRuntime,
  Usage,
} from "../../src"
import { Auth, LLMClient, RequestExecutor, WebSocketExecutor } from "../../src/route"
import * as Azure from "../../src/providers/azure"
import * as GitHubCopilot from "../../src/providers/github-copilot"
import * as OpenAI from "../../src/providers/openai"
import * as XAI from "../../src/providers/xai"
import * as OpenAIResponses from "../../src/protocols/openai-responses"
import * as ProviderShared from "../../src/protocols/shared"
import { continuationRequest, nativeOpenAIResponsesContinuation } from "../continuation-scenarios"
import { it } from "../lib/effect"
import { dynamicResponse, fixedResponse } from "../lib/http"
import { sseEvents } from "../lib/sse"

const model = OpenAIResponses.route
  .with({ endpoint: { baseURL: "https://api.openai.test/v1/" }, auth: Auth.bearer("test") })
  .model({ id: "gpt-4.1-mini" })

const codexModel = Model.update(model, {
  route: model.route.with({
    id: "openai-responses-codex",
    capabilities: [...model.route.capabilities, "sequential-cutoff"],
  }),
})

const request = LLM.request({
  id: "req_1",
  model,
  system: "You are concise.",
  prompt: "Say hello.",
  generation: { maxTokens: 20, temperature: 0 },
})

const configEnv = (env: Record<string, string>) => Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))

type OpenAIToolOutput = Extract<
  OpenAIResponses.OpenAIResponsesBody["input"][number],
  { readonly type: "function_call_output" }
>

const expectToolOutput = (body: OpenAIResponses.OpenAIResponsesBody): OpenAIToolOutput => {
  const output = body.input.find(
    (item): item is OpenAIToolOutput => "type" in item && item.type === "function_call_output",
  )
  expect(output).toBeDefined()
  return output!
}

describe("OpenAI Responses route", () => {
  it.effect("prepares OpenAI Responses target", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare(request)

      expect(prepared.body).toEqual({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: "You are concise." },
          { role: "user", content: [{ type: "input_text", text: "Say hello." }] },
        ],
        stream: true,
        max_output_tokens: 20,
        temperature: 0,
      })
    }),
  )

  it.effect("lowers semantic service tier options", () =>
    Effect.gen(function* () {
      const input = LLM.updateRequest(request, { providerOptions: { openai: { serviceTier: "priority" } } })
      expect(input.providerOptions).toEqual({ openai: { serviceTier: "priority" } })
      const prepared = yield* LLMClient.prepare(input)

      expect(prepared.body).toMatchObject({ service_tier: "priority" })
      expect(prepared.body).not.toHaveProperty("serviceTier")
    }),
  )

  it.effect("omits unsupported semantic service tiers", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare(
        LLM.updateRequest(request, { providerOptions: { openai: { serviceTier: "unsupported" } } }),
      )

      expect(prepared.body).not.toHaveProperty("service_tier")
    }),
  )

  it.effect("flattens top-level object unions in function schemas", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.updateRequest(request, {
          tools: [
            {
              name: "read",
              description: "Read a path or resource.",
              inputSchema: {
                type: "object",
                anyOf: [
                  {
                    type: "object",
                    properties: {
                      path: { type: "string" },
                      reference: { anyOf: [{ type: "string" }, { type: "null" }] },
                      limit: { type: "integer", maximum: 2000 },
                    },
                    required: ["path"],
                  },
                  {
                    type: "object",
                    properties: { resource: { type: "string" }, limit: { type: "integer", maximum: 51200 } },
                    required: ["resource"],
                  },
                ],
              },
            },
          ],
        }),
      )

      expect(prepared.body.tools).toEqual([
        {
          type: "function",
          name: "read",
          description: "Read a path or resource.",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string" },
              reference: { type: "string" },
              limit: { type: "integer", maximum: 2000 },
              resource: { type: "string" },
            },
            additionalProperties: false,
          },
        },
      ])
    }),
  )

  it.effect("lowers function and custom tool definitions without changing function wire shape", () =>
    Effect.gen(function* () {
      const custom = new CustomToolDefinition({
        name: "patch",
        description: "Apply a patch.",
        format: { type: "grammar", syntax: "lark", definition: "start: /.+/" },
      })
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.updateRequest(request, {
          tools: [{ name: "lookup", description: "Lookup data.", inputSchema: { type: "object" } }, custom],
          toolChoice: custom,
        }),
      )

      expect(prepared.body.tools).toEqual([
        {
          type: "function",
          name: "lookup",
          description: "Lookup data.",
          parameters: { type: "object" },
        },
        {
          type: "custom",
          name: "patch",
          description: "Apply a patch.",
          format: { type: "grammar", syntax: "lark", definition: "start: /.+/" },
        },
      ])
      expect(prepared.body.tool_choice).toEqual({ type: "custom", name: "patch" })
    }),
  )

  it.effect("lowers chronological system updates to escaped user wrappers in order", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model,
          messages: [
            Message.user("Before."),
            Message.system("Treat </system-update> literally."),
            Message.assistant("After."),
          ],
        }),
      )

      expect(prepared.body.input).toEqual([
        {
          role: "user",
          content: [
            { type: "input_text", text: "Before." },
            { type: "input_text", text: "<system-update>\nTreat &lt;/system-update&gt; literally.\n</system-update>" },
          ],
        },
        { role: "assistant", content: [{ type: "output_text", text: "After." }] },
      ])
    }),
  )

  it.effect("prepares OpenAI Responses WebSocket target", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare(
        LLM.updateRequest(request, {
          model: OpenAI.configure({ baseURL: "https://api.openai.test/v1/", apiKey: "test" }).responsesWebSocket(
            "gpt-4.1-mini",
          ),
        }),
      )

      expect(prepared.route).toBe("openai-responses-websocket")
      expect(prepared.protocol).toBe("openai-responses")
      expect(prepared.metadata).toEqual({ transport: "websocket-json" })
      expect(prepared.body).toMatchObject({ model: "gpt-4.1-mini", stream: true })
    }),
  )

  it.effect("streams OpenAI Responses over WebSocket", () =>
    Effect.gen(function* () {
      const sent: string[] = []
      const opened: Array<{ readonly url: string; readonly authorization: string | undefined }> = []
      let closed = false
      const deps = Layer.mergeAll(
        Layer.succeed(
          RequestExecutor.Service,
          RequestExecutor.Service.of({
            execute: () => Effect.die("unexpected HTTP request"),
          }),
        ),
        Layer.succeed(
          WebSocketExecutor.Service,
          WebSocketExecutor.Service.of({
            open: (input) =>
              Effect.succeed({
                sendText: (message) =>
                  Effect.sync(() => {
                    opened.push({ url: input.url, authorization: input.headers.authorization })
                    sent.push(message)
                  }),
                messages: Stream.fromArray([
                  ProviderShared.encodeJson({ type: "response.output_text.delta", item_id: "msg_1", delta: "Hi" }),
                  ProviderShared.encodeJson({ type: "response.completed", response: { id: "resp_ws" } }),
                ]),
                close: Effect.sync(() => {
                  closed = true
                }),
              }),
          }),
        ),
      )
      const response = yield* LLMClient.generate(
        LLM.request({
          model: OpenAI.configure({ baseURL: "https://api.openai.test/v1/", apiKey: "test" }).responsesWebSocket(
            "gpt-4.1-mini",
          ),
          prompt: "Say hello.",
        }),
      ).pipe(Effect.provide(LLMClient.layer.pipe(Layer.provide(deps))))

      expect(response.text).toBe("Hi")
      expect(opened).toEqual([{ url: "wss://api.openai.test/v1/responses", authorization: "Bearer test" }])
      expect(closed).toBe(true)
      expect(sent).toHaveLength(1)
      expect(JSON.parse(sent[0])).toEqual({
        type: "response.create",
        model: "gpt-4.1-mini",
        input: [{ role: "user", content: [{ type: "input_text", text: "Say hello." }] }],
        store: false,
        include: ["reasoning.encrypted_content"],
      })
    }),
  )

  it.effect("applies sequential cutoff parsing over WebSocket", () =>
    Effect.gen(function* () {
      const sent: string[] = []
      const deps = Layer.mergeAll(
        Layer.succeed(
          RequestExecutor.Service,
          RequestExecutor.Service.of({ execute: () => Effect.die("unexpected HTTP request") }),
        ),
        Layer.succeed(
          WebSocketExecutor.Service,
          WebSocketExecutor.Service.of({
            open: () =>
              Effect.succeed({
                sendText: (message) => Effect.sync(() => sent.push(message)),
                messages: Stream.fromArray([
                  ProviderShared.encodeJson({
                    type: "response.output_item.added",
                    item: { type: "reasoning", id: "rs_ws" },
                  }),
                  ProviderShared.encodeJson({
                    type: "response.reasoning_summary_text.delta",
                    item_id: "rs_ws",
                    summary_index: 0,
                    delta: "partial",
                  }),
                  ProviderShared.encodeJson({
                    type: "response.reasoning_summary_text.done",
                    item_id: "rs_ws",
                    summary_index: 0,
                    text: "Complete",
                  }),
                  ProviderShared.encodeJson({
                    type: "response.output_item.done",
                    item: { type: "reasoning", id: "rs_ws", encrypted_content: "encrypted-ws" },
                  }),
                  ProviderShared.encodeJson({ type: "response.completed", response: {} }),
                ]),
                close: Effect.void,
              }),
          }),
        ),
      )
      const route = OpenAIResponses.webSocketRoute.with({
        id: "openai-responses-codex-websocket",
        endpoint: { baseURL: "https://api.openai.test/v1/" },
        auth: Auth.bearer("test"),
        capabilities: [...OpenAIResponses.webSocketRoute.capabilities, "sequential-cutoff"],
      })
      const response = yield* LLMClient.generate(
        LLM.request({
          model: route.model({ id: "gpt-5.6" }),
          prompt: "Think.",
          providerOptions: { openai: { reasoningSummaryDelivery: "sequential_cutoff" } },
        }),
      ).pipe(Effect.provide(LLMClient.layer.pipe(Layer.provide(deps))))

      expect(response.reasoning).toBe("Complete")
      expect(JSON.parse(sent[0]).stream_options).toEqual({ reasoning_summary_delivery: "sequential_cutoff" })
    }),
  )

  it.effect("fails immediately when WebSocket is already closed", () =>
    Effect.gen(function* () {
      const error = yield* WebSocketExecutor.fromWebSocket(
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- fromWebSocket reads readyState before touching WebSocket methods on this branch.
        { readyState: globalThis.WebSocket.CLOSED } as globalThis.WebSocket,
        { url: "wss://api.openai.test/v1/responses", headers: Headers.empty },
      ).pipe(Effect.flip)

      expect(error.message).toContain("closed before opening")
    }),
  )

  it.effect("adds native query params to the Responses URL", () =>
    Effect.gen(function* () {
      yield* LLMClient.generate(
        LLM.updateRequest(request, {
          model: Model.update(model, { route: model.route.with({ endpoint: { query: { "api-version": "v1" } } }) }),
        }),
      ).pipe(
        Effect.provide(
          dynamicResponse((input) =>
            Effect.gen(function* () {
              const web = yield* HttpClientRequest.toWeb(input.request).pipe(Effect.orDie)
              expect(web.url).toBe("https://api.openai.test/v1/responses?api-version=v1")
              return input.respond(sseEvents({ type: "response.completed", response: {} }), {
                headers: { "content-type": "text/event-stream" },
              })
            }),
          ),
        ),
      )
    }),
  )

  it.effect("uses Azure api-key header for static OpenAI Responses keys", () =>
    Effect.gen(function* () {
      yield* LLMClient.generate(
        LLM.updateRequest(request, {
          model: Azure.configure({
            baseURL: "https://slopcode-test.openai.azure.com/openai/v1/",
            apiKey: "azure-key",
            headers: { authorization: "Bearer stale" },
          }).responses("gpt-4.1-mini"),
        }),
      ).pipe(
        Effect.provide(
          dynamicResponse((input) =>
            Effect.gen(function* () {
              const web = yield* HttpClientRequest.toWeb(input.request).pipe(Effect.orDie)
              expect(web.url).toBe("https://slopcode-test.openai.azure.com/openai/v1/responses?api-version=v1")
              expect(web.headers.get("api-key")).toBe("azure-key")
              expect(web.headers.get("authorization")).toBeNull()
              return input.respond(sseEvents({ type: "response.completed", response: {} }), {
                headers: { "content-type": "text/event-stream" },
              })
            }),
          ),
        ),
      )
    }),
  )

  it.effect("loads OpenAI default auth from Effect Config", () =>
    LLMClient.generate(
      LLM.updateRequest(request, {
        model: OpenAI.configure({ baseURL: "https://api.openai.test/v1/" }).responses("gpt-4.1-mini"),
      }),
    ).pipe(
      configEnv({ OPENAI_API_KEY: "env-key" }),
      Effect.provide(
        dynamicResponse((input) =>
          Effect.gen(function* () {
            const web = yield* HttpClientRequest.toWeb(input.request).pipe(Effect.orDie)
            expect(web.headers.get("authorization")).toBe("Bearer env-key")
            return input.respond(sseEvents({ type: "response.completed", response: {} }), {
              headers: { "content-type": "text/event-stream" },
            })
          }),
        ),
      ),
    ),
  )

  it.effect("lets explicit auth override OpenAI default API key auth", () =>
    LLMClient.generate(
      LLM.updateRequest(request, {
        model: OpenAI.configure({
          baseURL: "https://api.openai.test/v1/",
          auth: Auth.bearer("oauth-token"),
        }).responses("gpt-4.1-mini"),
      }),
    ).pipe(
      Effect.provide(
        dynamicResponse((input) =>
          Effect.gen(function* () {
            const web = yield* HttpClientRequest.toWeb(input.request).pipe(Effect.orDie)
            expect(web.headers.get("authorization")).toBe("Bearer oauth-token")
            return input.respond(sseEvents({ type: "response.completed", response: {} }), {
              headers: { "content-type": "text/event-stream" },
            })
          }),
        ),
      ),
    ),
  )

  it.effect("prepares function call and function output input items", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare(
        LLM.request({
          id: "req_tool_result",
          model,
          messages: [
            Message.user("What is the weather?"),
            Message.assistant([ToolCallPart.make({ id: "call_1", name: "lookup", input: { query: "weather" } })]),
            Message.tool({ id: "call_1", name: "lookup", result: { forecast: "sunny" } }),
          ],
        }),
      )

      expect(prepared.body).toEqual({
        model: "gpt-4.1-mini",
        input: [
          { role: "user", content: [{ type: "input_text", text: "What is the weather?" }] },
          { type: "function_call", call_id: "call_1", name: "lookup", arguments: '{"query":"weather"}' },
          { type: "function_call_output", call_id: "call_1", output: '{"forecast":"sunny"}' },
        ],
        stream: true,
      })
    }),
  )

  it.effect("preserves valid ordinary function call item ids and omits malformed ids", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model,
          messages: [
            Message.assistant([
              ToolCallPart.make({
                id: "call_valid",
                name: "lookup",
                input: { query: "valid" },
                providerMetadata: { openai: { itemId: "future_valid" } },
              }),
              ToolCallPart.make({
                id: "call_invalid",
                name: "lookup",
                input: { query: "invalid" },
                providerMetadata: { openai: { itemId: "malformed" } },
              }),
            ]),
          ],
        }),
      )

      expect(prepared.body.input).toEqual([
        {
          type: "function_call",
          id: "future_valid",
          call_id: "call_valid",
          name: "lookup",
          arguments: '{"query":"valid"}',
        },
        {
          type: "function_call",
          call_id: "call_invalid",
          name: "lookup",
          arguments: '{"query":"invalid"}',
        },
      ])
    }),
  )

  it.effect("replays custom calls and results with retained item ids and raw input", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model,
          messages: [
            Message.assistant([
              ToolCallPart.make({
                id: "call_1",
                name: "patch",
                input: "*** Begin Patch\n*** End Patch",
                toolType: "custom",
                providerMetadata: { openai: { itemId: "ctc_1" } },
              }),
            ]),
            Message.tool(
              ToolResultPart.make({
                id: "call_1",
                name: "patch",
                result: "applied",
                resultType: "text",
                toolType: "custom",
              }),
            ),
          ],
        }),
      )

      expect(prepared.body.input).toEqual([
        {
          type: "custom_tool_call",
          id: "ctc_1",
          call_id: "call_1",
          name: "patch",
          input: "*** Begin Patch\n*** End Patch",
        },
        { type: "custom_tool_call_output", call_id: "call_1", output: "applied" },
      ])
    }),
  )

  it.effect("filters malformed replay item ids and omits stateless reasoning ids", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model,
          messages: [
            Message.assistant([
              {
                type: "reasoning",
                text: "valid future state",
                providerMetadata: {
                  openai: { itemId: "future_123", reasoningEncryptedContent: "encrypted-future" },
                },
              },
              ...["", "missing", "_suffix", "prefix_"].map((itemId) => ({
                type: "reasoning" as const,
                text: `invalid ${itemId}`,
                providerMetadata: { openai: { itemId, reasoningEncryptedContent: "encrypted-invalid" } },
              })),
              {
                type: "reasoning",
                text: "empty encryption",
                providerMetadata: { openai: { itemId: "rs_empty", reasoningEncryptedContent: "" } },
              },
              ToolCallPart.make({
                id: "call_1",
                name: "patch",
                input: "patch",
                toolType: "custom",
                providerMetadata: { openai: { itemId: "invalid" } },
              }),
              ToolCallPart.make({
                id: "call_2",
                name: "patch",
                input: "future patch",
                toolType: "custom",
                providerMetadata: { openai: { itemId: "future_tool" } },
              }),
              ToolResultPart.make({
                id: "hosted_1",
                name: "web_search",
                result: { type: "json", value: {} },
                providerExecuted: true,
                providerMetadata: { openai: { itemId: "invalid" } },
              }),
            ]),
          ],
          providerOptions: { openai: { store: false } },
        }),
      )

      expect(prepared.body.input).toEqual([
        {
          type: "reasoning",
          encrypted_content: "encrypted-future",
          summary: [{ type: "summary_text", text: "valid future state" }],
        },
        { type: "custom_tool_call", id: undefined, call_id: "call_1", name: "patch", input: "patch" },
        {
          type: "custom_tool_call",
          id: "future_tool",
          call_id: "call_2",
          name: "patch",
          input: "future patch",
        },
      ])
    }),
  )

  it.effect("rejects non-string custom call history instead of coercing it", () =>
    Effect.sync(() => {
      expect(() =>
        ToolCallPart.make({
          id: "call_1",
          name: "patch",
          input: { patch: "invalid" },
          toolType: "custom",
        } as unknown as Parameters<typeof ToolCallPart.make>[0]),
      ).toThrow("Custom tool call input must be a string")
    }),
  )

  // Regression: screenshot/read tool results must stay structured so base64
  // image data is not JSON-stringified into `function_call_output.output`.
  it.effect("lowers image tool-result content as structured input_image items", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          id: "req_tool_result_image",
          model,
          messages: [
            Message.user("Show me the screenshot."),
            Message.assistant([ToolCallPart.make({ id: "call_1", name: "read", input: { filePath: "shot.png" } })]),
            Message.tool({
              id: "call_1",
              name: "read",
              resultType: "content",
              result: [
                { type: "text", text: "Image read successfully" },
                { type: "file", uri: "data:image/png;base64,AAECAw==", mime: "image/png" },
              ],
            }),
          ],
        }),
      )

      expect(expectToolOutput(prepared.body).output).toEqual([
        { type: "input_text", text: "Image read successfully" },
        { type: "input_image", image_url: "data:image/png;base64,AAECAw==" },
      ])
    }),
  )

  it.effect("lowers single-image tool-result content as structured input_image array", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          id: "req_tool_result_image_only",
          model,
          messages: [
            Message.assistant([ToolCallPart.make({ id: "call_1", name: "screenshot", input: {} })]),
            Message.tool({
              id: "call_1",
              name: "screenshot",
              resultType: "content",
              result: [{ type: "file", uri: "data:image/png;base64,AAECAw==", mime: "image/png" }],
            }),
          ],
        }),
      )

      expect(expectToolOutput(prepared.body).output).toEqual([
        { type: "input_image", image_url: "data:image/png;base64,AAECAw==" },
      ])
    }),
  )

  it.effect("rejects non-image media in tool-result content with a clear error", () =>
    Effect.gen(function* () {
      const error = yield* LLMClient.prepare(
        LLM.request({
          id: "req_tool_result_unsupported_media",
          model,
          messages: [
            Message.assistant([ToolCallPart.make({ id: "call_1", name: "fetch", input: {} })]),
            Message.tool({
              id: "call_1",
              name: "fetch",
              resultType: "content",
              result: [{ type: "file", uri: "data:audio/mpeg;base64,AAECAw==", mime: "audio/mpeg" }],
            }),
          ],
        }),
      ).pipe(Effect.flip)

      expect(error.message).toContain("OpenAI Responses")
      expect(error.message).toContain("audio/mpeg")
    }),
  )

  it.effect("prepares the composed native continuation request", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        continuationRequest({
          id: "req_native_continuation_openai",
          model,
          features: nativeOpenAIResponsesContinuation,
        }),
      )

      expect(prepared.body).toMatchObject({
        input: [
          { role: "system", content: "You are concise. Continue from the provided history." },
          {
            role: "user",
            content: [
              { type: "input_text", text: "What is shown here?" },
              { type: "input_image", image_url: "data:image/png;base64,AAECAw==" },
            ],
          },
          {
            type: "reasoning",
            encrypted_content: "encrypted-continuation-state",
            summary: [{ type: "summary_text", text: "I inspected the previous turn." }],
          },
          { role: "assistant", content: [{ type: "output_text", text: "It shows a small test image." }] },
          { role: "user", content: [{ type: "input_text", text: "Check the weather in Paris before continuing." }] },
          { type: "function_call", call_id: "call_weather_1", name: "get_weather", arguments: '{"city":"Paris"}' },
          { type: "function_call_output", call_id: "call_weather_1", output: '{"temperature":22}' },
          { role: "assistant", content: [{ type: "output_text", text: "Paris is 22 degrees." }] },
          {
            role: "user",
            content: [{ type: "input_text", text: "Continue from this conversation in one short sentence." }],
          },
        ],
        include: ["reasoning.encrypted_content"],
        store: false,
      })
      expect(prepared.body.tools).toEqual([expect.objectContaining({ type: "function", name: "get_weather" })])
    }),
  )

  it.effect("maps OpenAI provider options to Responses options", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model: OpenAI.configure({ baseURL: "https://api.openai.test/v1/", apiKey: "test" }).model("gpt-5.2"),
          prompt: "think",
          providerOptions: {
            openai: {
              promptCacheKey: "session_123",
              reasoningEffort: "high",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            },
          },
        }),
      )

      expect(prepared.body.store).toBe(false)
      expect(prepared.body.prompt_cache_key).toBe("session_123")
      expect(prepared.body.include).toEqual(["reasoning.encrypted_content"])
      expect(prepared.body.reasoning).toEqual({ effort: "high", summary: "auto" })
      expect(prepared.body.text).toEqual({ verbosity: "low" })
    }),
  )

  it.effect("emits GPT-5.6 safety identity and only explicit 30m cache breakpoints", () =>
    Effect.gen(function* () {
      const eligible = Model.update(model, {
        id: "gpt-5.6",
        provider: "openai",
        route: model.route.with({ endpoint: { baseURL: "https://api.openai.com/v1" } }),
      })
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model: eligible,
          system: [{ type: "text", text: "stable", cache: new CacheHint({ type: "ephemeral", ttlSeconds: 1800 }) }],
          messages: [
            Message.user([
              { type: "text", text: "first" },
              { type: "text", text: "second", cache: new CacheHint({ type: "ephemeral", ttlSeconds: 1800 }) },
            ]),
          ],
          providerOptions: {
            openai: { safetyIdentifier: "sc_safe", promptCacheOptions: { mode: "explicit", ttl: "30m" } },
          },
        }),
      )

      expect(prepared.body.safety_identifier).toBe("sc_safe")
      expect(prepared.body.prompt_cache_options).toEqual({ mode: "explicit", ttl: "30m" })
      expect(JSON.stringify(prepared.body.input).match(/prompt_cache_breakpoint/g)?.length).toBe(2)
    }),
  )

  it.effect("preserves explicit caching on canonical managed endpoints", () =>
    Effect.gen(function* () {
      for (const item of [
        { provider: "slopcode", baseURL: "https://slopcode.dev/zen/v1" },
        { provider: "slopcode-go", baseURL: "https://slopcode.dev/zen/go/v1" },
      ]) {
        const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
          LLM.request({
            model: Model.update(model, {
              id: "gpt-5.6",
              provider: item.provider,
              route: model.route.with({ endpoint: { baseURL: item.baseURL } }),
            }),
            prompt: [{ type: "text", text: "managed", cache: new CacheHint({ type: "ephemeral", ttlSeconds: 1800 }) }],
            providerOptions: {
              openai: { safetyIdentifier: "sc_safe", promptCacheOptions: { mode: "explicit", ttl: "30m" } },
            },
          }),
        )
        expect(prepared.body.safety_identifier).toBe("sc_safe")
        expect(prepared.body.prompt_cache_options).toEqual({ mode: "explicit", ttl: "30m" })
        expect(JSON.stringify(prepared.body.input)).toContain("prompt_cache_breakpoint")
      }
    }),
  )

  it.effect("omits safety and cache options for defaults, bad TTLs, and excluded routes", () =>
    Effect.gen(function* () {
      const options = {
        openai: { safetyIdentifier: "hostile", promptCacheOptions: { mode: "explicit" as const, ttl: "30m" as const } },
      }
      const cases = [
        Model.update(model, { id: "gpt-5.5", provider: "openai" }),
        Model.update(codexModel, { id: "gpt-5.6", provider: "openai" }),
        Model.update(model, { id: "gpt-5.6", provider: "azure" }),
        Model.update(model, { id: "gpt-5.6", provider: "github-copilot" }),
        Model.update(model, { id: "gpt-5.6", provider: "openrouter" }),
        Model.update(model, { id: "gpt-5.6", provider: "compatible" }),
        Model.update(model, { id: "gpt-5.6", provider: "openai" }),
        Model.update(model, {
          id: "gpt-5.6",
          provider: "slopcode",
          route: model.route.with({ endpoint: { baseURL: "https://proxy.example/zen/v1" } }),
        }),
      ]
      for (const excluded of cases) {
        const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
          LLM.request({
            model: excluded,
            prompt: [{ type: "text", text: "no leak", cache: new CacheHint({ type: "ephemeral", ttlSeconds: 1800 }) }],
            providerOptions: options,
          }),
        )
        expect(prepared.body.safety_identifier).toBeUndefined()
        expect(prepared.body.prompt_cache_options).toBeUndefined()
        expect(JSON.stringify(prepared.body.input)).not.toContain("prompt_cache_breakpoint")
      }

      const implicit = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({ model: Model.update(model, { id: "gpt-5.6", provider: "openai" }), prompt: "plain" }),
      )
      expect(implicit.body.prompt_cache_options).toBeUndefined()
      expect(JSON.stringify(implicit.body.input)).not.toContain("prompt_cache_breakpoint")

      const bad = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model: Model.update(model, { id: "gpt-5.6", provider: "openai" }),
          prompt: [{ type: "text", text: "old", cache: new CacheHint({ type: "ephemeral", ttlSeconds: 3600 }) }],
          providerOptions: options,
        }),
      )
      expect(bad.body.prompt_cache_options).toBeUndefined()
      expect(JSON.stringify(bad.body.input)).not.toContain("prompt_cache_breakpoint")
    }),
  )

  it.effect("maps max reasoning effort for GPT-5.6", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model: Model.update(model, { id: "gpt-5.6" }),
          prompt: "think",
          providerOptions: { openai: { reasoningEffort: "max" } },
        }),
      )

      expect(prepared.body.reasoning).toEqual({ effort: "max" })
    }),
  )

  it.effect("lowers parallel calls, public truncation values, and ultra reasoning", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.updateRequest(request, {
          providerOptions: {
            openai: { parallelToolCalls: false, truncation: "auto", reasoningEffort: "ultra" },
          },
        }),
      )

      expect(prepared.body).toMatchObject({
        parallel_tool_calls: false,
        truncation: "auto",
        reasoning: { effort: "max" },
      })
    }),
  )

  it.effect("uses none to replace an inherited reasoning summary without changing continuation defaults", () =>
    Effect.gen(function* () {
      const configured = Model.update(model, {
        route: model.route.with({
          providerOptions: {
            openai: {
              store: false,
              include: ["reasoning.encrypted_content"],
              reasoningSummary: "auto",
            },
          },
        }),
      })
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model: configured,
          prompt: "think",
          providerOptions: { openai: { reasoningEffort: "low", reasoningSummary: "none" } },
        }),
      )

      expect(prepared.body.reasoning).toEqual({ effort: "low" })
      expect(prepared.body.store).toBe(false)
      expect(prepared.body.include).toEqual(["reasoning.encrypted_content"])
    }),
  )

  it.effect("omits unknown truncation values instead of passing raw provider input", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.updateRequest(request, { providerOptions: { openai: { truncation: { mode: "tokens", limit: 10_000 } } } }),
      )

      expect(prepared.body).not.toHaveProperty("truncation")
    }),
  )

  it.effect("prepares identical Responses fields for HTTP and WebSocket", () =>
    Effect.gen(function* () {
      const custom = new CustomToolDefinition({ name: "shell", description: "Run shell text." })
      const input = LLM.request({
        model,
        prompt: "Run it.",
        tools: [custom],
        providerOptions: { openai: { parallelToolCalls: true, truncation: "disabled", reasoningEffort: "ultra" } },
      })
      const http = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(input)
      const websocket = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.updateRequest(input, {
          model: Model.update(model, {
            route: OpenAIResponses.webSocketRoute.with({
              endpoint: { baseURL: "https://api.openai.test/v1/" },
              auth: Auth.bearer("test"),
            }),
          }),
        }),
      )

      expect(websocket.body).toEqual(http.body)
      expect(websocket.body).toMatchObject({
        tools: [{ type: "custom", name: "shell", description: "Run shell text." }],
        parallel_tool_calls: true,
        truncation: "disabled",
        reasoning: { effort: "max" },
      })
    }),
  )

  it.effect("lowers exact Responses Lite HTTP body and header", () =>
    Effect.gen(function* () {
      const input = LLM.request({
        model,
        system: "Conversation policy.",
        prompt: "Apply the change.",
        tools: [
          { name: "lookup", description: "Lookup data.", inputSchema: { type: "object" } },
          new CustomToolDefinition({ name: "patch", description: "Apply a patch." }),
        ],
        providerOptions: {
          openai: {
            instructions: "Base instructions.",
            responsesMode: "lite",
            parallelToolCalls: true,
            reasoningEffort: "high",
          },
        },
      })

      yield* LLMClient.generate(input).pipe(
        Effect.provide(
          dynamicResponse((request) =>
            Effect.gen(function* () {
              const web = yield* HttpClientRequest.toWeb(request.request).pipe(Effect.orDie)
              expect(web.headers.get("x-openai-internal-codex-responses-lite")).toBe("true")
              expect(yield* Effect.promise(() => web.json())).toEqual({
                model: "gpt-4.1-mini",
                input: [
                  {
                    type: "additional_tools",
                    role: "developer",
                    tools: [
                      {
                        type: "function",
                        name: "lookup",
                        description: "Lookup data.",
                        parameters: { type: "object" },
                      },
                      { type: "custom", name: "patch", description: "Apply a patch." },
                    ],
                  },
                  {
                    type: "message",
                    role: "developer",
                    content: [
                      { type: "input_text", text: "Base instructions." },
                      { type: "input_text", text: "Conversation policy." },
                    ],
                  },
                  { role: "user", content: [{ type: "input_text", text: "Apply the change." }] },
                ],
                instructions: "",
                parallel_tool_calls: false,
                reasoning: { effort: "high", context: "all_turns" },
                stream: true,
              })
              return request.respond(sseEvents({ type: "response.completed", response: {} }), {
                headers: { "content-type": "text/event-stream" },
              })
            }),
          ),
        ),
      )
    }),
  )

  it.effect("keeps empty Lite instructions deterministic", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model,
          prompt: "Hello.",
          providerOptions: { openai: { responsesMode: "lite", instructions: "" } },
        }),
      )

      expect(prepared.body).toEqual({
        model: "gpt-4.1-mini",
        input: [
          { type: "additional_tools", role: "developer", tools: [] },
          { role: "user", content: [{ type: "input_text", text: "Hello." }] },
        ],
        instructions: "",
        parallel_tool_calls: false,
        reasoning: { context: "all_turns" },
        stream: true,
      })
    }),
  )

  it.effect("declares internal Responses capabilities only on explicit OpenAI deployments", () =>
    Effect.sync(() => {
      expect(OpenAIResponses.protocol.capabilities).toBeUndefined()
      expect(OpenAIResponses.route.capabilities).toEqual(["code-mode", "responses-lite", "custom-tools"])
      expect(OpenAIResponses.webSocketRoute.capabilities).toEqual(["code-mode", "responses-lite", "custom-tools"])
      expect(OpenAI.routes[0]?.capabilities).toEqual(["code-mode", "responses-lite", "custom-tools"])
      expect(Azure.routes[0]?.capabilities).toEqual([])
      expect(XAI.routes[0]?.capabilities).toEqual([])
      expect(GitHubCopilot.routes[0]?.capabilities).toEqual([])
    }),
  )

  it.effect("rejects Lite and custom requests on shared non-OpenAI Responses deployments", () =>
    Effect.gen(function* () {
      const routes = [
        Azure.configure({ baseURL: "https://azure.test/openai/v1", apiKey: "test" }).responses("gpt-5"),
        XAI.configure({ baseURL: "https://xai.test/v1", apiKey: "test" }).responses("grok"),
        GitHubCopilot.configure({ baseURL: "https://copilot.test", apiKey: "test" }).responses("gpt-5"),
      ]
      for (const deployed of routes) {
        const lite = yield* LLMClient.prepare(
          LLM.request({ model: deployed, prompt: "test", providerOptions: { openai: { responsesMode: "lite" } } }),
        ).pipe(Effect.flip)
        const custom = yield* LLMClient.prepare(
          LLM.request({
            model: deployed,
            prompt: "test",
            tools: [{ type: "custom", name: "shell", description: "Run shell text." }],
          }),
        ).pipe(Effect.flip)
        expect(lite).toMatchObject({ _tag: "LLM.Error", message: expect.stringContaining("Responses Lite") })
        expect(custom).toMatchObject({ _tag: "LLM.Error", message: expect.stringContaining("custom tools") })
      }
    }),
  )

  it.effect("sends the Lite marker in WebSocket metadata and handshake headers", () =>
    Effect.gen(function* () {
      const sent: string[] = []
      const headers: Array<string | undefined> = []
      const deps = Layer.mergeAll(
        Layer.succeed(
          RequestExecutor.Service,
          RequestExecutor.Service.of({ execute: () => Effect.die("unexpected HTTP request") }),
        ),
        Layer.succeed(
          WebSocketExecutor.Service,
          WebSocketExecutor.Service.of({
            open: (input) =>
              Effect.succeed({
                sendText: (message) =>
                  Effect.sync(() => {
                    headers.push(input.headers["x-openai-internal-codex-responses-lite"])
                    sent.push(message)
                  }),
                messages: Stream.fromArray([
                  ProviderShared.encodeJson({ type: "response.completed", response: { id: "resp_ws" } }),
                ]),
                close: Effect.void,
              }),
          }),
        ),
      )
      const route = OpenAIResponses.webSocketRoute.with({
        endpoint: { baseURL: "https://api.openai.test/v1/" },
        auth: Auth.bearer("test"),
      })

      yield* LLMClient.generate(
        LLM.request({
          model: route.model({ id: "gpt-4.1-mini" }),
          prompt: "Hello.",
          providerOptions: { openai: { responsesMode: "lite", instructions: "Base instructions." } },
        }),
      ).pipe(Effect.provide(LLMClient.layer.pipe(Layer.provide(deps))))

      expect(headers).toEqual(["true"])
      expect(sent.map((message) => JSON.parse(message))).toEqual([
        {
          type: "response.create",
          model: "gpt-4.1-mini",
          input: [
            { type: "additional_tools", role: "developer", tools: [] },
            {
              type: "message",
              role: "developer",
              content: [{ type: "input_text", text: "Base instructions." }],
            },
            { role: "user", content: [{ type: "input_text", text: "Hello." }] },
          ],
          instructions: "",
          parallel_tool_calls: false,
          reasoning: { context: "all_turns" },
          client_metadata: { ws_request_header_x_openai_internal_codex_responses_lite: "true" },
        },
      ])
    }),
  )

  it.effect("preserves exact full Responses body and omits Lite markers", () =>
    Effect.gen(function* () {
      const input = LLM.request({
        model,
        prompt: "Look it up.",
        tools: [{ name: "lookup", description: "Lookup data.", inputSchema: { type: "object" } }],
        providerOptions: {
          openai: {
            responsesMode: "full",
            instructions: "Base instructions.",
            parallelToolCalls: true,
            reasoningEffort: "high",
          },
        },
      })

      yield* LLMClient.generate(input).pipe(
        Effect.provide(
          dynamicResponse((request) =>
            Effect.gen(function* () {
              const web = yield* HttpClientRequest.toWeb(request.request).pipe(Effect.orDie)
              expect(web.headers.get("x-openai-internal-codex-responses-lite")).toBeNull()
              expect(yield* Effect.promise(() => web.json())).toEqual({
                model: "gpt-4.1-mini",
                input: [{ role: "user", content: [{ type: "input_text", text: "Look it up." }] }],
                instructions: "Base instructions.",
                tools: [
                  {
                    type: "function",
                    name: "lookup",
                    description: "Lookup data.",
                    parameters: { type: "object" },
                  },
                ],
                parallel_tool_calls: true,
                reasoning: { effort: "high" },
                stream: true,
              })
              return request.respond(sseEvents({ type: "response.completed", response: {} }), {
                headers: { "content-type": "text/event-stream" },
              })
            }),
          ),
        ),
      )
    }),
  )

  it.effect("allows full Responses reasoning context independently", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.updateRequest(request, { providerOptions: { openai: { reasoningContext: "current_turn" } } }),
      )

      expect(prepared.body.reasoning).toEqual({ context: "current_turn" })
    }),
  )

  it.effect("continues dispatched custom results as custom tool outputs", () =>
    Effect.gen(function* () {
      const call = ToolCallPart.make({
        id: "call_1",
        name: "patch",
        input: "*** Begin Patch\n*** End Patch",
        toolType: "custom",
      })
      const patch = Tool.make({
        description: "Apply a patch.",
        parameters: Schema.String,
        success: Schema.String,
        execute: () => Effect.succeed("applied"),
      })
      const dispatched = yield* ToolRuntime.dispatch({ patch }, call)
      const result = dispatched.events.find((event) => event.type === "tool-result")
      if (!result || result.type !== "tool-result") throw new Error("Expected custom tool result")
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model,
          messages: [Message.assistant(call), Message.tool(result)],
        }),
      )

      expect(prepared.body.input).toEqual([
        {
          type: "custom_tool_call",
          call_id: "call_1",
          name: "patch",
          input: "*** Begin Patch\n*** End Patch",
        },
        { type: "custom_tool_call_output", call_id: "call_1", output: "applied" },
      ])
    }),
  )

  it.effect("accepts the full ResponseIncludable union", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model,
          prompt: "hi",
          providerOptions: {
            openai: {
              include: ["reasoning.encrypted_content", "code_interpreter_call.outputs", "web_search_call.results"],
            },
          },
        }),
      )

      expect(prepared.body.include).toEqual([
        "reasoning.encrypted_content",
        "code_interpreter_call.outputs",
        "web_search_call.results",
      ])
    }),
  )

  it.effect("filters unknown includable values out of the include array", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model,
          prompt: "hi",
          // The user passed one invalid entry alongside a valid one. Keep the
          // valid one so the request still succeeds rather than failing on a
          // typo from upstream config.
          providerOptions: { openai: { include: ["reasoning.encrypted_content", "bogus.thing"] } },
        }),
      )

      expect(prepared.body.include).toEqual(["reasoning.encrypted_content"])
    }),
  )

  it.effect("adds encrypted reasoning to an explicit empty include for stateless requests", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({ model, prompt: "hi", providerOptions: { openai: { store: false, include: [] } } }),
      )

      expect(prepared.body.include).toEqual(["reasoning.encrypted_content"])
    }),
  )

  it.effect("adds encrypted reasoning when all caller include values are invalid", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({ model, prompt: "hi", providerOptions: { openai: { store: false, include: ["bogus.thing"] } } }),
      )

      expect(prepared.body.include).toEqual(["reasoning.encrypted_content"])
    }),
  )

  it.effect("requests encrypted reasoning when stateless include is omitted", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({ model, prompt: "hi", providerOptions: { openai: { store: false } } }),
      )

      expect(prepared.body.include).toEqual(["reasoning.encrypted_content"])
    }),
  )

  it.effect("requests encrypted reasoning by default for GPT-5 reasoning models", () =>
    Effect.gen(function* () {
      // The native OpenAI facade configures GPT-5 stateless (store: false) with
      // reasoningSummary: "auto" by default. Without `include`, a follow-up
      // turn cannot replay reasoning state, so the facade also opts into
      // `reasoning.encrypted_content` automatically.
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model: OpenAI.configure({ baseURL: "https://api.openai.test/v1/", apiKey: "test" }).responses("gpt-5.2"),
          prompt: "hi",
        }),
      )

      expect(prepared.body.store).toBe(false)
      expect(prepared.body.include).toEqual(["reasoning.encrypted_content"])
      expect(prepared.body.reasoning).toEqual({ effort: "medium", summary: "auto" })
    }),
  )

  it.effect("does not let stateless callers opt out of encrypted reasoning", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model: OpenAI.configure({ baseURL: "https://api.openai.test/v1/", apiKey: "test" }).responses("gpt-5.2"),
          prompt: "hi",
          providerOptions: { openai: { include: [] } },
        }),
      )

      expect(prepared.body.include).toEqual(["reasoning.encrypted_content"])
    }),
  )

  it.effect("merges and deduplicates stateless include fields", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model,
          prompt: "hi",
          providerOptions: {
            openai: {
              store: false,
              include: ["web_search_call.results", "reasoning.encrypted_content", "reasoning.encrypted_content"],
            },
          },
        }),
      )

      expect(prepared.body.include).toEqual(["web_search_call.results", "reasoning.encrypted_content"])
    }),
  )

  it.effect("does not force encrypted reasoning for stored requests", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({ model, prompt: "hi", providerOptions: { openai: { store: true } } }),
      )

      expect(prepared.body.include).toBeUndefined()
    }),
  )

  it.effect("preserves stored include order and duplicates exactly", () =>
    Effect.gen(function* () {
      const include = ["web_search_call.results", "reasoning.encrypted_content", "web_search_call.results"] as const
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({ model, prompt: "hi", providerOptions: { openai: { store: true, include } } }),
      )

      expect(prepared.body.include).toEqual(include)
    }),
  )

  it.effect("emits sequential cutoff only on capable Codex routes", () =>
    Effect.gen(function* () {
      const options = { openai: { reasoningSummaryDelivery: "sequential_cutoff" as const } }
      const publicRequest = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({ model, prompt: "hi", providerOptions: options }),
      )
      const codexRequest = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({ model: codexModel, prompt: "hi", providerOptions: options }),
      )
      const azureRequest = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model: Azure.configure({ baseURL: "https://azure.test/openai/v1", apiKey: "test" }).responses("gpt-5"),
          prompt: "hi",
          providerOptions: options,
        }),
      )

      expect(publicRequest.body).not.toHaveProperty("stream_options")
      expect(azureRequest.body).not.toHaveProperty("stream_options")
      expect(codexRequest.body.stream_options).toEqual({ reasoning_summary_delivery: "sequential_cutoff" })
    }),
  )

  it.effect("request OpenAI provider options override route defaults", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model: OpenAI.configure({
            baseURL: "https://api.openai.test/v1/",
            apiKey: "test",
            providerOptions: { openai: { promptCacheKey: "model_cache" } },
          }).model("gpt-4.1-mini"),
          prompt: "no cache",
          providerOptions: { openai: { promptCacheKey: "request_cache" } },
        }),
      )

      expect(prepared.body.prompt_cache_key).toBe("request_cache")
    }),
  )

  it.effect("parses text and usage stream fixtures", () =>
    Effect.gen(function* () {
      const body = sseEvents(
        { type: "response.output_text.delta", item_id: "msg_1", delta: "Hello" },
        { type: "response.output_text.delta", item_id: "msg_1", delta: "!" },
        {
          type: "response.completed",
          response: {
            id: "resp_1",
            service_tier: "default",
            usage: {
              input_tokens: 10,
              output_tokens: 2,
              total_tokens: 12,
              input_tokens_details: { cached_tokens: 3, cache_write_tokens: 4 },
              output_tokens_details: { reasoning_tokens: 0 },
            },
          },
        },
      )
      const response = yield* LLMClient.generate(request).pipe(Effect.provide(fixedResponse(body)))
      const usage = new Usage({
        inputTokens: 10,
        outputTokens: 2,
        nonCachedInputTokens: 3,
        cacheReadInputTokens: 3,
        cacheWriteInputTokens: 4,
        reasoningTokens: 0,
        totalTokens: 12,
        providerMetadata: {
          openai: {
            input_tokens: 10,
            output_tokens: 2,
            total_tokens: 12,
            input_tokens_details: { cached_tokens: 3, cache_write_tokens: 4 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
        },
      })

      expect(response.text).toBe("Hello!")
      expect(response.events).toEqual([
        { type: "step-start", index: 0 },
        { type: "text-start", id: "msg_1" },
        { type: "text-delta", id: "msg_1", text: "Hello" },
        { type: "text-delta", id: "msg_1", text: "!" },
        { type: "text-end", id: "msg_1" },
        {
          type: "step-finish",
          index: 0,
          reason: "stop",
          providerMetadata: { openai: { responseId: "resp_1", serviceTier: "default" } },
          usage,
        },
        {
          type: "finish",
          reason: "stop",
          providerMetadata: { openai: { responseId: "resp_1", serviceTier: "default" } },
          usage,
        },
      ])
    }),
  )

  it.effect("clamps malformed Responses cache usage into one input partition", () =>
    Effect.gen(function* () {
      const body = sseEvents({
        type: "response.completed",
        response: {
          usage: {
            input_tokens: 10,
            output_tokens: 1,
            input_tokens_details: { cached_tokens: 12, cache_write_tokens: 9 },
          },
        },
      })
      const response = yield* LLMClient.generate(request).pipe(Effect.provide(fixedResponse(body)))
      expect(response.usage).toMatchObject({
        inputTokens: 10,
        nonCachedInputTokens: 0,
        cacheReadInputTokens: 10,
        cacheWriteInputTokens: 0,
      })
      expect(ProviderShared.normalizeInputTokens(-4, Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
        inputTokens: 0,
        nonCachedInputTokens: 0,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
      })
    }),
  )

  it.effect("parses reasoning summary stream fixtures", () =>
    Effect.gen(function* () {
      const body = sseEvents(
        { type: "response.reasoning_summary_text.delta", item_id: "rs_1", delta: "thinking" },
        { type: "response.output_text.delta", item_id: "msg_1", delta: "Hello" },
        { type: "response.reasoning_summary_text.done", item_id: "rs_1" },
        { type: "response.completed", response: { id: "resp_1" } },
      )

      const response = yield* LLMClient.generate(request).pipe(Effect.provide(fixedResponse(body)))

      expect(response.reasoning).toBe("thinking")
      expect(response.text).toBe("Hello")
      expect(response.events).toMatchObject([
        { type: "step-start", index: 0 },
        { type: "reasoning-start", id: "rs_1" },
        { type: "reasoning-delta", id: "rs_1", text: "thinking" },
        { type: "text-start", id: "msg_1" },
        { type: "text-delta", id: "msg_1", text: "Hello" },
        { type: "reasoning-end", id: "rs_1" },
        { type: "text-end", id: "msg_1" },
        { type: "step-finish", index: 0, reason: "stop" },
        { type: "finish", reason: "stop" },
      ])
    }),
  )

  it.effect("preserves encrypted reasoning metadata for continuation", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(request).pipe(
        Effect.provide(
          fixedResponse(
            sseEvents(
              { type: "response.reasoning_summary_text.delta", item_id: "rs_1", delta: "thinking" },
              {
                type: "response.output_item.done",
                item: {
                  type: "reasoning",
                  id: "rs_1",
                  encrypted_content: "encrypted-state",
                  summary: [{ type: "summary_text", text: "thinking" }],
                },
              },
              { type: "response.completed", response: { id: "resp_1" } },
            ),
          ),
        ),
      )

      expect(response.events).toContainEqual(
        expect.objectContaining({
          type: "reasoning-end",
          id: "rs_1",
          providerMetadata: { openai: { itemId: "rs_1", reasoningEncryptedContent: "encrypted-state" } },
        }),
      )
    }),
  )

  it.effect("parses only completed sequential cutoff summaries in order", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(
        LLM.request({
          model: codexModel,
          prompt: "think",
          providerOptions: { openai: { reasoningSummaryDelivery: "sequential_cutoff" } },
        }),
      ).pipe(
        Effect.provide(
          fixedResponse(
            sseEvents(
              { type: "response.output_item.added", item: { type: "reasoning", id: "rs_1" } },
              { type: "response.output_item.added", item: { type: "reasoning", id: "rs_1" } },
              { type: "response.reasoning_summary_text.delta", item_id: "rs_1", summary_index: 0, delta: "partial" },
              { type: "response.reasoning_summary_text.done", item_id: "rs_1", summary_index: 0, text: "First" },
              { type: "response.reasoning_summary_text.done", item_id: "rs_1", summary_index: 0, text: "duplicate" },
              { type: "response.reasoning_summary_text.done", item_id: "rs_1", summary_index: 1, text: "Second" },
              {
                type: "response.output_item.done",
                item: { type: "reasoning", id: "rs_1", encrypted_content: "encrypted-state" },
              },
              {
                type: "response.output_item.done",
                item: { type: "reasoning", id: "rs_1", encrypted_content: "duplicate-state" },
              },
              { type: "response.output_text.delta", item_id: "msg_1", delta: "Visible" },
              { type: "response.reasoning_summary_text.done", item_id: "rs_1", summary_index: 2, text: "stale" },
              { type: "response.completed", response: { id: "resp_1" } },
            ),
          ),
        ),
      )

      expect(response.reasoning).toBe("FirstSecond")
      expect(response.text).toBe("Visible")
      expect(response.events.filter(LLMEvent.is.reasoningDelta)).toEqual([
        { type: "reasoning-delta", id: "rs_1:0", text: "First" },
        { type: "reasoning-delta", id: "rs_1:1", text: "Second" },
      ])
      expect(response.events.filter(LLMEvent.is.reasoningEnd).at(-1)).toMatchObject({
        providerMetadata: { openai: { itemId: "rs_1", reasoningEncryptedContent: "encrypted-state" } },
      })
    }),
  )

  it.effect("closes consecutive sequential reasoning items at replacement", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(
        LLM.request({
          model: codexModel,
          prompt: "think",
          providerOptions: { openai: { reasoningSummaryDelivery: "sequential_cutoff" } },
        }),
      ).pipe(
        Effect.provide(
          fixedResponse(
            sseEvents(
              { type: "response.output_item.added", item: { type: "reasoning", id: "rs_first" } },
              {
                type: "response.reasoning_summary_text.done",
                item_id: "rs_first",
                summary_index: 0,
                text: "First",
              },
              { type: "response.output_item.added", item: { type: "reasoning", id: "rs_second" } },
              {
                type: "response.reasoning_summary_text.done",
                item_id: "rs_second",
                summary_index: 0,
                text: "Second",
              },
              {
                type: "response.output_item.done",
                item: { type: "reasoning", id: "rs_second", encrypted_content: "encrypted-second" },
              },
              { type: "response.completed", response: {} },
            ),
          ),
        ),
      )

      expect(response.reasoning).toBe("FirstSecond")
      expect(response.events.filter((event) => event.type.startsWith("reasoning-"))).toMatchObject([
        { type: "reasoning-start", id: "rs_first:0" },
        { type: "reasoning-delta", id: "rs_first:0", text: "First" },
        { type: "reasoning-end", id: "rs_first:0" },
        { type: "reasoning-start", id: "rs_second:0" },
        { type: "reasoning-delta", id: "rs_second:0", text: "Second" },
        { type: "reasoning-end", id: "rs_second:0" },
      ])
    }),
  )

  it.effect("does not reopen an old reasoning id after replacement", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(
        LLM.request({
          model: codexModel,
          prompt: "think",
          providerOptions: { openai: { reasoningSummaryDelivery: "sequential_cutoff" } },
        }),
      ).pipe(
        Effect.provide(
          fixedResponse(
            sseEvents(
              { type: "response.output_item.added", item: { type: "reasoning", id: "rs_old" } },
              {
                type: "response.reasoning_summary_text.done",
                item_id: "rs_old",
                summary_index: 0,
                text: "Old",
              },
              { type: "response.output_item.added", item: { type: "reasoning", id: "rs_new" } },
              { type: "response.output_item.added", item: { type: "reasoning", id: "rs_old" } },
              {
                type: "response.reasoning_summary_text.done",
                item_id: "rs_old",
                summary_index: 1,
                text: "Stale",
              },
              {
                type: "response.reasoning_summary_text.done",
                item_id: "rs_new",
                summary_index: 0,
                text: "New",
              },
              {
                type: "response.output_item.done",
                item: { type: "reasoning", id: "rs_new", encrypted_content: "encrypted-new" },
              },
              { type: "response.completed", response: {} },
            ),
          ),
        ),
      )

      expect(response.reasoning).toBe("OldNew")
      expect(response.events.filter(LLMEvent.is.reasoningStart)).toHaveLength(2)
      expect(response.events.filter(LLMEvent.is.reasoningEnd)).toHaveLength(2)
    }),
  )

  it.effect("returns balanced reasoning lifecycle events on non-reasoning interruption", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(
        LLM.request({
          model: codexModel,
          prompt: "think",
          providerOptions: { openai: { reasoningSummaryDelivery: "sequential_cutoff" } },
        }),
      ).pipe(
        Effect.provide(
          fixedResponse(
            sseEvents(
              { type: "response.output_item.added", item: { type: "reasoning", id: "rs_interrupted" } },
              {
                type: "response.reasoning_summary_text.done",
                item_id: "rs_interrupted",
                summary_index: 0,
                text: "Retained",
              },
              { type: "response.output_item.added", item: { type: "message", id: "msg_1" } },
              { type: "response.output_text.delta", item_id: "msg_1", delta: "Visible" },
              { type: "response.completed", response: {} },
            ),
          ),
        ),
      )

      const start = response.events.findIndex(LLMEvent.is.reasoningStart)
      const end = response.events.findIndex(LLMEvent.is.reasoningEnd)
      const text = response.events.findIndex(LLMEvent.is.textStart)
      expect(response.reasoning).toBe("Retained")
      expect(response.text).toBe("Visible")
      expect(start).toBeGreaterThanOrEqual(0)
      expect(end).toBeGreaterThan(start)
      expect(text).toBeGreaterThan(end)
      expect(response.events.filter(LLMEvent.is.reasoningStart)).toHaveLength(1)
      expect(response.events.filter(LLMEvent.is.reasoningEnd)).toHaveLength(1)
    }),
  )

  it.effect("does not interpret sequential cutoff events on public routes", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(
        LLM.request({
          model,
          prompt: "think",
          providerOptions: { openai: { reasoningSummaryDelivery: "sequential_cutoff" } },
        }),
      ).pipe(
        Effect.provide(
          fixedResponse(
            sseEvents(
              { type: "response.output_item.added", item: { type: "reasoning", id: "rs_public" } },
              {
                type: "response.reasoning_summary_text.delta",
                item_id: "rs_public",
                summary_index: 0,
                delta: "Legacy",
              },
              {
                type: "response.reasoning_summary_text.done",
                item_id: "rs_public",
                summary_index: 0,
                text: "Atomic",
              },
              { type: "response.output_item.done", item: { type: "reasoning", id: "rs_public" } },
              { type: "response.completed", response: {} },
            ),
          ),
        ),
      )

      expect(response.reasoning).toBe("Legacy")
    }),
  )

  it.effect("drops interrupted and done-only sequential cutoff items", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(
        LLM.request({
          model: codexModel,
          prompt: "think",
          providerOptions: { openai: { reasoningSummaryDelivery: "sequential_cutoff" } },
        }),
      ).pipe(
        Effect.provide(
          fixedResponse(
            sseEvents(
              { type: "response.output_item.added", item: { type: "reasoning", id: "rs_interrupted" } },
              {
                type: "response.reasoning_summary_text.delta",
                item_id: "rs_interrupted",
                summary_index: 0,
                delta: "partial",
              },
              { type: "response.output_item.added", item: { type: "message", id: "msg_1" } },
              {
                type: "response.reasoning_summary_text.done",
                item_id: "rs_interrupted",
                summary_index: 0,
                text: "late",
              },
              {
                type: "response.output_item.done",
                item: { type: "reasoning", id: "rs_done_only", encrypted_content: "stale" },
              },
              { type: "response.output_text.delta", item_id: "msg_1", delta: "Visible" },
              { type: "response.completed", response: {} },
            ),
          ),
        ),
      )

      expect(response.reasoning).toBe("")
      expect(response.text).toBe("Visible")
      expect(response.events.some(LLMEvent.is.reasoningDelta)).toBe(false)
    }),
  )

  it.effect("streams each reasoning summary part as a separate block", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(
        LLM.updateRequest(request, { providerOptions: { openai: { store: false } } }),
      ).pipe(
        Effect.provide(
          fixedResponse(
            sseEvents(
              {
                type: "response.output_item.added",
                item: { type: "reasoning", id: "rs_1", encrypted_content: null },
              },
              { type: "response.reasoning_summary_part.added", item_id: "rs_1", summary_index: 0 },
              { type: "response.reasoning_summary_text.delta", item_id: "rs_1", summary_index: 0, delta: "First" },
              { type: "response.reasoning_summary_part.done", item_id: "rs_1", summary_index: 0 },
              { type: "response.reasoning_summary_part.added", item_id: "rs_1", summary_index: 1 },
              { type: "response.reasoning_summary_text.delta", item_id: "rs_1", summary_index: 1, delta: "Second" },
              { type: "response.reasoning_summary_part.done", item_id: "rs_1", summary_index: 1 },
              {
                type: "response.output_item.done",
                item: { type: "reasoning", id: "rs_1", encrypted_content: "encrypted-state" },
              },
              { type: "response.completed", response: { id: "resp_1" } },
            ),
          ),
        ),
      )

      expect(response.reasoning).toBe("FirstSecond")
      expect(response.events).toMatchObject([
        { type: "step-start", index: 0 },
        {
          type: "reasoning-start",
          id: "rs_1:0",
          providerMetadata: { openai: { itemId: "rs_1", reasoningEncryptedContent: null } },
        },
        { type: "reasoning-delta", id: "rs_1:0", text: "First" },
        { type: "reasoning-end", id: "rs_1:0", providerMetadata: { openai: { itemId: "rs_1" } } },
        {
          type: "reasoning-start",
          id: "rs_1:1",
          providerMetadata: { openai: { itemId: "rs_1", reasoningEncryptedContent: null } },
        },
        { type: "reasoning-delta", id: "rs_1:1", text: "Second" },
        {
          type: "reasoning-end",
          id: "rs_1:1",
          providerMetadata: { openai: { itemId: "rs_1", reasoningEncryptedContent: "encrypted-state" } },
        },
        { type: "step-finish", index: 0, reason: "stop" },
        { type: "finish", reason: "stop" },
      ])
    }),
  )

  it.effect("closes reasoning summary parts when storage is not disabled", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(request).pipe(
        Effect.provide(
          fixedResponse(
            sseEvents(
              {
                type: "response.output_item.added",
                item: { type: "reasoning", id: "rs_1", encrypted_content: null },
              },
              { type: "response.reasoning_summary_part.added", item_id: "rs_1", summary_index: 0 },
              { type: "response.reasoning_summary_text.delta", item_id: "rs_1", summary_index: 0, delta: "First" },
              { type: "response.reasoning_summary_part.done", item_id: "rs_1", summary_index: 0 },
              { type: "response.reasoning_summary_part.added", item_id: "rs_1", summary_index: 1 },
              { type: "response.reasoning_summary_text.delta", item_id: "rs_1", summary_index: 1, delta: "Second" },
              { type: "response.reasoning_summary_part.done", item_id: "rs_1", summary_index: 1 },
              {
                type: "response.output_item.done",
                item: { type: "reasoning", id: "rs_1", encrypted_content: null },
              },
              { type: "response.completed", response: { id: "resp_1" } },
            ),
          ),
        ),
      )

      expect(response.events.filter((event) => event.type === "reasoning-end")).toEqual([
        { type: "reasoning-end", id: "rs_1:0", providerMetadata: { openai: { itemId: "rs_1" } } },
        { type: "reasoning-end", id: "rs_1:1", providerMetadata: { openai: { itemId: "rs_1" } } },
      ])
    }),
  )

  it.effect("continues a stateless reasoning conversation", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(
        LLM.request({
          id: "req_reasoning_continue",
          model,
          messages: [
            Message.user("What changed?"),
            Message.assistant([
              {
                type: "reasoning",
                text: "Checked the previous diff.",
                providerMetadata: {
                  openai: {
                    itemId: "rs_1",
                    reasoningEncryptedContent: "encrypted-state",
                  },
                },
              },
              { type: "text", text: "The parser changed." },
            ]),
            Message.user("Summarize it."),
          ],
          providerOptions: { openai: { store: false } },
        }),
      ).pipe(
        Effect.provide(
          dynamicResponse((input) =>
            Effect.gen(function* () {
              const web = yield* HttpClientRequest.toWeb(input.request).pipe(Effect.orDie)
              expect(yield* Effect.promise(() => web.json())).toMatchObject({
                input: [
                  { role: "user", content: [{ type: "input_text", text: "What changed?" }] },
                  {
                    type: "reasoning",
                    encrypted_content: "encrypted-state",
                    summary: [{ type: "summary_text", text: "Checked the previous diff." }],
                  },
                  { role: "assistant", content: [{ type: "output_text", text: "The parser changed." }] },
                  { role: "user", content: [{ type: "input_text", text: "Summarize it." }] },
                ],
              })
              return input.respond(
                sseEvents(
                  { type: "response.output_text.delta", item_id: "msg_1", delta: "Parser now round-trips reasoning." },
                  { type: "response.completed", response: { id: "resp_1" } },
                ),
                { headers: { "content-type": "text/event-stream" } },
              )
            }),
          ),
        ),
      )

      expect(response.text).toBe("Parser now round-trips reasoning.")
    }),
  )

  it.effect("preserves assistant content order around reasoning items", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          id: "req_reasoning_order",
          model,
          messages: [
            Message.assistant([
              { type: "text", text: "Before." },
              {
                type: "reasoning",
                text: "Checked order.",
                providerMetadata: {
                  openai: {
                    itemId: "rs_1",
                    reasoningEncryptedContent: "encrypted-state",
                  },
                },
              },
              { type: "text", text: "After." },
            ]),
          ],
          providerOptions: { openai: { store: false } },
        }),
      )

      expect(prepared.body.input).toEqual([
        { role: "assistant", content: [{ type: "output_text", text: "Before." }] },
        {
          type: "reasoning",
          encrypted_content: "encrypted-state",
          summary: [{ type: "summary_text", text: "Checked order." }],
        },
        { role: "assistant", content: [{ type: "output_text", text: "After." }] },
      ])
    }),
  )

  it.effect("references stored reasoning items by id", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model,
          messages: [
            Message.assistant([
              {
                type: "reasoning",
                text: "Checked the previous diff.",
                providerMetadata: { openai: { itemId: "rs_1" } },
              },
            ]),
          ],
          providerOptions: { openai: { store: true } },
        }),
      )

      expect(prepared.body.input).toEqual([{ type: "item_reference", id: "rs_1" }])
    }),
  )

  it.effect("references stored provider-executed hosted tool results by id", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          model,
          messages: [
            Message.assistant([
              ToolCallPart.make({
                id: "ws_1",
                name: "web_search",
                input: { query: "effect 4" },
                providerExecuted: true,
                providerMetadata: { openai: { itemId: "ws_1" } },
              }),
              {
                type: "tool-result",
                id: "ws_1",
                name: "web_search",
                result: { type: "json", value: { type: "web_search_call", id: "ws_1", status: "completed" } },
                providerExecuted: true,
                providerMetadata: { openai: { itemId: "ws_1" } },
              },
            ]),
            Message.user("Continue."),
          ],
          providerOptions: { openai: { store: true } },
        }),
      )

      expect(prepared.body.input).toEqual([
        { type: "item_reference", id: "ws_1" },
        { role: "user", content: [{ type: "input_text", text: "Continue." }] },
      ])
    }),
  )

  it.effect("joins streamed summary blocks into one continuation reasoning item", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          id: "req_multi_summary_continuation",
          model,
          messages: [
            Message.assistant([
              {
                type: "reasoning",
                text: "First",
                providerMetadata: { openai: { itemId: "rs_1" } },
              },
              {
                type: "reasoning",
                text: "Second",
                providerMetadata: { openai: { itemId: "rs_1", reasoningEncryptedContent: "encrypted-state" } },
              },
            ]),
          ],
          providerOptions: { openai: { store: false } },
        }),
      )

      expect(prepared.body.input).toEqual([
        {
          type: "reasoning",
          encrypted_content: "encrypted-state",
          summary: [
            { type: "summary_text", text: "First" },
            { type: "summary_text", text: "Second" },
          ],
        },
      ])
    }),
  )

  it.effect("skips non-persisted reasoning ids without encrypted state", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare(
        LLM.request({
          id: "req_reasoning_without_encrypted_state",
          model,
          messages: [
            Message.user("What changed?"),
            Message.assistant([
              {
                type: "reasoning",
                text: "Checked the previous diff.",
                providerMetadata: {
                  openai: {
                    itemId: "rs_1",
                    reasoningEncryptedContent: null,
                  },
                },
              },
              { type: "text", text: "The parser changed." },
            ]),
            Message.user("Summarize it."),
          ],
          providerOptions: { openai: { store: false } },
        }),
      )

      expect(prepared.body).toMatchObject({
        input: [
          { role: "user", content: [{ type: "input_text", text: "What changed?" }] },
          { role: "assistant", content: [{ type: "output_text", text: "The parser changed." }] },
          { role: "user", content: [{ type: "input_text", text: "Summarize it." }] },
        ],
        store: false,
      })
    }),
  )

  it.effect("assembles streamed function call input", () =>
    Effect.gen(function* () {
      const body = sseEvents(
        {
          type: "response.output_item.added",
          item: { type: "function_call", id: "item_1", call_id: "call_1", name: "lookup", arguments: "" },
        },
        { type: "response.function_call_arguments.delta", item_id: "item_1", delta: '{"query"' },
        { type: "response.function_call_arguments.delta", item_id: "item_1", delta: ':"weather"}' },
        {
          type: "response.output_item.done",
          item: {
            type: "function_call",
            id: "item_1",
            call_id: "call_1",
            name: "lookup",
            arguments: '{"query":"weather"}',
          },
        },
        { type: "response.completed", response: { usage: { input_tokens: 5, output_tokens: 1 } } },
      )
      const response = yield* LLMClient.generate(
        LLM.updateRequest(request, {
          tools: [{ name: "lookup", description: "Lookup data", inputSchema: { type: "object" } }],
        }),
      ).pipe(Effect.provide(fixedResponse(body)))
      const usage = new Usage({
        inputTokens: 5,
        outputTokens: 1,
        nonCachedInputTokens: 5,
        cacheReadInputTokens: undefined,
        reasoningTokens: undefined,
        totalTokens: 6,
        providerMetadata: { openai: { input_tokens: 5, output_tokens: 1 } },
      })

      expect(response.events).toEqual([
        { type: "step-start", index: 0 },
        {
          type: "tool-input-start",
          id: "call_1",
          name: "lookup",
          providerMetadata: { openai: { itemId: "item_1" } },
        },
        {
          type: "tool-input-delta",
          id: "call_1",
          name: "lookup",
          text: '{"query"',
        },
        {
          type: "tool-input-delta",
          id: "call_1",
          name: "lookup",
          text: ':"weather"}',
        },
        {
          type: "tool-input-end",
          id: "call_1",
          name: "lookup",
          providerMetadata: { openai: { itemId: "item_1" } },
        },
        {
          type: "tool-call",
          id: "call_1",
          name: "lookup",
          input: { query: "weather" },
          providerExecuted: undefined,
          providerMetadata: { openai: { itemId: "item_1" } },
        },
        { type: "step-finish", index: 0, reason: "tool-calls", usage, providerMetadata: undefined },
        {
          type: "finish",
          reason: "tool-calls",
          providerMetadata: undefined,
          usage,
        },
      ])
    }),
  )

  it.effect("preserves malformed recorded function arguments without failing the stream", () =>
    Effect.gen(function* () {
      const body = sseEvents(
        {
          type: "response.output_item.added",
          item: { type: "function_call", id: "item_bad", call_id: "call_bad", name: "final_output", arguments: "" },
        },
        { type: "response.function_call_arguments.delta", item_id: "item_bad", delta: "{" },
        {
          type: "response.output_item.done",
          item: {
            type: "function_call",
            id: "item_bad",
            call_id: "call_bad",
            name: "final_output",
            arguments: "{",
          },
        },
        { type: "response.completed", response: { usage: { input_tokens: 1, output_tokens: 1 } } },
      )
      const response = yield* LLMClient.generate(
        LLM.updateRequest(request, {
          tools: [{ name: "final_output", description: "Return the final value", inputSchema: { type: "object" } }],
          toolChoice: { type: "required" },
        }),
      ).pipe(Effect.provide(fixedResponse(body)))

      expect(response.events).toContainEqual({
        type: "tool-input-error",
        id: "call_bad",
        name: "final_output",
        reason: "invalid-json",
        providerMetadata: { openai: { itemId: "item_bad" } },
      })
      expect(JSON.stringify(response.events)).not.toContain('arguments":"{"')
    }),
  )

  it.effect("assembles streamed custom tool input as raw text", () =>
    Effect.gen(function* () {
      const body = sseEvents(
        {
          type: "response.output_item.added",
          item: { type: "custom_tool_call", id: "ctc_1", call_id: "call_1", name: "patch", input: "" },
        },
        { type: "response.custom_tool_call_input.delta", item_id: "ctc_1", delta: "*** Begin" },
        { type: "response.custom_tool_call_input.delta", item_id: "ctc_1", delta: " Patch" },
        {
          type: "response.output_item.done",
          item: {
            type: "custom_tool_call",
            id: "ctc_1",
            call_id: "call_1",
            name: "patch",
            input: "*** Begin Patch",
          },
        },
        { type: "response.completed", response: {} },
      )
      const response = yield* LLMClient.generate(
        LLM.updateRequest(request, {
          tools: [new CustomToolDefinition({ name: "patch", description: "Apply a patch." })],
        }),
      ).pipe(Effect.provide(fixedResponse(body)))

      expect(response.events.filter((event) => event.type.startsWith("tool-"))).toEqual([
        {
          type: "tool-input-start",
          id: "call_1",
          name: "patch",
          toolType: "custom",
          providerMetadata: { openai: { itemId: "ctc_1" } },
        },
        { type: "tool-input-delta", id: "call_1", name: "patch", text: "*** Begin", toolType: "custom" },
        { type: "tool-input-delta", id: "call_1", name: "patch", text: " Patch", toolType: "custom" },
        {
          type: "tool-input-end",
          id: "call_1",
          name: "patch",
          toolType: "custom",
          providerMetadata: { openai: { itemId: "ctc_1" } },
        },
        {
          type: "tool-call",
          id: "call_1",
          name: "patch",
          input: "*** Begin Patch",
          toolType: "custom",
          providerExecuted: undefined,
          providerMetadata: { openai: { itemId: "ctc_1" } },
        },
      ])
      expect(response.events.at(-1)).toMatchObject({ type: "finish", reason: "tool-calls" })
    }),
  )

  it.effect("decodes web_search_call as provider-executed tool-call + tool-result", () =>
    Effect.gen(function* () {
      const item = {
        type: "web_search_call",
        id: "ws_1",
        status: "completed",
        action: { type: "search", query: "effect 4" },
      }
      const body = sseEvents(
        { type: "response.output_item.added", item },
        { type: "response.output_item.done", item },
        { type: "response.completed", response: { usage: { input_tokens: 5, output_tokens: 1 } } },
      )
      const response = yield* LLMClient.generate(request).pipe(Effect.provide(fixedResponse(body)))

      const callsAndResults = response.events.filter(
        (event) => event.type === "tool-call" || event.type === "tool-result",
      )
      expect(callsAndResults).toEqual([
        {
          type: "tool-call",
          id: "ws_1",
          name: "web_search",
          input: { type: "search", query: "effect 4" },
          providerExecuted: true,
          providerMetadata: { openai: { itemId: "ws_1" } },
        },
        {
          type: "tool-result",
          id: "ws_1",
          name: "web_search",
          result: { type: "json", value: item },
          providerExecuted: true,
          providerMetadata: { openai: { itemId: "ws_1" } },
        },
      ])
    }),
  )

  it.effect("decodes code_interpreter_call as provider-executed events with code input", () =>
    Effect.gen(function* () {
      const item = {
        type: "code_interpreter_call",
        id: "ci_1",
        status: "completed",
        code: "print(1+1)",
        container_id: "cnt_xyz",
        outputs: [{ type: "logs", logs: "2\n" }],
      }
      const body = sseEvents(
        { type: "response.output_item.done", item },
        { type: "response.completed", response: { usage: { input_tokens: 5, output_tokens: 1 } } },
      )
      const response = yield* LLMClient.generate(request).pipe(Effect.provide(fixedResponse(body)))

      const toolCall = response.events.find((event) => event.type === "tool-call")
      expect(toolCall).toEqual({
        type: "tool-call",
        id: "ci_1",
        name: "code_interpreter",
        input: { code: "print(1+1)", container_id: "cnt_xyz" },
        providerExecuted: true,
        providerMetadata: { openai: { itemId: "ci_1" } },
      })
      const toolResult = response.events.find((event) => event.type === "tool-result")
      expect(toolResult).toEqual({
        type: "tool-result",
        id: "ci_1",
        name: "code_interpreter",
        result: { type: "json", value: item },
        providerExecuted: true,
        providerMetadata: { openai: { itemId: "ci_1" } },
      })
    }),
  )

  it.effect("lowers user image content", () =>
    Effect.gen(function* () {
      const prepared = yield* LLMClient.prepare<OpenAIResponses.OpenAIResponsesBody>(
        LLM.request({
          id: "req_media",
          model,
          messages: [Message.user({ type: "media", mediaType: "image/png", data: "AAECAw==" })],
        }),
      )

      expect(prepared.body.input).toEqual([
        {
          role: "user",
          content: [{ type: "input_image", image_url: "data:image/png;base64,AAECAw==" }],
        },
      ])
    }),
  )

  it.effect("rejects unsupported user media content", () =>
    Effect.gen(function* () {
      const error = yield* LLMClient.prepare(
        LLM.request({
          id: "req_media",
          model,
          messages: [Message.user({ type: "media", mediaType: "application/pdf", data: "AAECAw==" })],
        }),
      ).pipe(Effect.flip)

      expect(error.message).toContain("OpenAI Responses does not support media type application/pdf")
    }),
  )

  it.effect("emits provider-error events for mid-stream provider errors", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(request).pipe(
        Effect.provide(fixedResponse(sseEvents({ type: "error", code: "rate_limit_exceeded", message: "Slow down" }))),
      )

      // Prefix the code so consumers see the failure mode, not just the
      // sometimes-generic provider message. The bare message alone meant
      // production errors like rate limits were indistinguishable from
      // unrelated stream failures.
      expect(response.events).toEqual([{ type: "provider-error", message: "rate_limit_exceeded: Slow down" }])
    }),
  )

  it.effect("falls back to error code when no message is present", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(request).pipe(
        Effect.provide(fixedResponse(sseEvents({ type: "error", code: "internal_error" }))),
      )

      expect(response.events).toEqual([{ type: "provider-error", message: "internal_error" }])
    }),
  )

  it.effect("falls back to error code when message is empty", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(request).pipe(
        Effect.provide(fixedResponse(sseEvents({ type: "error", code: "internal_error", message: "" }))),
      )

      expect(response.events).toEqual([{ type: "provider-error", message: "internal_error" }])
    }),
  )

  // Regression: `response.failed` carries the failure details under
  // `response.error`, not at the top level. The previous handler only
  // checked top-level `message`/`code` and so always emitted the bare
  // "OpenAI Responses response failed" string, hiding the real cause.
  it.effect("surfaces response.failed details from response.error", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(request).pipe(
        Effect.provide(
          fixedResponse(
            sseEvents({
              type: "response.failed",
              response: {
                id: "resp_failed_1",
                error: { code: "server_error", message: "Upstream model unavailable" },
              },
            }),
          ),
        ),
      )

      expect(response.events).toEqual([{ type: "provider-error", message: "server_error: Upstream model unavailable" }])
    }),
  )

  it.effect("surfaces response.failed code when no nested message is present", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(request).pipe(
        Effect.provide(
          fixedResponse(
            sseEvents({
              type: "response.failed",
              response: { id: "resp_failed_2", error: { code: "invalid_prompt" } },
            }),
          ),
        ),
      )

      expect(response.events).toEqual([{ type: "provider-error", message: "invalid_prompt" }])
    }),
  )

  it.effect("surfaces error event details even when they arrive nested under response.error", () =>
    Effect.gen(function* () {
      // Some OpenAI-compatible proxies and older SDK versions wrap the
      // top-level error fields into a nested `response.error` payload
      // when they bubble up an HTTP error as an SSE `error` event. Honour
      // both shapes so the user still sees the underlying cause instead
      // of the catch-all string.
      const response = yield* LLMClient.generate(request).pipe(
        Effect.provide(
          fixedResponse(
            sseEvents({
              type: "error",
              response: { error: { code: "context_length_exceeded", message: "prompt too long" } },
            }),
          ),
        ),
      )

      expect(response.events).toEqual([
        {
          type: "provider-error",
          message: "context_length_exceeded: prompt too long",
          classification: "context-overflow",
        },
      ])
    }),
  )

  it.effect("falls back to a stable default when both error and response are absent", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(request).pipe(
        Effect.provide(fixedResponse(sseEvents({ type: "error" }))),
      )

      expect(response.events).toEqual([{ type: "provider-error", message: "OpenAI Responses stream error" }])
    }),
  )

  it.effect("falls back to a stable default when response.failed has no error payload", () =>
    Effect.gen(function* () {
      const response = yield* LLMClient.generate(request).pipe(
        Effect.provide(fixedResponse(sseEvents({ type: "response.failed", response: { id: "resp_failed_3" } }))),
      )

      expect(response.events).toEqual([{ type: "provider-error", message: "OpenAI Responses response failed" }])
    }),
  )

  it.effect("fails HTTP provider errors before stream parsing", () =>
    Effect.gen(function* () {
      const error = yield* LLMClient.generate(request).pipe(
        Effect.provide(
          fixedResponse('{"error":{"type":"invalid_request_error","message":"Bad request"}}', {
            status: 400,
            headers: { "content-type": "application/json" },
          }),
        ),
        Effect.flip,
      )

      expect(error).toBeInstanceOf(LLMError)
      expect(error.reason).toMatchObject({ _tag: "InvalidRequest" })
      expect(error.message).toContain("HTTP 400")
    }),
  )
})
