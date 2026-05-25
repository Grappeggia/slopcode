import z from "zod"
import { AccountRepo } from "./repo"
import {
  type AccountID,
  type AccountOrgs,
  type ActiveOrg,
  type Info,
  type Login,
  Org,
  type OrgID,
  type PollResult,
} from "./schema"
import { fallbackAccountID, normalizeServerUrl } from "./url"

const clientID = "slopcode-cli"
const eager = 5 * 60 * 1000

const deviceAuth = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri_complete: z.string(),
  expires_in: z.number(),
  interval: z.number(),
})

const deviceTokenSuccess = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().optional(),
})

const deviceTokenError = z.object({
  error: z.string(),
  error_description: z.string().optional(),
})

const userInfo = z.object({
  id: z.string().optional(),
  email: z.string().email(),
})

const remoteConfig = z.object({
  config: z.record(z.string(), z.unknown()),
})

const fresh = (expiry: number | null | undefined) => typeof expiry === "number" && expiry > Date.now() + eager

const request = async (input: string | URL, init?: RequestInit) => fetch(input, init).catch(() => undefined)

const fetchUser = async (url: string, access: string) => {
  const res = await request(`${url}/api/user`, {
    headers: { Authorization: `Bearer ${access}`, Accept: "application/json" },
  })
  if (!res?.ok) return
  const json = await res.json().catch(() => undefined)
  const parsed = userInfo.safeParse(json)
  if (!parsed.success) return
  return parsed.data
}

const fetchOrgs = async (url: string, access: string) => {
  const res = await request(`${url}/api/orgs`, {
    headers: { Authorization: `Bearer ${access}`, Accept: "application/json" },
  })
  if (!res?.ok) return []
  const json = await res.json().catch(() => [])
  const parsed = z.array(Org).safeParse(json)
  if (!parsed.success) return []
  return parsed.data
}

const refreshWithDevice = async (row: NonNullable<ReturnType<typeof AccountRepo.getRow>>) => {
  const res = await request(`${row.url}/auth/device/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
      client_id: clientID,
    }),
  })
  if (!res?.ok) return
  const json = await res.json().catch(() => undefined)
  return deviceTokenSuccess.safeParse(json).data
}

const refreshWithOauth = async (row: NonNullable<ReturnType<typeof AccountRepo.getRow>>) => {
  const res = await request(`${row.url}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
      client_id: clientID,
    }).toString(),
  })
  if (!res?.ok) return
  const json = await res.json().catch(() => undefined)
  return deviceTokenSuccess.safeParse(json).data
}

const refresh = async (row: NonNullable<ReturnType<typeof AccountRepo.getRow>>) => {
  const json = (await refreshWithDevice(row)) ?? (await refreshWithOauth(row))
  if (!json) return
  const expiry = json.expires_in ? Date.now() + json.expires_in * 1000 : null
  AccountRepo.persistToken({
    accountID: row.id,
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? row.refresh_token,
    expiry,
  })
  return json.access_token
}

const resolve = async (accountID: AccountID) => {
  const row = AccountRepo.getRow(accountID)
  if (!row) return
  if (fresh(row.token_expiry)) return { row, access: row.access_token }
  const access = await refresh(row)
  if (!access) return
  return { row: AccountRepo.getRow(accountID) ?? row, access }
}

export * from "./schema"
export * from "./url"

export namespace Account {
  export const active = () => AccountRepo.active()

  export const list = () => AccountRepo.list()

  export const remove = (accountID: AccountID) => AccountRepo.remove(accountID)

  export const use = (accountID: AccountID, orgID?: OrgID | null) => AccountRepo.use(accountID, orgID)

  export const token = async (accountID: AccountID) => {
    const hit = await resolve(accountID)
    return hit?.access
  }

  export const orgs = async (accountID: AccountID) => {
    const hit = await resolve(accountID)
    if (!hit) return []
    return fetchOrgs(hit.row.url, hit.access)
  }

  export const activeOrg = async (): Promise<ActiveOrg | undefined> => {
    const account = active()
    if (!account?.active_org_id) return
    const org = (await orgs(account.id)).find((item) => item.id === account.active_org_id)
    if (!org) return
    return { account, org }
  }

  export const orgsByAccount = async (): Promise<readonly AccountOrgs[]> => {
    const rows = list()
    return Promise.all(rows.map(async (account) => ({ account, orgs: await orgs(account.id).catch(() => []) })))
  }

  export const config = async (accountID: AccountID, orgID: OrgID) => {
    const hit = await resolve(accountID)
    if (!hit) return
    const res = await request(`${hit.row.url}/api/config`, {
      headers: {
        Authorization: `Bearer ${hit.access}`,
        Accept: "application/json",
        "x-org-id": orgID,
      },
    })
    if (!res?.ok) return
    const json = await res.json().catch(() => undefined)
    const parsed = remoteConfig.safeParse(json)
    if (!parsed.success) return
    return parsed.data.config
  }

  export const login = async (server: string): Promise<Login> => {
    const url = normalizeServerUrl(server)
    const res = await request(`${url}/auth/device/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientID }),
    })
    if (!res?.ok) throw new Error(`Failed to start device login: ${res?.status ?? "network error"}`)
    const json = await res.json().catch(() => undefined)
    const parsed = deviceAuth.safeParse(json)
    if (!parsed.success) throw new Error("Failed to decode device login response")
    const verify = parsed.data.verification_uri_complete.startsWith("http")
      ? parsed.data.verification_uri_complete
      : `${url}${parsed.data.verification_uri_complete}`
    return {
      code: parsed.data.device_code,
      user: parsed.data.user_code,
      url: verify,
      server: url,
      expiry: Date.now() + parsed.data.expires_in * 1000,
      interval: parsed.data.interval * 1000,
    }
  }

  export const poll = async (input: Login): Promise<PollResult> => {
    const res = await request(`${input.server}/auth/device/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: input.code,
        client_id: clientID,
      }),
    })
    if (!res) return { type: "error", cause: "network error" }
    const json = await res.json().catch(() => undefined)
    const err = deviceTokenError.safeParse(json)
    if (err.success) {
      if (err.data.error === "authorization_pending") return { type: "pending" }
      if (err.data.error === "slow_down") return { type: "slow" }
      if (err.data.error === "expired_token") return { type: "expired" }
      if (err.data.error === "access_denied") return { type: "denied" }
      return { type: "error", cause: err.data.error_description || err.data.error }
    }

    const ok = deviceTokenSuccess.safeParse(json)
    if (!ok.success) return { type: "error", cause: "invalid token response" }

    const user = await fetchUser(input.server, ok.data.access_token)
    if (!user) return { type: "error", cause: "failed to fetch user" }
    const orgs = await fetchOrgs(input.server, ok.data.access_token).catch(() => [])
    const id = user.id ?? fallbackAccountID(input.server, user.email)
    AccountRepo.persistAccount({
      id,
      email: user.email,
      url: input.server,
      accessToken: ok.data.access_token,
      refreshToken: ok.data.refresh_token,
      expiry: ok.data.expires_in ? Date.now() + ok.data.expires_in * 1000 : null,
      orgID: orgs[0]?.id ?? null,
    })
    return { type: "success", email: user.email }
  }
}
