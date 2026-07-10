import type { ZenData } from "@slopcode-ai/console-core/model.js"
import { RequestError } from "./error"

export const DEFAULT_OUTPUT_TOKENS = 32_000
export const MAX_OUTPUT_TOKENS = 128_000
export const DEFAULT_CONTEXT_TOKENS = 2_000_000
const PROVIDER_OVERHEAD_TOKENS = 4_096
const MEDIA_INPUT_TOKENS = 64_000
const MAX_MEDIA_PARTS = 16

export type Cost = {
  input: number
  output: number
  cacheRead?: number
  cacheWrite5m?: number
  cacheWrite1h?: number
}

export function prepareReservation(
  body: Record<string, unknown>,
  format: ZenData.Format,
  cost: Cost,
  cost200K?: Cost,
  options?: {
    payloads?: unknown[]
    limit?: { context?: number; output?: number }
  },
) {
  const aliases = [
    "max_tokens",
    "max_output_tokens",
    "max_completion_tokens",
    "maxTokens",
    "maxOutputTokens",
    "maxCompletionTokens",
  ]
  const nested = [body.generationConfig, body.generation_config].filter(
    (value): value is Record<string, unknown> => typeof value === "object" && !!value && !Array.isArray(value),
  )
  const records = [body, ...nested]
  const values = records.flatMap((record) =>
    aliases.map((alias) => record[alias]).filter((value) => value !== undefined),
  )
  values.forEach((value) => {
    if (!Number.isSafeInteger(value) || Number(value) <= 0)
      throw new RequestError("max output tokens must be a positive integer")
  })
  const outputTokens = values.length ? Math.max(...values.map(Number)) : DEFAULT_OUTPUT_TOKENS
  const outputLimit = Math.min(MAX_OUTPUT_TOKENS, options?.limit?.output ?? MAX_OUTPUT_TOKENS)
  if (outputTokens > outputLimit) throw new RequestError(`max output tokens must be at most ${outputLimit}`)
  records.forEach((record) => aliases.forEach((alias) => delete record[alias]))
  const config = (() => {
    if (format !== "google") return body
    if (nested[0] && nested[0] === body.generationConfig) return nested[0]
    const result: Record<string, unknown> = {}
    body.generationConfig = result
    return result
  })()
  config[format === "google" ? "maxOutputTokens" : format === "openai" ? "max_output_tokens" : "max_tokens"] =
    outputTokens

  const media = (value: unknown): number => {
    if (Array.isArray(value)) return value.reduce((total, item) => total + media(item), 0)
    if (typeof value !== "object" || !value) return 0
    const record = value as Record<string, unknown>
    if (
      ["image", "image_url", "input_image", "document", "file", "input_file"].includes(String(record.type)) ||
      "inlineData" in record ||
      "fileData" in record
    )
      return 1
    return Object.values(record).reduce<number>((total, item) => total + media(item), 0)
  }
  const hidden = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(hidden)
    if (typeof value !== "object" || !value) return false
    const record = value as Record<string, unknown>
    if (
      [
        "previous_response_id",
        "previousResponseId",
        "conversation",
        "container",
        "cached_content",
        "cachedContent",
      ].some((field) => record[field] !== undefined)
    )
      return true
    return Object.values(record).some(hidden)
  }
  const estimate = (value: unknown) => {
    const json = JSON.stringify(value) ?? ""
    return (
      new TextEncoder().encode(json).length +
      PROVIDER_OVERHEAD_TOKENS +
      Math.min(MAX_MEDIA_PARTS, media(value)) * MEDIA_INPUT_TOKENS
    )
  }
  const context = options?.limit?.context ?? DEFAULT_CONTEXT_TOKENS
  if (!Number.isSafeInteger(context) || context <= Number(outputTokens))
    throw new RequestError("model context limit must exceed max output tokens")
  const inputLimit = context - Number(outputTokens)
  const payloads = [body, ...(options?.payloads ?? [])]
  const inputTokens = payloads.some(hidden) ? context : Math.min(inputLimit, Math.max(...payloads.map(estimate)))
  const prices = cost200K ? [cost, cost200K] : [cost]
  const input = Math.max(
    ...prices.flatMap((price) => [price.input, price.cacheRead ?? 0, price.cacheWrite5m ?? 0, price.cacheWrite1h ?? 0]),
  )
  const output = Math.max(...prices.map((price) => price.output))
  const amount = Math.ceil((inputTokens * input + Number(outputTokens) * output) * 100_000_000)
  if (!Number.isSafeInteger(amount)) throw new RequestError("usage reservation is too large")

  return { amount, inputTokens, outputTokens: Number(outputTokens) }
}
