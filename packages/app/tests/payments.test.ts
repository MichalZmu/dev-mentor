import { beforeEach, expect, test, vi } from "vitest";
import type { PaymentOrder } from "@devmentor/core";
import type { RuntimeEnvironment } from "../server/env";
import {
  connectOnboarding,
  createPaymentGateway,
  safeAmount,
  verifyStripeEvent,
  verifyStripeAccountUpdate,
} from "../server/payments";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
  refund: vi.fn(),
  refundGet: vi.fn(),
  accountGet: vi.fn(),
  accountCreate: vi.fn(),
  transfer: vi.fn(),
  link: vi.fn(),
  event: vi.fn(),
  constructor: vi.fn(),
}));
vi.mock("stripe", () => ({
  default: class {
    constructor(...args: unknown[]) {
      mocks.constructor(...args);
    }
    checkout = {
      sessions: {
        create: mocks.create,
        retrieve: mocks.retrieve,
        expire: mocks.expire,
      },
    };
    refunds = { create: mocks.refund, retrieve: mocks.refundGet };
    accounts = { retrieve: mocks.accountGet, create: mocks.accountCreate };
    transfers = { create: mocks.transfer };
    accountLinks = { create: mocks.link };
    webhooks = { constructEvent: mocks.event };
  },
}));
const env: RuntimeEnvironment = {
  APP_MODE: "production",
  APP_URL: "https://example.test",
  DATABASE_URL: "postgres://local",
  AUTH_SECRET: "s".repeat(32),
  EMAIL_FROM: "n@example.test",
  DB_AUTH_POOL_MAX: 5,
  STRIPE_SECRET_KEY: "test_key",
  STRIPE_WEBHOOK_SECRET: "test_hook",
};
const order: PaymentOrder = {
  id: "order /?",
  kind: "booking",
  amountMinor: "12500",
  currency: "PLN",
  paymentState: "pending",
  checkoutId: null,
  checkoutUrl: null,
};
const session = {
  id: "cs_1",
  metadata: { bookingId: order.id },
  payment_intent: "pi_1",
  payment_status: "paid",
  amount_total: 12500,
  currency: "pln",
  url: "https://checkout.example/cs_1",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue(session);
  mocks.retrieve.mockResolvedValue(session);
  mocks.accountGet.mockResolvedValue({
    id: "acct_1",
    details_submitted: true,
    payouts_enabled: true,
  });
  mocks.accountCreate.mockResolvedValue({
    id: "acct_new",
    details_submitted: false,
    payouts_enabled: false,
  });
  mocks.link.mockResolvedValue({ url: "https://stripe.example/link" });
  mocks.transfer.mockResolvedValue({ id: "tr_1" });
});
test("safe payment amounts reject malformed, zero, negative and unsafe integers", () => {
  expect(safeAmount("9007199254740991")).toBe(Number.MAX_SAFE_INTEGER);
  for (const input of ["0", "-1", "1.1", "1e3", "", "9007199254740992"])
    expect(() => safeAmount(input)).toThrow("INVALID_AMOUNT");
});
test("demo gateway uses local checkout, emits deterministic refund and rejects payouts", async () => {
  const gateway = createPaymentGateway({
    ...env,
    APP_MODE: "demo",
    APP_URL: "http://localhost:3100",
  });
  expect(await gateway.createCheckout(order)).toEqual({
    id: "demo_" + order.id,
    url: "http://localhost:3100/checkout?order=order%20%2F%3F",
  });
  await gateway.expireCheckout("anything");
  expect(await gateway.retrieve(order)).toBeNull();
  expect(await gateway.refund("o", "pi", "100", "PLN")).toMatchObject({
    providerId: "demo_re_o",
    event: {
      provider: "demo",
      eventId: "demo_refund_o",
      status: "refund_succeeded",
      paymentId: "pi",
    },
  });
  await expect(gateway.payout("p", "a", "100", "PLN")).rejects.toThrow(
    "KYC_REQUIRED",
  );
});
test("production checkout uses deterministic provider keys and separate hold clock", async () => {
  expect(() =>
    createPaymentGateway({
      ...env,
      STRIPE_SECRET_KEY: undefined,
    } as unknown as RuntimeEnvironment),
  ).toThrow("PAYMENT_PROVIDER_UNAVAILABLE");
  const gateway = createPaymentGateway(env);
  expect(await gateway.createCheckout(order)).toEqual({
    id: "cs_1",
    url: session.url,
  });
  expect(mocks.create).toHaveBeenLastCalledWith(
    expect.objectContaining({
      mode: "payment",
      metadata: { bookingId: order.id, kind: "booking" },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "pln",
            unit_amount: 12500,
            product_data: { name: "Sesja mentoringu DevMentor" },
          },
        },
      ],
    }),
    { idempotencyKey: "checkout_" + order.id },
  );
  expect(mocks.create.mock.calls[0]?.[0]).not.toHaveProperty("expires_at");
  await gateway.createCheckout({ ...order, kind: "package" });
  expect(
    mocks.create.mock.calls[1]?.[0].line_items[0].price_data.product_data.name,
  ).toContain("Pakiet");
  mocks.create.mockResolvedValueOnce({ ...session, url: null });
  await expect(gateway.createCheckout(order)).rejects.toThrow(
    "CHECKOUT_UNAVAILABLE",
  );
  mocks.retrieve.mockResolvedValueOnce({ ...session, status: "open" });
  await gateway.expireCheckout("cs_1");
  expect(mocks.expire).toHaveBeenCalledWith(
    "cs_1",
    {},
    { idempotencyKey: "expire_cs_1" },
  );
  mocks.retrieve.mockResolvedValueOnce({ ...session, status: "complete" });
  await gateway.expireCheckout("cs_1");
  expect(mocks.expire).toHaveBeenCalledOnce();
  expect(await gateway.retrieve(order)).toBeNull();
  expect(
    await gateway.retrieve({ ...order, checkoutId: "cs_1" }),
  ).toMatchObject({
    status: "paid",
    eventId: "reconcile_cs_1",
    currency: "PLN",
    paymentId: "pi_1",
  });
});
test("paid event rejects incomplete or unpaid sessions and supports expanded payment intents", async () => {
  for (const variant of [
    { metadata: undefined },
    { metadata: {} },
    { payment_intent: null },
    { payment_intent: {} },
    { payment_status: "unpaid" },
    { amount_total: null },
    { currency: null },
  ]) {
    mocks.event.mockReturnValue({
      id: "evt",
      type: "checkout.session.completed",
      data: { object: { ...session, ...variant } },
    });
    expect(await verifyStripeEvent("raw", "sig", env)).toBeNull();
  }
  mocks.event.mockReturnValue({
    id: "evt",
    type: "checkout.session.async_payment_succeeded",
    data: { object: { ...session, payment_intent: { id: "pi_object" } } },
  });
  expect(await verifyStripeEvent("raw", "sig", env)).toMatchObject({
    paymentId: "pi_object",
  });
});
test("refund results represent terminal successes and failures while pending remains unknown", async () => {
  const gateway = createPaymentGateway(env);
  for (const [status, expected] of [
    ["succeeded", "refund_succeeded"],
    ["failed", "refund_failed"],
    ["canceled", "refund_failed"],
    ["pending", null],
  ] as const) {
    mocks.refund.mockResolvedValueOnce({ id: "re_1", status });
    const result = await gateway.refund("o", "pi", "100", "PLN");
    if (expected)
      expect(result).toMatchObject({
        providerId: "re_1",
        event: { status: expected, eventId: "refund_result_re_1_" + status },
      });
    else expect(result).toEqual({ providerId: "re_1", event: null });
  }
  expect(mocks.refund).toHaveBeenLastCalledWith(
    { payment_intent: "pi", amount: 100, metadata: { bookingId: "o" } },
    { idempotencyKey: "refund_o" },
  );
});
test("payouts require both KYC conditions and retain provider idempotency", async () => {
  const gateway = createPaymentGateway(env);
  for (const account of [
    { payouts_enabled: false, details_submitted: true },
    { payouts_enabled: true, details_submitted: false },
  ]) {
    mocks.accountGet.mockResolvedValueOnce(account);
    await expect(gateway.payout("p", "acct", "100", "PLN")).rejects.toThrow(
      "KYC_REQUIRED",
    );
  }
  expect(await gateway.payout("p", "acct", "100", "PLN")).toBe("tr_1");
  expect(mocks.transfer).toHaveBeenLastCalledWith(
    {
      destination: "acct",
      amount: 100,
      currency: "pln",
      metadata: { payoutId: "p" },
    },
    { idempotencyKey: "payout_p" },
  );
});
test("webhook verification requires production secret and converts signature errors", async () => {
  await expect(
    verifyStripeEvent("raw", "sig", { ...env, APP_MODE: "demo" }),
  ).rejects.toThrow("PAYMENT_PROVIDER_UNAVAILABLE");
  await expect(
    verifyStripeEvent("raw", "sig", {
      ...env,
      STRIPE_WEBHOOK_SECRET: undefined,
    } as unknown as RuntimeEnvironment),
  ).rejects.toThrow("PAYMENT_PROVIDER_UNAVAILABLE");
  mocks.event.mockImplementationOnce(() => {
    throw new Error("bad signature");
  });
  await expect(verifyStripeEvent("raw", "sig", env)).rejects.toMatchObject({
    code: "INVALID_WEBHOOK_SIGNATURE",
    status: 400,
  });
  mocks.event.mockReturnValue({ type: "unknown", data: { object: {} } });
  expect(await verifyStripeEvent("raw", "sig", env)).toBeNull();
  expect(mocks.event).toHaveBeenLastCalledWith("raw", "sig", "test_hook");
});
test("async failure webhooks require amount/currency/order and use stable fallback IDs", async () => {
  const emit = async (object: unknown): Promise<unknown> => {
    mocks.event.mockReturnValue({
      id: "evt",
      type: "checkout.session.async_payment_failed",
      data: { object },
    });
    return verifyStripeEvent("raw", "sig", env);
  };
  for (const variant of [
    { metadata: undefined },
    { metadata: {} },
    { amount_total: null },
    { currency: null },
  ])
    expect(await emit({ ...session, ...variant })).toBeNull();
  for (const [intent, expected] of [
    ["pi_string", "pi_string"],
    [{ id: "pi_expanded" }, "pi_expanded"],
    [null, "cs_1"],
    [{}, "cs_1"],
  ])
    expect(await emit({ ...session, payment_intent: intent })).toMatchObject({
      status: "failed",
      paymentId: expected,
    });
});
test("refund webhooks reject missing order/nonterminal statuses and normalize outcomes", async () => {
  const refund = {
    id: "re_1",
    metadata: { bookingId: "o" },
    payment_intent: "pi_1",
    amount: 100,
    currency: "pln",
    status: "succeeded",
  };
  const emit = async (
    object: unknown,
    type = "refund.updated",
  ): Promise<unknown> => {
    mocks.event.mockReturnValue({ id: "evt", type, data: { object } });
    return verifyStripeEvent("raw", "sig", env);
  };
  for (const variant of [
    { metadata: undefined },
    { metadata: {} },
    { status: undefined },
    { status: "pending" },
  ])
    expect(await emit({ ...refund, ...variant })).toBeNull();
  expect(await emit(refund)).toMatchObject({
    status: "refund_succeeded",
    paymentId: "pi_1",
  });
  expect(
    await emit(
      { ...refund, status: "failed", payment_intent: { id: "pi_expanded" } },
      "refund.failed",
    ),
  ).toMatchObject({ status: "refund_failed", paymentId: "pi_expanded" });
  expect(
    await emit(
      { ...refund, status: "canceled", payment_intent: null },
      "refund.created",
    ),
  ).toMatchObject({ status: "refund_failed", paymentId: "re_1" });
  expect(await emit({ ...refund, payment_intent: {} })).toMatchObject({
    paymentId: "re_1",
  });
});
test("Connect onboarding creates or reuses an account and reports readiness", async () => {
  await expect(
    connectOnboarding("u", "u@example.test", null, {
      ...env,
      APP_MODE: "demo",
    }),
  ).rejects.toThrow("PAYMENT_PROVIDER_UNAVAILABLE");
  expect(
    await connectOnboarding("u", "u@example.test", null, env),
  ).toMatchObject({
    accountId: "acct_new",
    ready: false,
    url: "https://stripe.example/link",
  });
  expect(mocks.accountCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "express",
      email: "u@example.test",
      metadata: { userId: "u" },
    }),
    { idempotencyKey: "connect_u" },
  );
  expect(
    await connectOnboarding("u", "u@example.test", "acct_1", env),
  ).toMatchObject({ ready: true, accountId: "acct_1" });
  mocks.accountGet.mockResolvedValueOnce({
    id: "acct_1",
    details_submitted: true,
    payouts_enabled: false,
  });
  expect(
    await connectOnboarding("u", "u@example.test", "acct_1", env),
  ).toMatchObject({ ready: false });
  expect(mocks.link).toHaveBeenLastCalledWith(
    expect.objectContaining({
      account: "acct_1",
      refresh_url: "https://example.test/mentor?tab=earnings",
      return_url: "https://example.test/mentor?tab=earnings",
    }),
  );
});

