import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import { DaemonAuth } from "@/daemon/auth"
import z from "zod"
import { DaemonRuntime } from "@/daemon/runtime"
import { lazy } from "@/util/lazy"

export const DaemonRoutes = lazy(() =>
  new Hono()
    .use(async (c, next) => {
      if (DaemonAuth.check(c.req.raw.headers)) return next()
      return c.json({ message: "Unauthorized" }, { status: 401 })
    })
    .get(
      "/status",
      describeRoute({
        summary: "Get daemon status",
        description: "Get local daemon status.",
        operationId: "daemon.status",
        responses: {
          200: {
            description: "Daemon status",
            content: {
              "application/json": {
                schema: resolver(DaemonRuntime.Status),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await DaemonRuntime.status())
      },
    )
    .post(
      "/shutdown",
      describeRoute({
        summary: "Shutdown daemon",
        description: "Shutdown the local daemon.",
        operationId: "daemon.shutdown",
        responses: {
          200: {
            description: "Daemon shutdown requested",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => {
        await DaemonRuntime.shutdown()
        return c.json(true)
      },
    ),
)
