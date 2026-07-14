export * as SessionRunnerModel from "./model"

import { type Model } from "@slopcode-ai/llm"
import * as AnthropicMessages from "@slopcode-ai/llm/protocols/anthropic-messages"
import * as OpenAICompatibleChat from "@slopcode-ai/llm/protocols/openai-compatible-chat"
import * as OpenAIResponses from "@slopcode-ai/llm/protocols/openai-responses"
import { Auth, type AnyRoute } from "@slopcode-ai/llm/route"
import { Context, Effect, Layer, Option, Schema } from "effect"
import { produce } from "immer"
import { AgentV2 } from "../../agent"
import { Catalog } from "../../catalog"
import { Credential } from "../../credential"
import { ModelHarness } from "../../model-harness"
import { ModelV2 } from "../../model"
import { ModelRequest } from "../../model-request"
import { PluginBoot } from "../../plugin/boot"
import { ProviderV2 } from "../../provider"
import { SessionSchema } from "../schema"

export class ModelNotSelectedError extends Schema.TaggedErrorClass<ModelNotSelectedError>()(
  "SessionRunnerModel.ModelNotSelectedError",
  {
    sessionID: SessionSchema.ID,
  },
) {}

export class UnsupportedApiError extends Schema.TaggedErrorClass<UnsupportedApiError>()(
  "SessionRunnerModel.UnsupportedApiError",
  {
    providerID: ProviderV2.ID,
    modelID: ModelV2.ID,
    api: Schema.String,
  },
) {}

export type Error =
  | Catalog.ProviderNotFoundError
  | Catalog.ModelNotFoundError
  | ModelNotSelectedError
  | UnsupportedApiError
  | ModelHarness.IncompatibilityError
  | ModelHarness.UnsupportedReasoningError

export interface Interface {
  readonly resolve: (session: SessionSchema.Info) => Effect.Effect<Resolved, Error>
}

