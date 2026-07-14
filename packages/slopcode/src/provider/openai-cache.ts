import type { ModelMessage } from "ai"

export const HEADER = "x-slopcode-openai-cache-breakpoints"

export function hints(messages: readonly ModelMessage[]) {
  let message = -1
  return messages.flatMap((item) => {
    if (item.role !== "system" && item.role !== "user") return []
    message++
    if (!Array.isArray(item.content)) return []
    let part = -1
    return item.content.flatMap((content) => {
      if (!content || typeof content !== "object" || content.type !== "text") return []
      part++
      if (!("cache" in content) || !content.cache || typeof content.cache !== "object") return []
      if (!("type" in content.cache) || content.cache.type !== "ephemeral") return []
      if (!("ttlSeconds" in content.cache) || content.cache.ttlSeconds !== 1800) return []
      return [[message, part] as const]
    })
  })
}

export function apply(body: string, value: string) {
  if (!/^\[\[\d+,\d+\](,\[\d+,\d+\])*\]$/.test(value)) return body
  const paths = JSON.parse(value) as unknown
  const payload = JSON.parse(body) as Record<string, unknown>
  if (!Array.isArray(paths) || !Array.isArray(payload.input)) return body
  const markers = paths.filter(
    (path): path is [number, number] =>
      Array.isArray(path) &&
      path.length === 2 &&
      path.every((item) => Number.isSafeInteger(item) && item >= 0),
  )
  let message = -1
  let applied = 0
  payload.input.forEach((item) => {
    if (!item || typeof item !== "object" || !("role" in item)) return
    if (item.role !== "system" && item.role !== "developer" && item.role !== "user") return
    message++
    const selected = new Set(markers.filter((path) => path[0] === message).map((path) => path[1]))
    if (selected.size === 0 || !("content" in item)) return
    if (typeof item.content === "string") {
      if (!selected.has(0)) return
      item.content = [
        { type: "input_text", text: item.content, prompt_cache_breakpoint: { mode: "explicit" } },
      ]
      applied++
      return
    }
    if (!Array.isArray(item.content)) return
    let part = -1
    const contents = item.content as unknown[]
    contents.forEach((content) => {
      if (!content || typeof content !== "object" || !("type" in content) || content.type !== "input_text") return
      part++
      if (!selected.has(part)) return
      Object.assign(content, { prompt_cache_breakpoint: { mode: "explicit" } })
      applied++
    })
  })
  if (applied === 0) return body
  payload.prompt_cache_options = { mode: "explicit", ttl: "30m" }
  return JSON.stringify(payload)
}
