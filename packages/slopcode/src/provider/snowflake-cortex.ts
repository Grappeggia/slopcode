type FetchLike = (url: string | URL | Request, init?: RequestInit) => Promise<Response>

export namespace SnowflakeCortex {
  export const provider = {
    id: "snowflake-cortex",
    env: ["SNOWFLAKE_ACCOUNT", "SNOWFLAKE_CORTEX_PAT"],
    npm: "@ai-sdk/openai-compatible",
    api: "https://${SNOWFLAKE_ACCOUNT}.snowflakecomputing.com/api/v2/cortex/v1",
    name: "Snowflake Cortex",
    models: {
      "claude-sonnet-4-6": {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        family: "claude-sonnet",
        attachment: true,
        reasoning: true,
        temperature: true,
        tool_call: true,
        release_date: "2026-02-17",
        modalities: {
          input: ["text", "image", "pdf"],
          output: ["text"],
        },
        limit: {
          context: 1_000_000,
          output: 16_384,
        },
        options: {},
      },
      "claude-haiku-4-5": {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        family: "claude-haiku",
        attachment: true,
        reasoning: true,
        temperature: true,
        tool_call: true,
        release_date: "2025-10-15",
        modalities: {
          input: ["text", "image", "pdf"],
          output: ["text"],
        },
        limit: {
          context: 200_000,
          output: 16_384,
        },
        options: {},
      },
      "openai-gpt-5.2": {
        id: "openai-gpt-5.2",
        name: "GPT-5.2",
        family: "gpt",
        attachment: true,
        reasoning: true,
        temperature: false,
        tool_call: true,
        release_date: "2025-12-11",
        modalities: {
          input: ["text", "image"],
          output: ["text"],
        },
        limit: {
          context: 400_000,
          input: 272_000,
          output: 128_000,
        },
        options: {},
      },
      "openai-gpt-5": {
        id: "openai-gpt-5",
        name: "GPT-5",
        family: "gpt",
        attachment: true,
        reasoning: true,
        temperature: false,
        tool_call: true,
        release_date: "2025-08-07",
        modalities: {
          input: ["text", "image"],
          output: ["text"],
        },
        limit: {
          context: 400_000,
          input: 272_000,
          output: 128_000,
        },
        options: {},
      },
    },
  }

  export function cortexFetch(upstream: FetchLike = fetch) {
    return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      if (init?.body && typeof init.body === "string") {
        try {
          const body = JSON.parse(init.body)
          if ("max_tokens" in body) {
            body.max_completion_tokens = body.max_tokens
            delete body.max_tokens
            init = { ...init, body: JSON.stringify(body) }
          }
        } catch {}
      }

      const response = await upstream(url, init)

      if (!response.ok && response.status === 400) {
        try {
          const data = (await response.clone().json()) as Record<string, unknown>
          const message = String(data.message || data.error || "").toLowerCase()
          if (message.includes("conversation complete")) {
            return new Response(
              JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "", role: "assistant" } }] }),
              { status: 200, headers: new Headers({ "content-type": "application/json" }) },
            )
          }
        } catch {}
      }

      if (response.body && response.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = response.body.getReader()
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()
        const stream = new ReadableStream({
          async pull(ctrl) {
            const next = await reader.read()
            if (next.done) {
              ctrl.close()
              return
            }
            ctrl.enqueue(
              encoder.encode(
                decoder.decode(next.value, { stream: true }).replace(/"role"\s*:\s*""/g, '"role":"assistant"'),
              ),
            )
          },
          cancel() {
            reader.cancel()
          },
        })
        return new Response(stream, { headers: response.headers, status: response.status })
      }

      return response
    }
  }
}
