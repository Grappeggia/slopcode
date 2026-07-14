import { Catalog } from "@slopcode-ai/core/catalog"
import { PluginBoot } from "@slopcode-ai/core/plugin/boot"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { Credential } from "@slopcode-ai/core/credential"
import { Integration } from "@slopcode-ai/core/integration"
import {
  getUsage,
  type Credential as OpenAICredential,
  type Options as OpenAIUsageOptions,
} from "@slopcode-ai/core/plugin/provider/openai-usage"
import { Context, Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { ProviderNotFoundError, ServiceUnavailableError } from "../errors"
import { response } from "../groups/location"

const catalogUnavailable = new ServiceUnavailableError({
  message: "Provider catalog is unavailable",
  service: "catalog",
})

export const OpenAIUsageConfig = Context.Reference<OpenAIUsageOptions>("@slopcode/server/OpenAIUsageConfig", {
  defaultValue: () => ({}),
})

export function openAIUsage(credentials: Credential.Interface, options: OpenAIUsageOptions = {}) {
  return Effect.gen(function* () {
    const stored = (yield* credentials.list(Integration.ID.make("openai")))[0]
    const input: OpenAICredential = !stored
      ? undefined
      : stored.value.type === "key"
        ? { type: "key", key: stored.value.key }
        : {
            type: "oauth",
            refresh: stored.value.refresh,
            access: stored.value.access,
            expires: stored.value.expires,
            ...(stored.value.metadata?.accountID && { accountID: stored.value.metadata.accountID }),
          }
    return yield* Effect.promise(() =>
      getUsage(
        input,
        async (next) => {
          if (!stored || stored.value.type !== "oauth") return
          await Effect.runPromise(
            credentials.update(stored.id, {
              value: new Credential.OAuth({
                type: "oauth",
                methodID: stored.value.methodID,
                refresh: next.refresh,
                access: next.access,
                expires: next.expires,
                metadata: next.accountID
                  ? { ...stored.value.metadata, accountID: next.accountID }
                  : stored.value.metadata,
              }),
            }),
          )
        },
        options,
      ),
    )
  })
}

export const ProviderHandler = HttpApiBuilder.group(Api, "server.provider", (handlers) =>
  Effect.gen(function* () {
    return handlers
      .handle(
        "provider.list",
        Effect.fn(function* () {
          const catalog = yield* Catalog.Service
          const pluginBoot = yield* PluginBoot.Service
          yield* pluginBoot.wait().pipe(Effect.catchDefect(() => Effect.fail(catalogUnavailable)))
          return yield* response(
            catalog.provider.available().pipe(Effect.map((providers) => providers.map(ProviderV2.publicInfo))),
          )
        }),
      )
      .handle(
        "provider.get",
        Effect.fn(function* (ctx) {
          const catalog = yield* Catalog.Service
          const pluginBoot = yield* PluginBoot.Service
          yield* pluginBoot.wait().pipe(Effect.catchDefect(() => Effect.fail(catalogUnavailable)))
          return yield* response(
            catalog.provider.get(ctx.params.providerID).pipe(Effect.map(ProviderV2.publicInfo)),
          ).pipe(
            Effect.catchTag("CatalogV2.ProviderNotFound", (error) =>
              Effect.fail(
                new ProviderNotFoundError({
                  providerID: error.providerID,
                  message: `Provider not found: ${error.providerID}`,
                }),
              ),
            ),
          )
        }),
      )
      .handle(
        "provider.openaiUsage",
        Effect.fn(function* () {
          const credentials = yield* Credential.Service
          return yield* response(openAIUsage(credentials, yield* OpenAIUsageConfig))
        }),
      )
  }),
)
