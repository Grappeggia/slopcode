export function isLoopbackUrl(input: string) {
  try {
    const url = new URL(input)
    if (url.protocol !== "http:" && url.protocol !== "https:") return false
    const host = url.hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "")
      .replace(/\.$/, "")
    if (host === "localhost" || host === "::1") return true
    return /^127(?:\.\d{1,3}){3}$/.test(host)
  } catch {
    return false
  }
}
