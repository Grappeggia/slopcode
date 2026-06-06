import { describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { Filesystem } from "../../src/util/filesystem"

async function withProvider(provider: Record<string, unknown>, fn: () => Promise<void>) {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Filesystem.write(
        path.join(dir, "slopcode.json"),
        JSON.stringify({
          $schema: "https://slopcode.dev/config.json",
          provider,
        }),
      )
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn,
  })
}

describe("bundled provider SDKs", () => {
  test("creates Alibaba language models without runtime package install", async () => {
    await withProvider(
      {
        alibaba: {
          options: {
            apiKey: "test-key",
          },
          models: {
            "qwen-plus": {
              provider: {
                npm: "@ai-sdk/alibaba",
                api: "https://dashscope.aliyuncs.com/compatible-mode/v1",
              },
              tool_call: true,
              limit: {
                context: 128_000,
                output: 8_192,
              },
            },
          },
        },
      },
      async () => {
        expect(await Provider.getLanguage(await Provider.getModel("alibaba", "qwen-plus"))).toBeDefined()
      },
    )
  })

  test("creates Venice language models without runtime package install", async () => {
    await withProvider(
      {
        venice: {
          options: {
            apiKey: "test-key",
          },
          models: {
            "llama-3.3-70b": {
              provider: {
                npm: "venice-ai-sdk-provider",
                api: "https://api.venice.ai/api/v1",
              },
              tool_call: true,
              limit: {
                context: 128_000,
                output: 8_192,
              },
            },
          },
        },
      },
      async () => {
        expect(await Provider.getLanguage(await Provider.getModel("venice", "llama-3.3-70b"))).toBeDefined()
      },
    )
  })
})
