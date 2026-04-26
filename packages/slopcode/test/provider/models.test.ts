import { expect, test } from "bun:test"
import path from "path"
import { Env } from "../../src/env"
import { Instance } from "../../src/project/instance"
import { ModelsDev } from "../../src/provider/models"
import { Provider } from "../../src/provider/provider"
import { tmpdir } from "../fixture/fixture"

function catalog(models: string[]) {
  return JSON.stringify({
    openai: {
      id: "openai",
      name: "OpenAI",
      env: ["OPENAI_API_KEY"],
      npm: "@ai-sdk/openai",
      models: Object.fromEntries(
        models.map((model) => [
          model,
          {
            id: model,
            name: model,
            release_date: "2026-04-23",
            attachment: true,
            reasoning: true,
            temperature: false,
            tool_call: true,
            limit: {
              context: 400000,
              output: 128000,
            },
            modalities: {
              input: ["text"],
              output: ["text"],
            },
            options: {},
          },
        ]),
      ),
    },
  })
}

test("provider list picks up custom catalog changes without restarting the instance", async () => {
  await using tmp = await tmpdir({
    config: {
      enabled_providers: ["openai"],
      provider: {
        openai: {
          whitelist: ["gpt-5.4", "gpt-5.5", "gpt-5.5-pro"],
        },
      },
    },
  })

  const models = path.join(tmp.path, "models.json")
  const prev = process.env["SLOPCODE_MODELS_PATH"]
  process.env["SLOPCODE_MODELS_PATH"] = models

  await Bun.write(models, catalog(["gpt-5.4"]))
  ModelsDev.Data.reset()

  try {
    await Instance.provide({
      directory: tmp.path,
      init: async () => {
        Env.set("OPENAI_API_KEY", "test-api-key")
      },
      fn: async () => {
        const first = await Provider.list()
        expect(first.openai.models["gpt-5.4"]).toBeDefined()
        expect(first.openai.models["gpt-5.5"]).toBeUndefined()

        await Bun.write(models, catalog(["gpt-5.5", "gpt-5.5-pro"]))

        const second = await Provider.list()
        expect(second.openai.models["gpt-5.4"]).toBeUndefined()
        expect(second.openai.models["gpt-5.5"]).toBeDefined()
        expect(second.openai.models["gpt-5.5-pro"]).toBeDefined()
      },
    })
  } finally {
    if (prev === undefined) delete process.env["SLOPCODE_MODELS_PATH"]
    else process.env["SLOPCODE_MODELS_PATH"] = prev
    ModelsDev.Data.reset()
  }
})