test("refund reconciliation retains provider identity and normalizes terminal states", async () => {
  const refundOrder = {
    orderId: "o",
    paymentId: "pi",
    amountMinor: "100",
    currency: "PLN",
    providerId: "re_1",
    state: "pending",
  };
  expect(
    await createPaymentGateway({ ...env, APP_MODE: "demo" }).retrieveRefund(
      refundOrder,
    ),
  ).toMatchObject({
    provider: "demo",
    status: "refund_succeeded",
    bookingId: "o",
  });
  const gateway = createPaymentGateway(env);
  expect(
    await gateway.retrieveRefund({ ...refundOrder, providerId: null }),
  ).toBeNull();
  for (const status of [
    undefined,
    "pending",
    "succeeded",
    "failed",
    "canceled",
  ]) {
    mocks.refundGet.mockResolvedValueOnce({
      id: "re_1",
      status,
      amount: 100,
      currency: "pln",
    });
    const result = await gateway.retrieveRefund(refundOrder);
    if (status === "succeeded" || status === "failed" || status === "canceled")
      expect(result).toMatchObject({
        status: status === "succeeded" ? "refund_succeeded" : "refund_failed",
        currency: "PLN",
        eventId: "refund_reconcile_re_1_" + status,
      });
    else expect(result).toBeNull();
  }
});

