export * as Grapheme from "./grapheme"

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })

export function split(value: string) {
  return Array.from(segmenter.segment(value), (part) => part.segment)
}

export function take(value: string, limit: number) {
  if (limit <= 0) return ""
  let size = 0
  const result: string[] = []
  for (const part of segmenter.segment(value)) {
    if (size + part.segment.length > limit) break
    size += part.segment.length
    result.push(part.segment)
  }
  return result.join("")
}

export function takeEnd(value: string, limit: number) {
  if (limit <= 0) return ""
  let size = 0
  const result: string[] = []
  for (const part of split(value).reverse()) {
    if (size + part.length > limit) break
    size += part.length
    result.push(part)
  }
  return result.reverse().join("")
}
