import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  DomainError,
  type Actor,
  type PlatformRepository,
  type PlatformService,
} from "@devmentor/core";
const mocks = vi.hoisted(() => ({
  runtime: vi.fn(),
  authenticate: vi.fn(),
  platform: vi.fn(),
  query: vi.fn(),
  wrapper: vi.fn(),
  mailbox: vi.fn(),
  gateway: vi.fn(),
  verify: vi.fn(),
  verifyAccount: vi.fn(),
  connect: vi.fn(),
}));
vi.mock("../server/auth", () => ({ getAuthRuntime: mocks.runtime }));
vi.mock("../server/auth-http", () => ({
  handleAuthWrapper: mocks.wrapper,
  demoMailbox: mocks.mailbox,
}));
vi.mock("../server/platform", () => ({
  authenticate: mocks.authenticate,
  withPlatform: mocks.platform,
}));
vi.mock("../server/payments", () => ({
  createPaymentGateway: mocks.gateway,
  verifyStripeEvent: mocks.verify,
  verifyStripeAccountUpdate: mocks.verifyAccount,
  connectOnboarding: mocks.connect,
}));
import { handleApi } from "../server/api";
const origin = "http://localhost:3100";
const now = "2026-11-03T12:00:00.000Z";
const actor: Actor = {
  id: "u",
  roles: ["mentee", "mentor", "support", "admin"],
  mfaVerified: true,
};
const booking = {
  id: "b",
  mentorId: "m",
  mentorUserId: "mentor",
  menteeId: "u",
  startsAt: "2026-11-03T12:00:00.000Z",
  endsAt: "2026-11-03T12:50:00.000Z",
  state: "confirmed",
  amountMinor: "100",
  currency: "PLN",
  paymentState: "paid",
  checkoutId: "demo_b",
  checkoutUrl: null,
};
const pack = {
  id: "p",
  credits: 4,
  amountMinor: "100",
  currency: "PLN",
  paymentState: "pending",
  checkoutId: null,
  checkoutUrl: null,
};
const methods = [
  "mentors",
  "mentor",
  "availability",
  "reviews",
  "profile",
  "updateProfile",
  "goals",
  "saveGoals",
  "bookings",
  "favorites",
  "learningPlan",
  "packages",
  "ownApplication",
  "ownCases",
  "setFavorite",
  "createHold",
  "checkout",
  "booking",
  "cancel",
  "reschedule",
  "complete",
  "note",
  "saveNote",
  "addReview",
  "conversations",
  "conversation",
  "messages",
  "sendMessage",
  "saveMilestone",
  "buyPackage",
  "updatePackage",
  "applyMentor",
  "ownMentor",
  "saveMentor",
  "availabilityRules",
  "saveAvailabilityRules",
  "saveAvailability",
  "earnings",
  "payout",
  "connectAccount",
  "support",
  "adminCases",
  "caseDetail",
  "decideCase",
  "attachCheckout",
  "acceptPaymentEvent",
  "updateConnectAccount",
  "metrics",
  "failedJobs",
  "retryFailedJob",
];
let functions: Record<string, ReturnType<typeof vi.fn>>;
function fn(name: string): ReturnType<typeof vi.fn> {
  const value = functions[name];
  if (!value) throw new Error("Unknown fixture method " + name);
  return value;
}
let env: Record<string, unknown>;
const createCheckout = vi.fn();
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  headers: HeadersInit = {},
): Promise<Response> {
  return handleApi(
    new Request(origin + "/api/v1/" + path, {
      method,
      headers: {
        origin,
        "content-type": "application/json",
        "idempotency-key": "test-key-123",
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function data(result: Response): Promise<unknown> {
  return ((await result.json()) as { data: unknown }).data;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OAUTH_GOOGLE_CLIENT_ID", undefined);
  vi.stubEnv("OAUTH_GOOGLE_CLIENT_SECRET", undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(now));
  vi.spyOn(console, "error").mockImplementation(() => {});
  functions = Object.fromEntries(
    methods.map((name) => [name, vi.fn().mockResolvedValue({ id: name })]),
  );
  env = { APP_MODE: "demo", APP_URL: origin };
  mocks.runtime.mockImplementation(() => ({
    env,
    pool: { query: mocks.query },
  }));
  mocks.query.mockResolvedValue({ rows: [{ count: 1 }] });
  mocks.verify.mockResolvedValue(null);
  mocks.verifyAccount.mockResolvedValue(null);
  mocks.authenticate.mockResolvedValue(actor);
  mocks.platform.mockImplementation(
    (
      callback: (
        service: PlatformService,
        repository: PlatformRepository,
      ) => unknown,
    ) =>
      callback(
        functions as unknown as PlatformService,
        functions as unknown as PlatformRepository,
      ),
  );
  fn("booking").mockResolvedValue({ ...booking });
  fn("checkout").mockResolvedValue({ ...booking });
  fn("bookings").mockResolvedValue([]);
  fn("packages").mockResolvedValue([]);
  fn("ownCases").mockResolvedValue([]);
  fn("adminCases").mockResolvedValue([]);
  fn("conversations").mockResolvedValue([]);
  fn("mentors").mockResolvedValue({ data: [], nextCursor: null });
  fn("reviews").mockResolvedValue({ data: [], nextCursor: null });
  fn("messages").mockResolvedValue({ data: [], nextCursor: null });
  fn("profile").mockResolvedValue({ id: "u", email: "u@example.test" });
  fn("ownMentor").mockResolvedValue({ id: "m" });
  fn("connectAccount").mockResolvedValue({ accountId: null });
  fn("buyPackage").mockResolvedValue(pack);
  mocks.gateway.mockReturnValue({ createCheckout });
  createCheckout.mockResolvedValue({
    id: "cs_new",
    url: "https://checkout.example",
  });
  mocks.connect.mockResolvedValue({
    accountId: "acct",
    ready: true,
    url: "https://connect.example",
  });
  mocks.wrapper.mockImplementation(async () =>
    Response.json({ wrapped: true }),
  );
  mocks.mailbox.mockImplementation(async () =>
    Response.json({ mailbox: true }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
test("health/config stay available without auth or database and expose only public mode", async () => {
  expect(await data(await call("health"))).toEqual({
    status: "ok",
    service: "devmentor",
  });
  vi.stubEnv("APP_MODE", "demo");
  expect(await data(await call("config"))).toEqual({
    mode: "demo",
    oauth: { google: false },
  });
  vi.stubEnv("APP_MODE", "production");
  expect(await data(await call("config"))).toEqual({
    mode: "production",
    oauth: { google: false },
  });
  expect(mocks.runtime).not.toHaveBeenCalled();
  expect(await (await call("auth/login", "POST", {})).json()).toEqual({
    wrapped: true,
  });
  expect(mocks.wrapper.mock.calls[0]?.[1]).toBe("login");
  expect(await (await call("demo/mailbox")).json()).toEqual({ mailbox: true });
});
test("public mentor routes validate filters, cursors and bounded time ranges", async () => {
  expect(await (await call("mentors?q=ts&sort=price&limit=2")).json()).toEqual({
    data: [],
    nextCursor: null,
  });
  expect(fn("mentors")).toHaveBeenCalledWith({
    q: "ts",
    sort: "price",
    limit: 2,
  });
  expect(mocks.authenticate).not.toHaveBeenCalled();
  expect(await data(await call("mentors/m"))).toEqual({ id: "mentor" });
  await call("mentors/m/reviews");
  await call("mentors/m/reviews?cursor=old");
  expect(fn("reviews")).toHaveBeenLastCalledWith("m", "old");
  await call("mentors/m/availability");
  expect(fn("availability")).toHaveBeenLastCalledWith(
    "m",
    now,
    "2026-12-04T12:00:00.000Z",
  );
  await call(
    "mentors/m/availability?from=2026-11-04T12:00:00Z&to=2026-11-05T12:00:00Z",
  );
  expect(fn("availability")).toHaveBeenLastCalledWith(
    "m",
    "2026-11-04T12:00:00Z",
    "2026-11-05T12:00:00Z",
  );
  for (const query of [
    "from=bad",
    "from=2026-11-04T12:00:00Z&to=2026-11-03T12:00:00Z",
    "from=2026-11-04T12:00:00Z&to=2027-11-03T12:00:00Z",
  ]) {
    expect((await call("mentors/m/availability?" + query)).status).toBe(422);
  }
  expect((await call("mentors?limit=0")).status).toBe(422);
  expect((await call("mentors/m/unknown")).status).toBe(404);
});
test("authenticated profile endpoints pass explicit actors and validated values", async () => {
  await call("me");
  expect(fn("profile")).toHaveBeenCalledWith(actor);
  for (const extra of [
    {},
    { preferences: { theme: "dark" } },
    { notifications: { email: true } },
  ]) {
    expect(
      (
        await call("me", "PATCH", {
          name: " User ",
          timezone: "Europe/Warsaw",
          version: 1,
          ...extra,
        })
      ).status,
    ).toBe(200);
  }
  expect(fn("updateProfile")).toHaveBeenLastCalledWith(actor, {
    name: "User",
    timezone: "Europe/Warsaw",
    version: 1,
    preferences: { email: true },
  });
  for (const [path, method, body, expected] of [
    ["me/goals", "GET", undefined, "goals"],
    [
      "me/goals",
      "PUT",
      {
        goal: "Learn",
        level: "junior",
        description: "A useful learning goal for career",
      },
      "saveGoals",
    ],
    ["me/favorites", "GET", undefined, "favorites"],
    ["me/learning-plan", "GET", undefined, "learningPlan"],
    ["me/mentor-application", "GET", undefined, "ownApplication"],
    ["me/billing", "GET", undefined, "packages"],
  ] as const) {
    expect((await call(path, method, body)).status).toBe(200);
    expect(fn(expected)).toHaveBeenCalled();
  }
  expect(
    (
      await call("me", "PATCH", {
        name: "x",
        timezone: "UTC",
        version: 1,
        secret: true,
      })
    ).status,
  ).toBe(422);
});
test("bounded lists sort by stable ID, paginate and reject foreign cursors", async () => {
  fn("bookings").mockResolvedValue([
    { ...booking, id: "c" },
    { ...booking, id: "a" },
    { ...booking, id: "b" },
  ]);
  expect(await (await call("me/sessions?limit=1")).json()).toEqual({
    data: [{ ...booking, id: "a" }],
    nextCursor: "a",
  });
  expect(await (await call("me/sessions?limit=1&cursor=a")).json()).toEqual({
    data: [{ ...booking, id: "b" }],
    nextCursor: "b",
  });
  expect(await (await call("me/sessions?cursor=c")).json()).toEqual({
    data: [],
    nextCursor: null,
  });
  expect((await call("me/sessions?cursor=foreign")).status).toBe(422);
  expect((await call("me/sessions?limit=51")).status).toBe(422);
  for (const path of [
    "me/support-tickets",
    "admin/mentor-applications",
    "admin/support-tickets",
    "conversations",
  ])
    expect(await (await call(path)).json()).toEqual({
      data: [],
      nextCursor: null,
    });
});
test("dashboard selects earliest future confirmed session and sums credits", async () => {
  fn("bookings").mockResolvedValue([
    {
      ...booking,
      id: "late",
      startsAt: "2026-11-04T12:00:00Z",
      endsAt: "2026-11-04T12:50:00Z",
    },
    { ...booking, id: "early" },
    { ...booking, id: "expired", endsAt: "2026-11-02T12:00:00Z" },
    { ...booking, id: "held", state: "held" },
  ]);
  fn("packages").mockResolvedValue([
    { ...pack, credits: 2 },
    { ...pack, id: "p2", credits: 3 },
  ]);
  expect(await data(await call("me/dashboard"))).toMatchObject({
    nextSession: { id: "early" },
    creditBalance: 5,
  });
  fn("bookings").mockResolvedValue([]);
  expect(await data(await call("me/dashboard"))).toMatchObject({
    nextSession: null,
  });
});
test("favorites and holds retain role-bound arguments and explicit optional duration", async () => {
  expect((await call("favorites/m", "PUT")).status).toBe(204);
  expect(fn("setFavorite")).toHaveBeenLastCalledWith(actor, "m", true);
  expect((await call("favorites/m", "DELETE")).status).toBe(204);
  expect(fn("setFavorite")).toHaveBeenLastCalledWith(actor, "m", false);
  for (const extra of [{}, { durationMinutes: 50 }]) {
    expect(
      (
        await call("booking-holds", "POST", {
          mentorId: "m",
          slotId: "s",
          ...extra,
        })
      ).status,
    ).toBe(201);
    expect(fn("createHold")).toHaveBeenLastCalledWith(actor, {
      mentorId: "m",
      slotId: "s",
      ...extra,
    });
  }
  expect(
    (
      await call("booking-holds", "POST", {
        mentorId: "m",
        slotId: "s",
        durationMinutes: 30,
      })
    ).status,
  ).toBe(422);
});
test("checkout starts providers only for pending unattached orders and reloads durable state", async () => {
  const input = {
    holdId: "b",
    paymentMode: "psp",
    acceptedPolicyVersion: "v1",
  };
  expect((await call("checkout-sessions", "POST", input)).status).toBe(201);
  expect(createCheckout).not.toHaveBeenCalled();
  fn("checkout").mockResolvedValue({
    ...booking,
    paymentState: "pending",
    checkoutId: null,
  });
  expect((await call("checkout-sessions", "POST", input)).status).toBe(201);
  expect(createCheckout).toHaveBeenCalledWith(
    expect.objectContaining({ id: "b", kind: "booking", checkoutId: null }),
  );
  expect(fn("attachCheckout")).toHaveBeenLastCalledWith(
    "b",
    "cs_new",
    "https://checkout.example",
  );
  fn("checkout").mockResolvedValue({
    ...booking,
    paymentState: "pending",
    checkoutId: "existing",
  });
  await call("checkout-sessions", "POST", input);
  expect(createCheckout).toHaveBeenCalledOnce();
  expect(fn("checkout")).toHaveBeenCalledWith(actor, input, "test-key-123");
});
test("orders only fall back to own packages on NOT_FOUND and receipts require paid state", async () => {
  expect(await data(await call("orders/b"))).toMatchObject({ id: "b" });
  const receipt = await call("orders/b/receipt");
  expect(receipt.headers.get("content-type")).toContain("text/plain");
  expect(await receipt.text()).toContain("100 PLN");
  fn("booking").mockResolvedValueOnce({ ...booking, paymentState: "pending" });
  expect((await call("orders/b/receipt")).status).toBe(422);
  fn("booking").mockRejectedValueOnce(new DomainError("NOT_FOUND", 404));
  fn("packages").mockResolvedValue([{ ...pack, id: "other" }, pack]);
  expect(await data(await call("orders/p"))).toMatchObject({ id: "p" });
  fn("booking").mockRejectedValueOnce(new DomainError("NOT_FOUND", 404));
  expect((await call("orders/missing")).status).toBe(404);
  fn("booking").mockRejectedValueOnce(new DomainError("FORBIDDEN", 403));
  expect((await call("orders/b")).status).toBe(403);
  fn("booking").mockRejectedValueOnce(new Error("secret"));
  expect((await call("orders/b")).status).toBe(503);
});
test("demo payments validate ownership, checkout prefix and durable event identity", async () => {
  expect((await call("demo/payments/b", "POST")).status).toBe(202);
  expect(fn("acceptPaymentEvent")).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: "demo",
      eventId: "demo_paid_b",
      paymentId: "demo_pi_b",
      amountMinor: "100",
    }),
    now,
  );
  fn("booking").mockResolvedValueOnce({ ...booking, menteeId: "someone" });
  expect((await call("demo/payments/b", "POST")).status).toBe(404);
  for (const checkoutId of [null, "cs_live"]) {
    fn("booking").mockResolvedValueOnce({ ...booking, checkoutId });
    expect((await call("demo/payments/b", "POST")).status).toBe(409);
  }
  fn("booking").mockRejectedValueOnce(new DomainError("NOT_FOUND", 404));
  fn("packages").mockResolvedValue([
    { ...pack, id: "other" },
    { ...pack, checkoutId: "demo_p" },
  ]);
  expect((await call("demo/payments/p", "POST")).status).toBe(202);
  fn("booking").mockRejectedValueOnce(new DomainError("FORBIDDEN", 403));
  expect((await call("demo/payments/b", "POST")).status).toBe(403);
  fn("booking").mockRejectedValueOnce(new Error("offline"));
  expect((await call("demo/payments/b", "POST")).status).toBe(503);
  env.APP_MODE = "production";
  expect((await call("demo/payments/b", "POST")).status).toBe(404);
});
test("session writes validate payloads and use actor, version and idempotency", async () => {
  for (const [path, method, body, name, status] of [
    [
      "cancel",
      "POST",
      { reason: "A sufficiently long reason", version: 1 },
      "cancel",
      202,
    ],
    ["reschedule", "POST", { slotId: "new", version: 1 }, "reschedule", 200],
    ["complete", "POST", undefined, "complete", 200],
    ["notes", "GET", undefined, "note", 200],
    ["notes", "PUT", { note: "private" }, "saveNote", 200],
    [
      "reviews",
      "POST",
      { rating: 5, comment: "Excellent mentoring session" },
      "addReview",
      201,
    ],
  ] as const) {
    expect((await call("sessions/b/" + path, method, body)).status).toBe(
      status,
    );
    expect(fn(name)).toHaveBeenCalled();
  }
  expect(fn("cancel")).toHaveBeenCalledWith(
    actor,
    "b",
    "A sufficiently long reason",
    1,
    "test-key-123",
  );
  expect(fn("reschedule")).toHaveBeenCalledWith(actor, "b", "new", 1);
  const calendar = await call("sessions/b/calendar");
  expect(calendar.headers.get("content-type")).toContain("text/calendar");
  const ics = await calendar.text();
  expect(ics).toContain("UID:b@devmentor");
  expect(ics).toContain("DTSTART:20261103T120000Z");
  expect(ics).toContain("\r\n");
});
test("join window enforces state and boundaries and separates demo/provider meetings", async () => {
  expect(await data(await call("sessions/b/join", "POST"))).toEqual({
    roomUrl: "/room/b",
    demo: true,
  });
  for (const variant of [
    { state: "held" },
    { startsAt: "2026-11-03T12:16:00Z" },
    { endsAt: "2026-11-03T11:59:00Z" },
  ]) {
    fn("booking").mockResolvedValueOnce({ ...booking, ...variant });
    expect((await call("sessions/b/join", "POST")).status).toBe(422);
  }
  env.APP_MODE = "production";
  expect((await call("sessions/b/join", "POST")).status).toBe(503);
  env.MEETING_BASE_URL = "https://meeting.example/room?tenant=dev";
  expect(await data(await call("sessions/b/join", "POST"))).toEqual({
    roomUrl: "https://meeting.example/room?tenant=dev&session=b",
  });
});
test("conversation and milestone routes preserve explicit participant inputs", async () => {
  expect((await call("conversations", "POST", { mentorId: "m" })).status).toBe(
    201,
  );
  expect(fn("conversation")).toHaveBeenLastCalledWith(actor, "m");
  await call("conversations/c/messages");
  await call("conversations/c/messages?cursor=previous");
  expect(fn("messages")).toHaveBeenLastCalledWith(actor, "c", "previous");
  expect(
    (
      await call("conversations/c/messages", "POST", {
        text: "Hello mentor",
        clientMessageId: "client",
      })
    ).status,
  ).toBe(201);
  expect(fn("sendMessage")).toHaveBeenLastCalledWith(
    actor,
    "c",
    "Hello mentor",
    "client",
  );
  fn("learningPlan").mockResolvedValue({ id: "l" });
  expect(
    (
      await call("learning-plans/l/milestones/step", "PATCH", {
        completed: true,
        version: 2,
      })
    ).status,
  ).toBe(200);
  expect(fn("saveMilestone")).toHaveBeenLastCalledWith(actor, "step", true, 2);
  fn("saveMilestone").mockClear();
  expect(
    (
      await call("learning-plans/someone-elses-plan/milestones/step", "PATCH", {
        completed: true,
        version: 2,
      })
    ).status,
  ).toBe(404);
  expect(fn("saveMilestone")).not.toHaveBeenCalled();
});
test("subscriptions start provider checkout only when needed and return own persisted package", async () => {
  fn("packages").mockResolvedValue([{ ...pack, id: "other" }, pack]);
  expect(
    await data(await call("subscriptions", "POST", { mentorId: "m" })),
  ).toMatchObject({ id: "p" });
  expect(createCheckout).toHaveBeenCalledOnce();
  expect(fn("buyPackage")).toHaveBeenCalledWith(
    actor,
    "m",
    "test-key-123",
    now,
  );
  fn("buyPackage").mockResolvedValueOnce({ ...pack, paymentState: "paid" });
  await call("subscriptions", "POST", {
    mentorId: "m",
    packageSize: 4,
    autoRenew: false,
    consentVersion: "v1",
  });
  expect(createCheckout).toHaveBeenCalledOnce();
  expect(
    (await call("subscriptions/p", "PATCH", { action: "pause", version: 3 }))
      .status,
  ).toBe(200);
  expect(fn("updatePackage")).toHaveBeenLastCalledWith(actor, "p", "pause", 3);
});
const mentor = {
  headline: "An experienced mentor",
  bio: "A sufficiently long description of an experienced mentoring professional.",
  specialty: "TypeScript",
  languages: ["pl"],
  priceMinor: "100",
  years: 3,
};
test("mentor endpoints cover applications, profile, rules, availability, earnings and Connect", async () => {
  expect((await call("mentor-applications", "POST", mentor)).status).toBe(201);
  expect(fn("applyMentor")).toHaveBeenCalledWith(actor, mentor);
  expect(await data(await call("mentor/dashboard"))).toMatchObject({
    profile: { id: "m" },
    sessions: [],
  });
  mocks.authenticate.mockResolvedValueOnce({ ...actor, roles: ["mentee"] });
  expect(await data(await call("mentor/dashboard"))).toMatchObject({
    profile: null,
    sessions: [],
  });
  for (const [path, method, body, name, status] of [
    ["profile", "GET", undefined, "ownMentor", 200],
    ["profile", "PATCH", mentor, "saveMentor", 200],
    ["availability/rules", "GET", undefined, "availabilityRules", 200],
    [
      "availability/rules",
      "PUT",
      {
        rules: [
          {
            weekday: 1,
            localTime: "10:00",
            timezone: "UTC",
            disambiguation: "later",
          },
        ],
        exceptions: [{ localDate: "2026-11-04", available: false }],
      },
      "saveAvailabilityRules",
      200,
    ],
    ["availability", "GET", undefined, "availability", 200],
    [
      "availability",
      "PUT",
      {
        slots: [
          {
            startsAt: "2026-11-04T12:00:00Z",
            endsAt: "2026-11-04T12:50:00Z",
            timezone: "UTC",
          },
        ],
      },
      "saveAvailability",
      200,
    ],
    ["earnings", "GET", undefined, "earnings", 200],
    ["payouts", "POST", { amountMinor: "100", currency: "PLN" }, "payout", 202],
    ["connect", "POST", undefined, "updateConnectAccount", 200],
  ] as const) {
    expect((await call("mentor/" + path, method, body)).status).toBe(status);
    expect(fn(name)).toHaveBeenCalled();
  }
  expect(mocks.connect).toHaveBeenCalledWith("u", "u@example.test", null, env);
  expect(fn("updateConnectAccount")).toHaveBeenCalledWith("u", "acct", true);
});
test("support and admin routes pass decisions and require their privileged actor roles", async () => {
  expect(
    (
      await call("support-tickets", "POST", {
        category: "payment",
        description: "A sufficiently detailed support request",
      })
    ).status,
  ).toBe(201);
  expect(fn("support")).toHaveBeenCalledWith(
    actor,
    "payment",
    "A sufficiently detailed support request",
    undefined,
  );
  fn("adminCases").mockResolvedValue([
    { id: "one", status: "pending" },
    { id: "two", status: "resolved" },
  ]);
  expect(await data(await call("admin/overview"))).toEqual({
    openTickets: 1,
    supportOpen: 1,
    cases: 2,
    pendingApplications: 1,
  });
  await call("admin/cases/c");
  expect(fn("caseDetail")).toHaveBeenCalledWith(actor, "c");
  await call("admin/cases/c/decision", "POST", {
    action: "approve",
    reason: "A documented approval reason",
    version: 1,
  });
  expect(fn("decideCase")).toHaveBeenCalledWith(
    actor,
    "c",
    "approve",
    "A documented approval reason",
    1,
    now,
  );
  await call("admin/metrics");
  expect(fn("metrics")).toHaveBeenCalledWith(now);
  mocks.authenticate.mockResolvedValueOnce({ ...actor, roles: ["mentee"] });
  expect((await call("admin/metrics")).status).toBe(403);
});
test("API rejects cross-origin writes, throttles actors and hides unexpected errors", async () => {
  expect(
    (
      await call("favorites/m", "PUT", undefined, {
        origin: "http://evil.test",
      })
    ).status,
  ).toBe(403);
  expect(mocks.authenticate).not.toHaveBeenCalled();
  mocks.query.mockResolvedValueOnce({ rows: [{ count: 121 }] });
  const limited = await call("favorites/m", "PUT");
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("60");
  mocks.query.mockResolvedValueOnce({ rows: [] });
  expect((await call("favorites/m", "PUT")).status).toBe(429);
  mocks.authenticate.mockRejectedValueOnce(
    new Error("database password secret"),
  );
  const error = await call("me");
  expect(error.status).toBe(503);
  expect(await error.text()).not.toContain("password");
});
test("payment webhook limits raw bytes, requires signature and durably accepts verified events", async () => {
  expect(
    (
      await call(
        "webhooks/payments",
        "POST",
        {},
        { "content-length": "1048577" },
      )
    ).status,
  ).toBe(413);
  expect(
    (await call("webhooks/payments", "POST", "x".repeat(1048577))).status,
  ).toBe(413);
  expect((await call("webhooks/payments", "POST", {})).status).toBe(400);
  mocks.verify.mockResolvedValueOnce(null);
  expect(
    await data(
      await call(
        "webhooks/payments",
        "POST",
        {},
        { "stripe-signature": "sig" },
      ),
    ),
  ).toEqual({ accepted: true });
  expect(fn("acceptPaymentEvent")).not.toHaveBeenCalled();
  const event = { eventId: "evt", provider: "stripe" };
  mocks.verify.mockResolvedValueOnce(event);
  expect(
    (await call("webhooks/payments", "POST", {}, { "stripe-signature": "sig" }))
      .status,
  ).toBe(200);
  expect(mocks.verify).toHaveBeenLastCalledWith("{}", "sig", env);
  expect(fn("acceptPaymentEvent")).toHaveBeenCalledWith(event, now);
});
test("unsupported resource/method combinations consistently return NOT_FOUND", async () => {
  const paths = [
    "",
    "unknown",
    "config/x",
    "health/x",
    "webhooks/other",
    "webhooks/payments",
    "auth/login",
    "demo/other",
    "demo/payments",
    "mentors/m/unknown",
    "mentors/m/reviews",
    "mentors/m/availability",
    "me/unknown",
    "me/goals",
    "me/sessions",
    "me/favorites",
    "me/dashboard",
    "me/learning-plan",
    "me/billing",
    "me/mentor-application",
    "me/support-tickets",
    "favorites",
    "favorites/m",
    "booking-holds",
    "checkout-sessions",
    "orders",
    "orders/b",
    "sessions",
    "sessions/b",
    "sessions/b/calendar",
    "sessions/b/join",
    "sessions/b/cancel",
    "sessions/b/reschedule",
    "sessions/b/complete",
    "sessions/b/notes",
    "sessions/b/reviews",
    "conversations/c",
    "conversations/c/messages",
    "learning-plans",
    "learning-plans/l",
    "learning-plans/l/other/step",
    "learning-plans/l/milestones",
    "learning-plans/l/milestones/step",
    "subscriptions",
    "subscriptions/p",
    "mentor-applications",
    "mentor/unknown",
    "mentor/dashboard",
    "mentor/profile",
    "mentor/availability",
    "mentor/availability/unknown",
    "mentor/availability/rules",
    "mentor/earnings",
    "mentor/payouts",
    "mentor/connect",
    "support-tickets",
    "admin/unknown",
    "admin/mentor-applications",
    "admin/support-tickets",
    "admin/overview",
    "admin/cases",
    "admin/cases/c",
    "admin/cases/c/other",
    "admin/cases/c/decision",
    "admin/metrics",
  ];
  // OPTIONS is deliberately unsupported for every path; HEAD exercises the read-origin bypass.
  for (const path of paths) {
    const result = await call(path, "OPTIONS");
    expect(result.status, `OPTIONS ${path}`).toBe(404);
  }
  expect((await call("me", "HEAD")).status).toBe(404);
});

test("order receipts hide other participants, admin summary scopes counts, and job retry is explicit", async () => {
  fn("booking").mockResolvedValueOnce({ ...booking, menteeId: "other" });
  expect((await call("orders/b")).status).toBe(404);
  mocks.authenticate.mockResolvedValueOnce({ ...actor, roles: ["support"] });
  expect(await data(await call("admin/overview"))).toEqual({
    openTickets: 0,
    supportOpen: 0,
    cases: 0,
  });
  mocks.authenticate.mockResolvedValueOnce({ ...actor, roles: ["moderator"] });
  expect(await data(await call("admin/overview"))).toEqual({
    pendingApplications: 0,
  });
  expect((await call("admin/jobs")).status).toBe(200);
  expect(fn("failedJobs")).toHaveBeenCalledWith(actor);
  expect((await call("admin/jobs/job/retry", "POST")).status).toBe(202);
  expect(fn("retryFailedJob")).toHaveBeenCalledWith(actor, "job");
  for (const path of [
    "admin/jobs",
    "admin/jobs/job",
    "admin/jobs/job/unknown",
    "admin/jobs/job/retry",
  ])
    expect((await call(path, "OPTIONS")).status).toBe(404);
});

test("administration requires fresh session-bound MFA proof while demo authentication stays usable", async () => {
  env.APP_MODE = "production";
  mocks.authenticate.mockResolvedValueOnce({ ...actor, mfaVerified: false });
  const denied = await call("admin/overview");
  expect(denied.status).toBe(403);
  expect(await denied.json()).toMatchObject({
    error: { code: "MFA_REQUIRED" },
  });
  expect(fn("adminCases")).not.toHaveBeenCalled();
  expect((await call("admin/overview")).status).toBe(200);
  env.APP_MODE = "demo";
  mocks.authenticate.mockResolvedValueOnce({ ...actor, mfaVerified: true });
  expect((await call("admin/overview")).status).toBe(200);
});

test("signed account updates persist authoritative Connect state before acknowledging the webhook", async () => {
  const update = {
    userId: "mentor-user",
    accountId: "acct_verified",
    ready: false,
  };
  mocks.verifyAccount.mockResolvedValueOnce(update);
  const result = await call(
    "webhooks/payments",
    "POST",
    { event: "account.updated" },
    { "stripe-signature": "account-signature" },
  );
  expect(result.status).toBe(200);
  expect(await data(result)).toEqual({ accepted: true });
  expect(mocks.verifyAccount).toHaveBeenCalledWith(
    '{"event":"account.updated"}',
    "account-signature",
    env,
  );
  expect(fn("updateConnectAccount")).toHaveBeenCalledExactlyOnceWith(
    "mentor-user",
    "acct_verified",
    false,
  );
  expect(fn("acceptPaymentEvent")).not.toHaveBeenCalled();
  mocks.verifyAccount.mockRejectedValueOnce(
    new DomainError("INVALID_WEBHOOK_SIGNATURE", 400),
  );
  const invalid = await call(
    "webhooks/payments",
    "POST",
    {},
    { "stripe-signature": "invalid" },
  );
  expect(invalid.status).toBe(400);
  expect(fn("updateConnectAccount")).toHaveBeenCalledOnce();
});

test("public configuration exposes only OAuth capability while keeping provider credentials private", async () => {
  vi.stubEnv("OAUTH_GOOGLE_CLIENT_ID", "private-client-id");
  expect(await data(await call("config"))).toMatchObject({
    oauth: { google: false },
  });
  vi.stubEnv("OAUTH_GOOGLE_CLIENT_SECRET", "private-client-secret");
  const result = await call("config");
  const body = await result.text();
  expect(JSON.parse(body)).toMatchObject({ data: { oauth: { google: true } } });
  expect(body).not.toContain("private-client-id");
  expect(body).not.toContain("private-client-secret");
  expect(mocks.runtime).not.toHaveBeenCalled();
});

test("catalog transports opaque cursors up to 2048 characters while resource IDs remain bounded", async () => {
  for (const length of [104, 2048]) {
    const cursor = "c".repeat(length);
    expect((await call("mentors?cursor=" + cursor)).status).toBe(200);
    expect(fn("mentors")).toHaveBeenLastCalledWith({ cursor });
  }
  for (const cursor of ["", "c".repeat(2049)]) {
    expect((await call("mentors?cursor=" + cursor)).status).toBe(422);
  }
  expect(
    (
      await call("booking-holds", "POST", {
        mentorId: "m".repeat(101),
        slotId: "slot",
      })
    ).status,
  ).toBe(422);
  expect(
    (
      await call("booking-holds", "POST", {
        mentorId: "m".repeat(100),
        slotId: "slot",
      })
    ).status,
  ).toBe(201);
});
test("session responses preserve payer checkout fields and redact them for mentors without mutating source objects", async () => {
  const sensitive = Object.freeze({
    ...booking,
    checkoutId: "cs_private_payer",
    checkoutUrl: "https://checkout.example/private-payer",
  });
  fn("bookings").mockResolvedValue([sensitive]);
  fn("booking").mockResolvedValue(sensitive);
  for (const name of ["cancel", "reschedule", "complete"])
    fn(name).mockResolvedValue(sensitive);
  const mentorActor: Actor = {
    ...actor,
    id: booking.mentorUserId,
    roles: ["mentor"],
  };
  for (const participant of [actor, mentorActor]) {
    mocks.authenticate.mockResolvedValue(participant);
    const expected =
      participant.id === booking.menteeId
        ? sensitive
        : { ...sensitive, checkoutId: null, checkoutUrl: null };
    expect(await data(await call("sessions/b"))).toEqual(expected);
    expect(fn("booking")).toHaveBeenLastCalledWith(participant, "b");
    expect(await data(await call("me/sessions"))).toEqual([expected]);
    expect(await data(await call("me/dashboard"))).toMatchObject({
      nextSession: expected,
    });
    expect(await data(await call("mentor/dashboard"))).toMatchObject({
      sessions: [expected],
    });
    for (const [action, body] of [
      [
        "cancel",
        { reason: "A sufficiently detailed cancellation", version: 1 },
      ],
      ["reschedule", { slotId: "new-slot", version: 1 }],
      ["complete", undefined],
    ] as const) {
      const result = await call("sessions/b/" + action, "POST", body);
      expect(result.status).toBe(action === "cancel" ? 202 : 200);
      expect(await data(result)).toEqual(expected);
    }
  }
  expect(sensitive.checkoutId).toBe("cs_private_payer");
  expect(sensitive.checkoutUrl).toBe("https://checkout.example/private-payer");
});
test("billing exposes only orders purchased by the actor even when that actor also mentors", async () => {
  const asMentee = Object.freeze({
    ...booking,
    id: "own-purchase",
    checkoutId: "own-private-checkout",
  });
  const asMentor = Object.freeze({
    ...booking,
    id: "mentoring-income",
    menteeId: "someone-else",
    mentorUserId: actor.id,
    checkoutId: "other-private-checkout",
  });
  fn("bookings").mockResolvedValue([asMentor, asMentee]);
  fn("packages").mockResolvedValue([pack]);
  expect(await data(await call("me/billing"))).toEqual({
    orders: [asMentee],
    packages: [pack],
  });
  expect(asMentor.checkoutId).toBe("other-private-checkout");
});
test("dashboard counts the complete booking collection using one clock snapshot beyond the first page", async () => {
  const upcoming = Array.from({ length: 25 }, (_, index) => ({
    ...booking,
    id: "upcoming-" + String(index).padStart(2, "0"),
    startsAt: new Date(Date.parse(now) + (index + 1) * 86400000).toISOString(),
    endsAt: new Date(
      Date.parse(now) + (index + 1) * 86400000 + 50 * 60000,
    ).toISOString(),
  }));
  const completed = Array.from({ length: 23 }, (_, index) => ({
    ...booking,
    id: "completed-" + index,
    state: "completed",
  }));
  fn("bookings").mockResolvedValue(
    [...upcoming].reverse().concat(completed, [
      { ...booking, id: "ending-now", endsAt: now },
      { ...booking, id: "past-confirmed", endsAt: "2026-11-02T12:00:00Z" },
      {
        ...booking,
        id: "held-future",
        state: "held",
        endsAt: "2026-11-05T12:00:00Z",
      },
    ]),
  );
  const clock = vi
    .spyOn(Date, "now")
    .mockReturnValueOnce(Date.parse(now))
    .mockReturnValue(Date.parse("2050-01-01T00:00:00Z"));
  const result = await call("me/dashboard");
  expect(await data(result)).toMatchObject({
    upcomingCount: 25,
    completedCount: 23,
    nextSession: { id: "upcoming-00" },
  });
  expect(clock).toHaveBeenCalledOnce();
  clock.mockRestore();
  const firstPage = await call("me/sessions");
  expect(await firstPage.json()).toMatchObject({
    data: expect.any(Array),
    nextCursor: expect.any(String),
  });
  expect(await data(await call("me/sessions"))).toHaveLength(20);
});
test("administration overview counts pending work with compatibility aliases and scopes each role", async () => {
  const supportCases = [
    { id: "ticket-pending", status: "pending" },
    { id: "ticket-resolved", status: "resolved" },
    { id: "ticket-legacy-open", status: "open" },
  ];
  const applications = [
    { id: "application-pending", status: "pending" },
    { id: "application-approved", status: "approved" },
  ];
  for (const [roles, expected, kinds] of [
    [["support"], { openTickets: 1, supportOpen: 1, cases: 3 }, ["support"]],
    [["moderator"], { pendingApplications: 1 }, ["mentor_application"]],
    [
      ["admin"],
      { openTickets: 1, supportOpen: 1, cases: 3, pendingApplications: 1 },
      ["support", "mentor_application"],
    ],
  ] as const) {
    fn("adminCases").mockReset();
    for (const kind of kinds)
      fn("adminCases").mockResolvedValueOnce(
        kind === "support" ? supportCases : applications,
      );
    mocks.authenticate.mockResolvedValueOnce({ ...actor, roles: [...roles] });
    expect(await data(await call("admin/overview"))).toEqual(expected);
    expect(fn("adminCases").mock.calls.map((args) => args[1])).toEqual(kinds);
  }
  fn("adminCases").mockClear();
  mocks.authenticate.mockResolvedValueOnce({ ...actor, roles: ["mentee"] });
  expect((await call("admin/overview")).status).toBe(403);
  expect(fn("adminCases")).not.toHaveBeenCalled();
});
