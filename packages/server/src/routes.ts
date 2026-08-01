import { Database } from "@slopcode-ai/core/database/database"
import { EventV2 } from "@slopcode-ai/core/event"
import { LocationServiceMap, withPluginHost } from "@slopcode-ai/core/location-layer"
import { PluginPackage } from "@slopcode-ai/core/plugin/package"
import { PermissionSaved } from "@slopcode-ai/core/permission/saved"
import { FetchHttpClient, HttpRouter, HttpServer } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import * as Socket from "effect/unstable/socket/Socket"
import { Layer, Option } from "effect"
import { Api } from "./api"
import { ServerAuth } from "./auth"
import { makeHandlers } from "./handlers"
import { authorizationLayer } from "./middleware/authorization"
import { routeLocationLayer } from "./middleware/route-location"
import { schemaErrorLayer } from "./middleware/schema-error"
import { PluginServer } from "./plugin"

type RouteRequirements =
  | HttpRouter.HttpRouter
  | HttpRouter.Request<"Error", unknown>
  | HttpRouter.Request<"GlobalError", unknown>
  | HttpRouter.Request<"Requires", unknown>
  | HttpRouter.Request<"GlobalRequires", never>

export function createRoutes(password?: string) {
  return HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
    Layer.provide(makeHandlers(database, saved)),
    Layer.provide(authorizationLayer),
    Layer.provide(routeLocationLayer),
    Layer.provide(schemaErrorLayer),
    Layer.provide(
      password
        ? ServerAuth.Config.layer({ username: "slopcode", password: Option.some(password) })
        : ServerAuth.Config.defaultLayer,
    ),
    Layer.provide(locations ?? (host ? withPluginHost(host) : LocationServiceMap.layer)),
    Layer.provide(database),
    Layer.provide(events),
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(Socket.layerWebSocketConstructorGlobal),
  )
}

export const routes = createRoutes()

export const webHandler = () =>
  HttpRouter.toWebHandler(
    routes.pipe(Layer.provide(HttpServer.layerServices)) as Layer.Layer<never, never, RouteRequirements>,
    { disableLogger: true },
  )
