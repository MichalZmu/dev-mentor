import { expect, test } from "vitest";
import {
  expandAvailability,
  assertChangeable,
  bookingPolicies,
} from "../src/policies";
import type { Booking } from "../src/platform";

test("recurring slots reject overlap and preserve neighboring half-open intervals", () => {
  const first = { weekday: 2, localTime: "10:00", timezone: "Europe/Warsaw" };
  const from = "2026-11-03T00:00:00Z",
    to = "2026-11-04T00:00:00Z";
  expect(() =>
    expandAvailability([first, { ...first, localTime: "10:30" }], [], from, to),
  ).toThrow("OVERLAPPING_AVAILABILITY");
  expect(
    expandAvailability(
      [{ ...first, localTime: "10:50" }, first],
      [],
      from,
      to,
    ).map((slot) => slot.startsAt),
  ).toEqual(["2026-11-03T09:00:00.000Z", "2026-11-03T09:50:00.000Z"]);
});
test("new cancellation policy version cannot change an existing booking snapshot", () => {
  const booking = {
    state: "confirmed",
    startsAt: "2026-11-04T12:00:00Z",
    policyVersion: "2026-11-03",
  } as Booking;
  const now = new Date("2026-11-03T00:00:00Z");
  const registry = {
    ...bookingPolicies,
    "new-version": { cancellationCutoffHours: 48 },
  };
  expect(() => assertChangeable(booking, now, registry)).not.toThrow();
  expect(() =>
    assertChangeable(
      { ...booking, policyVersion: "new-version" },
      now,
      registry,
    ),
  ).toThrow("CANCELLATION_CUTOFF");
  expect(() =>
    assertChangeable({ ...booking, policyVersion: "missing" }, now),
  ).toThrow("UNKNOWN_BOOKING_POLICY");
});
