import { expect, test } from "bun:test"
import { Credential } from "@slopcode-ai/core/credential"
import { Integration } from "@slopcode-ai/core/integration"
import { Location } from "@slopcode-ai/core/location"
import { LocationServiceMap } from "@slopcode-ai/core/location-layer"
import { Project } from "@slopcode-ai/core/project"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { OpenAIUsageConfig } from "../src/handlers/provider"
import { createRoutes } from "../src/routes"

function jwt(claims: Record<string, unknown>) {
  return `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`
}

const payload = { plan_type: "plus", rate_limit: { primary_window: { used_percent: 25 } } }
const integrationID = Integration.ID.make("openai")
const methodID = Integration.MethodID.make("chatgpt-browser")
const id = Credential.ID.create()

test("production V2 OpenAI usage route resolves location credentials", async () => {
  let saved: Credential.Stored[] = []
  let fail = false
  const updates: Partial<Pick<Credential.Stored, "label" | "value">>[] = []
  const credentials = Credential.Service.of({
    all: () => Effect.succeed(saved),
    list: (integration) => Effect.succeed(saved.filter((item) => item.integrationID === integration)),
    create: (input) =>
      Effect.sync(() => {
        const credential = new Credential.Stored({
          id,
          integrationID: input.integrationID,
          label: input.label ?? "default",
          value: input.value,
        })
        saved = [credential]
        return credential
      }),
    update: (_id, value) =>
      Effect.sync(() => {
        updates.push(value)
        saved = saved.map((item) => new Credential.Stored({ ...item, ...value }))
      }),
    remove: () => Effect.sync(() => void (saved = [])),
  })
  const location = Layer.mergeAll(
    Layer.succeed(
      Location.Service,
      Location.Service.of({
        directory: AbsolutePath.make("/tmp/provider-usage"),
        project: { id: Project.ID.make("project"), directory: AbsolutePath.make("/tmp/provider-usage") },
      }),
    ),
    Layer.succeed(Credential.Service, credentials),
    Layer.succeed(OpenAIUsageConfig, {
      fetch: async (input) => {
        if (String(input).endsWith("/oauth/token")) {
          return Response.json({ access_token: jwt({ chatgpt_account_id: "account-new" }), expires_in: 60 })
        }
        return fail ? new Response("raw-secret", { status: 503 }) : Response.json(payload)
      },
    }),
  )
  const locations = Layer.mock(LocationServiceMap, { get: () => location } as never)
  const app = HttpRouter.toWebHandler(
    createRoutes(undefined, undefined, locations).pipe(Layer.provide(HttpServer.layerServices)),
    { disableLogger: true },
  )
  const request = async () => {
    const response = await app.handler(new Request("http://localhost/api/provider/openai/usage"), undefined as never)
    expect(response.status).toBe(200)
    return (await response.json()) as { data: unknown }
  }

  try {
    expect((await request()).data).toEqual({ status: "disconnected" })

    saved = [
      new Credential.Stored({
        id,
        integrationID,
        label: "key",
        value: new Credential.Key({ type: "key", key: "key-secret" }),
      }),
    ]
    expect((await request()).data).toEqual({ status: "api_key" })

    saved = [
      new Credential.Stored({
        id,
        integrationID,
        label: "oauth",
        value: new Credential.OAuth({
          type: "oauth",
          methodID,
          refresh: "refresh-old",
          access: "expired",
          expires: 0,
          metadata: { accountID: "account-old", workspace: "work" },
        }),
      }),
    ]
    expect((await request()).data).toMatchObject({ status: "oauth", plan: "plus" })
    expect(updates).toHaveLength(1)
    expect(updates[0]?.value).toMatchObject({
      type: "oauth",
      methodID,
      refresh: "refresh-old",
      metadata: { accountID: "account-new", workspace: "work" },
    })

    fail = true
    const failed = (await request()).data
    expect(failed).toEqual({ status: "unavailable" })
    expect(JSON.stringify(failed)).not.toContain("secret")
  } finally {
    await app.dispose()
  }
})
