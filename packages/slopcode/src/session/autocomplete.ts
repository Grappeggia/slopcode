import { LayerNode } from "@slopcode-ai/core/effect/layer-node"
import { serviceUse } from "@slopcode-ai/core/effect/service-use"
import { ConfigAutocompleteV1 } from "@slopcode-ai/core/v1/config/autocomplete"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { Context, Duration, Effect, Layer } from "effect"
import { streamText, wrapLanguageModel, type ModelMessage } from "ai"
import { Provider } from "@/provider/provider"
import { ProviderTransform } from "@/provider/transform"

export const INSTRUCTIONS =
  "Continue the user's unfinished prompt. Return only the short continuation, on one line, without repeating the prefix, markdown, quotes, or explanation. Return an empty string when uncertain."

export type Settings = ConfigAutocompleteV1.Resolved

export type Input = {
  model: { providerID: ProviderV2.ID; modelID: ModelV2.ID }
  prefix: string
  settings: Settings
}

export type Output = {
  completion: string
  model: string
}

export function settings(input?: ConfigAutocompleteV1.Info): Settings {
  return ConfigAutocompleteV1.resolve(input)
}

export function messages(prefix: string): ModelMessage[] {
  return [
    { role: "system", content: INSTRUCTIONS },
    { role: "user", content: prefix },
  ]
}

function stripPrefix(input: string, prefix: string) {
  if (!prefix) return input
  if (!input.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())) return input
  return input.slice(prefix.length)
}

function spacing(prefix: string, completion: string) {
  if (!prefix || !completion) return completion
  if (!/\S/.test(prefix) || /\s$/.test(prefix) || /^\s/.test(completion)) return completion
  if (!/[A-Za-z0-9_]$/.test(prefix) || !/^[A-Za-z0-9_-]/.test(completion)) return completion
  return ` ${completion}`
}

export function normalize(input: { prefix: string; completion: string; max: number }) {
  const line = input.completion.replace(/\r\n?/g, "\n").split("\n", 1)[0] ?? ""
  const completion = stripPrefix(line, input.prefix).replace(/\s+$/g, "")
  if (!completion) return ""
  return spacing(input.prefix, completion).slice(0, input.max)
}

function text(model: Provider.Model | undefined): model is Provider.Model {
  return model?.capabilities.input.text === true && model.capabilities.output.text
}

export function route(input: {
  selected: Provider.Model
  override?: Provider.Model
  small?: Provider.Model
}): Provider.Model[] {
  const seen = new Set<string>()
  return [input.override, input.small, input.selected].filter((model): model is Provider.Model => {
    if (!text(model) || model.providerID !== input.selected.providerID || seen.has(model.id)) return false
    seen.add(model.id)
    return true
  })
}

export interface Interface {
  readonly complete: (input: Input) => Effect.Effect<Output, Provider.ModelNotFoundError>
}

export class Service extends Context.Service<Service, Interface>()("@slopcode/SessionAutocomplete") {}

export const use = serviceUse(Service)

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const provider = yield* Provider.Service

    const candidates = Effect.fn("SessionAutocomplete.candidates")(function* (input: Input) {
      const selected = yield* provider.getModel(input.model.providerID, input.model.modelID)
      const overrideID = input.settings.provider_model_overrides[selected.providerID]
      const override = overrideID
        ? yield* provider
            .getModel(selected.providerID, ModelV2.ID.make(overrideID))
            .pipe(Effect.catchTag("ProviderModelNotFoundError", () => Effect.succeed(undefined)))
        : undefined
      const small = yield* provider.getSmallModel(selected.providerID)
      return route({ selected, override, small })
    })

    const generate = Effect.fn("SessionAutocomplete.generate")(function* (
      model: Provider.Model,
      prefix: string,
      config: Settings,
    ) {
      const language = yield* provider.getLanguage(model)
      const result = yield* Effect.callback<string, unknown>((resume, signal) => {
        streamText({
          model: wrapLanguageModel({
            model: language,
            middleware: {
              specificationVersion: "v3",
              async transformParams(args) {
                // @ts-expect-error The transform bridges AI SDK model and provider message formats.
                args.params.prompt = ProviderTransform.message(args.params.prompt, model, model.options)
                return args.params
              },
            },
          }),
          messages: messages(prefix),
          maxOutputTokens: config.max_output_tokens,
          maxRetries: 0,
          abortSignal: signal,
          headers: model.headers,
          providerOptions: ProviderTransform.providerOptions(model, {
            ...ProviderTransform.smallOptions(model),
            ...model.options,
          }),
        }).text.then(
          (text) => resume(Effect.succeed(text)),
          (cause) => resume(Effect.fail(cause)),
        )
      })
      return normalize({ prefix, completion: result, max: config.max_completion_chars })
    })

    const complete = Effect.fn("SessionAutocomplete.complete")(function* (input: Input) {
      const fallback = `${input.model.providerID}/${input.model.modelID}`
      const prefix = input.prefix.slice(-input.settings.max_prefix_chars)
      if (!/\S/.test(prefix) || prefix.trim().length < input.settings.min_prefix_chars)
        return { completion: "", model: fallback }

      return yield* Effect.gen(function* () {
        const models = yield* candidates(input)
        const run = (index: number): Effect.Effect<Output, unknown> => {
          const model = models[index]
          if (!model) return Effect.succeed({ completion: "", model: fallback })
          return generate(model, prefix, input.settings).pipe(
            Effect.map((completion) => ({ completion, model: `${model.providerID}/${model.id}` })),
            Effect.catch(() => run(index + 1)),
          )
        }
        return yield* run(0)
      }).pipe(
        Effect.timeout(Duration.millis(input.settings.timeout_ms)),
        Effect.catch(() => Effect.succeed({ completion: "", model: fallback })),
      )
    })

    return Service.of({ complete })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Provider.defaultLayer))

export const node = LayerNode.make(layer, [Provider.node])

export * as SessionAutocomplete from "./autocomplete"
