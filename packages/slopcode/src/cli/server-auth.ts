type AuthInput = {
  username?: string
  password?: string
  env?: Record<string, string | undefined>
}

export function basicAuth(input: AuthInput = {}) {
  const env = input.env ?? process.env
  const password = input.password ?? env.SLOPCODE_SERVER_PASSWORD
  if (!password) return undefined
  const username = input.username ?? env.SLOPCODE_SERVER_USERNAME ?? "slopcode"
  return { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` }
}
