import { describe, expect, test } from "bun:test"
import { getUsage, normalizeUsage, refreshOAuth } from "@slopcode-ai/core/plugin/provider/openai-usage"

function jwt(claims: Record<string, unknown>) {
  return `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`
}

const payload = {
  plan_type: "plus",
  rate_limit: {
    primary_window: { used_percent: 25, limit_window_seconds: 18_000, reset_at: 2_000_000_000 },
    secondary_window: { used_percent: 60, limit_window_seconds: 604_800, reset_at: 2_000_100_000 },
  },
  credits: { has_credits: true, unlimited: false, balance: "12.5" },
  spend_control: {
    individual_limit: { limit: "100", used: "30", remaining_percent: 70, reset_at: 2_000_200_000 },
  },
}

describe("OpenAI usage", () => {
  test("normalizes usage into the public schema without retaining source data", () => {
    expect(
      normalizeUsage(
        { ...payload, access_token: "access-secret", account_id: "account-secret" },
        "dev@example.com",
        123,
      ),
    ).toEqual({
      status: "oauth",
      plan: "plus",
      email: "dev@example.com",
      primary: { usedPercent: 25, windowMinutes: 300, resetAt: 2_000_000_000 },
      secondary: { usedPercent: 60, windowMinutes: 10_080, resetAt: 2_000_100_000 },
      credits: { hasCredits: true, unlimited: false, balance: "12.5" },
      spend: { limit: "100", used: "30", remainingPercent: 70, resetAt: 2_000_200_000 },
      capturedAt: 123,
    })
  })

  test("supports disconnected and API key credentials without fetching", async () => {
    let calls = 0
    const options = {
      fetch: async () => {
        calls++
        return new Response()
      },
    }
    expect(await getUsage(undefined, async () => {}, options)).toEqual({ status: "disconnected" })
    expect(await getUsage({ type: "key", key: "key-secret" }, async () => {}, options)).toEqual({ status: "api_key" })
    expect(calls).toBe(0)
  })

  test("maps timeout, network, HTTP, and schema failures to unavailable", async () => {
    const auth = { type: "oauth" as const, access: jwt({}), refresh: "refresh-secret", expires: 2000 }
    expect(
      await getUsage(auth, async () => {}, {
        fetch: async (_input, init) =>
          new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
        now: () => 1000,
        timeout: 5,
      }),
    ).toEqual({ status: "unavailable" })
    expect(
      await getUsage(auth, async () => {}, {
        fetch: async () => {
          throw new Error("network with refresh-secret")
        },
        now: () => 1000,
      }),
    ).toEqual({ status: "unavailable" })
    expect(
      await getUsage(auth, async () => {}, {
        fetch: async () => new Response("raw-secret", { status: 503 }),
        now: () => 1000,
      }),
    ).toEqual({ status: "unavailable" })
    expect(
      await getUsage(auth, async () => {}, {
        fetch: async () => Response.json({ access_token: "raw-secret" }),
        now: () => 1000,
      }),
    ).toEqual({ status: "unavailable" })
  })

  test("returns only safe fields", async () => {
    const result = await getUsage(
      {
        type: "oauth",
        access: jwt({ email: "safe@example.com" }),
        refresh: "refresh-secret",
        expires: 2000,
        accountID: "account-secret",
      },
      async () => {},
      {
        fetch: async () => Response.json({ ...payload, raw: "raw-secret", refresh_token: "refresh-secret" }),
        now: () => 1000,
      },
    )
    expect(result.status).toBe("oauth")
    expect(JSON.stringify(result)).not.toContain("refresh-secret")
    expect(JSON.stringify(result)).not.toContain("account-secret")
    expect(JSON.stringify(result)).not.toContain("raw-secret")
  })
})

describe("OpenAI OAuth refresh", () => {
  test("rotates refresh tokens and preserves them when rotation is omitted", async () => {
    const auth = {
      type: "oauth" as const,
      access: "expired",
      refresh: "refresh-old",
      expires: 0,
      accountID: "account-old",
    }
    const rotated = await refreshOAuth(auth, {
      fetch: async () =>
        Response.json({
          id_token: jwt({ chatgpt_account_id: "account-new" }),
          access_token: "access-new",
          refresh_token: "refresh-new",
          expires_in: 60,
        }),
      issuer: "https://auth.test",
      now: () => 1000,
    })
    expect(rotated.auth).toEqual({
      type: "oauth",
      access: "access-new",
      refresh: "refresh-new",
      expires: 61_000,
      accountID: "account-new",
    })

    const preserved = await refreshOAuth(
      { ...auth, refresh: "refresh-preserve" },
      {
        fetch: async () => Response.json({ access_token: "access-next" }),
        issuer: "https://auth.test",
        now: () => 2000,
      },
    )
    expect(preserved.auth).toMatchObject({ refresh: "refresh-preserve", accountID: "account-old" })
  })

  test("shares one refresh request while every caller persists into its own store", async () => {
    let release: (() => void) | undefined
    const ready = new Promise<void>((resolve) => {
      release = resolve
    })
    let start: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      start = resolve
    })
    let refreshes = 0
    const request = async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/oauth/token")) {
        refreshes++
        start!()
        await ready
        return Response.json({ access_token: jwt({}), refresh_token: "refresh-new", expires_in: 60 })
      }
      return Response.json(payload)
    }
    const first: unknown[] = []
    const second: unknown[] = []
    const options = { fetch: request, issuer: "https://auth.test", endpoint: "https://usage.test", now: () => 1000 }
    const one = getUsage(
      { type: "oauth", access: "expired", refresh: "refresh-shared", expires: 0, accountID: "account-one" },
      async (auth) => void first.push(auth),
      options,
    )
    const two = getUsage(
      { type: "oauth", access: "expired", refresh: "refresh-shared", expires: 0, accountID: "account-two" },
      async (auth) => void second.push(auth),
      options,
    )
    await started
    expect(refreshes).toBe(1)
    release!()
    expect((await one).status).toBe("oauth")
    expect((await two).status).toBe("oauth")
    expect(first).toEqual([
      { type: "oauth", access: jwt({}), refresh: "refresh-new", expires: 61_000, accountID: "account-one" },
    ])
    expect(second).toEqual([
      { type: "oauth", access: jwt({}), refresh: "refresh-new", expires: 61_000, accountID: "account-two" },
    ])
  })
})
