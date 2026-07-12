export * as MCPOAuthCallback from "./oauth-callback"

import { createServer, type Server } from "node:http"

const SUCCESS = "<!doctype html><title>Authorization complete</title><p>Authorization complete. You may close this window.</p>"
const FAILURE = "<!doctype html><title>Authorization failed</title><p>Authorization could not be completed.</p>"
const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; style-src 'none'; script-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
}

type Registration = { readonly path: string; readonly receive: (result: { code?: string; error?: true }) => Promise<void> }

export async function make() {
  const servers = new Map<number, { server: Server; refs: number }>()
  const states = new Map<string, Registration>()

  const register = async (input: {
    readonly redirect: string
    readonly state: string
    readonly receive: Registration["receive"]
  }) => {
    const url = callback(input.redirect)
    if (states.has(input.state)) throw new Error("MCP OAuth callback registration is unavailable")
    const current = servers.get(Number(url.port))
    const owned =
      current ??
      (await new Promise<{ server: Server; refs: number }>((resolve, reject) => {
        const server = createServer(async (request, response) => {
          const requestUrl = new URL(request.url ?? "/", `http://${url.hostname}:${url.port}`)
          const values = (name: string) => requestUrl.searchParams.getAll(name)
          const state = values("state")
          const code = values("code")
          const error = values("error")
          const found = state.length === 1 ? states.get(state[0]!) : undefined
          const valid =
            request.method === "GET" &&
            found?.path === requestUrl.pathname &&
            code.length + error.length === 1 &&
            code.length <= 1 &&
            error.length <= 1
          if (!valid) {
            response.writeHead(400, HEADERS)
            response.end(FAILURE)
            return
          }
          states.delete(state[0]!)
          await found.receive(code.length === 1 ? { code: code[0] } : { error: true }).catch(() => undefined)
          response.writeHead(code.length === 1 ? 200 : 400, HEADERS)
          response.end(code.length === 1 ? SUCCESS : FAILURE)
        })
        server.once("error", () => reject(new Error("MCP OAuth callback is unavailable")))
        server.listen(Number(url.port), url.hostname, () => resolve({ server, refs: 0 }))
      }))
    if (!current) servers.set(Number(url.port), owned)
    owned.refs++
    states.set(input.state, { path: url.pathname, receive: input.receive })
    let closed = false
    return {
      close: async () => {
        if (closed) return
        closed = true
        states.delete(input.state)
        owned.refs--
        if (owned.refs > 0) return
        servers.delete(Number(url.port))
        await new Promise<void>((resolve) => owned.server.close(() => resolve()))
      },
    }
  }

  return {
    register,
    close: async () => {
      states.clear()
      await Promise.all([...servers.values()].map((entry) => new Promise<void>((resolve) => entry.server.close(() => resolve()))))
      servers.clear()
    },
  }
}

function callback(value: string) {
  const fail = () => {
    throw new Error("MCP OAuth redirect is invalid")
  }
  const url = (() => {
    try {
      return new URL(value)
    } catch {
      return fail()
    }
  })()
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "[::1]"
  if (url.protocol !== "http:" || !loopback || !url.port || url.username || url.password || url.hash || url.search)
    return fail()
  return url
}
