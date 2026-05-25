import { describe, expect, test } from "bun:test"
import { Provider } from "../../src/provider/provider"
import { Instance } from "../../src/project/instance"
import { resolveAutocompleteModel } from "../../src/server/routes/session"
import { tmpdir } from "../fixture/fixture"
import { Log } from "../../src/util/log"

Log.init({ print: false })

function text(model: Provider.Model) {
  return model.capabilities.input.text && model.capabilities.output.text
}

async function sample() {
  const providers = await Provider.list()
  const provider = Object.values(providers).find((item) => Object.values(item.models).filter(text).length >= 2)
  if (!provider) throw new Error("No provider with enough text models")

  const models = Object.values(provider.models)
    .filter(text)
    .sort((a, b) => a.id.localeCompare(b.id))

  const selected = models[0]
  const alternative = models[1]
  if (!selected || !alternative) throw new Error("No model sample")

  return {
    providerID: provider.id,
    selected,
    alternative,
  }
}

describe("autocomplete model resolver", () => {
  test("uses provider override model when valid", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const info = await sample()
        const model = await resolveAutocompleteModel({
          selected: {
            providerID: info.providerID,
            modelID: info.selected.id,
          },
          overrides: {
            [info.providerID]: info.alternative.id,
          },
        })

        expect(model.providerID).toBe(info.providerID)
        expect(model.id).toBe(info.alternative.id)
      },
    })
  })

  test("accepts provider/model override values", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const info = await sample()
        const model = await resolveAutocompleteModel({
          selected: {
            providerID: info.providerID,
            modelID: info.selected.id,
          },
          overrides: {
            [info.providerID]: `${info.providerID}/${info.alternative.id}`,
          },
        })

        expect(model.providerID).toBe(info.providerID)
        expect(model.id).toBe(info.alternative.id)
      },
    })
  })

  test("uses selected model when override is null", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const info = await sample()
        const model = await resolveAutocompleteModel({
          selected: {
            providerID: info.providerID,
            modelID: info.selected.id,
          },
          overrides: {
            [info.providerID]: null,
          },
        })

        expect(model.providerID).toBe(info.providerID)
        expect(model.id).toBe(info.selected.id)
      },
    })
  })

  test("falls back safely when override model is unavailable", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const info = await sample()
        const model = await resolveAutocompleteModel({
          selected: {
            providerID: info.providerID,
            modelID: info.selected.id,
          },
          overrides: {
            [info.providerID]: "missing-model-id",
          },
        })

        expect(model.providerID).toBe(info.providerID)
        expect(model.capabilities.input.text).toBe(true)
        expect(model.capabilities.output.text).toBe(true)
      },
    })
  })
})
