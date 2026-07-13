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
  readonly path: string
  readonly receive: (result: { code?: string; error?: true }) => Promise<boolean>
}
type Owned = { readonly server: Server; refs: number }

export interface Interface {
  readonly register: (input: {
    readonly redirect: string
    readonly state: string
    readonly receive: Registration["receive"]
  }) => Promise<{ readonly close: () => Promise<void> }>
  readonly close: () => Promise<void>
}
export interface Host {
  readonly lease: () => Promise<Interface>
  readonly close: () => Promise<void>
}

export class HostService extends Context.Service<HostService, Host>()("@slopcode/v2/MCPOAuthCallbackHost") {}
export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/MCPOAuthCallback") {}

export const hostLayer = Layer.effect(
  HostService,
  Effect.acquireRelease(Effect.promise(makeHost), (host) => Effect.promise(() => host.close())).pipe(
    Effect.map(HostService.of),
  ),
)
export const locationLayer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const host = yield* HostService
    return yield* Effect.acquireRelease(
      Effect.promise(() => host.lease()),
      (lease) => Effect.promise(() => lease.close()),
    ).pipe(Effect.map(Service.of))
  }),
)
export const layer = locationLayer.pipe(Layer.provide(hostLayer))

export async function make(host?: Host) {
  const owner = host ?? (await makeHost())
  const lease = await owner.lease()
  if (host) return lease
  return {
    ...lease,
    close: async () => {
      await lease.close()
      await owner.close()
    },
  }
}

export async function makeHost(): Promise<Host> {
  const servers = new Map<string, Owned>()
  const starting = new Map<string, Promise<Owned>>()
  const states = new Map<string, Registration>()
  const claims = new Set<string>()
  const leases = new Set<Set<() => Promise<void>>>()

  const start = (hostname: string, port: number, serverKey: string) =>
    new Promise<Owned>((resolve, reject) => {
      const listener = createServer(async (request, response) => {
        const requestUrl = new URL(request.url ?? "/", `http://${hostname}:${port}`)
        const values = (name: string) => requestUrl.searchParams.getAll(name)
        const state = values("state")
        const code = values("code")
        const error = values("error")
        const found = state.length === 1 ? states.get(`${serverKey}:${requestUrl.pathname}:${state[0]!}`) : undefined
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
        if (accepted) states.delete(found.key)
        response.writeHead(accepted && code.length === 1 ? 200 : 400, HEADERS)
        response.end(accepted && code.length === 1 ? SUCCESS : FAILURE)
      })
      listener.once("error", () => reject(new Error("MCP OAuth callback is unavailable")))
      listener.listen(port, hostname, () => resolve({ server: listener, refs: 0 }))
    })

  const lease = async (): Promise<Interface> => {
    const owned = new Set<() => Promise<void>>()
    leases.add(owned)
    const register: Interface["register"] = async (input) => {
      const url = callback(input.redirect)
      const serverKey = `${url.hostname}:${url.port}`
      const stateKey = `${serverKey}:${url.pathname}:${input.state}`
      if (states.has(stateKey) || claims.has(stateKey))
        throw new Error("MCP OAuth callback registration is unavailable")
      claims.add(stateKey)
      const current = servers.get(serverKey)
      const pending = current
        ? Promise.resolve(current)
        : (starting.get(serverKey) ?? start(url.hostname, Number(url.port), serverKey))
      if (!current && !starting.has(serverKey)) starting.set(serverKey, pending)
      const server = await pending
        .finally(() => starting.delete(serverKey))
        .catch((error) => {
          claims.delete(stateKey)
          throw error
        })
      if (!current) servers.set(serverKey, server)
      server.refs++
      states.set(stateKey, { key: stateKey, serverKey, path: url.pathname, receive: input.receive })
      claims.delete(stateKey)
      let closed = false
      const close = async () => {
        if (closed) return
        closed = true
        owned.delete(close)
        states.delete(stateKey)
        server.refs--
        if (server.refs > 0) return
        servers.delete(serverKey)
        await new Promise<void>((resolve) => server.server.close(() => resolve()))
      }
      owned.add(close)
      return { close }
    }
    return {
      register,
      close: async () => {
        leases.delete(owned)
        await Promise.all([...owned].map((close) => close()))
      },
    }
  }

  return {
    lease,
    close: async () => {
      await Promise.all([...leases].flatMap((owned) => [...owned].map((close) => close())))
      await Promise.all(
        [...servers.values()].map((entry) => new Promise<void>((resolve) => entry.server.close(() => resolve()))),
      )
      servers.clear()
      states.clear()
      claims.clear()
      leases.clear()
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
