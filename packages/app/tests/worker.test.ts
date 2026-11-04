import { beforeEach, expect, test, vi } from "vitest";
import { DomainError } from "@devmentor/core";
import type {
  Job,
  PaymentOrder,
  PlatformRepository,
  PaymentGateway,
} from "@devmentor/core";
const mocks = vi.hoisted(() => ({
  runtime: vi.fn(),
  gateway: vi.fn(),
  platform: vi.fn(),
  email: vi.fn(),
  log: vi.fn(),
}));
vi.mock("../server/auth", () => ({ getAuthRuntime: mocks.runtime }));
vi.mock("../server/payments", () => ({ createPaymentGateway: mocks.gateway }));
vi.mock("../server/platform", () => ({ withPlatform: mocks.platform }));
vi.mock("../server/email", () => ({ deliverEmail: mocks.email }));
vi.mock("../server/log", () => ({ logEvent: mocks.log }));
import { runWorkerOnce } from "../server/worker";
const repository = {
  expireHolds: vi.fn(),
  pendingPayments: vi.fn(),
  paymentOrder: vi.fn(),
  pendingRefunds: vi.fn(),
  attachRefund: vi.fn(),
  acceptPaymentEvent: vi.fn(),
  claimJobs: vi.fn(),
  attachCheckout: vi.fn(),
  processPaymentEvent: vi.fn(),
  getActor: vi.fn(),
  completePayout: vi.fn(),
  finishJob: vi.fn(),
  failJob: vi.fn(),
};
const gateway = {
  retrieve: vi.fn(),
  retrieveRefund: vi.fn(),
  createCheckout: vi.fn(),
  expireCheckout: vi.fn(),
  refund: vi.fn(),
  payout: vi.fn(),
};
const service = { profile: vi.fn() };
const order: PaymentOrder = {
  id: "o",
  kind: "booking",
  amountMinor: "100",
  currency: "PLN",
  paymentState: "pending",
  checkoutId: null,
  checkoutUrl: null,
};
const event = {
  provider: "demo",
  eventId: "e",
  bookingId: "o",
  paymentId: "pi",
  amountMinor: "100",
  currency: "PLN",
  status: "paid",
};
function job(kind: string, payload: Record<string, unknown>, id = kind): Job {
  return { id, kind, payload, leaseToken: "lease", attempts: 0 };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.runtime.mockReturnValue({ pool: "pool", env: "env" });
  mocks.gateway.mockReturnValue(gateway as unknown as PaymentGateway);
  mocks.platform.mockImplementation(
    (callback: (service: unknown, repository: PlatformRepository) => unknown) =>
      callback(service, repository as unknown as PlatformRepository),
  );
  repository.pendingPayments.mockResolvedValue([]);
  repository.paymentOrder.mockResolvedValue(order);
  gateway.retrieve.mockResolvedValue(null);
  repository.pendingRefunds.mockResolvedValue([]);
  repository.claimJobs.mockResolvedValue([]);
  repository.getActor.mockResolvedValue({ id: "u" });
  service.profile.mockResolvedValue({ email: "u@example.test" });
  gateway.createCheckout.mockResolvedValue({
    id: "cs",
    url: "https://checkout.example",
  });
  gateway.refund.mockResolvedValue({ providerId: "re", event });
  gateway.payout.mockResolvedValue("transfer");
});
test("worker expires holds, reconciles only attached checkouts, and isolates reconciliation failures", async () => {
  repository.pendingPayments.mockResolvedValue([
    { ...order, checkoutId: null },
    { ...order, id: "paid", checkoutId: "paid" },
    { ...order, id: "pending", checkoutId: "pending" },
    { ...order, id: "offline", checkoutId: "offline" },
  ]);
  gateway.retrieve
    .mockResolvedValueOnce(event)
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce(new Error("offline"));
  expect(await runWorkerOnce()).toEqual({ processed: 0, failed: 0 });
  expect(repository.expireHolds).toHaveBeenCalledWith(
    expect.stringMatching(/Z$/),
  );
  expect(gateway.retrieve).toHaveBeenCalledTimes(3);
  expect(repository.acceptPaymentEvent).toHaveBeenCalledWith(
    event,
    expect.any(String),
  );
  expect(mocks.log).toHaveBeenCalledWith(
    "error",
    "payments.reconcile",
    expect.any(String),
    "RECONCILE_RETRY",
  );
  expect(repository.claimJobs).toHaveBeenCalledWith(expect.any(String), 120);
});
test("worker dispatches each durable job and acknowledges with its lease token", async () => {
  repository.pendingPayments.mockResolvedValue([order]);
  repository.claimJobs.mockResolvedValue([
    job("checkout.start", { orderId: "o" }),
    job("checkout.expire", { checkoutId: "cs" }),
    job("payment.process", { event }),
    job("payment.refund", {
      orderId: "o",
      paymentId: "pi",
      amountMinor: "100",
      currency: "PLN",
    }),
    job("notification.send", {
      userId: "u",
      template: "confirmed",
      bookingId: "o",
    }),
    job("payout.send", {
      payoutId: "p",
      accountId: "a",
      amountMinor: "100",
      currency: "PLN",
    }),
  ]);
  expect(await runWorkerOnce()).toEqual({ processed: 6, failed: 0 });
  expect(repository.attachCheckout).toHaveBeenCalledWith(
    "o",
    "cs",
    "https://checkout.example",
  );
  expect(gateway.expireCheckout).toHaveBeenCalledWith("cs");
  expect(repository.processPaymentEvent).toHaveBeenCalledWith(
    event,
    expect.any(String),
  );
  expect(gateway.refund).toHaveBeenCalledWith("o", "pi", "100", "PLN");
  expect(repository.acceptPaymentEvent).toHaveBeenCalledWith(
    event,
    expect.any(String),
  );
  expect(mocks.email).toHaveBeenCalledWith(
    "pool",
    "env",
    expect.objectContaining({ to: "u@example.test" }),
  );
  expect(repository.completePayout).toHaveBeenCalledWith("p", "transfer", true);
  expect(repository.finishJob).toHaveBeenCalledTimes(6);
  expect(repository.finishJob).toHaveBeenCalledWith("checkout.start", "lease");
  expect(repository.failJob).not.toHaveBeenCalled();
});
test("worker skips completed or already attached checkouts and leaves pending refunds for reconciliation", async () => {
  repository.paymentOrder
    .mockResolvedValueOnce({ ...order, paymentState: "paid" })
    .mockResolvedValueOnce({ ...order, checkoutId: "existing" });
  repository.claimJobs.mockResolvedValue([
    job("checkout.start", { orderId: "paid" }, "paid"),
    job("checkout.start", { orderId: "attached" }, "attached"),
    job("payment.refund", {
      orderId: "o",
      paymentId: "pi",
      amountMinor: "100",
      currency: "PLN",
    }),
  ]);
  gateway.refund.mockResolvedValueOnce({ providerId: "re", event: null });
  expect(await runWorkerOnce()).toEqual({ processed: 3, failed: 0 });
  expect(gateway.createCheckout).not.toHaveBeenCalled();
  expect(repository.acceptPaymentEvent).not.toHaveBeenCalled();
});
test("worker records malformed, unknown and rejected jobs without acknowledging them or stopping later work", async () => {
  repository.claimJobs.mockResolvedValue([
    job("unknown", {}),
    job("payment.process", { event: { bad: true } }),
    job("checkout.expire", { checkoutId: "cs" }),
    job("notification.send", { userId: "u", template: "hello" }),
  ]);
  gateway.expireCheckout.mockRejectedValueOnce(new Error("provider secret"));
  expect(await runWorkerOnce()).toEqual({ processed: 1, failed: 3 });
  expect(repository.finishJob).toHaveBeenCalledWith(
    "notification.send",
    "lease",
  );
  expect(repository.failJob).toHaveBeenCalledTimes(3);
  expect(repository.failJob).toHaveBeenCalledWith(
    "unknown",
    "lease",
    expect.any(String),
  );
  expect(mocks.log).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("provider secret");
});

