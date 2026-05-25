import { APICallError } from "ai"
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Server } from "../../src/server/server"
import { Log } from "../../src/util/log"
import { Provider } from "../../src/provider/provider"
import { LLM } from "../../src/session/llm"
import { Config } from "../../src/config/config"
import { resetAutocompleteBadModelCache, resolveAutocompleteModelCandidates } from "../../src/server/routes/session"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

function stream(parts: string[]) {
  return {
    textStream: (async function* () {
      for (const part of parts) yield part
    })(),
  } as unknown as Awaited<ReturnType<typeof LLM.stream>>
}

async function selectionWithFallback() {
  const providers = await Provider.list()
  const overrides = (await Config.get()).autocomplete?.provider_model_overrides ?? {}
  for (const provider of Object.values(providers)) {
    const models = Object.values(provider.models).filter(
      (item) => item.capabilities.input.text && item.capabilities.output.text,
    )
    for (const model of models) {
      const selected = {
        providerID: model.providerID,
        modelID: model.id,
      }
      const candidates = await resolveAutocompleteModelCandidates({
        selected,
        overrides,
      })
      if (candidates.length > 1) {
        return selected
      }
    }
  }
  throw new Error("No provider has autocomplete fallback candidates")
}

afterEach(() => {
  mock.restore()
  resetAutocompleteBadModelCache()
})

describe("session.autocomplete endpoint", () => {
  test("returns empty completion when disabled", async () => {
    await using tmp = await tmpdir({
      config: {
        autocomplete: {
          enabled: false,
        },
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const llm = spyOn(LLM, "stream")
        const model = await Provider.defaultModel()
        const session = await Session.create({})
        const app = Server.App()
        const response = await app.request(`/session/${session.id}/autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prefix: "write a",
          }),
        })

        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.completion).toBe("")
        expect(llm).not.toHaveBeenCalled()
      },
    })
  })

  test("returns empty completion for short prefixes", async () => {
    await using tmp = await tmpdir({
      config: {
        autocomplete: {
          min_prefix_chars: 20,
        },
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const llm = spyOn(LLM, "stream")
        const model = await Provider.defaultModel()
        const session = await Session.create({})
        const app = Server.App()
        const response = await app.request(`/session/${session.id}/autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prefix: "short",
          }),
        })

        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.completion).toBe("")
        expect(llm).not.toHaveBeenCalled()
      },
    })
  })

  test("returns empty completion for blank prefixes", async () => {
    await using tmp = await tmpdir({
      config: {
        autocomplete: {
          min_prefix_chars: 0,
        },
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const llm = spyOn(LLM, "stream")
        const model = await Provider.defaultModel()
        const session = await Session.create({})
        const app = Server.App()
        const response = await app.request(`/session/${session.id}/autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prefix: "   ",
          }),
        })

        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.completion).toBe("")
        expect(llm).not.toHaveBeenCalled()
      },
    })
  })

  test("streams completion and strips typed prefix", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        spyOn(LLM, "stream").mockImplementation(async () => stream(["Write detailed ", "tests for route"]))

        const model = await Provider.defaultModel()
        const session = await Session.create({})
        const app = Server.App()
        const response = await app.request(`/session/${session.id}/autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prefix: "write detailed ",
            agent: "build",
          }),
        })

        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.completion).toBe("tests for route")
      },
    })
  })

  test("returns first line only after normalization", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        spyOn(LLM, "stream").mockImplementation(async () => stream(["start prompt finish this\n", "and more"]))

        const model = await Provider.defaultModel()
        const session = await Session.create({})
        const app = Server.App()
        const response = await app.request(`/session/${session.id}/autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prefix: "start prompt ",
            agent: "build",
          }),
        })

        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.completion).toBe("finish this")
      },
    })
  })

  test("uses higher default timeout for autocomplete requests", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const timeout = spyOn(AbortSignal, "timeout")
        spyOn(LLM, "stream").mockImplementation(async () => stream(["continue"]))

        const model = await Provider.defaultModel()
        const session = await Session.create({})
        const app = Server.App()
        const response = await app.request(`/session/${session.id}/autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prefix: "draft prompt ",
            agent: "build",
          }),
        })

        expect(response.status).toBe(200)
        expect(timeout).toHaveBeenCalledWith(4000)
      },
    })
  })

  test("falls back to another model when first model is inaccessible", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const calls: string[] = []
        spyOn(LLM, "stream").mockImplementation(async (input) => {
          calls.push(`${input.model.providerID}/${input.model.id}`)
          if (calls.length === 1) {
            throw new APICallError({
              message: "model not found",
              url: "https://api.openai.com/v1/responses",
              requestBodyValues: {},
              statusCode: 404,
              responseHeaders: { "content-type": "application/json" },
              responseBody:
                '{"error":{"message":"The model `gpt-5.3-codex-spark` does not exist or you do not have access to it."}}',
              isRetryable: false,
            })
          }
          return stream(["continue"])
        })

        const model = await selectionWithFallback()
        const session = await Session.create({})
        const app = Server.App()
        const response = await app.request(`/session/${session.id}/autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prefix: "draft prompt ",
            agent: "build",
          }),
        })

        expect(response.status).toBe(200)
        expect(calls.length).toBe(2)
        expect(calls[0]).not.toBe(calls[1])
        const body = await response.json()
        expect(body.completion).toBe("continue")
        expect(body.model).toBe(calls[1])
      },
    })
  })

  test("does not fallback when error is unrelated to model access", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const calls: string[] = []
        spyOn(LLM, "stream").mockImplementation(async (input) => {
          calls.push(`${input.model.providerID}/${input.model.id}`)
          throw new APICallError({
            message: "rate limited",
            url: "https://api.openai.com/v1/responses",
            requestBodyValues: {},
            statusCode: 429,
            responseHeaders: { "content-type": "application/json" },
            responseBody: '{"error":{"message":"Rate limit exceeded"}}',
            isRetryable: true,
          })
        })

        const model = await selectionWithFallback()
        const session = await Session.create({})
        const app = Server.App()
        const response = await app.request(`/session/${session.id}/autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prefix: "draft prompt ",
            agent: "build",
          }),
        })

        expect(response.status).toBe(200)
        expect(calls.length).toBe(1)
        const body = await response.json()
        expect(body.completion).toBe("")
        expect(body.model).toBe(calls[0])
      },
    })
  })

  test("returns empty completion when generation throws", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        spyOn(LLM, "stream").mockImplementation(async () => {
          throw new Error("boom")
        })

        const model = await Provider.defaultModel()
        const session = await Session.create({})
        const app = Server.App()
        const response = await app.request(`/session/${session.id}/autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prefix: "draft prompt ",
            agent: "build",
          }),
        })

        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.completion).toBe("")
      },
    })
  })
})
