import { afterEach, describe, expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
import type { EntityManager } from "@mikro-orm/postgresql";
import type {
  Actor,
  AvailabilitySlot,
  Booking,
  Case,
  Mentor,
  MentorInput,
  Package,
  PaymentEvent,
} from "@devmentor/core";
import { createPlatformRepository } from "../src/platform-repository";

const now = "2026-11-03T10:00:00.000Z";
const actor: Actor = { id: "mentee", roles: ["mentee"], mfaVerified: false };
const mentorActor: Actor = {
  id: "mentor-user",
  roles: ["mentor"],
  mfaVerified: false,
};
const admin: Actor = { id: "admin", roles: ["admin"], mfaVerified: true };
const mentor: Mentor = {
  id: "mentor",
  userId: "mentor-user",
  name: "Mentor",
  headline: "A helpful mentor",
  bio: "A".repeat(60),
  specialty: "frontend",
  languages: ["pl"],
  priceMinor: "18000",
  currency: "PLN",
  years: 8,
  rating: 5,
  status: "published",
  version: 1,
};
const slot: AvailabilitySlot = {
  id: "slot",
  mentorId: mentor.id,
  startsAt: "2026-11-05T10:00:00.000Z",
  endsAt: "2026-11-05T10:50:00.000Z",
  timezone: "UTC",
  available: true,
};
const booking: Booking = {
  id: "booking",
  mentorId: mentor.id,
  menteeId: actor.id,
  mentorUserId: mentorActor.id,
  startsAt: slot.startsAt,
  endsAt: slot.endsAt,
  timezone: "UTC",
  state: "confirmed",
  expiresAt: "2026-11-03T10:15:00.000Z",
  amountMinor: "18000",
  currency: "PLN",
  feeMinor: "2700",
  paymentState: "paid",
  refundState: "none",
  checkoutUrl: null,
  checkoutId: null,
  version: 1,
  policyVersion: "2026-11-03",
  paymentMode: "psp",
};
const application: Case = {
  id: "case",
  userId: actor.id,
  kind: "mentor_application",
  status: "pending",
  payload: { ...mentor },
  decisionReason: null,
  version: 1,
  createdAt: now,
};
const pack: Package = {
  id: "pack",
  userId: actor.id,
  mentorId: mentor.id,
  state: "active",
  credits: 4,
  expiresAt: "2027-01-01T00:00:00.000Z",
  autoRenew: false,
  version: 1,
  amountMinor: "72000",
  currency: "PLN",
  paymentState: "paid",
  checkoutUrl: null,
  checkoutId: null,
};
const input: MentorInput = {
  headline: mentor.headline,
  bio: mentor.bio,
  specialty: mentor.specialty,
  languages: mentor.languages,
  priceMinor: mentor.priceMinor,
  years: mentor.years,
};
const payment = {
  id: booking.id,
  bookingId: booking.id,
  packageId: null,
  amountMinor: "18000",
  currency: "PLN",
  state: "pending",
};
const event: PaymentEvent = {
  provider: "stripe",
  eventId: "event",
  bookingId: booking.id,
  paymentId: "pi_1",
  amountMinor: "18000",
  currency: "PLN",
  status: "paid",
};

function harness(...responses: unknown[][]) {
  const queue = [...responses];
  const execute = vi.fn(
    async (
      _sql: string,
      _params: unknown[],
      method: string,
    ): Promise<unknown> => {
      if (method === "run") return undefined;
      if (_sql === "select id from mentor_profiles where id=? for update")
        return [];
      const next = queue.shift();
      if (!next) throw new Error("Missing SQL boundary response: " + _sql);
      return next;
    },
  );
  const em: EntityManager = {
    getConnection: () => ({ execute }),
    getTransactionContext: () => undefined,
    transactional: vi.fn(
      async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback(em),
    ),
  } as unknown as EntityManager;
  return {
    repo: createPlatformRepository(em),
    execute,
    em,
    queue,
    writes: () => execute.mock.calls.filter((call) => call[2] === "run"),
    jobs: () =>
      execute.mock.calls
        .filter((call) => call[0].startsWith("insert into outbox_jobs"))
        .map((call) => ({
          kind: call[1]?.[1],
          payload: JSON.parse(String(call[1]?.[2])) as unknown,
        })),
  };
}
afterEach(() => vi.unstubAllEnvs());

test("users default to mentee and trusted roles are stored explicitly", async () => {
  const profile = { id: actor.id, roles: ["mentee"], version: 1 };
  const h = harness(
    [profile],
    [profile],
    [{ roles: ["mentee"] }],
    [{ roles: ["admin"] }],
  );
  await expect(
    h.repo.ensureUser({
      id: actor.id,
      name: "Name",
      email: "name@example.test",
    }),
  ).resolves.toEqual(profile);
  expect(h.writes()[0]?.[1]?.[3]).toBe('["mentee"]');
  await h.repo.ensureUser({
    id: actor.id,
    name: "Name",
    email: "name@example.test",
    roles: ["admin"],
  });
  expect(
    h
      .writes()
      .some((call) => call[0].startsWith("update domain_users set roles")),
  ).toBe(true);
  await expect(h.repo.getActor(actor.id)).resolves.toEqual(actor);
  await expect(h.repo.getActor("admin", true)).resolves.toEqual(admin);
});
test("missing users are hidden and profile updates validate timezone and optimistic version", async () => {
  await expect(harness([]).repo.profile(actor)).rejects.toThrow("NOT_FOUND");
  const h = harness(
    [{ id: actor.id, version: 2 }],
    [{ id: actor.id, version: 3 }],
    [],
  );
  await expect(
    h.repo.updateProfile(actor, { name: "New", timezone: "UTC", version: 1 }),
  ).resolves.toEqual({ id: actor.id, version: 2 });
  await h.repo.updateProfile(actor, {
    name: "New",
    timezone: "UTC",
    version: 2,
    preferences: { email: true },
  });
  await expect(
    h.repo.updateProfile(actor, { name: "New", timezone: "UTC", version: 1 }),
  ).rejects.toThrow("STALE_VERSION");
  await expect(
    h.repo.updateProfile(actor, {
      name: "New",
      timezone: "Invalid/Zone",
      version: 1,
    }),
  ).rejects.toThrow("INVALID_TIMEZONE");
});
test("catalog filters are parameterized and pagination returns a deterministic next cursor", async () => {
  const h = harness([mentor], [mentor, { ...mentor, id: "second" }]);
  await expect(h.repo.mentors()).resolves.toEqual({
    data: [mentor],
    nextCursor: null,
  });
  await expect(
    h.repo.mentors({
      q: "React",
      specialty: "frontend",
      language: "pl",
      maxPriceMinor: "020000",
      cursor: Buffer.from(
        JSON.stringify({ id: "previous", sort: "recommended", value: "4" }),
      ).toString("base64url"),
      limit: 1,
    }),
  ).resolves.toEqual({
    data: [mentor],
    nextCursor: Buffer.from(
      JSON.stringify({ id: mentor.id, sort: "recommended", value: "5" }),
    ).toString("base64url"),
  });
  expect(h.execute.mock.calls[1]?.[1]).toEqual([
    "%React%",
    "%React%",
    "%React%",
    "frontend",
    '["pl"]',
    "20000",
    "4",
    "4",
    "previous",
    2,
  ]);
  await expect(harness([mentor]).repo.mentor(mentor.id)).resolves.toEqual(
    mentor,
  );
});
test("availability validates range, materializes recurring slots and returns occupied status", async () => {
  for (const [from, to] of [
    ["bad", now],
    [now, "bad"],
    [now, now],
    [slot.startsAt, now],
    [now, "2027-01-01T00:00:00Z"],
  ])
    await expect(
      harness().repo.availability(mentor.id, from ?? "", to ?? ""),
    ).rejects.toThrow("INVALID_DATE_RANGE");
  const h = harness(
    [mentor],
    [{ weekday: 2, localTime: "12:00", timezone: "UTC" }],
    [],
    [slot],
  );
  await expect(
    h.repo.availability(
      mentor.id,
      "2026-11-03T00:00:00Z",
      "2026-11-04T00:00:00Z",
    ),
  ).resolves.toEqual([slot]);
  expect(h.writes()[0]?.[1]?.slice(1)).toEqual([
    mentor.id,
    "2026-11-03T12:00:00.000Z",
    "2026-11-03T12:50:00.000Z",
    "UTC",
  ]);
});
test("reviews and favorites preserve bounds and membership", async () => {
  const values = Array.from({ length: 21 }, (_, index) => ({
    id: "review-" + index,
  }));
  const h = harness([], values, [mentor], [mentor], [mentor]);
  await expect(h.repo.reviews(mentor.id)).resolves.toEqual({
    data: [],
    nextCursor: null,
  });
  const reviews = await h.repo.reviews(mentor.id, "previous");
  expect(reviews.data).toHaveLength(20);
  expect(reviews.nextCursor).toBe("review-19");
  await expect(h.repo.favorites(actor)).resolves.toEqual([mentor]);
  await h.repo.setFavorite(actor, mentor.id, true);
  await h.repo.setFavorite(actor, mentor.id, false);
  expect(h.writes().map((call) => call[0].split(" ")[0])).toEqual([
    "insert",
    "delete",
  ]);
});
test("goals create a learning plan with a default goal or preserve supplied goal", async () => {
  const h = harness(
    [{ goals: { level: "expert" } }],
    [{ goals: { goal: "promotion" } }],
    [{ goals: {} }],
  );
  await expect(h.repo.goals(actor)).resolves.toEqual({
    goal: "career",
    level: "expert",
    description: "",
  });
  await expect(
    h.repo.saveGoals(actor, { goal: "promotion" }),
  ).resolves.toMatchObject({ goal: "promotion" });
  await h.repo.saveGoals(actor, {});
  expect(
    h
      .writes()
      .filter((call) => call[0].startsWith("insert into learning_plans"))
      .map((call) => call[1]?.[2]),
  ).toEqual(["promotion", "career"]);
});
test("hold snapshots price and commission, expires in fifteen minutes, and rejects own mentor", async () => {
  const h = harness([], [mentor], [slot], [booking]);
  await expect(
    h.repo.createHold(
      actor,
      { mentorId: mentor.id, slotId: slot.id },
      now,
      booking.id,
    ),
  ).resolves.toEqual(booking);
  const write = h
    .writes()
    .find((call) => call[0].startsWith("insert into bookings"));
  expect(write?.[1]).toEqual([
    booking.id,
    mentor.id,
    actor.id,
    slot.startsAt,
    slot.endsAt,
    "UTC",
    "2026-11-03T10:15:00.000Z",
    "18000",
    "2700",
    "PLN",
    "2026-11-03",
    now,
  ]);
  await expect(
    harness([], [{ ...mentor, userId: actor.id }]).repo.createHold(
      actor,
      { mentorId: mentor.id, slotId: slot.id },
      now,
      "id",
    ),
  ).rejects.toThrow("OWN_MENTOR_BOOKING");
});
test.each([
  ["23P01", "SLOT_TAKEN"],
  ["23505", "ALREADY_EXISTS"],
  ["40001", "RETRY_CONFLICT"],
  ["40P01", "RETRY_CONFLICT"],
])(
  "transaction errors map %s to %s without exposing SQL",
  async (code, expected) => {
    const h = harness();
    h.execute.mockRejectedValueOnce({ code, sql: "private" });
    await expect(h.repo.expireHolds(now)).rejects.toThrow(expected);
  },
);
test.each([new Error("opaque"), "opaque", null, {}])(
  "unknown transaction errors keep their identity",
  async (error) => {
    const h = harness();
    h.execute.mockRejectedValueOnce(error);
    await expect(h.repo.expireHolds(now)).rejects.toBe(error);
  },
);
describe("checkout and idempotency", () => {
  const checkout = {
    holdId: booking.id,
    paymentMode: "psp" as const,
    acceptedPolicyVersion: "2026-11-03",
  };
  const held = { ...booking, state: "held" };
  test("queues checkout and persists result under the actor, operation, key and input hash", async () => {
    const h = harness([], [], [], [held], [{ mode: null }], [held]);
    await expect(h.repo.checkout(actor, checkout, "key", now)).resolves.toEqual(
      held,
    );
    expect(h.jobs()).toEqual([
      { kind: "checkout.start", payload: { orderId: booking.id } },
    ]);
    const stored = h
      .writes()
      .find((call) => call[0].startsWith("insert into idempotency"));
    expect(stored?.[1]?.slice(0, 4)).toEqual([
      actor.id,
      "checkout",
      "key",
      createHash("sha256").update(JSON.stringify(checkout)).digest("hex"),
    ]);
  });
  test("replays a matching result and rejects changed payload or absent keys", async () => {
    const hash = createHash("sha256")
      .update(JSON.stringify(checkout))
      .digest("hex");
    await expect(
      harness([], [{ payload_hash: hash, result: held }]).repo.checkout(
        actor,
        checkout,
        "key",
        now,
      ),
    ).resolves.toEqual(held);
    await expect(
      harness([], [{ payload_hash: "different", result: held }]).repo.checkout(
        actor,
        checkout,
        "key",
        now,
      ),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    for (const key of ["", "x".repeat(201)])
      await expect(
        harness().repo.checkout(actor, checkout, key, now),
      ).rejects.toThrow("IDEMPOTENCY_KEY_REQUIRED");
  });
  test("rejects wrong participant, state, elapsed hold and policy before initiating payment", async () => {
    for (const [current, error] of [
      [{ ...held, menteeId: "other" }, "NOT_FOUND"],
      [booking, "HOLD_EXPIRED"],
      [{ ...held, expiresAt: now }, "HOLD_EXPIRED"],
      [{ ...held, policyVersion: "new" }, "POLICY_REQUIRED"],
    ] as const) {
      await expect(
        harness([], [], [], [current], [{ mode: null }]).repo.checkout(
          mentorActor,
          checkout,
          "key",
          now,
        ),
      ).rejects.toThrow(error === "NOT_FOUND" ? error : "NOT_FOUND");
    }
    await expect(
      harness([], [], [], [booking], [{ mode: null }]).repo.checkout(
        actor,
        checkout,
        "key",
        now,
      ),
    ).rejects.toThrow("HOLD_EXPIRED");
    await expect(
      harness(
        [],
        [],
        [],
        [{ ...held, expiresAt: now }],
        [{ mode: null }],
      ).repo.checkout(actor, checkout, "key", now),
    ).rejects.toThrow("HOLD_EXPIRED");
    await expect(
      harness(
        [],
        [],
        [],
        [{ ...held, policyVersion: "new" }],
        [{ mode: null }],
      ).repo.checkout(actor, checkout, "key", now),
    ).rejects.toThrow("POLICY_REQUIRED");
  });
  test("credit checkout consumes one credit atomically and queues confirmation", async () => {
    const h = harness(
      [],
      [],
      [],
      [held],
      [{ mode: null }],
      [{ id: pack.id, amountMinor: "72000" }],
      [booking],
    );
    await expect(
      h.repo.checkout(
        actor,
        { ...checkout, paymentMode: "credit" },
        "credit-key",
        now,
      ),
    ).resolves.toEqual(booking);
    expect(
      h.writes().some((call) => call[0].includes("credits=credits-1")),
    ).toBe(true);
    expect(h.jobs()[0]).toEqual({
      kind: "notification.send",
      payload: {
        userId: actor.id,
        template: "booking_confirmed",
        bookingId: booking.id,
      },
    });
    await expect(
      harness([], [], [], [held], [{ mode: null }], []).repo.checkout(
        actor,
        { ...checkout, paymentMode: "credit" },
        "key",
        now,
      ),
    ).rejects.toThrow("NO_CREDITS");
  });
});
test("booking listing scopes both participants and notes remain private", async () => {
  const h = harness(
    [booking],
    [booking],
    [booking],
    [booking],
    [{ note: "Private" }],
    [booking],
    [],
  );
  await expect(h.repo.booking(actor, booking.id)).resolves.toEqual(booking);
  await expect(h.repo.bookings(actor)).resolves.toEqual([booking]);
  await h.repo.saveNote(actor, booking.id, "Private");
  await expect(h.repo.note(actor, booking.id)).resolves.toBe("Private");
  await expect(h.repo.note(actor, booking.id)).resolves.toBe("");
  expect(h.writes()[0]?.[1]).toEqual([booking.id, actor.id, "Private"]);
  await expect(
    harness([booking]).repo.saveNote(actor, booking.id, "x".repeat(2001)),
  ).rejects.toThrow("INVALID_NOTE");
});
test("cancel schedules one refund for PSP payment and audits the decision", async () => {
  const h = harness(
    [],
    [],
    [],
    [booking],
    [{ provider_payment_id: "pi_1" }],
    [{ id: "refund" }],
    [{ ...booking, state: "cancelled" }],
  );
  await expect(
    h.repo.cancel(actor, booking.id, "A valid reason", 1, "key", now),
  ).resolves.toMatchObject({ state: "cancelled" });
  expect(h.jobs().map((job) => job.kind)).toEqual([
    "payment.refund",
    "notification.send",
  ]);
  expect(
    h
      .writes()
      .find((call) => call[0].startsWith("insert into audit_log"))?.[1]
      ?.slice(1, 6),
  ).toEqual([actor.id, null, "booking.cancel", "A valid reason", now]);
});
test.each([true, false])(
  "credit cancellation returns a credit only when its ledger row was inserted: %s",
  async (inserted) => {
    const h = harness(
      [],
      [],
      [],
      [{ ...booking, paymentMode: "credit" }],
      [{ package_id: pack.id }],
      inserted ? [{ id: "ledger" }] : [],
      [booking],
    );
    await h.repo.cancel(actor, booking.id, "A valid reason", 1, "key", now);
    expect(
      h.writes().some((call) => call[0].includes("credits=credits+1")),
    ).toBe(inserted);
  },
);
test("reschedule updates only after a valid target slot and completion enforces time and state", async () => {
  const h = harness([booking], [], [booking], [slot], [], [booking]);
  await expect(
    h.repo.reschedule(actor, booking.id, slot.id, 1, now),
  ).resolves.toEqual(booking);
  expect(h.jobs()[0]?.payload).toMatchObject({
    template: "booking_rescheduled",
  });
  await expect(
    harness([], [booking]).repo.complete(actor, booking.id, now),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    harness([], [booking]).repo.complete(mentorActor, booking.id, now),
  ).rejects.toThrow("SESSION_NOT_ENDED");
  await expect(
    harness([], [{ ...booking, state: "held" }]).repo.complete(
      mentorActor,
      booking.id,
      "2026-11-06T00:00:00Z",
    ),
  ).rejects.toThrow("INVALID_BOOKING_STATE");
  await expect(
    harness([], [booking], [{ ...booking, state: "completed" }]).repo.complete(
      mentorActor,
      booking.id,
      "2026-11-06T00:00:00Z",
    ),
  ).resolves.toMatchObject({ state: "completed" });
});
test("reviews require the mentee and a completed booking", async () => {
  await expect(
    harness([booking]).repo.addReview(
      mentorActor,
      booking.id,
      5,
      "Good mentoring",
      now,
    ),
  ).rejects.toThrow("NOT_FOUND");
  await expect(
    harness([booking]).repo.addReview(
      actor,
      booking.id,
      5,
      "Good mentoring",
      now,
    ),
  ).rejects.toThrow("NOT_COMPLETED");
  const h = harness(
    [{ ...booking, state: "completed" }],
    [{ id: "review", rating: 5 }],
  );
  await expect(
    h.repo.addReview(actor, booking.id, 5, "Good mentoring", now),
  ).resolves.toEqual({ id: "review", rating: 5 });
});
test("conversations reject self messaging and map participant data", async () => {
  const thread = {
    id: "thread",
    menteeId: actor.id,
    mentorUserId: mentorActor.id,
  };
  const h = harness([thread], [mentor], [thread]);
  await expect(h.repo.conversations(actor)).resolves.toEqual([thread]);
  await expect(h.repo.conversation(actor, mentor.id)).resolves.toEqual(thread);
  await expect(
    harness([{ ...mentor, userId: actor.id }]).repo.conversation(
      actor,
      mentor.id,
    ),
  ).rejects.toThrow("OWN_CONVERSATION");
});
test("message cursors are bound to the thread and reverse each descending page for display", async () => {
  const thread = { menteeId: actor.id, mentorUserId: mentorActor.id };
  const values = Array.from({ length: 21 }, (_, index) => ({
    id: "message-" + index,
    createdAt: now,
  }));
  const h = harness(
    [thread],
    [],
    [thread],
    [{ id: "cursor", createdAt: now }],
    values,
  );
  await expect(h.repo.messages(actor, "thread")).resolves.toEqual({
    data: [],
    nextCursor: null,
  });
  const result = await h.repo.messages(actor, "thread", "cursor");
  expect(result.data[0]?.id).toBe("message-19");
  expect(result.nextCursor).toBe("message-19");
  expect(h.execute.mock.calls[3]?.[1]).toEqual(["cursor", "thread"]);
});
test("messages deduplicate per client id and reject mismatched replay and invalid ids", async () => {
  const thread = { menteeId: actor.id, mentorUserId: mentorActor.id };
  const previous = { id: "msg", text: "Hello" };
  for (const id of ["", "x".repeat(201)])
    await expect(
      harness([thread]).repo.sendMessage(actor, "thread", "Hello", id, now),
    ).rejects.toThrow("INVALID_MESSAGE_ID");
  await expect(
    harness([thread], [], [previous]).repo.sendMessage(
      actor,
      "thread",
      "Hello",
      "client",
      now,
    ),
  ).resolves.toEqual(previous);
  await expect(
    harness([thread], [], [previous]).repo.sendMessage(
      actor,
      "thread",
      "Changed",
      "client",
      now,
    ),
  ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  const h = harness([thread], [], []);
  await expect(
    h.repo.sendMessage(actor, "thread", "Hello", "client", now),
  ).resolves.toMatchObject({
    conversationId: "thread",
    senderId: actor.id,
    text: "Hello",
    createdAt: now,
  });
  expect(h.writes()[0]?.[1]?.slice(1)).toEqual([
    "thread",
    actor.id,
    "Hello",
    "client",
    now,
  ]);
});
test("learning plans preserve non-target milestones and increment their version", async () => {
  const plan = {
    id: "plan",
    goal: "career",
    milestones: [
      { id: "one", title: "First", completed: false },
      { id: "two", title: "Second", completed: false },
    ],
    version: 1,
  };
  const h = harness([], [plan], [plan]);
  await expect(h.repo.learningPlan(actor)).resolves.toEqual({
    id: "",
    goal: "",
    milestones: [],
    version: 1,
  });
  await expect(h.repo.learningPlan(actor)).resolves.toEqual(plan);
  await expect(h.repo.saveMilestone(actor, "two", true, 1)).resolves.toEqual({
    ...plan,
    milestones: [
      plan.milestones[0],
      { ...plan.milestones[1], completed: true },
    ],
    version: 2,
  });
  await expect(
    harness([plan]).repo.saveMilestone(actor, "missing", true, 1),
  ).rejects.toThrow("NOT_FOUND");
});
test("paid packages expose owner data and only supported transitions are persisted", async () => {
  await expect(harness([pack]).repo.packages(actor)).resolves.toEqual([pack]);
  for (const [action, state] of [
    ["pause", "paused"],
    ["resume", "active"],
    ["cancel", "cancelled"],
  ]) {
    const h = harness([pack], [{ ...pack, state }]);
    await expect(
      h.repo.updatePackage(actor, pack.id, action ?? "", 1),
    ).resolves.toMatchObject({ state });
    expect(h.writes()[0]?.[1]).toEqual([state, pack.id]);
  }
  for (const [current, action, error] of [
    [{ ...pack, paymentState: "pending" }, "pause", "PACKAGE_NOT_PAID"],
    [pack, "unknown", "INVALID_PACKAGE_ACTION"],
    [{ ...pack, state: "cancelled" }, "resume", "INVALID_PACKAGE_STATE"],
    [{ ...pack, state: "expired" }, "resume", "INVALID_PACKAGE_STATE"],
  ] as const)
    await expect(
      harness([current]).repo.updatePackage(actor, pack.id, action, 1),
    ).rejects.toThrow(error);
});
test("package purchase requires a completed first session and snapshots four sessions", async () => {
  await expect(
    harness([], [], [mentor], []).repo.buyPackage(actor, mentor.id, "key", now),
  ).rejects.toThrow("FIRST_SESSION_REQUIRED");
  const h = harness([], [], [mentor], [{ id: "completed" }], [pack]);
  await expect(
    h.repo.buyPackage(actor, mentor.id, "key", now),
  ).resolves.toEqual(pack);
  expect(
    h
      .writes()
      .find((call) => call[0].startsWith("insert into payments"))?.[1]?.[2],
  ).toBe("72000");
  expect(h.jobs()[0]?.kind).toBe("checkout.start");
});
test("mentor application validates every profile bound and prevents duplicate mentors", async () => {
  await expect(
    harness([{ id: mentor.id }]).repo.applyMentor(actor, input),
  ).rejects.toThrow("MENTOR_ALREADY_EXISTS");
  for (const invalid of [
    { priceMinor: "4999" },
    { priceMinor: "50001" },
    { years: 0 },
    { years: 41 },
    { bio: "x".repeat(49) },
    { bio: "x".repeat(1001) },
    { headline: "short" },
    { headline: "x".repeat(101) },
  ])
    await expect(
      harness([]).repo.applyMentor(actor, { ...input, ...invalid }),
    ).rejects.toThrow("INVALID_MENTOR_PROFILE");
  await expect(
    harness([], [application]).repo.applyMentor(actor, input),
  ).resolves.toEqual(application);
  const h = harness([], [application], [mentor]);
  await expect(h.repo.ownApplication(actor)).resolves.toBeNull();
  await expect(h.repo.ownApplication(actor)).resolves.toEqual(application);
  await expect(h.repo.ownMentor(mentorActor)).resolves.toEqual(mentor);
});
test("mentor edits require the stored version and reject unsafe profile changes", async () => {
  for (const invalid of [
    { priceMinor: "4999" },
    { priceMinor: "50001" },
    { bio: "short" },
    { headline: "short" },
  ])
    await expect(
      harness([mentor]).repo.saveMentor(mentorActor, {
        ...input,
        version: 1,
        ...invalid,
      }),
    ).rejects.toThrow("INVALID_MENTOR_PROFILE");
  await expect(
    harness([mentor]).repo.saveMentor(mentorActor, input),
  ).rejects.toThrow("STALE_VERSION");
  const h = harness([mentor], [{ id: mentor.id }], [{ ...mentor, version: 2 }]);
  await expect(
    h.repo.saveMentor(mentorActor, { ...input, version: 1 }),
  ).resolves.toMatchObject({ version: 2 });
  const update = h.execute.mock.calls.find((call) =>
    call[0].startsWith("update mentor_profiles"),
  );
  expect(update?.[1]?.slice(-2)).toEqual([mentor.id, mentor.version]);
  await expect(
    harness([mentor], []).repo.saveMentor(mentorActor, {
      ...input,
      version: 1,
    }),
  ).rejects.toThrow("STALE_VERSION");
});

test("availability rules preserve exceptions and validate caps and calendar dates", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  try {
    const rules = [{ weekday: 3, localTime: "12:00", timezone: "UTC" }];
    const exceptions = [{ localDate: "2026-11-04", available: false }];
    await expect(
      harness([mentor], rules, exceptions).repo.availabilityRules(mentorActor),
    ).resolves.toEqual({ rules, exceptions });
    for (const [ruleList, exceptionList] of [
      [Array(36).fill(rules[0]), []],
      [[], Array(367).fill(exceptions[0])],
    ] as const)
      await expect(
        harness([mentor]).repo.saveAvailabilityRules(
          mentorActor,
          [...ruleList],
          [...exceptionList],
        ),
      ).rejects.toThrow("TOO_MANY_RULES");
    for (const localDate of ["bad", "2026-99-99"])
      await expect(
        harness([mentor]).repo.saveAvailabilityRules(
          mentorActor,
          [],
          [{ localDate, available: false }],
        ),
      ).rejects.toThrow("INVALID_CALENDAR_EXCEPTION");
    const h = harness([mentor], [mentor]);
    await expect(
      h.repo.saveAvailabilityRules(mentorActor, rules, exceptions),
    ).resolves.toEqual({ rules, exceptions });
    await h.repo.saveAvailabilityRules(
      mentorActor,
      [
        {
          ...rules[0],
          weekday: 3,
          localTime: "12:00",
          timezone: "UTC",
          disambiguation: "later",
        },
      ],
      [],
    );
    const writes = h
      .writes()
      .filter((call) => call[0].startsWith("insert into availability_rules"));
    expect(writes.map((call) => call[1]?.at(-1))).toEqual(["reject", "later"]);
  } finally {
    vi.useRealTimers();
  }
});
test("explicit availability prevents overlaps, retains booked slots and sorts before validation", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  try {
    await expect(
      harness([mentor]).repo.saveAvailability(
        mentorActor,
        Array(101).fill(slot),
      ),
    ).rejects.toThrow("TOO_MANY_SLOTS");
    await expect(
      harness([mentor]).repo.saveAvailability(mentorActor, [slot, slot]),
    ).rejects.toThrow("OVERLAPPING_AVAILABILITY");
    await expect(
      harness(
        [mentor],
        [{ startsAt: slot.startsAt, endsAt: slot.endsAt }],
      ).repo.saveAvailability(mentorActor, []),
    ).rejects.toThrow("BOOKED_SLOT");
    const later = {
      ...slot,
      id: "later",
      startsAt: "2026-11-05T10:50:00.000Z",
      endsAt: "2026-11-05T11:40:00.000Z",
    };
    const h = harness(
      [mentor],
      [{ startsAt: slot.startsAt, endsAt: slot.endsAt }],
      [slot, later],
    );
    await expect(
      h.repo.saveAvailability(mentorActor, [later, slot]),
    ).resolves.toEqual([slot, later]);
    expect(
      h
        .writes()
        .filter((call) => call[0].startsWith("insert into availability_slots")),
    ).toHaveLength(2);
    // A malformed sparse array fails the transaction instead of committing an invalid slot.
    const sparse = new Array<AvailabilitySlot>(1);
    const empty = harness([mentor], [], []);
    await expect(
      empty.repo.saveAvailability(mentorActor, sparse),
    ).rejects.toThrow(TypeError);
  } finally {
    vi.useRealTimers();
  }
});
test("earnings deduct reserved payouts, ignore failed payouts and never expose a negative balance", async () => {
  const totals = {
    grossMinor: "18000",
    feeMinor: "2700",
    netMinor: "15300",
    settledMinor: "15300",
  };
  const h = harness(
    [mentor],
    [totals],
    [
      { amountMinor: "300", state: "pending" },
      { amountMinor: "999999", state: "failed" },
    ],
    [{ accountId: null, ready: false }],
    [mentor],
    [totals],
    [{ amountMinor: "20000", state: "succeeded" }],
    [{ accountId: "acct", ready: true }],
  );
  await expect(h.repo.earnings(mentorActor)).resolves.toMatchObject({
    availableMinor: "15000",
    connectAccount: { accountId: null, ready: false },
  });
  await expect(h.repo.earnings(mentorActor)).resolves.toMatchObject({
    availableMinor: "0",
  });
});
test("payout checks positive amount, KYC and settled balance and queues one transfer", async () => {
  await expect(
    harness().repo.payout(mentorActor, "0", "key", now),
  ).rejects.toThrow("INVALID_MONEY");
  for (const account of [
    { accountId: null, ready: false },
    { accountId: null, ready: true },
  ])
    await expect(
      harness([], [], [], [account]).repo.payout(
        mentorActor,
        "100",
        "key",
        now,
      ),
    ).rejects.toThrow("KYC_REQUIRED");
  await expect(
    harness(
      [],
      [],
      [],
      [{ accountId: "acct", ready: true }],
      [mentor],
      [{ available: "99" }],
    ).repo.payout(mentorActor, "100", "key", now),
  ).rejects.toThrow("INSUFFICIENT_BALANCE");
  const payout = { id: "payout", amountMinor: "100", state: "pending" };
  const h = harness(
    [],
    [],
    [],
    [{ accountId: "acct", ready: true }],
    [mentor],
    [{ available: "100" }],
    [payout],
  );
  await expect(h.repo.payout(mentorActor, "100", "key", now)).resolves.toEqual(
    payout,
  );
  expect(h.jobs()[0]).toMatchObject({
    kind: "payout.send",
    payload: { amountMinor: "100", currency: "PLN", accountId: "acct" },
  });
  for (const success of [true, false]) {
    await h.repo.completePayout("payout", "transfer", success);
    await h.repo.markRefundResult(booking.id, "refund", success);
  }
  expect(
    h
      .writes()
      .slice(-4)
      .map((call) => call[1]?.[0]),
  ).toEqual(["succeeded", "succeeded", "failed", "failed"]);
});
test("support validates descriptions and optional session ownership", async () => {
  for (const description of ["short", "x".repeat(2001)])
    await expect(
      harness().repo.support(actor, "other", description),
    ).rejects.toThrow("INVALID_DESCRIPTION");
  const support = { ...application, kind: "support" };
  const h = harness([support], [booking], [support], [support]);
  await expect(
    h.repo.support(actor, "other", "A detailed support description"),
  ).resolves.toEqual(support);
  await h.repo.support(
    actor,
    "session",
    "A detailed support description",
    booking.id,
  );
  await expect(h.repo.ownCases(actor)).resolves.toEqual([support]);
  const payloads = h
    .writes()
    .map((call) => JSON.parse(String(call[1]?.[2])) as unknown);
  expect(payloads).toEqual([
    { category: "other", description: "A detailed support description" },
    {
      category: "session",
      description: "A detailed support description",
      sessionId: booking.id,
    },
  ]);
});
test("admin case lists apply role-specific scopes and detail permits owners or the proper staff", async () => {
  const moderator: Actor = { ...admin, roles: ["moderator"] },
    support: Actor = { ...admin, roles: ["support"] };
  const h = harness(
    [application],
    [application],
    [],
    [],
    [application],
    [],
    [{ ...application, kind: "support" }],
    [],
  );
  await h.repo.adminCases(admin);
  await h.repo.adminCases(admin, "support");
  await h.repo.adminCases(moderator);
  await h.repo.adminCases(support);
  expect(h.execute.mock.calls.slice(0, 4).map((call) => call[1])).toEqual([
    [],
    ["support"],
    ["mentor_application"],
    ["support"],
  ]);
  await expect(h.repo.caseDetail(actor, application.id)).resolves.toEqual({
    item: application,
    audit: [],
  });
  await expect(
    h.repo.caseDetail(support, application.id),
  ).resolves.toMatchObject({ item: { kind: "support" } });
  await expect(
    harness([application]).repo.caseDetail(support, application.id),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    harness([application], []).repo.caseDetail(moderator, application.id),
  ).resolves.toMatchObject({ item: application });
});
test("case decisions validate state, reason and permitted action and audit atomic role changes", async () => {
  await expect(
    harness([{ ...application, status: "approved" }]).repo.decideCase(
      admin,
      application.id,
      "approve",
      "A valid reason",
      1,
      now,
    ),
  ).rejects.toThrow("STALE_CASE");
  for (const reason of ["short", "x".repeat(1001)])
    await expect(
      harness([application]).repo.decideCase(
        admin,
        application.id,
        "approve",
        reason,
        1,
        now,
      ),
    ).rejects.toThrow("INVALID_REASON");
  for (const [item, action] of [
    [application, "resolve"],
    [{ ...application, kind: "support" }, "approve"],
  ])
    await expect(
      harness([item]).repo.decideCase(
        admin,
        application.id,
        String(action),
        "A valid reason",
        1,
        now,
      ),
    ).rejects.toThrow("INVALID_DECISION");
  for (const [item, action, status] of [
    [application, "approve", "approved"],
    [application, "reject", "rejected"],
    [{ ...application, kind: "support" }, "resolve", "resolved"],
  ]) {
    const h = harness([item], [{ ...application, status }]);
    await expect(
      h.repo.decideCase(
        admin,
        application.id,
        String(action),
        "A valid reason",
        1,
        now,
      ),
    ).resolves.toMatchObject({ status });
    expect(
      h
        .writes()
        .some((call) => call[0].startsWith("insert into mentor_profiles")),
    ).toBe(action === "approve");
    expect(h.jobs()[0]).toMatchObject({
      kind: "notification.send",
      payload: { template: "case_decided" },
    });
  }
});
test("payment inbox returns duplicates without queuing a second durable job", async () => {
  const h = harness([], [{ id: "inbox" }]);
  await expect(h.repo.acceptPaymentEvent(event, now)).resolves.toBe(false);
  await expect(h.repo.acceptPaymentEvent(event, now)).resolves.toBe(true);
  expect(h.jobs()).toEqual([{ kind: "payment.process", payload: { event } }]);
});
test("payment events reject amount/currency mismatches, retain paid finality and apply refund states", async () => {
  for (const received of [
    { ...event, amountMinor: "17999" },
    { ...event, currency: "USD" },
  ])
    await expect(
      harness([], [payment]).repo.processPaymentEvent(received, now),
    ).rejects.toThrow("PAYMENT_MISMATCH");
  for (const status of ["refund_succeeded", "refund_failed"] as const) {
    const h = harness(
      [],
      [payment],
      [
        {
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          paymentId: event.paymentId,
        },
      ],
    );
    await h.repo.processPaymentEvent({ ...event, status }, now);
    expect(h.writes()[0]?.[1]).toEqual([
      status === "refund_succeeded" ? "succeeded" : "failed",
      event.paymentId,
      payment.id,
    ]);
  }
  const paid = harness([], [{ ...payment, state: "paid" }]);
  await paid.repo.processPaymentEvent({ ...event, status: "failed" }, now);
  expect(paid.writes()).toHaveLength(0);
  const failed = harness([], [payment]);
  await failed.repo.processPaymentEvent({ ...event, status: "failed" }, now);
  expect(failed.writes()[0]?.[0]).toContain("state='failed'");
});
test.each([true, false])(
  "package payment credits are granted once according to ledger insertion %s",
  async (inserted) => {
    const h = harness(
      [],
      [{ ...payment, bookingId: null, packageId: pack.id }],
      [{ userId: actor.id, mentorId: mentor.id }],
      inserted ? [{ id: "ledger" }] : [],
    );
    await h.repo.processPaymentEvent(event, now);
    expect(
      h.writes().some((call) => call[0].includes("credits=credits+4")),
    ).toBe(inserted);
    expect(h.jobs()[0]).toMatchObject({
      payload: { template: "package_paid", userId: actor.id },
    });
  },
);
test("successful payment confirms a still available booking and expires other holds", async () => {
  const h = harness(
    [],
    [payment],
    [booking],
    [
      { id: "expired", checkoutId: "cs_old" },
      { id: "expired-2", checkoutId: null },
    ],
  );
  await h.repo.processPaymentEvent(event, now);
  expect(h.jobs().map((job) => job.kind)).toEqual([
    "checkout.expire",
    "notification.send",
    "notification.send",
    "notification.send",
  ]);
  expect(
    h
      .writes()
      .some((call) => call[0] === "release savepoint reacquire_booking"),
  ).toBe(true);
});
test.each([
  { ...booking, state: "cancelled" },
  { ...booking, startsAt: now },
])("late payment refunds cancelled or elapsed sessions", async (current) => {
  const h = harness([], [payment], [current], [], [{ id: "refund" }]);
  await h.repo.processPaymentEvent(event, now);
  expect(h.jobs()).toEqual([
    {
      kind: "payment.refund",
      payload: {
        orderId: payment.id,
        paymentId: event.paymentId,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
      },
    },
  ]);
});
test("duplicate refund insertion never queues another provider refund", async () => {
  const h = harness(
    [],
    [payment],
    [{ ...booking, state: "cancelled" }],
    [],
    [],
  );
  await h.repo.processPaymentEvent(event, now);
  expect(h.jobs()).toEqual([]);
});
test("an occupied late-payment slot rolls back reacquisition and queues one refund", async () => {
  const h = harness([], [payment], [booking], [], [{ id: "refund" }]);
  const base = h.execute.getMockImplementation();
  h.execute.mockImplementation(async (sql, params, method) => {
    if (sql.startsWith("update bookings set state='confirmed'"))
      throw { code: "23P01" };
    return base?.(sql, params, method);
  });
  await h.repo.processPaymentEvent(event, now);
  expect(
    h
      .writes()
      .some((call) => call[0] === "rollback to savepoint reacquire_booking"),
  ).toBe(true);
  expect(h.jobs().map((job) => job.kind)).toEqual([
    "payment.refund",
    "notification.send",
  ]);
});
test.each([new Error("driver failure"), "unknown", null, { code: "40001" }])(
  "unknown reacquisition errors roll back and propagate",
  async (error) => {
    const h = harness([], [payment], [booking], []);
    const base = h.execute.getMockImplementation();
    h.execute.mockImplementation(async (sql, params, method) => {
      if (sql.startsWith("update bookings set state='confirmed'")) throw error;
      return base?.(sql, params, method);
    });
    const promise = h.repo.processPaymentEvent(event, now);
    if (typeof error === "object" && error !== null && "code" in error)
      await expect(promise).rejects.toThrow("RETRY_CONFLICT");
    else await expect(promise).rejects.toBe(error);
  },
);
test("durable job leases clamp duration and worker writes include ownership tokens", async () => {
  const job = {
    id: "job",
    kind: "notification.send",
    attempts: 1,
    leaseToken: "token",
  };
  const h = harness([job], [], [], []);
  await expect(h.repo.claimJobs(now)).resolves.toEqual([job]);
  await h.repo.claimJobs(now, 1);
  await h.repo.claimJobs(now, 1000);
  expect(
    h.execute.mock.calls
      .filter((call) => call[2] === "all")
      .map((call) => call[1]?.[3]),
  ).toEqual([60, 30, 900]);
  await h.repo.finishJob(job.id, job.leaseToken);
  await h.repo.failJob(job.id, job.leaseToken, now);
  expect(h.writes().at(-1)?.[1]).toEqual([job.id, job.leaseToken]);
  expect(
    h.execute.mock.calls.find((call) =>
      call[0].startsWith("update outbox_jobs set state=case"),
    )?.[1],
  ).toEqual([now, job.id, job.leaseToken]);
});
test("checkout attachment is idempotent and expires a provider session when its hold already elapsed", async () => {
  const duplicate = harness([]);
  await duplicate.repo.attachCheckout(booking.id, "cs", "https://example.test");
  expect(duplicate.execute).toHaveBeenCalledTimes(1);
  expect(duplicate.jobs()).toEqual([]);
  const live = harness([{ id: booking.id }], []);
  await live.repo.attachCheckout(booking.id, "cs", "https://example.test");
  expect(live.execute.mock.calls[0]?.[1]).toEqual([
    "cs",
    "https://example.test",
    booking.id,
  ]);
  expect(live.jobs()).toEqual([]);
  const expired = harness([{ id: booking.id }], [{ id: booking.id }]);
  await expired.repo.attachCheckout(
    booking.id,
    "cs_late",
    "https://example.test",
  );
  expect(expired.jobs()).toEqual([
    {
      kind: "checkout.expire",
      payload: { orderId: booking.id, checkoutId: "cs_late" },
    },
  ]);
});
test("operational reads and updates retain typed DTOs", async () => {
  const refund = { orderId: booking.id, state: "pending" };
  const order = { id: booking.id, kind: "booking" };
  const metrics = {
    pending: 1,
    failed: 0,
    oldestAgeSeconds: 2,
    held: 3,
    conflicts: 0,
  };
  const h = harness(
    [refund],
    [order],
    [metrics],
    [{ accountId: "acct", ready: true }],
    [],
  );
  await expect(h.repo.pendingRefunds()).resolves.toEqual([refund]);
  await expect(h.repo.pendingPayments()).resolves.toEqual([order]);
  await expect(h.repo.metrics(now)).resolves.toEqual(metrics);
  await expect(h.repo.connectAccount(mentorActor)).resolves.toEqual({
    accountId: "acct",
    ready: true,
  });
  await h.repo.attachRefund(booking.id, "re_1");
  await h.repo.updateConnectAccount(mentorActor.id, "acct", true);
  await expect(h.repo.expireHolds(now)).resolves.toBe(0);
});
test("failed jobs require admin/MFA in every environment and replay refund jobs safely", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(
    harness().repo.failedJobs({ ...admin, mfaVerified: false }),
  ).rejects.toThrow("MFA_REQUIRED");
  await expect(
    harness().repo.retryFailedJob({ ...admin, mfaVerified: false }, "job"),
  ).rejects.toThrow("MFA_REQUIRED");
  const h = harness(
    [{ id: "job", kind: "payment.refund" }],
    [{ kind: "payment.refund", payload: { orderId: booking.id } }],
    [{ kind: "notification.send", payload: {} }],
    [],
  );
  await expect(h.repo.failedJobs(admin)).resolves.toHaveLength(1);
  await h.repo.retryFailedJob(admin, "job");
  await h.repo.retryFailedJob(admin, "other-job");
  expect(
    h.writes().filter((call) => call[0].startsWith("update refunds")),
  ).toHaveLength(1);
  vi.stubEnv("NODE_ENV", "test");
  await expect(
    h.repo.failedJobs({ ...admin, mfaVerified: false }),
  ).rejects.toThrow("MFA_REQUIRED");
});

