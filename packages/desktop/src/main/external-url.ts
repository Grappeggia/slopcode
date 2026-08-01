import { fileURLToPath } from "node:url"

export function resolveExternalURL(value: string) {
  if (value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) return
  if (!URL.canParse(value)) return
  const url = new URL(value)
  if (url.username || url.password) return
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
