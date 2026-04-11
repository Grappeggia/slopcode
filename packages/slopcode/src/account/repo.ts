import { and, eq, or } from "drizzle-orm"
import { Database } from "@/storage/db"
import { type AccountID, type Info, type OrgID } from "./schema"
import { normalizeServerUrl } from "./url"
import { AccountStateTable, AccountTable } from "./account.sql"

export type AccountRow = (typeof AccountTable)["$inferSelect"]

const STATE_ID = 1

const info = (row: AccountRow, active_org_id: string | null): Info => ({
  id: row.id,
  email: row.email,
  url: row.url,
  active_org_id,
})

const current = () =>
  Database.use((db) => {
    const state = db.select().from(AccountStateTable).where(eq(AccountStateTable.id, STATE_ID)).get()
    if (!state?.active_account_id) return
    const row = db.select().from(AccountTable).where(eq(AccountTable.id, state.active_account_id)).get()
    if (!row) return
    return info(row, state.active_org_id ?? null)
  })

export namespace AccountRepo {
  export const active = () => current()

  export const list = () => {
    const active = current()
    return Database.use((db) =>
      db
        .select()
        .from(AccountTable)
        .all()
        .map((row) => info(row, active?.id === row.id ? active.active_org_id : null)),
    )
  }

  export const remove = (accountID: AccountID) => {
    Database.transaction((db) => {
      db.update(AccountStateTable)
        .set({ active_account_id: null, active_org_id: null })
        .where(eq(AccountStateTable.active_account_id, accountID))
        .run()
      db.delete(AccountTable).where(eq(AccountTable.id, accountID)).run()
    })
  }

  export const use = (accountID: AccountID, orgID?: OrgID | null) => {
    Database.use((db) => {
      db.insert(AccountStateTable)
        .values({ id: STATE_ID, active_account_id: accountID, active_org_id: orgID ?? null })
        .onConflictDoUpdate({
          target: AccountStateTable.id,
          set: { active_account_id: accountID, active_org_id: orgID ?? null },
        })
        .run()
    })
  }

  export const getRow = (accountID: AccountID) =>
    Database.use((db) => db.select().from(AccountTable).where(eq(AccountTable.id, accountID)).get())

  export const persistToken = (input: {
    accountID: AccountID
    accessToken: string
    refreshToken: string
    expiry?: number | null
  }) => {
    Database.use((db) => {
      db.update(AccountTable)
        .set({
          access_token: input.accessToken,
          refresh_token: input.refreshToken,
          token_expiry: input.expiry ?? null,
        })
        .where(eq(AccountTable.id, input.accountID))
        .run()
    })
  }

  export const persistAccount = (input: {
    id: AccountID
    email: string
    url: string
    accessToken: string
    refreshToken: string
    expiry?: number | null
    orgID?: OrgID | null
  }) => {
    return Database.transaction((db) => {
      const url = normalizeServerUrl(input.url)
      const row = db
        .select()
        .from(AccountTable)
        .where(or(eq(AccountTable.id, input.id), and(eq(AccountTable.url, url), eq(AccountTable.email, input.email))))
        .get()
      const id = row?.id ?? input.id
      db.insert(AccountTable)
        .values({
          id,
          email: input.email,
          url,
          access_token: input.accessToken,
          refresh_token: input.refreshToken,
          token_expiry: input.expiry ?? null,
        })
        .onConflictDoUpdate({
          target: AccountTable.id,
          set: {
            email: input.email,
            url,
            access_token: input.accessToken,
            refresh_token: input.refreshToken,
            token_expiry: input.expiry ?? null,
          },
        })
        .run()
      db.insert(AccountStateTable)
        .values({ id: STATE_ID, active_account_id: id, active_org_id: input.orgID ?? null })
        .onConflictDoUpdate({
          target: AccountStateTable.id,
          set: { active_account_id: id, active_org_id: input.orgID ?? null },
        })
        .run()
      return id
    })
  }
}
