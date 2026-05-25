import type { AssistantMessage, Message, Part } from "@slopcode-ai/sdk/v2"

export function consumed(input: {
  messages: Message[]
  parts: Record<string, Part[] | undefined>
  model?: {
    providerID: string
    modelID: string
  }
}) {
  if (!input.model) return
  const messages = input.messages.toReversed().filter(assistant)
  for (const message of messages) {
    if (message.providerID !== input.model.providerID || message.modelID !== input.model.modelID) continue
    const value = partConsumed(input.parts[message.id] ?? [])
    if (value !== undefined) return value
  }
}

export function label(value?: number) {
  if (value === undefined) return
  return `${clamp(value)}% limit consumed`
}

function assistant(input: Message): input is AssistantMessage {
  return input.role === "assistant"
}

function partConsumed(parts: Part[]) {
  for (const part of parts.toReversed()) {
    if (part.type !== "step-finish") continue
    const slopcode = object(part.metadata) ? part.metadata["slopcode"] : undefined
    const tokenLimit = object(slopcode) ? slopcode["tokenLimit"] : undefined
    const value = object(tokenLimit) ? tokenLimit["consumedPct"] : undefined
    if (typeof value !== "number" || !Number.isFinite(value)) continue
    return clamp(value)
  }
}

function object(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null
}

function clamp(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 100)
}
