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
  key: string
  endpoint: Endpoint
}

export interface Endpoint {
  host: string
  port: number
  path: string
  key: string
}

interface CallbackServer {
  server: ReturnType<typeof createServer>
  paths: Map<string, number>
  pending: number
}

const servers = new Map<string, CallbackServer>()
let transition = Promise.resolve()
const pendingAuths = new Map<string, PendingAuth>()
const pendingKeys = new Map<string, Set<string>>()

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

function cleanup(oauthState: string, pending: PendingAuth) {
  pendingAuths.delete(oauthState)
  const states = pendingKeys.get(pending.key)
  states?.delete(oauthState)
  if (!states?.size) pendingKeys.delete(pending.key)
  queueMicrotask(() => void release(pending.endpoint))
}

function handleRequest(
  req: import("http").IncomingMessage,
  res: import("http").ServerResponse,
  port: number,
  paths: Map<string, number>,
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

export function ensureRunning(redirectUri?: string): Promise<Endpoint> {
  return serial(async () => {
    const { host, port, path } = parseRedirectUri(redirectUri)
    const key = JSON.stringify([host, port])
    const endpoint = { host, port, path, key }

    const running = servers.get(key)
    if (running) {
      if (!running.paths.has(path)) running.paths.set(path, 0)
      return endpoint
    }

    const paths = new Map([[path, 0]])
    const next = createServer((req, res) => handleRequest(req, res, port, paths))
    await new Promise<void>((resolve, reject) => {
      const fail = () => reject(new Error("MCP OAuth callback address is unavailable"))
      next.once("error", fail)
      next.listen(port, host, () => {
        next.off("error", fail)
        resolve()
      })
    })
    servers.set(key, { server: next, paths, pending: 0 })
    return endpoint
  })
}

export function waitForCallback(
  oauthState: string,
  key: string,
  endpoint: Endpoint,
  timeoutMs = CALLBACK_TIMEOUT_MS,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (pendingAuths.has(oauthState)) {
      reject(new Error("OAuth state is already pending"))
      return
    }
    const server = servers.get(endpoint.key)
    if (!server || !server.paths.has(endpoint.path)) {
      reject(new Error("OAuth callback listener is unavailable"))
      return
    }

    const timeout = setTimeout(() => {
      const pending = pendingAuths.get(oauthState)
      if (!pending) return
      cleanup(oauthState, pending)
      reject(new Error("OAuth callback timeout - authorization took too long"))
    }, timeoutMs)

    server.pending++
    server.paths.set(endpoint.path, (server.paths.get(endpoint.path) ?? 0) + 1)
    pendingAuths.set(oauthState, { resolve, reject, timeout, key, endpoint })
    const states = pendingKeys.get(key) ?? new Set<string>()
    states.add(oauthState)
    pendingKeys.set(key, states)
  })
}

export function cancelPending(oauthState: string): void {
  const pending = pendingAuths.get(oauthState)
  if (!pending) return
  clearTimeout(pending.timeout)
  cleanup(oauthState, pending)
  pending.reject(new Error("Authorization cancelled"))
}

export function cancelByKey(key: string): void {
  for (const oauthState of [...(pendingKeys.get(key) ?? [])]) {
    cancelPending(oauthState)
  }
}

export async function isPortInUse(port: number = OAUTH_CALLBACK_PORT, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection(port, host)
    socket.on("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.on("error", () => {
      resolve(false)
    })
  })
}

function release(endpoint: Endpoint) {
  return serial(async () => {
    const entry = servers.get(endpoint.key)
    if (!entry) return
    entry.pending = Math.max(0, entry.pending - 1)
    const count = Math.max(0, (entry.paths.get(endpoint.path) ?? 0) - 1)
    if (count) entry.paths.set(endpoint.path, count)
    else entry.paths.delete(endpoint.path)
    if (entry.pending) return
    servers.delete(endpoint.key)
    await new Promise<void>((resolve) => entry.server.close(() => resolve()))
  })
}

async function stopServer() {
  const pending = [...pendingAuths.values()]
  pendingAuths.clear()
  pendingKeys.clear()
  for (const entry of pending) {
    clearTimeout(entry.timeout)
    entry.reject(new Error("OAuth callback server stopped"))
  }

  await Promise.all(
    [...servers.values()].map((entry) => new Promise<void>((resolve) => entry.server.close(() => resolve()))),
  )
  servers.clear()
}

export function stop(): Promise<void> {
  return serial(stopServer)
}

export function isRunning(): boolean {
  return servers.size > 0
}

export * as McpOAuthCallback from "./oauth-callback"
