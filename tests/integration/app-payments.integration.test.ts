import { expect, test } from "vitest";
import Stripe from "stripe";
import {
  createPaymentGateway,
  safeAmount,
  verifyStripeEvent,
} from "../../packages/app/server/payments";
import { runtimeEnvironment } from "../../packages/app/server/env";
const env = runtimeEnvironment({
  APP_MODE: "production",
  APP_URL: "https://localhost:3000",
  DATABASE_URL: "postgresql://test@localhost/test",
  AUTH_SECRET: "synthetic-only-test-secret-at-least-32-characters",
  STRIPE_SECRET_KEY: "sk_test_synthetic_no_network",
  STRIPE_WEBHOOK_SECRET: "whsec_synthetic_local_test",
});
const stripe = new Stripe("sk_test_synthetic_no_network");
function signed(
  type: string,
  object: unknown,
): { payload: string; signature: string } {
  const payload = JSON.stringify({ id: "evt_test_1", type, data: { object } });
  return {
    payload,
    signature: stripe.webhooks.generateTestHeaderString({
      payload,
      secret: env.STRIPE_WEBHOOK_SECRET ?? "",
    }),
  };
}
test("signed paid Checkout emits validated minor-unit data; unpaid completion does not confirm", async () => {
  const session = {
    id: "cs_test",
    metadata: { bookingId: "booking_test" },
    payment_intent: "pi_test",
    payment_status: "paid",
    amount_total: 18000,
    currency: "pln",
  };
  const event = signed("checkout.session.completed", session);
  expect(
    await verifyStripeEvent(event.payload, event.signature, env),
  ).toMatchObject({
    provider: "stripe",
    eventId: "evt_test_1",
    bookingId: "booking_test",
    paymentId: "pi_test",
    amountMinor: "18000",
    currency: "PLN",
    status: "paid",
  });
  const unpaid = signed("checkout.session.completed", {
    ...session,
    payment_status: "unpaid",
  });
  expect(
    await verifyStripeEvent(unpaid.payload, unpaid.signature, env),
  ).toBeNull();
  await expect(
    verifyStripeEvent(event.payload, "invalid-signature", env),
  ).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE", status: 400 });
  const changed = event.payload.replace("18000", "1");
  await expect(
    verifyStripeEvent(changed, event.signature, env),
  ).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
});
test("refund webhook carries separate charge and refund references; pending stays pending", async () => {
  const data = {
    id: "re_test",
    metadata: { bookingId: "booking_test" },
    payment_intent: "pi_test",
    status: "succeeded",
    amount: 18000,
    currency: "pln",
  };
  const event = signed("refund.updated", data);
  expect(
    await verifyStripeEvent(event.payload, event.signature, env),
  ).toMatchObject({
    paymentId: "pi_test",
    refundId: "re_test",
    status: "refund_succeeded",
  });
  const pending = signed("refund.updated", { ...data, status: "pending" });
  expect(
    await verifyStripeEvent(pending.payload, pending.signature, env),
  ).toBeNull();
});
test("provider amounts reject unsafe range and demo is explicit with no fake KYC payout", async () => {
  expect(safeAmount("18000")).toBe(18000);
  for (const value of ["1.5", "-1", "0", "9007199254740992"])
    expect(() => safeAmount(value)).toThrow();
  const demo = runtimeEnvironment({
    APP_MODE: "demo",
    APP_URL: "http://localhost:3000",
    DATABASE_URL: "postgresql://test@localhost/test",
  });
  const gateway = createPaymentGateway(demo);
  expect(
    await gateway.createCheckout({
      id: "order-1",
      kind: "booking",
      amountMinor: "18000",
      currency: "PLN",
      paymentState: "pending",
      checkoutId: null,
      checkoutUrl: null,
    }),
  ).toEqual({
    id: "demo_order-1",
    url: "http://localhost:3000/checkout?order=order-1",
  });
  await expect(
    gateway.payout("payout-1", "account-1", "100", "PLN"),
  ).rejects.toMatchObject({ code: "KYC_REQUIRED" });
  expect(() =>
    runtimeEnvironment({
      APP_MODE: "demo",
      APP_URL: "https://public.example.test",
      DATABASE_URL: "postgresql://test@localhost/test",
    }),
  ).toThrow("Invalid server configuration");
});

test("OAuth requires paired private credentials and public config reveals booleans only", async () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, {
      OAUTH_GOOGLE_CLIENT_ID: "private-client-id",
      OAUTH_GOOGLE_CLIENT_SECRET: "private-client-secret",
    });
    const { handleApi } = await import("../../packages/app/server/api");
    const result = await handleApi(
      new Request("http://localhost:3000/api/v1/config"),
    );
    const body = await result.text();
    expect(body).toContain('"google":true');
    expect(body).not.toContain("private-client");
    expect(() =>
      runtimeEnvironment({
        APP_MODE: "demo",
        APP_URL: "http://localhost:3000",
        DATABASE_URL: "postgresql://test@localhost/test",
        OAUTH_GOOGLE_CLIENT_ID: "only-one",
      }),
    ).toThrow();
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
