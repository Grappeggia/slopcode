import { describe, expect, test } from "bun:test"
import path from "path"
import { Instance } from "../../src/project/instance"
import { ToolRegistry } from "../../src/tool/registry"
import { WebSearchTool } from "../../src/tool/websearch"
import { tmpdir } from "../fixture/fixture"

const projectRoot = path.join(import.meta.dir, "../..")

const ctx = {
  sessionID: "test",
  messageID: "message",
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => {},
  ask: async () => {},
}

async function withFetch(
  mockFetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
  fn: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockFetch as unknown as typeof fetch
  try {
    await fn()
  } finally {
    globalThis.fetch = originalFetch
  }
}

describe("tool.websearch", () => {
  test("uses Brave Search when a Brave API key is configured", async () => {
    const original = process.env.BRAVE_SEARCH_API_KEY
    process.env.BRAVE_SEARCH_API_KEY = "test-key"

    await withFetch(
      async (input, init) => {
        const url = new URL(typeof input === "string" ? input : input instanceof Request ? input.url : input.toString())
        expect(url.origin + url.pathname).toBe("https://api.search.brave.com/res/v1/web/search")
        expect(url.searchParams.get("q")).toContain("slopcode")
        expect(url.searchParams.get("q")).toContain("site:slopcode.dev")
        expect(url.searchParams.get("q")).toContain("site:github.com")
        expect(url.searchParams.get("count")).toBe("2")
        expect(url.searchParams.get("freshness")).toBe("pm")
        expect(url.searchParams.get("country")).toBe("us")
        expect(url.searchParams.get("search_lang")).toBe("en")
        expect(url.searchParams.get("safesearch")).toBe("strict")
        expect(url.searchParams.get("result_filter")).toBe("web")

        const headers = new Headers(init?.headers)
        expect(headers.get("X-Subscription-Token")).toBe("test-key")

        return new Response(
          JSON.stringify({
            web: {
              results: [
                {
                  title: "SlopCode Docs",
                  url: "https://www.slopcode.dev/",
                  description: "<strong>SlopCode</strong> docs",
                  age: "3 days ago",
                  profile: { name: "slopcode.dev" },
                },
                {
                  title: "teamslop/slopcode",
                  url: "https://github.com/teamslop/slopcode",
                  description: "GitHub repository",
                  profile: { name: "GitHub" },
                },
              ],
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        )
      },
      async () => {
        await Instance.provide({
          directory: projectRoot,
          fn: async () => {
            const websearch = await WebSearchTool.init()
            const result = await websearch.execute(
              {
                query: "slopcode",
                count: 2,
                freshness: "pm",
                country: "us",
                searchLang: "en",
                safeSearch: "strict",
                domains: ["slopcode.dev", "github.com"],
              },
              ctx,
            )

            expect(result.output).toContain("1. SlopCode Docs")
            expect(result.output).toContain("https://www.slopcode.dev/")
            expect(result.output).toContain("Snippet: SlopCode docs")
            expect(result.metadata.provider).toBe("Brave")
            expect(result.metadata.results).toBe(2)
          },
        })
      },
    )

    if (original === undefined) delete process.env.BRAVE_SEARCH_API_KEY
    else process.env.BRAVE_SEARCH_API_KEY = original
  })

  test("registry exposes websearch when a Brave API key is configured", async () => {
    const original = process.env.BRAVE_SEARCH_API_KEY
    process.env.BRAVE_SEARCH_API_KEY = "test-key"

    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tools = await ToolRegistry.tools({
          providerID: "anthropic",
          modelID: "claude-3-7-sonnet",
        })
        expect(tools.map((tool) => tool.id)).toContain("websearch")
      },
    })

    if (original === undefined) delete process.env.BRAVE_SEARCH_API_KEY
    else process.env.BRAVE_SEARCH_API_KEY = original
  })
})
