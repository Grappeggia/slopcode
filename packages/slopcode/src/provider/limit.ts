import { AsyncLocalStorage } from "async_hooks"
import type { ProviderMetadata } from "ai"

export namespace ProviderLimit {
  export type Info = {
    kind: "tokens" | "input" | "output"
    limit: number
    remaining: number
    consumed: number
    consumedPct: number
  }

  export type State = {
    value?: Info
  }

  const storage = new AsyncLocalStorage<State>()

  const keys = [
    {
      kind: "tokens" as const,
      limit: ["x-ratelimit-limit-tokens", "ratelimit-limit-tokens", "anthropic-ratelimit-tokens-limit"],
      remaining: ["x-ratelimit-remaining-tokens", "ratelimit-remaining-tokens", "anthropic-ratelimit-tokens-remaining"],
    },
    {
      kind: "input" as const,
      limit: [
        "x-ratelimit-limit-input-tokens",
        "ratelimit-limit-input-tokens",
        "anthropic-ratelimit-input-tokens-limit",
      ],
      remaining: [
        "x-ratelimit-remaining-input-tokens",
        "ratelimit-remaining-input-tokens",
        "anthropic-ratelimit-input-tokens-remaining",
      ],
    },
    {
      kind: "output" as const,
      limit: [
        "x-ratelimit-limit-output-tokens",
        "ratelimit-limit-output-tokens",
        "anthropic-ratelimit-output-tokens-limit",
      ],
      remaining: [
        "x-ratelimit-remaining-output-tokens",
        "ratelimit-remaining-output-tokens",
        "anthropic-ratelimit-output-tokens-remaining",
      ],
    },
  ]

  export function create(): State {
    return {}
  }

  export function provide<T>(state: State, fn: () => T) {
    return storage.run(state, fn)
  }

  export function capture(headers: Headers) {
    const state = storage.getStore()
    if (!state) return
    state.value = parse(headers)
  }

  export function metadata(input?: Info): ProviderMetadata | undefined {
    if (!input) return
    return {
      slopcode: {
        tokenLimit: input,
      },
    }
  }

  export function parse(input: Headers | Record<string, string | undefined>): Info | undefined {
    const headers = normalize(input)
    return keys
      .flatMap((item) => {
        const limit = first(headers, item.limit)
        const remaining = first(headers, item.remaining)
        if (limit === undefined || remaining === undefined || limit <= 0) return []
        const rest = clamp(remaining, 0, limit)
        const consumed = clamp(limit - rest, 0, limit)
        return [
          {
            kind: item.kind,
            limit,
            remaining: rest,
            consumed,
            consumedPct: clamp(Math.round((consumed / limit) * 100), 0, 100),
          } satisfies Info,
        ]
      })
      .sort((a, b) => b.consumedPct - a.consumedPct)[0]
  }

  function normalize(input: Headers | Record<string, string | undefined>) {
    if (input instanceof Headers) {
      return Object.fromEntries(Array.from(input.entries(), ([key, value]) => [key.toLowerCase(), value]))
    }
    return Object.fromEntries(Object.entries(input).map(([key, value]) => [key.toLowerCase(), value]))
  }

  function first(headers: Record<string, string | undefined>, keys: string[]) {
    for (const key of keys) {
      const raw = headers[key]
      if (!raw) continue
      const value = Number(raw)
      if (Number.isFinite(value)) return value
    }
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
  }
}