test("pagination returns null when the SQL boundary omits a cursor id", async () => {
  const malformed = Array.from({ length: 21 }, () => ({}));
  const h = harness(
    malformed,
    [{ menteeId: actor.id, mentorUserId: mentorActor.id }],
    malformed,
  );
  await expect(h.repo.reviews(mentor.id)).resolves.toMatchObject({
    nextCursor: null,
  });
  await expect(h.repo.messages(actor, "thread")).resolves.toMatchObject({
    nextCursor: null,
  });
});
test("explicit admin case filters validate kinds and enforce the corresponding staff permission", async () => {
  await expect(harness().repo.adminCases(admin, "unknown")).rejects.toThrow(
    "INVALID_CASE_KIND",
  );
  await expect(
    harness([]).repo.adminCases(admin, "mentor_application"),
  ).resolves.toEqual([]);
  await expect(
    harness().repo.adminCases(
      { ...admin, roles: ["support"] },
      "mentor_application",
    ),
  ).rejects.toThrow("FORBIDDEN");
});

test("catalog cursors encode each sort key and reject malformed or mismatched cursors", async () => {
  for (const [sort, value] of [
    ["recommended", "5"],
    ["price", "18000"],
    ["experience", "8"],
  ] as const) {
    const cursor = Buffer.from(
      JSON.stringify({ id: mentor.id, sort, value }),
    ).toString("base64url");
    const h = harness([mentor, { ...mentor, id: "next" }]);
    await expect(h.repo.mentors({ sort, cursor, limit: 1 })).resolves.toEqual({
      data: [mentor],
      nextCursor: cursor,
    });
  }
  await expect(harness().repo.mentors({ sort: "invalid" })).rejects.toThrow(
    "INVALID_SORT",
  );
  for (const cursor of [
    "bad",
    ...[
      null,
      [],
      1,
      { sort: "price", id: "m", value: "1" },
      { sort: "recommended", id: 1, value: "1" },
      { sort: "recommended", id: "m", value: 1 },
      { sort: "recommended", id: "m", value: "bad" },
    ].map((value) => Buffer.from(JSON.stringify(value)).toString("base64url")),
  ])
    await expect(harness().repo.mentors({ cursor })).rejects.toThrow(
      "INVALID_CURSOR",
    );
  await expect(
    harness([null, mentor]).repo.mentors({ limit: 1 }),
  ).resolves.toMatchObject({ nextCursor: null });
});
test("exhausted refund delivery marks refund failed only for the owning failed refund job", async () => {
  const h = harness([
    {
      kind: "payment.refund",
      payload: { orderId: booking.id },
      state: "failed",
    },
    { kind: "notification.send", payload: {}, state: "failed" },
    { kind: "payment.refund", payload: {}, state: "pending" },
  ]);
  await h.repo.failJob("job", "lease", now);
  expect(h.writes()).toHaveLength(1);
  expect(h.writes()[0]?.[1]).toEqual([booking.id]);
});

