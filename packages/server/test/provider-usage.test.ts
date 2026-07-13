import { expect, test } from "bun:test"
import { Credential } from "@slopcode-ai/core/credential"
import { Integration } from "@slopcode-ai/core/integration"
import { Location } from "@slopcode-ai/core/location"
import { Project } from "@slopcode-ai/core/project"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi"
import { ProviderGroup } from "../src/groups/provider"
import { LocationMiddleware, response } from "../src/groups/location"
import { openAIUsage } from "../src/handlers/provider"
import type { Options } from "@slopcode-ai/core/plugin/provider/openai-usage"

function jwt(claims: Record<string, unknown>) {
  return `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`
}

const payload = { plan_type: "plus", rate_limit: { primary_window: { used_percent: 25 } } }
const integrationID = Integration.ID.make("openai")
const methodID = Integration.MethodID.make("chatgpt-browser")
const id = Credential.ID.create()

test("V2 OpenAI usage route handles credentials and safe failures", async () => {
  let saved: Credential.Stored[] = []
  let updates: Partial<Pick<Credential.Stored, "label" | "value">>[] = []
  let options: Options = {}
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
  const Api = HttpApi.make("provider-usage-test").add(ProviderGroup)
  const handlers = HttpApiBuilder.group(Api, "server.provider", (group) =>
    group
      .handle("provider.list", () => response(Effect.succeed([])))
      .handle("provider.get", () => Effect.die("unused"))
      .handle("provider.openaiUsage", () => response(openAIUsage(credentials, options))),
  )
  const location = Location.Service.of({
    directory: AbsolutePath.make("/tmp/provider-usage"),
    project: { id: Project.ID.make("project"), directory: AbsolutePath.make("/tmp/provider-usage") },
  })
  const middleware = Layer.succeed(
    LocationMiddleware,
    LocationMiddleware.of((effect) => Effect.provideService(effect, Location.Service, location) as never),
  )
  const app = HttpRouter.toWebHandler(
    HttpApiBuilder.layer(Api).pipe(
      Layer.provide(handlers),
      Layer.provide(middleware),
      Layer.provide(HttpServer.layerServices),
    ),
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
          refresh: "refresh-secret",
          access: jwt({ email: "safe@example.com" }),
          expires: 2000,
          metadata: { accountID: "account-secret", workspace: "work" },
        }),
      }),
    ]
    options = { fetch: async () => Response.json(payload), now: () => 1000 }
    expect((await request()).data).toEqual({
      status: "oauth",
      plan: "plus",
      email: "safe@example.com",
      primary: { usedPercent: 25 },
      capturedAt: 1000,
    })

    saved = [
      new Credential.Stored({
        ...saved[0],
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
    updates = []
    options = {
      issuer: "https://auth.test",
      endpoint: "https://usage.test",
      now: () => 1000,
      fetch: async (input) =>
        String(input).endsWith("/oauth/token")
          ? Response.json({ access_token: jwt({ chatgpt_account_id: "account-new" }), expires_in: 60 })
          : Response.json(payload),
    }
    expect((await request()).data).toMatchObject({ status: "oauth", plan: "plus" })
    expect(updates).toHaveLength(1)
    expect(updates[0]?.value).toMatchObject({
      type: "oauth",
      methodID,
      refresh: "refresh-old",
      metadata: { accountID: "account-new", workspace: "work" },
    })

    options = { fetch: async () => new Response("raw-secret", { status: 503 }), now: () => 1000 }
    const failed = (await request()).data
    expect(failed).toEqual({ status: "unavailable" })
    expect(JSON.stringify(failed)).not.toContain("secret")
  } finally {
    await app.dispose()
  }
})
