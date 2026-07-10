import { beforeEach, describe, expect, test } from "bun:test"
import type { Stripe } from "stripe"
import { Database, eq, sql } from "@slopcode-ai/console-core/drizzle/index.js"
import {
  BillingTable,
  LiteTable,
  PaymentTable,
  StripeWebhookEventTable,
} from "@slopcode-ai/console-core/schema/billing.sql.js"
import { UserTable } from "@slopcode-ai/console-core/schema/user.sql.js"
import { WorkspaceTable } from "@slopcode-ai/console-core/schema/workspace.sql.js"
import { centsToMicroCents } from "@slopcode-ai/console-core/util/price.js"

process.env.SST_RESOURCE_App ??= JSON.stringify({ name: "test", stage: "test" })
process.env.SST_RESOURCE_ZEN_LITE_PRICE ??= JSON.stringify({
  product: "prod_lite",
  price: "price_lite",
  priceInr: 0,
  firstMonth100Coupon: "coupon_100",
  firstMonth50Coupon: "coupon_50",
  threeMonths100Coupon: "coupon_3",
  sixMonths100Coupon: "coupon_6",
  twelveMonths100Coupon: "coupon_12",
})
process.env.SST_RESOURCE_ZEN_BLACK_PRICE ??= JSON.stringify({
  product: "prod_black",
  plan20: "price_20",
  plan100: "price_100",
  plan200: "price_200",
})

const { processStripeEvent, processStripeWebhook } = await import("../src/routes/stripe/webhook")

const workspaceID = "workspace_stripe"
const customerID = "cus_stripe"
type Client = NonNullable<Parameters<typeof processStripeWebhook>[1]>
type Harness = Pick<typeof import("../../core/test/database"), "testDatabase" | "useTestDatabase">

function checkout(id = "evt_checkout", paymentID = "pi_checkout", invoiceID = "in_checkout") {
  return {
    id,
    type: "checkout.session.completed",
    created: 1_700_000_000,
    data: {
      object: {
        mode: "payment",
        metadata: { workspaceID, amount: "2000" },
        customer: customerID,
        payment_intent: paymentID,
        invoice: invoiceID,
      },
    },
  } as unknown as Stripe.Event
}

function manual(id = "evt_manual", invoiceID = "in_manual") {
  return {
    id,
    type: "invoice.payment_succeeded",
    created: 1_700_000_000,
    data: {
      object: {
        id: invoiceID,
        billing_reason: "manual",
        metadata: { workspaceID, amount: "1500" },
        customer: customerID,
      },
    },
  } as unknown as Stripe.Event
}

function subscription(id = "evt_subscription", invoiceID = "in_subscription") {
  return {
    id,
    type: "invoice.payment_succeeded",
    created: 1_700_000_000,
    data: {
      object: {
        id: invoiceID,
        billing_reason: "subscription_cycle",
        amount_paid: 1000,
        customer: customerID,
        currency: "usd",
        parent: { subscription_details: { subscription: "sub_stripe" } },
        lines: { data: [{ pricing: { price_details: { product: "prod_lite" } } }] },
      },
    },
  } as unknown as Stripe.Event
}

function lite(id = "evt_lite") {
  return {
    id,
    type: "customer.subscription.created",
    created: 1_700_000_000,
    data: {
      object: {
        id: "sub_lite",
        customer: customerID,
        latest_invoice: "in_lite",
        default_payment_method: "pm_lite",
        metadata: {
          type: "lite",
          workspaceID,
          userID: "user_stripe",
        },
      },
    },
  } as unknown as Stripe.Event
}

function refund(id = "evt_refund") {
  return {
    id,
    type: "charge.refunded",
    created: 1_700_000_000,
    data: {
      object: {
        customer: customerID,
        payment_intent: "pi_refund",
      },
    },
  } as unknown as Stripe.Event
}

