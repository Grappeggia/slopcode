import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { LocationServiceMap, withPluginHost } from "@slopcode-ai/core/location-layer"
import { PluginPackage } from "@slopcode-ai/core/plugin/package"
import { FetchHttpClient, HttpRouter, HttpServer } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Layer, Option } from "effect"
import { Api } from "./api"
import { ServerAuth } from "./auth"
import { handlers } from "./handlers"
import { authorizationLayer } from "./middleware/authorization"
import { schemaErrorLayer } from "./middleware/schema-error"
import { PluginServer } from "./plugin"

export function createRoutes(
  password?: string,
  host?: Layer.Layer<PluginPackage.Host>,
  locations?: Layer.Layer<LocationServiceMap>,
) {
  return HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
    Layer.provide(handlers),
    Layer.provide(authorizationLayer),
    Layer.provide(schemaErrorLayer),
    Layer.provide(
      password
        ? ServerAuth.Config.layer({ username: "slopcode", password: Option.some(password) })
        : ServerAuth.Config.defaultLayer,
    ),
    Layer.provide(locations ?? (host ? withPluginHost(host) : LocationServiceMap.layer)),
    Layer.provide(Database.defaultLayer),
    Layer.provide(EventV2.defaultLayer),
    Layer.provide(FetchHttpClient.layer),
  )
}

export const routes = createRoutes()

export function webHandler(options?: { readonly baseUrl?: URL | (() => URL); readonly password?: string }) {
  let handler: ReturnType<typeof HttpRouter.toWebHandler>["handler"] | undefined
  const plugins = PluginServer.runtime({
    baseUrl: options?.baseUrl ?? new URL("http://localhost"),
    fetch: (request) => {
      if (!handler) return Promise.reject(new Error("Server handler is not initialized"))
      const next = request instanceof Request ? new Request(request) : new Request(request)
      const authorization = ServerAuth.header(
        options?.password ? { username: "slopcode", password: options.password } : undefined,
      )
      if (authorization) next.headers.set("authorization", authorization)
      return handler(next, undefined as never)
    },
  })
  const routes = createRoutes(options?.password, plugins.layer)
  const app = HttpRouter.toWebHandler(routes.pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true })
  handler = app.handler
  return Object.assign(app, { pluginHost: plugins, workspace: plugins.workspace })
}
