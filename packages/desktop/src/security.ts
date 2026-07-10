const control = /[\u0000-\u001f\u007f]/
const rendererOrigin = "oc://renderer"

function parse(value?: string) {
  if (!value || !URL.canParse(value)) return
  return new URL(value)
}

function web(url: URL) {
  return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password
}

export function safeExternalUrl(value: unknown) {
  if (typeof value !== "string" || value !== value.trim() || control.test(value)) return
  const url = parse(value)
  if (!url || !web(url)) return
  return url.toString()
}

export function isTrustedRendererUrl(value?: string, dev?: string) {
  const url = parse(value)
  if (!url || url.username || url.password) return false
  if (url.protocol === "oc:" && url.hostname === "renderer" && !url.port) return true

  const configured = parse(dev)
  if (!configured || !web(configured) || !web(url)) return false
  return url.origin === configured.origin
}

export function rendererCorsOrigins(dev?: string) {
  const configured = parse(dev)
  if (!configured || !web(configured)) return [rendererOrigin]
  return [rendererOrigin, configured.origin]
}