test("SQL DTOs normalize nested Date values and timestamp strings while preserving ordinary data", async () => {
  const source = {
    id: actor.id,
    createdAt: new Date(now),
    endsAt: "2026-11-03 10:50:00+00",
    startsAt: "invalid",
    preferences: { reminders: [true, null, 2], label: "2026-11-03" },
  };
  await expect(harness([source]).repo.profile(actor)).resolves.toEqual({
    ...source,
    createdAt: now,
    endsAt: "2026-11-03T10:50:00.000Z",
  });
});

test("checkout obtains the booking row lock before reading state for payment initiation", async () => {
  const held = { ...booking, state: "held" };
  const h = harness([], [], [], [held], [{ mode: null }], [held]);
  await h.repo.checkout(
    actor,
    {
      holdId: booking.id,
      paymentMode: "psp",
      acceptedPolicyVersion: booking.policyVersion,
    },
    "lock-test",
    now,
  );
  expect(h.execute.mock.calls[2]?.[0]).toBe(
    "select id from bookings where id=? for update",
  );
  expect(h.execute.mock.calls[2]?.[1]).toEqual([booking.id]);
  expect(h.execute.mock.calls[3]?.[0]).toContain("from bookings b");
});
test("exact payment order lookup rejects an expired pending hold and strips internal expiry metadata", async () => {
  const order = {
    id: booking.id,
    kind: "booking",
    amountMinor: "18000",
    currency: "PLN",
    paymentState: "pending",
    checkoutId: "cs",
    checkoutUrl: "https://example.test/checkout",
  };
  await expect(harness([]).repo.paymentOrder("missing")).rejects.toThrow(
    "NOT_FOUND",
  );
  await expect(
    harness([{ ...order, expired: true }]).repo.paymentOrder(booking.id),
  ).rejects.toThrow("HOLD_EXPIRED");
  for (const current of [order, { ...order, paymentState: "paid" }]) {
    const h = harness([
      { ...current, expired: current.paymentState === "paid" },
    ]);
    await expect(h.repo.paymentOrder(booking.id)).resolves.toEqual(current);
    expect(h.execute.mock.calls[0]?.[1]).toEqual([booking.id]);
    expect(h.execute.mock.calls[0]?.[0]).toContain("where p.id=?");
  }
});
test("reconciliation pages attached pending orders using a stable id cursor", async () => {
  const first = Array.from({ length: 100 }, (_, index) => ({
    id: "order-" + String(index).padStart(3, "0"),
  }));
  const last = [{ id: "order-100" }];
  const h = harness(first, last);
  await expect(h.repo.pendingPayments()).resolves.toEqual(first);
  await expect(h.repo.pendingPayments("order-099")).resolves.toEqual(last);
  expect(h.execute.mock.calls.map((call) => call[1])).toEqual([
    [""],
    ["order-099"],
  ]);
  expect(h.execute.mock.calls[0]?.[0]).toContain(
    "state='pending' and checkout_id is not null and id>? order by id limit 100",
  );
});

