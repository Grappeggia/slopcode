import type { Stripe } from "stripe"
import { Billing } from "@slopcode-ai/console-core/billing.js"
import type { APIEvent } from "@solidjs/start/server"
import { and, Database, eq, isNull, sql } from "@slopcode-ai/console-core/drizzle/index.js"
import {
  BillingTable,
  LiteTable,
  PaymentTable,
  StripeWebhookEventTable,
} from "@slopcode-ai/console-core/schema/billing.sql.js"
import { Identifier } from "@slopcode-ai/console-core/identifier.js"
import { centsToMicroCents } from "@slopcode-ai/console-core/util/price.js"
import { Actor } from "@slopcode-ai/console-core/actor.js"
import { Resource } from "@slopcode-ai/console-resource"
import { LiteData } from "@slopcode-ai/console-core/lite.js"
import { BlackData } from "@slopcode-ai/console-core/black.js"
import { Referral } from "@slopcode-ai/console-core/referral.js"

function recognized(body: Stripe.Event) {
  if (body.type === "customer.updated") {
    return "default_payment_method" in (body.data.previous_attributes?.invoice_settings ?? {})
  }
  if (body.type === "checkout.session.completed") return body.data.object.mode === "payment"
  if (body.type === "customer.subscription.created") return body.data.object.metadata?.type === "lite"
  if (body.type === "customer.subscription.updated") {
    if (body.data.object.status !== "incomplete_expired") return false
    const productID = body.data.object.items.data[0]?.price.product
    if (typeof productID !== "string") return false
    return productID === LiteData.productID() || productID === BlackData.productID()
  }
  if (body.type === "customer.subscription.deleted") {
    const productID = body.data.object.items.data[0]?.price.product
    if (typeof productID !== "string") return false
    return productID === LiteData.productID() || productID === BlackData.productID()
  }
  if (body.type === "invoice.payment_succeeded") {
    return ["subscription_create", "subscription_cycle", "manual"].includes(body.data.object.billing_reason ?? "")
  }
  if (body.type === "invoice.payment_failed" || body.type === "invoice.payment_action_required") {
    return body.data.object.billing_reason === "manual"
  }
  return body.type === "charge.refunded"
}

function affected(result: unknown) {
  const value = Array.isArray(result) ? result[0] : result
  if (!value || typeof value !== "object") throw new Error("Database mutation result not found")
  if ("rowsAffected" in value && typeof value.rowsAffected === "number") return value.rowsAffected
  if ("affectedRows" in value && typeof value.affectedRows === "number") return value.affectedRows
  throw new Error("Database mutation count not found")
}

async function record(tx: Database.TxOrDb, payment: typeof PaymentTable.$inferInsert) {
  return affected(await tx.insert(PaymentTable).ignore().values(payment)) > 0
}

export async function processStripeEvent<T>(id: string, callback: () => Promise<T>) {
  return Database.transaction(async (tx) => {
    const claim = await tx.insert(StripeWebhookEventTable).ignore().values({ id })
    if (affected(claim) === 0) return "duplicate" as const
    return callback()
  })
}

