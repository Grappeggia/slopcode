export async function sanitizeSafety(body: Record<string, unknown>, user: string | undefined, secret: string) {
  const { safety_identifier: _, user: _user, ...clean } = body
  if (!user) return clean
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`slopcode-managed-openai-safety-v1\0workspace\0${user}`),
  )
  const value = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
  return { ...clean, safety_identifier: `sc_${value}` }
}
