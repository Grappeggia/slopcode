import z from "zod"
import { Auth } from "../auth"
import { Tool } from "./tool"
import DESCRIPTION from "./websearch.txt"
import { abortAfterAny } from "../util/abort"

const BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search"
const BRAVE_PROVIDER = "brave-search"
const BRAVE_DEFAULT_COUNT = 5
const BRAVE_MAX_COUNT = 20
const EXA_API_URL = "https://mcp.exa.ai/mcp"
const EXA_DEFAULT_COUNT = 8

const schema = z.object({
  query: z.string().describe("Web search query"),
  count: z
    .number()
    .int()
    .min(1)
    .max(BRAVE_MAX_COUNT)
    .optional()
    .describe("Number of search results to return (default: 5, max: 20)"),
  numResults: z
    .number()
    .int()
    .min(1)
    .max(BRAVE_MAX_COUNT)
    .optional()
    .describe("Deprecated alias for count"),
  freshness: z
    .enum(["pd", "pw", "pm", "py"])
    .optional()
    .describe("Optional recency filter: past day, week, month, or year"),
  country: z.string().optional().describe("Optional two-letter country code (for example 'us')"),
  searchLang: z.string().optional().describe("Optional search language code (for example 'en')"),
  safeSearch: z
    .enum(["off", "moderate", "strict"])
    .optional()
    .describe("Safe search level (default: moderate)"),
  domains: z
    .array(z.string())
    .max(10)
    .optional()
    .describe("Optional list of domains to prioritize using site: filters"),
  type: z
    .enum(["auto", "fast", "deep"])
    .optional()
    .describe("Exa fallback only: search type when Brave credentials are not configured"),
  livecrawl: z
    .enum(["fallback", "preferred"])
    .optional()
    .describe("Exa fallback only: live crawl mode when Brave credentials are not configured"),
  contextMaxCharacters: z
    .number()
    .optional()
    .describe("Exa fallback only: maximum context characters when Brave credentials are not configured"),
})

export async function hasBraveSearchCredential() {
  return Boolean(await braveKey())
}

export const WebSearchTool = Tool.define("websearch", async () => {
  return {
    get description() {
      return DESCRIPTION.replace("{{year}}", new Date().getFullYear().toString())
    },
    parameters: schema,
    async execute(params, ctx) {
      await ctx.ask({
        permission: "websearch",
        patterns: [params.query],
        always: ["*"],
        metadata: {
          query: params.query,
          count: params.count ?? params.numResults,
          freshness: params.freshness,
          country: params.country,
          searchLang: params.searchLang,
          safeSearch: params.safeSearch,
          domains: params.domains,
        },
      })

      const key = await braveKey()
      if (key) return searchBrave(params, key, ctx)
      return searchExa(params, ctx)
    },
  }
})

async function braveKey() {
  const env = process.env.BRAVE_SEARCH_API_KEY ?? process.env.BRAVE_API_KEY
  if (env) return env
  const auth = await Auth.get(BRAVE_PROVIDER)
  if (auth?.type === "api") return auth.key
}

function count(params: z.infer<typeof schema>, fallback: number) {
  return params.count ?? params.numResults ?? fallback
}

function query(params: z.infer<typeof schema>) {
  if (!params.domains?.length) return params.query
  const filters = params.domains
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `site:${item}`)
  if (!filters.length) return params.query
  if (filters.length === 1) return `${params.query} ${filters[0]}`
  return `${params.query} (${filters.join(" OR ")})`
}

function strip(input?: string) {
  if (!input) return undefined
  return input.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || undefined
}

function output(input: string, results: Array<{ title: string; url: string; description?: string; age?: string; source?: string }>) {
  if (!results.length) {
    return `No search results found for \"${input}\". Try a more specific query or relax any domain filters.`
  }

  return [
    `Web search results for \"${input}\":`,
    ...results.flatMap((item, index) =>
      [
        "",
        `${index + 1}. ${item.title}`,
        `   URL: ${item.url}`,
        item.description ? `   Snippet: ${item.description}` : undefined,
        item.age ? `   Age: ${item.age}` : undefined,
        item.source ? `   Source: ${item.source}` : undefined,
      ].filter((value): value is string => Boolean(value)),
    ),
  ].join("\n")
}

async function searchBrave(params: z.infer<typeof schema>, key: string, ctx: { abort: AbortSignal }) {
  const url = new URL(BRAVE_API_URL)
  url.searchParams.set("q", query(params))
  url.searchParams.set("count", String(count(params, BRAVE_DEFAULT_COUNT)))
  url.searchParams.set("result_filter", "web")
  url.searchParams.set("safesearch", params.safeSearch ?? "moderate")
  if (params.freshness) url.searchParams.set("freshness", params.freshness)
  if (params.country) url.searchParams.set("country", params.country.toLowerCase())
  if (params.searchLang) url.searchParams.set("search_lang", params.searchLang.toLowerCase())

  const { signal, clearTimeout } = abortAfterAny(25000, ctx.abort)
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": key,
    },
    signal,
  })
    .catch((error) => {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Search request timed out")
      }
      throw error
    })
    .finally(clearTimeout)

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Search error (${response.status}): ${text}`)
  }

  const data = (await response.json()) as {
    web?: {
      results?: Array<{
        title: string
        url: string
        description?: string
        age?: string
        profile?: {
          name?: string
        }
      }>
    }
  }
  const results = (data.web?.results ?? []).map((item) => ({
    title: strip(item.title) ?? item.url,
    url: item.url,
    description: strip(item.description),
    age: item.age,
    source: item.profile?.name,
  }))

  return {
    output: output(params.query, results),
    title: `Web search: ${params.query}`,
    metadata: {
      provider: "Brave",
      results: results.length,
    },
  }
}

async function searchExa(params: z.infer<typeof schema>, ctx: { abort: AbortSignal }) {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "web_search_exa",
      arguments: {
        query: query(params),
        type: params.type ?? "auto",
        numResults: count(params, EXA_DEFAULT_COUNT),
        livecrawl: params.livecrawl ?? "fallback",
        contextMaxCharacters: params.contextMaxCharacters,
      },
    },
  }

  const { signal, clearTimeout } = abortAfterAny(25000, ctx.abort)
  const response = await fetch(EXA_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  })
    .catch((error) => {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Search request timed out")
      }
      throw error
    })
    .finally(clearTimeout)

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Search error (${response.status}): ${text}`)
  }

  const text = await response.text()
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue
    const data = JSON.parse(line.substring(6)) as {
      result?: {
        content?: Array<{
          text: string
        }>
      }
    }
    const first = data.result?.content?.[0]?.text
    if (!first) continue
    return {
      output: first,
      title: `Web search: ${params.query}`,
      metadata: {
        provider: "Exa",
        results: count(params, EXA_DEFAULT_COUNT),
      },
    }
  }

  return {
    output: `No search results found for \"${params.query}\". Please try a different query.`,
    title: `Web search: ${params.query}`,
    metadata: {
      provider: "Exa",
      results: 0,
    },
  }
}