export async function processStripeWebhook(body: Stripe.Event, stripe = Billing.stripe()) {
  if (!recognized(body)) return body.type === "customer.updated" ? "ignored" : undefined

  return processStripeEvent(body.id, async () => {
    if (body.type === "customer.updated") {
      const customerID = body.data.object.id
      const paymentMethodID = body.data.object.invoice_settings.default_payment_method as string

      if (!customerID) throw new Error("Customer ID not found")
      if (!paymentMethodID) throw new Error("Payment method ID not found")

      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodID)
      await Database.use(async (tx) => {
        await tx
          .update(BillingTable)
          .set({
            paymentMethodID,
            paymentMethodLast4: paymentMethod.card?.last4 ?? null,
            paymentMethodType: paymentMethod.type,
          })
          .where(eq(BillingTable.customerID, customerID))
      })
    }
    if (body.type === "checkout.session.completed" && body.data.object.mode === "payment") {
      const workspaceID = body.data.object.metadata?.workspaceID
      const amountInCents = body.data.object.metadata?.amount && parseInt(body.data.object.metadata?.amount)
      const customerID = body.data.object.customer as string
      const paymentID = body.data.object.payment_intent as string
      const invoiceID = body.data.object.invoice as string

      if (!workspaceID) throw new Error("Workspace ID not found")
      if (!customerID) throw new Error("Customer ID not found")
      if (!amountInCents) throw new Error("Amount not found")
      if (!paymentID) throw new Error("Payment ID not found")
      if (!invoiceID) throw new Error("Invoice ID not found")

      await Actor.provide("system", { workspaceID }, async () => {
        const customer = await Billing.get()
        if (customer?.customerID && customer.customerID !== customerID) throw new Error("Customer ID mismatch")

        // set customer metadata
        if (!customer?.customerID) {
          await stripe.customers.update(customerID, {
            metadata: {
              workspaceID,
            },
          })
        }

        // get payment method for the payment intent
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentID, {
          expand: ["payment_method"],
        })
        const paymentMethod = paymentIntent.payment_method
        if (!paymentMethod || typeof paymentMethod === "string") throw new Error("Payment method not expanded")

        await Database.transaction(async (tx) => {
          if (
            !(await record(tx, {
              workspaceID,
              id: Identifier.create("payment"),
              amount: centsToMicroCents(amountInCents),
              paymentID,
              invoiceID,
              customerID,
            }))
          )
            return

          await tx
            .update(BillingTable)
            .set({
              balance: sql`${BillingTable.balance} + ${centsToMicroCents(amountInCents)}`,
              customerID,
              paymentMethodID: paymentMethod.id,
              paymentMethodLast4: paymentMethod.card?.last4 ?? null,
              paymentMethodType: paymentMethod.type,
              // enable reload if first time enabling billing
              ...(customer?.customerID
                ? {}
                : {
                    reloadError: null,
                    timeReloadError: null,
                  }),
            })
            .where(eq(BillingTable.workspaceID, workspaceID))
        })
      })
    }
    if (body.type === "customer.subscription.created") {
      const type = body.data.object.metadata?.type
      if (type === "lite") {
        const workspaceID = body.data.object.metadata?.workspaceID
        const userID = body.data.object.metadata?.userID
        const userEmail = body.data.object.metadata?.userEmail
        const coupon = body.data.object.metadata?.coupon
        const customerID = body.data.object.customer as string
        const invoiceID = body.data.object.latest_invoice as string
        const subscriptionID = body.data.object.id as string
        const paymentMethodID = body.data.object.default_payment_method as string

        if (!workspaceID) throw new Error("Workspace ID not found")
        if (!userID) throw new Error("User ID not found")
        if (!customerID) throw new Error("Customer ID not found")
        if (!invoiceID) throw new Error("Invoice ID not found")
        if (!subscriptionID) throw new Error("Subscription ID not found")
        if (!paymentMethodID) throw new Error("Payment method ID not found")

        // get payment method for the payment intent
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodID)
        await Actor.provide("system", { workspaceID }, async () => {
          // look up current billing
          const billing = await Billing.get()
          if (!billing) throw new Error(`Workspace with ID ${workspaceID} not found`)
          if (billing.customerID && billing.customerID !== customerID) throw new Error("Customer ID mismatch")

          // set customer metadata
          if (!billing?.customerID) {
            await stripe.customers.update(customerID, {
              metadata: {
                workspaceID,
              },
            })
          }

          await Database.transaction(async (tx) => {
            await tx
              .update(BillingTable)
              .set({
                customerID,
                liteSubscriptionID: subscriptionID,
                lite: {},
                paymentMethodID: paymentMethod.id,
                paymentMethodLast4: paymentMethod.card?.last4 ?? null,
                paymentMethodType: paymentMethod.type,
              })
              .where(eq(BillingTable.workspaceID, workspaceID))

            await tx.insert(LiteTable).values({
              workspaceID,
              id: Identifier.create("lite"),
              userID: userID,
            })

            if (userEmail) {
              if (coupon === LiteData.firstMonth50Coupon) {
                await Billing.redeemCoupon(userEmail, "GO1MONTH50")
              } else if (coupon === LiteData.firstMonth100Coupon) {
                await Billing.redeemCoupon(userEmail, "GOFREEMONTH")
              } else if (coupon === LiteData.threeMonths100Coupon) {
                await Billing.redeemCoupon(userEmail, "GO3MONTHS100")
              } else if (coupon === LiteData.sixMonths100Coupon) {
                await Billing.redeemCoupon(userEmail, "GO6MONTHS100")
              } else if (coupon === LiteData.twelveMonths100Coupon) {
                await Billing.redeemCoupon(userEmail, "GO12MONTHS100")
              }
            }
          })

          await Referral.completeFromLiteSubscription({
            workspaceID,
            userID,
          })
        })
      }
    }
    if (body.type === "customer.subscription.updated" && body.data.object.status === "incomplete_expired") {
      const subscriptionID = body.data.object.id
      if (!subscriptionID) throw new Error("Subscription ID not found")

      const productID = body.data.object.items.data[0].price.product as string
      if (productID === LiteData.productID()) {
        await Billing.unsubscribeLite({ subscriptionID })
      } else if (productID === BlackData.productID()) {
        await Billing.unsubscribeBlack({ subscriptionID })
      }
    }
    if (body.type === "customer.subscription.deleted") {
      const subscriptionID = body.data.object.id
      if (!subscriptionID) throw new Error("Subscription ID not found")

      const productID = body.data.object.items.data[0].price.product as string
      if (productID === LiteData.productID()) {
        await Billing.unsubscribeLite({ subscriptionID })
      } else if (productID === BlackData.productID()) {
        await Billing.unsubscribeBlack({ subscriptionID })
      }
    }
    if (body.type === "invoice.payment_succeeded") {
      if (
        body.data.object.billing_reason === "subscription_create" ||
        body.data.object.billing_reason === "subscription_cycle"
      ) {
        const invoiceID = body.data.object.id as string
        const amountInCents = body.data.object.amount_paid
        const customerID = body.data.object.customer as string
        const subscriptionID = body.data.object.parent?.subscription_details?.subscription as string
        const productID = body.data.object.lines?.data[0].pricing?.price_details?.product as string

        if (!customerID) throw new Error("Customer ID not found")
        if (!invoiceID) throw new Error("Invoice ID not found")
        if (!subscriptionID) throw new Error("Subscription ID not found")

        // get coupon id from subscription
        const invoice = await stripe.invoices.retrieve(invoiceID, {
          expand: ["discounts", "payments"],
        })
        const paymentID = invoice.payments?.data[0]?.payment.payment_intent as string
        const couponID = (invoice.discounts[0] as Stripe.Discount)?.coupon?.id as string
        if (!paymentID) {
          // payment id can be undefined when using coupon
          if (!couponID) throw new Error("Payment ID not found")
        }

        const workspaceID = await Database.use((tx) =>
          tx
            .select({ workspaceID: BillingTable.workspaceID })
            .from(BillingTable)
            .where(eq(BillingTable.customerID, customerID))
            .then((rows) => rows[0]?.workspaceID),
        )
        if (!workspaceID) throw new Error("Workspace ID not found for customer")

        await Database.use((tx) =>
          record(tx, {
            workspaceID,
            id: Identifier.create("payment"),
            amount: centsToMicroCents(amountInCents),
            paymentID,
            invoiceID,
            customerID,
            enrichment: {
              type: productID === LiteData.productID() ? "lite" : "subscription",
              currency: body.data.object.currency === "inr" ? "inr" : undefined,
              couponID,
            },
          }),
        )
      } else if (body.data.object.billing_reason === "manual") {
        const workspaceID = body.data.object.metadata?.workspaceID
        const amountInCents = body.data.object.metadata?.amount && parseInt(body.data.object.metadata?.amount)
        const invoiceID = body.data.object.id as string
        const customerID = body.data.object.customer as string

        if (!workspaceID) throw new Error("Workspace ID not found")
        if (!customerID) throw new Error("Customer ID not found")
        if (!amountInCents) throw new Error("Amount not found")
        if (!invoiceID) throw new Error("Invoice ID not found")

        await Actor.provide("system", { workspaceID }, async () => {
          // get payment id from invoice
          const invoice = await stripe.invoices.retrieve(invoiceID, {
            expand: ["payments"],
          })
          await Database.transaction(async (tx) => {
            if (
              !(await record(tx, {
                workspaceID: Actor.workspace(),
                id: Identifier.create("payment"),
                amount: centsToMicroCents(amountInCents),
                invoiceID,
                paymentID: invoice.payments?.data[0].payment.payment_intent as string,
                customerID,
              }))
            )
              return

            await tx
              .update(BillingTable)
              .set({
                balance: sql`${BillingTable.balance} + ${centsToMicroCents(amountInCents)}`,
                reloadError: null,
                timeReloadError: null,
              })
              .where(eq(BillingTable.workspaceID, Actor.workspace()))
          })
        })
      }
    }
    if (body.type === "invoice.payment_failed" || body.type === "invoice.payment_action_required") {
      if (body.data.object.billing_reason === "manual") {
        const workspaceID = body.data.object.metadata?.workspaceID
        const invoiceID = body.data.object.id

        if (!workspaceID) throw new Error("Workspace ID not found")
        if (!invoiceID) throw new Error("Invoice ID not found")

        const paymentIntent = await stripe.paymentIntents.retrieve(invoiceID)
        console.log(JSON.stringify(paymentIntent))
        const errorMessage =
          typeof paymentIntent === "object" && paymentIntent !== null
            ? paymentIntent.last_payment_error?.message
            : undefined

        await Actor.provide("system", { workspaceID }, async () => {
          await Database.use((tx) =>
            tx
              .update(BillingTable)
              .set({
                reload: false,
                reloadError: errorMessage ?? "workspace.reload.error.paymentFailed",
                timeReloadError: sql`now()`,
              })
              .where(eq(BillingTable.workspaceID, Actor.workspace())),
          )
        })
      }
    }
    if (body.type === "charge.refunded") {
      const customerID = body.data.object.customer as string
      const paymentIntentID = body.data.object.payment_intent as string
      if (!customerID) throw new Error("Customer ID not found")
      if (!paymentIntentID) throw new Error("Payment ID not found")

      const workspaceID = await Database.use((tx) =>
        tx
          .select({
            workspaceID: BillingTable.workspaceID,
          })
          .from(BillingTable)
          .where(eq(BillingTable.customerID, customerID))
          .then((rows) => rows[0]?.workspaceID),
      )
      if (!workspaceID) throw new Error("Workspace ID not found")

      const payment = await Database.use((tx) =>
        tx
          .select({
            amount: PaymentTable.amount,
            enrichment: PaymentTable.enrichment,
          })
          .from(PaymentTable)
          .where(and(eq(PaymentTable.paymentID, paymentIntentID), eq(PaymentTable.workspaceID, workspaceID)))
          .then((rows) => rows[0]),
      )
      if (!payment) throw new Error("Payment not found")

      await Database.transaction(async (tx) => {
        const refund = await tx
          .update(PaymentTable)
          .set({
            timeRefunded: new Date(body.created * 1000),
          })
          .where(
            and(
              eq(PaymentTable.paymentID, paymentIntentID),
              eq(PaymentTable.workspaceID, workspaceID),
              isNull(PaymentTable.timeRefunded),
            ),
          )

        if (affected(refund) === 0) return undefined

        // deduct balance only for top up
        if (!payment.enrichment?.type) {
          await tx
            .update(BillingTable)
            .set({
              balance: sql`${BillingTable.balance} - ${payment.amount}`,
            })
            .where(eq(BillingTable.workspaceID, workspaceID))
        }
      })
    }
    return undefined
  })
}

export async function POST(input: APIEvent) {
  const body = await Billing.stripe().webhooks.constructEventAsync(
    await input.request.text(),
    input.request.headers.get("stripe-signature")!,
    Resource.STRIPE_WEBHOOK_SECRET.value,
  )
  console.log(body.type, JSON.stringify(body, null, 2))

  return processStripeWebhook(body)
    .then((message) => {
      return Response.json({ message: message ?? "done" }, { status: 200 })
    })
    .catch((error: any) => {
      return Response.json({ message: error.message }, { status: 500 })
    })
}
