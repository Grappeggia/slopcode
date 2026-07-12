export * as MCPOAuthCallback from "./oauth-callback"

import { createServer, type Server } from "node:http"
import { Context, Effect, Layer } from "effect"

const SUCCESS =
  "<!doctype html><title>Authorization complete</title><p>Authorization complete. You may close this window.</p>"
const FAILURE = "<!doctype html><title>Authorization failed</title><p>Authorization could not be completed.</p>"
const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; style-src 'none'; script-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
}

type Registration = {
  readonly key: string
  readonly serverKey: string
  readonly server: Owned
  readonly path: string
  readonly receive: (result: { code?: string; error?: true }) => Promise<boolean>
}

type Owned = { readonly server: Server; refs: number }
const host = {
  servers: new Map<string, Owned>(),
  starting: new Map<string, Promise<Owned>>(),
  states: new Map<string, Registration>(),
  claims: new Set<string>(),
}

export interface Interface extends Awaited<ReturnType<typeof make>> {}
export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/MCPOAuthCallback") {}
export const layer = Layer.effect(
  Service,
  Effect.acquireRelease(Effect.promise(make), (service) => Effect.promise(() => service.close())).pipe(
    Effect.map(Service.of),
  ),
)

export async function make() {
  const owned = new Set<Registration>()

  const register = async (input: {
    readonly redirect: string
    readonly state: string
    readonly receive: Registration["receive"]
  }) => {
    const url = callback(input.redirect)
    const serverKey = `${url.hostname}:${url.port}`
    const stateKey = `${serverKey}:${url.pathname}:${input.state}`
    if (host.states.has(stateKey) || host.claims.has(stateKey))
      throw new Error("MCP OAuth callback registration is unavailable")
    host.claims.add(stateKey)
    const current = host.servers.get(serverKey)
    const start = () =>
      new Promise<Owned>((resolve, reject) => {
        const listener = createServer(async (request, response) => {
          const requestUrl = new URL(request.url ?? "/", `http://${url.hostname}:${url.port}`)
          const values = (name: string) => requestUrl.searchParams.getAll(name)
          const state = values("state")
          const code = values("code")
          const error = values("error")
          const found =
            state.length === 1 ? host.states.get(`${serverKey}:${requestUrl.pathname}:${state[0]!}`) : undefined
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
          const accepted = await found.receive(code.length === 1 ? { code: code[0] } : { error: true }).catch(() => false)
          if (accepted) host.states.delete(found.key)
          response.writeHead(accepted && code.length === 1 ? 200 : 400, HEADERS)
          response.end(accepted && code.length === 1 ? SUCCESS : FAILURE)
        })
        listener.once("error", () => reject(new Error("MCP OAuth callback is unavailable")))
        listener.listen(Number(url.port), url.hostname, () => resolve({ server: listener, refs: 0 }))
      })
    const pending = current ? Promise.resolve(current) : (host.starting.get(serverKey) ?? start())
    if (!current && !host.starting.has(serverKey)) host.starting.set(serverKey, pending)
    const server = await pending.finally(() => host.starting.delete(serverKey)).catch((error) => {
      host.claims.delete(stateKey)
      throw error
    })
    if (!current) host.servers.set(serverKey, server)
    server.refs++
    const registration = { key: stateKey, serverKey, server, path: url.pathname, receive: input.receive }
    host.states.set(stateKey, registration)
    host.claims.delete(stateKey)
    owned.add(registration)
    let closed = false
    return {
      close: async () => {
        if (closed) return
        closed = true
        owned.delete(registration)
        host.states.delete(stateKey)
        server.refs--
        if (server.refs > 0) return
        host.servers.delete(serverKey)
        await new Promise<void>((resolve) => server.server.close(() => resolve()))
      },
    }
  }

  return {
    register,
    close: async () => {
      const entries = [...owned]
      await Promise.all(
        entries.map(async (registration) => {
          host.states.delete(registration.key)
          owned.delete(registration)
          const server = host.servers.get(registration.serverKey)
          if (!server || --server.refs > 0) return
          host.servers.delete(registration.serverKey)
          await new Promise<void>((resolve) => server.server.close(() => resolve()))
        }),
      )
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
