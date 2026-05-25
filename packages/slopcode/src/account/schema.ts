import z from "zod"

export type AccountID = string
export type OrgID = string
export type AccessToken = string
export type RefreshToken = string

export const Info = z.object({
  id: z.string(),
  email: z.string().email(),
  url: z.string().url(),
  active_org_id: z.string().nullable().default(null),
})
export type Info = z.infer<typeof Info>

export const Org = z.object({
  id: z.string(),
  name: z.string(),
})
export type Org = z.infer<typeof Org>

export type AccountOrgs = {
  account: Info
  orgs: readonly Org[]
}

export type ActiveOrg = {
  account: Info
  org: Org
}

export type Login = {
  code: string
  user: string
  url: string
  server: string
  expiry: number
  interval: number
}

export type PollResult =
  | { type: "success"; email: string }
  | { type: "pending" }
  | { type: "slow" }
  | { type: "expired" }
  | { type: "denied" }
  | { type: "error"; cause: string }
