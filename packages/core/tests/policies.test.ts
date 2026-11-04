import { describe, expect, test } from "vitest";
import {
  addMoney,
  assertChangeable,
  assertMessage,
  assertReview,
  assertSlot,
  commission,
  DomainError,
  expandAvailability,
  localTimeCandidates,
  money,
  providerAmount,
  requireParticipant,
  requireRole,
  requireAdministrativeAccess,
  requireVersion,
} from "../src/policies";
import type { Actor, AvailabilityRule, Booking } from "../src/platform";

const actor: Actor = { id: "mentee", roles: ["mentee"], mfaVerified: false };
const now = new Date("2026-11-03T10:00:00Z");
const booking = {
  menteeId: "mentee",
  mentorUserId: "mentor",
  policyVersion: "2026-11-03",
  state: "confirmed",
  startsAt: "2026-11-04T10:00:00Z",
} as Booking;

test("domain errors retain machine codes and HTTP statuses", () => {
  expect(new DomainError("INVALID")).toMatchObject({
    code: "INVALID",
    status: 422,
    name: "DomainError",
    message: "INVALID",
  });
  expect(new DomainError("MISSING", 404).status).toBe(404);
});
test("roles, resource membership and optimistic versions enforce access", () => {
  requireRole(actor, ["admin", "mentee"]);
  expect(() => requireRole(actor, [])).toThrow("FORBIDDEN");
  requireParticipant(actor, booking);
  requireParticipant({ ...actor, id: "mentor" }, booking);
  expect(() =>
    requireParticipant({ ...actor, id: "stranger" }, booking),
  ).toThrow("NOT_FOUND");
  requireVersion(1, 1);
  expect(() => requireVersion(1, 2)).toThrow("STALE_VERSION");
});
test("money preserves integer precision, currencies and rounded commission", () => {
  expect(money("000123")).toEqual({ amountMinor: "123", currency: "PLN" });
  expect(money("9223372036854775807", "USD").amountMinor).toBe(
    "9223372036854775807",
  );
  for (const amount of ["-1", "1.1", "", "9223372036854775808"])
    expect(() => money(amount)).toThrow("INVALID_MONEY");
  expect(() => money("1", "pln")).toThrow("INVALID_MONEY");
  expect(addMoney(money("9007199254740993"), money("7"))).toEqual(
    money("9007199254741000"),
  );
  expect(() => addMoney(money("1"), money("1", "USD"))).toThrow(
    "CURRENCY_MISMATCH",
  );
  expect(() => addMoney(money("9223372036854775807"), money("1"))).toThrow(
    "INVALID_MONEY",
  );
  expect(providerAmount(money("9007199254740991"))).toBe(
    Number.MAX_SAFE_INTEGER,
  );
  expect(() => providerAmount(money("9007199254740992"))).toThrow(
    "AMOUNT_OUT_OF_RANGE",
  );
  expect(commission("10")).toBe("2");
  expect(commission("9")).toBe("1");
});
test("slots require 50 minutes, a valid timezone and a full day of notice", () => {
  assertSlot(
    "2026-11-04T10:00:00Z",
    "2026-11-04T10:50:00Z",
    "Europe/Warsaw",
    now,
  );
  for (const [start, end] of [
    ["bad", "2026-11-04T10:50:00Z"],
    ["2026-11-04T10:00:00Z", "bad"],
    ["2026-11-04T10:00:00Z", "2026-11-04T10:49:00Z"],
    ["2026-11-04T09:59:00Z", "2026-11-04T10:49:00Z"],
  ]) {
    expect(() => assertSlot(start ?? "", end ?? "", "UTC", now)).toThrow(
      "INVALID_SLOT",
    );
  }
  expect(() =>
    assertSlot(
      "2026-11-04T10:00:00Z",
      "2026-11-04T10:50:00Z",
      "Invalid/Zone",
      now,
    ),
  ).toThrow("INVALID_TIMEZONE");
  assertChangeable(booking, now);
  expect(() => assertChangeable({ ...booking, state: "held" }, now)).toThrow(
    "INVALID_BOOKING_STATE",
  );
  expect(() => assertChangeable(booking, new Date(now.getTime() + 1))).toThrow(
    "CANCELLATION_CUTOFF",
  );
});
test("messages and reviews reject whitespace, excess length and invalid ratings", () => {
  assertMessage("hello");
  for (const text of [" ", "x".repeat(2001)])
    expect(() => assertMessage(text)).toThrow("INVALID_MESSAGE");
  assertMessage("x".repeat(2000));
  assertReview(1, "x".repeat(10));
  assertReview(5, "x".repeat(1000));
  for (const [rating, text] of [
    [1.5, "valid review"],
    [0, "valid review"],
    [6, "valid review"],
    [4, " short "],
    [4, "x".repeat(1001)],
  ] as const)
    expect(() => assertReview(rating, text)).toThrow("INVALID_REVIEW");
});
test("local time resolution detects DST gaps, repeats and quarter-hour offsets", () => {
  expect(localTimeCandidates("2026-03-29T02:30", "Europe/Warsaw")).toEqual([]);
  expect(localTimeCandidates("2026-10-25T02:30", "Europe/Warsaw")).toEqual([
    "2026-10-25T00:30:00.000Z",
    "2026-10-25T01:30:00.000Z",
  ]);
  expect(localTimeCandidates("2026-11-03T12:00", "Asia/Kathmandu")).toEqual([
    "2026-11-03T06:15:00.000Z",
  ]);
  for (const local of ["2026-11-03", "2026-99-99T12:00"])
    expect(() => localTimeCandidates(local, "UTC")).toThrow(
      "INVALID_LOCAL_TIME",
    );
  expect(() => localTimeCandidates("2026-11-03T12:00", "Invalid/Zone")).toThrow(
    "INVALID_TIMEZONE",
  );
});
describe("availability expansion", () => {
  const from = "2026-11-03T00:00:00Z",
    to = "2026-11-05T00:00:00Z";
  const tuesday: AvailabilityRule = {
    weekday: 2,
    localTime: "10:00",
    timezone: "UTC",
  };
  test("sorts rules, retains exact boundaries and honors blocked calendar dates", () => {
    const rules = [{ ...tuesday, localTime: "12:00" }, tuesday];
    expect(
      expandAvailability(rules, [], from, to).map((slot) => slot.startsAt),
    ).toEqual(["2026-11-03T10:00:00.000Z", "2026-11-03T12:00:00.000Z"]);
    expect(
      expandAvailability(
        rules,
        [{ localDate: "2026-11-03", available: false }],
        from,
        to,
      ),
    ).toEqual([]);
    expect(
      expandAvailability(
        [tuesday],
        [{ localDate: "2026-11-03", available: true }],
        "2026-11-03T10:00:00Z",
        "2026-11-03T10:50:00Z",
      ),
    ).toHaveLength(1);
    expect(
      expandAvailability(
        [tuesday],
        [],
        "2026-11-03T10:00:01Z",
        "2026-11-03T10:50:00Z",
      ),
    ).toEqual([]);
    expect(
      expandAvailability(
        [tuesday],
        [],
        "2026-11-03T09:00:00Z",
        "2026-11-03T10:49:59Z",
      ),
    ).toEqual([]);
  });
  test("rejects invalid date ranges and weekly rules", () => {
    for (const [start, end] of [
      ["bad", to],
      [from, "bad"],
      [to, from],
      [from, from],
      [from, "2026-12-05T00:00:00Z"],
    ])
      expect(() => expandAvailability([], [], start ?? "", end ?? "")).toThrow(
        "INVALID_DATE_RANGE",
      );
    for (const rule of [
      { ...tuesday, weekday: 1.5 },
      { ...tuesday, weekday: -1 },
      { ...tuesday, weekday: 7 },
      { ...tuesday, localTime: "24:00" },
    ])
      expect(() => expandAvailability([rule], [], from, to)).toThrow(
        "INVALID_AVAILABILITY_RULE",
      );
  });
  test("requires explicit DST repeat disambiguation and rejects missing hours", () => {
    const repeat: AvailabilityRule = {
      weekday: 0,
      localTime: "02:30",
      timezone: "Europe/Warsaw",
    };
    for (const rule of [
      repeat,
      { ...repeat, disambiguation: "reject" as const },
    ])
      expect(() =>
        expandAvailability(
          [rule],
          [],
          "2026-10-25T00:00:00Z",
          "2026-10-26T00:00:00Z",
        ),
      ).toThrow("AMBIGUOUS_LOCAL_TIME");
    expect(
      expandAvailability(
        [{ ...repeat, disambiguation: "earlier" }],
        [],
        "2026-10-25T00:00:00Z",
        "2026-10-26T00:00:00Z",
      )[0]?.startsAt,
    ).toBe("2026-10-25T00:30:00.000Z");
    expect(
      expandAvailability(
        [{ ...repeat, disambiguation: "later" }],
        [],
        "2026-10-25T00:00:00Z",
        "2026-10-26T00:00:00Z",
      )[0]?.startsAt,
    ).toBe("2026-10-25T01:30:00.000Z");
    expect(() =>
      expandAvailability(
        [repeat],
        [],
        "2026-03-29T00:00:00Z",
        "2026-03-30T00:00:00Z",
      ),
    ).toThrow("NONEXISTENT_LOCAL_TIME");
  });
});

test("administrative privileges require a verified second factor", () => {
  expect(() =>
    requireAdministrativeAccess({ ...actor, roles: ["admin"] }, ["admin"]),
  ).toThrow("MFA_REQUIRED");
  requireAdministrativeAccess(
    { ...actor, roles: ["admin"], mfaVerified: true },
    ["admin"],
  );
  expect(() => requireAdministrativeAccess(actor, ["admin"])).toThrow(
    "FORBIDDEN",
  );
});
