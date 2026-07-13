import { describe, expect, test } from "bun:test"
import { Auth } from "../../src/auth"
import { getUsage, normalizeUsage } from "../../src/plugin/openai/usage"

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
  test("normalizes snake_case usage without retaining the source body", () => {
    expect(normalizeUsage(payload, "dev@example.com", 123)).toEqual({
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

  test("preserves valid monetary strings and drops invalid values", () => {
    const usage = normalizeUsage({
      plan_type: "plus",
      credits: { has_credits: true, unlimited: false, balance: "9007199254740993.25" },
      spend_control: { individual_limit: { limit: "1e309", used: "30usd", remaining_percent: 70 } },
    })
    expect(usage).toMatchObject({
      credits: { hasCredits: true, unlimited: false, balance: "9007199254740993.25" },
    })
    expect(usage?.status === "oauth" && usage.spend).toBeUndefined()
  })

  test("calculates remaining percent without changing monetary strings", () => {
    expect(
      normalizeUsage({
        plan_type: "plus",
        spend_control: { individual_limit: { limit: "80.00", used: "20.00" } },
      }),
    ).toMatchObject({ spend: { limit: "80.00", used: "20.00", remainingPercent: 75 } })
  })

  test("accepts OAuth usage with absent or null windows", () => {
    expect(
      normalizeUsage(
        {
          plan_type: "team",
          rate_limit: { primary_window: null },
          credits: null,
          spend_control: null,
        },
        undefined,
        123,
      ),
    ).toEqual({ status: "oauth", plan: "team", capturedAt: 123 })
  })

  test("preserves partial windows with known usage", () => {
    expect(
      normalizeUsage(
        {
          plan_type: "plus",
          rate_limit: {
            primary_window: { used_percent: 40 },
            secondary_window: { limit_window_seconds: 18_000, reset_at: 2_000_000_000 },
          },
        },
        undefined,
        123,
      ),
    ).toEqual({ status: "oauth", plan: "plus", primary: { usedPercent: 40 }, capturedAt: 123 })
  })

  test("returns disconnected without fetching", async () => {
    let calls = 0
    expect(
      await getUsage(undefined, async () => {}, {
        fetch: async () => {
          calls++
          return new Response()
        },
      }),
    ).toEqual({ status: "disconnected" })
    expect(calls).toBe(0)
  })

  test("returns API key state without fetching", async () => {
    let calls = 0
    expect(
      await getUsage(new Auth.Api({ type: "api", key: "secret" }), async () => {}, {
        fetch: async () => {
          calls++
          return new Response()
        },
      }),
    ).toEqual({ status: "api_key" })
    expect(calls).toBe(0)
  })

  test("refreshes OAuth, persists it, and sends only required headers", async () => {
    const requests: Request[] = []
    const saved: Auth.Oauth[] = []
    const request = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init))
      if (String(input).endsWith("/oauth/token"))
        return Response.json({
          id_token: jwt({ email: "safe@example.com", chatgpt_account_id: "account-new" }),
          access_token: jwt({}),
          refresh_token: "refresh-new",
          expires_in: 3600,
        })
      return Response.json(payload)
    }
    const result = await getUsage(
      new Auth.Oauth({ type: "oauth", access: "expired", refresh: "refresh-old", expires: 0 }),
      async (auth) => void saved.push(auth),
      { fetch: request, issuer: "https://auth.test", endpoint: "https://usage.test", now: () => 1000 },
    )

    expect(result.status).toBe("oauth")
    expect(result.status === "oauth" && result.email).toBe("safe@example.com")
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ access: jwt({}), refresh: "refresh-new", accountId: "account-new" })
    expect(requests).toHaveLength(2)
    expect(requests[1].headers.get("authorization")).toBe(`Bearer ${jwt({})}`)
    expect(requests[1].headers.get("ChatGPT-Account-Id")).toBe("account-new")
    expect(requests[1].headers.get("originator")).toBe("slopcode")
    expect(requests[1].headers.get("user-agent")).toStartWith("slopcode/")
    expect(JSON.stringify(result)).not.toContain("refresh-new")
    expect(JSON.stringify(result)).not.toContain("account-new")
  })

  test("refreshes without an id token and falls back to access token claims", async () => {
    const saved: Auth.Oauth[] = []
    const access = jwt({ email: "safe@example.com", chatgpt_account_id: "account-access" })
    const result = await getUsage(
      new Auth.Oauth({ type: "oauth", access: "expired", refresh: "refresh-no-id", expires: 0 }),
      async (auth) => void saved.push(auth),
      {
        fetch: async (input) =>
          String(input).endsWith("/oauth/token")
            ? Response.json({ access_token: access, refresh_token: "refresh-next", expires_in: 3600 })
            : Response.json(payload),
        issuer: "https://auth.test",
        endpoint: "https://usage.test",
        now: () => 1000,
      },
    )

    expect(result.status === "oauth" && result.email).toBe("safe@example.com")
    expect(saved[0]).toMatchObject({ access, refresh: "refresh-next", accountId: "account-access" })
  })

  test("preserves the existing refresh token when refresh omits a replacement", async () => {
    const saved: Auth.Oauth[] = []
    const result = await getUsage(
      new Auth.Oauth({
        type: "oauth",
        access: "expired",
        refresh: "refresh-preserved",
        expires: 0,
        accountId: "account-old",
      }),
      async (auth) => void saved.push(auth),
      {
        fetch: async (input) =>
          String(input).endsWith("/oauth/token")
            ? Response.json({ access_token: jwt({}), expires_in: 3600 })
            : Response.json(payload),
        issuer: "https://auth.test",
        endpoint: "https://usage.test",
        now: () => 1000,
      },
    )

    expect(result.status).toBe("oauth")
    expect(saved[0]).toMatchObject({ refresh: "refresh-preserved", accountId: "account-old" })
  })

  test("requires an access token and clears failed refreshes for retry", async () => {
    const auth = new Auth.Oauth({ type: "oauth", access: "expired", refresh: "refresh-retry", expires: 0 })
    const saved: Auth.Oauth[] = []
    let calls = 0
    const options = {
      fetch: async (input: RequestInfo | URL) => {
        if (!String(input).endsWith("/oauth/token")) return Response.json(payload)
        calls++
        if (calls === 1) return Response.json({ refresh_token: "unused" })
        return Response.json({ access_token: jwt({}), refresh_token: "refresh-next" })
      },
      issuer: "https://auth.test",
      endpoint: "https://usage.test",
      now: () => 1000,
    }

    expect(await getUsage(auth, async (next) => void saved.push(next), options)).toEqual({ status: "unavailable" })
    expect((await getUsage(auth, async (next) => void saved.push(next), options)).status).toBe("oauth")
    expect(calls).toBe(2)
    expect(saved).toHaveLength(1)
  })

  test("maps upstream and malformed failures to unavailable", async () => {
    const auth = new Auth.Oauth({ type: "oauth", access: jwt({}), refresh: "refresh", expires: 2000 })
    expect(
      await getUsage(auth, async () => {}, { fetch: async () => new Response("no", { status: 503 }), now: () => 1000 }),
    ).toEqual({ status: "unavailable" })
    expect(
      await getUsage(auth, async () => {}, { fetch: async () => Response.json({ token: "raw" }), now: () => 1000 }),
    ).toEqual({ status: "unavailable" })
    expect(
      await getUsage(auth, async () => {}, {
        fetch: async () => {
          throw new Error("network")
        },
        now: () => 1000,
      }),
    ).toEqual({ status: "unavailable" })
  })
})
