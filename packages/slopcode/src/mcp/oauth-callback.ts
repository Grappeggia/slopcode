import { createConnection } from "net"
import { createServer } from "http"
import { OAUTH_CALLBACK_PORT, parseRedirectUri } from "./oauth-provider"

const HTML_SUCCESS = `<!DOCTYPE html>
<html>
<head>
  <title>SlopCode - Authorization Successful</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #eee; }
    .container { text-align: center; padding: 2rem; }
    h1 { color: #4ade80; margin-bottom: 1rem; }
    p { color: #aaa; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authorization Successful</h1>
    <p>You can close this window and return to SlopCode.</p>
  </div>
  <script>setTimeout(() => window.close(), 2000);</script>
</body>
</html>`

const HTML_ERROR = (error: string) => `<!DOCTYPE html>
<html>
<head>
  <title>SlopCode - Authorization Failed</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #eee; }
    .container { text-align: center; padding: 2rem; }
    h1 { color: #f87171; margin-bottom: 1rem; }
    p { color: #aaa; }
    .error { color: #fca5a5; font-family: monospace; margin-top: 1rem; padding: 1rem; background: rgba(248,113,113,0.1); border-radius: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authorization Failed</h1>
    <p>An error occurred during authorization.</p>
    <div class="error">${error}</div>
  </div>
</body>
</html>`

interface PendingAuth {
  resolve: (code: string) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
  key?: string
}

const servers = new Map<number, { server: ReturnType<typeof createServer>; paths: Set<string> }>()
let transition = Promise.resolve()
const pendingAuths = new Map<string, PendingAuth>()
const pendingKeys = new Map<string, Set<string>>()

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

function cleanup(oauthState: string, pending: PendingAuth) {
  pendingAuths.delete(oauthState)
  if (!pending.key) return
  const states = pendingKeys.get(pending.key)
  states?.delete(oauthState)
  if (!states?.size) pendingKeys.delete(pending.key)
}

function handleRequest(
  req: import("http").IncomingMessage,
  res: import("http").ServerResponse,
  port: number,
  paths: Set<string>,
) {
  const url = new URL(req.url || "/", `http://localhost:${port}`)

  if (!paths.has(url.pathname)) {
    res.writeHead(404)
    res.end("Not found")
    return
  }

  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  // Enforce state parameter presence
  if (!state) {
    const errorMsg = "Missing required state parameter - potential CSRF attack"
    res.writeHead(400, { "Content-Type": "text/html" })
    res.end(HTML_ERROR(errorMsg))
    return
  }

  if (error) {
    const errorMsg = "OAuth authorization failed"
    if (pendingAuths.has(state)) {
      const pending = pendingAuths.get(state)!
      clearTimeout(pending.timeout)
      cleanup(state, pending)
      pending.reject(new Error(errorMsg))
    }
    res.writeHead(200, { "Content-Type": "text/html" })
    res.end(HTML_ERROR(errorMsg))
    return
  }

  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html" })
    res.end(HTML_ERROR("No authorization code provided"))
    return
  }

  // Validate state parameter
  if (!pendingAuths.has(state)) {
    const errorMsg = "Invalid or expired state parameter - potential CSRF attack"
    res.writeHead(400, { "Content-Type": "text/html" })
    res.end(HTML_ERROR(errorMsg))
    return
  }

  const pending = pendingAuths.get(state)!

  clearTimeout(pending.timeout)
  cleanup(state, pending)
  pending.resolve(code)

  res.writeHead(200, { "Content-Type": "text/html" })
  res.end(HTML_SUCCESS)
}

function serial<A>(run: () => Promise<A>) {
  const result = transition.then(run, run)
  transition = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

export function ensureRunning(redirectUri?: string): Promise<void> {
  return serial(async () => {
    const { port, path } = parseRedirectUri(redirectUri)

    const running = servers.get(port)
    if (running) {
      running.paths.add(path)
      return
    }
    if (await isPortInUse(port)) return

    const paths = new Set([path])
    const next = createServer((req, res) => handleRequest(req, res, port, paths))
    await new Promise<void>((resolve, reject) => {
      next.listen(port, resolve)
      next.on("error", reject)
    })
    servers.set(port, { server: next, paths })
  })
}

export function waitForCallback(oauthState: string, key?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (pendingAuths.has(oauthState)) {
      reject(new Error("OAuth state is already pending"))
      return
    }

    const timeout = setTimeout(() => {
      const pending = pendingAuths.get(oauthState)
      if (!pending) return
      cleanup(oauthState, pending)
      reject(new Error("OAuth callback timeout - authorization took too long"))
    }, CALLBACK_TIMEOUT_MS)

    pendingAuths.set(oauthState, { resolve, reject, timeout, key })
    if (key) {
      const states = pendingKeys.get(key) ?? new Set<string>()
      states.add(oauthState)
      pendingKeys.set(key, states)
    }
  })
}

export function cancelPending(key: string): void {
  for (const oauthState of [...(pendingKeys.get(key) ?? [])]) {
    const pending = pendingAuths.get(oauthState)
    if (!pending) continue
    clearTimeout(pending.timeout)
    cleanup(oauthState, pending)
    pending.reject(new Error("Authorization cancelled"))
  }
}

export async function isPortInUse(port: number = OAUTH_CALLBACK_PORT): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection(port, "127.0.0.1")
    socket.on("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.on("error", () => {
      resolve(false)
    })
  })
}

async function stopServer() {
  await Promise.all(
    [...servers.values()].map((entry) => new Promise<void>((resolve) => entry.server.close(() => resolve()))),
  )
  servers.clear()

  for (const pending of pendingAuths.values()) {
    clearTimeout(pending.timeout)
    pending.reject(new Error("OAuth callback server stopped"))
  }
  pendingAuths.clear()
  pendingKeys.clear()
}

export function stop(): Promise<void> {
  return serial(stopServer)
}

export function isRunning(): boolean {
  return servers.size > 0
}

export * as McpOAuthCallback from "./oauth-callback"