test("worker reconciles attached refunds, skips absent IDs and isolates provider failures", async () => {
  const order = {
    orderId: "o",
    paymentId: "pi",
    amountMinor: "100",
    currency: "PLN",
    state: "pending",
  };
  repository.pendingRefunds.mockResolvedValue([
    { ...order, providerId: null },
    { ...order, providerId: "paid" },
    { ...order, providerId: "pending" },
    { ...order, providerId: "offline" },
  ]);
  gateway.retrieveRefund
    .mockResolvedValueOnce(event)
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce(new Error("offline"));
  expect(await runWorkerOnce()).toEqual({ processed: 0, failed: 0 });
  expect(gateway.retrieveRefund).toHaveBeenCalledTimes(3);
  expect(repository.acceptPaymentEvent).toHaveBeenCalledWith(
    event,
    expect.any(String),
  );
  expect(mocks.log).toHaveBeenCalledWith(
    "error",
    "refunds.reconcile",
    expect.any(String),
    "REFUND_RECONCILE_RETRY",
  );
});

test("missing or expired exact checkout orders fail their jobs without success acknowledgement", async () => {
  repository.claimJobs.mockResolvedValue([
    job("checkout.start", { orderId: "missing" }, "missing"),
    job("checkout.start", { orderId: "expired" }, "expired"),
  ]);
  repository.paymentOrder
    .mockRejectedValueOnce(new DomainError("NOT_FOUND", 404))
    .mockRejectedValueOnce(new DomainError("ORDER_EXPIRED", 409));
  expect(await runWorkerOnce()).toEqual({ processed: 0, failed: 2 });
  expect(repository.paymentOrder.mock.calls).toEqual([
    ["missing"],
    ["expired"],
  ]);
  expect(repository.finishJob).not.toHaveBeenCalled();
  expect(repository.failJob).toHaveBeenCalledWith(
    "missing",
    "lease",
    expect.any(String),
  );
  expect(repository.failJob).toHaveBeenCalledWith(
    "expired",
    "lease",
    expect.any(String),
  );
  expect(gateway.createCheckout).not.toHaveBeenCalled();
});
test("checkout targets the claimed order beyond 101 abandoned orders and uses an explicit gateway before reconciliation", async () => {
  const abandoned = Array.from({ length: 101 }, (_, index) => ({
    ...order,
    id: "abandoned-" + index,
  }));
  const target = { ...order, id: "new-order" };
  const orders = new Map(
    [...abandoned, target].map((value) => [value.id, value]),
  );
  repository.paymentOrder.mockImplementation(async (id: string) => {
    const result = orders.get(id);
    if (!result) throw new DomainError("NOT_FOUND", 404);
    return result;
  });
  repository.claimJobs.mockResolvedValue([
    job("checkout.start", { orderId: target.id }, "new-job"),
  ]);
  expect(await runWorkerOnce(gateway as PaymentGateway)).toEqual({
    processed: 1,
    failed: 0,
  });
  expect(mocks.gateway).not.toHaveBeenCalled();
  expect(repository.paymentOrder).toHaveBeenCalledExactlyOnceWith("new-order");
  expect(gateway.createCheckout).toHaveBeenCalledExactlyOnceWith(target);
  expect(repository.attachCheckout).toHaveBeenCalledExactlyOnceWith(
    "new-order",
    "cs",
    "https://checkout.example",
  );
  expect(repository.finishJob).toHaveBeenCalledExactlyOnceWith(
    "new-job",
    "lease",
  );
  expect(repository.finishJob.mock.invocationCallOrder[0]).toBeLessThan(
    repository.pendingPayments.mock.invocationCallOrder[0] ?? 0,
  );
});
test("reconciliation reaches the 102nd attached order across stable cursor pages", async () => {
  const orders = Array.from({ length: 102 }, (_, index) => ({
    ...order,
    id: String(index).padStart(3, "0"),
    checkoutId: "checkout-" + index,
  }));
  repository.pendingPayments
    .mockResolvedValueOnce(orders.slice(0, 100))
    .mockResolvedValueOnce(orders.slice(100));
  gateway.retrieve.mockImplementation(async (current: PaymentOrder) =>
    current.id === "101" ? { ...event, bookingId: "101" } : null,
  );
  expect(await runWorkerOnce()).toEqual({ processed: 0, failed: 0 });
  expect(repository.pendingPayments.mock.calls).toEqual([[undefined], ["099"]]);
  expect(gateway.retrieve).toHaveBeenCalledTimes(102);
  expect(repository.acceptPaymentEvent).toHaveBeenCalledExactlyOnceWith(
    { ...event, bookingId: "101" },
    expect.any(String),
  );
});
test("reconciliation rejects a nonadvancing or empty cursor instead of looping forever", async () => {
  const page = Array.from({ length: 100 }, () => ({
    ...order,
    id: "last",
    checkoutId: "checkout",
  }));
  repository.pendingPayments.mockResolvedValue(page);
  await expect(runWorkerOnce()).rejects.toThrow(
    "Reconciliation cursor did not advance",
  );
  expect(repository.pendingPayments.mock.calls).toEqual([
    [undefined],
    ["last"],
  ]);
  repository.pendingPayments
    .mockReset()
    .mockResolvedValue(page.map((value) => ({ ...value, id: "" })));
  await expect(runWorkerOnce()).rejects.toThrow(
    "Reconciliation cursor did not advance",
  );
});
