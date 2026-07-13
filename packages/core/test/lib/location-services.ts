import { AgentV2 } from "@slopcode-ai/core/agent"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { PluginBoot } from "@slopcode-ai/core/plugin/boot"
import { SkillV2 } from "@slopcode-ai/core/skill"
import { SessionRunnerModel } from "@slopcode-ai/core/session/runner/model"
import * as AnthropicMessages from "@slopcode-ai/llm/protocols/anthropic-messages"
import * as BedrockConverse from "@slopcode-ai/llm/protocols/bedrock-converse"
import * as Gemini from "@slopcode-ai/llm/protocols/gemini"
import * as OpenAIChat from "@slopcode-ai/llm/protocols/openai-chat"
import * as OpenAIResponses from "@slopcode-ai/llm/protocols/openai-responses"
import { Effect, Layer } from "effect"

const catalogs = Layer.mergeAll(
  Layer.mock(AgentV2.Service, { all: () => Effect.succeed([]) }),
  Layer.mock(SkillV2.Service, { list: () => Effect.succeed([]) }),
  Layer.mock(PluginBoot.Service, { wait: () => Effect.void }),
  SessionRunnerModel.layerWithModel((session) => {
    const route =
      session.model?.providerID === "anthropic"
        ? AnthropicMessages.route
        : session.model?.providerID === "gemini"
          ? Gemini.route
          : session.model?.providerID === "bedrock"
            ? BedrockConverse.route.with({ endpoint: { baseURL: "https://bedrock.example" } })
            : session.model?.providerID === "openai-chat"
              ? OpenAIChat.route
              : OpenAIResponses.route
    return Effect.succeed(
      route.model({ id: session.model?.id ?? "test", provider: session.model?.providerID ?? "test" }),
    )
  }),
)

export const locationServices = Layer.mock(LocationServiceMap, { get: () => catalogs })
