import { describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { SnowflakeCortex } from "../../src/provider/snowflake-cortex"
import { Filesystem } from "../../src/util/filesystem"
import { Auth } from "../../src/auth"

type FetchLike = (url: string | URL | Request, init?: RequestInit) => Promise<Response>

describe("Snowflake Cortex provider", () => {
  test("loads the fallback provider from config credentials", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Filesystem.write(
          path.join(dir, "slopcode.json"),
          JSON.stringify({
            $schema: "https://slopcode.dev/config.json",
            provider: {
              "snowflake-cortex": {
                options: {
                  account: "test-account",
                  apiKey: "test-pat",
                },
              },
            },
          }),
        )
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const providers = await Provider.list()
        expect(providers["snowflake-cortex"]).toBeDefined()
        expect(providers["snowflake-cortex"].options.baseURL).toBe(
          "https://test-account.snowflakecomputing.com/api/v2/cortex/v1",
        )
        expect(providers["snowflake-cortex"].options.apiKey).toBe("test-pat")
        expect(typeof providers["snowflake-cortex"].options.fetch).toBe("function")
        expect(providers["snowflake-cortex"].models["claude-sonnet-4-6"]).toBeDefined()
      },
    })
  })

  test("loads account metadata from stored API auth", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Filesystem.write(
          path.join(dir, "slopcode.json"),
          JSON.stringify({
            $schema: "https://slopcode.dev/config.json",
          }),
        )
      },
    })
    await Auth.set("snowflake-cortex", {
      type: "api",
      key: "stored-pat",
      metadata: {
        account: "stored-account",
      },
    })
    try {
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const providers = await Provider.list()
          expect(providers["snowflake-cortex"].options.baseURL).toBe(
            "https://stored-account.snowflakecomputing.com/api/v2/cortex/v1",
          )
          expect(providers["snowflake-cortex"].options.apiKey).toBe("stored-pat")
        },
      })
    } finally {
      await Auth.remove("snowflake-cortex")
    }
  })

  test("rewrites max_tokens to max_completion_tokens", async () => {
    const captured: RequestInit[] = []
    const upstream: FetchLike = async (_url, init) => {
      captured.push(init ?? {})
      return new Response("{}", { status: 200 })
    }
    await SnowflakeCortex.cortexFetch(upstream)("https://test", {
      method: "POST",
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1024 }),
    })
    const body = JSON.parse(captured[0].body as string)
    expect(body.max_completion_tokens).toBe(1024)
    expect(body.max_tokens).toBeUndefined()
  })

  test("treats 400 conversation complete as a stop response", async () => {
    const upstream: FetchLike = async () =>
      new Response(JSON.stringify({ message: "Conversation complete" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    const response = await SnowflakeCortex.cortexFetch(upstream)("https://test", {})
    expect(response.status).toBe(200)
    const data = (await response.json()) as { choices: { finish_reason: string }[] }
    expect(data.choices[0].finish_reason).toBe("stop")
  })

  test("passes through other 400 errors unchanged", async () => {
    const upstream: FetchLike = async () =>
      new Response(JSON.stringify({ message: "Invalid model" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    const response = await SnowflakeCortex.cortexFetch(upstream)("https://test", {})
    expect(response.status).toBe(400)
  })

  test("rewrites empty streaming roles to assistant", async () => {
    const chunk = `data: {"choices":[{"delta":{"role":"","content":"Hi"},"index":0}]}\n\n`
    const upstream: FetchLike = async () =>
      new Response(
        new ReadableStream({
          start(ctrl) {
            ctrl.enqueue(new TextEncoder().encode(chunk))
            ctrl.close()
          },
        }),
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      )
    const response = await SnowflakeCortex.cortexFetch(upstream)("https://test", {})
    const text = await response.text()
    expect(text).toContain('"role":"assistant"')
    expect(text).not.toContain('"role":""')
  })
})
