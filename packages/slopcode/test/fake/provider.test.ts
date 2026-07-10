import { expect } from "bun:test"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { Effect } from "effect"
import { Provider } from "@/provider/provider"
import { testEffect } from "../lib/effect"
import { ProviderTest } from "./provider"

const fake = ProviderTest.fake()
const it = testEffect(fake.layer)

it.effect("getModel fails unknown models with ProviderModelNotFoundError", () =>
  Effect.gen(function* () {
    const providerID = ProviderV2.ID.make("unknown-provider")
    const modelID = ModelV2.ID.make("unknown-model")
    const error = yield* Provider.use.getModel(providerID, modelID).pipe(Effect.flip)

    expect(error).toBeInstanceOf(Provider.ModelNotFoundError)
    expect(error).toMatchObject({ _tag: "ProviderModelNotFoundError", providerID, modelID })
  }),
)
