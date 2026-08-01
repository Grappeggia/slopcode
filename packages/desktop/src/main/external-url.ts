import { fileURLToPath } from "node:url"

export function resolveExternalURL(value: string) {
  if (!URL.canParse(value)) return
  const url = new URL(value)
  if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") return url.href
}

export function resolveLocalFilePath(value: string) {
  if (!URL.canParse(value)) return
  const url = new URL(value)
  if (url.protocol !== "file:" || url.hostname) return
  try {
    return fileURLToPath(url)
  } catch {
    return
  }
}
