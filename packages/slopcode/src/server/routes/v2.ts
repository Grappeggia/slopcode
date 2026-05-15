import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Provider } from "../../provider/provider"
import { lazy } from "../../util/lazy"

const InstanceQuery = z.object({
  directory: z.string().optional().meta({ description: "Project directory for the request instance" }),
  workspace: z.string().optional().meta({ description: "Workspace ID for the request instance" }),
})

export const V2Routes = lazy(() =>
  new Hono()
    .get(
      "/model",
      describeRoute({
        summary: "List v2 models",
        description: "Retrieve available v2 models ordered by release date.",
        operationId: "v2.model.list",
        responses: {
          200: {
            description: "List of models",
            content: {
              "application/json": {
                schema: resolver(Provider.Model.array()),
              },
            },
          },
        },
      }),
      validator("query", InstanceQuery),
      async (c) => {
        const providers = await Provider.list()
        const models = Object.values(providers)
          .flatMap((provider) => Object.values(provider.models))
          .sort((a, b) => (b.release_date ?? "").localeCompare(a.release_date ?? "") || a.name.localeCompare(b.name))
        return c.json(models)
      },
    )
    .get(
      "/provider",
      describeRoute({
        summary: "List v2 providers",
        description: "Retrieve active v2 AI providers so clients can show provider availability and configuration.",
        operationId: "v2.provider.list",
        responses: {
          200: {
            description: "List of providers",
            content: {
              "application/json": {
                schema: resolver(Provider.Info.array()),
              },
            },
          },
        },
      }),
      validator("query", InstanceQuery),
      async (c) => c.json(Object.values(await Provider.list())),
    )
    .get(
      "/provider/:providerID",
      describeRoute({
        summary: "Get v2 provider",
        description: "Retrieve a single v2 AI provider so clients can inspect availability and endpoint settings.",
        operationId: "v2.provider.get",
        responses: {
          200: {
            description: "Provider",
            content: {
              "application/json": {
                schema: resolver(Provider.Info),
              },
            },
          },
          404: {
            description: "Provider not found",
          },
        },
      }),
      validator("param", z.object({ providerID: z.string() })),
      validator("query", InstanceQuery),
      async (c) => {
        const provider = (await Provider.list())[c.req.valid("param").providerID]
        if (!provider) throw new HTTPException(404, { message: "Provider not found" })
        return c.json(provider)
      },
    ),
)