test("Connect account webhooks require production configuration and valid provider signatures", async () => {
  expect(
    await verifyStripeAccountUpdate("raw", "signature", {
      ...env,
      STRIPE_WEBHOOK_SECRET: undefined,
    } as unknown as RuntimeEnvironment),
  ).toBeNull();
  expect(
    await verifyStripeAccountUpdate("raw", "signature", {
      ...env,
      APP_MODE: "demo",
    }),
  ).toBeNull();
  expect(mocks.constructor).not.toHaveBeenCalled();
  await expect(
    verifyStripeAccountUpdate("raw", "signature", {
      ...env,
      STRIPE_SECRET_KEY: undefined,
    } as unknown as RuntimeEnvironment),
  ).rejects.toThrow("PAYMENT_PROVIDER_UNAVAILABLE");
  mocks.event.mockImplementationOnce(() => {
    throw new Error("private provider signature detail");
  });
  await expect(
    verifyStripeAccountUpdate("raw", "invalid", env),
  ).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE", status: 400 });
  expect(mocks.event).toHaveBeenCalledWith("raw", "invalid", "test_hook");
  expect(mocks.accountGet).not.toHaveBeenCalled();
});
test("Connect account webhooks ignore unrelated events and accounts without an owner", async () => {
  mocks.event.mockReturnValueOnce({ type: "payment_intent.created" });
  expect(await verifyStripeAccountUpdate("raw", "signature", env)).toBeNull();
  expect(mocks.accountGet).not.toHaveBeenCalled();
  mocks.event.mockReturnValue({
    type: "account.updated",
    data: { object: { id: "acct_current" } },
  });
  for (const metadata of [undefined, {}, { userId: "" }]) {
    mocks.accountGet.mockResolvedValueOnce({ id: "acct_current", metadata });
    expect(await verifyStripeAccountUpdate("raw", "signature", env)).toBeNull();
  }
});
test("Connect readiness follows the current retrieved account rather than delayed webhook flags", async () => {
  mocks.event.mockReturnValue({
    type: "account.updated",
    data: {
      object: {
        id: "acct_current",
        details_submitted: true,
        payouts_enabled: true,
        metadata: { userId: "stale-owner" },
      },
    },
  });
  for (const [submitted, payouts, expected] of [
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ] as const) {
    mocks.accountGet.mockResolvedValueOnce({
      id: "acct_current",
      details_submitted: submitted,
      payouts_enabled: payouts,
      metadata: { userId: "current-owner" },
    });
    expect(await verifyStripeAccountUpdate("raw", "signature", env)).toEqual({
      userId: "current-owner",
      accountId: "acct_current",
      ready: expected,
    });
    expect(mocks.accountGet).toHaveBeenLastCalledWith("acct_current");
  }
  mocks.accountGet.mockRejectedValueOnce(new Error("provider unavailable"));
  await expect(
    verifyStripeAccountUpdate("raw", "signature", env),
  ).rejects.toThrow("provider unavailable");
});
