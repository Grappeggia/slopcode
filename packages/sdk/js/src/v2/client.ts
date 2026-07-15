export * from "./gen/types.gen.js"
export type { FileSystemEntry as LocationFileSystemEntry } from "./gen/types.gen.js"

import { createClient } from "./gen/client/client.gen.js"
import { type Config } from "./gen/client/types.gen.js"
import { SlopcodeClient } from "./gen/sdk.gen.js"
import { wrapClientError } from "../error-interceptor.js"
export { type Config as SlopcodeClientConfig, SlopcodeClient }

function pick(value: string | null, fallback?: string, encode?: (value: string) => string) {
  if (!value) return
  if (!fallback) return value
  if (value === fallback) return fallback
  if (encode && value === encode(fallback)) return fallback
  return value
}

function rewrite(request: Request, values: { directory?: string; workspace?: string }) {
  if (request.method !== "GET" && request.method !== "HEAD") return request

  const url = new URL(request.url)
  let changed = false

  for (const [name, key] of [
    ["x-slopcode-directory", "directory"],
    ["x-slopcode-workspace", "workspace"],
  ] as const) {
    const value = pick(
      request.headers.get(name),
      key === "directory" ? values.directory : values.workspace,
      key === "directory" ? encodeURIComponent : undefined,
    )
    if (!value) continue
    for (const query of url.pathname.startsWith("/api/") ? [key, `location[${key}]`] : [key]) {
      if (!url.searchParams.has(query)) {
        url.searchParams.set(query, value)
      }
    }
    changed = true
  }

  if (!changed) return request

  const next = new Request(url, request)
  next.headers.delete("x-slopcode-directory")
  next.headers.delete("x-slopcode-workspace")
  return next
}

export function createSlopcodeClient(config?: Config & { directory?: string; experimental_workspaceID?: string }) {
  if (!config?.fetch) {
    const customFetch: any = (req: any) => {
      // @ts-ignore
      req.timeout = false
      return fetch(req)
    }
    config = {
      ...config,
      fetch: customFetch,
    }
  }

  if (config?.directory) {
    config.headers = {
      ...config.headers,
      "x-slopcode-directory": encodeURIComponent(config.directory),
    }
  }

  if (config?.experimental_workspaceID) {
    config.headers = {
      ...config.headers,
      "x-slopcode-workspace": config.experimental_workspaceID,
    }
  }

  const client = createClient(config)
  client.interceptors.request.use((request) =>
    rewrite(request, {
      directory: config?.directory,
      workspace: config?.experimental_workspaceID,
    }),
  )
  client.interceptors.response.use((response) => {
    const contentType = response.headers.get("content-type")
    if (contentType === "text/html")
      throw new Error("Request is not supported by this version of SlopCode Server (Server responded with text/html)")

    return response
  })
  client.interceptors.error.use(wrapClientError)
  const sdk = new SlopcodeClient({ client })
  const complete = sdk.session.autocomplete.bind(sdk.session)
  const autocomplete: typeof sdk.session.autocomplete = (parameters, options) => {
    const requestID = parameters.requestID ?? crypto.randomUUID()
    const signal = options?.signal
    if (!signal) return complete({ ...parameters, requestID }, options)

    const ctrl = new AbortController()
    const abort = () => {
      ctrl.abort(signal.reason)
      sdk.session
        .abortAutocomplete({
          sessionID: parameters.sessionID,
          requestID,
          directory: parameters.directory,
          workspace: parameters.workspace,
        })
        .then(
          () => undefined,
          () => undefined,
        )
    }
    if (signal.aborted) abort()
    else signal.addEventListener("abort", abort, { once: true })

    const result = complete({ ...parameters, requestID }, { ...options, signal: ctrl.signal })
    const cleanup = () => signal.removeEventListener("abort", abort)
    result.then(cleanup, cleanup)
    return result
  }
  sdk.session.autocomplete = autocomplete
  return sdk
}
