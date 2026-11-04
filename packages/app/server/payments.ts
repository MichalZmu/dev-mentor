import "server-only";
import Stripe from "stripe";
import {
  DomainError,
  type PaymentEvent,
  type PaymentGateway,
} from "@devmentor/core";
import type { RuntimeEnvironment } from "./env";

export function safeAmount(value: string): number {
  if (!/^\d+$/.test(value)) throw new DomainError("INVALID_AMOUNT");
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new DomainError("INVALID_AMOUNT");
  return amount;
}
function stripeClient(env: RuntimeEnvironment): Stripe {
  if (!env.STRIPE_SECRET_KEY)
    throw new DomainError("PAYMENT_PROVIDER_UNAVAILABLE", 503);
  return new Stripe(env.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
    timeout: 15_000,
  });
}
function paidEvent(
  session: Stripe.Checkout.Session,
  eventId: string,
): PaymentEvent | null {
  const bookingId = session.metadata?.bookingId;
  const paymentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (
    !bookingId ||
    !paymentId ||
    session.payment_status !== "paid" ||
    session.amount_total === null ||
    !session.currency
  )
    return null;
  return {
    provider: "stripe",
    eventId,
    bookingId,
    paymentId,
    amountMinor: String(session.amount_total),
    currency: session.currency.toUpperCase(),
    status: "paid",
  };
}
export function createPaymentGateway(env: RuntimeEnvironment): PaymentGateway {
  if (env.APP_MODE === "demo")
    return {
      async createCheckout(order) {
        return {
          id: "demo_" + order.id,
          url: new URL(
            "/checkout?order=" + encodeURIComponent(order.id),
            env.APP_URL,
          ).href,
        };
      },
      async expireCheckout() {},
      async retrieve() {
        return null;
      },
      async refund(orderId, paymentId, amountMinor, currency) {
        return {
          providerId: "demo_re_" + orderId,
          event: {
            provider: "demo",
            eventId: "demo_refund_" + orderId,
            refundId: "demo_re_" + orderId,
            bookingId: orderId,
            paymentId,
            amountMinor,
            currency,
            status: "refund_succeeded",
          },
        };
      },
      async retrieveRefund(order) {
        return {
          provider: "demo",
          eventId: "demo_refund_reconcile_" + order.orderId,
          refundId: "demo_re_" + order.orderId,
          bookingId: order.orderId,
          paymentId: order.paymentId,
          amountMinor: order.amountMinor,
          currency: order.currency,
          status: "refund_succeeded",
        };
      },
      async payout() {
        throw new DomainError("KYC_REQUIRED", 422);
      },
    };
  const stripe = stripeClient(env);
  return {
    async createCheckout(order) {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          client_reference_id: order.id,
          metadata: { bookingId: order.id, kind: order.kind },
          payment_intent_data: { metadata: { bookingId: order.id } },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: order.currency.toLowerCase(),
                unit_amount: safeAmount(order.amountMinor),
                product_data: {
                  name:
                    order.kind === "package"
                      ? "Pakiet mentoringu DevMentor"
                      : "Sesja mentoringu DevMentor",
                },
              },
            },
          ],
          success_url: new URL(
            "/checkout?order=" + encodeURIComponent(order.id),
            env.APP_URL,
          ).href,
          cancel_url: new URL(
            "/checkout?order=" + encodeURIComponent(order.id),
            env.APP_URL,
          ).href,
        },
        { idempotencyKey: "checkout_" + order.id },
      );
      // Checkout's own clock is at least 30min. The 15min domain hold expires separately.
      if (!session.url) throw new DomainError("CHECKOUT_UNAVAILABLE", 502);
      return { id: session.id, url: session.url };
    },
    async expireCheckout(id) {
      const session = await stripe.checkout.sessions.retrieve(id);
      if (session.status === "open")
        await stripe.checkout.sessions.expire(
          id,
          {},
          { idempotencyKey: "expire_" + id },
        );
    },
    async retrieve(order) {
      if (!order.checkoutId) return null;
      return paidEvent(
        await stripe.checkout.sessions.retrieve(order.checkoutId),
        "reconcile_" + order.checkoutId,
      );
    },
    async refund(orderId, paymentId, amountMinor, currency) {
      const refund = await stripe.refunds.create(
        {
          payment_intent: paymentId,
          amount: safeAmount(amountMinor),
          metadata: { bookingId: orderId },
        },
        { idempotencyKey: "refund_" + orderId },
      );
      if (
        refund.status !== "succeeded" &&
        refund.status !== "failed" &&
        refund.status !== "canceled"
      )
        return { providerId: refund.id, event: null };
      return {
        providerId: refund.id,
        event: {
          provider: "stripe",
          eventId: "refund_result_" + refund.id + "_" + refund.status,
          refundId: refund.id,
          bookingId: orderId,
          paymentId,
          amountMinor,
          currency,
          status:
            refund.status === "succeeded"
              ? "refund_succeeded"
              : "refund_failed",
        },
      };
    },
    async retrieveRefund(order) {
      if (!order.providerId) return null;
      const refund = await stripe.refunds.retrieve(order.providerId);
      if (!["succeeded", "failed", "canceled"].includes(refund.status ?? ""))
        return null;
      return {
        provider: "stripe",
        eventId: "refund_reconcile_" + refund.id + "_" + refund.status,
        refundId: refund.id,
        bookingId: order.orderId,
        paymentId: order.paymentId,
        amountMinor: String(refund.amount),
        currency: refund.currency.toUpperCase(),
        status:
          refund.status === "succeeded" ? "refund_succeeded" : "refund_failed",
      };
    },
    async payout(id, accountId, amountMinor, currency) {
      const account = await stripe.accounts.retrieve(accountId);
      if (!account.payouts_enabled || !account.details_submitted)
        throw new DomainError("KYC_REQUIRED");
      const transfer = await stripe.transfers.create(
        {
          destination: accountId,
          amount: safeAmount(amountMinor),
          currency: currency.toLowerCase(),
          metadata: { payoutId: id },
        },
        { idempotencyKey: "payout_" + id },
      );
      return transfer.id;
    },
  };
}
export async function verifyStripeEvent(
  raw: string,
  signature: string,
  env: RuntimeEnvironment,
): Promise<PaymentEvent | null> {
  if (!env.STRIPE_WEBHOOK_SECRET || env.APP_MODE === "demo")
    throw new DomainError("PAYMENT_PROVIDER_UNAVAILABLE", 503);
  let event: Stripe.Event;
  try {
    event = stripeClient(env).webhooks.constructEvent(
      raw,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new DomainError("INVALID_WEBHOOK_SIGNATURE", 400);
  }
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  )
    return paidEvent(event.data.object, event.id);
  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;
    if (!bookingId || session.amount_total === null || !session.currency)
      return null;
    return {
      provider: "stripe",
      eventId: event.id,
      bookingId,
      paymentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? session.id),
      amountMinor: String(session.amount_total),
      currency: session.currency.toUpperCase(),
      status: "failed",
    };
  }
  if (
    event.type === "refund.updated" ||
    event.type === "refund.created" ||
    event.type === "refund.failed"
  ) {
    const refund = event.data.object;
    const bookingId = refund.metadata?.bookingId;
    if (
      !bookingId ||
      !["succeeded", "failed", "canceled"].includes(refund.status ?? "")
    )
      return null;
    return {
      provider: "stripe",
      eventId: event.id,
      refundId: refund.id,
      bookingId,
      paymentId:
        typeof refund.payment_intent === "string"
          ? refund.payment_intent
          : (refund.payment_intent?.id ?? refund.id),
      amountMinor: String(refund.amount),
      currency: refund.currency.toUpperCase(),
      status:
        refund.status === "succeeded" ? "refund_succeeded" : "refund_failed",
    };
  }
  return null;
}
export async function connectOnboarding(
  userId: string,
  email: string,
  accountId: string | null,
  env: RuntimeEnvironment,
): Promise<{ accountId: string; ready: boolean; url: string }> {
  if (env.APP_MODE === "demo")
    throw new DomainError("PAYMENT_PROVIDER_UNAVAILABLE", 503);
  const stripe = stripeClient(env);
  const account = accountId
    ? await stripe.accounts.retrieve(accountId)
    : await stripe.accounts.create(
        {
          type: "express",
          country: "PL",
          email,
          capabilities: { transfers: { requested: true } },
          metadata: { userId },
        },
        { idempotencyKey: "connect_" + userId },
      );
  const link = await stripe.accountLinks.create({
    account: account.id,
    type: "account_onboarding",
    refresh_url: new URL("/mentor?tab=earnings", env.APP_URL).href,
    return_url: new URL("/mentor?tab=earnings", env.APP_URL).href,
  });
  return {
    accountId: account.id,
    ready: Boolean(account.details_submitted && account.payouts_enabled),
    url: link.url,
  };
}

export async function verifyStripeAccountUpdate(
  raw: string,
  signature: string,
  env: RuntimeEnvironment,
): Promise<{ userId: string; accountId: string; ready: boolean } | null> {
  if (!env.STRIPE_WEBHOOK_SECRET || env.APP_MODE === "demo") return null;
  const stripe = stripeClient(env);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new DomainError("INVALID_WEBHOOK_SIGNATURE", 400);
  }
  if (event.type !== "account.updated") return null;
  // Retrieve authoritative current status; delayed account events cannot restore stale KYC state.
  const account = await stripe.accounts.retrieve(event.data.object.id);
  const userId = account.metadata?.userId;
  if (!userId) return null;
  return {
    userId,
    accountId: account.id,
    ready: Boolean(account.details_submitted && account.payouts_enabled),
  };
}

// Preserve the adapter-facing type import while the port belongs to core.
export type { PaymentGateway } from "@devmentor/core";
