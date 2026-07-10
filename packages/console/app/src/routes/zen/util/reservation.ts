import type { ZenData } from "@slopcode-ai/console-core/model.js"
import { RequestError } from "./error"

export const DEFAULT_OUTPUT_TOKENS = 32_000
export const MAX_OUTPUT_TOKENS = 128_000
const PROVIDER_OVERHEAD_TOKENS = 4_096
const MEDIA_INPUT_TOKENS = 64_000
const MAX_MEDIA_PARTS = 16

type Cost = {
  input: number
  output: number
  cacheRead?: number
  cacheWrite5m?: number
  cacheWrite1h?: number
}

export function prepareReservation(body: Record<string, unknown>, format: ZenData.Format, cost: Cost, cost200K?: Cost) {
  const field = (() => {
    if (format === "openai") return "max_output_tokens"
    return "max_tokens"
  })()
  const config = (() => {
    if (format !== "google") return body
    const value = body.generationConfig
    if (typeof value === "object" && value && !Array.isArray(value)) return value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    body.generationConfig = result
    return result
  })()
  const key = format === "google" ? "maxOutputTokens" : field
  const outputTokens = config[key] ?? DEFAULT_OUTPUT_TOKENS
  if (!Number.isSafeInteger(outputTokens) || Number(outputTokens) <= 0)
    throw new RequestError("max output tokens must be a positive integer")
  if (Number(outputTokens) > MAX_OUTPUT_TOKENS)
    throw new RequestError(`max output tokens must be at most ${MAX_OUTPUT_TOKENS}`)
  config[key] = outputTokens

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
  const inputTokens =
    new TextEncoder().encode(JSON.stringify(body)).length +
    PROVIDER_OVERHEAD_TOKENS +
    Math.min(MAX_MEDIA_PARTS, media(body)) * MEDIA_INPUT_TOKENS
  const prices = cost200K ? [cost, cost200K] : [cost]
  const input = Math.max(
    ...prices.flatMap((price) => [price.input, price.cacheRead ?? 0, price.cacheWrite5m ?? 0, price.cacheWrite1h ?? 0]),
  )
  const output = Math.max(...prices.map((price) => price.output))
  const amount = Math.ceil((inputTokens * input + Number(outputTokens) * output) * 100_000_000)
  if (!Number.isSafeInteger(amount)) throw new RequestError("usage reservation is too large")

  return { amount, inputTokens, outputTokens: Number(outputTokens) }
}
