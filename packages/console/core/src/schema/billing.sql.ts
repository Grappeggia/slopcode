import {
  bigint,
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { timestamps, ulid, utc, workspaceColumns } from "../drizzle/types"
import { workspaceIndexes } from "./workspace.sql"

export const BlackPlans = ["20", "100", "200"] as const
export const BillingTable = mysqlTable(
  "billing",
  {
    ...workspaceColumns,
    ...timestamps,
    customerID: varchar("customer_id", { length: 255 }),
    paymentMethodID: varchar("payment_method_id", { length: 255 }),
    paymentMethodType: varchar("payment_method_type", { length: 32 }),
    paymentMethodLast4: varchar("payment_method_last4", { length: 4 }),
    balance: bigint("balance", { mode: "number" }).notNull(),
    monthlyLimit: int("monthly_limit"),
    monthlyUsage: bigint("monthly_usage", { mode: "number" }),
    timeMonthlyUsageUpdated: utc("time_monthly_usage_updated"),
    reload: boolean("reload"),
    reloadTrigger: int("reload_trigger"),
    reloadAmount: int("reload_amount"),
    reloadError: varchar("reload_error", { length: 255 }),
    timeReloadError: utc("time_reload_error"),
    timeReloadLockedTill: utc("time_reload_locked_till"),
    subscription: json("subscription").$type<{
      status: "subscribed"
      seats: number
      plan: (typeof BlackPlans)[number]
      useBalance?: boolean
      coupon?: string
    }>(),
    subscriptionID: varchar("subscription_id", { length: 28 }),
    subscriptionPlan: mysqlEnum("subscription_plan", BlackPlans),
    timeSubscriptionBooked: utc("time_subscription_booked"),
    timeSubscriptionSelected: utc("time_subscription_selected"),
    liteSubscriptionID: varchar("lite_subscription_id", { length: 28 }),
    lite: json("lite").$type<{
      useBalance?: boolean
    }>(),
  },
  (table) => [
    ...workspaceIndexes(table),
    uniqueIndex("global_customer_id").on(table.customerID),
    uniqueIndex("global_subscription_id").on(table.subscriptionID),
  ],
)

export const SubscriptionTable = mysqlTable(
  "subscription",
  {
    ...workspaceColumns,
    ...timestamps,
    userID: ulid("user_id").notNull(),
    rollingUsage: bigint("rolling_usage", { mode: "number" }),
    fixedUsage: bigint("fixed_usage", { mode: "number" }),
    timeRollingUpdated: utc("time_rolling_updated"),
    timeFixedUpdated: utc("time_fixed_updated"),
  },
  (table) => [...workspaceIndexes(table), uniqueIndex("workspace_user_id").on(table.workspaceID, table.userID)],
)

export const LiteTable = mysqlTable(
  "lite",
  {
    ...workspaceColumns,
    ...timestamps,
    userID: ulid("user_id").notNull(),
    rollingUsage: bigint("rolling_usage", { mode: "number" }),
    weeklyUsage: bigint("weekly_usage", { mode: "number" }),
    monthlyUsage: bigint("monthly_usage", { mode: "number" }),
    timeRollingUpdated: utc("time_rolling_updated"),
    timeWeeklyUpdated: utc("time_weekly_updated"),
    timeMonthlyUpdated: utc("time_monthly_updated"),
  },
  (table) => [...workspaceIndexes(table), uniqueIndex("workspace_user_id").on(table.workspaceID, table.userID)],
)

export const PaymentTable = mysqlTable(
  "payment",
  {
    ...workspaceColumns,
    ...timestamps,
    customerID: varchar("customer_id", { length: 255 }),
    invoiceID: varchar("invoice_id", { length: 255 }).collate("utf8mb4_bin"),
    paymentID: varchar("payment_id", { length: 255 }).collate("utf8mb4_bin"),
    amount: bigint("amount", { mode: "number" }).notNull(),
    timeRefunded: utc("time_refunded"),
    enrichment: json("enrichment").$type<
      | {
          type: "subscription" | "lite"
          currency?: "inr"
          couponID?: string
        }
      | {
          type: "credit"
        }
    >(),
  },
  (table) => [
    ...workspaceIndexes(table),
    uniqueIndex("payment_invoice_id").on(table.invoiceID),
    uniqueIndex("payment_payment_id").on(table.paymentID),
  ],
)

export const StripeWebhookEventTable = mysqlTable("stripe_webhook_event", {
  id: varchar("id", { length: 255 }).collate("utf8mb4_bin").notNull().primaryKey(),
  timeCreated: utc("time_created").notNull().defaultNow(),
})

export const LegacyUsageClaimTable = mysqlTable("usage_legacy_claim", {
  id: varchar("id", { length: 64 }).collate("utf8mb4_bin").notNull().primaryKey(),
  timeCreated: utc("time_created").notNull().defaultNow(),
})

export const UsageReservationSources = ["free", "byok", "subscription", "lite", "balance"] as const
export const UsageReservationStatuses = ["pending", "settled", "released"] as const
export type UsageReservationLimits = {
  calendar?: { start: number }
  workspace?: number
  user?: number
  fixed?: { amount: number; start: number }
  rolling?: { amount: number; seconds: number; start?: number }
  weekly?: { amount: number; start: number }
  monthly?: { amount: number; start: number; anchor: number }
}
export type UsageReservationUsage = {
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  keyID?: string
  sessionID?: string
  enrichment?: {
    plan?: "sub" | "byok" | "lite"
  }
}

export const UsageReservationTable = mysqlTable(
  "usage_reservation",
  {
    id: varchar("id", { length: 64 }).collate("utf8mb4_bin").notNull().primaryKey(),
    workspaceID: ulid("workspace_id").notNull(),
    userID: ulid("user_id").notNull(),
    source: mysqlEnum("source", UsageReservationSources).notNull(),
    status: mysqlEnum("status", UsageReservationStatuses).notNull().default("pending"),
    amount: bigint("amount", { mode: "number" }).notNull(),
    amountActual: bigint("amount_actual", { mode: "number" }),
    limits: json("limits").$type<UsageReservationLimits>(),
    usage: json("usage").$type<UsageReservationUsage>(),
    timeDispatched: utc("time_dispatched"),
    timeLeaseExpires: utc("time_lease_expires"),
    timeCreated: utc("time_created").notNull().defaultNow(),
  },
  (table) => [
    index("usage_reservation_workspace_status").on(table.workspaceID, table.status),
    index("usage_reservation_lease").on(table.workspaceID, table.status, table.timeLeaseExpires),
  ],
)

export const UsageTable = mysqlTable(
  "usage",
  {
    ...workspaceColumns,
    ...timestamps,
    model: varchar("model", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    inputTokens: int("input_tokens").notNull(),
    outputTokens: int("output_tokens").notNull(),
    reasoningTokens: int("reasoning_tokens"),
    cacheReadTokens: int("cache_read_tokens"),
    cacheWrite5mTokens: int("cache_write_5m_tokens"),
    cacheWrite1hTokens: int("cache_write_1h_tokens"),
    cost: bigint("cost", { mode: "number" }).notNull(),
    reservationID: varchar("reservation_id", { length: 64 }).collate("utf8mb4_bin"),
    keyID: ulid("key_id"),
    sessionID: varchar("session_id", { length: 30 }),
    enrichment: json("enrichment").$type<{
      plan?: "sub" | "byok" | "lite"
      estimated?: boolean
      unknown?: boolean
    }>(),
  },
  (table) => [
    ...workspaceIndexes(table),
    index("usage_time_created").on(table.workspaceID, table.timeCreated),
    uniqueIndex("usage_reservation_id").on(table.reservationID),
  ],
)

export const CouponType = [
  "BUILDATHON",
  "GO1MONTH50",
  "GOFREEMONTH",
  "GO3MONTHS100",
  "GO6MONTHS100",
  "GO12MONTHS100",
] as const
export const CouponTable = mysqlTable(
  "coupon",
  {
    email: varchar("email", { length: 255 }),
    type: mysqlEnum("type", CouponType).notNull(),
    timeRedeemed: utc("time_redeemed"),
  },
  (table) => [primaryKey({ columns: [table.email, table.type] })],
)
