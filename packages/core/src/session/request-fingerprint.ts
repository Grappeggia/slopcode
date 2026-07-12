export * as SessionRequestFingerprint from "./request-fingerprint"

import { createHash } from "node:crypto"
import type { LLMRequest } from "@slopcode-ai/llm"
import type { AgentV2 } from "../agent"
import type { ModelV2 } from "../model"
import type { ModelHarness } from "../model-harness"

const secret = /^(?:authorization|proxy-authorization|api[-_]?key|token|secret|credential|cookie|set-cookie)$/i

const canonical = (value: unknown): unknown => {
  if (value === undefined) return null
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) return value.map(canonical)
  if (typeof value !== "object") return String(value)
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !secret.test(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonical(item)]),
  )
}

export const fingerprint = (input: {
  readonly request: LLMRequest
  readonly catalog: ModelV2.Info
  readonly variant?: string
  readonly agent: AgentV2.ID
  readonly harness?: ModelHarness.Profile
}) => createHash("sha256").update(JSON.stringify(canonical({
  version: 1,
  agent: input.agent,
  variant: input.variant ?? "default",
  harness: input.harness,
  catalog: {
    id: input.catalog.id,
    providerID: input.catalog.providerID,
    api: input.catalog.api,
    request: input.catalog.request,
  },
  request: {
    model: {
      id: input.request.model.id,
      provider: input.request.model.provider,
      route: {
        id: input.request.model.route.id,
        protocol: input.request.model.route.protocol,
        capabilities: input.request.model.route.capabilities,
        defaults: input.request.model.route.defaults,
      },
    },
    system: input.request.system,
    messages: input.request.messages,
    tools: input.request.tools,
    toolChoice: input.request.toolChoice,
    generation: input.request.generation,
    providerOptions: input.request.providerOptions,
    http: input.request.http,
    responseFormat: input.request.responseFormat,
    cache: input.request.cache,
    metadata: input.request.metadata,
  },
}))).digest("hex")
