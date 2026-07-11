import { AgentV2 } from "@slopcode-ai/core/agent"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { PluginBoot } from "@slopcode-ai/core/plugin/boot"
import { SkillV2 } from "@slopcode-ai/core/skill"
import { Effect, Layer } from "effect"

const catalogs = Layer.mergeAll(
  Layer.mock(AgentV2.Service, { all: () => Effect.succeed([]) }),
  Layer.mock(SkillV2.Service, { list: () => Effect.succeed([]) }),
  Layer.mock(PluginBoot.Service, { wait: () => Effect.void }),
)

export const locationServices = Layer.mock(LocationServiceMap, { get: () => catalogs })