export function stripeWebhookTests(harness: Harness) {
  async function seed(balance = 0) {
    await harness.testDatabase().insert(WorkspaceTable).values({ id: workspaceID, name: "Stripe" })
    await harness.testDatabase().insert(BillingTable).values({
      id: "billing_stripe",
      workspaceID,
      customerID,
      balance,
    })
  }

  async function state() {
    return {
      billing: await harness
        .testDatabase()
        .select()
        .from(BillingTable)
        .where(eq(BillingTable.workspaceID, workspaceID))
        .then((rows) => rows[0]),
      payments: await harness.testDatabase().select().from(PaymentTable),
      events: await harness.testDatabase().select().from(StripeWebhookEventTable),
    }
  }

  describe("Stripe webhook idempotency", () => {
    beforeEach(async () => {
      await harness.testDatabase().delete(StripeWebhookEventTable)
      await harness.testDatabase().delete(PaymentTable)
      await harness.testDatabase().delete(LiteTable)
    })

    test("does not double-credit a duplicate checkout top-up", async () => {
      await seed()
      let calls = 0
      const client = {
        paymentIntents: {
          retrieve: async () => {
            calls++
            return {
              payment_method: {
                id: "pm_checkout",
                type: "card",
                card: { last4: "4242" },
              },
            }
          },
        },
      } as unknown as Client

      await harness.useTestDatabase(async () => {
        expect(await processStripeWebhook(checkout(), client)).toBeUndefined()
        expect(await processStripeWebhook(checkout(), client)).toBe("duplicate")
      })

      const result = await state()
      expect(result.billing.balance).toBe(centsToMicroCents(2000))
      expect(result.payments).toHaveLength(1)
      expect(result.events).toHaveLength(1)
      expect(calls).toBe(1)
    })

    test("does not double-credit a duplicate manual invoice", async () => {
      await seed()
      let calls = 0
      const client = {
        invoices: {
          retrieve: async () => {
            calls++
            return {
              payments: { data: [{ payment: { payment_intent: "pi_manual" } }] },
            }
          },
        },
      } as unknown as Client

      await harness.useTestDatabase(async () => {
        expect(await processStripeWebhook(manual(), client)).toBeUndefined()
        expect(await processStripeWebhook(manual(), client)).toBe("duplicate")
      })

      const result = await state()
      expect(result.billing.balance).toBe(centsToMicroCents(1500))
      expect(result.payments).toHaveLength(1)
      expect(result.events).toHaveLength(1)
      expect(calls).toBe(1)
    })

    test("treats a new checkout event for an existing payment as successful", async () => {
      await seed()
      const client = {
        paymentIntents: {
          retrieve: async () => ({
            payment_method: {
              id: "pm_checkout",
              type: "card",
              card: { last4: "4242" },
            },
          }),
        },
      } as unknown as Client

      await harness.useTestDatabase(async () => {
        expect(await processStripeWebhook(checkout("evt_checkout_first"), client)).toBeUndefined()
        expect(await processStripeWebhook(checkout("evt_checkout_second"), client)).toBeUndefined()
      })

      const result = await state()
      expect(result.billing.balance).toBe(centsToMicroCents(2000))
      expect(result.payments).toHaveLength(1)
      expect(result.events).toHaveLength(2)
    })

    test("treats a new manual event for an existing invoice as successful", async () => {
      await seed()
      const client = {
        invoices: {
          retrieve: async () => ({
            payments: { data: [{ payment: { payment_intent: "pi_manual" } }] },
          }),
        },
      } as unknown as Client

      await harness.useTestDatabase(async () => {
        expect(await processStripeWebhook(manual("evt_manual_first"), client)).toBeUndefined()
        expect(await processStripeWebhook(manual("evt_manual_second"), client)).toBeUndefined()
      })

      const result = await state()
      expect(result.billing.balance).toBe(centsToMicroCents(1500))
      expect(result.payments).toHaveLength(1)
      expect(result.events).toHaveLength(2)
    })

    test("credits concurrent checkout events sharing identifiers only once", async () => {
      await seed()
      const client = {
        paymentIntents: {
          retrieve: async () => ({
            payment_method: {
              id: "pm_checkout",
              type: "card",
              card: { last4: "4242" },
            },
          }),
        },
      } as unknown as Client

      await harness.useTestDatabase(() =>
        Promise.all([
          processStripeWebhook(checkout("evt_checkout_concurrent_one"), client),
          processStripeWebhook(checkout("evt_checkout_concurrent_two"), client),
        ]),
      )

      const result = await state()
      expect(result.billing.balance).toBe(centsToMicroCents(2000))
      expect(result.payments).toHaveLength(1)
      expect(result.events).toHaveLength(2)
    })

    test("credits concurrent manual events sharing identifiers only once", async () => {
      await seed()
      const client = {
        invoices: {
          retrieve: async () => ({
            payments: { data: [{ payment: { payment_intent: "pi_manual" } }] },
          }),
        },
      } as unknown as Client

      await harness.useTestDatabase(() =>
        Promise.all([
          processStripeWebhook(manual("evt_manual_concurrent_one"), client),
          processStripeWebhook(manual("evt_manual_concurrent_two"), client),
        ]),
      )

      const result = await state()
      expect(result.billing.balance).toBe(centsToMicroCents(1500))
      expect(result.payments).toHaveLength(1)
      expect(result.events).toHaveLength(2)
    })

    test("records subscription payments once across distinct events", async () => {
      await seed()
      const client = {
        invoices: {
          retrieve: async () => ({
            discounts: [],
            payments: { data: [{ payment: { payment_intent: "pi_subscription" } }] },
          }),
        },
      } as unknown as Client

      await harness.useTestDatabase(async () => {
        expect(await processStripeWebhook(subscription("evt_subscription_first"), client)).toBeUndefined()
        expect(await processStripeWebhook(subscription("evt_subscription_second"), client)).toBeUndefined()
      })

      const result = await state()
      expect(result.billing.balance).toBe(0)
      expect(result.payments).toHaveLength(1)
      expect(result.events).toHaveLength(2)
    })

    test("keeps case-distinct Stripe event and payment identifiers separate", async () => {
      await seed()
      const client = {
        paymentIntents: {
          retrieve: async (paymentID: string) => ({
            payment_method: {
              id: `pm_${paymentID}`,
              type: "card",
              card: { last4: "4242" },
            },
          }),
        },
      } as unknown as Client

      await harness.useTestDatabase(async () => {
        expect(await processStripeWebhook(checkout("evt_case", "pi_case", "in_case"), client)).toBeUndefined()
        expect(await processStripeWebhook(checkout("evt_CASE", "pi_CASE", "in_CASE"), client)).toBeUndefined()
      })

      const result = await state()
      expect(result.billing.balance).toBe(centsToMicroCents(4000))
      expect(result.payments.map((payment) => payment.paymentID)).toContain("pi_case")
      expect(result.payments.map((payment) => payment.paymentID)).toContain("pi_CASE")
      expect(result.payments.map((payment) => payment.invoiceID)).toContain("in_case")
      expect(result.payments.map((payment) => payment.invoiceID)).toContain("in_CASE")
      expect(result.events.map((event) => event.id)).toContain("evt_case")
      expect(result.events.map((event) => event.id)).toContain("evt_CASE")
    })

    test("rolls back Lite entitlement and claim when referral completion fails", async () => {
      await seed()
      const client = {
        paymentMethods: {
          retrieve: async () => ({
            id: "pm_lite",
            type: "card",
            card: { last4: "4242" },
          }),
        },
      } as unknown as Client

      await expect(harness.useTestDatabase(() => processStripeWebhook(lite(), client))).rejects.toThrow(
        "Referral invitee account missing",
      )

      expect((await state()).billing.liteSubscriptionID).toBeNull()
      expect((await state()).events).toHaveLength(0)
      expect(await harness.testDatabase().select().from(LiteTable)).toHaveLength(0)

      await harness.testDatabase().insert(UserTable).values({
        workspaceID,
        id: "user_stripe",
        accountID: "account_stripe",
        name: "Stripe",
        role: "member",
      })
      await harness.useTestDatabase(() => processStripeWebhook(lite(), client))

      expect((await state()).billing.liteSubscriptionID).toBe("sub_lite")
      expect((await state()).events).toHaveLength(1)
      expect(await harness.testDatabase().select().from(LiteTable)).toHaveLength(1)
    })

    test("deducts a refund only once across duplicate and distinct events", async () => {
      const amount = centsToMicroCents(2000)
      await seed(amount * 2)
      await harness.testDatabase().insert(PaymentTable).values({
        id: "payment_refund",
        workspaceID,
        customerID,
        paymentID: "pi_refund",
        invoiceID: "in_refund",
        amount,
      })
      const client = {} as Client

      await harness.useTestDatabase(async () => {
        expect(await processStripeWebhook(refund(), client)).toBeUndefined()
        expect(await processStripeWebhook(refund(), client)).toBe("duplicate")
        expect(await processStripeWebhook(refund("evt_refund_other"), client)).toBeUndefined()
      })

      const result = await state()
      expect(result.billing.balance).toBe(amount)
      expect(result.payments[0].timeRefunded).not.toBeNull()
      expect(result.events).toHaveLength(2)
    })

    test("allows only one concurrent claimant to apply local effects", async () => {
      await seed()
      const apply = () =>
        processStripeEvent("evt_concurrent", async () => {
          await Database.use((tx) =>
            tx
              .update(BillingTable)
              .set({ balance: sql`${BillingTable.balance} + 1` })
              .where(eq(BillingTable.workspaceID, workspaceID)),
          )
          return "applied" as const
        })

      const result = await harness.useTestDatabase(() => Promise.all([apply(), apply()]))

      expect(result.sort()).toEqual(["applied", "duplicate"])
      expect((await state()).billing.balance).toBe(1)
    })

    test("rolls back a failed claim so the event can be retried", async () => {
      await seed()

      await expect(
        harness.useTestDatabase(() =>
          processStripeEvent("evt_retry", async () => {
            await Database.use((tx) =>
              tx
                .update(BillingTable)
                .set({ balance: sql`${BillingTable.balance} + 1` })
                .where(eq(BillingTable.workspaceID, workspaceID)),
            )
            throw new Error("processing failed")
          }),
        ),
      ).rejects.toThrow("processing failed")

      expect((await state()).billing.balance).toBe(0)
      expect((await state()).events).toHaveLength(0)

      await harness.useTestDatabase(() =>
        processStripeEvent("evt_retry", async () => {
          await Database.use((tx) =>
            tx
              .update(BillingTable)
              .set({ balance: sql`${BillingTable.balance} + 1` })
              .where(eq(BillingTable.workspaceID, workspaceID)),
          )
        }),
      )

      expect((await state()).billing.balance).toBe(1)
      expect((await state()).events).toHaveLength(1)
    })
  })
}
