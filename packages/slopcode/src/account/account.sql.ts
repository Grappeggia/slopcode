import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { type AccessToken, type AccountID, type OrgID, type RefreshToken } from "./schema"
import { Timestamps } from "../storage/schema.sql"

export const AccountTable = sqliteTable(
  "account",
  {
    id: text().$type<AccountID>().primaryKey(),
    email: text().notNull(),
    url: text().notNull(),
    access_token: text().$type<AccessToken>().notNull(),
    refresh_token: text().$type<RefreshToken>().notNull(),
    token_expiry: integer(),
    ...Timestamps,
  },
  (table) => [uniqueIndex("account_url_email_idx").on(table.url, table.email)],
)

export const AccountStateTable = sqliteTable("account_state", {
  id: integer()
    .primaryKey()
    .$default(() => 1),
  active_account_id: text()
    .$type<AccountID>()
    .references(() => AccountTable.id, { onDelete: "set null" }),
  active_org_id: text().$type<OrgID>(),
})
