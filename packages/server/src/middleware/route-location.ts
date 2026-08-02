import { WorkspaceV2 } from "@slopcode-ai/core/workspace"
import { Context, Layer } from "effect"
import { HttpApiMiddleware } from "effect/unstable/httpapi"

export class RouteLocationContext extends Context.Service<
  RouteLocationContext,
  {
    readonly directory: string
    readonly workspaceID?: WorkspaceV2.ID
  }
>()("@slopcode/HttpApiRouteLocationContext") {}

export class RouteLocationMiddleware extends HttpApiMiddleware.Service<
  RouteLocationMiddleware
>()("@slopcode/HttpApiRouteLocation") {}

export const routeLocationLayer = Layer.succeed(
  RouteLocationMiddleware,
  RouteLocationMiddleware.of((effect) => effect),
)
