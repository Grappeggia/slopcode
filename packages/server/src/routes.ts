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

export function createRoutes(password?: string, host?: Layer.Layer<PluginPackage.Host>) {
  return HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
    Layer.provide(handlers),
    Layer.provide(authorizationLayer),
    Layer.provide(schemaErrorLayer),
    Layer.provide(
      password
        ? ServerAuth.Config.layer({ username: "slopcode", password: Option.some(password) })
        : ServerAuth.Config.defaultLayer,
    ),
    Layer.provide(host ? withPluginHost(host) : LocationServiceMap.layer),
    Layer.provide(Database.defaultLayer),
    Layer.provide(EventV2.defaultLayer),
    Layer.provide(FetchHttpClient.layer),
  )
}

export const routes = createRoutes()

export function createHostedRoutes(password: string | undefined, baseUrl: URL | (() => URL)) {
  let handler: ReturnType<typeof HttpRouter.toWebHandler>["handler"] | undefined
  const hosted = createRoutes(
    password,
    PluginServer.layer({
      baseUrl,
      fetch: (request) => {
        handler ??= HttpRouter.toWebHandler(hosted.pipe(Layer.provide(HttpServer.layerServices)), {
          disableLogger: true,
        }).handler
        const next = request instanceof Request ? new Request(request) : new Request(request)
        const authorization = ServerAuth.header(password ? { username: "slopcode", password } : undefined)
        if (authorization) next.headers.set("authorization", authorization)
        return handler(next, undefined as never)
      },
    }),
  )
  return hosted
}

export const webHandler = (options?: { readonly baseUrl?: URL; readonly password?: string }) =>
  HttpRouter.toWebHandler(
    createHostedRoutes(options?.password, options?.baseUrl ?? new URL("http://localhost")).pipe(
      Layer.provide(HttpServer.layerServices),
    ),
    { disableLogger: true },
  )