export interface Resolved {
  readonly model: Model
  readonly catalog: ModelV2.Info
  readonly harness: ModelHarness.Profile | undefined
  readonly reasoning: ModelHarness.Reasoning | undefined
  readonly openAIAccountID?: string
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/SessionRunnerModel") {}

export const layerWith = (resolve: Interface["resolve"]) => Layer.succeed(Service, Service.of({ resolve }))

/** Test seam for callers that only need to supply an executable model. */
export const layerWithModel = (resolve: (session: SessionSchema.Info) => Effect.Effect<Model, Error>) =>
  layerWith((session) =>
    resolve(session).pipe(
      Effect.map((model) => {
        const catalog = ModelV2.Info.empty(ProviderV2.ID.make(model.provider), ModelV2.ID.make(model.id))
        return { model, catalog, harness: ModelHarness.resolve(catalog), reasoning: undefined }
      }),
    ),
  )

const apiKey = (model: ModelV2.Info, provider?: ProviderV2.Info) => {
  const value = model.request.body.apiKey ?? model.api.settings?.apiKey
  if (typeof value === "string") return Auth.value(value)
  return provider?.enabled !== false && provider?.enabled.via === "env" ? Auth.config(provider.enabled.name) : undefined
}

export const authentication = (
  model: ModelV2.Info,
  provider: ProviderV2.Info | undefined,
  credential: Credential.Stored | undefined,
): ModelHarness.Route => {
  if ((provider?.id ?? model.providerID) !== ProviderV2.ID.openai || credential?.value.type !== "oauth") return "public"
  if (model.api.type !== "aisdk" || model.api.package !== "@ai-sdk/openai") return "public"
  if (model.api.url && model.api.url.replace(/\/$/, "") !== OpenAIResponses.DEFAULT_BASE_URL) return "public"
  return "codex"
}

const withDefaults = (model: ModelV2.Info, route: AnyRoute, harness?: ModelHarness.Profile) => {
  const options = model.request.options ?? {}
  const namespace = model.api.type === "aisdk" ? ModelRequest.namespace(model.api.package) : undefined
  const body = model.request.body
  const httpBody = Object.hasOwn(body, "apiKey")
    ? Object.fromEntries(Object.entries(body).filter(([key]) => key !== "apiKey"))
    : body
  return route.with({
    provider: model.providerID,
    endpoint:
      (harness?.route.id === "codex" && model.api.type === "aisdk" && model.api.package === "@ai-sdk/openai") ||
      model.api.url === undefined
        ? undefined
        : { baseURL: model.api.url },
    headers: model.request.headers,
    generation: model.request.generation,
    providerOptions: namespace && Object.keys(options).length > 0 ? { [namespace]: options } : undefined,
    http: { body: httpBody },
    limits: { context: harness?.route.context.limit ?? model.limit.context, output: model.limit.output },
  })
}

const withVariant = (model: ModelV2.Info, variantID: ModelV2.VariantID | undefined) => {
  const id = variantID === "default" || variantID === undefined ? model.request.variant : variantID
  const variant = model.variants.find((item) => item.id === id)
  if (!variant) return model
  return produce(model, (draft) => {
    ModelRequest.assign(draft.request, variant)
  })
}

const apiName = (model: ModelV2.Info) =>
  model.api.type === "aisdk" ? `${model.api.type}:${model.api.package}` : model.api.type

export const fromCatalogModel = (
  model: ModelV2.Info,
  provider?: ProviderV2.Info,
  harness?: ModelHarness.Profile,
  credential?: Credential.Stored,
): Effect.Effect<Model, UnsupportedApiError> => {
  const key = credential
    ? Auth.value(credential.value.type === "oauth" ? credential.value.access : credential.value.key)
    : apiKey(model, provider)
  if (model.api.type === "aisdk" && model.api.package === "@ai-sdk/openai") {
    const route =
      harness?.route.id === "codex"
        ? OpenAIResponses.route.with({
            id: "openai-responses-codex",
            capabilities: [...OpenAIResponses.route.capabilities, "sequential-cutoff"],
            endpoint: { baseURL: "https://chatgpt.com/backend-api/codex" },
            headers: credential?.value.metadata?.accountID
              ? { "ChatGPT-Account-Id": credential.value.metadata.accountID }
              : undefined,
          })
        : OpenAIResponses.route
    return Effect.succeed(
      withDefaults(model, route, harness)
        .with({ auth: key === undefined ? Auth.none : Auth.bearer(key) })
        .model({ id: model.api.id }),
    )
  }
  if (model.api.type === "aisdk" && model.api.package === "@ai-sdk/anthropic") {
    return Effect.succeed(
      withDefaults(model, AnthropicMessages.route, harness)
        .with({ auth: key === undefined ? Auth.none : Auth.header("x-api-key", key) })
        .model({ id: model.api.id }),
    )
  }
  if (model.api.type === "aisdk" && model.api.package === "@ai-sdk/openai-compatible" && model.api.url) {
    return Effect.succeed(
      withDefaults(model, OpenAICompatibleChat.route, harness)
        .with({ auth: key === undefined ? Auth.none : Auth.bearer(key) })
        .model({ id: model.api.id }),
    )
  }
  return Effect.fail(
    new UnsupportedApiError({
      providerID: model.providerID,
      modelID: model.id,
      api: apiName(model),
    }),
  )
}

export const resolve = (
  session: SessionSchema.Info,
  model: ModelV2.Info,
  provider?: ProviderV2.Info,
  variant = session.model?.variant,
  credential?: Credential.Stored,
) =>
  Effect.gen(function* () {
    const harness = ModelHarness.resolve(model, authentication(model, provider, credential))
    const resolved = yield* fromCatalogModel(withVariant(model, variant), provider, harness, credential)
    const openAIAccountID =
      credential?.value.type === "oauth" ? credential.value.metadata?.accountID : undefined
    if (!harness) return { model: resolved, catalog: model, harness, reasoning: undefined, openAIAccountID }
    yield* validate(harness, resolved)
    return {
      model: resolved,
      catalog: model,
      harness,
      reasoning: yield* ModelHarness.reasoning(harness, variant),
      openAIAccountID,
    }
  })

export const validate = (harness: ModelHarness.Profile, model: Model) =>
  ModelHarness.validate(harness, model.route.capabilities)

export const supported = (model: ModelV2.Info) =>
  model.api.type === "aisdk" &&
  (model.api.package === "@ai-sdk/openai" ||
    model.api.package === "@ai-sdk/anthropic" ||
    (model.api.package === "@ai-sdk/openai-compatible" && model.api.url !== undefined))

/** Resolves models from the catalog belonging to the current Location runtime. */
export const locationLayer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const catalog = yield* Catalog.Service
    const credentials = yield* Credential.Service
    const agents = yield* AgentV2.Service
    const boot = yield* PluginBoot.Service
    return Service.of({
      resolve: Effect.fn("SessionRunnerModel.resolve")(function* (session) {
        // Location plugins populate and filter the catalog asynchronously during layer startup.
        yield* boot.wait()
        const agent = yield* agents.select(session.agent)
        const agentModel = agent.info?.model
        const preferred = session.model
          ? {
              model: yield* catalog.model.get(session.model.providerID, session.model.id),
              variant: session.model.variant,
            }
          : agentModel
            ? Option.getOrUndefined(
                (yield* catalog.model.get(agentModel.providerID, agentModel.id).pipe(Effect.option)).pipe(
                  Option.filter((model) => model.enabled),
                  Option.map((model) => ({ model, variant: agentModel.variant })),
                ),
              )
            : undefined
        const fallback = Option.getOrUndefined(
          (yield* catalog.model.default()).pipe(
            Option.filter(supported),
            Option.map((model) => ({ model, variant: undefined })),
          ),
        )
        const available = (yield* catalog.model.available())
          .filter(supported)
          .map((model) => ({ model, variant: undefined }))[0]
        const selected = preferred ?? fallback ?? available
        if (!selected) return yield* new ModelNotSelectedError({ sessionID: session.id })
        const provider = yield* catalog.provider.get(selected.model.providerID)
        const enabled = provider.enabled
        const credential =
          enabled !== false && enabled.via === "credential"
            ? (yield* credentials.all()).find((item) => item.id === enabled.credentialID)
            : undefined
        return yield* resolve(
          session,
          selected.model,
          provider,
          selected.variant,
          credential,
        )
      }),
    })
  }),
)