test("checkout persists its first funding mode before outbox or credit side effects", async () => {
  for (const mode of ["psp", "credit"] as const) {
    const held = { ...booking, state: "held" };
    const responses =
      mode === "credit"
        ? [[{ id: pack.id, amountMinor: "72000" }], [booking]]
        : [[held]];
    const h = harness([], [], [], [held], [{ mode: null }], ...responses);
    await h.repo.checkout(
      actor,
      {
        holdId: booking.id,
        paymentMode: mode,
        acceptedPolicyVersion: booking.policyVersion,
      },
      "funding-" + mode,
      now,
    );
    const fundingIndex = h.execute.mock.calls.findIndex(
      (call) => call[0] === "update payments set checkout_mode=? where id=?",
    );
    expect(fundingIndex).toBeGreaterThan(3);
    expect(h.execute.mock.calls[fundingIndex]?.[1]).toEqual([mode, booking.id]);
    for (const [index, call] of h.execute.mock.calls.entries())
      if (
        call[0].startsWith("insert into outbox_jobs") ||
        call[0].includes("credits=credits-1")
      )
        expect(index).toBeGreaterThan(fundingIndex);
  }
});
test("a PSP funding choice refuses switching to credits with another key while queued or attached", async () => {
  for (const checkoutId of [null, "cs_already_open"]) {
    const held = { ...booking, state: "held", checkoutId };
    const h = harness([], [], [], [held], [{ mode: "psp" }]);
    await expect(
      h.repo.checkout(
        actor,
        {
          holdId: booking.id,
          paymentMode: "credit",
          acceptedPolicyVersion: booking.policyVersion,
        },
        "another-key",
        now,
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_MODE_LOCKED", status: 409 });
    expect(h.writes()).toEqual([]);
  }
});
test("a late legacy PSP charge after credit settlement snapshots one separate refund without changing the session payment", async () => {
  const creditPayment = {
    ...payment,
    state: "paid",
    settlementMode: "credit",
    providerPaymentId: null,
  };
  const charge = {
    ...event,
    amountMinor: "25000",
    currency: "EUR",
    paymentId: "pi_legacy",
  };
  const h = harness(
    [],
    [creditPayment],
    [{ id: "extra-refund" }],
    [{ ...booking, paymentMode: "credit" }],
  );
  await h.repo.processPaymentEvent(charge, now);
  const refund = h.execute.mock.calls.find((call) =>
    call[0].startsWith("insert into refunds"),
  );
  expect(refund?.[1]?.slice(1)).toEqual([
    payment.id,
    "25000",
    now,
    "pi_legacy",
    "EUR",
    "extra_charge",
  ]);
  expect(h.jobs()).toEqual([
    {
      kind: "payment.refund",
      payload: {
        orderId: payment.id,
        paymentId: "pi_legacy",
        amountMinor: "25000",
        currency: "EUR",
      },
    },
    {
      kind: "notification.send",
      payload: {
        userId: actor.id,
        template: "extra_charge_refund",
        bookingId: payment.id,
      },
    },
  ]);
  expect(
    h
      .writes()
      .some((call) =>
        /update (payments|bookings|packages)|insert into credit_ledger/.test(
          call[0],
        ),
      ),
  ).toBe(false);
  const duplicate = harness([], [creditPayment], []);
  await duplicate.repo.processPaymentEvent(charge, now);
  expect(duplicate.jobs()).toEqual([]);
  expect(duplicate.writes()).toEqual([]);
  const failed = harness([], [creditPayment]);
  await failed.repo.processPaymentEvent({ ...charge, status: "failed" }, now);
  expect(failed.writes()).toEqual([]);
});
test("existing PSP settlements and packages never enter the extra-charge credit repair", async () => {
  for (const current of [
    { ...payment, state: "paid", bookingId: null, packageId: pack.id },
    {
      ...payment,
      state: "paid",
      settlementMode: "psp",
      providerPaymentId: "pi_original",
    },
    {
      ...payment,
      state: "paid",
      settlementMode: "credit",
      providerPaymentId: "pi_original",
    },
  ]) {
    const h = harness([], [current]);
    await h.repo.processPaymentEvent(event, now);
    expect(h.writes()).toEqual([]);
  }
});
test("refund result validates its stored provider charge snapshot and uses the refund id when supplied", async () => {
  const refund = {
    amountMinor: "25000",
    currency: "EUR",
    paymentId: "pi_legacy",
  };
  const result = {
    ...event,
    amountMinor: refund.amountMinor,
    currency: refund.currency,
    paymentId: refund.paymentId,
    status: "refund_succeeded" as const,
    refundId: "re_legacy",
  };
  for (const invalid of [
    { ...result, amountMinor: "24999" },
    { ...result, currency: "USD" },
    { ...result, paymentId: "pi_wrong" },
  ])
    await expect(
      harness([], [payment], [refund]).repo.processPaymentEvent(invalid, now),
    ).rejects.toThrow("PAYMENT_MISMATCH");
  const h = harness([], [payment], [refund]);
  await h.repo.processPaymentEvent(result, now);
  expect(h.writes()[0]?.[1]).toEqual(["succeeded", "re_legacy", payment.id]);
  const historical = harness([], [payment], [{ ...refund, paymentId: null }]);
  await historical.repo.processPaymentEvent(result, now);
  expect(historical.writes()[0]?.[1]).toEqual([
    "succeeded",
    "re_legacy",
    payment.id,
  ]);
});
test("calendar rule removal retires its offer without deleting booked history or changing manual offers", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  try {
    const h = harness([mentor]);
    await expect(
      h.repo.saveAvailabilityRules(mentorActor, [], []),
    ).resolves.toEqual({ rules: [], exceptions: [] });
    const slotWrites = h
      .writes()
      .filter((call) => call[0].includes("availability_slots"));
    expect(slotWrites.map((call) => call[0])).toEqual([
      "update availability_slots set rule_offered=false where mentor_id=?",
    ]);
    expect(slotWrites[0]?.[1]).toEqual([mentor.id]);
    const read = harness([mentor], [], [], []);
    await expect(
      read.repo.availability(mentor.id, now, "2026-11-04T10:00:00.000Z"),
    ).resolves.toEqual([]);
    expect(read.execute.mock.calls.at(-1)?.[0]).toContain("s.active");
  } finally {
    vi.useRealTimers();
  }
});
test("specialty filtering compares case insensitively using a parameterized SQL predicate", async () => {
  const h = harness([mentor]);
  await expect(
    h.repo.mentors({ specialty: "FrontEnd" }),
  ).resolves.toMatchObject({ data: [mentor] });
  expect(h.execute.mock.calls[0]?.[0]).toContain("lower(m.specialty)=lower(?)");
  expect(h.execute.mock.calls[0]?.[1]).toEqual(["FrontEnd", 21]);
});

test("extra-charge refund snapshots remain independent from the session's payment amount and provider reference", async () => {
  const refund = {
    orderId: booking.id,
    paymentId: "pi_legacy",
    amountMinor: "25000",
    currency: "EUR",
    providerId: "re_legacy",
    state: "pending",
  };
  const h = harness([refund]);
  await expect(h.repo.pendingRefunds()).resolves.toEqual([refund]);
  const sql = h.execute.mock.calls[0]?.[0];
  expect(sql).toContain(
    'coalesce(r.provider_payment_id,p.provider_payment_id) as "paymentId"',
  );
  expect(sql).toContain('r.amount_minor::text as "amountMinor",r.currency');
});
